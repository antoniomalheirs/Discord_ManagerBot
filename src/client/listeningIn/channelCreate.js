const { Events, EmbedBuilder, AuditLogEvent, ChannelType } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        if (!channel.guild) return;

        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(channel.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.channel_update) return;
            const config = guildData.logging.channel_update;

            if (!config.state || !config.channel) return;

            const logChannel = channel.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            let typeName = "Desconhecido";
            if (channel.type === ChannelType.GuildText) typeName = "Texto";
            if (channel.type === ChannelType.GuildVoice) typeName = "Voz";
            if (channel.type === ChannelType.GuildCategory) typeName = "Categoria";

            const embed = new EmbedBuilder()
                .setTitle("📺 Canal Criado")
                .setColor("#00FF00")
                .addFields(
                    { name: "Nome", value: `\`${channel.name}\``, inline: true },
                    { name: "Tipo", value: typeName, inline: true },
                    { name: "ID", value: `\`${channel.id}\``, inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => { });

        } catch (error) {
            console.error("Erro no logger ChannelCreate:", error);
        }
    },
};
