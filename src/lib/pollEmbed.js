const { EmbedBuilder } = require("discord.js");

const OPTION_EMOJIS = ["🇦", "🇧", "🇨", "🇩", "🇪"];
const BAR_LENGTH = 14;

/**
 * Construit l'embed du sondage avec un graphique en barres textuel qui se met a jour
 * a chaque vote (appele apres chaque interaction bouton pour "editer" le message en direct).
 */
function buildPollEmbed(poll, color) {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
  const maxVotes = Math.max(1, ...poll.options.map((o) => o.votes.length));

  const lines = poll.options.map((o, i) => {
    const votes = o.votes.length;
    const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
    const filled = Math.round((votes / maxVotes) * BAR_LENGTH);
    const bar = "█".repeat(filled) + "░".repeat(BAR_LENGTH - filled);
    return `${OPTION_EMOJIS[i]} **${o.label}**\n${bar}  ${votes} vote${votes > 1 ? "s" : ""} (${pct}%)`;
  });

  const embed = new EmbedBuilder()
    .setColor(color || "#9B6FBF")
    .setTitle(`📊 ${poll.question}`)
    .setDescription(lines.join("\n\n"))
    .setFooter({
      text: poll.ended
        ? `Sondage termine • ${totalVotes} vote${totalVotes > 1 ? "s" : ""} au total`
        : `${totalVotes} vote${totalVotes > 1 ? "s" : ""} au total${poll.multiple ? " • choix multiple autorise" : ""}`,
    });

  if (poll.endsAt && !poll.ended) embed.addFields({ name: "Fin", value: `<t:${Math.floor(new Date(poll.endsAt).getTime() / 1000)}:R>` });

  return embed;
}

module.exports = { buildPollEmbed, OPTION_EMOJIS };
