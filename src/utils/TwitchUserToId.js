const axios = require("axios");
const TwitchToken = require("./TwitchToken");

module.exports = async function (username) {
    try {
        const clientId = process.env.TWITCH_CLIENTID;
        const clientSecret = process.env.TWITCH_SECRETID;
        const accessToken = await TwitchToken(clientId, clientSecret);

        const response = await axios.get("https://api.twitch.tv/helix/users", {
            params: {
                login: username,
            },
            headers: {
                "Client-ID": clientId,
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (response.data.data.length === 0) {
            return null;
        }

        return {
            id: response.data.data[0].id,
            login: response.data.data[0].login,
            display_name: response.data.data[0].display_name
        };
    } catch (error) {
        console.error(`Erro ao buscar ID do usuário Twitch: ${error.message}`);
        throw error;
    }
};
