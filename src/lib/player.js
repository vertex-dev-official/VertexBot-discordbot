const { Player } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");

let player;

/**
 * Initialise (une seule fois) l'instance globale de discord-player,
 * attachee au client pour etre reutilisee par toutes les commandes musique.
 */
async function initPlayer(client) {
  if (player) return player;
  player = new Player(client);
  await player.extractors.loadMulti(DefaultExtractors);

  player.events.on("playerStart", (queue, track) => {
    queue.metadata?.channel?.send(`▶️ Lecture en cours : **${track.title}**`).catch(() => {});
  });
  player.events.on("emptyQueue", (queue) => {
    queue.metadata?.channel?.send("🏁 File d'attente terminee.").catch(() => {});
  });
  player.events.on("error", (queue, error) => console.error("[player error]", error));
  player.events.on("playerError", (queue, error) => console.error("[player error]", error));

  return player;
}

function getPlayer() {
  return player;
}

module.exports = { initPlayer, getPlayer };
