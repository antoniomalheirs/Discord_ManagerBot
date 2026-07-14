const { REST, Routes } = require("discord.js");
require("dotenv").config();
const fs = require("fs");
const path = require("path"); // 1. Importe o módulo 'path'

const commandsPath = "./src/slash";
const commandFiles = require("fs")
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

const commands = [];
for (const file of commandFiles) {
  const command = require(`${commandsPath}/${file}`);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN || process.env.TOKEN);

(async () => {
  try {
    console.log(`Iniciando o registro de ${commands.length} comandos (/) globais.`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      {
        body: commands
      }
    );

    console.log(`Sucesso! ${data.length} comandos (/) globais foram registrados.`);
  } catch (error) {
    console.error(error);
  }
})();