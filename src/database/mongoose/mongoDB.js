const DBWrapper = require("../DBWrapper");

const mongoose = require("mongoose");
const {
  GuildRepository,
  UserRepository,
  VideoRepository,
  UserAPIRepository,
  TwitchRepository,
} = require("./repositories");

module.exports = class MongoDB extends DBWrapper {
  constructor(options = {}) {
    super(options);
    this.mongoose = mongoose;
  }

  async connect() {
    const OPTIONS = {
      autoIndex: false, // Recommended for production
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    mongoose.connection.on('connected', () => {
      console.log('\x1b[32m[MONGODB]\x1b[0m Conectado ao MongoDB.');
    });

    mongoose.connection.on('error', (err) => {
      console.error(`\x1b[31m[MONGODB]\x1b[0m Erro na conexão: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('\x1b[33m[MONGODB]\x1b[0m Desconectado. Tentando reconectar...');
    });

    return mongoose.connect(process.env.MONGODB_URI, OPTIONS).then((m) => {
      this.guilds = new GuildRepository(m);
      this.users = new UserRepository(m);
      this.videos = new VideoRepository(m);
      this.APIUsers = new UserAPIRepository(m);
      this.twitchs = new TwitchRepository(m);
    });
  }
};
