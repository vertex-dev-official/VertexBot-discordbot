const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Cree le panel (menu deroulant) permettant d'ouvrir des tickets")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("creer")
        .setDescription("Publie un panel de tickets dans un salon")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon ou publier le panel").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) => o.setName("titre").setDescription("Titre du panel").setRequired(false))
        .addStringOption((o) => o.setName("description").setDescription("Description du panel").setRequired(false))
        .addStringOption((o) => o.setName("couleur").setDescription("Couleur hex de l'embed").setRequired(false))
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("salon");
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    const categories = await prisma.ticketCategory.findMany({ where: { guildId: interaction.guild.id } });
    if (!categories.length) {
      return interaction.reply({
        embeds: [errorEmbed("Cree au moins un type de ticket avant de publier un panel : `/ticket-category creer`.")],
        ephemeral: true,
      });
    }

    const title = interaction.options.getString("titre") || "🎫 Support";
    const description = interaction.options.getString("description") || "Selectionne une categorie ci-dessous pour ouvrir un ticket.";
    const color = interaction.options.getString("couleur") || guildConfig.embedColor;

    const embed = baseEmbed(guildConfig).setColor(color).setTitle(title).setDescription(description);

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket-panel-select")
      .setPlaceholder("Choisis une categorie de ticket")
      .addOptions(
        categories.slice(0, 25).map((c) => ({ label: c.name, value: c.id, emoji: c.emoji || "🎫" }))
      );

    const message = await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });

    await prisma.ticketPanel.create({
      data: { guildId: interaction.guild.id, channelId: channel.id, messageId: message.id, title, description, color },
    });

    return interaction.reply({ embeds: [successEmbed(`Panel de tickets publie dans ${channel}.`)], ephemeral: true });
  },

  // ---------------------------------------------------------------
  // Ouverture d'un ticket via le menu deroulant du panel
  // ---------------------------------------------------------------
  async handleTicketSelect(interaction, client) {
    void client;
    await interaction.deferReply({ ephemeral: true });
    const categoryId = interaction.values[0];
    const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId } });
    if (!category) return interaction.editReply({ embeds: [errorEmbed("Ce type de ticket n'existe plus.")] });

    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    const existing = await prisma.ticket.findFirst({
      where: { guildId: interaction.guild.id, categoryId, openerId: interaction.user.id, status: "open" },
    });
    if (existing) {
      return interaction.editReply({ embeds: [errorEmbed(`Tu as deja un ticket ouvert : <#${existing.channelId}>`)] });
    }

    const overwrites = [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: interaction.client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
      },
      ...category.supportRoleIds.map((roleId) => ({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      })),
    ];

    const channel = await interaction.guild.channels.create({
      name: `${category.emoji || "🎫"}-${interaction.user.username}`.slice(0, 90),
      type: ChannelType.GuildText,
      parent: category.discordCategoryId || undefined,
      permissionOverwrites: overwrites,
    });

    const ticket = await prisma.ticket.create({
      data: { guildId: interaction.guild.id, categoryId, channelId: channel.id, openerId: interaction.user.id },
    });

    const welcomeEmbed = baseEmbed(guildConfig)
      .setTitle(category.welcomeEmbedTitle || "Nouveau ticket")
      .setDescription(category.welcomeEmbedDescription || "Merci de decrire votre demande.")
      .addFields({ name: "Ouvert par", value: `${interaction.user}` }, { name: "Categorie", value: category.name })
      .setTimestamp();

    const closeButton = new ButtonBuilder().setCustomId("ticket-close").setLabel("Fermer le ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger);

    const pingRoles = category.supportRoleIds.map((r) => `<@&${r}>`).join(" ");

    await channel.send({
      content: `${interaction.user} ${pingRoles}`.trim(),
      embeds: [welcomeEmbed],
      components: [new ActionRowBuilder().addComponents(closeButton)],
    });

    return interaction.editReply({ embeds: [successEmbed(`Ticket cree : ${channel}`)] });
  },

  // ---------------------------------------------------------------
  // Fermeture d'un ticket
  // ---------------------------------------------------------------
  async handleTicketClose(interaction) {
    const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channel.id, status: "open" } });
    if (!ticket) return interaction.reply({ embeds: [errorEmbed("Ce salon n'est pas un ticket ouvert.")], ephemeral: true });

    await interaction.reply({ embeds: [successEmbed("Ticket ferme. Ce salon sera supprime dans 10 secondes.")] });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "closed", closedById: interaction.user.id, closedAt: new Date() },
    });

    setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
  },
};
