const { Schema } = require("mongoose");

module.exports = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  prize: { type: String, required: true },
  winnersCount: { type: Number, default: 1 },
  hostId: { type: String, required: true },
  endAt: { type: Number, required: true },
  ended: { type: Boolean, default: false },
  participants: { type: [String], default: [] }
});
