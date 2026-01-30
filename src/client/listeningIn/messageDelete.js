const { Events, EmbedBuilder, AuditLogEvent } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            // Nota: Em produção, o ideal é ter um cache local para não consultar o DB em todo evento.
            // Para este bot, vamos consultar para garantir consistência.
            const guildData = await guildRepo.getOrCreate(message.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.message_delete) return;
            const config = guildData.logging.message_delete;

            if (!config.state || !config.channel) return;

            const logChannel = message.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            // Tentar descobrir quem deletou (Audit Logs)
            let executor = null;
            try {
                const fetchedLogs = await message.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MessageDelete,
                });
                const deletionLog = fetchedLogs.entries.first();

                // Verificar se o log é recente e corresponde ao canal/autor
                if (deletionLog &&
                    deletionLog.target.id === message.author.id &&
                    deletionLog.createdTimestamp > (Date.now() - 5000)) {
                    executor = deletionLog.executor;
                }
            } catch (e) {
                // Falta de permissões ou erro
            }

            const embed = new EmbedBuilder()
                .setTitle("🗑️ Mensagem Deletada")
                .setColor("#FF0000") // Vermelho
                .addFields(
                    { name: "Autor", value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                    { name: "Canal", value: `${message.channel}`, inline: true },
                    { name: "Deletado por", value: executor ? `${executor}` : "Próprio Autor", inline: true },
                    { name: "Conteúdo", value: message.content ? message.content.substring(0, 1024) : "*[Conteúdo não cacheado ou anexo]*" }
                )
                .setTimestamp()
                .setFooter({ text: `ID Mensagem: ${message.id}` });

            // Se tiver anexo
            if (message.attachments.size > 0) {
                embed.addFields({ name: "Anexos", value: `${message.attachments.size} anexo(s) (imagens/arquivos não podem ser recuperados)` });
            }

            await logChannel.send({ embeds: [embed] }).catch(() => { });

        } catch (error) {
            console.error("Erro no logger MessageDelete:", error);
        }
    },
};
