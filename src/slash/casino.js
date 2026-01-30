const { SlashCommandBuilder } = require("discord.js");
const mongoose = require("mongoose");
const UserSchema = require("../database/schemas/UserSchema");

if (!mongoose.models.Users) {
    mongoose.model("Users", UserSchema);
}

const casinoCentral = require("./casino/central");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("casino")
        .setDescription("🎰 Cassino Cômico & Hardcore")
        // === CENTRAL ===
        .addSubcommand(sub =>
            sub.setName("central").setDescription("🎮 Painel central interativo (RECOMENDADO)")
        )
        // === CORE ===
        .addSubcommand(sub =>
            sub.setName("welcome")
                .setDescription("🎁 Resgate seu bônus inicial (3k). Apenas UMA vez.")
        )
        .addSubcommand(sub =>
            sub.setName("recover")
                .setDescription("💸 Declare falência (Reseta tudo para 500 moedas).")
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const UserModel = mongoose.model("Users");
        let userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });

        // Inicializa se não existir
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

        // Central panel
        if (subcommand === "central") {
            await interaction.deferReply();
            return casinoCentral.execute(interaction);
        }

        // --- WELCOME ---
        if (subcommand === "welcome") {
            if (userData.welcomeClaimed) {
                return interaction.reply({ content: "❌ Bônus já resgatado! Vai trabalhar.", ephemeral: true });
            }
            userData.money = (userData.money || 0) + 3000;
            userData.welcomeClaimed = true;
            await userData.save();
            return interaction.reply({ content: "🎁 **Bônus de $3.000 resgatado!** Boa sorte!", ephemeral: true });
        }

        // --- RECOVER ---
        if (subcommand === "recover") {
            const totalAssets = (userData.money || 0) + (userData.bank || 0);
            if (totalAssets > 100) {
                return interaction.reply({ content: `❌ Você tem **$${totalAssets.toLocaleString()}**! Falência é só pra quem tá zerado (menos de $100).`, ephemeral: true });
            }
            userData.money = 500;
            userData.bank = 0;
            userData.energy = 50;
            await userData.save();
            return interaction.reply({ content: "💸 **Falência declarada!** Prepare-se para recomeçar com $500.", ephemeral: true });
        }
    }
};
