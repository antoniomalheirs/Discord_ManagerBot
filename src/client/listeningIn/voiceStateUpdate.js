const { Events, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GuildsRepository = require("../../database/mongoose/GuildsRepository");

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const guild = newState.guild;
        if (!guild) return;

        try {
            const guildRepo = new GuildsRepository(mongoose, "Guilds");
            const guildData = await guildRepo.getOrCreate(guild.id);

            if (!guildData || !guildData.logging || !guildData.logging.voice_update) return;
            const config = guildData.logging.voice_update;

            if (!config.state || !config.channel) return;

            const logChannel = guild.channels.cache.get(config.channel);
            if (!logChannel) return;

            let action = "";
            let color = "#000000";
            let description = "";

            const member = newState.member;

            // Entrou em canal
            if (!oldState.channelId && newState.channelId) {
                action = "🗣️ Entrou em Voz";
                color = "#00FF00"; // Verde
                description = `${member} entrou no canal **${newState.channel.name}**`;
            }
            // Saiu de canal
            else if (oldState.channelId && !newState.channelId) {
                action = "🔇 Saiu de Voz";
                color = "#FF0000"; // Vermelho
                description = `${member} saiu do canal **${oldState.channel.name}**`;
            }
            // Mudou de canal
            else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                action = "🔄 Moveu de Canal";
                color = "#FFFF00"; // Amarelo
                description = `${member} foi de **${oldState.channel.name}** para **${newState.channel.name}**`;
            }
            else {
                return; // Mute/Unmute/Stream não vamos logar para evitar spam
            }

            const embed = new EmbedBuilder()
                .setTitle(action)
                .setColor(color)
                .setDescription(description)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => { });

        } catch (error) {
            console.error("Erro no logger VoiceStateUpdate:", error);
        }
    },
};
