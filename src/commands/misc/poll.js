const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { buildPollEmbed, OPTION_EMOJIS } = require("../../lib/pollEmbed");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

function parseDuration(str) {
  if (!str) return null;
  const match = /^(\d+)([mhd])$/.exec(str.trim());
  if (!match) return null;
  const multiplier = { m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return parseInt(match[1], 10) * multiplier;
}

function buildRow(pollId, options) {
  return new ActionRowBuilder().addComponents(
    options.map((o, i) => new ButtonBuilder().setCustomId(`poll-vote-${pollId}-${i}`).setLabel(o.label.slice(0, 60)).setEmoji(OPTION_EMOJIS[i]).setStyle(ButtonStyle.Secondary))
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Cree un sondage interactif avec graphique en temps reel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) =>
      s
        .setName("creer")
        .setDescription("Lance un nouveau sondage")
        .addStringOption((o) => o.setName("question").setDescription("La question posee").setRequired(true))
        .addStringOption((o) => o.setName("option1").setDescription("Option 1").setRequired(true))
        .addStringOption((o) => o.setName("option2").setDescription("Option 2").setRequired(true))
        .addStringOption((o) => o.setName("option3").setDescription("Option 3").setRequired(false))
        .addStringOption((o) => o.setName("option4").setDescription("Option 4").setRequired(false))
        .addStringOption((o) => o.setName("option5").setDescription("Option 5").setRequired(false))
        .addStringOption((o) => o.setName("duree").setDescription("Duree avant cloture auto, ex: 10m, 2h, 1d (optionnel)").setRequired(false))
        .addBooleanOption((o) => o.setName("choix-multiple").setDescription("Autoriser a voter pour plusieurs options").setRequired(false))
    )
    .addSubcommand((s) =>
      s.setName("terminer").setDescription("Cloture un sondage immediatement").addStringOption((o) => o.setName("message-id").setDescription("ID du message du sondage").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "creer") {
      const question = interaction.options.getString("question");
      const labels = [1, 2, 3, 4, 5].map((n) => interaction.options.getString(`option${n}`)).filter(Boolean);
      const multiple = interaction.options.getBoolean("choix-multiple") || false;
      const durationStr = interaction.options.getString("duree");
      const durationMs = durationStr ? parseDuration(durationStr) : null;

      if (durationStr && !durationMs) return interaction.reply({ embeds: [errorEmbed("Format de duree invalide. Utilise par ex: 10m, 2h, 1d.")], ephemeral: true });

      const poll = await prisma.poll.create({
        data: {
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          question,
          multiple,
          hostId: interaction.user.id,
          endsAt: durationMs ? new Date(Date.now() + durationMs) : null,
          options: { create: labels.map((label, i) => ({ label, order: i })) },
        },
        include: { options: { include: { votes: true }, orderBy: { order: "asc" } } },
      });

      const embed = buildPollEmbed(poll, guildConfig.embedColor);
      const message = await interaction.channel.send({ embeds: [embed], components: [buildRow(poll.id, poll.options)] });
      await prisma.poll.update({ where: { id: poll.id }, data: { messageId: message.id } });

      if (durationMs) setTimeout(() => endPoll(interaction.client, poll.id).catch(console.error), durationMs);

      return interaction.reply({ embeds: [successEmbed("Sondage lance !")], ephemeral: true });
    }

    if (sub === "terminer") {
      const messageId = interaction.options.getString("message-id");
      const poll = await prisma.poll.findFirst({ where: { guildId: interaction.guild.id, messageId } });
      if (!poll) return interaction.reply({ embeds: [errorEmbed("Sondage introuvable.")], ephemeral: true });
      await endPoll(interaction.client, poll.id);
      return interaction.reply({ embeds: [successEmbed("Sondage cloture.")], ephemeral: true });
    }
  },
};

/**
 * Gere le clic sur un bouton de vote. Appelee depuis interactionCreate.js.
 * Utilise interaction.update() pour rafraichir le graphique directement dans le meme message.
 */
async function handlePollVote(interaction) {
  const [, , pollId, indexStr] = interaction.customId.split("-"); // "poll-vote-<id>-<index>"
  const optionIndex = parseInt(indexStr, 10);

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: { include: { votes: true }, orderBy: { order: "asc" } } },
  });
  if (!poll || poll.ended) {
    return interaction.reply({ embeds: [errorEmbed("Ce sondage est termine.")], ephemeral: true });
  }

  const option = poll.options[optionIndex];
  if (!option) return interaction.reply({ embeds: [errorEmbed("Option invalide.")], ephemeral: true });

  const alreadyVotedThis = option.votes.some((v) => v.userId === interaction.user.id);

  if (alreadyVotedThis) {
    // Un second clic sur la meme option retire le vote (permet de changer d'avis)
    await prisma.pollVote.deleteMany({ where: { optionId: option.id, userId: interaction.user.id } });
  } else {
    if (!poll.multiple) {
      // Choix unique : on retire les votes de l'utilisateur sur les AUTRES options de ce sondage
      const otherOptionIds = poll.options.filter((o) => o.id !== option.id).map((o) => o.id);
      await prisma.pollVote.deleteMany({ where: { optionId: { in: otherOptionIds }, userId: interaction.user.id } });
    }
    await prisma.pollVote.create({ data: { optionId: option.id, userId: interaction.user.id } });
  }

  const updated = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: { include: { votes: true }, orderBy: { order: "asc" } } },
  });
  const guildConfig = await getGuildConfig(interaction.guild.id);
  const embed = buildPollEmbed(updated, guildConfig.embedColor);

  return interaction.update({ embeds: [embed] });
}

async function endPoll(client, pollId) {
  const poll = await prisma.poll.findUnique({ where: { id: pollId }, include: { options: { include: { votes: true }, orderBy: { order: "asc" } } } });
  if (!poll || poll.ended) return;

  await prisma.poll.update({ where: { id: pollId }, data: { ended: true } });
  const guildConfig = await getGuildConfig(poll.guildId);
  const embed = buildPollEmbed({ ...poll, ended: true }, guildConfig.embedColor);

  const channel = await client.channels.fetch(poll.channelId).catch(() => null);
  const message = poll.messageId ? await channel?.messages.fetch(poll.messageId).catch(() => null) : null;
  await message?.edit({ embeds: [embed], components: [] }).catch(() => {});
}

module.exports.handlePollVote = handlePollVote;
module.exports.endPoll = endPoll;
