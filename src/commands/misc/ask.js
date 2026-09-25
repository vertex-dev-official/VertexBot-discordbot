const { SlashCommandBuilder } = require("discord.js");
const { askAI } = require("../../lib/ai");
const { getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Pose une question a l'IA (choisit automatiquement le meilleur modele disponible)")
    .addStringOption((o) => o.setName("question").setDescription("Ta question").setRequired(true))
    .addBooleanOption((o) => o.setName("prive").setDescription("Repondre seulement a toi (ephemere)").setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString("question");
    const ephemeral = interaction.options.getBoolean("prive") || false;
    await interaction.deferReply({ ephemeral });

    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    try {
      const { answer, provider } = await askAI(question, { provider: guildConfig.aiProvider, apiKey: guildConfig.aiApiKey });
      const embed = baseEmbed(guildConfig)
        .setAuthor({ name: `Question de ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setDescription(answer.slice(0, 4000))
        .setFooter({ text: `Repondu par ${provider}` })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed(err.message)] });
    }
  },
};
