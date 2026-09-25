const { SlashCommandBuilder } = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { baseEmbed } = require("../../lib/embeds");

const MEDALS = ["🥇", "🥈", "🥉"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Classement du serveur")
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Classer par XP ou par argent")
        .addChoices({ name: "Niveaux/XP", value: "xp" }, { name: "Argent", value: "balance" })
        .setRequired(false)
    ),

  async execute(interaction) {
    const type = interaction.options.getString("type") || "xp";
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    const members = await prisma.member.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: { [type]: "desc" },
      take: 10,
    });

    if (!members.length) return interaction.reply("Personne n'est encore classe sur ce serveur.");

    const lines = await Promise.all(
      members.map(async (m, i) => {
        const user = await interaction.client.users.fetch(m.userId).catch(() => null);
        const name = user ? user.username : `Utilisateur inconnu (${m.userId})`;
        const value = type === "xp" ? `Niveau ${m.level} — ${m.xp} XP` : `${m.balance} ${guildConfig.currencySymbol}`;
        return `${MEDALS[i] || `**${i + 1}.**`} ${name} — ${value}`;
      })
    );

    const embed = baseEmbed(guildConfig)
      .setTitle(`🏆 Classement — ${type === "xp" ? "Niveaux" : "Argent"}`)
      .setDescription(lines.join("\n"));

    return interaction.reply({ embeds: [embed] });
  },
};
