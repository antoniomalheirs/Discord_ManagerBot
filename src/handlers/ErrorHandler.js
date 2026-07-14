const fs = require('fs');
const path = require('path');

module.exports = class ErrorHandler {
    constructor(client) {
        this.client = client;
    }

    async init() {
        const sendToWebhook = async (title, err) => {
            if (!process.env.ERROR_WEBHOOK) return;
            const axios = require("axios");
            const errorMessage = err instanceof Error ? err.stack : String(err);
            try {
                await axios.post(process.env.ERROR_WEBHOOK, {
                    embeds: [{
                        title: title,
                        description: `\`\`\`js\n${errorMessage.slice(0, 4000)}\n\`\`\``,
                        color: 16711680,
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch (e) {
                console.error("Falha ao enviar log pro Webhook", e.message);
            }
        };

        process.on('unhandledRejection', (reason, promise) => {
            console.error(' [ANTI-CRASH] :: Unhandled Rejection/Catch');
            console.error(reason, promise);
            sendToWebhook('Unhandled Rejection/Catch', reason);
        });

        process.on('uncaughtException', (err, origin) => {
            console.error(' [ANTI-CRASH] :: Uncaught Exception/Catch');
            console.error(err, origin);
            sendToWebhook('Uncaught Exception/Catch', err);
        });

        process.on('uncaughtExceptionMonitor', (err, origin) => {
            console.error(' [ANTI-CRASH] :: Uncaught Exception/Catch (Monitor)');
            console.error(err, origin);
        });

        console.log(`\x1b[1m\x1b[32m[SYSTEM]\x1b[0m`, `Sistema Anti-Crash Ativado.`);
    }
};
