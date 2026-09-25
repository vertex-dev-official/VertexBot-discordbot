const fs = require("fs");
const path = require("path");

/**
 * Parcourt src/events/** et attache chaque event au client.
 * Chaque fichier doit export { name, once (bool, optionnel), execute(...args, client) }.
 */
function loadEvents(client) {
  const eventsPath = path.join(__dirname, "..", "events");
  const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    if (!event?.name || !event?.execute) {
      console.warn(`[events] ${file} ignore (name/execute manquant)`);
      continue;
    }
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  console.log(`[events] ${files.length} event(s) charge(s).`);
}

module.exports = { loadEvents };
