const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");
const { prisma } = require("../../lib/prisma");
const { successEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ia-cle")
    .setDescription("Configure ta propre cle API IA pour ce serveur (saisie privee, jamais affichee dans le chat)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o
        .setName("fournisseur")
        .setDescription("Fournisseur IA a utiliser")
        .setRequired(false)
        .addChoices(
          { name: "Claude (Anthropic)", value: "anthropic" },
          { name: "GPT (OpenAI)", value: "openai" },
          { name: "Llama (Groq)", value: "groq" }
        )
    )
    .addBooleanOption((o) => o.setName("supprimer").setDescription("Retire la cle configuree pour ce serveur").setRequired(false)),

  async execute(interaction) {
    const remove = interaction.options.getBoolean("supprimer");

    if (remove) {
      await prisma.guild.update({ where: { id: interaction.guild.id }, data: { aiProvider: null, aiApiKey: null } });
      return interaction.reply({ embeds: [successEmbed("Cle IA retiree. Le serveur utilisera la cle par defaut du bot si elle existe, sinon `/ask` sera indisponible.")], ephemeral: true });
    }

    const provider = interaction.options.getString("fournisseur");
    if (!provider) {
      return interaction.reply({
        content: "Precise le fournisseur (`fournisseur:`) pour ouvrir la fenetre de saisie de la cle, ou utilise `supprimer:true` pour la retirer.",
        ephemeral: true,
      });
    }

    // La cle est saisie via un modal (fenetre Discord) plutot qu'une option de commande :
    // les options de slash commands sont visibles publiquement dans le salon, un modal ne l'est jamais.
    const modal = new ModalBuilder()
      .setCustomId(`ia-cle-modal-${provider}`)
      .setTitle("Cle API IA (prive)")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("cle")
            .setLabel("Colle ta cle API ici")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder(provider === "anthropic" ? "sk-ant-..." : provider === "openai" ? "sk-..." : "gsk_...")
        )
      );

    return interaction.showModal(modal);
  },
};

/**
 * Traite la soumission du modal ci-dessus. Appele depuis interactionCreate.js.
 */
async function handleAiKeyModal(interaction) {
  const provider = interaction.customId.replace("ia-cle-modal-", "");
  const apiKey = interaction.fields.getTextInputValue("cle").trim();

  await prisma.guild.update({ where: { id: interaction.guild.id }, data: { aiProvider: provider, aiApiKey: apiKey } });

  return interaction.reply({
    embeds: [successEmbed("Cle IA enregistree pour ce serveur. Active le module avec `/config ia actif:true` puis teste avec `/ask`.")],
    ephemeral: true,
  });
}

module.exports.handleAiKeyModal = handleAiKeyModal;
