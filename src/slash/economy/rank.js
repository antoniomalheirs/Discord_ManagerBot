const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const UsersRepository = require("../../database/mongoose/UsersRepository");
const BACKGROUNDS = require("../../utils/backgrounds");

module.exports = {
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const guildId = interaction.guildId;
            const userRepo = new UsersRepository(mongoose, "Users");

            // --- DADOS DO USUÁRIO ---
            let userData = await userRepo.getByUserIdAndGuildId(targetUser.id, guildId);
            if (!userData) userData = { totalMessages: 0, voiceTime: 0 };

            const msgs = userData.totalMessages || 0;
            const voice = userData.voiceTime || 0;
            const currentXp = (msgs * 10) + (voice * 20);

            // Nível calc
            const level = Math.floor(Math.sqrt(currentXp / 100));
            const nextLevel = level + 1;
            const xpForNextLevel = (nextLevel * nextLevel) * 100;
            const xpForCurrentLevel = (level * level) * 100;
            const xpNeeded = xpForNextLevel - xpForCurrentLevel;
            const xpProgress = currentXp - xpForCurrentLevel;
            const percent = xpNeeded > 0 ? Math.min(Math.max(xpProgress / xpNeeded, 0), 1) : 1;

            // Posição no Rank
            const userModel = mongoose.model("Users");
            const rankPos = await userModel.countDocuments({
                idguild: guildId,
                $expr: {
                    $gt: [
                        { $add: [{ $multiply: ["$totalMessages", 10] }, { $multiply: ["$voiceTime", 20] }] },
                        currentXp
                    ]
                }
            }) + 1;

            // --- Formatar números ---
            const formatNum = (num) => {
                if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
                if (num >= 1000) return (num / 1000).toFixed(1) + "k";
                return String(num);
            };

            // --- Barra de Progresso Unicode ---
            const barLength = 20;
            const filled = Math.round(percent * barLength);
            const empty = barLength - filled;
            const progressBar = "▓".repeat(filled) + "░".repeat(empty);
            const percentText = `${Math.floor(percent * 100)}%`;

            // --- Money ---
            const money = userData.money || 0;
            const bank = userData.bank || 0;
            const totalMoney = money + bank;

            // --- Background Info ---
            const bgKey = userData.background || "default";
            const bgConfig = BACKGROUNDS[bgKey] || BACKGROUNDS["default"];

            // --- Título com rank visual ---
            const rankMedals = ["🥇", "🥈", "🥉"];
            const rankIcon = rankPos <= 3 ? rankMedals[rankPos - 1] : "🏆";

            // --- Embed Premium ---
            const embed = new EmbedBuilder()
                .setColor("#00FFFF")
                .setAuthor({
                    name: `${targetUser.username}`,
                    iconURL: targetUser.displayAvatarURL({ extension: "png", size: 128, forceStatic: true }),
                })
                .setThumbnail(targetUser.displayAvatarURL({ extension: "png", size: 512, forceStatic: true }))
                .setTitle(`${rankIcon} Rank Card`)
                .addFields(
                    {
                        name: "📊 Status",
                        value: [
                            `> **Rank:** \`#${rankPos}\`  •  **Level:** \`${level}\``,
                            `> **XP:** \`${formatNum(Math.floor(currentXp))} / ${formatNum(xpForNextLevel)}\``,
                        ].join("\n"),
                        inline: false,
                    },
                    {
                        name: `⚡ Progresso — ${percentText}`,
                        value: `\`${progressBar}\``,
                        inline: false,
                    },
                    {
                        name: "💰 Finanças",
                        value: [
                            `> **Total:** \`$${totalMoney.toLocaleString()}\``,
                            `> 💵 Carteira: \`$${money.toLocaleString()}\`  •  🏦 Banco: \`$${bank.toLocaleString()}\``,
                        ].join("\n"),
                        inline: false,
                    },
                    {
                        name: "📈 Atividade",
                        value: [
                            `> 💬 Mensagens: \`${msgs.toLocaleString()}\``,
                            `> 🎙️ Tempo em Voz: \`${voice.toLocaleString()} min\``,
                        ].join("\n"),
                        inline: false,
                    },
                    {
                        name: "🎨 Background",
                        value: `> ${bgConfig.name}`,
                        inline: true,
                    }
                )
                .setFooter({
                    text: `Próximo nível: ${nextLevel} • ${formatNum(xpNeeded - xpProgress)} XP restantes`,
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("Erro no comando rank:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro ao gerar seu rank." });
        }
    },
};
