// XP necessaire pour atteindre un niveau donne (courbe classique type MEE6/DraftBot)
function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

function levelFromXp(totalXp) {
  let level = 0;
  let xpNeeded = xpForLevel(level);
  let remaining = totalXp;
  while (remaining >= xpNeeded) {
    remaining -= xpNeeded;
    level += 1;
    xpNeeded = xpForLevel(level);
  }
  return { level, currentLevelXp: remaining, xpNeededForNext: xpNeeded };
}

module.exports = { xpForLevel, levelFromXp };
