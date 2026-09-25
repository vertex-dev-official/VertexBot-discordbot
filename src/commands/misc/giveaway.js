const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, successEmbed, errorEmbed } = require("../../lib/embeds");

function parseDuration(str) {
  const match = /^(\d+)([mhd])$/.exec(str.trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multiplier = { m: 60000, h: 3600000, d: 86400000 }[unit];
  return value * multiplier;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Lance un giveaway")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("creer")
        .setDescription("Cree un nouveau giveaway")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon du giveaway").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) => o.setName("prix").setDescription("Ce qui est a gagner").setRequired(true))
        .addStringOption((o) => o.setName("duree").setDescription("Duree, ex: 10m, 2h, 1d").setRequired(true))
        .addIntegerOption((o) => o.setName("gagnants").setDescription("Nombre de gagnants").setRequired(false).setMinValue(1))
    )
    .addSubcommand((s) =>
      s.setName("terminer").setDescription("Termine un giveaway immediatement et tire au sort").addStringOption((o) => o.setName("message-id").setDescription("ID du message du giveaway").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "creer") {
      const channel = interaction.options.getChannel("salon");
      const prize = interaction.options.getString("prix");
      const durationMs = parseDuration(interaction.options.getString("duree"));
      const winnersCount = interaction.options.getInteger("gagnants") || 1;

      if (!durationMs) return interaction.reply({ embeds: [errorEmbed("Format de duree invalide. Utilise par ex: 10m, 2h, 1d.")], ephemeral: true });

      const endsAt = new Date(Date.now() + durationMs);
      const embed = baseEmbed(guildConfig)
        .setTitle("🎉 GIVEAWAY 🎉")
        .setDescription(`**Prix :** ${prize}\n**Gagnant(s) :** ${winnersCount}\n**Fin :** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`)
        .setFooter({ text: `Organise par ${interaction.user.tag}` });

      const button = new ButtonBuilder().setCustomId("giveaway-join-pending").setLabel("🎉 Participer").setStyle(ButtonStyle.Primary);
      const message = await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });

      const giveaway = await prisma.giveaway.create({
        data: { guildId: interaction.guild.id, channelId: channel.id, messageId: message.id, prize, winnersCount, hostId: interaction.user.id, endsAt },
      });

      // Le customId embarque l'id du giveaway pour retrouver les participants sans salon global d'ecoute
      await message.edit({ components: [new ActionRowBuilder().addComponents(button.setCustomId(`giveaway-join-${giveaway.id}`))] });

      setTimeout(() => endGiveaway(interaction.client, giveaway.id).catch(console.error), durationMs);

      return interaction.reply({ embeds: [successEmbed(`Giveaway lance dans ${channel} !`)], ephemeral: true });
    }

    if (sub === "terminer") {
      const messageId = interaction.options.getString("message-id");
      const giveaway = await prisma.giveaway.findFirst({ where: { guildId: interaction.guild.id, messageId } });
      if (!giveaway) return interaction.reply({ embeds: [errorEmbed("Giveaway introuvable.")], ephemeral: true });
      await endGiveaway(interaction.client, giveaway.id);
      return interaction.reply({ embeds: [successEmbed("Giveaway termine.")], ephemeral: true });
    }
  },
};

async function endGiveaway(client, giveawayId) {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || giveaway.ended) return;

  const guildConfig = await getGuildConfig(giveaway.guildId);
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  const participants = giveaway.participantIds;

  let winners = [];
  if (participants.length) {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    winners = shuffled.slice(0, giveaway.winnersCount);
  }

  await prisma.giveaway.update({ where: { id: giveaway.id }, data: { ended: true } });

  const embed = baseEmbed(guildConfig)
    .setTitle("🎉 Giveaway termine !")
    .setDescription(
      winners.length
        ? `**Prix :** ${giveaway.prize}\n**Gagnant(s) :** ${winners.map((w) => `<@${w}>`).join(", ")}`
        : `**Prix :** ${giveaway.prize}\nPersonne n'a participe.`
    );

  channel?.send({ embeds: [embed] }).catch(() => {});
}

module.exports.endGiveaway = endGiveaway;
