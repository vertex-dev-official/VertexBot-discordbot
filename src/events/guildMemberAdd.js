const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getGuildConfig } = require("../lib/prisma");
const { baseEmbed, formatTemplate } = require("../lib/embeds");

module.exports = {
  name: "guildMemberAdd",
  async execute(member, client) {
    const guildConfig = await getGuildConfig(member.guild.id, member.guild.name);

    // ---------- CAPTCHA ----------
    if (guildConfig.captchaEnabled) {
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      const answer = a + b;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`captcha-${member.id}-${answer}`).setLabel(`${a} + ${b} = ?`).setStyle(ButtonStyle.Secondary)
      );

      try {
        const dm = await member.send({
          content: `Bienvenue sur **${member.guild.name}** ! Pour verifier que tu n'es pas un bot, calcule : **${a} + ${b}**. Reponds simplement par un nombre dans ce message prive.`,
        });

        const collected = await dm.channel
          .awaitMessages({ filter: (m) => m.author.id === member.id, max: 1, time: 120000 })
          .catch(() => null);

        if (!collected || collected.first()?.content.trim() !== String(answer)) {
          await member.kick("Captcha echoue ou expire").catch(() => {});
          return;
        }
        await dm.channel.send("✅ Verification reussie, bienvenue !").catch(() => {});
      } catch {
        // DM fermes : on laisse passer plutot que de bloquer un vrai utilisateur
      }
    }

    // ---------- WELCOME ----------
    if (!guildConfig.welcomeChannelId) return;
    const channel = member.guild.channels.cache.get(guildConfig.welcomeChannelId);
    if (!channel) return;

    const vars = {
      user: `${member}`,
      guild: member.guild.name,
      memberCount: member.guild.memberCount,
    };

    const embed = baseEmbed(guildConfig)
      .setTitle("👋 Nouveau membre")
      .setDescription(formatTemplate(guildConfig.welcomeMessage, vars))
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  },
};
