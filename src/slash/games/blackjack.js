const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const COST_PER_PLAY = 1;

module.exports = {
    async execute(interaction, userData) {
        const aposta = interaction.options.getInteger("valor");
        const userId = interaction.user.id;

        // Energy Check handled by main casino.js? 
        // If not, we should check here. But let's assume casino.js does the generic energy check.
        // However, generic casino checks don't deduct money because bet amount varies.
        // So we keep MONEY check here.

        if ((userData.money || 0) < aposta) {
            return interaction.reply({ content: `💸 Saldo insuficiente!`, ephemeral: true });
        }

        // Deduz dinheiro (Aposta)
        // Nota: Energia já foi descontada no casino.js se configurado corretamente.
        userData.money -= aposta;
        await userData.save();

        // Game Logic
        const deck = createDeck();
        const playerHand = [drawCard(deck), drawCard(deck)];
        const dealerHand = [drawCard(deck), drawCard(deck)];

        let playerScore = calculateScore(playerHand);
        let dealerScore = calculateScore(dealerHand);

        const embed = new EmbedBuilder()
            .setTitle("🃏 Blackjack")
            .setColor("#2F3136")
            .setDescription(`Aposta: **${aposta}** moedas`)
            .addFields(
                { name: `Sua Mão (${playerScore})`, value: formatHand(playerHand), inline: true },
                { name: `Dealer`, value: `${dealerHand[0].text} | 🂠 ?`, inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hit').setLabel('Pedir (Hit)').setStyle(ButtonStyle.Success).setEmoji('🃏'),
            new ButtonBuilder().setCustomId('stand').setLabel('Parar (Stand)').setStyle(ButtonStyle.Danger).setEmoji('🛑')
        );

        const response = await interaction.reply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: "Não é seu jogo sai daqui!", ephemeral: true });

            if (i.customId === 'hit') {
                playerHand.push(drawCard(deck));
                playerScore = calculateScore(playerHand);

                if (playerScore > 21) {
                    await endGame(i, "lose", "Estourou! (Bust)", playerHand, dealerHand, aposta, userData);
                    collector.stop();
                } else {
                    const newEmbed = EmbedBuilder.from(embed)
                        .setFields(
                            { name: `Sua Mão (${playerScore})`, value: formatHand(playerHand), inline: true },
                            { name: `Dealer`, value: `${dealerHand[0].text} | 🂠 ?`, inline: true }
                        );
                    await i.update({ embeds: [newEmbed] });
                }
            }

            if (i.customId === 'stand') {
                // Dealer turn
                while (dealerScore < 17) {
                    dealerHand.push(drawCard(deck));
                    dealerScore = calculateScore(dealerHand);
                }

                let result = "";
                let type = "lose";

                if (dealerScore > 21) {
                    result = "Dealer estourou! Você ganhou!";
                    type = "win";
                } else if (playerScore > dealerScore) {
                    result = "Você venceu!";
                    type = "win";
                } else if (playerScore < dealerScore) {
                    result = "Dealer venceu.";
                    type = "lose";
                } else {
                    result = "Empate (Push). Dinheiro devolvido.";
                    type = "push";
                }

                await endGame(i, type, result, playerHand, dealerHand, aposta, userData);
                collector.stop();
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                // Refund bet on timeout
                userData.money += aposta;
                await userData.save();
                interaction.editReply({ content: "⏰ Tempo esgotado! Aposta devolvida.", components: [] });
            }
        });
    }
};

// Utils
const SUITS = ["♠️", "♥️", "♣️", "♦️"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
    let deck = [];
    for (const s of SUITS) {
        for (const v of VALUES) {
            let weight = parseInt(v);
            if (["J", "Q", "K"].includes(v)) weight = 10;
            if (v === "A") weight = 11;
            deck.push({ text: `[${v}${s}]`, weight, value: v });
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

function drawCard(deck) {
    return deck.pop();
}

function calculateScore(hand) {
    let score = 0;
    let aces = 0;
    for (const card of hand) {
        score += card.weight;
        if (card.value === "A") aces++;
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    return score;
}

function formatHand(hand) {
    return hand.map(c => c.text).join(" ");
}

async function endGame(interaction, type, reason, playerHand, dealerHand, aposta, userData) {
    const playerScore = calculateScore(playerHand);
    const dealerScore = calculateScore(dealerHand);

    let color = "#FF0000";
    let winAmount = 0;

    if (type === "win") {
        color = "#00FF00";
        // NERFED: 1.9x Payout (House Edge 10%)
        // BLACKJACK BONUS: 2.2x 
        let multiplier = 1.9;
        if (playerHand.length === 2 && playerScore === 21) {
            multiplier = 2.2;
            reason += " (Blackjack!)";
        }

        winAmount = Math.floor(aposta * multiplier);

        // Pet Luck Bonus
        const PETS = require("../../utils/pets");
        if (userData.activePet && PETS[userData.activePet]?.type === "luck") {
            const bonus = Math.floor(winAmount * PETS[userData.activePet].value);
            winAmount += bonus;
            reason += ` (+${bonus} Bônus Pet)`;
        }

        userData.money += winAmount;
    } else if (type === "push") {
        color = "#FFFF00";
        winAmount = aposta; // Devolve
        userData.money += winAmount;
    }

    await userData.save();

    const embed = new EmbedBuilder()
        .setTitle(`🃏 Fim de Jogo: ${reason}`)
        .setColor(color)
        .addFields(
            { name: `Sua Mão (${playerScore})`, value: formatHand(playerHand), inline: true },
            { name: `Dealer (${dealerScore})`, value: formatHand(dealerHand), inline: true }
        )
        .setFooter({ text: `Saldo: ${userData.money}` });

    await interaction.update({ embeds: [embed], components: [] });
}
