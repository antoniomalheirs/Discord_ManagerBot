const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const mongoose = require("mongoose");

const TAX_RATE = 0.05; // 5%

module.exports = {
    async execute(interaction, challengerData) {
        await interaction.deferReply();

        const opponent = interaction.options.getUser("oponente");
        const amount = interaction.options.getInteger("valor");
        const gameType = interaction.options.getString("jogo");
        const challenger = interaction.user;

        // Validations
        if (opponent.id === challenger.id) return interaction.editReply("❌ Você não pode duelar consigo mesmo (esquizofrenia tem tratamento).");
        if (opponent.bot) return interaction.editReply("❌ Robôs são muito bons para perder. Escolha um humano.");

        const UserModel = mongoose.model("Users");
        // challengerData is passed in, but check simple null check
        if (!challengerData) {
            // Just in case
            challengerData = await UserModel.findOne({ codigouser: challenger.id, idguild: interaction.guildId });
        }

        const opponentData = await UserModel.findOne({ codigouser: opponent.id, idguild: interaction.guildId });

        if (!challengerData || (challengerData.money || 0) < amount) {
            return interaction.editReply(`💸 **Erro:** Você não tem **$${amount.toLocaleString()}** para apostar.`);
        }
        if (!opponentData || (opponentData.money || 0) < amount) {
            return interaction.editReply(`💸 **Erro:** ${opponent.username} está quebrado e não tem **$${amount.toLocaleString()}**.`);
        }

        // --- PREPARE CHALLENGE ---
        const gameName = gameType === "dice" ? "🎲 Dados" : "✂️ Pedra-Papel-Tesoura";

        const embed = new EmbedBuilder()
            .setTitle(`⚔️ DESAFIO DE X1: ${gameName}`)
            .setDescription(`<@${challenger.id}> desafiou <@${opponent.id}> para um duelo!\n\n💰 **Aposta:** $${amount.toLocaleString()} (Total: $${(amount * 2).toLocaleString()})\n📜 **Taxa da Casa:** 5%`)
            .setColor("#FF0000")
            .setThumbnail("https://media.giphy.com/media/26FFDckvIXxpwWcTK/giphy.gif");

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId("accept").setLabel("Aceitar Desafio").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("decline").setLabel("Recusar").setStyle(ButtonStyle.Danger)
            );

        const msg = await interaction.editReply({ content: `<@${opponent.id}>`, embeds: [embed], components: [row] });

        // --- COLLECTOR FOR ACCEPT/DECLINE ---
        const filter = i => i.user.id === opponent.id;
        try {
            const confirmation = await msg.awaitMessageComponent({ filter, time: 60000, componentType: ComponentType.Button });

            if (confirmation.customId === "decline") {
                await confirmation.update({ content: `🚫 Desafio recusado. ${opponent.username} fugiu da raia! 🐔`, components: [] });
                return;
            }

            // ACCEPTED: Re-fetch and revalidate balances (prevent stale data exploit)
            challengerData = await UserModel.findOne({ codigouser: challenger.id, idguild: interaction.guildId });
            const freshOpponentData = await UserModel.findOne({ codigouser: opponent.id, idguild: interaction.guildId });

            if (!challengerData || (challengerData.money || 0) < amount) {
                await confirmation.update({ content: `❌ ${challenger.username} não tem mais saldo suficiente!`, components: [] });
                return;
            }
            if (!freshOpponentData || (freshOpponentData.money || 0) < amount) {
                await confirmation.update({ content: `❌ ${opponent.username} não tem mais saldo suficiente!`, components: [] });
                return;
            }

            // Use fresh data
            const opponentData = freshOpponentData;

            // DEDUCT MONEY (Safe Transaction)
            challengerData.money -= amount;
            opponentData.money -= amount;
            await challengerData.save();
            await opponentData.save();

            // --- START GAME ---
            if (gameType === "dice") {
                const roll1 = Math.floor(Math.random() * 6) + 1; // Challenger
                const roll2 = Math.floor(Math.random() * 6) + 1; // Opponent

                let resultText = "";
                let winnerId = null;

                if (roll1 > roll2) {
                    winnerId = challenger.id;
                    resultText = `🏆 **${challenger.username} VENCEU!**`;
                } else if (roll2 > roll1) {
                    winnerId = opponent.id;
                    resultText = `🏆 **${opponent.username} VENCEU!**`;
                } else {
                    // Tie
                    resultText = "👔 **EMPATE!** O dinheiro foi devolvido.";
                    challengerData.money += amount;
                    opponentData.money += amount;
                    await challengerData.save();
                    await opponentData.save();

                    await confirmation.update({
                        embeds: [new EmbedBuilder()
                            .setTitle("🎲 Resultado dos Dados")
                            .setColor("#FFFF00")
                            .setDescription(`${challenger.username}: 🎲 **${roll1}**\n${opponent.username}: 🎲 **${roll2}**\n\n${resultText}`)
                        ], components: []
                    });
                    return;
                }

                // Pay Winner
                if (winnerId) {
                    const pot = amount * 2;
                    const tax = Math.floor(pot * TAX_RATE);
                    const prize = pot - tax;

                    const winnerData = winnerId === challenger.id ? challengerData : opponentData;
                    winnerData.money += prize;
                    await winnerData.save();

                    await confirmation.update({
                        embeds: [new EmbedBuilder()
                            .setTitle("🎲 Resultado dos Dados")
                            .setColor("#00FF00")
                            .setDescription(`${challenger.username}: 🎲 **${roll1}**\n${opponent.username}: 🎲 **${roll2}**\n\n${resultText}\n💰 Ganhou **$${prize.toLocaleString()}** (Taxa: $${tax})`)
                        ], components: []
                    });
                }
            } else if (gameType === "rps") {
                const rpsRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("rock").setEmoji("🪨").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("paper").setEmoji("📄").setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId("scissors").setEmoji("✂️").setStyle(ButtonStyle.Secondary)
                );

                await confirmation.update({
                    content: "⚔️ **ESCOLHAM SUAS ARMAS!** (Vocês têm 30s)",
                    embeds: [],
                    components: [rpsRow]
                });

                // Collector for Both
                const choices = {};
                const rpsFilter = i => [challenger.id, opponent.id].includes(i.user.id) && !choices[i.user.id];

                const gameCollector = msg.createMessageComponentCollector({ filter: rpsFilter, time: 30000 });

                gameCollector.on('collect', async i => {
                    choices[i.user.id] = i.customId;
                    await i.reply({ content: `Você escolheu ${i.customId === "rock" ? "🪨" : i.customId === "paper" ? "📄" : "✂️"}. Aguarde...`, ephemeral: true });

                    if (choices[challenger.id] && choices[opponent.id]) {
                        gameCollector.stop("finished");
                    }
                });

                gameCollector.on('end', async (collected, reason) => {
                    // Re-fetch fresh data to avoid stale data issues
                    const freshChallenger = await UserModel.findOne({ codigouser: challenger.id, idguild: interaction.guildId });
                    const freshOpponent = await UserModel.findOne({ codigouser: opponent.id, idguild: interaction.guildId });

                    if (reason !== "finished") {
                        if (freshChallenger) { freshChallenger.money += amount; await freshChallenger.save(); }
                        if (freshOpponent) { freshOpponent.money += amount; await freshOpponent.save(); }
                        return interaction.editReply({ content: "⏳ Tempo esgotado! Duelo cancelado e dinheiro devolvido.", components: [] });
                    }

                    const cChoice = choices[challenger.id];
                    const oChoice = choices[opponent.id];
                    let winnerId = null;

                    if (cChoice === oChoice) winnerId = null;
                    else if (
                        (cChoice === "rock" && oChoice === "scissors") ||
                        (cChoice === "scissors" && oChoice === "paper") ||
                        (cChoice === "paper" && oChoice === "rock")
                    ) {
                        winnerId = challenger.id;
                    } else {
                        winnerId = opponent.id;
                    }

                    const map = { rock: "🪨", paper: "📄", scissors: "✂️" };

                    if (!winnerId) {
                        // Tie - refund both
                        if (freshChallenger) { freshChallenger.money += amount; await freshChallenger.save(); }
                        if (freshOpponent) { freshOpponent.money += amount; await freshOpponent.save(); }

                        await interaction.editReply({
                            embeds: [new EmbedBuilder()
                                .setTitle("✂️ Resultado do X1")
                                .setColor("#FFFF00")
                                .setDescription(`${challenger.username}: ${map[cChoice]}\n${opponent.username}: ${map[oChoice]}\n\n👔 **EMPATE!** Ninguém morreu.`)
                            ], components: []
                        });
                    } else {
                        const pot = amount * 2;
                        const tax = Math.floor(pot * TAX_RATE);
                        const prize = pot - tax;

                        const winnerData = winnerId === challenger.id ? freshChallenger : freshOpponent;
                        const winnerName = winnerId === challenger.id ? challenger.username : opponent.username;

                        winnerData.money += prize;
                        await winnerData.save();

                        await interaction.editReply({
                            embeds: [new EmbedBuilder()
                                .setTitle("✂️ Resultado do X1")
                                .setColor("#00FF00")
                                .setDescription(`${challenger.username}: ${map[cChoice]}\n${opponent.username}: ${map[oChoice]}\n\n🏆 **${winnerName} VENCEU!**\n💰 Levou **$${prize.toLocaleString()}**`)
                            ], components: []
                        });
                    }
                });
            }

        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: "⏳ O oponente demorou demais para aceitar.", components: [] });
        }
    }
};
