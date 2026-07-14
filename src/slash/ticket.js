const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("🎫 Sistema de Tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub =>
      sub.setName("setup")
        .setDescription("🛠️ Configura o painel de tickets neste canal.")
    )
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("➕ Adiciona um membro ao ticket atual.")
        .addUserOption(opt => opt.setName("usuario").setDescription("O usuário para adicionar").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("➖ Remove um membro do ticket atual.")
        .addUserOption(opt => opt.setName("usuario").setDescription("O usuário para remover").setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      const embed = new EmbedBuilder()
        .setTitle("🎫 Central de Atendimento")
        .setDescription("Precisa de ajuda? Clique no botão abaixo para abrir um ticket e falar com nossa equipe.")
        .setColor("#3498DB");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_open")
          .setLabel("Abrir Ticket")
          .setEmoji("🎟️")
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: "Painel de tickets configurado com sucesso!", ephemeral: true });
    }

    if (subcommand === "add") {
      const user = interaction.options.getUser("usuario");
      const channel = interaction.channel;

      if (!channel.name.startsWith("ticket-")) {
        return interaction.reply({ content: "❌ Este comando só pode ser usado em um canal de ticket.", ephemeral: true });
      }

      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      return interaction.reply({ content: `✅ ${user} foi adicionado ao ticket.` });
    }

    if (subcommand === "remove") {
      const user = interaction.options.getUser("usuario");
      const channel = interaction.channel;

      if (!channel.name.startsWith("ticket-")) {
        return interaction.reply({ content: "❌ Este comando só pode ser usado em um canal de ticket.", ephemeral: true });
      }

      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false
      });

      return interaction.reply({ content: `✅ ${user} foi removido do ticket.` });
    }
  }
};
