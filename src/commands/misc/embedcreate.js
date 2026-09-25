const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { prisma } = require("../../lib/prisma");
const { successEmbed, errorEmbed, buildEmbedFromData } = require("../../lib/embeds");

// Parse un mini-format pour ajouter des champs (fields) directement depuis la commande slash,
// sans avoir a ouvrir le panel web: "Nom1|Valeur1|inline;Nom2|Valeur2|false"
// Le troisieme segment (inline) est optionnel, defaut = false.
function parseFieldsInput(raw) {
  if (!raw) return [];
  return raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, i) => {
      const [name, value, inline] = chunk.split("|").map((s) => (s ?? "").trim());
      return { name: name || `Champ ${i + 1}`, value: value || "-", inline: inline === "true" || inline === "inline", order: i };
    });
}

function embedOptionsFromInteraction(interaction) {
  return {
    title: interaction.options.getString("titre"),
    titleUrl: interaction.options.getString("url"),
    description: interaction.options.getString("description")?.replace(/\\n/g, "\n"),
    color: interaction.options.getString("couleur"),
    imageUrl: interaction.options.getString("image"),
    thumbnailUrl: interaction.options.getString("miniature"),
    authorName: interaction.options.getString("auteur"),
    authorIconUrl: interaction.options.getString("auteur_icone"),
    footerText: interaction.options.getString("footer"),
    footerIconUrl: interaction.options.getString("footer_icone"),
    useTimestamp: interaction.options.getBoolean("timestamp") || false,
    fields: parseFieldsInput(interaction.options.getString("champs")),
  };
}

function embedCommonOptions(sub) {
  return sub
    .addStringOption((o) => o.setName("titre").setDescription("Titre").setRequired(false))
    .addStringOption((o) => o.setName("url").setDescription("Lien cliquable sur le titre").setRequired(false))
    .addStringOption((o) => o.setName("description").setDescription("Description (\\n = retour a la ligne)").setRequired(false))
    .addStringOption((o) => o.setName("couleur").setDescription("Couleur hex, ex: #9B6FBF").setRequired(false))
    .addStringOption((o) => o.setName("image").setDescription("URL d'une image (grande, bas de l'embed)").setRequired(false))
    .addStringOption((o) => o.setName("miniature").setDescription("URL d'une miniature (petite, en haut a droite)").setRequired(false))
    .addStringOption((o) => o.setName("auteur").setDescription("Nom affiche en haut de l'embed").setRequired(false))
    .addStringOption((o) => o.setName("auteur_icone").setDescription("URL de l'icone a cote de l'auteur").setRequired(false))
    .addStringOption((o) => o.setName("footer").setDescription("Texte de pied de page").setRequired(false))
    .addStringOption((o) => o.setName("footer_icone").setDescription("URL de l'icone du footer").setRequired(false))
    .addBooleanOption((o) => o.setName("timestamp").setDescription("Afficher la date/heure actuelle dans le footer").setRequired(false))
    .addStringOption((o) =>
      o
        .setName("champs")
        .setDescription("Champs: Nom1|Valeur1|inline;Nom2|Valeur2")
        .setRequired(false)
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Constructeur d'embeds personnalises (sans coder) - egalement editable depuis le panel web")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) =>
      embedCommonOptions(
        s.setName("envoyer").setDescription("Cree et envoie un embed directement")
      ).addChannelOption((o) => o.setName("salon").setDescription("Salon de destination").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      embedCommonOptions(
        s.setName("sauvegarder").setDescription("Sauvegarde un embed reutilisable, modifiable ensuite depuis le panel web")
      ).addStringOption((o) => o.setName("nom").setDescription("Nom unique pour le retrouver").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("envoyer-sauvegarde")
        .setDescription("Envoie un embed precedemment sauvegarde (cree ici ou depuis le panel web)")
        .addStringOption((o) => o.setName("nom").setDescription("Nom de l'embed sauvegarde").setRequired(true).setAutocomplete(true))
        .addChannelOption((o) => o.setName("salon").setDescription("Salon de destination").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("liste")
        .setDescription("Liste les embeds sauvegardes sur ce serveur")
    ),

  async autocomplete(interaction) {
    const embeds = await prisma.customEmbed.findMany({ where: { guildId: interaction.guild.id }, take: 25 });
    const focused = interaction.options.getFocused().toLowerCase();
    return interaction.respond(embeds.filter((e) => e.name.toLowerCase().includes(focused)).map((e) => ({ name: e.name, value: e.name })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "envoyer") {
      const channel = interaction.options.getChannel("salon");
      const data = embedOptionsFromInteraction(interaction);
      const embed = buildEmbedFromData(data);
      await channel.send({ embeds: [embed] });
      return interaction.reply({ embeds: [successEmbed(`Embed envoye dans ${channel}.`)], ephemeral: true });
    }

    if (sub === "sauvegarder") {
      const name = interaction.options.getString("nom");
      const data = embedOptionsFromInteraction(interaction);

      const existing = await prisma.customEmbed.findFirst({ where: { guildId: interaction.guild.id, name } });
      if (existing) await prisma.embedField.deleteMany({ where: { embedId: existing.id } });

      const saved = await prisma.customEmbed.upsert({
        where: { guildId_name: { guildId: interaction.guild.id, name } },
        update: {
          title: data.title,
          titleUrl: data.titleUrl,
          description: data.description,
          color: data.color || "#9B6FBF",
          imageUrl: data.imageUrl,
          thumbnailUrl: data.thumbnailUrl,
          authorName: data.authorName,
          authorIconUrl: data.authorIconUrl,
          footerText: data.footerText,
          footerIconUrl: data.footerIconUrl,
          useTimestamp: data.useTimestamp,
        },
        create: {
          guildId: interaction.guild.id,
          name,
          title: data.title,
          titleUrl: data.titleUrl,
          description: data.description,
          color: data.color || "#9B6FBF",
          imageUrl: data.imageUrl,
          thumbnailUrl: data.thumbnailUrl,
          authorName: data.authorName,
          authorIconUrl: data.authorIconUrl,
          footerText: data.footerText,
          footerIconUrl: data.footerIconUrl,
          useTimestamp: data.useTimestamp,
        },
      });

      if (data.fields.length) {
        await prisma.embedField.createMany({
          data: data.fields.map((f) => ({ ...f, embedId: saved.id })),
        });
      }

      return interaction.reply({
        embeds: [successEmbed(`Embed **${name}** sauvegarde. Editable et publiable depuis le panel web (onglet Embeds).`)],
        ephemeral: true,
      });
    }

    if (sub === "envoyer-sauvegarde") {
      const name = interaction.options.getString("nom");
      const channel = interaction.options.getChannel("salon");
      const saved = await prisma.customEmbed.findFirst({ where: { guildId: interaction.guild.id, name }, include: { fields: true } });
      if (!saved) return interaction.reply({ embeds: [errorEmbed("Embed sauvegarde introuvable.")], ephemeral: true });

      const sent = await channel.send({ content: saved.content || undefined, embeds: [buildEmbedFromData(saved)] });
      await prisma.customEmbed.update({ where: { id: saved.id }, data: { lastSentChannelId: channel.id, lastSentMessageId: sent.id } });
      return interaction.reply({ embeds: [successEmbed(`Embed **${name}** envoye dans ${channel}.`)], ephemeral: true });
    }

    if (sub === "liste") {
      const embeds = await prisma.customEmbed.findMany({ where: { guildId: interaction.guild.id }, orderBy: { updatedAt: "desc" } });
      if (!embeds.length) return interaction.reply({ embeds: [errorEmbed("Aucun embed sauvegarde. Utilise `/embed sauvegarder` ou le panel web.")], ephemeral: true });

      const list = embeds.map((e) => `• **${e.name}**${e.title ? ` — ${e.title}` : ""}`).join("\n");
      return interaction.reply({ embeds: [successEmbed(`Embeds sauvegardes (${embeds.length}) :\n${list}`)], ephemeral: true });
    }
  },
};
