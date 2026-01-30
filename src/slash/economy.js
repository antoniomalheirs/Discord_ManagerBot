const { SlashCommandBuilder } = require("discord.js");

const bank = require("./economy/bank");
const pay = require("./economy/pay");
const central = require("./economy/central");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("economy")
        .setDescription("🏦 Sistema Financeiro e de Carreira")
        // === CENTRAL ===
        .addSubcommand(sub =>
            sub.setName("central").setDescription("🎮 Painel central interativo (RECOMENDADO)")
        )
        // === BANK ===
        .addSubcommand(sub =>
            sub.setName("balance").setDescription("💰 Ver saldo e rendimentos.")
        )
        .addSubcommand(sub =>
            sub.setName("deposit")
                .setDescription("📥 Depositar dinheiro.")
                .addStringOption(opt => opt.setName("valor").setDescription("Valor ou 'all'").setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName("withdraw")
                .setDescription("📤 Sacar dinheiro.")
                .addStringOption(opt => opt.setName("valor").setDescription("Valor ou 'all'").setRequired(true))
        )
        // === PAY ===
        .addSubcommand(sub =>
            sub.setName("pay")
                .setDescription("💸 Transferir dinheiro.")
                .addUserOption(opt => opt.setName("usuario").setDescription("Para quem?").setRequired(true))
                .addIntegerOption(opt => opt.setName("valor").setDescription("Quanto?").setRequired(true).setMinValue(1))
        ),

    async execute(interaction) {
        // Autocomplete is seemingly unused now for the kept commands
        // So we can remove autocomplete method or keep empty if needed by handler?
        // Client handler checks: if (interaction.isAutocomplete()) { const command = ...; if (!command) ...; try { await command.autocomplete(interaction); } }
        // If I remove it, and interaction matches, it might error if client tries to call it?
        // Client usually checks `if (command.autocomplete)` before calling.
        // So safe to remove.

        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "central") return central.execute(interaction);
        if (subcommand === "balance" || subcommand === "deposit" || subcommand === "withdraw") return bank.execute(interaction);
        if (subcommand === "pay") return pay.execute(interaction);
    }
};
