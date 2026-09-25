const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

/**
 * Telecharge une image et la convertit en data URI base64, format attendu par l'API Discord
 * pour PATCH /guilds/{id}/members/@me (avatar).
 */
async function urlToDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossible de telecharger l'image (HTTP ${res.status}).`);
  const contentType = res.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("L'image depasse la limite de 8 Mo autorisee par Discord.");
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profil-bot")
    .setDescription("Personnalise l'apparence du bot sur ce serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("definir")
        .setDescription("Change le pseudo/avatar/bio du bot sur ce serveur")
        .addStringOption((o) => o.setName("pseudo").setDescription("Pseudo du bot sur ce serveur").setRequired(false))
        .addStringOption((o) => o.setName("avatar").setDescription("URL d'une image (avatar specifique a ce serveur)").setRequired(false))
        .addStringOption((o) => o.setName("banniere").setDescription("URL d'une image (affichee dans /profil-bot voir)").setRequired(false))
        .addStringOption((o) => o.setName("bio").setDescription("Courte description affichee dans /profil-bot voir").setRequired(false))
    )
    .addSubcommand((s) => s.setName("voir").setDescription("Affiche le profil actuel du bot sur ce serveur")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "voir") {
      const embed = new EmbedBuilder()
        .setColor(guildConfig.embedColor || "#9B6FBF")
        .setTitle(`Profil de ${interaction.guild.members.me.displayName}`)
        .setThumbnail(guildConfig.botAvatarUrl || interaction.client.user.displayAvatarURL())
        .setDescription(guildConfig.botBio || "*Aucune bio definie pour ce serveur.*");
      if (guildConfig.botBannerUrl) embed.setImage(guildConfig.botBannerUrl);
      return interaction.reply({ embeds: [embed] });
    }

    // ---------- definir ----------
    const pseudo = interaction.options.getString("pseudo");
    const avatarUrl = interaction.options.getString("avatar");
    const bannerUrl = interaction.options.getString("banniere");
    const bio = interaction.options.getString("bio");

    await interaction.deferReply({ ephemeral: true });
    const data = {};
    const warnings = [];

    if (pseudo !== null) {
      data.botNickname = pseudo;
      try {
        await interaction.guild.members.me.setNickname(pseudo || null);
      } catch (err) {
        warnings.push(`Pseudo Discord non applique (${err.message}). Verifie que le role du bot est bien au-dessus dans la hierarchie.`);
      }
    }

    if (avatarUrl !== null) {
      data.botAvatarUrl = avatarUrl;
      try {
        const dataUri = await urlToDataUri(avatarUrl);
        // Avatar specifique au serveur (profil de membre) - fonctionnalite recente de l'API Discord.
        await interaction.client.rest.patch(`/guilds/${interaction.guild.id}/members/@me`, { body: { avatar: dataUri } });
      } catch (err) {
        warnings.push(
          `Avatar Discord non applique (${err.message}). L'avatar reste toutefois enregistre et affiche dans /profil-bot voir.`
        );
      }
    }

    if (bannerUrl !== null) data.botBannerUrl = bannerUrl;
    if (bio !== null) data.botBio = bio;

    if (Object.keys(data).length) {
      await prisma.guild.update({ where: { id: interaction.guild.id }, data });
    }

    const summary = ["✅ Profil mis a jour.", ...warnings.map((w) => `⚠️ ${w}`)].join("\n");
    return interaction.editReply({ embeds: [warnings.length ? errorEmbed(summary) : successEmbed(summary)] });
  },
};
