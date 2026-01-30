const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(member.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.member_join) return;
            const config = guildData.logging.member_join;

            if (!config.state || !config.channel) return;

            const logChannel = member.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);

            const embed = new EmbedBuilder()
                .setTitle("📥 Membro Entrou")
                .setColor("#00FF00") // Verde
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: "Usuário", value: `${member} (\`${member.id}\`)`, inline: true },
                    { name: "Conta Criada", value: `há ${accountAge} dias`, inline: true },
                    { name: "Total Membros", value: `${member.guild.memberCount}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `ID: ${member.id}` });

            await logChannel.send({ embeds: [embed] }).catch(() => { });

        } catch (error) {
            console.error("Erro no logger MemberJoin:", error);
        }
    },
};
