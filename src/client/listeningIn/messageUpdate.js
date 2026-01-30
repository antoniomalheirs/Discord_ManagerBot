const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // Ignorar embeds loading

        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(newMessage.guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.message_update) return;
            const config = guildData.logging.message_update;

            if (!config.state || !config.channel) return;

            const logChannel = newMessage.guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle("✏️ Mensagem Editada")
                .setColor("#FFA500") // Laranja
                .addFields(
                    { name: "Autor", value: `${newMessage.author} (\`${newMessage.author.id}\`)`, inline: true },
                    { name: "Canal", value: `${newMessage.channel}`, inline: true },
                    { name: "Antes", value: oldMessage.content ? oldMessage.content.substring(0, 1024) : "*[Não cacheado]*" },
                    { name: "Depois", value: newMessage.content ? newMessage.content.substring(0, 1024) : "*[Vazio]*" }
                )
                .setTimestamp()
                .setFooter({ text: `ID Mensagem: ${newMessage.id}` });

            await logChannel.send({ embeds: [embed] }).catch(() => { });

        } catch (error) {
            console.error("Erro no logger MessageUpdate:", error);
        }
    },
};
