const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType } = require("discord.js");
const mongoose = require("mongoose");
const UserSchema = require("../../database/schemas/UserSchema");

if (!mongoose.models.Users) {
    mongoose.model("Users", UserSchema);
}

const PETS = require("../../utils/pets");
const blackjack = require("../games/blackjack");
const mines = require("../games/mines");
const race = require("../games/race");
const duel = require("../games/duel");

const TROLL_MESSAGES = [
    "O agiota está batendo na porta... 🚪",
    "Parabéns, você agora é o orgulho da decepção. 🤡",
    "Vendeu a TV pra jogar isso? 📺",
    "A casa sempre vence, otário. 🏦"
];

const BICHO_ANIMALS = [
    "Avestruz", "Águia", "Burro", "Borboleta", "Cachorro", "Cabra", "Carneiro", "Camelo", "Cobra", "Coelho",
    "Cavalo", "Elefante", "Galo", "Gato", "Jacaré", "Leão", "Macaco", "Porco", "Pavão", "Peru",
    "Touro", "Tigre", "Urso", "Veado", "Vaca"
];

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
                money: 0,
                energy: 50
            });
            await userData.save();
        }

        // Pet bonus
        let petLuckBonus = 1.0;
        let petBonusText = "";
        if (userData.activePet && PETS[userData.activePet]?.type === "luck") {
            petLuckBonus = 1 + PETS[userData.activePet].value;
            petBonusText = ` 🐱+${Math.round(PETS[userData.activePet].value * 100)}%`;
        }

        const applyPetBonus = (amount) => Math.floor(amount * petLuckBonus);

        const buildMainEmbed = (user) => {
            return new EmbedBuilder()
                .setTitle("🎰 Central do Cassino")
                .setColor("#9B59B6")
                .setThumbnail(interaction.user.displayAvatarURL())
                .setDescription("Escolha um jogo para apostar!\n\n**Dica**: Use o menu para selecionar o jogo e depois defina sua aposta.")
                .addFields(
                    { name: "💵 Saldo", value: `$${(user.money || 0).toLocaleString()}`, inline: true },
                    { name: "⚡ Energia", value: `${user.energy || 50}/50`, inline: true },
                    { name: "🐾 Pet", value: user.activePet ? PETS[user.activePet]?.name : "Nenhum", inline: true }
                )
                .setFooter({ text: "Cada jogo custa 1 energia • Expira em 2 min" });
        };

        const gameSelect = new StringSelectMenuBuilder()
            .setCustomId("casino_game_select")
            .setPlaceholder("🎮 Escolha um jogo...")
            .addOptions([
                { label: "🪙 Cara ou Coroa", value: "flip", description: "50/50 - 2x", emoji: "🪙" },
                { label: "🎰 Caça-Níqueis", value: "slots", description: "Símbolos iguais - até 10x", emoji: "🎰" },
                { label: "🔫 Roleta Russa", value: "roulette", description: "5/6 chance - 6x", emoji: "🔫" },
                { label: "📈 High/Low", value: "highlow", description: "Maior ou menor - 1.8x", emoji: "📈" },
                { label: "🦌 Jogo do Bicho", value: "bicho", description: "Escolha o animal - 18x", emoji: "🦌" },
                { label: "🃏 Blackjack", value: "blackjack", description: "Vença o dealer (21) - 2x", emoji: "🃏" },
                { label: "💣 Mines", value: "mines", description: "Campo minado - Multiplicador", emoji: "💣" },
                { label: "🏎️ Corrida", value: "race", description: "Aposte no carro vencedor - 5x", emoji: "🏎️" },
                { label: "⚔️ Duelo (PvP)", value: "duel", description: "Desafie outro jogador", emoji: "⚔️" }
            ]);

        const row1 = new ActionRowBuilder().addComponents(gameSelect);
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("casino_welcome").setLabel("🎁 Bônus Inicial").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("casino_recover").setLabel("💸 Declarar Falência").setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.editReply({
            embeds: [buildMainEmbed(userData)],
            components: [row1, row2]
        });

        let selectedGame = null;
        let selectedAnimal = null;
        let selectedCar = null;
        let selectedOpponent = null;
        let selectedDuelGame = "dice";
        let betAmount = 100;

        const collector = response.createMessageComponentCollector({
            time: 120000,
            filter: i => i.user.id === userId
        });

        collector.on('collect', async i => {
            try {
                const freshUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });

                // Game Selection
                if (i.customId === "casino_game_select") {
                    selectedGame = i.values[0];

                    const gameEmbed = new EmbedBuilder()
                        .setTitle(getGameTitle(selectedGame))
                        .setColor("#E74C3C")
                        .setDescription(`💵 Saldo: **$${(freshUser.money || 0).toLocaleString()}**\n⚡ Energia: **${freshUser.energy || 50}/50**\n\nClique em uma aposta rápida ou defina um valor personalizado:`)
                        .setFooter({ text: getGameRules(selectedGame) });

                    if (selectedGame === "bicho") {
                        const animalOptions = BICHO_ANIMALS.map(a => ({ label: a, value: a, emoji: "🦌" }));
                        // Split into 25 max if needed (already 25 exact)

                        const animalSelect = new StringSelectMenuBuilder()
                            .setCustomId("bicho_animal_select")
                            .setPlaceholder("🦌 Escolha o animal...")
                            .addOptions(animalOptions);

                        const rowAnimal = new ActionRowBuilder().addComponents(animalSelect);
                        const rowBack = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("casino_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                        );

                        await i.update({ embeds: [gameEmbed], components: [rowAnimal, rowBack] });
                        return;
                    }

                    if (selectedGame === "race") {
                        const carSelect = new StringSelectMenuBuilder()
                            .setCustomId("race_car_select")
                            .setPlaceholder("🏎️ Escolha seu piloto...")
                            .addOptions([
                                { label: "🏎️ Vermelho", value: "0", emoji: "🏎️" },
                                { label: "🚗 Azul", value: "1", emoji: "🚗" },
                                { label: "🚕 Amarelo", value: "2", emoji: "🚕" },
                                { label: "🚙 Verde", value: "3", emoji: "🚙" },
                                { label: "🚐 Branco", value: "4", emoji: "🚐" }
                            ]);

                        const rowCar = new ActionRowBuilder().addComponents(carSelect);
                        const rowBack = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("casino_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                        );

                        await i.update({ embeds: [gameEmbed], components: [rowCar, rowBack] });
                        return;
                    }

                    if (selectedGame === "duel") {
                        const userSelect = new UserSelectMenuBuilder()
                            .setCustomId("duel_user_select")
                            .setPlaceholder("⚔️ Escolha seu oponente...");

                        const rowUser = new ActionRowBuilder().addComponents(userSelect);
                        const rowBack = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("casino_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                        );

                        await i.update({ embeds: [gameEmbed], components: [rowUser, rowBack] });
                        return;
                    }

                    const betButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("bet_100").setLabel("$100").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("bet_500").setLabel("$500").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("bet_1000").setLabel("$1.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("bet_5000").setLabel("$5.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("bet_custom").setLabel("📝 Outro").setStyle(ButtonStyle.Success)
                    );

                    const actionButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("casino_play").setLabel(selectedGame === "blackjack" || selectedGame === "mines" ? "🎲 JOGAR!" : "🎲 Confirmar Aposta").setStyle(ButtonStyle.Success).setDisabled((freshUser.money || 0) < 100 || (freshUser.energy || 0) < 1),
                        new ButtonBuilder().setCustomId("casino_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [gameEmbed], components: [betButtons, actionButtons] });
                }

                // Animal Selection for Bicho
                if (i.customId === "bicho_animal_select") {
                    selectedAnimal = i.values[0];

                    const gameEmbed = new EmbedBuilder()
                        .setTitle(`🦌 Jogo do Bicho: ${selectedAnimal}`)
                        .setColor("#E74C3C")
                        .setDescription(`🦌 Animal Escolhido: **${selectedAnimal}**\n💵 Saldo: **$${(freshUser.money || 0).toLocaleString()}**\n\nAgora defina sua aposta:`)
                        .setFooter({ text: getGameRules("bicho") });

                    const betButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("bet_100").setLabel("$100").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("bet_500").setLabel("$500").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("bet_1000").setLabel("$1.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("bet_5000").setLabel("$5.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("bet_custom").setLabel("📝 Outro").setStyle(ButtonStyle.Success)
                    );

                    const actionButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("casino_play").setLabel(`🎲 Apostar no ${selectedAnimal}`).setStyle(ButtonStyle.Success).setDisabled((freshUser.money || 0) < 100 || (freshUser.energy || 0) < 1),
                        new ButtonBuilder().setCustomId("casino_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [gameEmbed], components: [betButtons, actionButtons] });
                }

                // Bet Selection
                if (i.customId.startsWith("bet_")) {
                    if (i.customId === "bet_custom") {
                        const modal = new ModalBuilder()
                            .setCustomId("bet_modal")
                            .setTitle("💰 Definir Aposta");

                        const input = new TextInputBuilder()
                            .setCustomId("bet_value")
                            .setLabel("Valor da aposta")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setPlaceholder("Ex: 2500");

                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        await i.showModal(modal);
                        return;
                    }

                    betAmount = parseInt(i.customId.split("_")[1]);
                    await i.reply({ content: `✅ Aposta definida: **$${betAmount.toLocaleString()}**`, ephemeral: true });
                }

                // Race Car Selection
                if (i.customId === "race_car_select") {
                    selectedCar = i.values[0];
                    const racerEmojis = ["🏎️", "🚗", "🚕", "🚙", "🚐"];

                    const gameEmbed = new EmbedBuilder()
                        .setTitle(`🏎️ Corrida: Apostando no ${racerEmojis[selectedCar]}`)
                        .setColor("#E74C3C")
                        .setDescription(`Piloto Escolhido: **${racerEmojis[selectedCar]}**\n💵 Saldo: **$${(freshUser.money || 0).toLocaleString()}**\n\nAgora defina sua aposta:`)
                        .setFooter({ text: getGameRules("race") });

                    const betButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("bet_100").setLabel("$100").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("bet_500").setLabel("$500").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("bet_1000").setLabel("$1.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("bet_5000").setLabel("$5.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("bet_custom").setLabel("📝 Outro").setStyle(ButtonStyle.Success)
                    );

                    const actionButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("casino_play").setLabel("🏁 Iniciar Corrida").setStyle(ButtonStyle.Success).setDisabled((freshUser.money || 0) < 100 || (freshUser.energy || 0) < 1),
                        new ButtonBuilder().setCustomId("casino_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [gameEmbed], components: [betButtons, actionButtons] });
                }

                // Duel User Selection
                if (i.customId === "duel_user_select") {
                    const targetId = i.values[0];
                    // Fetch user object manually or store id?
                    // ButtonInteraction values for UserSelectMenu return IDs.
                    // We need the User object for the mock interaction.
                    // i.users is a Collection <Snowflake, User> for UserSelectMenu!
                    selectedOpponent = i.users.get(targetId);

                    const gameEmbed = new EmbedBuilder()
                        .setTitle(`⚔️ Duelo contra ${selectedOpponent.username}`)
                        .setColor("#E74C3C")
                        .setDescription(`Oponente: **${selectedOpponent.username}**\n💵 Saldo: **$${(freshUser.money || 0).toLocaleString()}**\n\nDefina o valor do desafio:`)
                        .setFooter({ text: getGameRules("duel") });

                    const betButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("bet_100").setLabel("$100").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("bet_500").setLabel("$500").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("bet_1000").setLabel("$1.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("bet_5000").setLabel("$5.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("bet_custom").setLabel("📝 Outro").setStyle(ButtonStyle.Success)
                    );

                    // Optional: Game Type Selector here? Defaulting to Dice for now.
                    // Or add a toggle button? "Alterar Jogo: Dados -> PPT"

                    const actionButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("casino_play").setLabel("⚔️ Desafiar!").setStyle(ButtonStyle.Success).setDisabled((freshUser.money || 0) < 100 || (freshUser.energy || 0) < 1),
                        new ButtonBuilder().setCustomId("casino_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [gameEmbed], components: [betButtons, actionButtons] });
                }

                // Play Game
                if (i.customId === "casino_play" && selectedGame) {
                    if ((freshUser.money || 0) < betAmount) {
                        return i.reply({ content: `❌ Saldo insuficiente! Você tem $${(freshUser.money || 0).toLocaleString()}`, ephemeral: true });
                    }
                    if ((freshUser.energy || 0) < 1) {
                        return i.reply({ content: "❌ Sem energia! Aguarde regenerar ou use Energy Drink.", ephemeral: true });
                    }

                    // --- EXTERNAL GAMES DELEGATION ---
                    if (["blackjack", "mines", "race", "duel"].includes(selectedGame)) {
                        // Mock Interaction
                        const mockOptions = {
                            getInteger: (key) => key === "valor" ? betAmount : 0,
                            getString: (key) => {
                                if (key === "carro") return selectedCar;
                                if (key === "jogo") return selectedDuelGame;
                                return null;
                            },
                            getUser: (key) => key === "oponente" ? selectedOpponent : null
                        };

                        // Proxy logic manually or just Object.assign
                        // We need a robust mock because external games might use various methods.
                        const mockInteraction = Object.create(i);
                        mockInteraction.options = mockOptions;
                        mockInteraction.user = i.user;
                        mockInteraction.guildId = i.guildId;
                        // Important: Override reply/update because we are in a component interaction.
                        // External games usually do interaction.reply()
                        // i.reply() works for ComponentInteraction too.

                        // Deduct Energy ONLY (Money logic is inside external game)
                        freshUser.energy = (freshUser.energy || 50) - 1;
                        await freshUser.save(); // Save energy deduction before game

                        try {
                            if (selectedGame === "blackjack") await blackjack.execute(mockInteraction, freshUser, applyPetBonus, petBonusText);
                            if (selectedGame === "mines") await mines.execute(mockInteraction, freshUser);
                            if (selectedGame === "race") {
                                if (!selectedCar) return i.reply({ content: "❌ Escolha um piloto!", ephemeral: true });
                                await race.execute(mockInteraction, freshUser);
                            }
                            if (selectedGame === "duel") {
                                if (!selectedOpponent) return i.reply({ content: "❌ Escolha um oponente!", ephemeral: true });
                                await duel.execute(mockInteraction, freshUser);
                            }
                        } catch (err) {
                            console.error("External Game Error:", err);
                        }
                        return; // Stop execution here
                    }

                    // --- INTERNAL GAMES ---
                    freshUser.money -= betAmount;
                    freshUser.energy = (freshUser.energy || 50) - 1;

                    const result = playGame(selectedGame, betAmount, applyPetBonus, selectedAnimal);

                    if (result.won) {
                        freshUser.money += result.winnings;
                    }

                    await freshUser.save();

                    const resultEmbed = new EmbedBuilder()
                        .setTitle(result.won ? "🎉 VITÓRIA!" : "💀 DERROTA!")
                        .setColor(result.won ? "#2ECC71" : "#E74C3C")
                        .setDescription(result.message + (result.won ? petBonusText : ""))
                        .addFields(
                            { name: "💵 Novo Saldo", value: `$${freshUser.money.toLocaleString()}`, inline: true },
                            { name: "⚡ Energia", value: `${freshUser.energy}/50`, inline: true }
                        );

                    const playAgain = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("casino_play").setLabel("🎲 Jogar Novamente").setStyle(ButtonStyle.Success).setDisabled(freshUser.money < betAmount || freshUser.energy < 1),
                        new ButtonBuilder().setCustomId("casino_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
                    );

                    await i.update({ embeds: [resultEmbed], components: [playAgain] });
                }

                // Welcome Bonus
                if (i.customId === "casino_welcome") {
                    if (freshUser.welcomeClaimed) {
                        return i.reply({ content: "❌ Bônus já resgatado!", ephemeral: true });
                    }
                    freshUser.money = (freshUser.money || 0) + 3000;
                    freshUser.welcomeClaimed = true;
                    await freshUser.save();
                    await i.reply({ content: "🎁 **Bônus de $3.000 resgatado!** Boa sorte!", ephemeral: true });
                }

                // Recover (Bankruptcy)
                if (i.customId === "casino_recover") {
                    if ((freshUser.money || 0) + (freshUser.bank || 0) > 100) {
                        return i.reply({ content: "❌ Você ainda tem dinheiro! Só pode declarar falência se estiver pobre.", ephemeral: true });
                    }
                    freshUser.money = 500;
                    freshUser.bank = 0;
                    await freshUser.save();
                    await i.reply({ content: "💸 **Falência declarada!** Você recebeu $500 de caridade.", ephemeral: true });
                }

                // Back
                if (i.customId === "casino_back") {
                    const updatedUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });
                    selectedGame = null;
                    selectedAnimal = null;
                    selectedCar = null;
                    selectedOpponent = null;
                    await i.update({ embeds: [buildMainEmbed(updatedUser)], components: [row1, row2] });
                }

            } catch (e) {
                console.error("Erro na central casino:", e);
            }
        });

        // Modal handler for custom bet
        const modalHandler = async (modalInteraction) => {
            if (!modalInteraction.isModalSubmit()) return;
            if (modalInteraction.customId !== "bet_modal") return;
            if (modalInteraction.user.id !== userId) return;

            const value = parseInt(modalInteraction.fields.getTextInputValue("bet_value"));
            if (isNaN(value) || value < 10) {
                return modalInteraction.reply({ content: "❌ Valor inválido! Mínimo: $10", ephemeral: true });
            }
            betAmount = value;
            await modalInteraction.reply({ content: `✅ Aposta definida: **$${betAmount.toLocaleString()}**`, ephemeral: true });
        };

        interaction.client.on('interactionCreate', modalHandler);

        collector.on('end', () => {
            interaction.client.removeListener('interactionCreate', modalHandler);
        });
    }
};

function getGameTitle(game) {
    const titles = {
        flip: "🪙 Cara ou Coroa",
        slots: "🎰 Caça-Níqueis",
        roulette: "🔫 Roleta Russa",
        highlow: "📈 High / Low",
        bicho: "🦌 Jogo do Bicho",
        blackjack: "🃏 Blackjack (21)",
        mines: "💣 Mines",
        race: "🏎️ Corrida",
        duel: "⚔️ Duelo PvP"
    };
    return titles[game] || "🎮 Jogo";
}

function getGameRules(game) {
    const rules = {
        flip: "50% chance • Ganhe 2x",
        slots: "3 iguais = Jackpot! • Até 10x",
        roulette: "5/6 chance de sobreviver • 6x se viver",
        highlow: "Número maior ou menor? • 1.8x",
        bicho: "Escolha o animal certo • 18x",
        blackjack: "Vença o dealer sem estourar 21 • 2x",
        mines: "Encontre diamantes, evite bombas! • Multiplicador",
        race: "Seu carro chega primeiro? • 5x",
        duel: "X1 contra outro player • Quem tiver maior dado vence"
    };
    return rules[game] || "";
}

function playGame(game, bet, applyBonus, userChoice = null) {
    let won = false;
    let winnings = 0;
    let message = "";

    switch (game) {
        case "flip":
            won = Math.random() < 0.5;
            winnings = applyBonus(bet * 2);
            message = won ? `🪙 DEU ${Math.random() < 0.5 ? "CARA" : "COROA"}! Ganhou **$${winnings.toLocaleString()}**!` : `🪙 Deu o lado errado! Perdeu **$${bet.toLocaleString()}**.`;
            break;

        case "slots":
            const symbols = ["🍒", "🍋", "🍊", "🍇", "💎", "7️⃣"];
            const result = [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]];

            if (result[0] === result[1] && result[1] === result[2]) {
                won = true;
                const mult = result[0] === "7️⃣" ? 10 : result[0] === "💎" ? 5 : 3;
                winnings = applyBonus(bet * mult);
                message = `${result.join(" ")} **JACKPOT!** Ganhou **$${winnings.toLocaleString()}**!`;
            } else if (result[0] === result[1] || result[1] === result[2]) {
                won = true;
                winnings = applyBonus(Math.floor(bet * 1.5));
                message = `${result.join(" ")} Par! Ganhou **$${winnings.toLocaleString()}**!`;
            } else {
                message = `${result.join(" ")} Nada... Perdeu **$${bet.toLocaleString()}**.`;
            }
            break;

        case "roulette":
            won = Math.random() > (1 / 6);
            winnings = applyBonus(bet * 6);
            message = won ? `🔫 *click* Sobreviveu! Ganhou **$${winnings.toLocaleString()}**!` : `🔫 **BANG!** Você morreu... Perdeu **$${bet.toLocaleString()}**.`;
            break;

        case "highlow":
            const current = Math.floor(Math.random() * 100) + 1;
            const next = Math.floor(Math.random() * 100) + 1;
            const guess = Math.random() < 0.5 ? "high" : "low";
            won = (guess === "high" && next > current) || (guess === "low" && next < current);
            winnings = applyBonus(Math.floor(bet * 1.8));
            message = `Atual: **${current}** → Próximo: **${next}**\n${won ? `✅ Ganhou **$${winnings.toLocaleString()}**!` : `❌ Perdeu **$${bet.toLocaleString()}**.`}`;
            break;

        case "bicho":
            const animals = ["🐔", "🐶", "🐱", "🐴", "🐘", "🦁", "🦌", "🐮", "🐷", "🐒"];
            // Use userChoice if available, otherwise random (fallback)
            const chosen = userChoice || animals[Math.floor(Math.random() * animals.length)];
            const drawn = BICHO_ANIMALS[Math.floor(Math.random() * BICHO_ANIMALS.length)]; // Use full list for result
            won = chosen === drawn;
            winnings = applyBonus(bet * 18);
            message = `Apostou: **${chosen}** | Sorteado: **${drawn}**\n${won ? `🎉 **DEU GREEN!** Ganhou **$${winnings.toLocaleString()}**!` : `💀 Perdeu **$${bet.toLocaleString()}**.`}`;
            break;
    }

    return { won, winnings, message };
}
