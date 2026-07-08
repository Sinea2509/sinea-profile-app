// ============================================================
// api/signature.js — La "signature" de l'apprenant (tête de restitution)
// Quatre temps courts et percutants : essence, force rare, tension, prochain pas.
// C'est la pièce qui crée le "waouh" : la personne se sent vue avec précision.
// Endpoint : POST /api/signature
// ============================================================

const { appliquerCors } = require("./_cors");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");
const { nettoyer } = require("./editorial.js");

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 900;

async function fetchAvecDelai(url, options, essais = 2) {
  for (let i = 0; i < essais; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || i === essais - 1) return res;
    } catch (e) {
      if (i === essais - 1) throw e;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
}

function construirePrompt(data) {
  const dom = data.dominante || {};
  const secondaires = (data.secondaires || []).map((s) => s.nom).join(", ");
  const bf = data.scoresBigFive || {};
  // on transmet les traits en clair pour un portrait fondé sur le Big Five
  const traits = [
    `Ouverture : ${Math.round(bf.ouverture ?? bf.O ?? 50)}/100`,
    `Conscienciosité : ${Math.round(bf.conscience ?? bf.C ?? 50)}/100`,
    `Extraversion : ${Math.round(bf.extraversion ?? bf.E ?? 50)}/100`,
    `Agréabilité : ${Math.round(bf.agreabilite ?? bf.A ?? 50)}/100`,
    `Stabilité émotionnelle : ${Math.round(100 - (bf.neuroticisme ?? bf.N ?? 50))}/100`,
  ].join(" · ");

  // écart naturel / adapté, s'il est disponible : matière à "tension"
  let tensionNat = "";
  if (data.naturelAdapte && data.naturelAdapte.ecarts) {
    const e = data.naturelAdapte.ecarts;
    const fort = Object.entries(e).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    if (fort && Math.abs(fort[1]) >= 12) {
      tensionNat = `La personne montre un écart notable entre son naturel et son comportement au travail sur la dimension "${fort[0]}". C'est une piste de tension intérieure à explorer avec finesse.`;
    }
  }

  const mots = [];
  if (data.reponses_ouvertes) {
    if (data.reponses_ouvertes.q1) mots.push(`Quand elle se sent pleinement elle-même : "${data.reponses_ouvertes.q1}"`);
    if (data.reponses_ouvertes.intention) mots.push(`Ce qu'elle attendait de ce bilan : "${data.reponses_ouvertes.intention}"`);
  }

  return `Tu es Néa, coach experte en psychologie du travail. Tu écris la "signature" d'une personne en tête de son bilan : le tout premier texte qu'elle lit sur elle. Ton objectif : qu'elle se dise "c'est exactement moi", avec le sentiment d'être vue en profondeur, jamais étiquetée.

DONNÉES (fondées sur le modèle des Big Five) :
- Archétype dominant : ${dom.nom || "—"} (famille ${dom.famille || "—"})
- Archétypes secondaires : ${secondaires || "—"}
- Traits Big Five : ${traits}
${tensionNat ? "- " + tensionNat : ""}
${mots.length ? "- Ses propres mots :\n  " + mots.join("\n  ") : ""}

ÉCRIS un objet JSON avec EXACTEMENT ces quatre champs, et RIEN d'autre (pas de texte autour, pas de balises) :
{
  "essence": "Une seule phrase qui capture qui est cette personne, mémorable et juste. Pas le nom de l'archétype, mais une formule vivante. ~20 mots max.",
  "force_rare": "Ce qu'elle apporte que peu de gens apportent. Valorisant, concret, spécifique à son profil. 2 phrases max.",
  "tension": "L'écart intérieur qui la rend humaine : entre deux de ses forces, ou entre qui elle est et qui elle montre. Nommé avec délicatesse et bienveillance, jamais comme un défaut. 2 phrases max.",
  "prochain_pas": "Une direction de progression formulée comme une invitation stimulante, jamais comme une correction. 1 à 2 phrases."
}

RÈGLES D'ÉCRITURE STRICTES :
- Vouvoiement.
- Formulations AFFIRMATIVES uniquement. Jamais de "ce n'est pas X c'est Y", jamais de "pas pour X mais pour Y", aucune négation rhétorique.
- Aucun tiret long. Aucune liste. Aucun titre.
- Ton chaleureux, précis, premium. Chaque mot compte.
- Parle d'elle, jamais de la méthode.`;
}

async function genererSignature(apiKey, data) {
  const prompt = construirePrompt(data);
  const res = await fetchAvecDelai(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
  }
  const dataRes = await res.json();
  const texte = (dataRes.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const clean = texte.replace(/```json\s*|\s*```/g, "").trim();
  let obj;
  try { obj = JSON.parse(clean); } catch { obj = null; }
  if (!obj) return null;

  // garde-fou éditorial sur chaque champ
  ["essence", "force_rare", "tension", "prochain_pas"].forEach((k) => {
    if (obj[k]) obj[k] = nettoyer(String(obj[k]));
  });
  return obj;
}

module.exports = async (req, res) => {
  if (appliquerCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  // garde-fou de cadence (réutilise l'infrastructure existante) : 4s minimum entre deux appels
  try {
    const id = identifiantAppelant(req, req.body);
    const ok = await verifierCadence(id, 4);
    if (!ok) return res.status(429).json({ error: "Trop de requêtes, réessayez dans un instant." });
  } catch (e) { /* si le rate-limit échoue, on ne bloque pas */ }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Clé API manquante" });

  try {
    const data = req.body || {};
    const signature = await genererSignature(apiKey, data);
    if (!signature) return res.status(200).json({ ok: false });
    return res.status(200).json({ ok: true, signature });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e).slice(0, 200) });
  }
};
