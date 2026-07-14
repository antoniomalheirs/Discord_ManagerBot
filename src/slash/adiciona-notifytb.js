const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require("discord.js");
const mongoose = require("mongoose");
const { PesquisaYTBVideo } = require("../functions/PesquisaYTBVideo");
const YTBCHANNELTOID = require("../utils/YTBCHANNELTOID");
const { success, error, warning } = require("../utils/EmbedStyle");
const GuildSchema = require("../database/schemas/GuildSchema");

// Evitar re-registro do modelo
if (!mongoose.models.Guilds) {
    mongoose.model("Guilds", GuildSchema);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("youtube-notifier")
        .setDescription("Avisa sobre os vídeos do YT")
        .addStringOption(option => 
            option.setName("url").setDescription("URL/ID/Tag do canal do YouTube").setRequired(true)
        )
        .addChannelOption(option => 
            option.setName("canal").setDescription("Canal que será enviada as mensagens").setRequired(true)
        )
        .addStringOption(option => 
            option.setName("mensagem").setDescription("Mensagem customizada. Use {url} {titulo} {autor}").setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
                embeds: [error("Acesso Negado", "Você precisa de permissão de Administrador.")],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const urlInput = interaction.options.getString("url");
        const canal = interaction.options.getChannel("canal");
        const mensagemCustom = interaction.options.getString("mensagem") || "Vídeo Novo Pessoal!\n{url}";

        try {
            // Conversão de URL/Handle para ID usando a utility refatorada (sem yt-search)
            let finalId = urlInput;
            if (urlInput.includes("youtube.com") || urlInput.startsWith("@")) {
                const convertedId = await YTBCHANNELTOID(urlInput);
                if (!convertedId) {
                    return interaction.editReply({
                        embeds: [error("Canal Inválido", "Não foi possível encontrar este canal. Verifique o link ou a tag (`@canal`).")]
                    });
                }
                finalId = convertedId;
            }

            const GuildModel = mongoose.model("Guilds");
            const guildId = interaction.guildId;

            let guildData = await GuildModel.findOne({ guildID: guildId });
            if (!guildData) {
                guildData = new GuildModel({ guildID: guildId, youtubeChannels: [] });
            }

            if (!guildData.youtubeChannels) {
                guildData.youtubeChannels = [];
            }

            const exists = guildData.youtubeChannels.find(ch => ch.channelId === finalId);
            if (exists) {
                return interaction.editReply({
                    embeds: [warning("Canal já Cadastrado", `Este canal do YouTube já está sendo notificado no canal <#${exists.discordChannel}>.`)]
                });
            }

            const lastVideoId = await PesquisaYTBVideo(finalId);

            const newChannelConfig = {
                channelId: finalId,
                discordChannel: canal.id,
                message: mensagemCustom,
                lastVideoId: lastVideoId || ""
            };

            guildData.youtubeChannels.push(newChannelConfig);
            await guildData.save();

            interaction.editReply({
                embeds: [success("YouTube Notifier Ativado", `Notificações configuradas para enviar em <#${canal.id}> quando novos vídeos saírem.`)]
            });

        } catch (err) {
            console.error("Erro no youtube-notifier:", err);
            interaction.editReply({
                embeds: [error("Erro Interno", "Houve um problema ao configurar o notificador do YouTube.")]
            });
        }
    }
};
