# 📱 Guia Completo — Rodando o Bot no Termux (Android sem Root)

Este guia cobre **tudo** que você precisa para rodar o Discord Bot no Termux, do zero.

---

## ⚠️ Aviso Importante

> O Termux é ótimo para **desenvolvimento e testes**, mas **não é recomendado para hosting 24/7**.
> O Android pode matar processos em segundo plano a qualquer momento.
> Para manter o bot online permanentemente, considere um VPS (Oracle Free Tier, Railway, etc).

---

## 📥 1. Instalar o Termux

> **NÃO** instale o Termux pela Play Store — a versão lá está **desatualizada e quebrada**.

Instale pelo **F-Droid**:
1. Baixe o F-Droid: https://f-droid.org
2. No F-Droid, pesquise **"Termux"**
3. Instale o **Termux** e o **Termux:API** (opcional, útil)

Ou baixe o APK direto do GitHub:
- https://github.com/termux/termux-app/releases

---

## 🔧 2. Configurar o Termux

Abra o Termux e execute estes comandos:

```bash
# Atualizar pacotes
pkg update -y && pkg upgrade -y

# Instalar ferramentas essenciais
pkg install -y git nodejs-lts

# Verificar versões instaladas
node -v    # Deve ser 18+ 
npm -v     # Deve aparecer a versão
git --version
```

### ⚡ Dicas de Performance

```bash
# Permitir acesso ao armazenamento (opcional)
termux-setup-storage

# Instalar editor de texto (opcional)
pkg install -y nano
```

---

## 📂 3. Clonar e Configurar o Bot

```bash
# Ir para o diretório home (NUNCA use /sdcard para projetos Node!)
cd ~

# Clonar o repositório
git clone https://github.com/SEU_USUARIO/Discord_ManagerBot.git
cd Discord_ManagerBot

# Instalar dependências
npm install
```

> ⚠️ **IMPORTANTE**: Sempre mantenha o projeto dentro de `~/` (home do Termux).
> Pastas como `/sdcard/` ou `/storage/` **NÃO suportam symlinks** e o `npm install` vai falhar.

---

## 🔐 4. Configurar o .env

```bash
# Copiar o template
cp .env.example .env

# Editar com nano
nano .env
```

Preencha todas as variáveis:
```
TOKEN=seu_token_do_discord
CLIENT_ID=seu_client_id
GUILD_ID=seu_guild_id
MONGODB_URI=mongodb+srv://...
YOUTUBE_API=sua_chave_youtube
TWITCH_CLIENTID=seu_twitch_client_id
TWITCH_SECRETID=seu_twitch_secret
```

> **Dica**: Use o **MongoDB Atlas** (cloud grátis) para o banco de dados.
> Não é possível rodar MongoDB localmente no Termux sem root.

Para salvar no nano: `Ctrl+O` → `Enter` → `Ctrl+X`

---

## ▶️ 5. Rodar o Bot

```bash
# Registrar os comandos slash (fazer isso UMA VEZ)
npm run register

# Iniciar o bot
npm start
```

Você deve ver no terminal:
```
[SYSTEM] Sistema Anti-Crash Ativado.
[EVENTOS] Eventos Carregados.
[BANCO DE DADOS] Bancos de Dados Operando.
[MONGODB] Conectado ao MongoDB.
[FUNÇÕES] Funções em Execução.
[SLASH COMANDOS] Comandos Slash Carregados e Operando.
Bot está pronto para ser iniciado!
[CLIENTE] Cliente Conectado.
```

---

## 🔄 6. Manter o Bot Rodando em Background

### Método 1: Sessão do Termux (Simples)
- Deslize da **esquerda para direita** no Termux para abrir o menu de sessões
- Crie uma **nova sessão** para usar o terminal enquanto o bot roda

### Método 2: tmux (Recomendado)
```bash
# Instalar tmux
pkg install -y tmux

# Criar uma sessão para o bot
tmux new -s bot

# Dentro do tmux, iniciar o bot
npm start

# Para "desanexar" (bot continua rodando): Ctrl+B depois D

# Para voltar à sessão:
tmux attach -s bot
```

### Método 3: nohup (Background)
```bash
# Rodar em background
nohup node . > bot.log 2>&1 &

# Ver logs
tail -f bot.log

# Parar o bot
kill $(pgrep -f "node .")
```

---

## 🔋 7. Evitar que o Android Mate o Termux

O Android **aggressivamente mata apps em segundo plano**. Para evitar:

### 7.1 Desabilitar Otimização de Bateria
1. **Configurações** → **Bateria** → **Otimização de Bateria**
2. Encontre **Termux** → Selecione **"Não otimizar"**

### 7.2 Notificação Persistente
O Termux já mostra uma notificação persistente. **NÃO remova** essa notificação — ela ajuda o Android a manter o processo vivo.

### 7.3 Termux Wake Lock
```bash
# Manter o Termux acordado (impede sleep)
termux-wake-lock

# Para desativar depois:
termux-wake-unlock
```

### 7.4 Fabricantes Específicos
Alguns fabricantes (Xiaomi, Samsung, Huawei) têm **otimizações extras**:
- **Xiaomi**: Configurações → Apps → Termux → Autostart: ON, Bateria: Sem restrições
- **Samsung**: Configurações → Cuidados → Bateria → Apps que não serão suspensas → Adicionar Termux
- **Huawei**: Configurações → Bateria → Início de app → Termux → Gerenciar manualmente (tudo ON)

---

## 🔄 8. Atualizar o Bot

```bash
cd ~/Discord_ManagerBot

# Puxar atualizações
git pull

# Reinstalar dependências (se package.json mudou)
npm install

# Reiniciar
npm start
```

---

## 🐛 Solução de Problemas

### ❌ `npm install` falha com erro de permissão
```bash
# NUNCA use sudo no Termux. Certifique-se que está em ~/
cd ~
```

### ❌ `ENOSPC: no space on device`
```bash
# Limpar cache do npm
npm cache clean --force
```

### ❌ `Error: Cannot find module`
```bash
# Reinstalar dependências
rm -rf node_modules
npm install
```

### ❌ `MongoNetworkError` ou `ECONNREFUSED`
- Verifique se a URI do MongoDB Atlas está correta no `.env`
- Verifique se seu IP está na whitelist do Atlas (ou use `0.0.0.0/0` para permitir todos)
- Verifique se tem conexão com internet

### ❌ Bot desconecta frequentemente
- Use `termux-wake-lock` antes de iniciar
- Desabilite otimização de bateria
- Considere usar `tmux` para sessões persistentes

---

## 📊 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `npm start` | Iniciar o bot |
| `npm run register` | Registrar comandos slash |
| `npm run delete-cmds` | Deletar todos os comandos |
| `tmux new -s bot` | Criar sessão tmux |
| `tmux attach -s bot` | Reconectar à sessão |
| `termux-wake-lock` | Manter Termux acordado |
| `node -v` | Ver versão do Node.js |
| `free -h` | Ver memória disponível |
| `top` | Monitor de processos |
