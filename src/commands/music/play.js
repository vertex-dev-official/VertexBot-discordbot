const { SlashCommandBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { errorEmbed, successEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Joue une musique depuis YouTube/Spotify/SoundCloud (URL ou recherche)")
    .addStringOption((o) => o.setName("recherche").setDescription("Nom de la musique ou lien").setRequired(true)),

  async execute(interaction) {
    const query = interaction.options.getString("recherche");
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) return interaction.reply({ embeds: [errorEmbed("Rejoins un salon vocal d'abord.")], ephemeral: true });

    await interaction.deferReply();
    const player = useMainPlayer();

    try {
      const { track } = await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: { channel: interaction.channel },
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 60000,
          leaveOnEnd: true,
          leaveOnEndCooldown: 60000,
        },
      });
      return interaction.editReply({ embeds: [successEmbed(`Ajoutee a la file : **${track.title}**`)] });
    } catch (err) {
      console.error("[play]", err);
      return interaction.editReply({ embeds: [errorEmbed("Impossible de trouver ou lire cette musique.")] });
    }
  },
};
