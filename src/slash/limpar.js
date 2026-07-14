const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { COLORS, success, error, warning } = require("../utils/EmbedStyle");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("limpar")
    .setDescription("🧹 Apaga mensagens de um canal (Apenas Administradores).")
    .addIntegerOption((option) =>
      option
        .setName("quantidade")
        .setDescription("Número de mensagens a serem apagadas (1 a 100)")
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        embeds: [error("Acesso Negado", "Você não tem permissão para usar este comando. (Requer: `Gerenciar Mensagens`)")],
        ephemeral: true, 
      });
    }

    const quantidade = interaction.options.getInteger("quantidade");

    if (quantidade < 1 || quantidade > 100) {
      return interaction.reply({
        embeds: [warning("Atenção", "Por favor, insira um número entre **1 e 100**.")],
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });

      const canal = interaction.channel;
      const mensagens = await canal.messages.fetch({ limit: quantidade + 1 });

      const mensagensValidas = mensagens.filter(
          msg => Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
      );

      if (mensagensValidas.size < 1) {
          return interaction.editReply({
            embeds: [warning("Nenhuma Mensagem Apagada", "Não haviam mensagens recentes (menores que 14 dias) para apagar.")]
          });
      }

      await canal.bulkDelete(mensagensValidas, true);

      return interaction.editReply({
        embeds: [success("Limpeza Concluída", `🧹 **${mensagensValidas.size}** mensagens foram apagadas com sucesso!`)],
      });

    } catch (err) {
      console.error("Erro ao limpar mensagens:", err);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          embeds: [error("Erro na Limpeza", "Ocorreu um erro ao tentar apagar as mensagens.")],
        });
      } else {
        return interaction.reply({
          embeds: [error("Erro na Limpeza", "Ocorreu um erro ao tentar apagar as mensagens.")],
          ephemeral: true
        });
      }
    }
  },
};
