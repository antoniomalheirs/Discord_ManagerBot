const { AttachmentBuilder } = require("discord.js");
const Canvas = require("canvas");
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
            // Evitar divisão por zero e garantir 0-1
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

            // --- DESENHO NO CANVAS (Customizado) ---
            const width = 700;
            const height = 180;
            const canvas = Canvas.createCanvas(width, height);
            const ctx = canvas.getContext("2d");

            // Função para formatar números (1k, 1M)
            const formatNum = (num) => {
                if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
                if (num >= 1000) return (num / 1000).toFixed(1) + "k";
                return num;
            };

            // 1. Fundo com Bordas Arredondadas
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(0, 0, width, height, 25);
            ctx.clip();

            const bgKey = userData.background || "default";
            const bgConfig = BACKGROUNDS[bgKey] || BACKGROUNDS["default"];
            let bgDrawn = false;

            if (bgConfig.url !== "default") {
                try {
                    const bgImage = await Canvas.loadImage(bgConfig.url);
                    ctx.drawImage(bgImage, 0, 0, width, height);

                    // Overlay escuro para garantir leitura do texto
                    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                    ctx.fillRect(0, 0, width, height);
                    bgDrawn = true;
                } catch (e) {
                    console.error("Erro ao carregar background customizado:", e);
                }
            }

            if (!bgDrawn) {
                // Gradiente de Fundo (Mais vibrante) - FALLBACK
                const gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, "#090909"); // Preto Profundo
                gradient.addColorStop(0.5, "#150a25"); // Roxo Médio
                gradient.addColorStop(1, "#2b1045"); // Roxo Galaxy Vibrante
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);

                // Background pattern (Pontos/Estrelas sutis)
                ctx.fillStyle = "#ffffff";
                for (let i = 0; i < 30; i++) {
                    const x = Math.random() * width;
                    const y = Math.random() * height;
                    const size = Math.random() * 2;
                    ctx.globalAlpha = Math.random() * 0.3;
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1.0;

                // Glow sutil no topo-esquerda e baixo-direita
                const glow1 = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
                glow1.addColorStop(0, "rgba(0, 255, 255, 0.1)"); // Ciano
                glow1.addColorStop(1, "transparent");
                ctx.fillStyle = glow1;
                ctx.fillRect(0, 0, width, height);
            }

            ctx.restore(); // Fim do clip

            // 2. Avatar
            const avatarX = 35;
            const avatarY = 30;
            const avatarSize = 120; // 120px

            // Sombra Neon Avatar
            ctx.save();
            ctx.shadowColor = "#00FFFF";
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = "#000";
            ctx.fill();
            ctx.restore();

            // Clip Avatar + Imagem
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.clip();
            try {
                const avatarURL = targetUser.displayAvatarURL({ extension: "png", size: 256, forceStatic: true });
                const avatar = await Canvas.loadImage(avatarURL);
                ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            } catch (e) {
                ctx.fillStyle = "#333";
                ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
            }
            ctx.restore();

            // Borda do Avatar (Ciano)
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#00FFFF";
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.stroke();

            // 3. Informações (Layout Otimizado)

            // Username
            ctx.fillStyle = "#FFFFFF";
            ctx.shadowColor = "#000000";
            ctx.shadowBlur = 4;
            ctx.font = "bold 34px sans-serif";

            let displayName = targetUser.username;
            // Truncar nome longo
            if (displayName.length > 15) displayName = displayName.substring(0, 14) + "...";

            ctx.fillText(displayName, 190, 75);
            ctx.shadowBlur = 0; // Reset shadow

            // Tag/Discriminator (Menor, cinza)
            if (targetUser.discriminator !== '0') {
                ctx.font = "20px sans-serif";
                ctx.fillStyle = "#AAAAAA";
                ctx.fillText(`#${targetUser.discriminator}`, 190 + ctx.measureText(displayName).width + 10, 75);
            }

            // LEVEL e RANK (Alinhados à direita, mas mais espaçados)
            const rightMargin = 660; // Margem direita

            // RANK
            ctx.textAlign = "right";
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 44px sans-serif";
            ctx.fillText(`#${rankPos}`, rightMargin, 75);

            ctx.font = "bold 18px sans-serif";
            ctx.fillStyle = "#AAAAAA"; // Label
            ctx.fillText("RANK", rightMargin, 40);

            // LEVEL (Um pouco a esquerda do Rank)
            const levelX = rightMargin - 120;

            ctx.fillStyle = "#00FFFF"; // Ciano
            ctx.font = "bold 44px sans-serif";
            ctx.fillText(`${level}`, levelX, 75);

            ctx.font = "bold 18px sans-serif";
            ctx.fillStyle = "#00FFFF"; // Label (combinando)
            ctx.fillText("LEVEL", levelX, 40);

            // MONEY (Saldo) - Abaixo do Name/Tag - SOMA CARTEIRA + BANCO
            const money = userData.money || 0;
            const bank = userData.bank || 0;
            const totalMoney = money + bank;

            ctx.font = "bold 24px sans-serif";
            ctx.fillStyle = "#00FF00"; // Green Money
            ctx.textAlign = "left";
            ctx.fillText(`💰 $${totalMoney.toLocaleString()} (💵${money.toLocaleString()} + 🏦${bank.toLocaleString()})`, 190, 105);

            // 4. Barra de Progresso (Reposicionada para baixo)
            const barX = 190;
            const barY = 120;
            const barW = 470;
            const barH = 18;
            const radius = 9;

            // Fundo da barra
            ctx.fillStyle = "#333333";
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, radius);
            ctx.fill();

            // Preenchimento
            const fillW = Math.max(barW * percent, 20);

            // Gradiente na barra
            const barGradient = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
            barGradient.addColorStop(0, "#00FFFF"); // Ciano
            barGradient.addColorStop(1, "#0099FF"); // Azul

            ctx.fillStyle = barGradient;
            ctx.shadowColor = "#00FFFF";
            ctx.shadowBlur = 15; // Glow intenso na barra

            ctx.beginPath();
            ctx.roundRect(barX, barY, fillW, barH, radius);
            ctx.fill();
            ctx.shadowBlur = 0;

            // XP Counters (Abaixo da barra, direita)
            ctx.textAlign = "right";
            ctx.font = "bold 16px sans-serif";
            ctx.fillStyle = "#DDDDDD";
            ctx.fillText(`${formatNum(Math.floor(currentXp))} / ${formatNum(xpForNextLevel)} XP`, rightMargin, barY + 35);

            // Porcentagem (Esquerda, abaixo da barra)
            ctx.textAlign = "left";
            ctx.fillStyle = "#AAAAAA";
            ctx.fillText(`${Math.floor(percent * 100)}%`, barX, barY + 35);

            // Finalizar e Enviar
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: "rank.png" });
            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error("Erro no comando rank:", error);
            await interaction.editReply({ content: "❌ Ocorreu um erro ao gerar seu rank (Canvas Custom)." });
        }
    },
};
