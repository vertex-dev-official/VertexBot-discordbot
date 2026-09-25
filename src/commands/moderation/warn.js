const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, successEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Donne un avertissement a un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("membre").setDescription("Membre a avertir").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison de l'avertissement").setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser("membre");
    const reason = interaction.options.getString("raison");
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    await prisma.warning.create({
      data: { guildId: interaction.guild.id, userId: user.id, moderatorId: interaction.user.id, reason },
    });

    const count = await prisma.warning.count({ where: { guildId: interaction.guild.id, userId: user.id } });

    await interaction.reply({ embeds: [successEmbed(`${user.tag} a recu un avertissement (total: **${count}**).\n**Raison:** ${reason}`)] });

    user.send(`⚠️ Tu as recu un avertissement sur **${interaction.guild.name}**.\nRaison: ${reason}`).catch(() => {});

    const logsChannel = guildConfig.logsChannelId ? interaction.guild.channels.cache.get(guildConfig.logsChannelId) : null;
    logsChannel?.send({
      embeds: [baseEmbed(guildConfig).setTitle("⚠️ Avertissement").addFields(
        { name: "Membre", value: `${user.tag} (${user.id})` },
        { name: "Total", value: `${count}` },
        { name: "Moderateur", value: `${interaction.user.tag}` },
        { name: "Raison", value: reason }
      ).setTimestamp()],
    }).catch(() => {});

    // Automod: mute automatique si trop d'avertissements
    const automod = guildConfig.automodConfig || {};
    const threshold = automod.maxWarnBeforeMute || 3;
    if (count >= threshold) {
      const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (guildMember?.moderatable) {
        await guildMember.timeout(10 * 60 * 1000, "Trop d'avertissements").catch(() => {});
        logsChannel?.send(`🔇 ${user.tag} a atteint ${count} avertissements et a ete mute automatiquement 10 minutes.`).catch(() => {});
      }
    }
  },
};
