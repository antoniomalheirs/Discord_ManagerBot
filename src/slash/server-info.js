const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const { COLORS, SEP, formatMoney } = require("../utils/EmbedStyle");
const UserSchema = require("../database/schemas/UserSchema");
if (!mongoose.models.Users) mongoose.model("Users", UserSchema);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("📊 Mostra informações detalhadas sobre o servidor."),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const guild = interaction.guild;

      const serverName = guild.name;
      const serverIcon = guild.iconURL({ dynamic: true, size: 1024 });
      const serverCreationDate = `<t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`;
      const totalMembers = guild.memberCount;
      const totalChannels = guild.channels.cache.size;
      const boostCount = guild.premiumSubscriptionCount || 0;
      const boostTier = guild.premiumTier || 0;
      const emojiCount = guild.emojis.cache.size;

      // Estatísticas armazenadas no banco usando Aggregation para melhor performance
      const totalServerStats = await getTotalServerStats(guild.id);

      // Construindo o embed
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`📌 Informações do servidor: ${serverName}`)
        .setThumbnail(serverIcon)
        .setDescription(`${SEP}`)
        .addFields(
          { name: "📅 Criado em", value: serverCreationDate, inline: false },
          { name: "👥 Membros", value: `${totalMembers.toLocaleString()}`, inline: true },
          { name: "📂 Canais", value: `${totalChannels}`, inline: true },
          { name: "😊 Emojis", value: `${emojiCount}`, inline: true },
          { name: "✨ Boosts", value: `Nível ${boostTier} (${boostCount} boosts)`, inline: false },
          { name: "💬 Mensagens Registradas", value: `${formatMoney(totalServerStats.totalMessages).replace('$', '')}`, inline: true },
          { name: "🎙️ Tempo em Voz", value: `${formatMoney(totalServerStats.totalVoiceTime).replace('$', '')} minutos`, inline: true },
        )
        .setFooter({ text: `ID do Servidor: ${guild.id}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("Erro ao obter informações do servidor:", error);
      const { error: errorEmbed } = require("../utils/EmbedStyle");
      await interaction.editReply({
        embeds: [errorEmbed("Erro", "Ocorreu um erro ao obter informações do servidor.")]
      });
    }
  },
};

async function getTotalServerStats(guildId) {
  try {
    const UserModel = mongoose.model("Users");
    const result = await UserModel.aggregate([
      { $match: { idguild: guildId } },
      { $group: { _id: null, totalMessages: { $sum: "$totalMessages" }, totalVoiceTime: { $sum: "$voiceTime" } } }
    ]);

    if (result.length > 0) {
        return { totalVoiceTime: result[0].totalVoiceTime || 0, totalMessages: result[0].totalMessages || 0 };
    }
  } catch (error) {
    console.error("Erro ao obter informações de usuários do banco via aggregate:", error);
  }

  return { totalVoiceTime: 0, totalMessages: 0 };
}
