const { EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const JOBS = require("../../utils/jobs");
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

        if (targetUser.id === userId) return interaction.editReply("❌ Você não pode se roubar (mas seria poético).");
        if (targetUser.bot) return interaction.editReply("❌ Não mexa com robôs. Eles sabem onde você mora.");

        const lastRob = userData.lastRob || 0;
        if (now - lastRob < ROB_COOLDOWN) {
            const waitMin = Math.ceil((lastRob + ROB_COOLDOWN - now) / 60000);
            return interaction.editReply(`🚓 A polícia está de olho! Espere a poeira baixar (**${waitMin} minutos**).`);
        }

        // Check Victim
        let victimData = await UserModel.findOne({ codigouser: targetUser.id, idguild: guildId });
        if (!victimData || (victimData.money || 0) < 50) {
            return interaction.editReply(`😐 **${targetUser.username}** é tão pobre que não vale o esforço (menos de $50 na carteira).`);
        }

        // Check Robber Wallet
        if ((userData.money || 0) < 200) {
            return interaction.editReply(`🚫 Você precisa de pelo menos **$200** para subornar a polícia caso seja pego.`);
        }

        // Check Protection
        if (victimData.protectionExpires && victimData.protectionExpires > now) {
            return interaction.editReply(`🔒 **${targetUser.username}** está protegido por Algemas de Ouro! Seu roubo falhou miseravelmente.`);
        }

        // Calculate success chance with job bonuses
        let baseChance = 0.4; // 40% base success
        let bonusText = "";

        // Hacker bonus: +15% rob chance
        if (userData.job && JOBS[userData.job]?.bonus?.robChance) {
            baseChance += JOBS[userData.job].bonus.robChance;
            bonusText = ` (Hacker: +${Math.round(JOBS[userData.job].bonus.robChance * 100)}%)`;
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
            return interaction.editReply(`🐶 **DEFESA!** O ${defenseSource} de ${targetUser.username} latiu e você fugiu sem roubar nada!`);
        }

        const success = Math.random() < baseChance;

        if (success) {
            const stealPercent = (Math.random() * 0.20) + 0.10;
            const stolen = Math.floor(victimData.money * stealPercent);

            if (stolen <= 0) return interaction.editReply("🤷‍♂️ Você tentou roubar, mas os bolsos dele estavam furados.");

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
                            .setColor("#FF0000")
                            .addFields(
                                { name: "Ladrão", value: `${interaction.user.tag} (ID: ${userId})`, inline: true },
                                { name: "Vítima", value: `${targetUser.tag} (ID: ${targetUser.id})`, inline: true },
                                { name: "Roubado", value: `$${stolen.toLocaleString()}`, inline: false }
                            )
                            .setTimestamp();
                        logChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (e) { console.error(e); }

            return interaction.editReply(`🔫 **SUCESSO!** Você roubou **$${stolen}** de <@${targetUser.id}>!\n*(Ele perdeu ${Math.floor(stealPercent * 100)}% da carteira)*`);
        } else {
            // FAIL - Apply fine but prevent negative balance
            const fine = Math.min(500, userData.money);  // Can't go negative
            userData.money -= fine;
            userData.lastRob = now;
            await userData.save();

            return interaction.editReply(`🚓 **PRESO EM FLAGRANTE!**\nA polícia te pegou. Você pagou **$${fine}** de suborno para ser solto.`);
        }
    }
};
