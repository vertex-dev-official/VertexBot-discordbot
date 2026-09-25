const { SlashCommandBuilder } = require("discord.js");
const { prisma, getGuildConfig, getMember } = require("../../lib/prisma");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

const COOLDOWN_MS = 60 * 60 * 1000; // 1h

const JOBS = [
  "as livre des pizzas et gagne",
  "as aide un artisan local et recu",
  "as programme un site web et facture",
  "as promene des chiens et gagne",
  "as vendu des legumes au marche pour",
  "as fait un stream et recu des dons pour",
];

module.exports = {
  data: new SlashCommandBuilder().setName("work").setDescription("Travaille pour gagner de l'argent (cooldown 1h)"),

  async execute(interaction) {
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);
    const member = await getMember(interaction.user.id, interaction.guild.id);

    if (member.lastWork && Date.now() - new Date(member.lastWork).getTime() < COOLDOWN_MS) {
      const remaining = COOLDOWN_MS - (Date.now() - new Date(member.lastWork).getTime());
      const minutes = Math.ceil(remaining / 60000);
      return interaction.reply({ embeds: [errorEmbed(`Tu es fatigue, reviens travailler dans **${minutes} min**.`)], ephemeral: true });
    }

    const amount = Math.floor(Math.random() * (guildConfig.workMax - guildConfig.workMin + 1)) + guildConfig.workMin;
    const job = JOBS[Math.floor(Math.random() * JOBS.length)];

    await prisma.member.update({
      where: { id: member.id },
      data: { balance: { increment: amount }, lastWork: new Date() },
    });

    return interaction.reply({ embeds: [successEmbed(`Tu ${job} **${amount} ${guildConfig.currencySymbol}** !`)] });
  },
};
