const axios = require("axios");
const TwitchToken = require("../utils/TwitchToken.js");
const discordBot = require("../Client");
const mongoose = require("mongoose");
const TwitchsRepository = require("../database/mongoose/TwitchsRepository.js");
const GuildsRepository = require("../database/mongoose/GuildsRepository.js");

const TwitchSchema = require("../database/schemas/TwitchSchema.js");
const GuildSchema = require("../database/schemas/GuildSchema.js");

if (!mongoose.models.Twitchs) mongoose.model("Twitchs", TwitchSchema);
if (!mongoose.models.Guilds) mongoose.model("Guilds", GuildSchema);

const twitchRepository = new TwitchsRepository(mongoose, "Twitchs");
const guildRepository = new GuildsRepository(mongoose, "Guilds");

const clientId = process.env.TWITCH_CLIENTID;
const clientSecret = process.env.TWITCH_SECRETID;

async function isChannelLive(accessToken, channelId) {
  try {
    const response = await axios.get("https://api.twitch.tv/helix/streams", {
      params: {
        user_id: channelId,
      },
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.data.length > 0;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.error(`Erro de Auth (400) para canal ${channelId}. Verifique ClientID/Secret.`);
    } else {
      console.error(`Erro ao checar status da live ${channelId}:`, error.message);
    }
    return false;
  }
}

module.exports = async function p() {
  try {
    const accessToken = await TwitchToken(clientId, clientSecret);
    const guildasComNotify = await guildRepository.verifyTwitchNotify();

    for (const guilda of guildasComNotify) {
      const guildId = guilda.guildID;
      const channelToSendId = guilda.channeltch;

      if (!channelToSendId) continue;

      const allTwitchAttributes = await twitchRepository.findAllByGuildId(guildId);

      for (const twitchData of allTwitchAttributes) {

        const currentlyLive = await isChannelLive(accessToken, twitchData.twitch);
        const wasLive = twitchData.isLive || false;

        // Logs de Debug (Remover depois se ficar muito poluído)
        // console.log(`[DEBUG TWITCH] ${twitchData.channel} (Guild: ${guildId}) | Live: ${currentlyLive} | WasLive: ${wasLive}`);

        // Lógica de Notificação e Atualização de Estado
        if (currentlyLive && !wasLive) {

          // ATUALIZA O BANCO PRIMEIRO para evitar race conditions ou duplicação se o send falhar/demorar
          await twitchRepository.updateByTwitchAndGuildId(twitchData.twitch, guildId, { isLive: true });

          try {
            const twitchLink = `https://www.twitch.tv/${twitchData.channel}`;
            const canalEspecifico = await discordBot.channels.fetch(channelToSendId);

            if (canalEspecifico) {
              await canalEspecifico.send(
                `🟣 **${twitchData.channel}** está em live agora! Assista em: ${twitchLink}\nhttps://tenor.com/view/twitch-live-stream-gamers-gif-16167909`
              );
              console.log(`Notificação enviada: ${twitchData.channel} is LIVE! (Guild: ${guildId})`);
            }
          } catch (err) {
            console.error("Erro ao enviar mensagem Discord:", err.message);
          }

        } else if (!currentlyLive && wasLive) {
          // TERMINOU A LIVE (ON -> OFF)
          await twitchRepository.updateByTwitchAndGuildId(twitchData.twitch, guildId, { isLive: false });
          console.log(`Live terminou: ${twitchData.channel} (Guild: ${guildId})`);

        } else if (currentlyLive && wasLive) {
          // JA ESTA EM LIVE E JA SABEMOS
          // Garante que o banco continua True (opcional, mas bom pra sanidade)
          // console.log(`[DEBUG] ${twitchData.channel} continua em live...`);
        }

      }
    }
  } catch (error) {
    console.error("Erro no loop do Twitch Notifier:", error);
  }

  // Intervalo de 5 minutos (300.000 ms)
  setTimeout(p, 5 * 60 * 1000);
};
