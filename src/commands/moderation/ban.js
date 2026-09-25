const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannit un membre du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName("membre").setDescription("Membre a bannir").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison du bannissement").setRequired(false))
    .addIntegerOption((o) => o.setName("jours-messages").setDescription("Supprimer les messages des X derniers jours (0-7)").setMinValue(0).setMaxValue(7).setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser("membre");
    const reason = interaction.options.getString("raison") || "Aucune raison fournie";
    const deleteDays = interaction.options.getInteger("jours-messages") || 0;
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (guildMember && !guildMember.bannable) {
      return interaction.reply({ embeds: [errorEmbed("Je ne peux pas bannir ce membre (role trop haut).")], ephemeral: true });
    }

    await interaction.guild.members.ban(user.id, { reason, deleteMessageSeconds: deleteDays * 86400 }).catch(() => {});

    await interaction.reply({ embeds: [successEmbed(`${user.tag} a ete banni.\n**Raison:** ${reason}`)] });

    const logsChannel = guildConfig.logsChannelId ? interaction.guild.channels.cache.get(guildConfig.logsChannelId) : null;
    logsChannel?.send({
      embeds: [baseEmbed(guildConfig).setTitle("🔨 Bannissement").addFields(
        { name: "Membre", value: `${user.tag} (${user.id})` },
        { name: "Moderateur", value: `${interaction.user.tag}` },
        { name: "Raison", value: reason }
      ).setTimestamp()],
    }).catch(() => {});
  },
};
