const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const ITEMS = require("../../utils/items");
const PETS = require("../../utils/pets");

module.exports = {
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const UserModel = mongoose.model("Users");
        let userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });

        if (!userData) {
            userData = new UserModel({ username: interaction.user.username, codigouser: userId, idguild: guildId });
        }

        // --- VIEW SHOP ---
        if (subcommand === "view") {
            const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

            const embed = new EmbedBuilder()
                .setTitle("🏪 Loja de Utilidades")
                .setColor("#E67E22")
                .setDescription(`💰 Seu saldo: **$${(userData.money || 0).toLocaleString()}**\n\nSelecione um item no menu abaixo para comprar!`);

            for (const [key, item] of Object.entries(ITEMS)) {
                embed.addFields({
                    name: `${item.name} - $${item.price.toLocaleString()}`,
                    value: `📝 ${item.description}`,
                    inline: false
                });
            }

            embed.addFields({ name: "🐶 Pet Shop", value: "Companheiros fiéis:", inline: false });

            for (const [key, pet] of Object.entries(PETS)) {
                embed.addFields({
                    name: `${pet.name} - $${pet.price.toLocaleString()}`,
                    value: `🐾 ${pet.description}`,
                    inline: false
                });
            }

            // Build select menu with all items and pets
            const allProducts = [
                ...Object.entries(ITEMS).map(([k, v]) => ({ label: v.name, value: k, description: `$${v.price.toLocaleString()}`, emoji: "📦" })),
                ...Object.entries(PETS).map(([k, v]) => ({ label: v.name, value: k, description: `$${v.price.toLocaleString()}`, emoji: "🐾" }))
            ];

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId("shop_select")
                .setPlaceholder("🛒 Selecione um item para comprar...")
                .addOptions(allProducts.slice(0, 25)); // Discord limit

            const row1 = new ActionRowBuilder().addComponents(selectMenu);

            const response = await interaction.editReply({ embeds: [embed], components: [row1] });

            let selectedItem = null;

            const collector = response.createMessageComponentCollector({
                time: 60000,
                filter: i => i.user.id === userId
            });

            collector.on('collect', async i => {
                try {
                    if (i.customId === "shop_select") {
                        selectedItem = i.values[0];
                        const product = ITEMS[selectedItem] || PETS[selectedItem];

                        const confirmRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("shop_confirm").setLabel(`✅ Comprar ${product.name} ($${product.price.toLocaleString()})`).setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId("shop_cancel").setLabel("❌ Cancelar").setStyle(ButtonStyle.Secondary)
                        );

                        await i.update({ components: [row1, confirmRow] });
                    }

                    if (i.customId === "shop_confirm" && selectedItem) {
                        const product = ITEMS[selectedItem] || PETS[selectedItem];
                        const isPet = !!PETS[selectedItem];

                        // Re-fetch user data
                        const freshUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });

                        if ((freshUser.money || 0) < product.price) {
                            return i.reply({ content: `❌ Saldo insuficiente! Você precisa de $${product.price.toLocaleString()}.`, ephemeral: true });
                        }

                        // Check if already owns pet
                        if (isPet && (freshUser.pets || []).includes(selectedItem)) {
                            return i.reply({ content: `❌ Você já tem este pet!`, ephemeral: true });
                        }

                        // Process purchase
                        freshUser.money -= product.price;

                        if (isPet) {
                            freshUser.pets = freshUser.pets || [];
                            freshUser.pets.push(selectedItem);
                            freshUser.activePet = selectedItem; // Auto-equip
                        } else {
                            freshUser.inventory = freshUser.inventory || [];
                            freshUser.inventory.push(selectedItem);
                        }

                        await freshUser.save();

                        await i.reply({
                            content: `✅ **Compra realizada!**\n${isPet ? "🐾 Pet" : "📦 Item"}: **${product.name}**\n💰 Novo saldo: $${freshUser.money.toLocaleString()}${isPet ? "\n🎀 Pet equipado automaticamente!" : ""}`,
                            ephemeral: true
                        });

                        // Update balance in embed
                        const newEmbed = EmbedBuilder.from(embed)
                            .setDescription(`💰 Seu saldo: **$${freshUser.money.toLocaleString()}**\n\nSelecione um item no menu abaixo para comprar!`);
                        await interaction.editReply({ embeds: [newEmbed], components: [row1] });

                        selectedItem = null;
                    }

                    if (i.customId === "shop_cancel") {
                        selectedItem = null;
                        await i.update({ components: [row1] });
                    }
                } catch (e) {
                    console.error("Erro no shop:", e);
                }
            });

            collector.on('end', async () => {
                try {
                    const disabledSelect = StringSelectMenuBuilder.from(selectMenu).setDisabled(true);
                    const disabledRow = new ActionRowBuilder().addComponents(disabledSelect);
                    await interaction.editReply({ components: [disabledRow] }).catch(() => { });
                } catch (e) { }
            });

            return;
        }

        // --- INVENTORY ---
        if (subcommand === "inventory") {
            const userItems = userData.inventory || [];

            if (userItems.length === 0) {
                return interaction.editReply("🎒 Seu inventário está vazio. Compre algo no `/economy shop view`!");
            }

            // Count items
            const counts = {};
            userItems.forEach(i => { counts[i] = (counts[i] || 0) + 1; });

            const description = Object.entries(counts).map(([key, qty]) => {
                const itemDef = ITEMS[key];
                return itemDef ? `**${qty}x** ${itemDef.name}` : `**${qty}x** Item Desconhecido (${key})`;
            }).join("\n");

            const embed = new EmbedBuilder()
                .setTitle(`🎒 Inventário de ${interaction.user.username}`)
                .setColor("#2ECC71")
                .setDescription(description)
                .setFooter({ text: "Use /economy shop use <item> para usar." });

            return interaction.editReply({ embeds: [embed] });
        }

        // --- BUY ---
        if (subcommand === "buy") {
            const itemKey = interaction.options.getString("item");

            const item = ITEMS[itemKey];
            const pet = PETS[itemKey];

            const product = item || pet;

            if (!product) return interaction.editReply("❌ Item/Pet não encontrado.");
            if ((userData.money || 0) < product.price) return interaction.editReply(`💸 Você não tem **$${product.price}**. Volte quando for rico.`);

            userData.money -= product.price;

            if (pet) {
                // Initialize pets array if undefined
                if (!userData.pets) userData.pets = [];
                userData.pets.push(itemKey);
                if (!userData.activePet) userData.activePet = itemKey;
                await userData.save();
                return interaction.editReply(`🐶 Adotou **${product.name}** por **$${product.price}**! Cuide bem dele.`);
            } else {
                // Initialize inventory array if undefined
                if (!userData.inventory) userData.inventory = [];
                userData.inventory.push(itemKey);
                await userData.save();
                return interaction.editReply(`💳 Comprou **${product.name}** por **$${product.price}**!`);
            }
        }

        // --- USE ---
        if (subcommand === "use") {
            const itemKey = interaction.options.getString("item");
            const item = ITEMS[itemKey];
            const inventory = userData.inventory || [];

            if (!item) return interaction.editReply("❌ Item não existe.");

            const idx = inventory.indexOf(itemKey);
            if (idx === -1) return interaction.editReply(`❌ Você não tem **${item.name}** no inventário.`);

            let msg = "";
            let consumed = true;

            if (item.effect === "restore_energy") {
                userData.energy = 50;
                msg = "⚡ **GLUP GLUP!** Você tomou o energético e está com **ENERGIA MÁXIMA**!";
            } else if (item.effect === "protection_24h") {
                const now = Date.now();
                if ((userData.protectionExpires || 0) > now) {
                    msg = "🔒 Você já está protegido! Não desperdice suas algemas.";
                    consumed = false;
                } else {
                    userData.protectionExpires = now + 86400000; // 24h
                    msg = "🔒 **PROTEÇÃO ATIVADA!** Por 24h, ninguém pode te roubar.";
                }
            } else if (item.effect === "troll_shield") {
                // Escudo Anti-Troll: sets a flag that can be checked when troll events trigger
                const now = Date.now();
                if ((userData.trollShieldExpires || 0) > now) {
                    msg = "🛡️ Você já está protegido contra trollagens!";
                    consumed = false;
                } else {
                    userData.trollShieldExpires = now + 86400000; // 24h protection
                    msg = "🛡️ **ESCUDO ATIVADO!** Por 24h, você está imune às trollagens do bot.";
                }
            } else {
                msg = "Pof! Nada aconteceu. (Efeito não implementado)";
            }

            if (consumed) {
                userData.inventory.splice(idx, 1);
                await userData.save();
                return interaction.editReply(msg);
            } else {
                return interaction.editReply(msg);
            }
        }
    }
};
