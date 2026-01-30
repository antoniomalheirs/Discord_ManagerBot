const { EmbedBuilder } = require("discord.js");

const RACERS = ["🏎️", "🚗", "🚕", "🚙", "🚐"];
const TRACK_LENGTH = 15;

module.exports = {
    async execute(interaction, userData) {
        const aposta = interaction.options.getInteger("valor");
        const chosenRacerIdx = parseInt(interaction.options.getString("carro"));
        const userId = interaction.user.id;

        if ((userData.money || 0) < aposta) return interaction.reply({ content: `💸 Saldo insuficiente!`, ephemeral: true });

        // Deduz dinheiro
        userData.money -= aposta;
        await userData.save();

        let positions = [0, 0, 0, 0, 0];
        let winner = -1;

        const generateTrack = () => {
            let track = "";
            for (let i = 0; i < RACERS.length; i++) {
                const spaces = " ".repeat(positions[i]);
                const remaining = " ".repeat(TRACK_LENGTH - positions[i]);
                const line = `|${spaces}${RACERS[i]}${remaining}| ${i === chosenRacerIdx ? "⬅️ (VC)" : ""}`;
                track += line + "\n";
            }
            return "```" + track + "```";
        };

        const embed = new EmbedBuilder()
            .setTitle("🏁 Corrida Iniciada!")
            .setColor("#F1C40F")
            .setDescription(generateTrack());

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

        // Animation Loop with max timeout (60s safety)
        let elapsed = 0;
        const MAX_RACE_TIME = 60000; // 60 seconds max

        const interval = setInterval(async () => {
            elapsed += 1500;

            // Safety timeout
            if (elapsed >= MAX_RACE_TIME) {
                clearInterval(interval);
                await msg.edit({
                    embeds: [new EmbedBuilder()
                        .setTitle("🏁 Corrida Cancelada")
                        .setColor("#FF0000")
                        .setDescription("A corrida demorou demais! Aposta devolvida.")
                    ]
                });
                userData.money += aposta;
                await userData.save();
                return;
            }

            // Move cars randomly
            for (let i = 0; i < RACERS.length; i++) {
                if (Math.random() > 0.4) { // 60% chance to move
                    positions[i]++;
                }
                if (positions[i] >= TRACK_LENGTH) {
                    winner = i;
                    break;
                }
            }

            if (winner !== -1) {
                clearInterval(interval);

                let resultText = "";
                let color = "#FF0000";

                if (winner === chosenRacerIdx) {
                    let winAmount = Math.floor(aposta * 3.5); // 3.5x payout

                    // Pet Bonus
                    const PETS = require("../../utils/pets");
                    if (userData.activePet && PETS[userData.activePet]?.type === "luck") {
                        winAmount += Math.floor(winAmount * PETS[userData.activePet].value);
                    }

                    userData.money += winAmount;
                    await userData.save();
                    resultText = `🎉 **VITÓRIA!** Seu carro (${RACERS[winner]}) venceu!\nGanhou **${winAmount}** moedas!`;
                    color = "#00FF00";
                } else {
                    resultText = `😢 **DERROTA!** O vencedor foi ${RACERS[winner]}.\nBetter luck next time.`;
                }

                const finalEmbed = new EmbedBuilder()
                    .setTitle("🏁 Fim da Corrida!")
                    .setColor(color)
                    .setDescription(generateTrack() + `\n${resultText}`);

                await msg.edit({ embeds: [finalEmbed] });
            } else {
                // Update frame
                const newEmbed = new EmbedBuilder()
                    .setTitle("🏁 Corrida em Andamento...")
                    .setColor("#F1C40F")
                    .setDescription(generateTrack());

                await msg.edit({ embeds: [newEmbed] }).catch(() => clearInterval(interval));
            }

        }, 1500);
    }
};
