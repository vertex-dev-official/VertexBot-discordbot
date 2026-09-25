const { SlashCommandBuilder } = require("discord.js");
const { prisma, getGuildConfig, getMember } = require("../../lib/prisma");
const { baseEmbed, errorEmbed } = require("../../lib/embeds");

const SYMBOLS = ["🍒", "🍋", "🍇", "⭐", "💎", "7️⃣"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("casino")
    .setDescription("Tente ta chance a la machine a sous")
    .addIntegerOption((o) => o.setName("mise").setDescription("Montant a miser").setRequired(true).setMinValue(10)),

  async execute(interaction) {
    const bet = interaction.options.getInteger("mise");
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);
    const member = await getMember(interaction.user.id, interaction.guild.id);

    if (member.balance < bet) return interaction.reply({ embeds: [errorEmbed("Solde insuffisant.")], ephemeral: true });

    const roll = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const result = [roll(), roll(), roll()];

    let multiplier = 0;
    if (result[0] === result[1] && result[1] === result[2]) multiplier = result[0] === "7️⃣" ? 10 : 5;
    else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) multiplier = 1.5;

    const winnings = Math.floor(bet * multiplier) - bet;

    await prisma.member.update({ where: { id: member.id }, data: { balance: { increment: winnings } } });

    const embed = baseEmbed(guildConfig)
      .setTitle("🎰 Machine a sous")
      .setDescription(`[ ${result.join(" | ")} ]`)
      .addFields({
        name: winnings > 0 ? "Gagne !" : winnings === 0 ? "Match nul" : "Perdu !",
        value: `${winnings >= 0 ? "+" : ""}${winnings} ${guildConfig.currencySymbol}`,
      });

    return interaction.reply({ embeds: [embed] });
  },
};
