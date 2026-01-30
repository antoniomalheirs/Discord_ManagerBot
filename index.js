require("dotenv").config();
const discordBot = require("./src/Client");

const ErrorHandler = require("./src/handlers/ErrorHandler");

(async () => {
  try {
    // Inicializa o Anti-Crash antes de tudo
    new ErrorHandler(discordBot).init();

    await discordBot.start();
  } catch (error) {
    console.error("Erro fatal ao iniciar o bot:", error);
  }
})();
