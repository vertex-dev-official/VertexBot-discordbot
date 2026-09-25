const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, successEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Consulte ou efface les avertissements d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((s) =>
      s.setName("voir").setDescription("Liste les avertissements").addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName("effacer").setDescription("Efface tous les avertissements").addUserOption((o) => o.setName("membre").setDescription("Membre").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("membre");
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "effacer") {
      await prisma.warning.deleteMany({ where: { guildId: interaction.guild.id, userId: user.id } });
      return interaction.reply({ embeds: [successEmbed(`Avertissements de ${user.tag} effaces.`)] });
    }

    const warnings = await prisma.warning.findMany({
      where: { guildId: interaction.guild.id, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    });

    if (!warnings.length) return interaction.reply(`${user.tag} n'a aucun avertissement.`);

    const embed = baseEmbed(guildConfig)
      .setTitle(`Avertissements de ${user.tag} (${warnings.length})`)
      .setDescription(warnings.map((w, i) => `**${i + 1}.** ${w.reason} — <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`).join("\n"));

    return interaction.reply({ embeds: [embed] });
  },
};
