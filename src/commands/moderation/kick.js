const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulse un membre du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName("membre").setDescription("Membre a expulser").setRequired(true))
    .addStringOption((o) => o.setName("raison").setDescription("Raison de l'expulsion").setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser("membre");
    const reason = interaction.options.getString("raison") || "Aucune raison fournie";
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    const guildMember = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!guildMember) return interaction.reply({ embeds: [errorEmbed("Membre introuvable sur ce serveur.")], ephemeral: true });
    if (!guildMember.kickable) return interaction.reply({ embeds: [errorEmbed("Je ne peux pas expulser ce membre (role trop haut).")], ephemeral: true });

    await guildMember.kick(reason).catch(() => {});

    const embed = successEmbed(`${user.tag} a ete expulse.\n**Raison:** ${reason}`);
    await interaction.reply({ embeds: [embed] });

    const logsChannel = guildConfig.logsChannelId ? interaction.guild.channels.cache.get(guildConfig.logsChannelId) : null;
    logsChannel?.send({
      embeds: [baseEmbed(guildConfig).setTitle("👢 Expulsion").addFields(
        { name: "Membre", value: `${user.tag} (${user.id})` },
        { name: "Moderateur", value: `${interaction.user.tag}` },
        { name: "Raison", value: reason }
      ).setTimestamp()],
    }).catch(() => {});
  },
};
