// ================================================================
// IA multi-modeles : chaque serveur peut fournir sa PROPRE cle API (saisie privee
// via /ia-cle ou le panel web) -> le bot n'a besoin d'aucune cle globale pour etre
// invite et utilise par n'importe quel serveur Discord. Si le serveur n'a pas
// configure de cle, on retombe sur les cles globales du .env (utile pour l'auto-hebergeur
// qui veut offrir l'IA par defaut, ou pour les tests). Aucun SDK requis, fetch() natif.
// ================================================================

const PROVIDER_LABELS = {
  anthropic: "Claude (Anthropic)",
  openai: "GPT (OpenAI)",
  groq: "Llama (Groq)",
};

async function askAnthropic(question, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 700,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).map((b) => b.text).filter(Boolean).join("\n") || "(reponse vide)";
}

async function askOpenAI(question, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: question }],
      max_tokens: 700,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "(reponse vide)";
}

async function askGroq(question, apiKey) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      messages: [{ role: "user", content: question }],
      max_tokens: 700,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "(reponse vide)";
}

const ASKERS = { anthropic: askAnthropic, openai: askOpenAI, groq: askGroq };
const GLOBAL_ENV_KEYS = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", groq: "GROQ_API_KEY" };

/**
 * Construit la liste ordonnee des fournisseurs a essayer :
 * 1. La cle propre au serveur (si configuree) en premier, quel que soit le fournisseur choisi.
 * 2. Puis les cles globales du .env du bot (fallback pour l'auto-hebergeur), dans l'ordre Claude > GPT > Groq.
 */
function buildProviderChain(guildOverride) {
  const chain = [];
  const seen = new Set();

  if (guildOverride?.provider && guildOverride?.apiKey && ASKERS[guildOverride.provider]) {
    chain.push({ provider: guildOverride.provider, apiKey: guildOverride.apiKey, source: "serveur" });
    seen.add(guildOverride.provider);
  }

  for (const provider of Object.keys(ASKERS)) {
    const envKey = process.env[GLOBAL_ENV_KEYS[provider]];
    if (envKey && !seen.has(provider)) {
      chain.push({ provider, apiKey: envKey, source: "bot" });
    }
  }

  return chain;
}

/**
 * Pose une question a l'IA. Essaie la cle du serveur en premier, puis les cles globales
 * du bot en fallback, et bascule automatiquement au fournisseur suivant en cas d'echec.
 */
async function askAI(question, guildOverride) {
  const chain = buildProviderChain(guildOverride);
  if (!chain.length) {
    throw new Error(
      "Aucune IA configuree pour ce serveur. Utilise `/ia-cle` (ou le panel web) pour renseigner ta propre cle API - Claude, GPT ou Groq proposent toutes un acces gratuit pour commencer."
    );
  }

  let lastError;
  for (const entry of chain) {
    try {
      const answer = await ASKERS[entry.provider](question, entry.apiKey);
      return { answer, provider: `${PROVIDER_LABELS[entry.provider]}${entry.source === "bot" ? " (par defaut)" : ""}` };
    } catch (err) {
      lastError = err;
      console.error(`[ai] ${entry.provider} (${entry.source}) a echoue, on essaie le suivant.`, err.message);
    }
  }
  throw lastError || new Error("Tous les fournisseurs IA ont echoue.");
}

module.exports = { askAI, PROVIDER_LABELS };
