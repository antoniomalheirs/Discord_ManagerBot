const { SlashCommandBuilder } = require("discord.js");
const user = require("./info/user");
const help = require("./info/help");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("info")
        .setDescription("ℹ️ Centro de Informações")
        .addSubcommand(sub =>
            sub.setName("user")
                .setDescription("👤 Ver informações de um usuário.")
                .addUserOption(opt => opt.setName("user").setDescription("Usuário (opcional)"))
        )
        .addSubcommand(sub =>
            sub.setName("help")
                .setDescription("❓ Lista de comandos.")
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "user") return user.execute(interaction);
        if (subcommand === "help") return help.execute(interaction);
    }
};
