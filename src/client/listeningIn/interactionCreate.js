const { Events } = require("discord.js");
const discordBot = require("../../Client");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const commands = discordBot.getCommands();

    // 1. Chat Input Command
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);

      if (!command) {
        console.error(
          `Não existe nenhum comando com nome de: ${interaction.commandName}`
        );
        return;
      }

      try {
        console.log(`Executando comando: ${command.data.name}`);
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "Erro ao executar comando",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "Erro ao executar comando",
            ephemeral: true,
          });
        }
      }
      return;
    }

    // 2. Autocomplete
    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;

      try {
        if (command.autocomplete) {
          await command.autocomplete(interaction);
        }
      } catch (error) {
        console.error("Erro no autocomplete:", error);
      }
      return;
    }

    // 3. Buttons (Global Interceptors like Tickets)
    if (interaction.isButton()) {
      const mongoose = require("mongoose");
      const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
      
      if (interaction.customId === "ticket_open") {
        await interaction.deferReply({ ephemeral: true });
        const TicketModel = mongoose.model("Tickets", require("../../database/schemas/TicketSchema"));
        
        // Verifica se usuário já tem ticket aberto
        const existingTicket = await TicketModel.findOne({ guildId: interaction.guildId, userId: interaction.user.id, closed: false });
        if (existingTicket) {
          return interaction.followUp({ content: `❌ Você já possui um ticket aberto em <#${existingTicket.channelId}>!` });
        }

        const count = await TicketModel.countDocuments({ guildId: interaction.guildId });
        const ticketId = count + 1;
        
        const channelName = `ticket-${String(ticketId).padStart(4, "0")}`;
        
        try {
          const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: interaction.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
              },
              {
                id: interaction.client.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
              }
            ],
          });

          const ticketDoc = new TicketModel({
            guildId: interaction.guildId,
            channelId: channel.id,
            userId: interaction.user.id,
            ticketId: ticketId
          });
          await ticketDoc.save();

          const embed = new EmbedBuilder()
            .setTitle(`Ticket #${ticketId}`)
            .setDescription(`Olá ${interaction.user}, a equipe logo irá te atender. Descreva seu problema.\nPara fechar o ticket, clique no botão abaixo.`)
            .setColor("#E74C3C");

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_close_${ticketDoc._id}`)
              .setLabel("Fechar Ticket")
              .setStyle(ButtonStyle.Danger)
          );

          await channel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
          await interaction.followUp({ content: `✅ Ticket criado em ${channel}` });
        } catch (err) {
          console.error(err);
          await interaction.followUp({ content: "❌ Ocorreu um erro ao criar seu ticket." });
        }
      }

      if (interaction.customId.startsWith("ticket_close_")) {
        await interaction.deferReply();
        const ticketDbId = interaction.customId.split("_")[2];
        const TicketModel = mongoose.model("Tickets", require("../../database/schemas/TicketSchema"));
        
        const ticketDoc = await TicketModel.findById(ticketDbId);
        if (!ticketDoc || ticketDoc.closed) return interaction.followUp("Este ticket já está fechado.");

        // Gera transcript básico (ultimas 100 mensagens)
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const transcriptText = messages.reverse().map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`).join("\n");
        const transcriptBuffer = Buffer.from(transcriptText, "utf-8");
        const attachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${ticketDoc.ticketId}.txt` });

        // Envia o transcript para a DM de quem fechou ou criador (opcional)
        try {
          const user = await interaction.client.users.fetch(ticketDoc.userId);
          await user.send({ content: `Seu ticket #${ticketDoc.ticketId} foi fechado. Aqui está o histórico:`, files: [attachment] });
        } catch(e) { }

        ticketDoc.closed = true;
        await ticketDoc.save();

        await interaction.followUp("O ticket será deletado em 5 segundos...");
        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 5000);
      }
    }
  },
};
