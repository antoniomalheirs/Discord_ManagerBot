const { promises } = require("fs");
const path = require("path");

module.exports = class FunctionLoader {
  constructor(client) {
    this.client = client;
  }

  async call() {
    try {
      console.log(`\x1b[1m\x1b[93m[FUNÇÕES]\x1b[0m`, `Funções em Execução.`);
      await this.loadFunctions(path.join(__dirname, "..", "functions"));
    } catch (error) {
      console.error("Error loading functions:", error.message);
    }
  }

  async loadFunctions(functionsPath) {
    try {
      const files = await promises.readdir(functionsPath);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.endsWith(".js")) continue;
        const filePath = path.join(functionsPath, file);
        const loadedFunction = require(filePath);

        if (typeof loadedFunction === "function") {
          loadedFunction.bind(this)(); // Chame a função se necessário
        } else {
          console.warn(`Skipping non-function file: ${file}`);
        }
      }
    } catch (error) {
      console.error("Error loading functions:", error.message);
    }
  }
};

