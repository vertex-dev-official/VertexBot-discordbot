const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma, getGuildConfig, getMember } = require("../../lib/prisma");
const { baseEmbed, successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Boutique du serveur")
    .addSubcommand((s) => s.setName("voir").setDescription("Affiche les articles disponibles"))
    .addSubcommand((s) =>
      s
        .setName("acheter")
        .setDescription("Achete un article")
        .addStringOption((o) => o.setName("article").setDescription("Nom exact de l'article").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) =>
      s
        .setName("ajouter")
        .setDescription("[Admin] Ajoute un article a la boutique")
        .addStringOption((o) => o.setName("nom").setDescription("Nom de l'article").setRequired(true))
        .addIntegerOption((o) => o.setName("prix").setDescription("Prix").setRequired(true).setMinValue(1))
        .addStringOption((o) => o.setName("description").setDescription("Description").setRequired(false))
        .addRoleOption((o) => o.setName("role").setDescription("Role donne a l'achat").setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    ),

  async autocomplete(interaction) {
    const items = await prisma.shopItem.findMany({ where: { guildId: interaction.guild.id }, take: 25 });
    const focused = interaction.options.getFocused().toLowerCase();
    const filtered = items.filter((i) => i.name.toLowerCase().includes(focused));
    return interaction.respond(filtered.map((i) => ({ name: `${i.name} - ${i.price}`, value: i.name })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "ajouter") {
      const item = await prisma.shopItem.create({
        data: {
          guildId: interaction.guild.id,
          name: interaction.options.getString("nom"),
          price: interaction.options.getInteger("prix"),
          description: interaction.options.getString("description") || null,
          roleId: interaction.options.getRole("role")?.id || null,
        },
      });
      return interaction.reply({ embeds: [successEmbed(`Article **${item.name}** ajoute a la boutique pour ${item.price} ${guildConfig.currencySymbol}.`)] });
    }

    if (sub === "voir") {
      const items = await prisma.shopItem.findMany({ where: { guildId: interaction.guild.id } });
      if (!items.length) return interaction.reply({ embeds: [errorEmbed("La boutique est vide pour le moment.")] });

      const embed = baseEmbed(guildConfig).setTitle("🛒 Boutique du serveur").setDescription(
        items.map((i) => `${i.emoji} **${i.name}** — ${i.price} ${guildConfig.currencySymbol}${i.description ? `\n> ${i.description}` : ""}`).join("\n\n")
      );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === "acheter") {
      const name = interaction.options.getString("article");
      const item = await prisma.shopItem.findFirst({ where: { guildId: interaction.guild.id, name } });
      if (!item) return interaction.reply({ embeds: [errorEmbed("Article introuvable.")], ephemeral: true });

      const member = await getMember(interaction.user.id, interaction.guild.id);
      if (member.balance < item.price) return interaction.reply({ embeds: [errorEmbed("Solde insuffisant.")], ephemeral: true });

      // Un id deterministe (memberId-itemId) permet de retrouver/incrementer une entree existante
      const inventoryId = `${member.id}-${item.id}`;
      await prisma.$transaction([
        prisma.member.update({ where: { id: member.id }, data: { balance: { decrement: item.price } } }),
        prisma.inventoryItem.upsert({
          where: { id: inventoryId },
          update: { quantity: { increment: 1 } },
          create: { id: inventoryId, memberId: member.id, itemId: item.id, quantity: 1 },
        }),
      ]);

      if (item.roleId) {
        const guildMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        guildMember?.roles.add(item.roleId).catch(() => {});
      }

      return interaction.reply({ embeds: [successEmbed(`Tu as achete **${item.name}** !`)] });
    }
  },
};
