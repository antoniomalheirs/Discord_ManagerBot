module.exports = {
    energetico: {
        name: "⚡ Bebida Energética",
        price: 1500,
        description: "Recupera 100% da sua energia instantaneamente.",
        type: "consumable",
        effect: "restore_energy"
    },
    algemas: {
        name: "🔒 Algemas de Ouro",
        price: 5000,
        description: "Te protege contra roubos por 24 horas.",
        type: "consumable", // Ou duration
        effect: "protection_24h"
    },
    escudo: {
        name: "🛡️ Escudo Anti-Troll",
        price: 3000,
        description: "Anula a próxima vez que o bot tentaria te trollar (WIP).",
        type: "passive",
        effect: "troll_shield"
    }
};
