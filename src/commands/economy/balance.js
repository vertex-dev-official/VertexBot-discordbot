const { SlashCommandBuilder } = require("discord.js");
const { getGuildConfig, getMember } = require("../../lib/prisma");
const { baseEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Affiche votre solde ou celui d'un autre membre")
    .addUserOption((o) => o.setName("membre").setDescription("Membre a consulter").setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser("membre") || interaction.user;
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);
    const member = await getMember(target.id, interaction.guild.id);

    const embed = baseEmbed(guildConfig)
      .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
      .addFields(
        { name: "Portefeuille", value: `${member.balance} ${guildConfig.currencySymbol}`, inline: true },
        { name: "Banque", value: `${member.bank} ${guildConfig.currencySymbol}`, inline: true },
        { name: "Total", value: `${member.balance + member.bank} ${guildConfig.currencySymbol}`, inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  },
};
