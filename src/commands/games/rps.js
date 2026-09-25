const { SlashCommandBuilder } = require("discord.js");
const { baseEmbed } = require("../../lib/embeds");
const { getGuildConfig } = require("../../lib/prisma");

const CHOICES = { pierre: "🪨", feuille: "📄", ciseaux: "✂️" };
const BEATS = { pierre: "ciseaux", feuille: "pierre", ciseaux: "feuille" };

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rps")
    .setDescription("Pierre-feuille-ciseaux contre le bot")
    .addStringOption((o) =>
      o
        .setName("choix")
        .setDescription("Ton choix")
        .setRequired(true)
        .addChoices({ name: "Pierre", value: "pierre" }, { name: "Feuille", value: "feuille" }, { name: "Ciseaux", value: "ciseaux" })
    ),

  async execute(interaction) {
    const userChoice = interaction.options.getString("choix");
    const botChoice = Object.keys(CHOICES)[Math.floor(Math.random() * 3)];
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    let result;
    if (userChoice === botChoice) result = "Égalité !";
    else if (BEATS[userChoice] === botChoice) result = "Tu as gagne ! 🎉";
    else result = "Tu as perdu !";

    const embed = baseEmbed(guildConfig)
      .setTitle("✊✋✌️ Pierre-feuille-ciseaux")
      .setDescription(`Toi : ${CHOICES[userChoice]}\nBot : ${CHOICES[botChoice]}\n\n**${result}**`);

    return interaction.reply({ embeds: [embed] });
  },
};
