const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const mongoose = require("mongoose");
const ITEMS = require("../../utils/items");
const PETS = require("../../utils/pets");
const JOBS = require("../../utils/jobs");
const BACKGROUNDS = require("../../utils/backgrounds");
const GuildSchema = require("../../database/schemas/GuildSchema");
const GuildModel = mongoose.models.Guilds || mongoose.model("Guilds", GuildSchema);
const { COLORS, SEP, formatMoney, success, error, warning } = require("../../utils/EmbedStyle");

module.exports = {
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const UserModel = mongoose.model("Users");

        let userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });
        if (!userData) {
            userData = new UserModel({
                username: interaction.user.username,
                codigouser: userId,
                idguild: guildId,
                money: 0,
                bank: 0
            });
            await userData.save();
        }

        // Build main panel
        const buildMainEmbed = (user) => {
            const money = user.money || 0;
            const bank = user.bank || 0;
            const job = user.job || "Desempregado";
            const pet = user.activePet ? PETS[user.activePet]?.name : "Nenhum";

            // Badges System
            const badges = [];
            if ((money + bank) >= 100000) badges.push("💎 Magnata");
            if ((user.dailyStreak || 0) >= 7) badges.push("🔥 Fiel");
            if ((user.protectionExpires || 0) > Date.now()) badges.push("🛡️ Blindado");
            if (["Police", "Banker", "Hacker"].includes(job)) badges.push("👮 Especialista");
            if (user.activePet) badges.push("🐾 Adestrador");

            const badgeStr = badges.length > 0 ? badges.join(" • ") : "🌱 Novato";

            const bgKey = user.background || "default";
            const bgUrl = BACKGROUNDS[bgKey]?.url;

            const embed = new EmbedBuilder()
                .setTitle("🏦 Central de Economia")
                .setColor(COLORS.ECONOMY)
                .setThumbnail(interaction.user.displayAvatarURL())
                .setDescription(`${SEP}\nBem-vindo, **${interaction.user.username}**!\n\n🏅 **Conquistas:** ${badgeStr}\n${SEP}\nSelecione uma categoria abaixo para gerenciar sua economia.`)
                .addFields(
                    { name: "💵 Carteira", value: formatMoney(money), inline: true },
                    { name: "🏦 Banco", value: formatMoney(bank), inline: true },
                    { name: "💰 Total", value: formatMoney(money + bank), inline: true },
                    { name: "👔 Profissão", value: job, inline: true },
                    { name: "🐾 Pet", value: pet, inline: true },
                    { name: "⚡ Energia", value: `${user.energy || 50}/50`, inline: true }
                )
                .setFooter({ text: "Clique nos botões para navegar • Expira em 2 min" });

            if (bgUrl && bgUrl !== "default" && bgUrl.startsWith("http")) embed.setImage(bgUrl);
            return embed;
        };

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("central_bank").setLabel("💰 Banco").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("central_shop").setLabel("🛒 Loja").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("central_job").setLabel("👔 Carreira").setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("central_inventory").setLabel("🎒 Inventário").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("central_rankings").setLabel("🏆 Rankings").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("central_crime").setLabel("🔫 Crime").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("central_lottery").setLabel("🎟️ Loteria").setStyle(ButtonStyle.Primary)
        );

        const mainRows = [row1, row2];

        const response = await interaction.editReply({
            embeds: [buildMainEmbed(userData)],
            components: mainRows
        });

        const collector = response.createMessageComponentCollector({
            time: 120000,
            filter: i => i.user.id === userId
        });

        collector.on('collect', async i => {
            try {
                // Re-fetch fresh data
                const freshUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });

                // === BANCO ===
                if (i.customId === "central_bank") {
                    const bankEmbed = new EmbedBuilder()
                        .setTitle("💰 Banco")
                        .setColor(COLORS.ECONOMY)
                        .setDescription(`${SEP}\nGerencie seus fundos.\n\nSaldo Banco: **${formatMoney(freshUser.bank || 0)}**\nSaldo Carteira: **${formatMoney(freshUser.money || 0)}**\n${SEP}`)
                        .setFooter({ text: "Escolha uma ação" });

                    const bankRow1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("bank_deposit").setLabel("📥 Depositar Tudo").setStyle(ButtonStyle.Success).setDisabled((freshUser.money || 0) <= 0),
                        new ButtonBuilder().setCustomId("bank_withdraw").setLabel("📤 Sacar Tudo").setStyle(ButtonStyle.Primary).setDisabled((freshUser.bank || 0) <= 0),
                        new ButtonBuilder().setCustomId("bank_transfer").setLabel("💳 Transferir").setStyle(ButtonStyle.Secondary)
                    );

                    const bankRow2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("bank_daily").setLabel("📅 Daily").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("bank_interest").setLabel("📈 Rendimentos").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("central_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [bankEmbed], components: [bankRow1, bankRow2] });
                }

                // Bank Actions
                if (i.customId === "bank_deposit") {
                    const amount = freshUser.money || 0;
                    if (amount <= 0) return i.reply({ content: "❌ Carteira vazia!", ephemeral: true });
                    freshUser.bank = (freshUser.bank || 0) + amount;
                    freshUser.money = 0;
                    await freshUser.save();
                    await i.reply({ content: `📥 Depositou **$${amount.toLocaleString()}**!`, ephemeral: true });
                }

                if (i.customId === "bank_withdraw") {
                    const amount = freshUser.bank || 0;
                    if (amount <= 0) return i.reply({ content: "❌ Banco vazio!", ephemeral: true });
                    freshUser.money = (freshUser.money || 0) + amount;
                    freshUser.bank = 0;
                    await freshUser.save();
                    await i.reply({ content: `📤 Sacou **$${amount.toLocaleString()}**!`, ephemeral: true });
                }

                if (i.customId === "bank_transfer") {
                    const modal = new ModalBuilder()
                        .setCustomId("transfer_modal")
                        .setTitle("💳 Transferir Dinheiro");

                    const userInput = new TextInputBuilder()
                        .setCustomId("transfer_user")
                        .setLabel("ID do usuário (clique direito → Copiar ID)")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const amountInput = new TextInputBuilder()
                        .setCustomId("transfer_amount")
                        .setLabel("Valor")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder("Ex: 1000");

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(userInput),
                        new ActionRowBuilder().addComponents(amountInput)
                    );

                    await i.showModal(modal);

                    try {
                        const modalInteraction = await i.awaitModalSubmit({ filter: m => m.customId === "transfer_modal" && m.user.id === userId, time: 60000 });

                        const targetId = modalInteraction.fields.getTextInputValue("transfer_user");
                        const amount = parseInt(modalInteraction.fields.getTextInputValue("transfer_amount"));

                        if (isNaN(amount) || amount <= 0) return modalInteraction.reply({ content: "❌ Valor inválido!", ephemeral: true });

                        const freshUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });
                        if ((freshUser.money || 0) < amount) return modalInteraction.reply({ content: "❌ Saldo insuficiente!", ephemeral: true });

                        // Atomic transfer
                        const result = await UserModel.bulkWrite([
                            { updateOne: { filter: { codigouser: userId, idguild: guildId, money: { $gte: amount } }, update: { $inc: { money: -amount } } } },
                            { updateOne: { filter: { codigouser: targetId, idguild: guildId }, update: { $inc: { money: amount } }, upsert: true } }
                        ]);

                        if (result.matchedCount < 1) return modalInteraction.reply({ content: "❌ Transferência falhou!", ephemeral: true });

                        await modalInteraction.reply({ content: `✅ Transferiu **$${amount.toLocaleString()}** para <@${targetId}>!`, ephemeral: true });

                    } catch (err) {
                        // Timeout or error
                    }
                }

                if (i.customId === "bank_daily") {
                    const now = Date.now();
                    const lastDaily = freshUser.lastDaily || 0;
                    const cooldown = 86400000; // 24h

                    if (now - lastDaily < cooldown) {
                        const nextDaily = Math.floor((lastDaily + cooldown) / 1000);
                        return i.reply({ content: `⏳ **Calma lá!** Você já pegou seu daily hoje.\nVolte <t:${nextDaily}:R>.`, ephemeral: true });
                    }

                    // Streak Logic (48h tolerance for 24h cycle)
                    const isStreak = (now - lastDaily) < 172800000;
                    const streak = isStreak ? (freshUser.dailyStreak || 0) + 1 : 1;
                    const baseReward = 2000;
                    const streakBonus = Math.min((streak - 1) * 200, 5000); // +200 per day, max 5000
                    const totalReward = baseReward + streakBonus;

                    freshUser.money = (freshUser.money || 0) + totalReward;
                    freshUser.lastDaily = now;
                    freshUser.dailyStreak = streak;
                    freshUser.energy = 50; // Restore full energy
                    await freshUser.save();

                    await i.reply({
                        content: `📅 **Daily Resgatado!**\n💰 Base: **$${baseReward.toLocaleString()}**\n🔥 Streak (${streak} dias): **+$${streakBonus.toLocaleString()}**\n💵 Total: **$${totalReward.toLocaleString()}**`,
                        ephemeral: true
                    });
                }

                // === LOJA ===
                if (i.customId === "central_shop") {
                    const allProducts = [
                        ...Object.entries(ITEMS).map(([k, v]) => ({ label: v.name, value: k, description: `$${v.price.toLocaleString()}`, emoji: "📦" })),
                        ...Object.entries(PETS).map(([k, v]) => ({ label: v.name, value: k, description: `$${v.price.toLocaleString()}`, emoji: "🐾" })),
                        ...Object.entries(BACKGROUNDS).filter(([k]) => k !== 'default').map(([k, v]) => ({ label: v.name, value: k, description: `$${v.price.toLocaleString()}`, emoji: "🖼️" }))
                    ];

                    const shopEmbed = new EmbedBuilder()
                        .setTitle("🛒 Loja")
                        .setColor("#E67E22")
                        .setDescription(`💰 Seu saldo: **$${(freshUser.money || 0).toLocaleString()}**\n\nSelecione um item para comprar!`)
                        .setFooter({ text: "Itens e Pets disponíveis" });

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId("shop_buy_select")
                        .setPlaceholder("🛒 Escolha um item...")
                        .addOptions(allProducts.slice(0, 25));

                    const shopRow = new ActionRowBuilder().addComponents(selectMenu);
                    const backRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("central_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [shopEmbed], components: [shopRow, backRow] });
                }

                if (i.customId === "shop_buy_select") {
                    const itemKey = i.values[0];
                    const product = ITEMS[itemKey] || PETS[itemKey] || BACKGROUNDS[itemKey];
                    const isPet = !!PETS[itemKey];
                    const isBg = !!BACKGROUNDS[itemKey];

                    // Atomic Transaction Preparation
                    const filter = { codigouser: userId, idguild: guildId, money: { $gte: product.price } };
                    const update = { $inc: { money: -product.price } };

                    // Prevent Duplicates for Unique Items
                    if (isPet) {
                        filter.pets = { $ne: itemKey };
                        update.$push = { pets: itemKey };
                        update.$set = { activePet: itemKey };
                    } else if (isBg) {
                        filter.ownedBackgrounds = { $ne: itemKey };
                        update.$push = { ownedBackgrounds: itemKey };
                    } else {
                        update.$push = { inventory: itemKey };
                    }

                    // Strict Atomic Write
                    const updatedDoc = await UserModel.findOneAndUpdate(filter, update, { new: true });

                    if (!updatedDoc) {
                        // Determine failure reason (Expensive separate check, or generic message)
                        // User either has no money OR already has item.
                        // We can quickly check which one for better UX, though not atomic.
                        const checkData = await UserModel.findOne({ codigouser: userId, idguild: guildId });
                        if ((checkData.money || 0) < product.price) return i.reply({ content: `❌ Dinheiro insuficiente ($${product.price})!`, ephemeral: true });
                        if (isPet && checkData.pets.includes(itemKey)) return i.reply({ content: "❌ Você já possui este Pet!", ephemeral: true });
                        if (isBg && (checkData.ownedBackgrounds || []).includes(itemKey)) return i.reply({ content: "❌ Você já possui este Background!", ephemeral: true });

                        return i.reply({ content: "❌ Transação falhou.", ephemeral: true });
                    }

                    // Success
                    freshUser.money = updatedDoc.money;
                    freshUser.pets = updatedDoc.pets;
                    freshUser.ownedBackgrounds = updatedDoc.ownedBackgrounds;
                    freshUser.inventory = updatedDoc.inventory;
                    // Note: We don't need to save freshUser again as we just modified the DB.

                    await i.reply({
                        content: `✅ Comprou **${product.name}**! Saldo: $${updatedDoc.money.toLocaleString()}${isPet ? " 🎀 Pet equipado!" : ""}${isBg ? " 🖼️ Background adquirido!" : ""}`,
                        ephemeral: true
                    });
                }

                // === CARREIRA ===
                if (i.customId === "central_job") {
                    const currentJob = freshUser.job || "Desempregado";
                    const msgs = freshUser.totalMessages || 0;
                    const voice = freshUser.voiceTime || 0;
                    const xp = (msgs * 10) + (voice * 20);
                    const level = Math.floor(Math.sqrt(xp / 100));

                    const jobList = Object.entries(JOBS).sort((a, b) => a[1].minLevel - b[1].minLevel);
                    let nextJob = null;
                    let canClaim = false;

                    for (const [key, job] of jobList) {
                        if (level >= job.minLevel && key !== currentJob) {
                            nextJob = { key, ...job };
                            canClaim = true;
                        }
                    }

                    const jobEmbed = new EmbedBuilder()
                        .setTitle("👔 Carreira Profissional")
                        .setColor("#9B59B6")
                        .addFields(
                            { name: "📋 Cargo Atual", value: currentJob, inline: true },
                            { name: "📊 Nível", value: `${level}`, inline: true },
                            { name: "🌟 Próximo Cargo", value: nextJob ? `${nextJob.key} (Nível ${nextJob.minLevel})` : "Nenhum disponível", inline: false }
                        );

                    const jobButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("job_work").setLabel("🔨 Trabalhar").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("job_claim").setLabel("🌟 Subir de Cargo").setStyle(ButtonStyle.Success).setDisabled(!canClaim),
                        new ButtonBuilder().setCustomId("central_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [jobEmbed], components: [jobButtons] });
                }

                if (i.customId === "job_claim") {
                    const msgs = freshUser.totalMessages || 0;
                    const voice = freshUser.voiceTime || 0;
                    const xp = (msgs * 10) + (voice * 20);
                    const level = Math.floor(Math.sqrt(xp / 100));

                    const jobList = Object.entries(JOBS).sort((a, b) => b[1].minLevel - a[1].minLevel);
                    let bestJob = "Desempregado";

                    for (const [key, job] of jobList) {
                        if (level >= job.minLevel) {
                            bestJob = key;
                            break;
                        }
                    }

                    if (bestJob === freshUser.job) {
                        return i.reply({ content: "❌ Você já tem o melhor cargo disponível!", ephemeral: true });
                    }

                    freshUser.job = bestJob;
                    await freshUser.save();
                    await i.reply({ content: `🎉 Promovido para **${bestJob}**!`, ephemeral: true });
                }

                if (i.customId === "job_work") {
                    const now = Date.now();
                    const lastWork = freshUser.lastWork || 0;
                    const cooldown = 3600000; // 1h

                    if (now - lastWork < cooldown) {
                        const nextWork = Math.floor((lastWork + cooldown) / 1000);
                        return i.reply({ content: `⏳ **Descanso obrigatório!**\nVocê pode trabalhar novamente <t:${nextWork}:R>.`, ephemeral: true });
                    }

                    // Energy Check
                    const currentEnergy = freshUser.energy !== undefined ? freshUser.energy : 50;
                    if (currentEnergy < 10) {
                        return i.reply({ content: `⚡ **Você está exausto!** (${currentEnergy}/50)\nTome um **Energético** da loja ou espere o Daily.`, ephemeral: true });
                    }

                    // Interactive Math Challenge
                    const numA = Math.floor(Math.random() * 50) + 1;
                    const numB = Math.floor(Math.random() * 50) + 1;
                    const correctAnswer = numA + numB;

                    const modal = new ModalBuilder()
                        .setCustomId("work_modal")
                        .setTitle("🔨 Hora de Trabalhar! (-10 Energia)");

                    const input = new TextInputBuilder()
                        .setCustomId("work_answer")
                        .setLabel(`Resolva: ${numA} + ${numB} = ?`)
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder("Digite o resultado numérico")
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await i.showModal(modal);

                    try {
                        const modalInteraction = await i.awaitModalSubmit({ filter: m => m.customId === "work_modal" && m.user.id === userId, time: 60000 });
                        const userAns = parseInt(modalInteraction.fields.getTextInputValue("work_answer"));

                        if (userAns !== correctAnswer) {
                            return modalInteraction.reply({ content: "❌ Resposta incorreta! Tente novamente em 1 hora.", ephemeral: true });
                        }

                        // Calculate Reward
                        const freshUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });
                        const currentJob = freshUser.job || "Desempregado";
                        const multiplier = JOBS[currentJob]?.bonus?.workMultiplier || 1.0;
                        const baseEarn = Math.floor(Math.random() * (800 - 200 + 1)) + 200;
                        const finalEarn = Math.floor(baseEarn * multiplier);

                        freshUser.money = (freshUser.money || 0) + finalEarn;
                        freshUser.lastWork = Date.now();
                        freshUser.energy = currentEnergy - 10;
                        await freshUser.save();

                        await modalInteraction.reply({ content: `✅ **Resposta Correta!**\n🔨 Você ganhou **$${finalEarn.toLocaleString()}**${multiplier > 1 ? ` (Bônus de ${currentJob})` : ""}`, ephemeral: true });

                    } catch (err) { }
                }

                // === INVENTÁRIO ===
                if (i.customId === "central_inventory") {
                    const userItems = freshUser.inventory || [];

                    if (userItems.length === 0) {
                        const emptyEmbed = new EmbedBuilder()
                            .setTitle("🎒 Inventário")
                            .setColor("#95A5A6")
                            .setDescription("Seu inventário está vazio!\n\nCompre itens na Loja.");

                        const backRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("central_shop").setLabel("🛒 Ir para Loja").setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId("central_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                        );

                        return await i.update({ embeds: [emptyEmbed], components: [backRow] });
                    }

                    const counts = {};
                    userItems.forEach(item => { counts[item] = (counts[item] || 0) + 1; });

                    const invOptions = Object.entries(counts).map(([key, qty]) => {
                        const itemDef = ITEMS[key];
                        return { label: `${qty}x ${itemDef?.name || key}`, value: key, emoji: "📦" };
                    });

                    const invEmbed = new EmbedBuilder()
                        .setTitle("🎒 Inventário")
                        .setColor("#3498DB")
                        .setDescription(Object.entries(counts).map(([k, q]) => `**${q}x** ${ITEMS[k]?.name || k}`).join("\n"));

                    const invSelect = new StringSelectMenuBuilder()
                        .setCustomId("inventory_use")
                        .setPlaceholder("🧪 Selecione para usar...")
                        .addOptions(invOptions.slice(0, 25));

                    const invRow = new ActionRowBuilder().addComponents(invSelect);
                    const backRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("central_backgrounds").setLabel("🖼️ Backgrounds").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("central_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [invEmbed], components: [invRow, backRow] });
                }

                if (i.customId === "inventory_use") {
                    const itemKey = i.values[0];
                    const item = ITEMS[itemKey];
                    const inv = freshUser.inventory || [];
                    const idx = inv.indexOf(itemKey);

                    if (idx === -1) {
                        return i.reply({ content: "❌ Item não encontrado!", ephemeral: true });
                    }

                    // Use item effect
                    if (itemKey === "energy_drink") {
                        freshUser.energy = 50;
                    } else if (itemKey === "golden_handcuffs") {
                        freshUser.protectionExpires = Date.now() + 3600000;
                    } else if (itemKey === "troll_shield") {
                        freshUser.trollShieldExpires = Date.now() + 3600000;
                    }

                    inv.splice(idx, 1);
                    freshUser.inventory = inv;
                    await freshUser.save();

                    await i.reply({ content: `✅ Usou **${item.name}**!`, ephemeral: true });
                }

                if (i.customId === "central_backgrounds") {
                    const owned = freshUser.ownedBackgrounds || ["default"];
                    const current = freshUser.background || "default";

                    const bgOptions = owned.map(k => {
                        const bg = BACKGROUNDS[k];
                        return { label: bg.name, value: k, description: k === current ? "Equipado" : "Clique para equipar", emoji: "🖼️", default: k === current };
                    });

                    const bgEmbed = new EmbedBuilder()
                        .setTitle("🖼️ Meus Backgrounds")
                        .setColor("#E91E63")
                        .setDescription(`Background Atual: **${BACKGROUNDS[current]?.name}**\n\nSelecione abaixo para equipar.`);

                    if (BACKGROUNDS[current]?.url && BACKGROUNDS[current].url !== "default") {
                        bgEmbed.setImage(BACKGROUNDS[current].url);
                    }

                    const bgSelect = new StringSelectMenuBuilder()
                        .setCustomId("background_equip")
                        .setPlaceholder("🖼️ Escolha o background...")
                        .addOptions(bgOptions);

                    const rowSelect = new ActionRowBuilder().addComponents(bgSelect);
                    const rowBack = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("central_inventory").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [bgEmbed], components: [rowSelect, rowBack] });
                }

                if (i.customId === "background_equip") {
                    const bgKey = i.values[0];
                    if (!BACKGROUNDS[bgKey]) return i.reply({ content: "Erro: Background inválido.", ephemeral: true });

                    freshUser.background = bgKey;
                    await freshUser.save();

                    const bgEmbed = new EmbedBuilder()
                        .setTitle("🖼️ Meus Backgrounds")
                        .setColor("#E91E63")
                        .setDescription(`✅ **Equipado:** ${BACKGROUNDS[bgKey].name}\n\nSelecione abaixo para trocar.`);

                    if (BACKGROUNDS[bgKey]?.url && BACKGROUNDS[bgKey].url !== "default") {
                        bgEmbed.setImage(BACKGROUNDS[bgKey].url);
                    }

                    const owned = freshUser.ownedBackgrounds || ["default"];
                    const bgOptions = owned.map(k => {
                        const bg = BACKGROUNDS[k];
                        return { label: bg.name, value: k, description: k === bgKey ? "Equipado" : "Clique para equipar", emoji: "🖼️", default: k === bgKey };
                    });
                    const bgSelect = new StringSelectMenuBuilder()
                        .setCustomId("background_equip")
                        .setPlaceholder("🖼️ Escolha o background...")
                        .addOptions(bgOptions);

                    const rowSelect = new ActionRowBuilder().addComponents(bgSelect);
                    const rowBack = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("central_inventory").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [bgEmbed], components: [rowSelect, rowBack] });
                }

                // === RANKINGS ===
                if (i.customId === "central_rankings") {
                    const rankEmbed = new EmbedBuilder()
                        .setTitle("🏆 Rankings")
                        .setColor("#F1C40F")
                        .setDescription("Escolha qual ranking visualizar:");

                    const rankButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("rank_xp").setLabel("📊 Top XP").setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId("rank_money").setLabel("💰 Top Dinheiro").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("central_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [rankEmbed], components: [rankButtons] });
                }

                if (i.customId === "rank_xp" || i.customId === "rank_money") {
                    const allUsers = await UserModel.find({ idguild: guildId });
                    const isMoney = i.customId === "rank_money";

                    let sorted;
                    if (isMoney) {
                        sorted = allUsers
                            .map(u => ({ ...u.toObject(), total: (u.money || 0) + (u.bank || 0) }))
                            .filter(u => u.total > 0)
                            .sort((a, b) => b.total - a.total)
                            .slice(0, 10);
                    } else {
                        sorted = allUsers
                            .map(u => {
                                const xp = ((u.totalMessages || 0) * 10) + ((u.voiceTime || 0) * 20);
                                return { ...u.toObject(), xp, level: Math.floor(Math.sqrt(xp / 100)) };
                            })
                            .sort((a, b) => b.xp - a.xp)
                            .slice(0, 10);
                    }

                    const medals = ["🥇", "🥈", "🥉"];
                    const desc = sorted.length === 0
                        ? "Ninguém no ranking ainda!"
                        : sorted.map((u, i) => {
                            const medal = i < 3 ? medals[i] : `**#${i + 1}**`;
                            const value = isMoney ? `$${u.total.toLocaleString()}` : `Lvl ${u.level} (${u.xp} XP)`;
                            return `${medal} <@${u.codigouser}> - ${value}`;
                        }).join("\n");

                    const rankEmbed = new EmbedBuilder()
                        .setTitle(isMoney ? "💰 Top 10 Dinheiro" : "📊 Top 10 XP")
                        .setColor(isMoney ? "#2ECC71" : "#3498DB")
                        .setDescription(desc);

                    const backRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("central_rankings").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [rankEmbed], components: [backRow] });
                }

                if (i.customId === "central_crime") {
                    const embed = new EmbedBuilder()
                        .setTitle("🔫 Mundo do Crime")
                        .setColor("#000000")
                        .setDescription("⚠️ **Atenção:** O crime não compensa... a menos que você seja bom.\n\nEscolha uma vítima para tentar roubar. Se falhar, você paga multa ou vai preso.")
                        .setFooter({ text: "Cooldown: 2 horas • Custo risco: $200" });

                    const userSelect = new UserSelectMenuBuilder()
                        .setCustomId("crime_user_select")
                        .setPlaceholder("👤 Escolha a sua vítima...");

                    const rowSelect = new ActionRowBuilder().addComponents(userSelect);
                    const rowBack = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("central_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [embed], components: [rowSelect, rowBack] });
                }

                if (i.customId === "crime_user_select") {
                    const targetId = i.values[0];
                    if (targetId === userId) return i.reply({ content: "❌ Roubar a si mesmo? Procure um psicólogo.", ephemeral: true });

                    const now = Date.now();
                    const lastRob = freshUser.lastRob || 0;
                    const PROB_COOLDOWN = 7200000; // 2h

                    if (now - lastRob < PROB_COOLDOWN) {
                        const waitMin = Math.ceil((lastRob + PROB_COOLDOWN - now) / 60000);
                        return i.reply({ content: `🚓 **Polícia em alerta!** Espere **${waitMin} minutos** para tentar outro crime.`, ephemeral: true });
                    }

                    if ((freshUser.money || 0) < 200) return i.reply({ content: "🚫 Você precisa de **$200** para subornar a polícia.", ephemeral: true });

                    const targetData = await UserModel.findOne({ codigouser: targetId, idguild: guildId });
                    if (!targetData || (targetData.money || 0) < 50) return i.reply({ content: "🤷‍♂️ Alvo pobre demais (menos de $50). Escolha outro.", ephemeral: true });

                    // Protection Check
                    if (targetData.protectionExpires > now) return i.reply({ content: "🔒 **Alvo Protegido!** Suas algemas de ouro impediram o roubo.", ephemeral: true });

                    // Logic
                    let baseChance = 0.4; // 40%
                    if (freshUser.job === "Hacker") baseChance += 0.15;
                    if (freshUser.job === "Mafioso") baseChance = Math.min(baseChance * 1.5, 0.75);

                    // Defense
                    let defended = false;
                    let defenseSource = "";
                    if (targetData.job === "Segurança" && Math.random() < 0.10) { defended = true; defenseSource = "trabalho de Segurança"; }
                    if (!defended && targetData.activePet && PETS[targetData.activePet]?.type === "defense" && Math.random() < PETS[targetData.activePet].value) {
                        defended = true; defenseSource = `pet ${PETS[targetData.activePet].name}`;
                    }

                    if (defended) {
                        freshUser.lastRob = now;
                        await freshUser.save();
                        return i.reply({ content: `🐶 **DEFESA!** O ${defenseSource} da vítima te impediu!`, ephemeral: true });
                    }

                    const success = Math.random() < baseChance;
                    if (success) {
                        const stealPercent = (Math.random() * 0.20) + 0.10;
                        const stolen = Math.floor(targetData.money * stealPercent);

                        targetData.money -= stolen;
                        freshUser.money += stolen;
                        freshUser.lastRob = now;

                        await targetData.save();
                        await freshUser.save();

                        return i.reply({ content: `🔫 **SUCESSO!** Você roubou **$${stolen.toLocaleString()}** de <@${targetId}>!`, ephemeral: true });
                    } else {
                        if (freshUser.trollShieldExpires > now) {
                            freshUser.lastRob = now;
                            freshUser.trollShieldExpires = 0; // Consume shield
                            await freshUser.save();
                            return i.reply({ content: `🚓 **A polícia te pegou!** Mas o **Escudo Anti-Troll** anulou a sua multa!`, ephemeral: true });
                        } else {
                            const fine = Math.min(500, freshUser.money);
                            freshUser.money -= fine;
                            freshUser.lastRob = now;
                            await freshUser.save();
                            return i.reply({ content: `🚓 **PRESO!** A polícia te pegou. Multa: **$${fine}**.`, ephemeral: true });
                        }
                    }
                }

                if (i.customId === "central_lottery") {
                    let guildData = await GuildModel.findOne({ guildID: guildId });
                    if (!guildData) {
                        guildData = new GuildModel({ guildID: guildId });
                        await guildData.save();
                    }

                    const lottery = guildData.lottery || { pool: 1000, lastDraw: 0, tickets: [], lastWinner: "Ninguém" };
                    if (!guildData.lottery) guildData.lottery = lottery;

                    const now = Date.now();
                    const COOLDOWN = 86400000; // 24h
                    const timeDiff = now - lottery.lastDraw;

                    // === AUTO DRAW CHECK ===
                    if (timeDiff >= COOLDOWN && lottery.tickets.length > 0) {
                        const winnerId = lottery.tickets[Math.floor(Math.random() * lottery.tickets.length)];
                        const pool = lottery.pool;

                        const winnerData = await UserModel.findOne({ codigouser: winnerId, idguild: guildId });
                        if (winnerData) {
                            winnerData.money = (winnerData.money || 0) + pool;
                            await winnerData.save();
                        }

                        guildData.lottery = {
                            pool: 1000, // Seed
                            lastDraw: now,
                            tickets: [],
                            lastWinner: winnerData ? winnerData.username : "Desconhecido"
                        };
                        await guildData.save();

                        const drawEmbed = new EmbedBuilder()
                            .setTitle("🎱 SORTEIO REALIZADO!")
                            .setColor("#E91E63")
                            .setDescription(`🎉 **Temos um vencedor!**\n\n👤 **<@${winnerId}>** levou o prêmio de **$${pool.toLocaleString()}**!\n\nA loteria foi reiniciada. Compre seu bilhete!`)
                            .setFooter({ text: "Próximo sorteio em 24h" });

                        const lotButtons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("lottery_buy").setLabel("🎟️ Comprar Bilhete ($100)").setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId("central_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                        );

                        return await i.update({ embeds: [drawEmbed], components: [lotButtons] });
                    }

                    if (timeDiff >= COOLDOWN && lottery.tickets.length === 0) {
                        guildData.lottery.lastDraw = now;
                        await guildData.save();
                    }

                    const nextDraw = Math.floor((guildData.lottery.lastDraw + COOLDOWN) / 1000);
                    const userTickets = guildData.lottery.tickets.filter(id => id === userId).length;
                    const winChance = guildData.lottery.tickets.length > 0 ? ((userTickets / guildData.lottery.tickets.length) * 100).toFixed(2) : "0.00";

                    const lotEmbed = new EmbedBuilder()
                        .setTitle("🎱 Loteria do Servidor")
                        .setColor("#9B59B6")
                        .setDescription(`💸 Prêmio Acumulado: **$${guildData.lottery.pool.toLocaleString()}**\n🕒 Sorteio: <t:${nextDraw}:R>\n👑 Último Vencedor: **${guildData.lottery.lastWinner}**\n\n🎫 Seus Bilhetes: **${userTickets}**\n🍀 Sua Chance: **${winChance}%**`)
                        .setFooter({ text: "Cada bilhete custa $100 e aumenta o prêmio em $100. Sorteio automático em 24h." });

                    const lotButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("lottery_buy").setLabel("🎟️ Comprar Bilhete ($100)").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("central_back").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Danger)
                    );

                    await i.update({ embeds: [lotEmbed], components: [lotButtons] });
                }

                if (i.customId === "lottery_buy") {
                    const ticketPrice = 100;

                    // 1. Atomic Deduction (User)
                    const userUpdate = await UserModel.findOneAndUpdate(
                        { codigouser: userId, idguild: guildId, money: { $gte: ticketPrice } },
                        { $inc: { money: -ticketPrice } },
                        { new: true }
                    );

                    if (!userUpdate) return i.reply({ content: `❌ Sem dinheiro para o bilhete ($${ticketPrice})!`, ephemeral: true });

                    freshUser.money = userUpdate.money; // Update local cache

                    // 2. Atomic Pool Update (Guild)
                    const guildUpdate = await GuildModel.findOneAndUpdate(
                        { guildID: guildId },
                        {
                            $inc: { "lottery.pool": ticketPrice },
                            $push: { "lottery.tickets": userId },
                            // Make sure lottery object exists if it's a new guild doc created by upsert (Edge case handled by schema defaults usually, but explicit is safe)
                            $setOnInsert: { "lottery.lastDraw": Date.now(), "lottery.lastWinner": "Ninguém" }
                        },
                        { new: true, upsert: true }
                    );

                    const userTickets = guildUpdate.lottery.tickets.filter(id => id === userId).length;
                    const winChance = ((userTickets / guildUpdate.lottery.tickets.length) * 100).toFixed(2);

                    await i.reply({ content: `✅ **Bilhete comprado!**\nAgora você tem ${userTickets} bilhetes (${winChance}% de chance).\nPrêmio atual: **$${guildUpdate.lottery.pool.toLocaleString()}**`, ephemeral: true });
                }

                if (i.customId === "bank_interest") {
                    const now = Date.now();
                    const lastClaim = freshUser.lastInterestClaim || 0;
                    const cooldown = 86400000; // 24h

                    if (now - lastClaim < cooldown) {
                        const nextClaim = Math.floor((lastClaim + cooldown) / 1000);
                        return i.reply({ content: `⏳ **Rendimentos em processamento.**\nVolte <t:${nextClaim}:R>.`, ephemeral: true });
                    }

                    const balance = freshUser.bank || 0;
                    if (balance < 1000) return i.reply({ content: "❌ Saldo muito baixo para render juros (Min: $1.000).", ephemeral: true });

                    let rate = 0.01; // 1%
                    if (freshUser.job === "Banker") rate *= 2; // Banker bonus
                    const interest = Math.floor(balance * rate);

                    freshUser.bank = balance + interest;
                    freshUser.lastInterestClaim = now;
                    await freshUser.save();

                    await i.reply({ content: `📈 **Rendimentos Coletados!**\nSua conta rendeu **$${interest.toLocaleString()}** (1% a.d.).\nNovo Saldo Bancário: **$${freshUser.bank.toLocaleString()}**`, ephemeral: true });
                }

                if (i.customId === "central_back") {
                    const updatedUser = await UserModel.findOne({ codigouser: userId, idguild: guildId });
                    await i.update({ embeds: [buildMainEmbed(updatedUser)], components: mainRows });
                }

            } catch (e) {
                console.error("Erro na central:", e);
                if (!i.replied && !i.deferred) {
                    await i.reply({ content: "❌ Ocorreu um erro.", ephemeral: true }).catch(() => { });
                }
            }
        });

        collector.on('end', async () => {
            try {
                const disabledButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("x1").setLabel("💰 Banco").setStyle(ButtonStyle.Success).setDisabled(true),
                    new ButtonBuilder().setCustomId("x2").setLabel("🛒 Loja").setStyle(ButtonStyle.Primary).setDisabled(true),
                    new ButtonBuilder().setCustomId("x3").setLabel("👔 Carreira").setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId("x4").setLabel("🎒 Inventário").setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId("x5").setLabel("🏆 Rankings").setStyle(ButtonStyle.Danger).setDisabled(true)
                );
                await interaction.editReply({ components: [disabledButtons] }).catch(() => { });
            } catch (e) { }
        });
    }
};
