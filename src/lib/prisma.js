const { PrismaClient } = require("@prisma/client");

// Singleton pour eviter d'ouvrir trop de connexions en dev (hot reload)
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Recupere (ou cree avec les valeurs par defaut) la config d'un serveur.
 */
async function getGuildConfig(guildId, guildName) {
  return prisma.guild.upsert({
    where: { id: guildId },
    update: guildName ? { name: guildName } : {},
    create: { id: guildId, name: guildName || null },
  });
}

/**
 * Recupere (ou cree) le profil economie/xp d'un membre.
 */
async function getMember(userId, guildId) {
  return prisma.member.upsert({
    where: { userId_guildId: { userId, guildId } },
    update: {},
    create: { userId, guildId },
  });
}

module.exports = { prisma, getGuildConfig, getMember };
