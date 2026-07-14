const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { COLORS, SEP, error } = require("../utils/EmbedStyle");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("👤 Mostra informações de um usuário.")
    .addUserOption((option) =>
      option.setName("usuario").setDescription("Usuário para ver informações").setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const user = interaction.options.getUser("usuario") || interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
          return interaction.editReply({ embeds: [error("Erro", "Não foi possível encontrar este usuário no servidor.")] });
      }

      const userName = user.username;
      const userTag = user.discriminator !== '0' ? `#${user.discriminator}` : '';
      const userAvatar = user.displayAvatarURL({ dynamic: true, size: 1024 });

      // Buscar banner se existir
      await user.fetch();
      const userBanner = user.bannerURL({ dynamic: true, size: 1024 });

      const joinedServer = `<t:${Math.floor(member.joinedTimestamp / 1000)}:D> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`;
      const accountCreated = `<t:${Math.floor(user.createdTimestamp / 1000)}:D> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`;

      const roles = member.roles.cache
        .filter((role) => role.name !== "@everyone")
        .map((role) => `<@&${role.id}>`)
        .join(", ");

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`👤 Informações de ${userName}${userTag}`)
        .setThumbnail(userAvatar)
        .setDescription(`${SEP}`)
        .addFields(
          { name: "📅 Conta Criada", value: accountCreated, inline: false },
          { name: "📥 Entrou no Servidor", value: joinedServer, inline: false },
          { name: `🎭 Cargos [${member.roles.cache.size - 1}]`, value: roles || "Nenhum cargo", inline: false }
        )
        .setFooter({ text: `ID do Usuário: ${user.id}` })
        .setTimestamp();

      if (userBanner) {
          embed.setImage(userBanner);
      }

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error("Erro no comando userinfo:", err);
      const errorMsg = { embeds: [error("Erro", "Ocorreu um erro ao obter informações do usuário.")] };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    }
  },
};
