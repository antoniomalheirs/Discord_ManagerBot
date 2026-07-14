const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildSchema = require("../database/schemas/GuildSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slots")
    .setDescription("🎰 Gire as máquinas e tente ganhar o Jackpot!")
    .addIntegerOption(opt => opt.setName("aposta").setDescription("Valor da aposta").setRequired(true).setMinValue(10)),

  async execute(interaction) {
    const aposta = interaction.options.getInteger("aposta");
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const UserModel = mongoose.model("Users");
    const GuildModel = mongoose.models.Guilds || mongoose.model("Guilds", GuildSchema);

    let userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });
    if (!userData || (userData.money || 0) < aposta) {
      return interaction.reply({ content: "❌ Dinheiro insuficiente na carteira para esta aposta.", ephemeral: true });
    }

    let guildData = await GuildModel.findOne({ guildID: guildId });
    if (!guildData) {
      guildData = new GuildModel({ guildID: guildId });
      await guildData.save();
    }
    if (!guildData.casino) guildData.casino = { jackpot: 0 };

    // Deduct bet and contribute 5% to Jackpot
    userData.money -= aposta;
    const jackpotContrib = Math.ceil(aposta * 0.05);
    guildData.casino.jackpot += jackpotContrib;

    const fruits = ["🍒", "🍋", "🍇", "🍉", "⭐", "🔔", "💎", "7️⃣"];
    
    // Odds:
    // 7️⃣ is jackpot
    // 💎 is 10x
    // ⭐ is 5x
    // Others are 2x if 3 of a kind

    const spin = () => fruits[Math.floor(Math.random() * fruits.length)];
    
    let r1 = spin(), r2 = spin(), r3 = spin();

    // Pequena manipulação para dar emoção de vez em quando
    if (Math.random() < 0.1) { r2 = r1; r3 = r1; }

    let multiplier = 0;
    let wonJackpot = false;

    if (r1 === r2 && r2 === r3) {
      if (r1 === "7️⃣") wonJackpot = true;
      else if (r1 === "💎") multiplier = 10;
      else if (r1 === "⭐") multiplier = 5;
      else multiplier = 2;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      multiplier = 0.5; // Consolation prize
    }

    let resultMsg = "";
    let winAmount = 0;

    if (wonJackpot) {
      winAmount = guildData.casino.jackpot;
      resultMsg = `🏆 **JACKPOT!!!** Você ganhou **$${winAmount.toLocaleString()}**!`;
      guildData.casino.jackpot = 0; // Reset
    } else if (multiplier > 0) {
      winAmount = Math.floor(aposta * multiplier);
      resultMsg = `🎉 Você ganhou **$${winAmount.toLocaleString()}** (x${multiplier})!`;
    } else {
      resultMsg = `😢 Você perdeu **$${aposta.toLocaleString()}**...`;
    }

    userData.money += winAmount;

    await userData.save();
    await guildData.save();

    const embed = new EmbedBuilder()
      .setTitle("🎰 Slot Machine")
      .setColor(wonJackpot ? "#FFD700" : multiplier > 0 ? "#2ECC71" : "#E74C3C")
      .setDescription(`**[ ${r1} | ${r2} | ${r3} ]**\n\n${resultMsg}\n\n💰 Jackpot Atual: **$${guildData.casino.jackpot.toLocaleString()}**`)
      .setFooter({ text: `Seu novo saldo: $${userData.money.toLocaleString()}` });

    await interaction.reply({ embeds: [embed] });
  }
};
