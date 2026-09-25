const { SlashCommandBuilder } = require("discord.js");
const { useQueue } = require("discord-player");
const { getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder().setName("queue").setDescription("Affiche la file d'attente musicale"),

  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.currentTrack) return interaction.reply({ embeds: [errorEmbed("Aucune musique en cours.")], ephemeral: true });

    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);
    const upcoming = queue.tracks.toArray().slice(0, 10);

    const embed = baseEmbed(guildConfig)
      .setTitle("🎶 File d'attente")
      .setDescription(
        `**En cours :** ${queue.currentTrack.title}\n\n` +
          (upcoming.length ? upcoming.map((t, i) => `${i + 1}. ${t.title}`).join("\n") : "Aucune musique en attente.")
      );

    return interaction.reply({ embeds: [embed] });
  },
};
