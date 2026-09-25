const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { prisma, getGuildConfig } = require("../../lib/prisma");
const { baseEmbed, successEmbed } = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure le bot pour ce serveur (tout est aussi modifiable depuis le panel web).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName("voir").setDescription("Affiche la configuration actuelle du serveur"))
    .addSubcommand((s) =>
      s
        .setName("module")
        .setDescription("Active ou desactive un module")
        .addStringOption((o) =>
          o
            .setName("module")
            .setDescription("Module a modifier")
            .setRequired(true)
            .addChoices(
              { name: "Economie", value: "economyEnabled" },
              { name: "Niveaux/XP", value: "levelingEnabled" },
              { name: "Moderation", value: "moderationEnabled" },
              { name: "Tickets", value: "ticketsEnabled" },
              { name: "Musique", value: "musicEnabled" },
              { name: "Mini-jeux", value: "gamesEnabled" },
              { name: "Captcha", value: "captchaEnabled" },
              { name: "Confessions", value: "confessionsEnabled" }
            )
        )
        .addBooleanOption((o) => o.setName("actif").setDescription("Activer (true) ou desactiver (false)").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("couleur")
        .setDescription("Change la couleur des embeds du bot")
        .addStringOption((o) => o.setName("hex").setDescription("Code couleur hex, ex: #9B6FBF").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("bienvenue")
        .setDescription("Configure le salon et le message de bienvenue")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon de bienvenue").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) =>
          o.setName("message").setDescription("Variables: {user} {guild} {memberCount}").setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s
        .setName("depart")
        .setDescription("Configure le salon et le message de depart")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon des departs").addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) => o.setName("message").setDescription("Variables: {user} {guild} {memberCount}").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("logs")
        .setDescription("Definit le salon de logs de moderation")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon de logs").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("niveau-annonce")
        .setDescription("Configure ou sont annonces les passages de niveau")
        .addChannelOption((o) => o.setName("salon").setDescription("Laisser vide = salon du message").addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addStringOption((o) => o.setName("message").setDescription("Variables: {user} {level} {guild}").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("xp")
        .setDescription("Regle le taux d'XP par message")
        .addIntegerOption((o) => o.setName("montant").setDescription("XP par message").setRequired(true).setMinValue(1))
        .addIntegerOption((o) => o.setName("cooldown").setDescription("Cooldown en secondes").setRequired(false).setMinValue(5))
    )
    .addSubcommand((s) =>
      s
        .setName("recompense-niveau")
        .setDescription("Ajoute un role donne automatiquement a un niveau")
        .addIntegerOption((o) => o.setName("niveau").setDescription("Niveau requis").setRequired(true).setMinValue(1))
        .addRoleOption((o) => o.setName("role").setDescription("Role a donner").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("monnaie")
        .setDescription("Personnalise le nom et le symbole de la monnaie du serveur")
        .addStringOption((o) => o.setName("nom").setDescription("Nom de la monnaie").setRequired(true))
        .addStringOption((o) => o.setName("symbole").setDescription("Emoji/symbole").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("daily-montant")
        .setDescription("Change le montant recupere avec /daily")
        .addIntegerOption((o) => o.setName("montant").setDescription("Montant quotidien").setRequired(true).setMinValue(1))
    )
    .addSubcommand((s) =>
      s
        .setName("automod")
        .setDescription("Configure l'anti-invitation et l'anti-lien")
        .addBooleanOption((o) => o.setName("anti-invite").setDescription("Bloquer les liens discord.gg").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("confessions")
        .setDescription("Definit le salon utilise pour les confessions anonymes")
        .addChannelOption((o) => o.setName("salon").setDescription("Salon des confessions").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("ia")
        .setDescription("Active l'IA et/ou definit un salon ou elle repond automatiquement")
        .addBooleanOption((o) => o.setName("actif").setDescription("Activer /ask sur ce serveur").setRequired(true))
        .addChannelOption((o) => o.setName("salon").setDescription("Salon ou l'IA repond automatiquement (optionnel)").addChannelTypes(ChannelType.GuildText).setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildConfig = await getGuildConfig(interaction.guild.id, interaction.guild.name);

    if (sub === "voir") {
      const embed = baseEmbed(guildConfig)
        .setTitle(`⚙️ Configuration de ${interaction.guild.name}`)
        .addFields(
          { name: "Modules", value: [
            `Economie: ${guildConfig.economyEnabled ? "✅" : "❌"}`,
            `Niveaux: ${guildConfig.levelingEnabled ? "✅" : "❌"}`,
            `Moderation: ${guildConfig.moderationEnabled ? "✅" : "❌"}`,
            `Tickets: ${guildConfig.ticketsEnabled ? "✅" : "❌"}`,
            `Musique: ${guildConfig.musicEnabled ? "✅" : "❌"}`,
            `Mini-jeux: ${guildConfig.gamesEnabled ? "✅" : "❌"}`,
            `Captcha: ${guildConfig.captchaEnabled ? "✅" : "❌"}`,
            `Confessions: ${guildConfig.confessionsEnabled ? "✅" : "❌"}`,
            `IA: ${guildConfig.aiEnabled ? "✅" : "❌"}`,
          ].join("\n"), inline: false },
          { name: "Bienvenue", value: guildConfig.welcomeChannelId ? `<#${guildConfig.welcomeChannelId}>` : "Non configure", inline: true },
          { name: "Depart", value: guildConfig.leaveChannelId ? `<#${guildConfig.leaveChannelId}>` : "Non configure", inline: true },
          { name: "Logs", value: guildConfig.logsChannelId ? `<#${guildConfig.logsChannelId}>` : "Non configure", inline: true },
          { name: "Monnaie", value: `${guildConfig.currencyName} ${guildConfig.currencySymbol}`, inline: true },
          { name: "XP / message", value: `${guildConfig.xpPerMessage} (cooldown ${guildConfig.xpCooldown}s)`, inline: true }
        )
        .setFooter({ text: "Modifiable aussi depuis le panel web" });
      return interaction.reply({ embeds: [embed] });
    }

    const data = {};

    if (sub === "module") {
      const mod = interaction.options.getString("module");
      data[mod] = interaction.options.getBoolean("actif");
    } else if (sub === "couleur") {
      const hex = interaction.options.getString("hex");
      if (!/^#([0-9A-F]{6})$/i.test(hex)) return interaction.reply({ content: "Format hexadecimal invalide, ex: #9B6FBF", ephemeral: true });
      data.embedColor = hex;
    } else if (sub === "bienvenue") {
      data.welcomeChannelId = interaction.options.getChannel("salon").id;
      const msg = interaction.options.getString("message");
      if (msg) data.welcomeMessage = msg;
    } else if (sub === "depart") {
      data.leaveChannelId = interaction.options.getChannel("salon").id;
      const msg = interaction.options.getString("message");
      if (msg) data.leaveMessage = msg;
    } else if (sub === "logs") {
      data.logsChannelId = interaction.options.getChannel("salon").id;
    } else if (sub === "niveau-annonce") {
      const chan = interaction.options.getChannel("salon");
      if (chan) data.levelUpChannelId = chan.id;
      const msg = interaction.options.getString("message");
      if (msg) data.levelUpMessage = msg;
    } else if (sub === "xp") {
      data.xpPerMessage = interaction.options.getInteger("montant");
      const cd = interaction.options.getInteger("cooldown");
      if (cd) data.xpCooldown = cd;
    } else if (sub === "recompense-niveau") {
      const level = interaction.options.getInteger("niveau");
      const role = interaction.options.getRole("role");
      await prisma.levelReward.upsert({
        where: { guildId_level: { guildId: interaction.guild.id, level } },
        update: { roleId: role.id },
        create: { guildId: interaction.guild.id, level, roleId: role.id },
      });
      return interaction.reply({ embeds: [successEmbed(`Le role ${role} sera donne au niveau **${level}**.`)] });
    } else if (sub === "monnaie") {
      data.currencyName = interaction.options.getString("nom");
      data.currencySymbol = interaction.options.getString("symbole");
    } else if (sub === "daily-montant") {
      data.dailyAmount = interaction.options.getInteger("montant");
    } else if (sub === "automod") {
      data.automodConfig = { ...(guildConfig.automodConfig || {}), antiInvite: interaction.options.getBoolean("anti-invite") };
    } else if (sub === "confessions") {
      data.confessionChannelId = interaction.options.getChannel("salon").id;
      data.confessionsEnabled = true;
    } else if (sub === "ia") {
      data.aiEnabled = interaction.options.getBoolean("actif");
      const chan = interaction.options.getChannel("salon");
      if (chan) data.aiChannelId = chan.id;
    }

    await prisma.guild.update({ where: { id: interaction.guild.id }, data });
    return interaction.reply({ embeds: [successEmbed("Configuration mise a jour avec succes.")] });
  },
};
