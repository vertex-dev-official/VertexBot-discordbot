const { SlashCommandBuilder } = require("discord.js");
const { prisma, getGuildConfig, getMember } = require("../../lib/prisma");
const { baseEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Pile ou face contre une mise")
    .addStringOption((o) =>
      o.setName("choix").setDescription("Ton choix").setRequired(true).addChoices({ name: "Pile", value: "pile" }, { name: "Face", value: "face" })
    )
    .addIntegerOption((o) => o.setName("mise").setDescription("Montant a miser").setRequired(true).setMinValue(10)),

  async execute(interaction) {
    const choice = interaction.options.getString("choix");
    const bet = interaction.options.getInteger("mise");
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);
    const member = await getMember(interaction.user.id, interaction.guild.id);

    if (member.balance < bet) return interaction.reply({ embeds: [errorEmbed("Solde insuffisant.")], ephemeral: true });

    const result = Math.random() < 0.5 ? "pile" : "face";
    const won = result === choice;
    const delta = won ? bet : -bet;

    await prisma.member.update({ where: { id: member.id }, data: { balance: { increment: delta } } });

    const embed = baseEmbed(guildConfig)
      .setTitle("🪙 Pile ou face")
      .setDescription(`La piece tombe sur **${result}** !\n${won ? "Tu as gagne" : "Tu as perdu"} **${Math.abs(delta)} ${guildConfig.currencySymbol}**.`);

    return interaction.reply({ embeds: [embed] });
  },
};
