const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { prisma } = require("../lib/prisma");

module.exports = {
  name: "guildCreate",
  async execute(guild) {
    await prisma.guild
      .upsert({
        where: { id: guild.id },
        update: { name: guild.name, icon: guild.iconURL() || null },
        create: { id: guild.id, name: guild.name, icon: guild.iconURL() || null },
      })
      .catch((e) => console.error("[guildCreate]", e));

    console.log(`[guildCreate] Ajoute au serveur ${guild.name} (${guild.id})`);
    await createStartupGuide(guild).catch((e) => console.error("[guildCreate] guide de demarrage", e));
  },
};

/**
 * Cree un salon "guide de demarrage" visible uniquement par les membres qui peuvent gerer
 * le serveur, avec un embed + des boutons pour configurer rapidement le bot sans taper de commandes.
 */
async function createStartupGuide(guild) {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return; // pas la permission, on ne bloque pas l'ajout du bot

  const channel = await guild.channels.create({
    name: "🚀・demarrage",
    type: ChannelType.GuildText,
    topic: "Guide de configuration rapide de Voxy - visible uniquement par les administrateurs.",
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ...guild.roles.cache
        .filter((r) => r.permissions.has(PermissionFlagsBits.ManageGuild))
        .map((r) => ({ id: r.id, allow: [PermissionFlagsBits.ViewChannel] })),
    ],
  });

  await prisma.guild.update({ where: { id: guild.id }, data: { startupGuideChannelId: channel.id } });

  const embed = new EmbedBuilder()
    .setColor("#9B6FBF")
    .setTitle("👋 Bienvenue, configurons le bot ensemble")
    .setDescription(
      [
        "Merci d'avoir ajoute le bot ! Ce salon n'est visible que par les administrateurs.",
        "",
        "Utilise les boutons ci-dessous pour regler l'essentiel en quelques clics, ou passe directement par le **panel web** pour une configuration complete (embeds, tickets, economie...).",
        "",
        "Tu peux supprimer ce salon a tout moment une fois la configuration terminee.",
      ].join("\n")
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("guide-open-color").setLabel("🎨 Couleur des embeds").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("guide-open-welcome").setLabel("👋 Message de bienvenue").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("guide-done").setLabel("✅ Terminer et supprimer ce salon").setStyle(ButtonStyle.Success)
  );

  const components = [row1];
  if (process.env.DASHBOARD_URL) {
    components.unshift(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("🌐 Ouvrir le panel web").setStyle(ButtonStyle.Link).setURL(`${process.env.DASHBOARD_URL}/dashboard/${guild.id}`)
      )
    );
  }

  await channel.send({ embeds: [embed], components }).catch(() => {});
}
