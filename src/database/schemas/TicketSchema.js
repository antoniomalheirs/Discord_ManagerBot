const { Schema } = require("mongoose");

module.exports = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  userId: { type: String, required: true },
  ticketId: { type: Number, required: true },
  createdAt: { type: Number, default: () => Date.now() },
  closed: { type: Boolean, default: false }
});
