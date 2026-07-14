const mongoose = require("mongoose");
const JOBS = require("../../utils/jobs");
const { COLORS, SEP, cooldownMsg, formatMoney, getWorkScenario } = require("../../utils/EmbedStyle");
const { EmbedBuilder } = require("discord.js");
const WORK_COOLDOWN = 3600000; // 1h

module.exports = {
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const now = Date.now();

        const UserModel = mongoose.model("Users");

        // First, fetch user to get their job for multiplier calculation
        const existingUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });

        // Calculate reward with job bonus
        let baseReward = Math.floor(Math.random() * 200) + 100;
        let multiplier = 1.0;
        let jobBonus = "";

        if (existingUser?.job && JOBS[existingUser.job]?.bonus?.workMultiplier) {
            multiplier = JOBS[existingUser.job].bonus.workMultiplier;
            jobBonus = `\n💼 **Bônus (${existingUser.job}):** +${Math.round((multiplier - 1) * 100)}%`;
        }

        // Mafioso bonus: allStats 1.5x
        if (existingUser?.job && JOBS[existingUser.job]?.bonus?.allStats) {
            multiplier *= JOBS[existingUser.job].bonus.allStats;
            jobBonus += `\n🎩 **Bônus (Mafioso):** x${JOBS[existingUser.job].bonus.allStats}`;
        }

        const reward = Math.floor(baseReward * multiplier);

        // Atomic update to prevent race condition
        const result = await UserModel.findOneAndUpdate(
            {
                codigouser: userId,
                idguild: guildId,
                $or: [
                    { lastWork: { $exists: false } },
                    { lastWork: { $lt: now - WORK_COOLDOWN } }
                ]
            },
            {
                $inc: { money: reward },
                $set: { lastWork: now },
                $setOnInsert: { username: interaction.user.username }
            },
            { new: true, upsert: true }
        );

        if (!result || result.lastWork !== now) {
            // Cooldown still active - fetch to get remaining time
            const userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });
            const lastWork = userData?.lastWork || 0;
            const nextWork = lastWork + WORK_COOLDOWN;
            
            const embed = new EmbedBuilder()
                .setTitle("⏳ Cansado demais")
                .setColor(COLORS.WARNING)
                .setDescription(`Você precisa descansar um pouco.\n\n${cooldownMsg(nextWork)}`);
                
            return interaction.editReply({ embeds: [embed] });
        }

        const scenario = getWorkScenario(existingUser?.job || "Desempregado");

        const embed = new EmbedBuilder()
            .setTitle("Trabalho Concluído!")
            .setColor(COLORS.ECONOMY)
            .setDescription(`${SEP}\n${scenario.emoji} **Cenário:** ${scenario.text}!\n${SEP}`)
            .addFields(
                { name: "💰 Ganhos", value: formatMoney(reward) + jobBonus, inline: true },
                { name: "💵 Saldo Atual", value: formatMoney(result.money), inline: true }
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};
