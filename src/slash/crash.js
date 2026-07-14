const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const mongoose = require("mongoose");
const GuildSchema = require("../database/schemas/GuildSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("crash")
    .setDescription("📈 Jogo do Foguetinho (Crash). Saia antes que exploda!")
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

    userData.money -= aposta;
    await userData.save();

    let multiplier = 1.0;
    let crashed = false;
    let cashedOut = false;
    
    // Calcula o crash point antecipadamente (entre 1.0 e 10.0, maioria quebra rápido)
    const crashPoint = Math.max(1.0, (100 / (Math.random() * 100 + 1)).toFixed(2));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("crash_cashout")
        .setLabel("💰 CASH OUT!")
        .setStyle(ButtonStyle.Success)
    );

    const embed = new EmbedBuilder()
      .setTitle("🚀 Crash - Foguetinho")
      .setColor("#3498DB")
      .setDescription(`Aposta: **$${aposta}**\n\nMultiplicador: **${multiplier.toFixed(2)}x**`);

    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = message.createMessageComponentCollector({ filter: i => i.user.id === userId, time: 30000 });

    collector.on("collect", async i => {
      if (i.customId === "crash_cashout") {
        cashedOut = true;
        collector.stop("cashout");
        
        const winnings = Math.floor(aposta * multiplier);
        userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });
        userData.money += winnings;
        await userData.save();

        const winEmbed = new EmbedBuilder()
          .setTitle("🚀 Crash - CASH OUT!")
          .setColor("#2ECC71")
          .setDescription(`Aposta: **$${aposta}**\n\n🎉 Você sacou em **${multiplier.toFixed(2)}x** e ganhou **$${winnings}**!`);
        
        await i.update({ embeds: [winEmbed], components: [] });
      }
    });

    const interval = setInterval(async () => {
      if (cashedOut || crashed) {
        clearInterval(interval);
        return;
      }

      multiplier += 0.2;

      if (multiplier >= crashPoint) {
        crashed = true;
        clearInterval(interval);
        collector.stop("crashed");

        // Perdeu, adiciona 50% ao Jackpot
        let guildData = await GuildModel.findOne({ guildID: guildId });
        if (guildData) {
          if (!guildData.casino) guildData.casino = { jackpot: 0 };
          guildData.casino.jackpot += Math.floor(aposta * 0.50);
          await guildData.save();
        }

        const crashEmbed = new EmbedBuilder()
          .setTitle("💥 CRASHED!")
          .setColor("#E74C3C")
          .setDescription(`O foguete explodiu em **${crashPoint}x**!\nVocê perdeu **$${aposta}**.`);

        await interaction.editReply({ embeds: [crashEmbed], components: [] }).catch(()=>{});
        return;
      }

      const updateEmbed = new EmbedBuilder()
        .setTitle("🚀 Crash - Foguetinho")
        .setColor("#3498DB")
        .setDescription(`Aposta: **$${aposta}**\n\nMultiplicador: **${multiplier.toFixed(2)}x**`);

      await interaction.editReply({ embeds: [updateEmbed], components: [row] }).catch(()=>{});
    }, 1500);
  }
};
