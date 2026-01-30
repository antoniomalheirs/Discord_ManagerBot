const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        if (!newChannel.guild) return;

        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(newChannel.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.channel_update) return;
            const config = guildData.logging.channel_update;

            if (!config.state || !config.channel) return;

            const logChannel = newChannel.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            // Detectar mudanças simples (Nome)
            if (oldChannel.name !== newChannel.name) {
                const embed = new EmbedBuilder()
                    .setTitle("📺 Canal Editado")
                    .setColor("#FFFF00")
                    .setDescription(`Canal: ${newChannel}`)
                    .addFields(
                        { name: "Nome Antigo", value: `\`${oldChannel.name}\``, inline: true },
                        { name: "Nome Novo", value: `\`${newChannel.name}\``, inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] }).catch(() => { });
            }

        } catch (error) {
            console.error("Erro no logger ChannelUpdate:", error);
        }
    },
};
