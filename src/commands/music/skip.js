const { SlashCommandBuilder } = require("discord.js");
const { useQueue } = require("discord-player");
const { errorEmbed, successEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Passe a la musique suivante"),

  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue || !queue.currentTrack) return interaction.reply({ embeds: [errorEmbed("Aucune musique en cours.")], ephemeral: true });

    const track = queue.currentTrack;
    queue.node.skip();
    return interaction.reply({ embeds: [successEmbed(`⏭️ **${track.title}** passee.`)] });
  },
};
