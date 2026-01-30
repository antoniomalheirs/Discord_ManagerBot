const Repository = require("../Repository.js");

module.exports = class UserRepository extends Repository {
  constructor(mongoose, model) {
    super();

    if (!mongoose || !model)
      throw new Error("O modelo de usuário não pode ser nulo.");
    this.mongoose = mongoose;

    this.model = typeof model === "string" ? mongoose.model(model) : model;
  }

  parse(entity) {
    if (entity) {
      return {
        codigouser: entity.codigouser ? String(entity.codigouser) : null,
        username: entity.username,
        voiceTime: entity.voiceTime || 0,
        totalMessages: entity.totalMessages || 0,
        idguild: entity.idguild || "nada encontrado",
        money: entity.money || 0,
        bank: entity.bank || 0,
        lastDaily: entity.lastDaily || 0,
        dailyStreak: entity.dailyStreak || 0,
        lastWork: entity.lastWork || 0,
        lastRob: entity.lastRob || 0,
        lastInterestClaim: entity.lastInterestClaim || 0,
        background: entity.background || "default",
        ownedBackgrounds: entity.ownedBackgrounds || ["default"],
        energy: entity.energy || 50,
        lastEnergyUpdate: entity.lastEnergyUpdate || Date.now(),
        inventory: entity.inventory || [],
        protectionExpires: entity.protectionExpires || 0,
        trollShieldExpires: entity.trollShieldExpires || 0,
        job: entity.job || "Desempregado",
        pets: entity.pets || [],
        activePet: entity.activePet || "",
      };
    } else {
      return null;
    }
  }

  add(entity) {
    return this.model.create(entity).then(this.parse);
  }

  findOne(codigouser, projection) {
    return this.model.findOne({ codigouser }, projection).then(this.parse);
  }

  findByUsername(username, projection) {
    return this.model.findOne({ username }, projection).then(this.parse);
  }

  findByGuildId(idguild, projection) {
    return this.model
      .findOne({ idguild }, projection)
      .then((result) => (result ? this.parse(result) : false));
  }

  get size() {
    return this.model.find({}).then((e) => e.length);
  }

  get(codigouser, projection) {
    return this.model
      .findOne({ codigouser }, projection)
      .then((entity) =>
        entity ? this.parse(entity) : this.add({ codigouser })
      );
  }

  getByUserIdAndGuildId(codigouser, idguild, projection) {
    return this.model
      .findOne({ codigouser, idguild }, projection)
      .then((entity) =>
        entity ? this.parse(entity) : this.add({ codigouser, idguild })
      );
  }


  getAllUniqueYoutubeAttributes() {
    return this.model.distinct("codigouser").exec();
  }

  remove(codigouser) {
    return this.model.findOneAndDelete({ codigouser }).then(this.parse);
  }

  update(codigouser, entity, options = { upsert: true }) {
    return this.model.updateOne({ codigouser }, entity, options);
  }

  updateByUserIdAndGuildId(codigouser, idguild, entity, options = { upsert: true }) {
    return this.model.updateOne({ codigouser, idguild }, entity, options);
  }


  async verify(codigouser) {
    return !!(await this.model.findOne({ codigouser }));
  }

  findAll(projection) {
    return this.model.find({}, projection).then((e) => e.map(this.parse));
  }

  findAllByGuildId(guildId, projection) {
    return this.model
      .find({ idguild: guildId }, projection)
      .then((results) => results.map(this.parse));
  }
};
