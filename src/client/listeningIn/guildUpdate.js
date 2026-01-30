const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.GuildUpdate,
    async execute(oldGuild, newGuild) {
        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(newGuild.id);

            if (!guildData || !guildData.logging || !guildData.logging.server_update) return;
            const config = guildData.logging.server_update;

            if (!config.state || !config.channel) return;

            const logChannel = newGuild.channels.cache.get(config.channel);
            if (!logChannel) return;

            // Mudança de Nome
            if (oldGuild.name !== newGuild.name) {
                const embed = new EmbedBuilder()
                    .setTitle("👑 Servidor Atualizado")
                    .setColor("#FFD700")
                    .addFields(
                        { name: "Nome Antigo", value: `\`${oldGuild.name}\``, inline: true },
                        { name: "Nome Novo", value: `\`${newGuild.name}\``, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] }).catch(() => { });
            }

            // Mudança de Icone
            if (oldGuild.iconURL() !== newGuild.iconURL()) {
                const embed = new EmbedBuilder()
                    .setTitle("👑 Ícone do Servidor Atualizado")
                    .setColor("#FFD700")
                    .setThumbnail(newGuild.iconURL())
                    .setTimestamp();
                await logChannel.send({ embeds: [embed] }).catch(() => { });
            }

        } catch (error) {
            console.error("Erro no logger GuildUpdate:", error);
        }
    },
};
