const { SlashCommandBuilder } = require("discord.js");
const { getGuildConfig, getMember } = require("../../lib/prisma");
const { baseEmbed } = require("../../lib/embeds");
const { levelFromXp } = require("../../lib/leveling");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Affiche votre niveau et votre progression")
    .addUserOption((o) => o.setName("membre").setDescription("Membre a consulter").setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser("membre") || interaction.user;
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);
    const member = await getMember(target.id, interaction.guild.id);
    const { level, currentLevelXp, xpNeededForNext } = levelFromXp(member.xp);

    const barLength = 20;
    const filled = Math.round((currentLevelXp / xpNeededForNext) * barLength);
    const bar = "▰".repeat(filled) + "▱".repeat(barLength - filled);

    const embed = baseEmbed(guildConfig)
      .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
      .setTitle(`Niveau ${level}`)
      .setDescription(`${bar}\n${currentLevelXp} / ${xpNeededForNext} XP`)
      .addFields({ name: "XP total", value: `${member.xp}`, inline: true });

    return interaction.reply({ embeds: [embed] });
  },
};
