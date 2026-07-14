const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, PermissionsBitField } = require("discord.js");
const mongoose = require("mongoose");
const UserSchema = require("../../database/schemas/UserSchema");
const { COLORS, SEP } = require("../../utils/EmbedStyle");

if (!mongoose.models.Users) {
    mongoose.model("Users", UserSchema);
}

module.exports = {
    async execute(interaction) {
        // PERMISSION CHECK
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: "❌ Apenas administradores podem acessar o Painel de Controle.", ephemeral: true });
        }

        const buildMainEmbed = () => {
            const guild = interaction.guild;
            return new EmbedBuilder()
                .setTitle("🛡️ Painel Admin Central")
                .setColor(COLORS.ADMIN)
                .setThumbnail(guild.iconURL())
                .setDescription(`${SEP}\nBem-vindo, Administrador **${interaction.user.username}**.\nControle total do servidor em suas mãos.\n${SEP}`)
                .addFields(
                    { name: "👥 Membros", value: `${guild.memberCount}`, inline: true },
                    { name: "🤖 Ping Bot", value: `${interaction.client.ws.ping}ms`, inline: true },
                    { name: "📅 Criado em", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:d>`, inline: true }
                )
                .setFooter({ text: "Use os botões abaixo para gerenciar." });
        };

        const mainButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("admin_money").setLabel("💰 Gerir Saldo").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("admin_clear").setLabel("🧹 Limpar Chat").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("admin_reset").setLabel("🔄 Resetar User").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("admin_broadcast").setLabel("📢 Broadcast").setStyle(ButtonStyle.Primary)
        );

        const response = await interaction.reply({
            embeds: [buildMainEmbed()],
            components: [mainButtons],
            ephemeral: true, // Admin panel should be private usually
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            time: 300000, // 5 min
            filter: i => i.user.id === interaction.user.id
        });

        // State variables
        let selectedAction = null;
        let selectedUser = null;

        collector.on('collect', async i => {
            try {
                // === MONEY MANAGEMENT ===
                if (i.customId === "admin_money") {
                    selectedAction = "money";
                    const userSelect = new UserSelectMenuBuilder()
                        .setCustomId("admin_user_select")
                        .setPlaceholder("👤 Selecione o usuário para editar saldo");

                    const rowUser = new ActionRowBuilder().addComponents(userSelect);
                    const rowBack = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("admin_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({
                        embeds: [new EmbedBuilder().setTitle("💰 Gestão Financeira").setDescription("Selecione um usuário para adicionar ou remover dinheiro.").setColor("#F1C40F")],
                        components: [rowUser, rowBack]
                    });
                }

                // === CLEAR CHAT ===
                if (i.customId === "admin_clear") {
                    selectedAction = "clear";
                    const clearEmbed = new EmbedBuilder()
                        .setTitle("🧹 Limpeza de Chat")
                        .setDescription("Quantas mensagens deseja apagar?")
                        .setColor("#E74C3C");

                    const clearButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("clear_10").setLabel("Apagar 10").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("clear_50").setLabel("Apagar 50").setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId("clear_100").setLabel("Apagar 100").setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId("admin_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Success)
                    );

                    await i.update({ embeds: [clearEmbed], components: [clearButtons] });
                }

                if (i.customId.startsWith("clear_")) {
                    const amount = parseInt(i.customId.split("_")[1]);
                    await i.channel.bulkDelete(amount, true).catch(err => {
                        i.followUp({ content: `❌ Erro ao apagar: ${err.message}`, ephemeral: true });
                    });

                    // Success feedback
                    await i.update({
                        content: `✅ **${amount} mensagens apagadas!**`,
                        embeds: [],
                        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("admin_back").setLabel("⬅️ Voltar ao Painel").setStyle(ButtonStyle.Primary))]
                    });
                }

                // === RESET USER ===
                if (i.customId === "admin_reset") {
                    selectedAction = "reset";
                    const userSelect = new UserSelectMenuBuilder()
                        .setCustomId("admin_user_select")
                        .setPlaceholder("👤 Selecione o usuário para RESETAR");

                    const rowUser = new ActionRowBuilder().addComponents(userSelect);
                    const rowBack = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("admin_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({
                        embeds: [new EmbedBuilder().setTitle("🔄 Reset de Conta").setDescription("⚠️ CUIDADO: Isso apagará TODO o progresso do usuário.").setColor("#95A5A6")],
                        components: [rowUser, rowBack]
                    });
                }

                // === BROADCAST ===
                if (i.customId === "admin_broadcast") {
                    const modal = new ModalBuilder()
                        .setCustomId("broadcast_modal")
                        .setTitle("📢 Enviar Anúncio");

                    const titleInput = new TextInputBuilder()
                        .setCustomId("broadcast_title")
                        .setLabel("Título")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const messageInput = new TextInputBuilder()
                        .setCustomId("broadcast_message")
                        .setLabel("Mensagem")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(titleInput),
                        new ActionRowBuilder().addComponents(messageInput)
                    );

                    await i.showModal(modal);
                }

                // === USER SELECTION HANDLER ===
                if (i.customId === "admin_user_select") {
                    const targetId = i.values[0];
                    selectedUser = i.users.get(targetId);
                    const UserModel = mongoose.model("Users");
                    const targetData = await UserModel.findOne({ codigouser: targetId, idguild: interaction.guildId });

                    if (selectedAction === "money") {
                        const moneyEmbed = new EmbedBuilder()
                            .setTitle(`💰 Editando: ${selectedUser.username}`)
                            .addFields(
                                { name: "Carteira", value: `$${(targetData?.money || 0).toLocaleString()}`, inline: true },
                                { name: "Banco", value: `$${(targetData?.bank || 0).toLocaleString()}`, inline: true }
                            )
                            .setColor("#F1C40F");

                        const moneyActions = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("money_add").setLabel("➕ Adicionar").setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId("money_remove").setLabel("➖ Remover").setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId("admin_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
                        );

                        await i.update({ embeds: [moneyEmbed], components: [moneyActions] });
                    }

                    if (selectedAction === "reset") {
                        const confirmEmbed = new EmbedBuilder()
                            .setTitle(`⚠️ Confirmar Reset: ${selectedUser.username}`)
                            .setDescription("Tem certeza? O usuário perderá Dinheiro, Cargo, Pets, TUDO.")
                            .setColor("#FF0000");

                        const confirmActions = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("reset_confirm").setLabel("✅ SIM, RESETAR").setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId("admin_back").setLabel("❌ CANCELAR").setStyle(ButtonStyle.Secondary)
                        );

                        await i.update({ embeds: [confirmEmbed], components: [confirmActions] });
                    }
                }

                // === MONEY ACTION HANDLERS ===
                if (i.customId === "money_add" || i.customId === "money_remove") {
                    const isAdd = i.customId === "money_add";
                    const modal = new ModalBuilder()
                        .setCustomId(`money_modal_${isAdd ? "add" : "remove"}`) // pass action in ID
                        .setTitle(isAdd ? "➕ Adicionar Dinheiro" : "➖ Remover Dinheiro");

                    const amountInput = new TextInputBuilder()
                        .setCustomId("amount")
                        .setLabel("Valor")
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("Ex: 10000")
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
                    await i.showModal(modal);
                }

                // === RESET CONFIRM ===
                if (i.customId === "reset_confirm") {
                    if (!selectedUser) return;
                    const UserModel = mongoose.model("Users");
                    await UserModel.findOneAndDelete({ codigouser: selectedUser.id, idguild: interaction.guildId });

                    await i.update({
                        content: `✅ Usuário **${selectedUser.username}** foi resetado com sucesso!`,
                        embeds: [],
                        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("admin_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Primary))]
                    });
                }

                // === BACK ===
                if (i.customId === "admin_back") {
                    selectedAction = null;
                    selectedUser = null;
                    await i.update({ embeds: [buildMainEmbed()], components: [mainButtons], content: null });
                }

            } catch (e) {
                console.error("Admin Error:", e);
                if (!i.replied && !i.deferred) i.reply({ content: "❌ Erro interno.", ephemeral: true }).catch(() => { });
            }
        });

        // === MODAL HANDLERS ===
        const modalHandler = async (modalInteraction) => {
            if (!modalInteraction.isModalSubmit()) return;
            if (modalInteraction.user.id !== interaction.user.id) return;

            // Money Modal
            if (modalInteraction.customId.startsWith("money_modal_")) {
                const action = modalInteraction.customId.split("_")[2]; // add or remove
                const amount = parseInt(modalInteraction.fields.getTextInputValue("amount"));

                if (isNaN(amount) || amount <= 0) return modalInteraction.reply({ content: "❌ Valor inválido.", ephemeral: true });

                const UserModel = mongoose.model("Users");
                const targetData = await UserModel.findOne({ codigouser: selectedUser.id, idguild: interaction.guildId }) || new UserModel({ codigouser: selectedUser.id, idguild: interaction.guildId, username: selectedUser.username });

                if (action === "add") {
                    targetData.money = (targetData.money || 0) + amount;
                } else {
                    targetData.money = Math.max(0, (targetData.money || 0) - amount);
                }
                await targetData.save();

                await modalInteraction.reply({ content: `✅ Saldo de **${selectedUser.username}** atualizado! Novo saldo: $${targetData.money.toLocaleString()}`, ephemeral: true });
            }

            // Broadcast Modal
            if (modalInteraction.customId === "broadcast_modal") {
                const title = modalInteraction.fields.getTextInputValue("broadcast_title");
                const msg = modalInteraction.fields.getTextInputValue("broadcast_message");

                const embed = new EmbedBuilder()
                    .setTitle(`📢 ${title}`)
                    .setDescription(msg)
                    .setColor("#3498DB")
                    .setTimestamp()
                    .setFooter({ text: `Enviado por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

                await interaction.channel.send({ embeds: [embed] });
                await modalInteraction.reply({ content: "✅ Broadcast enviado!", ephemeral: true });
            }
        };

        interaction.client.on('interactionCreate', modalHandler);
        collector.on('end', () => interaction.client.removeListener('interactionCreate', modalHandler));
    }
};
