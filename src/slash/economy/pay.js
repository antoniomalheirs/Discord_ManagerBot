const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");

module.exports = {
    async execute(interaction) {
        const targetUser = interaction.options.getUser("usuario");
        const amount = interaction.options.getInteger("valor");
        const senderId = interaction.user.id;
        const guildId = interaction.guildId;

        if (targetUser.id === senderId) return interaction.editReply("❌ Lavagem de dinheiro é crime. Você não pode transferir para si mesmo.");
        if (targetUser.bot) return interaction.editReply("❌ Robôs não precisam de dinheiro.");
        if (amount < 10) return interaction.editReply("❌ Transferência mínima de **$10**.");
        if (amount > 1000000) return interaction.editReply("❌ Transferência máxima de **$1.000.000** por vez.");

        const UserModel = mongoose.model("Users");

        let senderData = await UserModel.findOne({ codigouser: senderId, idguild: guildId });
        if (!senderData) {
            senderData = new UserModel({ username: interaction.user.username, codigouser: senderId, idguild: guildId, money: 0 });
        }

        if ((senderData.money || 0) < amount) {
            return interaction.editReply(`💸 **Saldo Insuficiente!**\nVocê tem **$${(senderData.money || 0).toLocaleString()}**, mas tentou enviar **$${amount.toLocaleString()}**.`);
        }

        // ATOMIC TRANSACTION: Both operations succeed or both fail
        // Using bulkWrite to ensure atomicity
        const bulkOps = [
            {
                updateOne: {
                    filter: { codigouser: senderId, idguild: guildId, money: { $gte: amount } },
                    update: { $inc: { money: -amount } }
                }
            },
            {
                updateOne: {
                    filter: { codigouser: targetUser.id, idguild: guildId },
                    update: {
                        $inc: { money: amount },
                        $setOnInsert: { username: targetUser.username, codigouser: targetUser.id, idguild: guildId }
                    },
                    upsert: true
                }
            }
        ];

        const result = await UserModel.bulkWrite(bulkOps);

        // Check if sender update succeeded (money >= amount check passed)
        if (result.modifiedCount < 1) {
            return interaction.editReply(`💸 **Saldo Insuficiente!** A transferência falhou. Tente novamente.`);
        }

        // LOG LOGIC
        try {
            const GuildModel = mongoose.model("Guilds");
            // Assuming Guilds schema is available/loaded. If not, catch block will handle.
            // In main index.js, DatabaseLoader loads models.
            const guildData = await GuildModel.findOne({ guildID: guildId });

            if (guildData && guildData.logging && guildData.logging.economy_log && guildData.logging.economy_log.state) {
                const logChannelId = guildData.logging.economy_log.channel;
                const logChannel = interaction.guild.channels.cache.get(logChannelId);

                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle("💰 Log de Transferência")
                        .setColor("#00FF00")
                        .addFields(
                            { name: "De", value: `${interaction.user.tag} (ID: ${senderId})`, inline: true },
                            { name: "Para", value: `${targetUser.tag} (ID: ${targetUser.id})`, inline: true },
                            { name: "Valor", value: `$${amount.toLocaleString()}`, inline: false }
                        )
                        .setTimestamp();
                    logChannel.send({ embeds: [logEmbed] });
                }
            }
        } catch (e) {
            console.error("Erro ao enviar log:", e);
        }

        const embed = new EmbedBuilder()
            .setTitle("💸 Transferência Concluída")
            .setColor("#00FF00")
            .addFields(
                { name: "De", value: `<@${senderId}>`, inline: true },
                { name: "Para", value: `<@${targetUser.id}>`, inline: true },
                { name: "Valor", value: `**$${amount.toLocaleString()}**`, inline: false }
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};
