const { SlashCommandBuilder } = require("discord.js");
const { useQueue } = require("discord-player");
const { errorEmbed, successEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Arrete la musique et vide la file d'attente"),

  async execute(interaction) {
    const queue = useQueue(interaction.guild.id);
    if (!queue) return interaction.reply({ embeds: [errorEmbed("Aucune musique en cours.")], ephemeral: true });

    queue.delete();
    return interaction.reply({ embeds: [successEmbed("⏹️ Musique arretee et file d'attente videe.")] });
  },
};
