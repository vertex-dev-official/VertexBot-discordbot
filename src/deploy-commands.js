require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];
const commandsPath = path.join(__dirname, "commands");

for (const category of fs.readdirSync(commandsPath)) {
  const categoryPath = path.join(commandsPath, category);
  if (!fs.statSync(categoryPath).isDirectory()) continue;
  for (const file of fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js"))) {
    const command = require(path.join(categoryPath, file));
    if (command?.data) commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Deploiement de ${commands.length} commande(s)...`);

    const route = process.env.DEV_GUILD_ID
      ? Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DEV_GUILD_ID)
      : Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);

    await rest.put(route, { body: commands });

    console.log(
      process.env.DEV_GUILD_ID
        ? "Commandes deployees sur le serveur de dev (instantane)."
        : "Commandes deployees globalement (jusqu'a 1h de propagation)."
    );
  } catch (error) {
    console.error(error);
  }
})();
