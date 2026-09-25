const { EmbedBuilder } = require("discord.js");

/**
 * Cree un embed de base utilisant la couleur configuree par le serveur.
 * @param {import("@prisma/client").Guild} guildConfig
 */
function baseEmbed(guildConfig) {
  return new EmbedBuilder().setColor(guildConfig?.embedColor || "#9B6FBF");
}

/**
 * Remplace les variables {user}, {guild}, {memberCount}, {level} etc. dans un texte.
 */
function formatTemplate(template, vars = {}) {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
}

/**
 * Construit un EmbedBuilder discord.js a partir d'un CustomEmbed (+ fields) sauvegarde en base,
 * qu'il vienne de la commande /embed ou de l'editeur du panel web. Les deux cotes utilisent
 * exactement la meme forme de donnees pour rester en synchro.
 */
function buildEmbedFromData(data) {
  const { EmbedBuilder } = require("discord.js");
  const embed = new EmbedBuilder().setColor(data.color || "#9B6FBF");

  if (data.title) embed.setTitle(data.title);
  if (data.titleUrl) embed.setURL(data.titleUrl);
  if (data.description) embed.setDescription(data.description);
  if (data.imageUrl) embed.setImage(data.imageUrl);
  if (data.thumbnailUrl) embed.setThumbnail(data.thumbnailUrl);
  if (data.authorName) embed.setAuthor({ name: data.authorName, iconURL: data.authorIconUrl || undefined, url: data.authorUrl || undefined });
  if (data.footerText) embed.setFooter({ text: data.footerText, iconURL: data.footerIconUrl || undefined });
  if (data.useTimestamp) embed.setTimestamp();

  const fields = (data.fields || [])
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((f) => f.name && f.value)
    .map((f) => ({ name: f.name, value: f.value, inline: !!f.inline }));
  if (fields.length) embed.addFields(fields);

  return embed;
}

function errorEmbed(text) {
  return new EmbedBuilder().setColor("#ED4245").setDescription(`❌ ${text}`);
}

function successEmbed(text) {
  return new EmbedBuilder().setColor("#57F287").setDescription(`✅ ${text}`);
}

module.exports = { baseEmbed, formatTemplate, errorEmbed, successEmbed, buildEmbedFromData };
