const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports = {
    async execute(interaction) {
        // Categorias manuais atualizadas
        const categorias = {
            'Economia 💰': ['economy'],
            'Cassino 🎰': ['casino'],
            'Administração 🛠️': ['admin'],
            'Informação ℹ️': ['info'],
            'Diversão 🎉': ['fun']
        };

        const embed = new EmbedBuilder()
            .setTitle("📘 Central de Ajuda")
            .setDescription("Selecione uma categoria abaixo para ver os sistemas.")
            .setColor("#5865F2")
            .setThumbnail(interaction.client.user.displayAvatarURL());

        const select = new StringSelectMenuBuilder()
            .setCustomId('help_category')
            .setPlaceholder('Escolha uma categoria')
            .addOptions(
                Object.keys(categorias).map(cat => ({
                    label: cat,
                    value: cat,
                    description: `Comandos de ${cat}`
                }))
            );

        const row = new ActionRowBuilder().addComponents(select);

        const response = await interaction.editReply({
            embeds: [embed],
            components: [row],
            withResponse: true
        });

        const filter = i => i.customId === 'help_category' && i.user.id === interaction.user.id;
        const collector = response.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            const categoriaEscolhida = i.values[0];
            const mainCommands = categorias[categoriaEscolhida];

            let desc = "";

            if (categoriaEscolhida.includes("Economia")) {
                desc = "`central` (Painel Completo), `balance`, `pay`, `deposit`, `withdraw`\nUse `/economy <subcomando>`";
            } else if (categoriaEscolhida.includes("Cassino")) {
                desc = "`central` (Jogos), `welcome`, `recover`\nUse `/casino <subcomando>`";
            } else if (categoriaEscolhida.includes("Poker")) {
                desc = "`central` (Mesa/Solo/Regras)\nUse `/poker central` (Recomendado)";
            } else if (categoriaEscolhida.includes("Administração")) {
                desc = "`central` (Painel Admin), `clear`\nUse `/admin central`";
            } else if (categoriaEscolhida.includes("Informação")) {
                desc = "`user`, `help`\nUse `/info <opção>`";
            } else if (categoriaEscolhida.includes("Diversão")) {
                desc = "Comandos de diversão em breve!";
            }

            const categoriaEmbed = new EmbedBuilder()
                .setTitle(`📂 ${categoriaEscolhida}`)
                .setDescription(desc || "Nenhuma informação disponível.")
                .setColor("#5865F2");

            await i.update({ embeds: [categoriaEmbed], components: [row] });
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                select.setDisabled(true)
            );
            interaction.editReply({ components: [disabledRow] }).catch(() => { });
        });
    },
};
