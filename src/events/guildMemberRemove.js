const { getGuildConfig } = require("../lib/prisma");
const { baseEmbed, formatTemplate } = require("../lib/embeds");

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    const guildConfig = await getGuildConfig(member.guild.id, member.guild.name);
    if (!guildConfig.leaveChannelId) return;

    const channel = member.guild.channels.cache.get(guildConfig.leaveChannelId);
    if (!channel) return;

    const vars = { user: member.user.tag, guild: member.guild.name, memberCount: member.guild.memberCount };
    const embed = baseEmbed(guildConfig).setDescription(formatTemplate(guildConfig.leaveMessage, vars)).setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
  },
};
