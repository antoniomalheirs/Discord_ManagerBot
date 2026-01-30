const { Events, EmbedBuilder, AuditLogEvent } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.UserUpdate,
    async execute(oldUser, newUser) {
        try {
            // Esse evento é global, dispara para qualquer usuário compartilhado com o bot.
            // Precisamos encontrar as guildas em comum que têm esse log ativado.
            const mutualGuilds = newUser.client.guilds.cache.filter(guild => guild.members.cache.has(newUser.id));
            const GuildRepo = new GuildsRepository(mongoose, "Guilds");

            for (const [id, guild] of mutualGuilds) {
                try {
                    const guildData = await GuildRepo.getOrCreate(guild.id);
                    if (!guildData || !guildData.logging || !guildData.logging.user_update) continue;

                    const config = guildData.logging.user_update;
                    if (!config.state || !config.channel) continue;

                    const logChannel = guild.channels.cache.get(config.channel);
                    if (!logChannel) continue;

                    // Detectar Mudanças
                    let changeType = null;
                    let oldVal = "";
                    let newVal = "";
                    let isImage = false;

                    // Avatar Mudou
                    if (oldUser.displayAvatarURL() !== newUser.displayAvatarURL()) {
                        changeType = "📸 Avatar Alterado";
                        oldVal = oldUser.displayAvatarURL({ size: 1024 });
                        newVal = newUser.displayAvatarURL({ size: 1024 });
                        isImage = true;
                    }
                    // Username Mudou
                    else if (oldUser.username !== newUser.username) {
                        changeType = "🏷️ Username Alterado";
                        oldVal = oldUser.username;
                        newVal = newUser.username;
                    }
                    // Discriminator Mudou (Raro hoje em dia, mas possível)
                    else if (oldUser.discriminator !== newUser.discriminator) {
                        changeType = "🆔 Tag Alterada";
                        oldVal = `#${oldUser.discriminator}`;
                        newVal = `#${newUser.discriminator}`;
                    }

                    if (!changeType) continue; // Nenhuma mudança relevante

                    const embed = new EmbedBuilder()
                        .setTitle(`👤 ${changeType}`)
                        .setAuthor({ name: newUser.tag, iconURL: newUser.displayAvatarURL() })
                        .setColor("#2b2d31")
                        .addFields(
                            { name: "Antes", value: isImage ? "[Link Imagem Antiga]" : oldVal, inline: true },
                            { name: "Depois", value: isImage ? "[Link Imagem Nova]" : newVal, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: `ID: ${newUser.id}` });

                    if (isImage) {
                        embed.setThumbnail(newVal);
                    }

                    await logChannel.send({ embeds: [embed] }).catch(() => { });

                } catch (e) {
                    // Erro ao processar guilda específica, ignora e vai pra próxima
                    continue;
                }
            }

        } catch (error) {
            console.error("Erro no logger UserUpdate:", error);
        }
    },
};
