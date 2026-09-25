const { errorEmbed, successEmbed } = require("../lib/embeds");
const { handleTicketSelect, handleTicketClose } = require("../commands/tickets/ticket-panel");
const { handleStartupGuideInteraction } = require("../lib/startupGuide");
const { handlePollVote } = require("../commands/misc/poll");
const { handlePostuler, handleApplicationSubmit, handleReviewButton } = require("../commands/misc/recrutement");
const { handleAiKeyModal } = require("../commands/misc/ia-cle");
const { prisma } = require("../lib/prisma");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      // ----- Slash commands -----
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        return command.execute(interaction, client);
      }

      // ----- Guide de demarrage (boutons + modals) -----
      if ((interaction.isButton() && interaction.customId.startsWith("guide-")) || (interaction.isModalSubmit() && interaction.customId.startsWith("guide-"))) {
        const handled = await handleStartupGuideInteraction(interaction);
        if (handled) return;
      }

      // ----- Menu deroulant du panel de tickets -----
      if (interaction.isStringSelectMenu() && interaction.customId === "ticket-panel-select") {
        return handleTicketSelect(interaction, client);
      }

      // ----- Bouton participation giveaway -----
      if (interaction.isButton() && interaction.customId.startsWith("giveaway-join-")) {
        const giveawayId = interaction.customId.replace("giveaway-join-", "");
        const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
        if (!giveaway || giveaway.ended) {
          return interaction.reply({ embeds: [errorEmbed("Ce giveaway est termine.")], ephemeral: true });
        }
        if (giveaway.participantIds.includes(interaction.user.id)) {
          await prisma.giveaway.update({
            where: { id: giveawayId },
            data: { participantIds: giveaway.participantIds.filter((id) => id !== interaction.user.id) },
          });
          return interaction.reply({ embeds: [successEmbed("Tu ne participes plus a ce giveaway.")], ephemeral: true });
        }
        await prisma.giveaway.update({
          where: { id: giveawayId },
          data: { participantIds: { push: interaction.user.id } },
        });
        return interaction.reply({ embeds: [successEmbed("Tu participes au giveaway ! 🎉")], ephemeral: true });
      }

      // ----- Bouton fermeture de ticket -----
      if (interaction.isButton() && interaction.customId === "ticket-close") {
        return handleTicketClose(interaction, client);
      }

      // ----- Sondages : vote par bouton -----
      if (interaction.isButton() && interaction.customId.startsWith("poll-vote-")) {
        return handlePollVote(interaction);
      }

      // ----- Recrutement : bouton "Postuler" -----
      if (interaction.isButton() && interaction.customId.startsWith("recrutement-postuler-")) {
        return handlePostuler(interaction);
      }

      // ----- Recrutement : soumission du modal de candidature -----
      if (interaction.isModalSubmit() && interaction.customId.startsWith("recrutement-modal-")) {
        return handleApplicationSubmit(interaction);
      }

      // ----- Recrutement : boutons Accepter/Refuser (staff) -----
      if (interaction.isButton() && (interaction.customId.startsWith("recrutement-accept-") || interaction.customId.startsWith("recrutement-deny-"))) {
        return handleReviewButton(interaction);
      }

      // ----- Cle API IA (soumission du modal prive) -----
      if (interaction.isModalSubmit() && interaction.customId.startsWith("ia-cle-modal-")) {
        return handleAiKeyModal(interaction);
      }

      // ----- Autocomplete -----
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) return command.autocomplete(interaction, client);
      }
    } catch (err) {
      console.error("[interactionCreate]", err);
      const payload = { embeds: [errorEmbed("Une erreur est survenue pendant l'execution de cette action.")], ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        interaction.editReply(payload).catch(() => {});
      } else if (interaction.isRepliable?.()) {
        interaction.reply(payload).catch(() => {});
      }
    }
  },
};
