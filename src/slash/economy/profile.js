const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const BACKGROUNDS = require("../../utils/backgrounds");

module.exports = {
    async execute(interaction) {
        // Subcommand: shop, buy, set
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const UserModel = mongoose.model("Users");
        let userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });

        if (!userData) {
            userData = new UserModel({
                username: interaction.user.username,
                codigouser: userId,
                idguild: guildId,
                money: 0
            });
            await userData.save();
        }

        if (subcommand === "shop") {
            const embed = new EmbedBuilder()
                .setTitle("🛒 Loja de Perfis Mágicos")
                .setColor("#9B59B6")
                .setDescription("Use `/economy profile buy id:<id>` para comprar.\nUse `/economy profile set id:<id>` para equipar.")
                .setFooter({ text: `Seu saldo: ${userData.money} moedas` });

            let desc = "";
            for (const [key, bg] of Object.entries(BACKGROUNDS)) {
                if (key === 'default') continue;
                desc += `**${bg.name}** (\`${key}\`)\n💰 ${bg.price} moedas\n[Ver Imagem](${bg.url})\n\n`;
            }
            embed.setDescription(desc);

            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === "buy") {
            const id = interaction.options.getString("id");
            const bg = BACKGROUNDS[id];

            if (!bg) return interaction.editReply({ content: "❌ Fundo não encontrado." });

            // Atomic update to prevent duplicate purchases
            const result = await UserModel.findOneAndUpdate(
                {
                    codigouser: userId,
                    idguild: guildId,
                    ownedBackgrounds: { $nin: [id] },  // Only if not already owned
                    money: { $gte: bg.price }            // Only if has enough money
                },
                {
                    $inc: { money: -bg.price },
                    $push: { ownedBackgrounds: id }
                },
                { new: true }
            );

            if (!result) {
                // Check why it failed
                const freshData = await UserModel.findOne({ codigouser: userId, idguild: guildId });
                if (freshData?.ownedBackgrounds?.includes(id)) {
                    return interaction.editReply({ content: "✅ Você já possui este fundo!" });
                }
                return interaction.editReply({ content: `💸 Dinheiro insuficiente! Preço: ${bg.price} | Você tem: ${freshData?.money || 0}` });
            }

            return interaction.editReply(`🎉 **Sucesso!** Você comprou o fundo **${bg.name}**! Use \`/economy profile set ${id}\` para usar.`);
        }

        if (subcommand === "set") {
            const id = interaction.options.getString("id");

            if (!BACKGROUNDS[id]) return interaction.editReply({ content: "❌ Fundo inexistente." });

            if (!userData.ownedBackgrounds.includes(id)) {
                return interaction.editReply({ content: "🔒 Você não tem este fundo! Compre na loja primeiro." });
            }

            userData.background = id;
            await userData.save();

            return interaction.editReply(`🎨 **Perfil atualizado!** Seu fundo de Rank agora é **${BACKGROUNDS[id].name}**.`);
        }
    }
};
