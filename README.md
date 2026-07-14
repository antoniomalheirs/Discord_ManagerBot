# 🤖 Discord Manager Bot v2.0

![Discord.js](https://img.shields.io/badge/Discord.js-v14.22+-7289DA?style=for-the-badge&logo=discord&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18.x+-339933?style=for-the-badge&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-8.x-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Termux](https://img.shields.io/badge/Termux-Compatible-black?style=for-the-badge&logo=android&logoColor=white)

Um bot para Discord multifuncional desenvolvido para ser um ponto de partida sólido para seus próprios projetos. Inclui funcionalidades prontas para uso, como notificações de novos vídeos do YouTube, alertas de streams da Twitch, sistema de economia, casino, jogos, e muito mais — tudo integrado com MongoDB Atlas.

**✅ Compatível com Termux (Android sem root)**

## ✨ Índice

- [🚀 Funcionalidades](#-funcionalidades)
- [💻 Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [📋 Pré-requisitos](#-pré-requisitos)
- [⚙️ Instalação e Configuração](#️-instalação-e-configuração)
- [▶️ Executando o Bot](#️-executando-o-bot)
- [📱 Rodando no Termux (Android)](#-rodando-no-termux-android)
- [🤝 Como Contribuir](#-como-contribuir)
- [📝 Licença](#-licença)

---

## 🚀 Funcionalidades

- **🎥 Notificações do YouTube:** Monitore canais do YouTube e envie notificações customizadas quando um novo vídeo for postado.
- **🟣 Alertas da Twitch:** Avise seus membros quando um streamer começar uma transmissão ao vivo.
- **💰 Sistema de Economia:** Carteira, banco, trabalho, roubo, daily, loja de items, pets, jobs e mais.
- **🎰 Casino:** Blackjack, Mines, Duelo, Corrida, Loteria e mais jogos interativos.
- **🃏 Poker:** Sistema completo de Texas Hold'em com apostas.
- **📊 Rank & XP:** Sistema de níveis baseado em mensagens e tempo em voz com ranking.
- **🛡️ Painel Admin:** Central interativa para configurar logging, notificações e moderação.
- **📋 Logging Completo:** Rastreamento de mensagens, canais, cargos, bans, convites e mais.
- **🏗️ Estrutura Modular:** Código organizado para facilitar a adição de novos comandos.
- **💾 Base de Dados:** MongoDB Atlas para persistência de dados.

## 💻 Tecnologias Utilizadas

- **Runtime:** [Node.js](https://nodejs.org/) (v18+)
- **Biblioteca Discord:** [Discord.js](https://discord.js.org/) (v14)
- **Banco de Dados:** [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) com [Mongoose](https://mongoosejs.com/)
- **APIs Externas:**
  - [YouTube Data API v3](https://developers.google.com/youtube/v3)
  - [Twitch API](https://dev.twitch.tv/docs/api/)
- **HTTP:** [Axios](https://axios-http.com/) + Fetch nativo
- **Ambiente:** [Dotenv](https://www.npmjs.com/package/dotenv)

## 📋 Pré-requisitos

- [Node.js](https://nodejs.org/) **v18.0.0 ou superior**
- [NPM](https://www.npmjs.com/) (incluído com Node.js)
- Uma conta no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) (grátis)
- Um Bot registrado no [Portal de Desenvolvedores do Discord](https://discord.com/developers/applications)
- (Opcional) Credenciais da [YouTube Data API](https://console.cloud.google.com/apis/credentials) e da [Twitch API](https://dev.twitch.tv/console/apps)

## ⚙️ Instalação e Configuração

**1. Clone o repositório:**
```bash
git clone https://github.com/SEU_USUARIO/Discord_ManagerBot.git
cd Discord_ManagerBot
```

**2. Instale as dependências:**
```bash
npm install
```

**3. Configure as variáveis de ambiente:**
```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:
```bash
# Discord
TOKEN=SEU_TOKEN_DO_DISCORD
CLIENT_ID=SEU_CLIENT_ID
GUILD_ID=SEU_GUILD_ID

# MongoDB Atlas
MONGODB_URI=mongodb+srv://usuario:senha@cluster.xxxxx.mongodb.net/discordbot

# YouTube (Opcional)
YOUTUBE_API=SUA_CHAVE_YOUTUBE

# Twitch (Opcional)
TWITCH_CLIENTID=SEU_TWITCH_CLIENT_ID
TWITCH_SECRETID=SEU_TWITCH_SECRET
```

**4. Registre os comandos Slash (fazer UMA vez):**
```bash
npm run register
```

## ▶️ Executando o Bot

```bash
npm start
```

Ou com PM2 (produção):
```bash
npx pm2 start ecosystem.config.js
```

### Scripts Disponíveis

| Script | Comando | Descrição |
|--------|---------|-----------|
| `start` | `npm start` | Inicia o bot |
| `register` | `npm run register` | Registra comandos slash globalmente |
| `delete-cmds` | `npm run delete-cmds` | Remove todos os comandos slash |

---

## 📱 Rodando no Termux (Android)

Este bot é **100% compatível com Termux** (sem root necessário).

Resumo rápido:
```bash
pkg update -y && pkg upgrade -y
pkg install -y git nodejs-lts
git clone https://github.com/SEU_USUARIO/Discord_ManagerBot.git ~/bot
cd ~/bot
npm install
cp .env.example .env
nano .env          # Preencher credenciais
npm run register   # Uma vez só
npm start
```

> 📖 Para o guia completo com troubleshooting e dicas de otimização, veja **[TERMUX_SETUP.md](TERMUX_SETUP.md)**

---

## 🤝 Como Contribuir

1. Faça um **Fork** do projeto
2. Crie uma nova Branch (`git checkout -b feature/sua-feature-incrivel`)
3. Faça o Commit de suas alterações (`git commit -m 'Adiciona sua-feature-incrivel'`)
4. Faça o Push para a Branch (`git push origin feature/sua-feature-incrivel`)
5. Abra um **Pull Request**

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.
