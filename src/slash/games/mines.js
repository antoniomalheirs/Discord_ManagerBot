const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

const GRID_SIZE = 20; // 5 cols x 4 rows
const MIN_BOMBS = 6;
const MAX_BOMBS = 11;

module.exports = {
    async execute(interaction, userData) {
        const aposta = interaction.options.getInteger("valor");
        const userId = interaction.user.id;

        if ((userData.money || 0) < aposta) return interaction.reply({ content: `💸 Saldo insuficiente!`, ephemeral: true });

        // Deduz dinheiro
        userData.money -= aposta;
        await userData.save();

        // Dynamic Random Bombs (Secret)
        const secretBombs = Math.floor(Math.random() * (MAX_BOMBS - MIN_BOMBS + 1)) + MIN_BOMBS;

        // Setup Grid (0 = safe, 1 = bomb)
        const grid = Array(GRID_SIZE).fill(0);
        let bombsPlaced = 0;

        while (bombsPlaced < secretBombs) {
            const idx = Math.floor(Math.random() * GRID_SIZE);
            if (grid[idx] === 0) {
                grid[idx] = 1;
                bombsPlaced++;
            }
        }

        let clickedIndices = [];
        let multiplier = 1.0;

        const calculateNextMult = (current, bombs, steps) => {
            const remaining = GRID_SIZE - steps;
            const safe = remaining - bombs;
            const odds = remaining / safe;
            return current * odds * 0.90; // 10% house edge
        };

        const generateRows = (revealAll = false, exploded = false) => {
            const rows = [];
            for (let i = 0; i < 4; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 5; j++) {
                    const idx = i * 5 + j;
                    const btn = new ButtonBuilder().setCustomId(`mine_${idx}`);

                    if (clickedIndices.includes(idx) || revealAll) {
                        btn.setDisabled(true);
                        if (grid[idx] === 1) {
                            btn.setEmoji('💣').setStyle(exploded && clickedIndices.includes(idx) ? ButtonStyle.Danger : ButtonStyle.Secondary);
                        } else {
                            btn.setEmoji('💎').setStyle(ButtonStyle.Success);
                        }
                    } else {
                        btn.setEmoji('🟦').setStyle(ButtonStyle.Secondary);
                    }
                    row.addComponents(btn);
                }
                rows.push(row);
            }

            const controlRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cashout').setLabel(`💰 SAIR | Lucro: ${(aposta * multiplier).toFixed(0)}`).setStyle(ButtonStyle.Primary)
            );
            if (revealAll) controlRow.components[0].setDisabled(true);
            rows.push(controlRow);
            return rows;
        };

        const embed = new EmbedBuilder()
            .setTitle("💣 Mines (Dynamic)")
            .setColor("#3498DB")
            .setDescription(`Bombas: **❓ (6 a 11)**\nMultiplicador: **${multiplier.toFixed(2)}x**\nLucro Atual: **${(aposta * multiplier).toFixed(0)}**`);

        const response = await interaction.reply({ embeds: [embed], components: generateRows() });
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: "Não é seu jogo!", ephemeral: true });

            // Prevent multiple cashouts/clicks after game ended
            if (collector.ended) return i.deferUpdate().catch(() => { });

            if (i.customId === 'cashout') {
                collector.stop('cashout');  // Stop immediately to prevent double clicks
                let winAmount = Math.floor(aposta * multiplier);

                // Pet Bonus
                const PETS = require("../../utils/pets");
                if (userData.activePet && PETS[userData.activePet]?.type === "luck") {
                    winAmount += Math.floor(winAmount * PETS[userData.activePet].value);
                }

                userData.money += winAmount;
                await userData.save();

                embed.setTitle("💣 Mines - WIN!")
                    .setColor("#00FF00")
                    .setDescription(`Você parou! Bombas reais: **${secretBombs}**\nGanhou **${winAmount}** moedas!`);

                await i.update({ embeds: [embed], components: generateRows(true) });
                return;
            }

            const idx = parseInt(i.customId.split('_')[1]);
            if (grid[idx] === 1) {
                // BOMBA
                embed.setTitle("💣 Mines - KABOOM!")
                    .setColor("#FF0000")
                    .setDescription(`Explodiu! Tinha **${secretBombs}** bombas.\nPerdeu **${aposta}** moedas.`);

                clickedIndices.push(idx);
                await i.update({ embeds: [embed], components: generateRows(true, true) });
                collector.stop();
            } else {
                // DIAMOND
                clickedIndices.push(idx);

                const safeRemaining = (GRID_SIZE - secretBombs) - clickedIndices.length;
                if (safeRemaining === 0) {
                    multiplier = calculateNextMult(multiplier, secretBombs, clickedIndices.length - 1);
                    let winAmount = Math.floor(aposta * multiplier);

                    // Pet Bonus
                    const PETS = require("../../utils/pets");
                    if (userData.activePet && PETS[userData.activePet]?.type === "luck") {
                        winAmount += Math.floor(winAmount * PETS[userData.activePet].value);
                    }

                    userData.money += winAmount;
                    await userData.save();

                    embed.setTitle("💎 Mines - CLEAN SWEEP!")
                        .setColor("#00FF00")
                        .setDescription(`Limpou! Era **${secretBombs}** bombas! Ganhou **${winAmount}**!`);

                    await i.update({ embeds: [embed], components: generateRows(true) });
                    collector.stop();
                } else {
                    multiplier = calculateNextMult(multiplier, secretBombs, clickedIndices.length - 1);
                    embed.setDescription(`Bombas: **❓ (6 a 11)**\nMultiplicador: **${multiplier.toFixed(2)}x**\nLucro Atual: **${(aposta * multiplier).toFixed(0)}**`);
                    await i.update({ embeds: [embed], components: generateRows() });
                }
            }
        });
    }
};
