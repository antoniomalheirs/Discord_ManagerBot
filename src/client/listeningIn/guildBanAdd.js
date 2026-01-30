const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban) {
        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(ban.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.member_ban) return;
            const config = guildData.logging.member_ban;

            if (!config.state || !config.channel) return;

            const logChannel = ban.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle("🔨 Usuário Banido")
                .setColor("#8B0000") // Dark Red
                .addFields(
                    { name: "Usuário", value: `${ban.user.tag}`, inline: true },
                    { name: "ID", value: `\`${ban.user.id}\``, inline: true },
                    { name: "Motivo", value: ban.reason || "Não especificado" }
                )
                .setThumbnail(ban.user.displayAvatarURL())
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => { });

        } catch (error) {
            console.error("Erro no logger BanAdd:", error);
        }
    },
};
