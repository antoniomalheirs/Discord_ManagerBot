const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType } = require("discord.js");
const mongoose = require("mongoose");
const UserSchema = require("../../database/schemas/UserSchema");

if (!mongoose.models.Users) {
    mongoose.model("Users", UserSchema);
}

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
                money: 0
            });
            await userData.save();
        }

        const buildMainEmbed = () => {
            return new EmbedBuilder()
                .setTitle("♠️ Central do Poker")
                .setColor("#1ABC9C")
                .setThumbnail(interaction.user.displayAvatarURL())
                .setDescription("**Texas Hold'em** - O clássico jogo de cartas!\n\nEscolha um modo de jogo:")
                .addFields(
                    { name: "💵 Seu Saldo", value: `$${(userData.money || 0).toLocaleString()}`, inline: true },
                    { name: "🏆 Vitórias", value: `${userData.pokerWins || 0}`, inline: true },
                    { name: "📊 Partidas", value: `${userData.pokerGames || 0}`, inline: true }
                )
                .setFooter({ text: "Expira em 2 min" });
        };

        const mainButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("poker_multiplayer").setLabel("👥 Multiplayer (2-8)").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("poker_solo").setLabel("🤖 Contra o Bot").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("poker_rules").setLabel("📜 Regras").setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.editReply({
            embeds: [buildMainEmbed()],
            components: [mainButtons]
        });

        let selectedMode = null;
        let betAmount = 100;

        const collector = response.createMessageComponentCollector({
            time: 120000,
            filter: i => i.user.id === userId
        });

        collector.on('collect', async i => {
            try {
                const freshUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });

                // Multiplayer
                if (i.customId === "poker_multiplayer") {
                    selectedMode = "multiplayer";

                    const embed = new EmbedBuilder()
                        .setTitle("👥 Poker Multiplayer")
                        .setColor("#3498DB")
                        .setDescription("Crie uma mesa para até 8 jogadores!\n\n**Buy-in**: Valor mínimo para entrar.\nQuem não tiver saldo suficiente não pode entrar.")
                        .addFields({ name: "💵 Seu Saldo", value: `$${(freshUser.money || 0).toLocaleString()}`, inline: true });

                    const betButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("mp_100").setLabel("$100").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("mp_500").setLabel("$500").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("mp_1000").setLabel("$1.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("mp_5000").setLabel("$5.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("mp_custom").setLabel("📝 Outro").setStyle(ButtonStyle.Success)
                    );

                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("poker_create").setLabel("🎲 Criar Mesa").setStyle(ButtonStyle.Success).setDisabled((freshUser.money || 0) < 100),
                        new ButtonBuilder().setCustomId("poker_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [embed], components: [betButtons, actionRow] });
                }

                // Solo
                if (i.customId === "poker_solo") {
                    selectedMode = "solo";

                    const embed = new EmbedBuilder()
                        .setTitle("🤖 Poker vs Bot")
                        .setColor("#9B59B6")
                        .setDescription("Jogue contra a IA!\n\nO bot jogará de forma inteligente baseado nas cartas.")
                        .addFields({ name: "💵 Seu Saldo", value: `$${(freshUser.money || 0).toLocaleString()}`, inline: true });

                    const betButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("solo_100").setLabel("$100").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("solo_500").setLabel("$500").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("solo_1000").setLabel("$1.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("solo_5000").setLabel("$5.000").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("solo_custom").setLabel("📝 Outro").setStyle(ButtonStyle.Success)
                    );

                    const actionRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("poker_start_solo").setLabel("🎲 Iniciar Partida").setStyle(ButtonStyle.Success).setDisabled((freshUser.money || 0) < 100),
                        new ButtonBuilder().setCustomId("poker_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [embed], components: [betButtons, actionRow] });
                }

                // Bet selection
                if (i.customId.startsWith("mp_") || i.customId.startsWith("solo_")) {
                    const parts = i.customId.split("_");
                    if (parts[1] === "custom") {
                        const modal = new ModalBuilder()
                            .setCustomId("poker_bet_modal")
                            .setTitle("💰 Definir Buy-in");

                        const input = new TextInputBuilder()
                            .setCustomId("bet_value")
                            .setLabel("Valor do buy-in")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setPlaceholder("Ex: 2500");

                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        await i.showModal(modal);
                        return;
                    }

                    betAmount = parseInt(parts[1]);
                    await i.reply({ content: `✅ Buy-in definido: **$${betAmount.toLocaleString()}**`, ephemeral: true });
                }

                // Create Multiplayer Game
                if (i.customId === "poker_create") {
                    if ((freshUser.money || 0) < betAmount) {
                        return i.reply({ content: `❌ Saldo insuficiente! Precisa de $${betAmount.toLocaleString()}`, ephemeral: true });
                    }

                    collector.stop();

                    // Redirect to existing poker start command
                    await i.reply({
                        content: `🎲 **Mesa Criada!**\n\nUse o comando:\n\`/poker start bet:${betAmount}\`\n\nOu peça para outros jogadores clicarem no botão de Entrar que aparecerá.`,
                        ephemeral: true
                    });
                }

                // Start Solo Game
                if (i.customId === "poker_start_solo") {
                    if ((freshUser.money || 0) < betAmount) {
                        return i.reply({ content: `❌ Saldo insuficiente! Precisa de $${betAmount.toLocaleString()}`, ephemeral: true });
                    }

                    collector.stop();

                    await i.reply({
                        content: `🎲 **Iniciando Partida Solo!**\n\nUse o comando:\n\`/poker solo bet:${betAmount}\``,
                        ephemeral: true
                    });
                }

                // Rules
                if (i.customId === "poker_rules") {
                    const rulesEmbed = new EmbedBuilder()
                        .setTitle("📜 Regras do Texas Hold'em")
                        .setColor("#F1C40F")
                        .setDescription(`
**🃏 O Jogo**
Cada jogador recebe 2 cartas. 5 cartas comunitárias são reveladas.
Forme a melhor mão de 5 cartas!

**🏆 Ranking de Mãos** (maior → menor)
1. Royal Flush - A K Q J 10 mesmo naipe
2. Straight Flush - Sequência do mesmo naipe
3. Quadra - 4 cartas iguais
4. Full House - Trinca + Par
5. Flush - 5 cartas do mesmo naipe
6. Sequência - 5 cartas em ordem
7. Trinca - 3 cartas iguais
8. Dois Pares
9. Par
10. Carta Alta

**💰 Ações**
- **Check** - Passar sem apostar
- **Bet/Raise** - Apostar/Aumentar
- **Call** - Igualar aposta
- **Fold** - Desistir da mão
                        `);

                    const backRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("poker_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [rulesEmbed], components: [backRow] });
                }

                // Back
                if (i.customId === "poker_back") {
                    selectedMode = null;
                    await i.update({ embeds: [buildMainEmbed()], components: [mainButtons] });
                }

            } catch (e) {
                console.error("Erro na central poker:", e);
            }
        });

        // Modal handler
        const modalHandler = async (modalInteraction) => {
            if (!modalInteraction.isModalSubmit()) return;
            if (modalInteraction.customId !== "poker_bet_modal") return;
            if (modalInteraction.user.id !== userId) return;

            const value = parseInt(modalInteraction.fields.getTextInputValue("bet_value"));
            if (isNaN(value) || value < 10) {
                return modalInteraction.reply({ content: "❌ Valor inválido! Mínimo: $10", ephemeral: true });
            }
            betAmount = value;
            await modalInteraction.reply({ content: `✅ Buy-in definido: **$${betAmount.toLocaleString()}**`, ephemeral: true });
        };

        interaction.client.on('interactionCreate', modalHandler);

        collector.on('end', () => {
            interaction.client.removeListener('interactionCreate', modalHandler);
        });
    }
};
