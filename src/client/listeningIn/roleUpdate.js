const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole) {
        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(newRole.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.role_update) return;
            const config = guildData.logging.role_update;

            if (!config.state || !config.channel) return;

            const logChannel = newRole.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            // Mudança de Nome
            if (oldRole.name !== newRole.name) {
                const embed = new EmbedBuilder()
                    .setTitle("🛡️ Cargo Editado")
                    .setColor(newRole.hexColor)
                    .addFields(
                        { name: "Cargo", value: `${newRole}`, inline: false },
                        { name: "Nome Antigo", value: `\`${oldRole.name}\``, inline: true },
                        { name: "Nome Novo", value: `\`${newRole.name}\``, inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [embed] }).catch(() => { });
            }

        } catch (error) {
            console.error("Erro no logger RoleUpdate:", error);
        }
    },
};
