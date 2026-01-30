const { Events } = require("discord.js");
const mongoose = require("mongoose");
const UsersRepository = require("../../database/mongoose/UsersRepository");
const UserSchema = require("../../database/schemas/UserSchema");
mongoose.model("Users", UserSchema);

// Mapeia os usuários que estão atualmente em chamadas de voz
const activeVoiceUsers = new Map();

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {
      // Verifica se o usuário entrou ou saiu de um canal de voz
      const server = oldState.guild.id;
      const name = newState.member.user.username;

      if (oldState.channelId !== newState.channelId) {
        // Atualiza o tempo em chamadas para o usuário que saiu
        await updateVoiceTime(oldState.member.id, server, name);
      }

      // Verifica se o usuário entrou em um canal de voz
      if (newState.channelId) {
        // Registra o horário de entrada na chamada de voz
        activeVoiceUsers.set(newState.member.id, Date.now());
      }
    } catch (error) {
      console.error("Erro no evento VoiceStateUpdate:", error);
    }
  },
};

// Função para atualizar o tempo em chamadas do usuário no UsersRepository
async function updateVoiceTime(userId, server, name) {
  try {
    const userRepo = new UsersRepository(mongoose, "Users");

    // Se o usuário já existir, incrementa o tempo em chamadas
    if (activeVoiceUsers.has(userId)) {
      const entryTime = activeVoiceUsers.get(userId);
      const currentTime = Date.now();

      // Calcula o tempo em minutos
      const timeInMinutes = Math.floor((currentTime - entryTime) / (1000 * 60));

      if (timeInMinutes > 0) {
        // Obtém (ou cria) o usuário
        const user = await userRepo.getByUserIdAndGuildId(userId, server);

        const newVoiceTime = (user.voiceTime || 0) + timeInMinutes;
        const moneyEarned = timeInMinutes * 1; // $1 por minuto

        // Atualiza as informações do usuário no banco de dados e adiciona dinheiro
        await userRepo.updateByUserIdAndGuildId(userId, server, {
          $set: {
            voiceTime: newVoiceTime,
            username: name,
          },
          $inc: { money: moneyEarned } // Atomic increment for money
        });
      }

      // Remove o usuário da lista de usuários ativos (pois saiu do canal)
      activeVoiceUsers.delete(userId);
    }
  } catch (error) {
    console.error("Erro ao atualizar o tempo em chamadas do usuário:", error);
  }
}
