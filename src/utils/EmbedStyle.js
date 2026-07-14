const { EmbedBuilder } = require("discord.js");

const COLORS = {
    PRIMARY: "#5865F2",
    SUCCESS: "#57F287",
    ERROR: "#ED4245",
    WARNING: "#FEE75C",
    ECONOMY: "#F1C40F",
    CASINO: "#9B59B6",
    INFO: "#3498DB",
    RANK: "#00FFFF",
    ADMIN: "#2C3E50",
    CRIME: "#E74C3C",
};

const SEP = "━━━━━━━━━━━━━━━━━━━━━━━━━━";

const WORK_SCENARIOS = [
    { emoji: "🔧", text: "Você consertou 12 máquinas na fábrica" },
    { emoji: "📦", text: "Você entregou 30 pacotes pela cidade" },
    { emoji: "💻", text: "Você programou um sistema para uma empresa" },
    { emoji: "🍳", text: "Você cozinhou 50 pratos no restaurante" },
    { emoji: "🏗️", text: "Você construiu uma parede no canteiro de obras" },
    { emoji: "🚗", text: "Você fez 8 corridas de Uber" },
    { emoji: "🎨", text: "Você pintou um mural incrível no centro" },
    { emoji: "📊", text: "Você organizou os relatórios do escritório" },
    { emoji: "🛒", text: "Você repôs todas as prateleiras do mercado" },
    { emoji: "🔌", text: "Você instalou a fiação de 3 apartamentos" },
];

const WORK_SCENARIOS_POLICE = [
    { emoji: "👮", text: "Você prendeu 3 ladrões no centro da cidade" },
    { emoji: "🚔", text: "Você fez uma blitz e multou 5 carros" },
    { emoji: "🕵️", text: "Você desvendou um caso de fraude" },
];

const WORK_SCENARIOS_HACKER = [
    { emoji: "🖥️", text: "Você invadiu um servidor e vendeu os dados" },
    { emoji: "💾", text: "Você descriptografou arquivos sigilosos" },
    { emoji: "🔓", text: "Você crackeou um software premium" },
];

const WORK_SCENARIOS_BANKER = [
    { emoji: "🏦", text: "Você aprovou 10 empréstimos lucrativos" },
    { emoji: "📈", text: "Você fez investimentos certeiros no mercado" },
    { emoji: "💳", text: "Você processou transações milionárias" },
];

function getWorkScenario(job) {
    if (job === "Police") return WORK_SCENARIOS_POLICE[Math.floor(Math.random() * WORK_SCENARIOS_POLICE.length)];
    if (job === "Hacker") return WORK_SCENARIOS_HACKER[Math.floor(Math.random() * WORK_SCENARIOS_HACKER.length)];
    if (job === "Banker") return WORK_SCENARIOS_BANKER[Math.floor(Math.random() * WORK_SCENARIOS_BANKER.length)];
    return WORK_SCENARIOS[Math.floor(Math.random() * WORK_SCENARIOS.length)];
}

function success(title, desc) {
    return new EmbedBuilder().setColor(COLORS.SUCCESS).setTitle(`✅ ${title}`).setDescription(desc).setTimestamp();
}

function error(title, desc) {
    return new EmbedBuilder().setColor(COLORS.ERROR).setTitle(`❌ ${title}`).setDescription(desc).setTimestamp();
}

function warning(title, desc) {
    return new EmbedBuilder().setColor(COLORS.WARNING).setTitle(`⚠️ ${title}`).setDescription(desc).setTimestamp();
}

function cooldownMsg(nextTimestamp) {
    const unix = Math.floor(nextTimestamp / 1000);
    return `⏳ Tente novamente <t:${unix}:R>`;
}

function formatMoney(n) {
    return `$${Number(n).toLocaleString()}`;
}

function progressBar(percent, length = 14) {
    const filled = Math.round(percent * length);
    return "▓".repeat(filled) + "░".repeat(length - filled);
}

module.exports = { COLORS, SEP, success, error, warning, cooldownMsg, formatMoney, progressBar, getWorkScenario };
