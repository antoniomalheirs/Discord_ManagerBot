const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

// Logic
const clear = require("./admin/clear");
const adminCentral = require("./admin/central");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("admin")
        .setDescription("🛠️ Painel de Administração")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // === CENTRAL ===
        .addSubcommand(sub =>
            sub.setName("central").setDescription("🛡️ Painel de Controle Interativo (RECOMENDADO)")
        )
        // === CLEAR ===
        .addSubcommand(sub =>
            sub.setName("clear")
                .setDescription("🧹 Limpar mensagens.")
                .addIntegerOption(opt => opt.setName("quant").setDescription("Quantidade (1-100)").setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "central") {
            // Central handles its own reply (ephemeral usually)
            // But execute logic in central.js uses interaction.reply
            // We should NOT defer here if central.js executes reply.
            return adminCentral.execute(interaction);
        }

        if (subcommand === "clear") {
            await interaction.deferReply({ ephemeral: true });
            return clear.execute(interaction);
        }
    }
};
