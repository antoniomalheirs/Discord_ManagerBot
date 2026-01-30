const { EmbedBuilder } = require("discord.js");

module.exports = {
    async execute(interaction) {
        try {
            const quantidade = interaction.options.getInteger("quant");

            if (quantidade < 1 || quantidade > 100) {
                return interaction.editReply({
                    content: "❌ Forneça um número entre **1** e **100**."
                });
            }

            // await interaction.deferReply({ ephemeral: true }); // Handled in admin.js

            const canal = interaction.channel;
            const mensagens = await canal.messages.fetch({ limit: quantidade + 1 });
            const mensagensValidas = mensagens.filter(
                msg => Date.now() - msg.createdTimestamp < 1209600000 // 14 dias em ms
            );

            if (mensagensValidas.size < 1) {
                return interaction.editReply("⚠️ **Aviso:** O Discord não permite apagar mensagens com mais de 14 dias.");
            }

            const deleted = await canal.bulkDelete(mensagensValidas, true);

            const embed = new EmbedBuilder()
                .setColor("#2ecc71")
                .setDescription(`🧹 **Limpeza Concluída!**\n\nForam removidas **${deleted.size}** mensagens.`);

            await interaction.editReply({ embeds: [embed] });

            setTimeout(() => interaction.deleteReply().catch(() => { }), 5000);

        } catch (error) {
            console.error("Erro ao limpar canal:", error);
            return interaction.editReply({
                content: "❌ Ocorreu um erro ao tentar limpar mensagens.",
                flags: 64,
            });
        }
    },
};
