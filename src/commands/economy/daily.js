const { SlashCommandBuilder } = require("discord.js");
const { prisma, getGuildConfig, getMember } = require("../../lib/prisma");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder().setName("daily").setDescription("Recupere votre recompense quotidienne"),

  async execute(interaction) {
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);
    const member = await getMember(interaction.user.id, interaction.guild.id);

    if (member.lastDaily && Date.now() - new Date(member.lastDaily).getTime() < DAY_MS) {
      const remaining = DAY_MS - (Date.now() - new Date(member.lastDaily).getTime());
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      return interaction.reply({ embeds: [errorEmbed(`Deja recupere ! Reviens dans **${hours}h${minutes}min**.`)], ephemeral: true });
    }

    await prisma.member.update({
      where: { id: member.id },
      data: { balance: { increment: guildConfig.dailyAmount }, lastDaily: new Date() },
    });

    return interaction.reply({
      embeds: [successEmbed(`Tu recuperes ta recompense quotidienne de **${guildConfig.dailyAmount} ${guildConfig.currencySymbol}** !`)],
    });
  },
};
