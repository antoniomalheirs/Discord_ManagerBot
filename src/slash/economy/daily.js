const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const { COLORS, SEP, cooldownMsg, formatMoney, progressBar } = require("../../utils/EmbedStyle");

const DAY_MS = 86400000; // 24h
const GRACE_MS = 172800000; // 48h (Streak reset tolerance)
const BASE_REWARD = 500;
const STREAK_BONUS = 150; // Extra per day

module.exports = {
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const UserModel = mongoose.model("Users");
        let userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });

        if (!userData) {
            userData = new UserModel({
                username: interaction.user.username,
                codigouser: userId,
                idguild: guildId,
                money: 0
            });
        }

        const now = Date.now();
        const lastDaily = userData.lastDaily || 0;

        // Check Cooldown
        if (now - lastDaily < DAY_MS) {
            const nextDaily = lastDaily + DAY_MS;
            const embed = new EmbedBuilder()
                .setTitle("⏳ Cooldown Ativo")
                .setColor(COLORS.WARNING)
                .setDescription(`${SEP}\n${cooldownMsg(nextDaily)}\n\n🔥 **Streak Atual:** ${userData.dailyStreak || 0} Dias\n\`${progressBar(((userData.dailyStreak || 0) % 7) / 7)}\` (Bônus Semanal)`);
            return interaction.editReply({ embeds: [embed] });
        }

        // Check Streak Logic - Calculate before atomic update
        let streak = userData.dailyStreak || 0;

        // If more than 48h passed since last claim, streak dies.
        if (now - lastDaily > GRACE_MS && lastDaily !== 0) {
            streak = 0; // Reset F
        }
        streak += 1; // Increment for new claim

        const reward = BASE_REWARD + (streak * STREAK_BONUS);

        // Atomic update to prevent race condition
        const result = await UserModel.findOneAndUpdate(
            {
                codigouser: userId,
                idguild: guildId,
                $or: [
                    { lastDaily: { $exists: false } },
                    { lastDaily: { $lt: now - DAY_MS } }
                ]
            },
            {
                $inc: { money: reward },
                $set: { dailyStreak: streak, lastDaily: now },
                $setOnInsert: { username: interaction.user.username }
            },
            { new: true, upsert: true }
        );

        if (!result || result.lastDaily !== now) {
            // Already claimed today - race condition caught
            const embed = new EmbedBuilder()
                .setTitle("⏳ Cooldown Ativo")
                .setColor(COLORS.WARNING)
                .setDescription(`Você já pegou seu daily hoje.`);
            return interaction.editReply({ embeds: [embed] });
        }

        userData = result; // Use fresh data for weekly bonus check

        const embed = new EmbedBuilder()
            .setTitle("📅 Recompensa Diária")
            .setColor(COLORS.SUCCESS)
            .setDescription(`Você recebeu **${formatMoney(reward)}**!\n${SEP}`)
            .addFields(
                { name: "🔥 Streak Atual", value: `${streak} Dias`, inline: true },
                { name: "💰 Bônus de Streak", value: formatMoney(streak * STREAK_BONUS), inline: true },
                { name: "🎁 Bônus Semanal", value: `\`${progressBar((streak % 7) / 7)}\``, inline: false }
            )
            .setFooter({ text: "Volte amanhã para manter o combo!" })
            .setTimestamp();

        if (streak % 7 === 0 && streak > 0) {
            embed.setDescription(`Você recebeu **${formatMoney(reward)}**!\n🎁 **BÔNUS SEMANAL!** Ganhou +20 Energia.\n${SEP}`);
            userData.energy = Math.min((userData.energy || 0) + 20, 100); // Overcharge energy
            await userData.save();
        }

        return interaction.editReply({ embeds: [embed] });
    }
};
