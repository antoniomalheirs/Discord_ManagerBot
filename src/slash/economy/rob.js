const mongoose = require("mongoose");
const JOBS = require("../../utils/jobs");
const { COLORS, SEP, cooldownMsg, formatMoney, success, error, warning } = require("../../utils/EmbedStyle");
const { EmbedBuilder } = require("discord.js");
const ROB_COOLDOWN = 7200000; // 2h

module.exports = {
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const targetUser = interaction.options.getUser("vitima");

        const UserModel = mongoose.model("Users");
        let userData = await UserModel.findOne({ codigouser: userId, idguild: guildId });

        if (!userData) {
            userData = new UserModel({ username: interaction.user.username, codigouser: userId, idguild: guildId, money: 0 });
        }

        const now = Date.now();

        if (targetUser.id === userId) return interaction.editReply({ embeds: [error("Roubo Falhou", "Você não pode se roubar (mas seria poético).")] });
        if (targetUser.bot) return interaction.editReply({ embeds: [error("Roubo Falhou", "Não mexa com robôs. Eles sabem onde você mora.")] });

        const lastRob = userData.lastRob || 0;
        if (now - lastRob < ROB_COOLDOWN) {
            const nextRob = lastRob + ROB_COOLDOWN;
            return interaction.editReply({ embeds: [warning("🚓 Polícia de Olho!", `Aguarde a poeira baixar antes de tentar outro roubo.\n\n${cooldownMsg(nextRob)}`)] });
        }

        // Check Victim
        let victimData = await UserModel.findOne({ codigouser: targetUser.id, idguild: guildId });
        if (!victimData || (victimData.money || 0) < 50) {
            return interaction.editReply({ embeds: [warning("Roubo Falhou", `**${targetUser.username}** é tão pobre que não vale o esforço (menos de $50 na carteira).`)] });
        }

        // Check Robber Wallet
        if ((userData.money || 0) < 200) {
            return interaction.editReply({ embeds: [warning("Roubo Falhou", "Você precisa de pelo menos **$200** na carteira para tentar subornar a polícia caso seja pego.")] });
        }

        // Check Protection
        if (victimData.protectionExpires && victimData.protectionExpires > now) {
            return interaction.editReply({ embeds: [error("Roubo Falhou", `🔒 **${targetUser.username}** está protegido por Algemas de Ouro! Seu roubo falhou miseravelmente.`)] });
        }

        // Calculate success chance with job bonuses
        let baseChance = 0.4; // 40% base success
        let bonusText = "";

        // Hacker bonus: +15% rob chance
        if (userData.job && JOBS[userData.job]?.bonus?.robChance) {
            baseChance += JOBS[userData.job].bonus.robChance;
            bonusText = `\n💻 **Hacker:** +${Math.round(JOBS[userData.job].bonus.robChance * 100)}%`;
        }

        // Mafioso bonus: allStats 1.5x (applies to rob chance too)
        if (userData.job && JOBS[userData.job]?.bonus?.allStats) {
            baseChance *= JOBS[userData.job].bonus.allStats;
            baseChance = Math.min(baseChance, 0.75); // Cap at 75%
        }

        // Victim's Segurança job: defense chance
        let victimDefended = false;
        let defenseSource = "";

        if (victimData.job && JOBS[victimData.job]?.bonus?.defenseChance) {
            const defenseChance = JOBS[victimData.job].bonus.defenseChance;
            if (Math.random() < defenseChance) {
                victimDefended = true;
                defenseSource = "Segurança";
            }
        }

        // Pet Dog (Caramelo) bonus: 20% extra defense for victim
        const PETS = require("../../utils/pets");
        if (!victimDefended && victimData.activePet && PETS[victimData.activePet]?.type === "defense") {
            const petDefenseChance = PETS[victimData.activePet].value;
            if (Math.random() < petDefenseChance) {
                victimDefended = true;
                defenseSource = PETS[victimData.activePet].name;
            }
        }

        if (victimDefended) {
            userData.lastRob = now;
            await userData.save();
            const embed = new EmbedBuilder()
                .setTitle("🐶 Defesa Bem Sucedida!")
                .setColor(COLORS.INFO)
                .setDescription(`O **${defenseSource}** de **${targetUser.username}** reagiu e você fugiu de mãos vazias!`);
            return interaction.editReply({ embeds: [embed] });
        }

        const successRob = Math.random() < baseChance;

        if (successRob) {
            const stealPercent = (Math.random() * 0.20) + 0.10;
            const stolen = Math.floor(victimData.money * stealPercent);

            if (stolen <= 0) return interaction.editReply({ embeds: [warning("Roubo Falhou", "Você tentou roubar, mas os bolsos dele estavam furados.")] });

            victimData.money -= stolen;
            userData.money += stolen;
            userData.lastRob = now;

            await victimData.save();
            await userData.save();

            // LOG
            try {
                const GuildModel = mongoose.model("Guilds");
                const guildData = await GuildModel.findOne({ guildID: guildId });

                if (guildData && guildData.logging && guildData.logging.economy_log && guildData.logging.economy_log.state) {
                    const logChannelId = guildData.logging.economy_log.channel;
                    const logChannel = interaction.guild.channels.cache.get(logChannelId);

                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle("🔫 Log de Crime (Roubo)")
                            .setColor(COLORS.CRIME)
                            .addFields(
                                { name: "Ladrão", value: `${interaction.user.tag} (ID: ${userId})`, inline: true },
                                { name: "Vítima", value: `${targetUser.tag} (ID: ${targetUser.id})`, inline: true },
                                { name: "Roubado", value: formatMoney(stolen), inline: false }
                            )
                            .setTimestamp();
                        logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (e) { console.error(e); }

            const embed = new EmbedBuilder()
                .setTitle("🔫 Roubo Bem Sucedido!")
                .setColor(COLORS.SUCCESS)
                .setDescription(`${SEP}\nVocê assaltou <@${targetUser.id}> com sucesso!\n${SEP}`)
                .addFields(
                    { name: "💰 Lucro", value: formatMoney(stolen) + bonusText, inline: true },
                    { name: "💸 Perda da Vítima", value: `${Math.floor(stealPercent * 100)}% da carteira`, inline: true }
                )
                .setFooter({ text: "O crime compensa... às vezes." })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } else {
            // FAIL - Apply fine but prevent negative balance
            const fine = Math.min(500, userData.money);  // Can't go negative
            userData.money -= fine;
            userData.lastRob = now;
            await userData.save();

            const embed = new EmbedBuilder()
                .setTitle("🚓 Preso em Flagrante!")
                .setColor(COLORS.ERROR)
                .setDescription(`${SEP}\nA polícia te pegou no ato!\n${SEP}\n**Penalidade:** Você pagou **${formatMoney(fine)}** de suborno para não ser preso.`);

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
