const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { prisma } = require("../../lib/prisma");
const { successEmbed, errorEmbed, baseEmbed } = require("../../lib/embeds");
const { getGuildConfig } = require("../../lib/prisma");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-category")
    .setDescription("Gere les categories/types de tickets (support, partenariat, signalement...)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("creer")
        .setDescription("Cree un nouveau type de ticket")
        .addStringOption((o) => o.setName("nom").setDescription("Nom affiche, ex: Support technique").setRequired(true))
        .addStringOption((o) => o.setName("emoji").setDescription("Emoji du type de ticket").setRequired(false))
        .addChannelOption((o) => o.setName("categorie-discord").setDescription("Categorie Discord ou creer les salons de ticket").addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        .addRoleOption((o) => o.setName("role-support").setDescription("Role qui aura acces aux tickets de ce type").setRequired(false))
        .addStringOption((o) => o.setName("titre-embed").setDescription("Titre de l'embed d'accueil du ticket").setRequired(false))
        .addStringOption((o) => o.setName("description-embed").setDescription("Description de l'embed d'accueil du ticket").setRequired(false))
    )
    .addSubcommand((s) => s.setName("liste").setDescription("Liste les types de tickets configures"))
    .addSubcommand((s) =>
      s.setName("supprimer").setDescription("Supprime un type de ticket").addStringOption((o) => o.setName("nom").setDescription("Nom exact").setRequired(true).setAutocomplete(true))
    ),

  async autocomplete(interaction) {
    const cats = await prisma.ticketCategory.findMany({ where: { guildId: interaction.guild.id }, take: 25 });
    const focused = interaction.options.getFocused().toLowerCase();
    return interaction.respond(cats.filter((c) => c.name.toLowerCase().includes(focused)).map((c) => ({ name: c.name, value: c.name })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "creer") {
      const category = await prisma.ticketCategory.create({
        data: {
          guildId: interaction.guild.id,
          name: interaction.options.getString("nom"),
          emoji: interaction.options.getString("emoji") || "🎫",
          discordCategoryId: interaction.options.getChannel("categorie-discord")?.id || null,
          supportRoleIds: interaction.options.getRole("role-support") ? [interaction.options.getRole("role-support").id] : [],
          welcomeEmbedTitle: interaction.options.getString("titre-embed") || "Nouveau ticket",
          welcomeEmbedDescription: interaction.options.getString("description-embed") || "Merci de decrire votre demande, un membre du staff va repondre.",
        },
      });
      return interaction.reply({ embeds: [successEmbed(`Type de ticket **${category.emoji} ${category.name}** cree. Ajoute-le a un panel avec \`/ticket-panel creer\`.`)] });
    }

    if (sub === "liste") {
      const cats = await prisma.ticketCategory.findMany({ where: { guildId: interaction.guild.id } });
      if (!cats.length) return interaction.reply({ embeds: [errorEmbed("Aucun type de ticket configure.")] });
      const embed = baseEmbed(guildConfig)
        .setTitle("🎫 Types de tickets")
        .setDescription(cats.map((c) => `${c.emoji} **${c.name}** ${c.discordCategoryId ? `→ <#${c.discordCategoryId}>` : ""}`).join("\n"));
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "supprimer") {
      const name = interaction.options.getString("nom");
      const cat = await prisma.ticketCategory.findFirst({ where: { guildId: interaction.guild.id, name } });
      if (!cat) return interaction.reply({ embeds: [errorEmbed("Type de ticket introuvable.")], ephemeral: true });
      await prisma.ticketCategory.delete({ where: { id: cat.id } });
      return interaction.reply({ embeds: [successEmbed(`Type de ticket **${name}** supprime.`)] });
    }
  },
};
