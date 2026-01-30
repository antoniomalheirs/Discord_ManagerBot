const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const PokerTable = require("../utils/poker/PokerTable");
const mongoose = require("mongoose");
const GuildSchema = require("../database/schemas/GuildSchema");

const UserSchema = require("../database/schemas/UserSchema");
const pokerCentral = require("./poker/central");

// Ensure Models are registered
if (!mongoose.models.Guilds) mongoose.model("Guilds", GuildSchema);
if (!mongoose.models.Users) mongoose.model("Users", UserSchema);

// Active Tables: Map<ChannelID, PokerTable>
const activeTables = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("poker")
        .setDescription("🃏 Texas Hold'em Poker")
        .addSubcommand(sub =>
            sub.setName("central").setDescription("🎮 Painel central interativo (RECOMENDADO)")
        )
        .addSubcommand(sub =>
            sub.setName("start")
                .setDescription("Cria uma mesa Multiplayer")
                .addIntegerOption(opt => opt.setName("bet").setDescription("Valor da entrada (Buy-in)").setRequired(true))
                .addIntegerOption(opt => opt.setName("players").setDescription("Máximo de jogadores (2-8)").setMinValue(2).setMaxValue(8))
        )
        .addSubcommand(sub =>
            sub.setName("solo")
                .setDescription("Joga contra a Máquina (AI)")
                .addIntegerOption(opt => opt.setName("bet").setDescription("Valor da aposta").setRequired(true))
        ),

    async execute(interaction) {
        // --- DASHBOARD RESTRICTION CHECK ---
        const GuildsModel = mongoose.model("Guilds");
        const UserModel = mongoose.model("Users");
        const guildData = await GuildsModel.findOne({ guildID: interaction.guildId });

        if (!guildData || !guildData.poker || !guildData.poker.state) {
            return interaction.reply({
                content: "🚫 **Poker Desativado!**\nO administrador precisa ativar este módulo no Dashboard.",
                ephemeral: true
            });
        }

        if (guildData.poker.channel && guildData.poker.channel !== interaction.channelId) {
            return interaction.reply({
                content: `🚫 **Canal Incorreto!**\nO Poker só pode ser jogado no canal <#${guildData.poker.channel}>.`,
                ephemeral: true
            });
        }
        // -----------------------------------

        const subcommand = interaction.options.getSubcommand();

        // Central panel
        if (subcommand === "central") {
            await interaction.deferReply();
            return pokerCentral.execute(interaction);
        }

        const buyIn = interaction.options.getInteger("bet");
        const maxPlayers = interaction.options.getInteger("players") || 8;
        const channelId = interaction.channelId;
        const guildId = interaction.guildId;

        if (activeTables.has(channelId)) {
            return interaction.reply({ content: "⚠️ Já existe uma mesa ativa neste canal!", ephemeral: true });
        }

        // --- ECONOMY CHECK (HOST) ---
        let user = await UserModel.findOne({ codigouser: interaction.user.id, idguild: guildId });
        if (!user) {
            user = await UserModel.create({ codigouser: interaction.user.id, username: interaction.user.username, idguild: guildId });
        }

        if (user.money < buyIn) {
            return interaction.reply({ content: `🚫 **Saldo Insuficiente!**\nVocê precisa de ${buyIn} moedas para entrar. Seu saldo: ${user.money}`, ephemeral: true });
        }

        // Deduct Buy-in
        user.money -= buyIn;
        await user.save();
        // ----------------------------

        // Initialize Table
        const table = new PokerTable(interaction.user.id, channelId, maxPlayers, buyIn);
        table.guildId = guildId;
        activeTables.set(channelId, table);

        // Add Host
        table.addPlayer(interaction.user);

        // Setup AI for Solo
        if (subcommand === "solo") {
            table.addPlayer({ id: "AI_BOT", username: "🤖 Dealer Bot" }, true);
            // Solo starts immediately or requires 'Start' button? 
            // Usually Solo starts immediately.
            await this.startGame(interaction, table);
            return;
        }

        // Multiplayer Lobby
        const embed = new EmbedBuilder()
            .setTitle("♣️♠️ Poker Texas Hold'em ♥️♦️")
            .setDescription(`**Host**: ${interaction.user}\n**Buy-in**: ${buyIn} moedas\n**Jogadores**: 1/${maxPlayers}`)
            .setColor("#2f3136")
            .addFields(
                { name: "Jogadores", value: `${interaction.user.username}`, inline: true },
                { name: "📜 Como Jogar", value: "1. Receba 2 cartas secretas.\n2. Aposte, Pague ou Desista a cada rodada.\n3. Forme a melhor mão de 5 cartas com a mesa!\n**Vence a melhor mão no Showdown!**", inline: false }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("poker_join").setLabel("Entrar").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("poker_start").setLabel("Iniciar").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("poker_leave").setLabel("Sair").setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row] });

        // Collector for Lobby
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

        collector.on('collect', async i => {
            if (!activeTables.has(channelId)) return;
            const currentTable = activeTables.get(channelId); // Refresh ref

            if (i.customId === 'poker_join') {
                // Race condition protection: Check if already processing
                if (!currentTable.joiningPlayers) currentTable.joiningPlayers = new Set();
                if (currentTable.joiningPlayers.has(i.user.id)) {
                    return i.reply({ content: "⏳ Aguarde, sua entrada está sendo processada...", ephemeral: true });
                }
                currentTable.joiningPlayers.add(i.user.id);

                try {
                    const UserModel = mongoose.model("Users");
                    let user = await UserModel.findOne({ codigouser: i.user.id, idguild: guildId });
                    if (!user) user = await UserModel.create({ codigouser: i.user.id, username: i.user.username, idguild: guildId });

                    if (user.money < currentTable.buyIn) {
                        currentTable.joiningPlayers.delete(i.user.id);
                        return i.reply({ content: `🚫 **Saldo Insuficiente!**\nVocê precisa de ${currentTable.buyIn} moedas.`, ephemeral: true });
                    }

                    const res = currentTable.addPlayer(i.user);
                    if (res === true) {
                        user.money -= currentTable.buyIn;
                        await user.save();
                        await i.reply({ content: "Você entrou na mesa! (Buy-in debitado)", ephemeral: true });
                    } else if (res === 'INVITE_ONLY') {
                        await i.reply({ content: "⛔ Esta mesa é privada.", ephemeral: true });
                    } else {
                        await i.reply({ content: "Não foi possível entrar (Mesa cheia ou já dentro).", ephemeral: true });
                    }
                } finally {
                    currentTable.joiningPlayers.delete(i.user.id);
                }
                // Update Embed
                this.updateLobbyEmbed(i, currentTable);
            }

            if (i.customId === 'poker_leave') {
                if (i.user.id === currentTable.hostId) {
                    // Host leaving
                    activeTables.delete(channelId);
                    collector.stop();

                    // Refund everyone
                    const UserModel = mongoose.model("Users");
                    for (const p of currentTable.players) {
                        // Skip AI
                        if (p.isAI) continue;
                        const u = await UserModel.findOne({ codigouser: p.id, idguild: guildId });
                        if (u) {
                            u.money += currentTable.buyIn;
                            await u.save();
                        }
                    }
                    return i.reply({ content: "🚪 A mesa foi desfeita pelo Host. Buy-ins reembolsados.", ephemeral: false });
                }

                const res = currentTable.removePlayer(i.user.id);
                if (res) {
                    // Refund
                    const UserModel = mongoose.model("Users");
                    const user = await UserModel.findOne({ codigouser: i.user.id, idguild: guildId });
                    if (user) {
                        user.money += currentTable.buyIn;
                        await user.save();
                    }
                    await i.reply({ content: "Você saiu da mesa. (Buy-in reembolsado)", ephemeral: true });
                    this.updateLobbyEmbed(i, currentTable);
                } else {
                    await i.reply({ content: "Você não está nesta mesa.", ephemeral: true });
                }
            }

            if (i.customId === 'poker_start') {
                if (i.user.id !== currentTable.hostId) return i.reply({ content: "Apenas o Host pode iniciar.", ephemeral: true });
                if (currentTable.players.length < 2) return i.reply({ content: "Precisa de pelo menos 2 jogadores!", ephemeral: true });

                collector.stop();
                await this.startGame(i, currentTable);
            }
        });
    },

    async updateLobbyEmbed(interaction, table) {
        const embed = new EmbedBuilder()
            .setTitle("♣️♠️ Poker Texas Hold'em ♥️♦️")
            .setDescription(`**Host**: <@${table.hostId}>\n**Buy-in**: ${table.buyIn} moedas\n**Jogadores**: ${table.players.length}/${table.maxPlayers}`)
            .setColor("#2f3136")
            .addFields({ name: "Jogadores", value: table.players.map(p => p.name).join("\n") });

        // Edit original message
        await interaction.message.edit({ embeds: [embed] });
    },

    async startGame(interaction, table) {
        if (!table.startRound()) return interaction.followUp("Erro ao iniciar round.");

        // Initial Message
        const channel = interaction.channel;
        let msg = null;
        if (interaction.replied) {
            msg = await interaction.followUp({ content: "🎲 **O Jogo Começou!**", ...this.renderTable(table) });
        } else {
            msg = await interaction.reply({ content: "🎲 **O Jogo Começou!**", ...this.renderTable(table), fetchReply: true });
        }

        // Game Loop Collector
        const gameCollector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 600000 });

        gameCollector.on('collect', async i => {
            if (!table.players.find(p => p.id === i.user.id)) return i.reply({ content: "Você não está jogando!", ephemeral: true });

            // View Cards (Private)
            if (i.customId === 'poker_cards') {
                const player = table.players.find(p => p.id === i.user.id);
                return i.reply({
                    content: `Suas Cartas: ${player.hand.map(c => c.toString()).join(" ")}`,
                    ephemeral: true
                });
            }

            // Turn Logic
            const turnPlayer = table.players[table.turnIndex];
            if (i.user.id !== turnPlayer.id) return i.reply({ content: `Não é sua vez! Vez de: ${turnPlayer.name}`, ephemeral: true });

            // Handle Actions
            // Stop previous timer if any action attempts to execute
            if (['poker_fold', 'poker_call', 'poker_raise'].includes(i.customId)) {
                if (table.turnTimer) clearTimeout(table.turnTimer);
            }

            let result = null;
            if (i.customId === 'poker_fold') {
                result = table.handleAction(i.user.id, 'fold');
            } else if (i.customId === 'poker_call') {
                result = table.handleAction(i.user.id, 'call');
            } else if (i.customId === 'poker_raise') {
                // Determine Raise Options
                const rowRaise = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("raise_50").setLabel("+50").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("raise_100").setLabel("+100").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("raise_200").setLabel("+200").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId("raise_all").setLabel("ALL-IN 🚀").setStyle(ButtonStyle.Danger)
                );

                const raiseMsg = await i.reply({ content: "💲 **Quanto você quer aumentar?**", components: [rowRaise], ephemeral: true, fetchReply: true });

                // Temp Collector for Raise
                const filterRaise = (btn) => btn.user.id === i.user.id;
                try {
                    const collected = await raiseMsg.awaitMessageComponent({ filter: filterRaise, time: 15000, componentType: ComponentType.Button });

                    let amount = 0;
                    if (collected.customId === 'raise_50') amount = 50;
                    if (collected.customId === 'raise_100') amount = 100;
                    if (collected.customId === 'raise_200') amount = 200;
                    if (collected.customId === 'raise_all') amount = 'all';

                    result = table.handleAction(i.user.id, 'raise', amount);

                    if (result && result.action !== 'error') {
                        // Success
                        await collected.update({ content: "✅ Aposta realizada!", components: [] });
                    } else {
                        // Error (insufficient funds etc)
                        await collected.update({ content: `🚫 ${result ? result.message : "Erro desconhecido"}`, components: [] });
                        // Do not proceed to update table or next turn if error
                        return;
                    }
                } catch (e) {
                    await i.editReply({ content: "⏱️ Tempo esgotado para aumentar.", components: [] });
                    return;
                }
            }

            if (result) {
                if (result.action === 'error') {
                    // Should trigger if direct action failed (fold/call), raise is handled above
                    await i.reply({ content: `🚫 ${result.message}`, ephemeral: true });
                    return;
                } else {
                    table.addLog(result.message);
                    // For raise, we already updated the interaction inside logic? 
                    // No, for fold/call 'i' is the original interaction.
                    // For raise, 'collected' was updated. 'i' is already replied to.
                    // So we just need to update the ORIGINAL msg (Game Table).
                    // The loop below handles 'msg.edit' via handleNextTurn IF result is valid.

                    // BUT: For Call/Fold, we used 'i.deferUpdate()' or 'i.reply'.
                    // If Raise happened, 'i' is replied.

                    if (i.customId !== 'poker_raise') {
                        await i.deferUpdate(); // Defer fold/call
                    }
                }
            } else {
                if (i.customId !== 'poker_cards' && i.customId !== 'poker_raise') await i.deferUpdate();
            }

            // Next Turn
            if (result) {
                this.handleNextTurn(table, gameCollector, msg);
            }
        });

        // Trigger first AI turn if needed or Start Timer for first player
        this.handleNextTurn(table, gameCollector, msg, true);
    },

    renderTable(table) {
        const communityString = table.communityCards.length > 0
            ? table.communityCards.map(c => c.toString()).join(" ")
            : "🂠 🂠 🂠 🂠 🂠";

        const turnPlayer = table.players[table.turnIndex];

        const logs = table.logs.length > 0 ? table.logs.join("\n") : "*Nenhuma ação ainda*";
        const callCost = table.currentBet - turnPlayer.currentBet;
        const callLabel = callCost > 0 ? `Pagar ${callCost}` : "Pedir Mesa";
        const callEmoji = callCost > 0 ? "💸" : "👊";

        const embed = new EmbedBuilder()
            .setTitle("Mesa de Poker")
            .setColor("#006400")
            .setDescription(`**Vez de**: ${turnPlayer.name} ${turnPlayer.isAI ? "🤖" : ""}\n\n**📜 Histórico Recente**\n${logs}`)
            .addFields(
                { name: "Comunitárias", value: communityString, inline: false },
                { name: "Pote", value: `${table.pot} 💰`, inline: true },
                { name: "Aposta Atual", value: `${table.currentBet}`, inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("poker_call").setLabel(`${callLabel}`).setEmoji(callEmoji).setStyle(callCost > 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("poker_raise").setLabel("Aumentar").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("poker_fold").setLabel("Desistir").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("poker_cards").setLabel("Minhas Cartas").setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [embed], components: [row] };
    },

    async handleNextTurn(table, collector, msg, firstTurn = false) {
        // Stop previous timer
        if (table.turnTimer) clearTimeout(table.turnTimer);

        // Logic: Move to next player (unless firstTurn flag)
        if (!firstTurn) {
            table.turnIndex = (table.turnIndex + 1) % table.players.length;
        }

        // Skip folded/all-in players?
        // Actually, All-in players don't act, but they are part of the game.
        // Folded players are skipped.
        let attempts = 0;
        const startIdx = table.turnIndex;
        while ((table.players[table.turnIndex].folded || table.players[table.turnIndex].chips === 0) && attempts < table.players.length) {
            // But if they are all-in (chips=0), they don't act, so skipping is correct for *turning*, 
            // but we must ensure we don't skip checkRoundComplete checks if everyone is all-in.
            // For now, simple skip.
            table.turnIndex = (table.turnIndex + 1) % table.players.length;
            attempts++;
        }

        // Check if only one player remains (everyone else folded)
        const activePlayers = table.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
            // Last player standing wins the pot
            const winner = activePlayers[0];
            collector.stop();
            activeTables.delete(table.channelId);

            // Award pot to winner
            if (!winner.isAI) {
                const UserModel = mongoose.model("Users");
                const user = await UserModel.findOne({ codigouser: winner.id, idguild: table.guildId });
                if (user) {
                    user.money += table.pot;
                    await user.save();
                }
            }

            const winEmbed = new EmbedBuilder()
                .setTitle("🏆 Vitória por Desistência!")
                .setDescription(`**${winner.name}** venceu! Todos os outros jogadores desistiram.`)
                .addFields(
                    { name: "Pote Ganho", value: `${table.pot} 💰`, inline: true }
                )
                .setColor("#FFD700")
                .setFooter({ text: "Use /poker start para jogar novamente!" });

            return msg.edit({ embeds: [winEmbed], components: [] });
        }

        // Check if Round is Complete
        // Logic: consistently check after every turn if the betting round is over.
        if (table.checkRoundComplete()) {
            const state = table.nextStage();
            if (state === 'SHOWDOWN') {
                collector.stop();
                activeTables.delete(table.channelId);
                const winners = table.resolveShowdown();
                const allResults = table.getShowdownResults();

                // Format winners - only use splitAmount (already calculated in resolveShowdown)
                await Promise.all(winners.map(async (w) => {
                    if (!w.player.isAI && w.splitAmount > 0) {
                        const UserModel = mongoose.model("Users");
                        const user = await UserModel.findOne({ codigouser: w.player.id, idguild: table.guildId });
                        if (user) {
                            user.money += w.splitAmount;
                            await user.save();
                        }
                    }
                }));

                // Build Final Summary
                const summaryText = allResults.map((r, i) => {
                    if (r.status === 'FOLDED') {
                        return `❌ **${r.player.name}** - Desistiu`;
                    }
                    const isWinner = winners.find(w => w.player.id === r.player.id);

                    // Logic: If it is a winner, use Trophy.
                    // If not, use position (i + 1)º. 
                    // Since the list is now perfectly sorted by strength, 'i' is the true rank.
                    const prefix = isWinner ? "🏆" : `${i + 1}º`;
                    const winText = isWinner ? ` **(+${isWinner.splitAmount || table.pot} 💰)**` : "";

                    return `${prefix} **${r.player.name}** - ${r.hand.name} (${r.hand.cards.map(c => c.toString()).join(' ')})${winText}`;
                }).join("\n");

                const winEmbed = new EmbedBuilder()
                    .setTitle("🏆 Showdown! - Fim de Jogo")
                    .setDescription(`**Resultado Final:**\n${summaryText}`)
                    .addFields(
                        { name: "Cartas da Mesa", value: table.communityCards.map(c => c.toString()).join(" ") || "Nenhuma" },
                        { name: "Pote Final", value: `${table.pot} 💰` }
                    )
                    .setColor("#FFD700")
                    .setFooter({ text: "Use /poker start para jogar novamente!" });

                return msg.edit({ embeds: [winEmbed], components: [] });
            }
            // If just next stage (Flop/Turn/River), skip folded players and continue
            // nextStage already skips folded players for turnIndex, but double-check here
            let skipAttempts = 0;
            while ((table.players[table.turnIndex].folded || table.players[table.turnIndex].chips === 0) && skipAttempts < table.players.length) {
                table.turnIndex = (table.turnIndex + 1) % table.players.length;
                skipAttempts++;
            }
        }

        // Update UI
        await msg.edit(this.renderTable(table));

        // AFK Timer for Human
        const currentPlayer = table.players[table.turnIndex];
        if (!currentPlayer.isAI && !currentPlayer.folded && currentPlayer.chips > 0) {
            table.turnTimer = setTimeout(async () => {
                table.addLog(`⏳ **${currentPlayer.name}** demorou muito! (Auto-Fold)`);
                table.handleAction(currentPlayer.id, 'fold');
                this.handleNextTurn(table, collector, msg);
            }, 45000); // 45s Timeout
        }

        // Process AI
        this.processAI(table, collector, msg);
    },

    async processAI(table, collector, msg) {
        const currentPlayer = table.players[table.turnIndex];
        if (currentPlayer.isAI && !currentPlayer.folded) {
            setTimeout(async () => {
                const result = table.processAITurn();
                if (result) {
                    table.addLog(`🤖 ${result.message}`);
                }
                this.handleNextTurn(table, collector, msg);
            }, 2000); // 2s delay for realism
        }
    }
};
