const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.InviteDelete,
    async execute(invite) {
        if (!invite.guild) return;

        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(invite.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.invite_update) return;
            const config = guildData.logging.invite_update;

            if (!config.state || !config.channel) return;

            const logChannel = invite.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle("📨 Convite Deletado/Expirado")
                .setColor("#FF0000")
                .addFields(
                    { name: "Código", value: `\`${invite.code}\``, inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => { });

        } catch (error) {
            console.error("Erro no logger InviteDelete:", error);
        }
    },
};
