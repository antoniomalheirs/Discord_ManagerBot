const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");

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
            const diff = nextDaily - now;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            return interaction.editReply(`⏳ **Calma lá!** Você já pegou seu daily hoje.\nVolte em **${hours}h ${minutes}m**.`);
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
            return interaction.editReply(`⏳ **Calma lá!** Você já pegou seu daily hoje.`);
        }

        userData = result; // Use fresh data for weekly bonus check

        const embed = new EmbedBuilder()
            .setTitle("📅 Recompensa Diária")
            .setColor("#00FF00")
            .setDescription(`Você recebeu **$${reward.toLocaleString()}**!`)
            .addFields(
                { name: "🔥 Streak Atual", value: `${streak} Dias`, inline: true },
                { name: "💰 Bônus de Streak", value: `$${streak * STREAK_BONUS}`, inline: true }
            )
            .setFooter({ text: "Volte amanhã para manter o combo!" });

        if (streak % 7 === 0 && streak > 0) {
            embed.setDescription(`Você recebeu **$${reward.toLocaleString()}**!\n🎁 **BÔNUS SEMANAL!** Ganhou +20 Energia.`);
            userData.energy = Math.min((userData.energy || 0) + 20, 100); // Overcharge energy
            await userData.save();
        }

        return interaction.editReply({ embeds: [embed] });
    }
};
