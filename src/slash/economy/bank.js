const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const JOBS = require("../../utils/jobs");

// Rate limiting map (userId -> lastOperationTimestamp)
const bankCooldowns = new Map();
const BANK_COOLDOWN_MS = 3000; // 3 seconds between operations
const DAY_MS = 86400000; // 24 hours
const BASE_INTEREST_RATE = 0.005; // 0.5% per day base

module.exports = {
    async execute(interaction) {
        // Rate limit check
        const now = Date.now();
        const lastOp = bankCooldowns.get(interaction.user.id) || 0;
        if (now - lastOp < BANK_COOLDOWN_MS) {
            const waitSec = Math.ceil((BANK_COOLDOWN_MS - (now - lastOp)) / 1000);
            return interaction.editReply({ content: `⏳ Aguarde ${waitSec}s antes de outra operação bancária.` });
        }
        bankCooldowns.set(interaction.user.id, now);

        // Subcommand handled inside since logic is shared/dependent on same userData
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const UserModel = mongoose.model("Users");
        let userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });

        if (!userData) {
            userData = new UserModel({
                username: interaction.user.username,
                codigouser: userId,
                idguild: guildId,
                money: 0,
                bank: 0,
                energy: 50,
                lastInterestClaim: now
            });
        }

        // Calculate and apply daily interest
        const lastInterest = userData.lastInterestClaim || 0;
        const daysPassed = Math.floor((now - lastInterest) / DAY_MS);
        let interestEarned = 0;

        if (daysPassed > 0 && (userData.bank || 0) > 0) {
            // Calculate interest rate (Banqueiro job = 2x interest)
            let rate = BASE_INTEREST_RATE;
            if (userData.job && JOBS[userData.job]?.bonus?.bankInterest) {
                rate *= JOBS[userData.job].bonus.bankInterest;
            }

            // Compound interest for days passed (capped at 7 days)
            const cappedDays = Math.min(daysPassed, 7);
            interestEarned = Math.floor(userData.bank * rate * cappedDays);

            if (interestEarned > 0) {
                userData.bank += interestEarned;
                userData.lastInterestClaim = now;
                await userData.save();
            }
        }

        const money = userData.money || 0;
        const bank = userData.bank || 0;

        // --- BALANCE ---
        if (subcommand === "balance") {
            const interestRate = userData.job && JOBS[userData.job]?.bonus?.bankInterest
                ? BASE_INTEREST_RATE * JOBS[userData.job].bonus.bankInterest * 100
                : BASE_INTEREST_RATE * 100;

            const embed = new EmbedBuilder()
                .setTitle(`🏦 Banco Central de ${interaction.guild.name}`)
                .setColor("#DAA520") // GoldenRod
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: "💵 Carteira", value: `$${money.toLocaleString()}`, inline: true },
                    { name: "🏦 Banco", value: `$${bank.toLocaleString()}`, inline: true },
                    { name: "💰 Patrimônio Total", value: `$${(money + bank).toLocaleString()}`, inline: false },
                    { name: "📈 Taxa de Juros", value: `${interestRate.toFixed(1)}% ao dia${userData.job === "Banqueiro" ? " (Banqueiro 2x!)" : ""}`, inline: true }
                )
                .setFooter({ text: "Use os botões abaixo para ações rápidas!" });

            if (interestEarned > 0) {
                embed.setDescription(`💵 **+$${interestEarned.toLocaleString()}** de juros coletados! (${daysPassed} dia${daysPassed > 1 ? 's' : ''})`);
            }

            // Action Buttons
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("bal_deposit").setLabel("📥 Depositar Tudo").setStyle(ButtonStyle.Success).setDisabled(money <= 0),
                new ButtonBuilder().setCustomId("bal_withdraw").setLabel("📤 Sacar Tudo").setStyle(ButtonStyle.Primary).setDisabled(bank <= 0),
                new ButtonBuilder().setCustomId("bal_daily").setLabel("🎁 Daily").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("bal_work").setLabel("🔨 Work").setStyle(ButtonStyle.Secondary)
            );

            const response = await interaction.editReply({ embeds: [embed], components: [row1] });

            // Collector for button interactions
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000,
                filter: i => i.user.id === userId
            });

            collector.on('collect', async i => {
                try {
                    // Re-fetch user data for fresh state
                    const freshUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });
                    if (!freshUser) return i.reply({ content: "❌ Erro ao buscar dados.", ephemeral: true });

                    if (i.customId === "bal_deposit") {
                        if ((freshUser.money || 0) <= 0) {
                            return i.reply({ content: "❌ Carteira vazia!", ephemeral: true });
                        }
                        const depositAmount = freshUser.money;
                        freshUser.bank += depositAmount;
                        freshUser.money = 0;
                        await freshUser.save();
                        await i.reply({ content: `📥 **Depósito Realizado!** $${depositAmount.toLocaleString()} guardado no banco.`, ephemeral: true });
                    }

                    if (i.customId === "bal_withdraw") {
                        if ((freshUser.bank || 0) <= 0) {
                            return i.reply({ content: "❌ Banco vazio!", ephemeral: true });
                        }
                        const withdrawAmount = freshUser.bank;
                        freshUser.money += withdrawAmount;
                        freshUser.bank = 0;
                        await freshUser.save();
                        await i.reply({ content: `📤 **Saque Realizado!** $${withdrawAmount.toLocaleString()} sacado para carteira.`, ephemeral: true });
                    }

                    if (i.customId === "bal_daily") {
                        const DAILY_COOLDOWN = 86400000;
                        const lastDaily = freshUser.lastDaily || 0;
                        if (now - lastDaily < DAILY_COOLDOWN) {
                            const waitHr = Math.ceil((lastDaily + DAILY_COOLDOWN - now) / 3600000);
                            return i.reply({ content: `⏰ Volte em **${waitHr}h** para o próximo daily!`, ephemeral: true });
                        }
                        const dailyReward = Math.floor(Math.random() * 300) + 200;
                        freshUser.money += dailyReward;
                        freshUser.lastDaily = now;
                        freshUser.dailyStreak = (freshUser.dailyStreak || 0) + 1;
                        await freshUser.save();
                        await i.reply({ content: `🎁 **Daily coletado!** +$${dailyReward} (Streak: ${freshUser.dailyStreak} dias)`, ephemeral: true });
                    }

                    if (i.customId === "bal_work") {
                        const WORK_COOLDOWN = 3600000;
                        const lastWork = freshUser.lastWork || 0;
                        if (now - lastWork < WORK_COOLDOWN) {
                            const waitMin = Math.ceil((lastWork + WORK_COOLDOWN - now) / 60000);
                            return i.reply({ content: `🔨 Cansado! Volte em **${waitMin} min**.`, ephemeral: true });
                        }
                        let workReward = Math.floor(Math.random() * 200) + 100;
                        if (freshUser.job && JOBS[freshUser.job]?.bonus?.workMultiplier) {
                            workReward = Math.floor(workReward * JOBS[freshUser.job].bonus.workMultiplier);
                        }
                        freshUser.money += workReward;
                        freshUser.lastWork = now;
                        await freshUser.save();
                        await i.reply({ content: `🔨 **Trabalho concluído!** +$${workReward}`, ephemeral: true });
                    }

                    // Update the embed with new values
                    const updatedUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });
                    const newEmbed = EmbedBuilder.from(embed)
                        .setFields(
                            { name: "💵 Carteira", value: `$${(updatedUser.money || 0).toLocaleString()}`, inline: true },
                            { name: "🏦 Banco", value: `$${(updatedUser.bank || 0).toLocaleString()}`, inline: true },
                            { name: "💰 Patrimônio Total", value: `$${((updatedUser.money || 0) + (updatedUser.bank || 0)).toLocaleString()}`, inline: false },
                            { name: "📈 Taxa de Juros", value: `${interestRate.toFixed(1)}% ao dia`, inline: true }
                        );

                    const newRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("bal_deposit").setLabel("📥 Depositar Tudo").setStyle(ButtonStyle.Success).setDisabled((updatedUser.money || 0) <= 0),
                        new ButtonBuilder().setCustomId("bal_withdraw").setLabel("📤 Sacar Tudo").setStyle(ButtonStyle.Primary).setDisabled((updatedUser.bank || 0) <= 0),
                        new ButtonBuilder().setCustomId("bal_daily").setLabel("🎁 Daily").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("bal_work").setLabel("🔨 Work").setStyle(ButtonStyle.Secondary)
                    );

                    await interaction.editReply({ embeds: [newEmbed], components: [newRow] });
                } catch (e) {
                    console.error("Erro no botão balance:", e);
                }
            });

            collector.on('end', async () => {
                try {
                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("bal_deposit").setLabel("📥 Depositar").setStyle(ButtonStyle.Success).setDisabled(true),
                        new ButtonBuilder().setCustomId("bal_withdraw").setLabel("📤 Sacar").setStyle(ButtonStyle.Primary).setDisabled(true),
                        new ButtonBuilder().setCustomId("bal_daily").setLabel("🎁 Daily").setStyle(ButtonStyle.Secondary).setDisabled(true),
                        new ButtonBuilder().setCustomId("bal_work").setLabel("🔨 Work").setStyle(ButtonStyle.Secondary).setDisabled(true)
                    );
                    await interaction.editReply({ components: [disabledRow] }).catch(() => { });
                } catch (e) { }
            });

            return;
        }

        // --- DEPOSIT ---
        if (subcommand === "deposit") {
            let amountStr = interaction.options.getString("valor");
            let amount = 0;

            if (amountStr.toLowerCase() === "all" || amountStr.toLowerCase() === "tudo") {
                amount = money;
            } else {
                amount = parseInt(amountStr);
            }

            if (isNaN(amount) || amount <= 0) return interaction.editReply({ content: "❌ Valor inválido." });
            if (money < amount) return interaction.editReply({ content: "❌ Você não tem esse dinheiro na carteira." });

            userData.money -= amount;
            userData.bank += amount;
            await userData.save();

            return interaction.editReply(`📥 **Depósito Realizado!**\nVocê guardou **$${amount.toLocaleString()}** no banco.`);
        }

        // --- WITHDRAW ---
        if (subcommand === "withdraw") {
            let amountStr = interaction.options.getString("valor");
            let amount = 0;

            if (amountStr.toLowerCase() === "all" || amountStr.toLowerCase() === "tudo") {
                amount = bank;
            } else {
                amount = parseInt(amountStr);
            }

            if (isNaN(amount) || amount <= 0) return interaction.editReply({ content: "❌ Valor inválido." });
            if (bank < amount) return interaction.editReply({ content: "❌ Você não tem esse dinheiro no banco." });

            userData.bank -= amount;
            userData.money += amount;
            await userData.save();

            return interaction.editReply(`📤 **Saque Realizado!**\nVocê sacou **$${amount.toLocaleString()}** para a carteira.`);
        }
    }
};
