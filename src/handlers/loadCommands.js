const fs = require("fs");
const path = require("path");

/**
 * Parcourt src/commands/** et attache chaque commande dans client.commands.
 * Chaque fichier doit export { data (SlashCommandBuilder), execute(interaction) }.
 */
function loadCommands(client) {
  const commandsPath = path.join(__dirname, "..", "commands");
  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const command = require(path.join(categoryPath, file));
      if (!command?.data || !command?.execute) {
        console.warn(`[commands] ${file} ignore (data/execute manquant)`);
        continue;
      }
      command.category = category;
      client.commands.set(command.data.name, command);
    }
  }

  console.log(`[commands] ${client.commands.size} commande(s) chargee(s).`);
}

function getAllCommandsJSON(client) {
  return [...client.commands.values()].map((c) => c.data.toJSON());
}

module.exports = { loadCommands, getAllCommandsJSON };
