const fs = require('fs');
const path = require('path');

module.exports = class ErrorHandler {
    constructor(client) {
        this.client = client;
    }

    async init() {
        process.on('unhandledRejection', (reason, promise) => {
            console.error(' [ANTI-CRASH] :: Unhandled Rejection/Catch');
            console.error(reason, promise);
            // Opcional: Enviar para um webhook ou canal de logs
        });

        process.on('uncaughtException', (err, origin) => {
            console.error(' [ANTI-CRASH] :: Uncaught Exception/Catch');
            console.error(err, origin);
            // Em erros críticos, talvez seja melhor reiniciar, mas aqui tentamos manter vivo
        });

        process.on('uncaughtExceptionMonitor', (err, origin) => {
            console.error(' [ANTI-CRASH] :: Uncaught Exception/Catch (Monitor)');
            console.error(err, origin);
        });

        console.log(`\x1b[1m\x1b[32m[SYSTEM]\x1b[0m`, `Sistema Anti-Crash Ativado.`);
    }
};
