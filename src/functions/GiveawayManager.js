const mongoose = require("mongoose");
const { EmbedBuilder } = require("discord.js");

module.exports = function () {
  const GiveawaySchema = require("../database/schemas/GiveawaySchema");
  let GiveawayModel;
  
  try {
    GiveawayModel = mongoose.model("Giveaways");
  } catch {
    GiveawayModel = mongoose.model("Giveaways", GiveawaySchema);
  }

  setInterval(async () => {
    try {
      const now = Date.now();
      const expiredGiveaways = await GiveawayModel.find({ endAt: { $lte: now }, ended: false });

      for (const giveaway of expiredGiveaways) {
        try {
          const channel = await this.client.channels.fetch(giveaway.channelId);
          const message = await channel.messages.fetch(giveaway.messageId);
          
          const reaction = message.reactions.cache.get("🎉");
          if (!reaction) throw new Error("Sem reação");

          const users = await reaction.users.fetch();
          const validUsers = users.filter(u => !u.bot).map(u => u.id);

          if (validUsers.length === 0) {
            giveaway.ended = true;
            await giveaway.save();
            const failEmbed = new EmbedBuilder().setTitle("🎉 Sorteio Encerrado").setDescription(`Ninguém participou do sorteio de **${giveaway.prize}**.\n\n**Vencedor:** Ninguém`).setColor("#2F3136");
            await message.edit({ embeds: [failEmbed] });
            continue;
          }

          const winners = [];
          for (let i = 0; i < Math.min(giveaway.winnersCount, validUsers.length); i++) {
            const randomIndex = Math.floor(Math.random() * validUsers.length);
            winners.push(validUsers[randomIndex]);
            validUsers.splice(randomIndex, 1);
          }

          const winnersStr = winners.map(id => `<@${id}>`).join(", ");

          giveaway.ended = true;
          await giveaway.save();

          const winEmbed = new EmbedBuilder().setTitle("🎉 Sorteio Encerrado").setDescription(`Parabéns aos vencedores do sorteio de **${giveaway.prize}**!\n\n**Vencedores:** ${winnersStr}`).setColor("#00FF00");
          await message.edit({ embeds: [winEmbed] });
          await message.reply(`🎉 Parabéns ${winnersStr}! Vocês ganharam **${giveaway.prize}**!`);
        } catch (err) {
          console.error("Giveaway erro na msg: ", err.message);
          giveaway.ended = true;
          await giveaway.save();
        }
      }
    } catch (err) {
      console.error("Giveaway Checker Error:", err);
    }
  }, 30000);
};
