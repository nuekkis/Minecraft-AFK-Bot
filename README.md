9<!-- Last updated: 2025-08-21T17:25:27Z -->
# 🤖 Minecraft AFK Bot (Mineflayer-Based)

This is a lightweight Minecraft Java AFK Bot powered by [Mineflayer](https://github.com/PrismarineJS/mineflayer). It connects to a Java server, performs basic movements to avoid AFK detection, and can be customized via a simple configuration file.

<a href="https://discord.gg/SjQydGvs5p" target="_blank">
  <img src="https://img.shields.io/badge/Discord-Join-7289DA?style=for-the-badge&logo=discord&logoColor=white" alt="Discord" width="300">
</a>

# ⭐ Star this project, fork and use!

## ⚠️ Warning Before You Begin

- Before starting the bot, please make sure that the Offline Mode (Pirated/Not Original) option in the settings section of your Aternos server is active.

- Secure the bot to protect it from monsters in the game.

---

## ✨ Features

* Connect to Minecraft Java servers (IP + port)
* Customize bot username
* Control chunk loading and memory usage
* Periodic chunk pruning to reduce resource usage
* Auto-movement behavior: step forward/backward, jump, sneak, loop
* Easy configuration via `config.json`

---

## ⚡ Installation

### 1. Clone the repository

```bash
git clone https://github.com/nuekkis/Minecraft-AFK-Bot.git
cd Minecraft-AFK-Bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure `config.json`

```json
{
  "serverHost": "indocrafts.minefort.com",
  "serverPort": 25565,
  "botUsername": "Op bhai432",
  "botChunk": 4
}
```

> ⚠️ Make sure the server is in offline mode if you're not using premium accounts.

---

## 🤖 Starting the Bot

```bash
node bot.js
```

On successful connection:

* You'll see `✅ BotName is Ready!` in the console
* After 5 seconds, all loaded chunks are cleared
* Every 20 seconds, any chunks beyond a 6-chunk radius will be removed

---

## ⚙️ Configuration Options (`config.json`)

| Key            | Description                                |
| -------------- | ------------------------------------------ |
| `serverHost`         | IP or domain of your Minecraft server      |
| `serverPort`         | Server port (default is 25565)             |
| `botUsername`     | The bot's visible name in-game             |
| `botChunk` | Radius of loaded chunks (recommended: 1–6) |

---

## ⚠️ Notes

* **Skins**: Skins might not appear properly if the server is in offline mode.
* **Sneak Movement**: The bot uses `setControlState('sneak', true)`, but some servers may block or ignore this action.
* **AFK Prevention**: The bot periodically moves, sneaks, and jumps to prevent disconnection due to inactivity.

---

## 📚 Resources & Contributions

* [Mineflayer Docs](https://mineflayer.prismarine.js.org/)
* [PrismarineJS GitHub](https://github.com/PrismarineJS/)

Feel free to contribute by opening a pull request or submitting an issue.

---

## 📄 License

This project is licensed under the MIT License.

---

Get started now and keep your server active with a smart, customizable bot! ⛏️
