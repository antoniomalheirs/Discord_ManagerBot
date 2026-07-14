const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const UsersRepository = require("../../database/mongoose/UsersRepository");
const { COLORS, SEP, formatMoney } = require("../../utils/EmbedStyle");

module.exports = {
    async execute(interaction) {
        try {
            let sub = interaction.options.getSubcommand(false);
            if (!sub) sub = "xp";

            const guildId = interaction.guildId;
            const userRepo = new UsersRepository(mongoose, "Users");
            const allUsers = await userRepo.findAllByGuildId(guildId);

            if (!allUsers || allUsers.length === 0) {
                return interaction.editReply("❌ Ninguém falou nada neste servidor ainda!");
            }

            let sortedUsers = [];
            let embedConfig = {};

            if (sub === "money") {
                sortedUsers = allUsers
                    .map(u => ({ ...u, totalMoney: (u.money || 0) + (u.bank || 0) }))
                    .filter(u => u.totalMoney > 0)
                    .sort((a, b) => b.totalMoney - a.totalMoney)
                    .slice(0, 10);

                embedConfig = {
                    title: `💰 Top 10 Bilionários - ${interaction.guild.name}`,
                    desc: `Os reis da economia (carteira + banco).\n${SEP}`,
                    color: COLORS.ECONOMY,
                    format: (u) => `**${formatMoney(u.totalMoney)}**\n└ 💵 ${formatMoney(u.money || 0)}  |  🏦 ${formatMoney(u.bank || 0)}`
                };
            } else {
                sortedUsers = allUsers.map(user => {
                    const msgs = user.totalMessages || 0;
                    const voice = user.voiceTime || 0;
                    const xp = (msgs * 10) + (voice * 20);
                    const level = Math.floor(Math.sqrt(xp / 100));
                    return { ...user, xp, level };
                })
                    .sort((a, b) => b.xp - a.xp)
                    .slice(0, 10);

                embedConfig = {
                    title: `🏆 Ranking Global (XP) - ${interaction.guild.name}`,
                    desc: `Os membros mais ativos do servidor.\n${SEP}`,
                    color: COLORS.RANK,
                    format: (u) => {
                        let xpDisplay = u.xp;
                        if (u.xp >= 1000) xpDisplay = (u.xp / 1000).toFixed(1) + "k";
                        return `**Lvl ${u.level}**\n└ ${xpDisplay} XP Totais`;
                    }
                };
            }

            const embed = new EmbedBuilder()
                .setTitle(embedConfig.title)
                .setColor(embedConfig.color)
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setDescription(embedConfig.desc);

            let description = embedConfig.desc + "\n";
            const medals = ["🥇", "🥈", "🥉"];

            if (sortedUsers.length === 0) {
                description += "Ninguém pontuou nessa categoria ainda.";
            } else {
                for (let i = 0; i < sortedUsers.length; i++) {
                    const u = sortedUsers[i];
                    const medal = i < 3 ? medals[i] : `**#${i + 1}**`;
                    description += `${medal} <@${u.codigouser}>\n${embedConfig.format(u)}\n\n`;
                }
            }

            embed.setDescription(description);
            embed.setFooter({ text: "Use /economy rank para ver seu perfil detalhado.", iconURL: interaction.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Erro no leaderboard:", error);
            await interaction.editReply("❌ Ocorreu um erro ao gerar o leaderboard.");
        }
    }
};
