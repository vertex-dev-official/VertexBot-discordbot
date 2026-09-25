const { getGuildConfig, getMember, prisma } = require("../lib/prisma");
const { levelFromXp } = require("../lib/leveling");
const { baseEmbed, formatTemplate } = require("../lib/embeds");
const { askAI } = require("../lib/ai");

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const guildConfig = await getGuildConfig(message.guild.id, message.guild.name);

    // ---------- CONFESSIONS ----------
    if (guildConfig.confessionsEnabled && message.channel.id === guildConfig.confessionChannelId) {
      await message.delete().catch(() => {});
      const embed = baseEmbed(guildConfig)
        .setTitle("🤫 Confession anonyme")
        .setDescription(message.content.slice(0, 4000))
        .setFooter({ text: `ID: ${Math.random().toString(36).slice(2, 8)}` })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] }).catch(() => {});
    }

    // ---------- AUTOMOD LEGER (anti-invite) ----------
    if (guildConfig.moderationEnabled) {
      const automod = guildConfig.automodConfig || {};
      if (automod.antiInvite && /discord\.gg\/\w+/i.test(message.content)) {
        await message.delete().catch(() => {});
        const warn = await message.channel
          .send(`⚠️ ${message.author}, les liens d'invitation ne sont pas autorises ici.`)
          .catch(() => {});
        setTimeout(() => warn?.delete().catch(() => {}), 5000);
        return;
      }
    }

    // ---------- IA (reponse automatique dans le salon dedie) ----------
    if (guildConfig.aiEnabled && guildConfig.aiChannelId && message.channel.id === guildConfig.aiChannelId) {
      await message.channel.sendTyping().catch(() => {});
      try {
        const { answer } = await askAI(message.content, { provider: guildConfig.aiProvider, apiKey: guildConfig.aiApiKey });
        const chunks = answer.match(/[\s\S]{1,1900}/g) || [answer];
        for (const chunk of chunks) {
          // eslint-disable-next-line no-await-in-loop
          await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
        }
      } catch (err) {
        message.reply({ content: `❌ ${err.message}`, allowedMentions: { repliedUser: false } }).catch(() => {});
      }
      return;
    }

    // ---------- LEVELING ----------
    if (!guildConfig.levelingEnabled) return;

    const cooldownKey = `${message.guild.id}-${message.author.id}`;
    const now = Date.now();
    const lastXp = client.xpCooldowns.get(cooldownKey) || 0;
    if (now - lastXp < guildConfig.xpCooldown * 1000) return;
    client.xpCooldowns.set(cooldownKey, now);

    const member = await getMember(message.author.id, message.guild.id);
    const newXp = member.xp + guildConfig.xpPerMessage;
    const before = levelFromXp(member.xp);
    const after = levelFromXp(newXp);

    await prisma.member.update({
      where: { id: member.id },
      data: { xp: newXp, level: after.level, lastXpAt: new Date() },
    });

    if (after.level > before.level) {
      const vars = {
        user: `${message.author}`,
        guild: message.guild.name,
        level: after.level,
        memberCount: message.guild.memberCount,
      };
      const embed = baseEmbed(guildConfig)
        .setDescription(formatTemplate(guildConfig.levelUpMessage, vars))
        .setThumbnail(message.author.displayAvatarURL());

      const targetChannel = guildConfig.levelUpChannelId
        ? message.guild.channels.cache.get(guildConfig.levelUpChannelId)
        : message.channel;
      targetChannel?.send({ embeds: [embed] }).catch(() => {});

      // Recompense de role si configuree
      const reward = await prisma.levelReward.findUnique({
        where: { guildId_level: { guildId: message.guild.id, level: after.level } },
      });
      if (reward) {
        const guildMember = await message.guild.members.fetch(message.author.id).catch(() => null);
        guildMember?.roles.add(reward.roleId).catch(() => {});
      }
    }
  },
};
