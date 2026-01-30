const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const YTBWARN = require("../utils/YTBWARN.js");
const PesquisaYTBVideo = require("./PesquisaYTBVideo.js");
const RegistradorYTBVideo = require("./RegistradorYTBVideo.js");
const VideosRepository = require("../database/mongoose/VideosRepository.js");
const VideoSchema = require("../database/schemas/VideoSchema.js");
const GuildsRepository = require("../database/mongoose/GuildsRepository.js");
const GuildSchema = require("../database/schemas/GuildSchema.js");
const discordBot = require("../Client");

if (!mongoose.models.Videos) mongoose.model("Videos", VideoSchema);
if (!mongoose.models.Guilds) mongoose.model("Guilds", GuildSchema);

const videoRepository = new VideosRepository(mongoose, "Videos");
const guildRepository = new GuildsRepository(mongoose, "Guilds");

module.exports = async function s() {
  try {
    // Busque todas as guildas com YOUTUBENOTIFY definido como true
    const guildasComNotify = await guildRepository.verifyYouTubeNotify();

    // Para cada guilda, execute a lógica principal
    for (const guilda of guildasComNotify) {
      const guildId = guilda.guildID;
      const channelsend = guilda.channelytb;

      if (!channelsend) continue;

      const allYoutubeAttributes = await videoRepository.getChannelsWithVideosByGuildId(guildId);

      // allYoutubeAttributes = [{ youtube: 'ID', lastVideo: 'Title || URL' }]

      for (const channelData of allYoutubeAttributes) {

        try {
          // Busca o último vídeo 'na vida real' via API do YouTube
          const latestVideoData = await YTBWARN.bind(this)(channelData.youtube);

          if (latestVideoData && latestVideoData.lastVideo) {

            // Verifica se esse vídeo já é o que temos salvo no banco (PesquisaYTBVideo retorna true se JÁ EXISTE IGUAL)
            // Mas cuidado: PesquisaYTBVideo parece que verifica se existe no banco. Se existir, retorna true.
            // Precisamos garantir que estamos comparando com o que temos.

            // Vamos simular o objeto que PesquisaYTBVideo espera
            latestVideoData.notifyGuild = guildId;

            const isAlreadyRegistered = await PesquisaYTBVideo.bind(this)(latestVideoData);

            if (!isAlreadyRegistered) {
              // NOVO VÍDEO DETECTADO! (Não estava no banco)

              // 1. Atualiza o banco com o novo vídeo
              await RegistradorYTBVideo.bind(this)(latestVideoData);

              // 2. Notifica o Discord
              const [titulo, link] = latestVideoData.lastVideo.split(" || ");

              const embed = new EmbedBuilder()
                .setTitle(`🎥 Novo vídeo de ${latestVideoData.channel}!`)
                .setDescription(`**${titulo}**\n\n[Assista agora!](${link})`)
                .setImage(latestVideoData.message || null)
                .setColor("#FF0000")
                .setTimestamp(new Date(latestVideoData.lastPublish)); // Usa data real se disponivel

              const canalEspecifico = await discordBot.channels.fetch(channelsend);

              if (canalEspecifico) {
                await canalEspecifico.send({ content: `📢 **${latestVideoData.channel}** postou vídeo novo! ${link}`, embeds: [embed] });
                console.log(`Notificação YouTube enviada: ${titulo}`);
              }
            }
          }
        } catch (error) {
          console.error(`Erro ao verificar canal ${channelData.youtube}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error("Erro no loop do YouTube Notifier:", error);
  }

  // Intervalo de 5 minutos (300.000 ms)
  setTimeout(() => s.call(discordBot), 5 * 60 * 1000);
};
