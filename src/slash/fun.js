// Importa os construtores necessários do discord.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { COLORS } = require("../utils/EmbedStyle");

const VIBRANT_COLORS = [COLORS.PRIMARY, COLORS.SUCCESS, COLORS.WARNING, COLORS.ECONOMY, COLORS.CASINO, COLORS.INFO, COLORS.RANK];

module.exports = {
  // Configuração do comando
  data: new SlashCommandBuilder()
    .setName("fun")
    .setDescription("🎮 Um comando divertido aleatório!"),

  // Lógica de execução do comando
  async execute(interaction) {
    try {
      const phrases = [
        "Por que o livro de matemática se suicidou? Porque tinha muitos problemas.",
        "O que o zero disse para o oito? Belo cinto!",
        "Por que o computador foi ao médico? Porque estava com um vírus!",
        "Qual é o animal mais antigo? A zebra, porque está em preto e branco.",
        "Como as abelhas vão para a escola? De zumbinibus!",
      ];

      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      const randomColor = VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];

      // Cria um Embed para uma resposta visualmente mais interessante
      const embed = new EmbedBuilder()
        .setColor(randomColor)
        .setTitle("🎉 Diversão Garantida!")
        .setDescription(randomPhrase)
        .setFooter({
          text: `Solicitado por ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      // Responde à interação com o embed
      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      // Em caso de erro, loga no console e avisa o usuário de forma privada
      console.error("Erro ao executar o comando /fun:", error);
      await interaction.reply({
        content: "Ops! O saco de piadas rasgou. Tente novamente mais tarde.",
        ephemeral: true, // A mensagem só será visível para quem usou o comando
      });
    }
  },
};