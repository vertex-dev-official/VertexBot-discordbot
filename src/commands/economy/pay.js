const { SlashCommandBuilder } = require("discord.js");
const { prisma, getGuildConfig, getMember } = require("../../lib/prisma");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Transfere de l'argent a un autre membre")
    .addUserOption((o) => o.setName("membre").setDescription("Destinataire").setRequired(true))
    .addIntegerOption((o) => o.setName("montant").setDescription("Montant a envoyer").setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const target = interaction.options.getUser("membre");
    const amount = interaction.options.getInteger("montant");
    if (target.id === interaction.user.id) return interaction.reply({ embeds: [errorEmbed("Tu ne peux pas te payer toi-meme.")], ephemeral: true });
    if (target.bot) return interaction.reply({ embeds: [errorEmbed("Tu ne peux pas payer un bot.")], ephemeral: true });

    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);
    const sender = await getMember(interaction.user.id, interaction.guild.id);
    if (sender.balance < amount) return interaction.reply({ embeds: [errorEmbed("Solde insuffisant.")], ephemeral: true });

    const receiver = await getMember(target.id, interaction.guild.id);

    await prisma.$transaction([
      prisma.member.update({ where: { id: sender.id }, data: { balance: { decrement: amount } } }),
      prisma.member.update({ where: { id: receiver.id }, data: { balance: { increment: amount } } }),
    ]);

    return interaction.reply({ embeds: [successEmbed(`${interaction.user} a envoye **${amount} ${guildConfig.currencySymbol}** a ${target}.`)] });
  },
};
