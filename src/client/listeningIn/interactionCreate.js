const { Events } = require("discord.js");
const discordBot = require("../../Client");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const commands = discordBot.getCommands();

    // 1. Chat Input Command
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);

      if (!command) {
        console.error(
          `Não existe nenhum comando com nome de: ${interaction.commandName}`
        );
        return;
      }

      try {
        console.log(`Executando comando: ${command.data.name}`);
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "Erro ao executar comando",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "Erro ao executar comando",
            ephemeral: true,
          });
        }
      }
      return;
    }

    // 2. Autocomplete
    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;

      try {
        if (command.autocomplete) {
          await command.autocomplete(interaction);
        }
      } catch (error) {
        console.error("Erro no autocomplete:", error);
      }
      return;
    }
  },
};
