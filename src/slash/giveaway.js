const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const ms = require("ms");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("🎁 Sistema de Sorteios")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("start")
        .setDescription("🎉 Inicia um sorteio")
        .addStringOption(opt => opt.setName("tempo").setDescription("Duração (ex: 10m, 1h, 1d)").setRequired(true))
        .addStringOption(opt => opt.setName("premio").setDescription("Prêmio do sorteio").setRequired(true))
        .addIntegerOption(opt => opt.setName("vencedores").setDescription("Número de vencedores (padrão: 1)").setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName("reroll")
        .setDescription("🔄 Sorteia outro vencedor para um sorteio anterior")
        .addStringOption(opt => opt.setName("mensagem_id").setDescription("ID da mensagem do sorteio").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("end")
        .setDescription("🛑 Encerra um sorteio antecipadamente")
        .addStringOption(opt => opt.setName("mensagem_id").setDescription("ID da mensagem do sorteio").setRequired(true))
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const GiveawayModel = mongoose.model("Giveaways", require("../../database/schemas/GiveawaySchema"));

    if (subcommand === "start") {
      const tempoStr = interaction.options.getString("tempo");
      const premio = interaction.options.getString("premio");
      const vencedoresCount = interaction.options.getInteger("vencedores") || 1;

      const duration = ms(tempoStr);
      if (!duration) return interaction.reply({ content: "❌ Duração inválida. Use formatos como 10m, 1h, 1d.", ephemeral: true });

      const endAt = Date.now() + duration;

      const embed = new EmbedBuilder()
        .setTitle("🎉 SORTEIO: " + premio)
        .setDescription(`Clique em 🎉 para participar!\n\n**Vencedores:** ${vencedoresCount}\n**Termina em:** <t:${Math.floor(endAt / 1000)}:R>\n**Hospedado por:** ${interaction.user}`)
        .setColor("#FF00FF");

      const message = await interaction.channel.send({ embeds: [embed] });
      await message.react("🎉");

      const giveaway = new GiveawayModel({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageId: message.id,
        prize: premio,
        winnersCount: vencedoresCount,
        hostId: interaction.user.id,
        endAt: endAt
      });
      await giveaway.save();

      return interaction.reply({ content: "✅ Sorteio iniciado com sucesso!", ephemeral: true });
    }

    if (subcommand === "end" || subcommand === "reroll") {
      const messageId = interaction.options.getString("mensagem_id");
      const giveaway = await GiveawayModel.findOne({ messageId: messageId, guildId: interaction.guildId });

      if (!giveaway) return interaction.reply({ content: "❌ Sorteio não encontrado no banco de dados.", ephemeral: true });

      if (subcommand === "end" && giveaway.ended) {
        return interaction.reply({ content: "❌ Este sorteio já acabou.", ephemeral: true });
      }

      if (subcommand === "reroll" && !giveaway.ended) {
        return interaction.reply({ content: "❌ Este sorteio ainda não terminou.", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: subcommand === "end" });

      try {
        const channel = await interaction.client.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(giveaway.messageId);
        
        const reaction = message.reactions.cache.get("🎉");
        if (!reaction) throw new Error("Reação não encontrada");

        const users = await reaction.users.fetch();
        const validUsers = users.filter(u => !u.bot).map(u => u.id);

        if (validUsers.length === 0) {
          giveaway.ended = true;
          await giveaway.save();
          const failEmbed = new EmbedBuilder().setTitle("🎉 Sorteio Encerrado").setDescription(`Ninguém participou do sorteio de **${giveaway.prize}**.\n\n**Vencedor:** Ninguém`).setColor("#2F3136");
          await message.edit({ embeds: [failEmbed] });
          return interaction.followUp("Ninguém participou do sorteio.");
        }

        const winners = [];
        for (let i = 0; i < Math.min(giveaway.winnersCount, validUsers.length); i++) {
          const randomIndex = Math.floor(Math.random() * validUsers.length);
          winners.push(validUsers[randomIndex]);
          validUsers.splice(randomIndex, 1);
        }

        const winnersStr = winners.map(id => `<@${id}>`).join(", ");

        if (subcommand === "end") {
          giveaway.ended = true;
          await giveaway.save();
          const winEmbed = new EmbedBuilder().setTitle("🎉 Sorteio Encerrado").setDescription(`Parabéns aos vencedores do sorteio de **${giveaway.prize}**!\n\n**Vencedores:** ${winnersStr}`).setColor("#00FF00");
          await message.edit({ embeds: [winEmbed] });
          await message.reply(`🎉 Parabéns ${winnersStr}! Vocês ganharam **${giveaway.prize}**!`);
          return interaction.followUp("Sorteio encerrado antecipadamente.");
        } else {
          await message.reply(`🔄 **Reroll:** O novo vencedor para **${giveaway.prize}** é ${winnersStr}! Parabéns!`);
          return interaction.followUp("Reroll realizado com sucesso.");
        }
      } catch (err) {
        console.error(err);
        return interaction.followUp("❌ Erro ao processar o sorteio. A mensagem pode ter sido apagada.");
      }
    }
  }
};
