const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("enquete")
    .setDescription("📊 Cria uma enquete usando o sistema nativo do Discord.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt => opt.setName("pergunta").setDescription("Qual é a pergunta?").setRequired(true))
    .addStringOption(opt => opt.setName("opcao1").setDescription("Primeira opção").setRequired(true))
    .addStringOption(opt => opt.setName("opcao2").setDescription("Segunda opção").setRequired(true))
    .addStringOption(opt => opt.setName("opcao3").setDescription("Terceira opção").setRequired(false))
    .addStringOption(opt => opt.setName("opcao4").setDescription("Quarta opção").setRequired(false))
    .addStringOption(opt => opt.setName("opcao5").setDescription("Quinta opção").setRequired(false))
    .addIntegerOption(opt => opt.setName("duracao").setDescription("Duração em horas (padrão 24)").setRequired(false).setMinValue(1).setMaxValue(720))
    .addBooleanOption(opt => opt.setName("multipla").setDescription("Permitir múltipla escolha?").setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString("pergunta");
    const duracao = interaction.options.getInteger("duracao") || 24;
    const multipla = interaction.options.getBoolean("multipla") || false;

    const answers = [];
    for (let i = 1; i <= 5; i++) {
      const opt = interaction.options.getString(`opcao${i}`);
      if (opt) {
        answers.push({ text: opt });
      }
    }

    try {
      await interaction.reply({
        content: "📊 **Nova Enquete!** Vote abaixo:",
        poll: {
          question: { text: question },
          answers: answers,
          duration: duracao,
          allowMultiselect: multipla
        }
      });
    } catch (err) {
      console.error(err);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "❌ Ocorreu um erro ao criar a enquete. Verifique se o bot tem permissão.", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ Ocorreu um erro ao criar a enquete.", ephemeral: true });
      }
    }
  }
};
