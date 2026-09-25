const { prisma } = require("../lib/prisma");

module.exports = {
  name: "messageReactionAdd",
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});

    const emojiKey = reaction.emoji.id || reaction.emoji.name;
    const rr = await prisma.reactionRole
      .findFirst({ where: { messageId: reaction.message.id, emoji: emojiKey } })
      .catch(() => null);
    if (!rr) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id).catch(() => null);
    member?.roles.add(rr.roleId).catch(() => {});
  },
};
