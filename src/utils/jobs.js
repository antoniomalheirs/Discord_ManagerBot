module.exports = {
    "Minerador": {
        minLevel: 5,
        description: "⛏️ Chances de achar itens raros ao trabalhar.",
        bonus: { workMultiplier: 1.2 }
    },
    "Segurança": {
        minLevel: 10,
        description: "🛡️ Proteção passiva contra roubos (10% chance de falhar o ladrão).",
        bonus: { defenseChance: 0.10 }
    },
    "Banqueiro": {
        minLevel: 20,
        description: "🏦 Juros do banco rendem 2x mais (WIP).",
        bonus: { bankInterest: 2.0 }
    },
    "Hacker": {
        minLevel: 30,
        description: "💻 Maior chance de sucesso ao roubar (/crime rob).",
        bonus: { robChance: 0.15 } // +15%
    },
    "Mafioso": {
        minLevel: 50,
        description: "🔫 O Poderoso Chefão. Comanda o servidor.",
        bonus: { allStats: 1.5 }
    }
};
