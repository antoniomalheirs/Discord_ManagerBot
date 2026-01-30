const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const JOBS = require("../../utils/jobs");

module.exports = {
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const UserModel = mongoose.model("Users");
        let userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });

        if (!userData) return interaction.editReply("❌ Você não tem registro. Use `/casino welcome`.");

        // Calc Level
        const msgs = userData.totalMessages || 0;
        const voice = userData.voiceTime || 0;
        const xp = (msgs * 10) + (voice * 20);
        const level = Math.floor(Math.sqrt(xp / 100));

        if (subcommand === "info") {
            const embed = new EmbedBuilder()
                .setTitle("👔 Mercado de Trabalho")
                .setColor("#3498DB")
                .setDescription(`Seu Nível Atual: **${level}**\n\n**Profissões Disponíveis:**`);

            for (const [jobName, jobData] of Object.entries(JOBS)) {
                const status = level >= jobData.minLevel ? "✅ Desbloqueado" : `🔒 Requer Lvl ${jobData.minLevel}`;
                embed.addFields({
                    name: `${jobName} (${status})`,
                    value: `${jobData.description}`,
                    inline: false
                });
            }

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === "claim") {
            // Sort jobs by minLevel descending to find the BEST available job
            const sortedJobs = Object.entries(JOBS).sort((a, b) => b[1].minLevel - a[1].minLevel);

            let bestJob = "Desempregado";
            for (const [jobName, jobData] of sortedJobs) {
                if (level >= jobData.minLevel) {
                    bestJob = jobName;
                    break;  // Found the best one!
                }
            }

            if (bestJob === userData.job) {
                return interaction.editReply(`😐 Você já está no topo da sua carreira possível (**${userData.job || "Desempregado"}**). Upe mais nível!`);
            }

            userData.job = bestJob;
            await userData.save();

            return interaction.editReply(`🎉 **PROMOÇÃO!**\nAgora você trabalha como **${bestJob}**!\nConfira seus novos benefícios em \`/economy job info\`.`);
        }
    }
};
