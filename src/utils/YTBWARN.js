// fetch é nativo do Node.js 18+ (não precisa de node-fetch)

module.exports = async function (channelId) {
  try {
    if (!process.env.YOUTUBE_API) {
      throw new Error("A chave da API do YouTube não está definida.");
    }

    // Solicitar detalhes do canal
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${channelId}&key=${process.env.YOUTUBE_API}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!channelResponse.ok) {
      throw new Error(
        `Erro ao obter detalhes do canal. Status: ${channelResponse.status}`
      );
    }

    const channelData = await channelResponse.json();

    // Verificar se há resultados para o canal
    if (channelData.items.length === 0) {
      console.error("Nenhum canal encontrado.");
      return {};
    }

    const playlistId =
      channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Solicitar detalhes do vídeo mais recente da playlist
    const playlistItemsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=1&key=${process.env.YOUTUBE_API}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!playlistItemsResponse.ok) {
      throw new Error(
        `Erro ao obter detalhes do vídeo mais recente. Status: ${playlistItemsResponse.status}`
      );
    }

    const playlistItemsData = await playlistItemsResponse.json();

    // Verificar se há resultados na playlist
    if (playlistItemsData.items.length === 0) {
      console.error("Nenhum vídeo encontrado na playlist.");
      return {};
    }

    // Extrair detalhes do vídeo mais recente
    const latestVideoDetails = playlistItemsData.items[0].snippet;

    const ytData = {
      youtube: channelId,
      channel: latestVideoDetails.channelTitle,
      lastVideo:
        latestVideoDetails.title +
        " || " +
        `https://www.youtube.com/watch?v=${latestVideoDetails.resourceId.videoId}`,
      lastPublish: latestVideoDetails.publishedAt,
      message:
        latestVideoDetails.thumbnails.high &&
        latestVideoDetails.thumbnails.high.url,
      notifyGuild: "",
    };

    // Exemplo de logs adicionais
    /*console.log("Resposta da API (Canal):", channelData);
      console.log("Playlist ID:", playlistId);
      console.log("Resposta da API (Vídeo mais recente):", playlistItemsData);
      console.log("Detalhes do vídeo mais recente:", latestVideoDetails);*/

    return ytData;
  } catch (error) {
    console.error(`Erro ao buscar informações do canal: ${error.message}`);
    throw error;
  }
};
