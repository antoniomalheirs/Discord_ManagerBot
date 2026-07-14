const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { COLORS } = require("../utils/EmbedStyle");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rollingdice")
    .setDescription("🎲 Role os dados!")
    .addIntegerOption((option) =>
      option.setName("lados").setDescription("Número de lados do dado (padrão 6)").setRequired(false)
    ),
  async execute(interaction) {
    try {
      const sides = interaction.options.getInteger("lados") || 6;
      const result = Math.floor(Math.random() * sides) + 1;

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle("🎲 Dado Rolado!")
        .setDescription(`Você rolou um dado de **${sides}** lados e tirou: **${result}**`)
        .setFooter({
          text: `Solicitado por ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      console.error("Erro no comando rolling_dice:", error);
      await interaction.reply({
        content: "Houve um erro ao tentar rolar o dado.",
        ephemeral: true,
      });
    }
  },
};