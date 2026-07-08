// ============================================================
// api/entretien_candidat.js — Questions d'entretien personnalisées
//   POST { cle, email, profilCible } → croise le profil RÉEL du
//   candidat (son test) avec le profil CIBLE du poste, et produit
//   des questions d'entretien ciblées sur les écarts et les points
//   à valider (fiabilité du test, coût d'adaptation).
//
//   PRINCIPE : un écart n'élimine personne. Il devient une question
//   d'entretien. La décision reste humaine, toujours.
// ============================================================

const { appliquerCors } = require("./_cors");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 2600;

function champFormule(v) { return String(v == null ? "" : v).replace(/[\\"]/g, ""); }

async function airtableGet(table, params = "") {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  return await res.json();
}

async function trouverParEmail(email) {
  const formule = encodeURIComponent(`LOWER({Email}) = "${champFormule(email).trim().toLowerCase()}"`);
  const data = await airtableGet("Répondants", `?filterByFormula=${formule}&maxRecords=1`);
  return (data.records && data.records[0]) || null;
}

function extraireProfilRiche(jsonBrut) {
  if (!jsonBrut) return null;
  let data;
  try { data = typeof jsonBrut === "string" ? JSON.parse(jsonBrut) : jsonBrut; } catch (e) { return null; }
  if (data && data.scoresBigFive) return data;
  const modules = Object.values(data || {}).filter((m) => m && m.profil);
  if (!modules.length) return null;
  const choisi = modules.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
  return choisi.profil;
}

function profilDepuisFiche(rec) {
  if (!rec) return null;
  const f = rec.fields;
  const riche = extraireProfilRiche(f["Résultat complet (JSON)"] || f["Analyses (JSON)"]) || {};
  const bf = riche.scoresBigFive || {
    E: f["Big Five (E)"], A: f["Big Five (A)"], C: f["Big Five (C)"], N: f["Big Five (N)"], O: f["Big Five (O)"],
  };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  return {
    nom: [f["Prénom"], f["Nom"]].filter(Boolean).join(" ") || f["Email"] || "Candidat",
    archetype: riche.dominante ? riche.dominante.nom : (f["Archétype dominant"] || ""),
    famille: (riche.dominante ? riche.dominante.famille : f["Famille dominante"] || "").toUpperCase(),
    bigFive: { E: num(bf.E), A: num(bf.A), C: num(bf.C), N: num(bf.N), O: num(bf.O) },
    pilotage: riche.contextuelPlus || {},
    contextuel: riche.contextuel || {},
    coutAdaptation: (riche.naturelAdapte && riche.naturelAdapte.cout) || null,
    fiabilite: (riche.fiabilite && riche.fiabilite.score !== undefined) ? riche.fiabilite.score : null,
  };
}

const LIB = {
  energie: { sprinteur: "sprinteur (pics courts)", endurant: "endurant (effort régulier)", cyclique: "cyclique", deepworker: "deep-worker (concentration longue)" },
  autorite: { cadre: "besoin de cadre clair", sens: "besoin de sens", liberte: "besoin de liberté", contributeur: "besoin d'être associé aux décisions" },
  collaboration: { autonome: "autonome", cooperatif: "coopératif", interdependant: "interdépendant", federateur: "fédérateur" },
  reconnaissance: { resultats: "reconnaissance par les résultats", effort: "reconnaissance de l'effort", relation: "reconnaissance par la considération", autonomie: "reconnaissance par la confiance" },
  stress: { accelerateur: "accélère sous stress", methodique: "se structure sous stress", retrait: "prend du recul sous stress", appui: "cherche l'appui sous stress" },
  conflit: { affrontement: "aborde le conflit de front", mediation: "cherche à réconcilier", compromis: "cherche le compromis", evitement: "désamorce et temporise" },
  risque: { audacieux: "audacieux", calcule: "risque calculé", prudent: "prudent", securitaire: "sécuritaire" },
  changement: { moteur: "moteur du changement", adaptable: "adaptable", pragmatique: "pragmatique", ancre: "ancré" },
};
const lib = (dim, v) => (v && LIB[dim] && LIB[dim][v]) ? LIB[dim][v] : (v || "non mesuré");

function bfStr(bf) {
  if (!bf) return "non mesuré";
  const noms = { E: "Extraversion", A: "Agréabilité", C: "Conscience", N: "Sensibilité au stress", O: "Ouverture" };
  return ["E", "A", "C", "N", "O"].map((d) => bf[d] == null ? "" : `${noms[d]} ${bf[d]}`).filter(Boolean).join(", ");
}

function construirePrompt(cand, cible) {
  const pil = (p, cles) => cles.map((k) => p && p[k] ? `${lib(k, p[k])}` : "").filter(Boolean).join(", ") || "non mesuré";
  const cibleBf = cible.bigFive_cible || {};
  const cibleImp = cible.bigFive_importance || {};
  const cibleBfStr = ["E", "A", "C", "N", "O"].map((k) => (cibleBf[k] != null && (cibleImp[k] || 0) > 0) ? `${k} cible ${cibleBf[k]}${cibleImp[k] >= 2 ? " (central)" : ""}` : "").filter(Boolean).join(", ") || "non précisé";
  const cibleComport = pil(Object.assign({}, cible.pilotage_cible || {}, cible.contextuel_cible || {}), ["energie", "autorite", "collaboration", "reconnaissance", "stress", "conflit", "risque", "changement"]);
  const signaux = [];
  if (cand.fiabilite != null && cand.fiabilite < 70) signaux.push(`la cohérence des réponses du candidat au test est modérée (${cand.fiabilite}%) : prévois 2 questions de validation croisée des traits centraux`);
  if (cand.coutAdaptation === "élevé") signaux.push("le candidat déclare fonctionner loin de sa nature au travail (coût d'adaptation élevé) : explore son rapport à l'authenticité et à l'énergie au travail");
  return `Tu es un expert en recrutement structuré. Un candidat a passé le test Sinéa et tu connais le profil cible du poste. Ta mission : préparer pour le recruteur un entretien PERSONNALISÉ pour CE candidat, qui transforme chaque écart au profil cible en question à explorer, jamais en motif d'élimination.

PROFIL CIBLE DU POSTE (${cible.intitule_poste || "poste à pourvoir"}) :
Famille principale : ${cible.famille_principale || "?"}${cible.famille_secondaire ? `, secondaire ${cible.famille_secondaire}` : ""}. Big Five : ${cibleBfStr}. Fonctionnement attendu : ${cibleComport}. Soft skills clés : ${(cible.soft_skills || []).join(" ; ") || "?"}.

PROFIL RÉEL DU CANDIDAT (${cand.nom}) :
Archétype ${cand.archetype} (famille ${cand.famille}). ${bfStr(cand.bigFive)}.
Pilotage : ${pil(cand.pilotage, ["energie", "autorite", "collaboration", "reconnaissance"])}. Comportements : ${pil(cand.contextuel, ["stress", "conflit", "risque", "changement"])}.
${signaux.length ? `Signaux à traiter : ${signaux.join(" ; ")}.` : ""}

MÉTHODE :
- Identifie 2 ou 3 POINTS D'APPUI : là où le candidat correspond naturellement au poste. Le recruteur doit aussi savoir sur quoi s'appuyer.
- Identifie 3 ou 4 ÉCARTS RÉELS entre son profil et la cible. Pour chacun : un constat factuel et neutre (jamais un jugement), puis 2 questions comportementales (méthode STAR, faits passés) qui permettent de vérifier comment le candidat gère cet écart en pratique. Un écart compensé par l'expérience est fréquent : les questions servent à le découvrir.
- Reste sur les soft skills et le comportement, jamais sur les compétences techniques.

Réponds STRICTEMENT en JSON valide, sans aucun texte autour, au format exact :
{
  "lecture": "environ 50 mots : la lecture d'ensemble de ce candidat face à ce poste, équilibrée, qui donne au recruteur le bon état d'esprit pour l'entretien",
  "points_forts": ["2 ou 3 points où le candidat correspond naturellement au poste, chacun environ 18 mots"],
  "ecarts": [
    { "dimension": "nom court de l'écart", "constat": "environ 28 mots, factuel et neutre : son profil indique X, le poste attend Y, voici ce que cela peut signifier au quotidien", "questions": ["2 questions comportementales précises (faits passés), chacune environ 22 mots"] }
  ],
  "validation_fiabilite": ["uniquement si la fiabilité est modérée : 2 questions de validation croisée des traits centraux du poste. Sinon liste vide."],
  "conseil_integration": "environ 30 mots : si ce candidat est retenu, le point d'attention pour réussir son intégration"
}
Règles d'écriture : ton professionnel et bienveillant, vouvoiement, aucun tiret cadratin, formulations affirmatives, jamais de jugement sur la personne.`;
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { cle, email, profilCible } = body || {};
    // garde-fou anti-rafale : on limite la cadence d'un même appelant
    const okCadence = await verifierCadence(identifiantAppelant(req, body), 8);
    if (!okCadence) return res.status(429).json({ ok:false, raison:"trop_rapide", erreur:"Trop de requêtes rapprochées. Patientez quelques secondes." });
    const cleRecue = ((req.headers || {})["x-dashboard-key"]) || cle;
    if (!DASHBOARD_KEY || cleRecue !== DASHBOARD_KEY) return res.status(401).json({ error: "Accès non autorisé" });
    if (!email) return res.status(400).json({ error: "email du candidat manquant" });
    if (!profilCible || !profilCible.famille_principale) return res.status(400).json({ error: "profil cible manquant (définissez-le depuis la fiche de poste)" });
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "Configuration IA manquante" });

    const rec = await trouverParEmail(email);
    if (!rec) return res.status(404).json({ error: "Candidat introuvable (a-t-il terminé le test ?)" });
    const cand = profilDepuisFiche(rec);
    if (!cand.archetype) return res.status(422).json({ error: "Profil du candidat incomplet (test non terminé)" });

    const apiRes = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: "user", content: construirePrompt(cand, profilCible) }] }),
    });
    if (!apiRes.ok) return res.status(500).json({ error: `IA ${apiRes.status}` });
    const data = await apiRes.json();
    const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const clean = txt.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    let entretien = null;
    try { entretien = JSON.parse(clean); } catch { entretien = null; }
    if (!entretien || !Array.isArray(entretien.ecarts)) return res.status(502).json({ error: "Préparation illisible, réessayez" });

    return res.status(200).json({ ok: true, candidat: { nom: cand.nom, archetype: cand.archetype }, entretien });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
