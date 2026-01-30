const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const UsersRepository = require("../../database/mongoose/UsersRepository");
const UserSchema = require("../../database/schemas/UserSchema");

if (!mongoose.models.Users) {
    mongoose.model("Users", UserSchema);
}

module.exports = {
    async execute(interaction) {
        try {
            const targetUser = interaction.options.getUser("user") || interaction.user;
            const userId = targetUser.id;

            const projection = {
                codigouser: 1,
                voiceTime: 1,
                totalMessages: 1,
            };

            const userRepo = new UsersRepository(mongoose, "Users");
            // Fixed: Now filters by guildId to get correct server data
            const userData = await userRepo.getByUserIdAndGuildId(userId, interaction.guildId, projection);

            const totalMessages = userData?.totalMessages || 0;
            const totalVoiceTime = userData?.voiceTime || 0;

            // Get Member object from guild to check roles etc.
            const member = interaction.guild.members.cache.get(userId) || await interaction.guild.members.fetch(userId).catch(() => null);

            if (!member) return interaction.editReply({ content: "Usuário não encontrado no servidor." });

            const userRoles = member.roles.cache
                .filter((role) => role.name !== "@everyone")
                .map((role) => role.name)
                .join(", ") || "Nenhum cargo";

            const userJoinDate = member.joinedAt
                ? member.joinedAt.toLocaleDateString("pt-BR")
                : "Não disponível";

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setAuthor({
                    name: `${targetUser.username}`,
                    iconURL: targetUser.displayAvatarURL({ dynamic: true }),
                })
                .setTitle("📊 Informações do Usuário")
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 1024 }))
                .addFields(
                    { name: "👤 Usuário", value: `${targetUser}`, inline: true },
                    { name: "🆔 ID", value: `\`${targetUser.id}\``, inline: true },
                    { name: "📅 Entrada no servidor", value: userJoinDate, inline: false },
                    { name: "🏷️ Cargos", value: userRoles, inline: false },
                    { name: "💬 Mensagens enviadas", value: `${totalMessages.toLocaleString("pt-BR")}`, inline: true },
                    { name: "🎙️ Tempo em voz", value: `${totalVoiceTime.toLocaleString("pt-BR")} minutos`, inline: true },
                )
                .setFooter({
                    text: `Solicitado por ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                })
                .setTimestamp();

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error("Erro ao obter informações do usuário:", error);
            const errorMsg = { content: "⚠️ Ocorreu um erro ao buscar informações.", ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorMsg);
            } else {
                await interaction.editReply(errorMsg);
            }
        }
    },
};
