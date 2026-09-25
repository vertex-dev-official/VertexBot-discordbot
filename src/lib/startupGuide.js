const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require("discord.js");
const { prisma } = require("./prisma");
const { successEmbed, errorEmbed } = require("./embeds");

/**
 * Gere tous les boutons/modals du salon "guide de demarrage" cree par events/guildCreate.js.
 * Retourne true si l'interaction a ete geree ici (pour que interactionCreate.js sache s'arreter).
 */
async function handleStartupGuideInteraction(interaction) {
  if (interaction.isButton() && interaction.customId === "guide-open-color") {
    const modal = new ModalBuilder()
      .setCustomId("guide-color-modal")
      .setTitle("Couleur des embeds")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("hex")
            .setLabel("Code couleur hexadecimal")
            .setPlaceholder("#9B6FBF")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isButton() && interaction.customId === "guide-open-welcome") {
    const modal = new ModalBuilder()
      .setCustomId("guide-welcome-modal")
      .setTitle("Message de bienvenue")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("salon").setLabel("ID du salon de bienvenue").setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("message")
            .setLabel("Message (variables: {user} {guild} {memberCount})")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        )
      );
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.isButton() && interaction.customId === "guide-done") {
    await interaction.reply({ embeds: [successEmbed("Configuration terminee ! Ce salon va etre supprime.")], ephemeral: true });
    setTimeout(() => interaction.channel?.delete().catch(() => {}), 3000);
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === "guide-color-modal") {
    const hex = interaction.fields.getTextInputValue("hex").trim();
    if (!/^#([0-9A-F]{6})$/i.test(hex)) {
      await interaction.reply({ embeds: [errorEmbed("Format hexadecimal invalide, ex: #9B6FBF.")], ephemeral: true });
      return true;
    }
    await prisma.guild.update({ where: { id: interaction.guild.id }, data: { embedColor: hex } });
    await interaction.reply({ embeds: [successEmbed(`Couleur mise a jour : ${hex}`)], ephemeral: true });
    return true;
  }

  if (interaction.isModalSubmit() && interaction.customId === "guide-welcome-modal") {
    const salonId = interaction.fields.getTextInputValue("salon").trim().replace(/\D/g, "");
    const message = interaction.fields.getTextInputValue("message")?.trim();
    const channel = interaction.guild.channels.cache.get(salonId);

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({ embeds: [errorEmbed("Salon introuvable. Clique droit sur le salon > Copier l'identifiant.")], ephemeral: true });
      return true;
    }

    const data = { welcomeChannelId: channel.id };
    if (message) data.welcomeMessage = message;
    await prisma.guild.update({ where: { id: interaction.guild.id }, data });
    await interaction.reply({ embeds: [successEmbed(`Bienvenue configuree sur ${channel}.`)], ephemeral: true });
    return true;
  }

  return false;
}

module.exports = { handleStartupGuideInteraction };
