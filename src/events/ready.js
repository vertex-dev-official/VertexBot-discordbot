const { ActivityType } = require("discord.js");
const { prisma } = require("../lib/prisma");

module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {
    console.log(`[ready] Connecte en tant que ${client.user.tag} (${client.guilds.cache.size} serveurs)`);

    client.user.setPresence({
      activities: [{ name: `${client.guilds.cache.size} serveurs | /help`, type: ActivityType.Watching }],
      status: "online",
    });

    // S'assure que chaque serveur ou le bot est present a une ligne de config en base
    for (const guild of client.guilds.cache.values()) {
      await prisma.guild
        .upsert({
          where: { id: guild.id },
          update: { name: guild.name, icon: guild.iconURL() || null },
          create: { id: guild.id, name: guild.name, icon: guild.iconURL() || null },
        })
        .catch((e) => console.error(`[ready] upsert guild ${guild.id} a echoue`, e));
    }
  },
};
