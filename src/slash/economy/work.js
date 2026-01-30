const mongoose = require("mongoose");
const JOBS = require("../../utils/jobs");
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
            jobBonus = ` (${existingUser.job}: +${Math.round((multiplier - 1) * 100)}%)`;
        }

        // Mafioso bonus: allStats 1.5x
        if (existingUser?.job && JOBS[existingUser.job]?.bonus?.allStats) {
            multiplier *= JOBS[existingUser.job].bonus.allStats;
            jobBonus = ` (Mafioso: x${JOBS[existingUser.job].bonus.allStats})`;
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
            const waitMin = Math.ceil((lastWork + WORK_COOLDOWN - now) / 60000);
            return interaction.editReply(`🔨 Você está cansado! Volte em **${waitMin} minutos**.`);
        }

        return interaction.editReply(`🔨 Você trabalhou duro e ganhou **$${reward}**${jobBonus}.`);
    }
};
