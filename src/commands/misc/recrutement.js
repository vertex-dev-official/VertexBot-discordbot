const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { successEmbed, errorEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("recrutement")
    .setDescription("Gere les formulaires de candidature du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("creer")
        .setDescription("Cree un formulaire de candidature (jusqu'a 5 questions)")
        .addStringOption((o) => o.setName("nom").setDescription("Nom unique du formulaire, ex: moderateur").setRequired(true))
        .addStringOption((o) => o.setName("question1").setDescription("Question 1").setRequired(true))
        .addStringOption((o) => o.setName("question2").setDescription("Question 2").setRequired(false))
        .addStringOption((o) => o.setName("question3").setDescription("Question 3").setRequired(false))
        .addStringOption((o) => o.setName("question4").setDescription("Question 4").setRequired(false))
        .addStringOption((o) => o.setName("question5").setDescription("Question 5").setRequired(false))
        .addChannelOption((o) => o.setName("salon-resultats").setDescription("Salon ou les candidatures sont envoyees").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption((o) => o.setName("role-acceptation").setDescription("Role donne automatiquement si accepte").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("panel")
        .setDescription("Publie un panel de candidature dans un salon")
        .addStringOption((o) => o.setName("nom").setDescription("Nom du formulaire").setRequired(true).setAutocomplete(true))
        .addChannelOption((o) => o.setName("salon").setDescription("Salon du panel").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) => s.setName("liste").setDescription("Liste les formulaires de ce serveur"))
    .addSubcommand((s) =>
      s.setName("fermer").setDescription("Ferme un formulaire (empeche les nouvelles candidatures)").addStringOption((o) => o.setName("nom").setDescription("Nom du formulaire").setRequired(true).setAutocomplete(true))
    ),

  async autocomplete(interaction) {
    const forms = await prisma.applicationForm.findMany({ where: { guildId: interaction.guild.id }, take: 25 });
    const focused = interaction.options.getFocused().toLowerCase();
    return interaction.respond(forms.filter((f) => f.name.toLowerCase().includes(focused)).map((f) => ({ name: f.name, value: f.name })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "creer") {
      const name = interaction.options.getString("nom").trim();
      const questions = [1, 2, 3, 4, 5].map((n) => interaction.options.getString(`question${n}`)).filter(Boolean);
      const resultsChannel = interaction.options.getChannel("salon-resultats");
      const acceptRole = interaction.options.getRole("role-acceptation");

      const existing = await prisma.applicationForm.findFirst({ where: { guildId: interaction.guild.id, name } });
      if (existing) return interaction.reply({ embeds: [errorEmbed("Un formulaire avec ce nom existe deja.")], ephemeral: true });

      await prisma.applicationForm.create({
        data: {
          guildId: interaction.guild.id,
          name,
          questions,
          resultsChannelId: resultsChannel.id,
          acceptRoleId: acceptRole?.id || null,
        },
      });

      return interaction.reply({ embeds: [successEmbed(`Formulaire **${name}** cree. Utilise \`/recrutement panel\` pour le publier.`)], ephemeral: true });
    }

    if (sub === "panel") {
      const name = interaction.options.getString("nom");
      const channel = interaction.options.getChannel("salon");
      const form = await prisma.applicationForm.findFirst({ where: { guildId: interaction.guild.id, name } });
      if (!form) return interaction.reply({ embeds: [errorEmbed("Formulaire introuvable.")], ephemeral: true });

      const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);
      const embed = new EmbedBuilder()
        .setColor(guildConfig.embedColor || "#9B6FBF")
        .setTitle(`📋 Candidature : ${form.name}`)
        .setDescription(`Clique sur le bouton ci-dessous pour postuler. Tu devras repondre a ${form.questions.length} question(s).`);

      const button = new ButtonBuilder().setCustomId(`recrutement-postuler-${form.id}`).setLabel("Postuler").setStyle(ButtonStyle.Primary).setEmoji("📝");
      await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });

      return interaction.reply({ embeds: [successEmbed(`Panel publie dans ${channel}.`)], ephemeral: true });
    }

    if (sub === "liste") {
      const forms = await prisma.applicationForm.findMany({ where: { guildId: interaction.guild.id }, include: { _count: { select: { applications: true } } } });
      if (!forms.length) return interaction.reply({ embeds: [errorEmbed("Aucun formulaire cree. Utilise `/recrutement creer`.")], ephemeral: true });

      const list = forms.map((f) => `• **${f.name}** — ${f.open ? "ouvert ✅" : "ferme ❌"} — ${f._count.applications} candidature(s)`).join("\n");
      return interaction.reply({ embeds: [successEmbed(list)], ephemeral: true });
    }

    if (sub === "fermer") {
      const name = interaction.options.getString("nom");
      const form = await prisma.applicationForm.findFirst({ where: { guildId: interaction.guild.id, name } });
      if (!form) return interaction.reply({ embeds: [errorEmbed("Formulaire introuvable.")], ephemeral: true });
      await prisma.applicationForm.update({ where: { id: form.id }, data: { open: false } });
      return interaction.reply({ embeds: [successEmbed(`Formulaire **${name}** ferme.`)], ephemeral: true });
    }
  },
};

// ================================================================
// Handlers d'interactions (boutons/modals), branches depuis interactionCreate.js
// ================================================================

async function handlePostuler(interaction) {
  const formId = interaction.customId.replace("recrutement-postuler-", "");
  const form = await prisma.applicationForm.findUnique({ where: { id: formId } });
  if (!form || !form.open) return interaction.reply({ embeds: [errorEmbed("Ce formulaire n'accepte plus de candidatures.")], ephemeral: true });

  const modal = new ModalBuilder().setCustomId(`recrutement-modal-${form.id}`).setTitle(form.name.slice(0, 45));
  form.questions.forEach((q, i) => {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(`q${i}`).setLabel(q.slice(0, 45)).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
      )
    );
  });

  return interaction.showModal(modal);
}

async function handleApplicationSubmit(interaction) {
  const formId = interaction.customId.replace("recrutement-modal-", "");
  const form = await prisma.applicationForm.findUnique({ where: { id: formId } });
  if (!form) return interaction.reply({ embeds: [errorEmbed("Formulaire introuvable (a peut-etre ete supprime).")], ephemeral: true });

  const answers = form.questions.map((question, i) => ({ question, answer: interaction.fields.getTextInputValue(`q${i}`) }));

  const application = await prisma.application.create({
    data: { formId: form.id, guildId: interaction.guild.id, userId: interaction.user.id, answers },
  });

  const resultsChannel = form.resultsChannelId ? interaction.guild.channels.cache.get(form.resultsChannelId) : null;
  if (resultsChannel) {
    const embed = new EmbedBuilder()
      .setColor("#9B6FBF")
      .setTitle(`📋 Nouvelle candidature : ${form.name}`)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
      .setDescription(answers.map((a) => `**${a.question}**\n${a.answer}`).join("\n\n").slice(0, 4000))
      .setFooter({ text: `Candidat: ${interaction.user.id}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`recrutement-accept-${application.id}`).setLabel("Accepter").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`recrutement-deny-${application.id}`).setLabel("Refuser").setStyle(ButtonStyle.Danger)
    );

    await resultsChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
  }

  return interaction.reply({ embeds: [successEmbed("Ta candidature a bien ete envoyee ! Tu recevras une reponse par message prive.")], ephemeral: true });
}

async function handleReviewButton(interaction) {
  const isAccept = interaction.customId.startsWith("recrutement-accept-");
  const applicationId = interaction.customId.replace(isAccept ? "recrutement-accept-" : "recrutement-deny-", "");

  const application = await prisma.application.findUnique({ where: { id: applicationId }, include: { form: true } });
  if (!application) return interaction.reply({ embeds: [errorEmbed("Candidature introuvable.")], ephemeral: true });
  if (application.status !== "pending") return interaction.reply({ embeds: [errorEmbed("Cette candidature a deja ete traitee.")], ephemeral: true });

  await prisma.application.update({
    where: { id: application.id },
    data: { status: isAccept ? "accepted" : "denied", reviewedBy: interaction.user.id },
  });

  if (isAccept && application.form.acceptRoleId) {
    const member = await interaction.guild.members.fetch(application.userId).catch(() => null);
    await member?.roles.add(application.form.acceptRoleId).catch(() => {});
  }

  const applicant = await interaction.client.users.fetch(application.userId).catch(() => null);
  await applicant
    ?.send(
      isAccept
        ? `🎉 Ta candidature pour **${application.form.name}** sur **${interaction.guild.name}** a ete acceptee !`
        : `❌ Ta candidature pour **${application.form.name}** sur **${interaction.guild.name}** n'a pas ete retenue.`
    )
    .catch(() => {});

  const original = interaction.message.embeds[0];
  const updatedEmbed = EmbedBuilder.from(original)
    .setColor(isAccept ? "#57F287" : "#ED4245")
    .setFooter({ text: `${isAccept ? "Acceptee" : "Refusee"} par ${interaction.user.tag}` });

  await interaction.update({ embeds: [updatedEmbed], components: [] });
}

module.exports.handlePostuler = handlePostuler;
module.exports.handleApplicationSubmit = handleApplicationSubmit;
module.exports.handleReviewButton = handleReviewButton;
