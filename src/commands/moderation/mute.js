const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Reduit un membre au silence (timeout Discord)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName("membre").setDescription("Membre a mute").setRequired(true))
    .addIntegerOption((o) => o.setName("minutes").setDescription("Duree en minutes (max 40320 = 28 jours)").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((o) => o.setName("raison").setDescription("Raison").setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser("membre");
    const minutes = interaction.options.getInteger("minutes");
    const reason = interaction.options.getString("raison") || "Aucune raison fournie";
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!guildMember) return interaction.reply({ embeds: [errorEmbed("Membre introuvable.")], ephemeral: true });
    if (!guildMember.moderatable) return interaction.reply({ embeds: [errorEmbed("Je ne peux pas mute ce membre (role trop haut).")], ephemeral: true });

    await guildMember.timeout(minutes * 60 * 1000, reason).catch(() => {});

    await interaction.reply({ embeds: [successEmbed(`${user.tag} est mute pour **${minutes} minute(s)**.\n**Raison:** ${reason}`)] });

    const logsChannel = guildConfig.logsChannelId ? interaction.guild.channels.cache.get(guildConfig.logsChannelId) : null;
    logsChannel?.send({
      embeds: [baseEmbed(guildConfig).setTitle("🔇 Mute").addFields(
        { name: "Membre", value: `${user.tag} (${user.id})` },
        { name: "Duree", value: `${minutes} min` },
        { name: "Moderateur", value: `${interaction.user.tag}` },
        { name: "Raison", value: reason }
      ).setTimestamp()],
    }).catch(() => {});
  },
};
