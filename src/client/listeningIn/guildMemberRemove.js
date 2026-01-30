const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(member.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.member_leave) return;
            const config = guildData.logging.member_leave;

            if (!config.state || !config.channel) return;

            const logChannel = member.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            // Verificar Roles que tinha
            const roles = member.roles.cache
                .filter(r => r.name !== "@everyone")
                .map(r => r.name)
                .join(", ") || "Nenhum";

            const embed = new EmbedBuilder()
                .setTitle("📤 Membro Saiu")
                .setColor("#FF0000") // Vermelho
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: "Usuário", value: `${member.user.tag} (\`${member.id}\`)`, inline: true },
                    { name: "Cargos", value: roles.substring(0, 1024) },
                    { name: "Total Membros", value: `${member.guild.memberCount}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `ID: ${member.id}` });

            await logChannel.send({ embeds: [embed] }).catch(() => { });

        } catch (error) {
            console.error("Erro no logger MemberLeave:", error);
        }
    },
};
