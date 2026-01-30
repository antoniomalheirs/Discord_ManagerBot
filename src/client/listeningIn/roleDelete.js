const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role) {
        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(role.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.role_update) return;
            const config = guildData.logging.role_update;

            if (!config.state || !config.channel) return;

            const logChannel = role.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle("🛡️ Cargo Deletado")
                .setColor("#FF0000")
                .addFields(
                    { name: "Nome", value: `\`${role.name}\``, inline: true },
                    { name: "ID", value: `\`${role.id}\``, inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => { });

        } catch (error) {
            console.error("Erro no logger RoleDelete:", error);
        }
    },
};
