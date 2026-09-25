const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reactionrole")
    .setDescription("Distribue un role automatiquement via une reaction")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) =>
      s
        .setName("creer")
        .setDescription("Cree un message de roles-reaction (ou en ajoute a un message existant)")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon du message").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) => o.setName("message-id").setDescription("ID d'un message existant, laisser vide pour en creer un").setRequired(false))
        .addStringOption((o) => o.setName("titre").setDescription("Titre si nouveau message").setRequired(false))
        .addStringOption((o) => o.setName("emoji").setDescription("Emoji a utiliser").setRequired(true))
        .addRoleOption((o) => o.setName("role").setDescription("Role a donner").setRequired(true))
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("salon");
    const emoji = interaction.options.getString("emoji");
    const role = interaction.options.getRole("role");
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    let messageId = interaction.options.getString("message-id");
    let message;

    if (messageId) {
      message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) return interaction.reply({ embeds: [errorEmbed("Message introuvable dans ce salon.")], ephemeral: true });
    } else {
      const embed = baseEmbed(guildConfig)
        .setTitle(interaction.options.getString("titre") || "🎭 Roles a la carte")
        .setDescription("Reagis avec l'emoji correspondant pour obtenir le role associe.");
      message = await channel.send({ embeds: [embed] });
      messageId = message.id;
    }

    await message.react(emoji).catch(() => {});

    await prisma.reactionRole.upsert({
      where: { messageId_emoji: { messageId, emoji } },
      update: { roleId: role.id },
      create: { guildId: interaction.guild.id, channelId: channel.id, messageId, emoji, roleId: role.id },
    });

    return interaction.reply({ embeds: [successEmbed(`Reaction ${emoji} → role ${role} configuree sur le message dans ${channel}.`)], ephemeral: true });
  },
};
