// ============================================================
// api/compatibilite.js — Compatibilité manager / collaborateur
//   POST { cle, emailManager, emailCollaborateur, force }
//     → score global + score par dimension (calcul serveur, objectif)
//       + analyse qualitative IA (frictions, leviers, mode d'emploi du binôme)
//
//   PRINCIPE ÉTHIQUE : un score de compatibilité n'est PAS un verdict sur les
//   personnes. C'est une carte des points de friction et de levier à anticiper.
//   La complémentarité (profils différents) vaut souvent autant que la similarité.
//   Le score est destiné au RH ; l'analyse qualitative est partageable aux deux.
// ============================================================

const { appliquerCors } = require("./_cors");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 3500;

function champFormule(v) { return String(v == null ? "" : v).replace(/[\\"]/g, ""); }

async function airtableGet(table, params = "") {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);
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

// Reconstruit un profil exploitable depuis une fiche Répondant Airtable.
function profilDepuisFiche(rec) {
  if (!rec) return null;
  const f = rec.fields;
  const riche = extraireProfilRiche(f["Résultat complet (JSON)"] || f["Analyses (JSON)"]) || {};
  const bf = riche.scoresBigFive || {
    E: f["Big Five (E)"], A: f["Big Five (A)"], C: f["Big Five (C)"], N: f["Big Five (N)"], O: f["Big Five (O)"],
  };
  return {
    nom: [f["Prénom"], f["Nom"]].filter(Boolean).join(" ") || f["Email"] || "Anonyme",
    archetype: riche.dominante ? riche.dominante.nom : (f["Archétype dominant"] || ""),
    famille: (riche.dominante ? riche.dominante.famille : f["Famille dominante"] || "").toUpperCase(),
    bigFive: {
      E: num(bf.E), A: num(bf.A), C: num(bf.C), N: num(bf.N), O: num(bf.O),
    },
    pilotage: riche.contextuelPlus || {},
    contextuel: riche.contextuel || {},
    coutAdaptation: (riche.naturelAdapte && riche.naturelAdapte.cout) || null,
    fiabilite: (riche.fiabilite && riche.fiabilite.score !== undefined) ? riche.fiabilite.score : null,
  };
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

// ============================================================
// CALCUL DU SCORE (objectif, serveur, jamais l'IA)
// ============================================================
//
// Philosophie : on ne récompense pas la ressemblance brute. Pour chaque dimension,
// on définit si l'idéal est la PROXIMITÉ (mieux vaut se ressembler) ou la
// COMPLÉMENTARITÉ (une différence modérée est saine). Le score par dimension
// mesure donc "à quel point ce binôme est fluide sur cet aspect", pas "à quel
// point ils sont identiques".

const LIB = {
  energie: { sprinteur: "sprinteur", endurant: "endurant", cyclique: "cyclique", deepworker: "deep-worker" },
  collaboration: { autonome: "autonome", cooperatif: "coopératif", interdependant: "interdépendant", federateur: "fédérateur" },
  autorite: { cadre: "besoin de cadre", sens: "besoin de sens", liberte: "besoin de liberté", contributeur: "besoin d'être associé" },
  reconnaissance: { resultats: "par les résultats", effort: "de l'effort", relation: "par la considération", autonomie: "par la confiance" },
  stress: { accelerateur: "accélère sous stress", methodique: "se structure sous stress", retrait: "prend du recul sous stress", appui: "cherche l'appui sous stress" },
  conflit: { affrontement: "aborde le conflit de front", mediation: "cherche à réconcilier", compromis: "cherche le compromis", evitement: "désamorce et temporise" },
  motivation: { accomplissement: "moteur accomplissement", reconnaissance: "moteur reconnaissance", sens: "moteur sens", maitrise: "moteur maîtrise" },
  risque: { audacieux: "audacieux face au risque", calcule: "calcule le risque", prudent: "prudent", securitaire: "privilégie la sécurité" },
  changement: { moteur: "moteur du changement", adaptable: "s'adapte au changement", pragmatique: "pragmatique face au changement", ancre: "ancré, attaché au stable" },
};
const lib = (dim, v) => (v && LIB[dim] && LIB[dim][v]) ? LIB[dim][v] : (v || "non mesuré");

// Score Big Five : compatibilité par trait.
// E, A, O : la proximité aide (styles relationnels et d'ouverture proches = moins de friction),
//   mais une différence modérée reste saine. On pénalise surtout les écarts extrêmes.
// C : un écart marqué de rapport à la rigueur est une vraie source de friction au travail.
// N (stabilité) : peu pénalisant ; deux stabilités différentes se complètent souvent.
function scoreBigFive(a, b) {
  const poids = { E: 0.8, A: 1.1, C: 1.3, N: 0.6, O: 0.9 };
  let total = 0, somme = 0;
  for (const d of ["E", "A", "C", "N", "O"]) {
    if (a[d] == null || b[d] == null) continue;
    const ecart = Math.abs(a[d] - b[d]); // 0..100
    // courbe douce : un écart de 0 donne 100, un écart de 50 donne ~55, un écart de 100 donne ~10
    const sousScore = Math.max(0, 100 - Math.pow(ecart / 10, 1.7) * 4.2);
    total += sousScore * poids[d];
    somme += poids[d];
  }
  return somme ? Math.round(total / somme) : null;
}

// Compatibilité d'une dimension de pilotage entre manager et collaborateur.
// Chaque dimension a sa propre logique : certaines paires sont fluides, d'autres demandent un ajustement.
const REGLES_PILOTAGE = {
  // Rapport au cadre du collaborateur vs style du manager : ici on regarde surtout
  // le besoin du collaborateur. Un besoin de cadre fort avec un manager très "liberté" friction.
  autorite: (mgr, col) => {
    if (!mgr || !col) return null;
    if (mgr === col) return 92;
    const fluide = { cadre: { sens: 78, contributeur: 70, liberte: 45 }, sens: { contributeur: 85, cadre: 72, liberte: 70 }, liberte: { sens: 75, contributeur: 72, cadre: 45 }, contributeur: { sens: 85, liberte: 75, cadre: 68 } };
    return (fluide[col] && fluide[col][mgr]) || 65;
  },
  // Rythmes d'énergie : la complémentarité est souvent un atout, sauf incompatibilités fortes.
  energie: (mgr, col) => {
    if (!mgr || !col) return null;
    if (mgr === col) return 85;
    const fluide = { sprinteur: { cyclique: 80, endurant: 70, deepworker: 60 }, endurant: { cyclique: 82, deepworker: 80, sprinteur: 70 }, cyclique: { endurant: 82, sprinteur: 80, deepworker: 72 }, deepworker: { endurant: 80, cyclique: 72, sprinteur: 60 } };
    return (fluide[col] && fluide[col][mgr]) || 70;
  },
  // Modes de collaboration : un collaborateur autonome avec un manager fédérateur = bonne dynamique.
  collaboration: (mgr, col) => {
    if (!mgr || !col) return null;
    if (mgr === col) return 82;
    const fluide = { autonome: { federateur: 85, interdependant: 75, cooperatif: 70 }, cooperatif: { federateur: 88, interdependant: 82, autonome: 70 }, interdependant: { federateur: 85, cooperatif: 82, autonome: 75 }, federateur: { cooperatif: 88, interdependant: 85, autonome: 82 } };
    return (fluide[col] && fluide[col][mgr]) || 72;
  },
  // Reconnaissance : le manager doit pouvoir nourrir le levier du collaborateur. Proximité = facile.
  reconnaissance: (mgr, col) => {
    if (!mgr || !col) return null;
    if (mgr === col) return 90;
    return 74; // un manager peut apprendre à reconnaître différemment ; friction modérée
  },
  // Réaction au stress : le vrai test d'une relation. Deux personnes qui réagissent en miroir
  // (l'une accélère, l'autre se retire) peuvent se heurter sous pression. Certaines paires se complètent.
  stress: (mgr, col) => {
    if (!mgr || !col) return null;
    if (mgr === col) return 80; // même réaction : se comprennent, risque de s'amplifier mutuellement
    const fluide = {
      accelerateur: { methodique: 78, appui: 70, retrait: 55 },
      methodique:   { accelerateur: 78, appui: 80, retrait: 75 },
      retrait:      { methodique: 75, appui: 72, accelerateur: 55 },
      appui:        { methodique: 80, retrait: 72, accelerateur: 70 },
    };
    return (fluide[col] && fluide[col][mgr]) || 68;
  },
  // Gestion du conflit : un manager qui fonce et un collaborateur qui évite, c'est la friction classique.
  conflit: (mgr, col) => {
    if (!mgr || !col) return null;
    if (mgr === col) return 82;
    const fluide = {
      affrontement: { mediation: 75, compromis: 78, evitement: 50 },
      mediation:    { compromis: 88, affrontement: 75, evitement: 78 },
      compromis:    { mediation: 88, affrontement: 78, evitement: 75 },
      evitement:    { mediation: 78, compromis: 75, affrontement: 50 },
    };
    return (fluide[col] && fluide[col][mgr]) || 70;
  },
};

function scoreDimension(dim, mgrPil, colPil) {
  const regle = REGLES_PILOTAGE[dim];
  if (!regle) return null;
  return regle(mgrPil && mgrPil[dim], colPil && colPil[dim]);
}

function calculerScores(mgr, col) {
  const dims = {};
  // Big Five : un score de "tempéraments compatibles"
  dims.temperament = {
    label: "Tempéraments",
    score: scoreBigFive(mgr.bigFive, col.bigFive),
  };
  // dimensions de pilotage
  const mapping = {
    autorite: "Rapport au cadre",
    energie: "Rythmes de travail",
    collaboration: "Mode de collaboration",
    reconnaissance: "Reconnaissance",
  };
  for (const [cle, label] of Object.entries(mapping)) {
    const s = scoreDimension(cle, mgr.pilotage, col.pilotage);
    if (s != null) dims[cle] = { label, score: s };
  }
  // dimensions contextuelles (stress, conflit) : sources de friction relationnelle majeures
  const mappingCtx = { stress: "Réaction au stress", conflit: "Gestion du conflit" };
  for (const [cle, label] of Object.entries(mappingCtx)) {
    const s = scoreDimension(cle, mgr.contextuel, col.contextuel);
    if (s != null) dims[cle] = { label, score: s };
  }
  // Score global : moyenne pondérée des dimensions disponibles.
  // Le tempérament et le rapport au cadre pèsent un peu plus (sources de friction majeures).
  const poids = { temperament: 1.2, autorite: 1.3, energie: 1.0, collaboration: 1.0, reconnaissance: 0.9, stress: 1.2, conflit: 1.2 };
  let total = 0, somme = 0;
  for (const [cle, v] of Object.entries(dims)) {
    if (v.score == null) continue;
    const p = poids[cle] || 1;
    total += v.score * p; somme += p;
  }
  const global = somme ? Math.round(total / somme) : null;
  return { global, dimensions: dims };
}

// ============================================================
// ANALYSE QUALITATIVE (IA) — partageable aux deux personnes
// ============================================================
function bfStr(bf) {
  if (!bf) return "non mesuré";
  const a = (d, l, h) => bf[d] == null ? "" : `${d === "N" ? "Stabilité" : ({E:"Extraversion",A:"Agréabilité",C:"Conscience",O:"Ouverture"}[d])} ${d === "N" ? 100 - bf[d] : bf[d]}`;
  return ["E","A","C","N","O"].map((d) => a(d)).filter(Boolean).join(", ");
}

function construirePrompt(mgr, col, scores) {
  const pil = (p) => ["energie","collaboration","autorite","reconnaissance"].map((k) => p[k] ? `${k}: ${lib(k, p[k])}` : "").filter(Boolean).join(", ") || "non mesuré";
  const ctx = (p) => ["stress","conflit","motivation","risque","changement"].map((k) => p[k] ? `${k}: ${lib(k, p[k])}` : "").filter(Boolean).join(", ") || "non mesuré";
  const detailScores = Object.values(scores.dimensions).map((d) => `${d.label}: ${d.score}/100`).join(", ");
  const signauxRH = [];
  if (mgr.coutAdaptation === "élevé") signauxRH.push(`le manager porte un coût d'adaptation élevé (il force sa nature au travail, risque d'usure)`);
  if (col.coutAdaptation === "élevé") signauxRH.push(`le collaborateur porte un coût d'adaptation élevé, point de vigilance d'usure surtout sous un management exigeant`);
  if (col.fiabilite != null && col.fiabilite < 70) signauxRH.push(`la fiabilité du profil du collaborateur est modérée (${col.fiabilite}%), à confirmer en échange direct plutôt qu'à prendre au pied de la lettre`);
  if (mgr.fiabilite != null && mgr.fiabilite < 70) signauxRH.push(`la fiabilité du profil du manager est modérée (${mgr.fiabilite}%), à nuancer`);
  const blocSignaux = signauxRH.length ? `\nSignaux RH à prendre en compte : ${signauxRH.join(" ; ")}.` : "";
  return `Tu es un coach en relations professionnelles. Tu analyses la relation de travail entre un MANAGER et son COLLABORATEUR, à partir de leurs profils Sinéa. Ton analyse sera lue par les DEUX personnes : elle doit être juste, bienveillante et utile aux deux, jamais un jugement.

PRINCIPE FONDAMENTAL : la compatibilité n'est pas la ressemblance. Deux profils différents se complètent souvent très bien. Ton rôle est de montrer où la relation est naturellement fluide, et où elle demande un mode d'emploi conscient, jamais de dire qu'un binôme "ne va pas".

MANAGER : ${mgr.nom}, archétype ${mgr.archetype} (famille ${mgr.famille}). ${bfStr(mgr.bigFive)}.
  Pilotage : ${pil(mgr.pilotage)}. Comportements : ${ctx(mgr.contextuel)}.
COLLABORATEUR : ${col.nom}, archétype ${col.archetype} (famille ${col.famille}). ${bfStr(col.bigFive)}.
  Pilotage : ${pil(col.pilotage)}. Comportements : ${ctx(col.contextuel)}.

Exploite finement les COMPORTEMENTS face au stress et au conflit : c'est souvent là que se joue une relation de travail. Par exemple, un manager qui accélère sous stress face à un collaborateur qui se met en retrait crée un malentendu classique à nommer. Croise aussi les moteurs de motivation et les rapports au risque et au changement quand ils éclairent la dynamique.

Scores de compatibilité déjà calculés (pour ton information, ne les répète pas tels quels) : ${detailScores}.${blocSignaux}

Réponds STRICTEMENT en JSON valide, sans texte autour, format exact :
{
  "synthese": "un paragraphe de 70 mots qui décrit la dynamique naturelle de ce binôme, ses points forts et son principal point d'attention, de façon équilibrée et bienveillante",
  "points_fluides": ["3 aspects où cette relation fonctionne naturellement bien, chacun environ 25 mots, ancrés dans leurs profils réels"],
  "points_attention": ["3 points où la relation demande un ajustement conscient, chacun environ 25 mots, formulés sans dramatiser, avec le mécanisme expliqué"],
  "conseils_manager": ["3 conseils concrets pour le manager dans sa façon de manager CE collaborateur précis, chacun environ 25 mots"],
  "conseils_collaborateur": ["2 conseils pour le collaborateur dans sa façon de travailler avec CE manager, chacun environ 25 mots"],
  "cle_de_voute": "une phrase mémorable d'environ 20 mots qui résume la clé pour que ce binôme fonctionne au mieux",
  "signaux_rh": ["0 à 3 points d'attention RH FACTUELS destinés au RH seulement (usure liée à un coût d'adaptation élevé, fiabilité de profil à confirmer, risque de friction structurelle sous pression), chacun environ 22 mots. Liste vide si aucun signal."]
}
Règles : ton de coach professionnel, bienveillant, concret. Aucun tiret cadratin, utilise un point médian ou reformule. Formulations affirmatives. Vouvoiement. Jamais de jugement sur les personnes, toujours sur la dynamique.`;
}

async function genererAnalyse(prompt) {
  const res = await fetchAvecDelai(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`IA ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const clean = txt.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { cle, emailManager, emailCollaborateur } = body || {};
    // garde-fou anti-rafale : on limite la cadence d'un même appelant
    const okCadence = await verifierCadence(identifiantAppelant(req, body), 8);
    if (!okCadence) return res.status(429).json({ ok:false, raison:"trop_rapide", erreur:"Trop de requêtes rapprochées. Patientez quelques secondes." });
    const cleRecue = ((req.headers || {})["x-dashboard-key"]) || cle;
    if (!DASHBOARD_KEY || cleRecue !== DASHBOARD_KEY) return res.status(401).json({ error: "Accès non autorisé" });
    if (!emailManager || !emailCollaborateur) return res.status(400).json({ error: "emailManager et emailCollaborateur requis" });
    if (emailManager.trim().toLowerCase() === emailCollaborateur.trim().toLowerCase()) {
      return res.status(400).json({ error: "Le manager et le collaborateur doivent être deux personnes différentes" });
    }
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "Configuration IA manquante" });

    const [recM, recC] = await Promise.all([trouverParEmail(emailManager), trouverParEmail(emailCollaborateur)]);
    if (!recM) return res.status(404).json({ error: "Manager introuvable (a-t-il passé le test ?)" });
    if (!recC) return res.status(404).json({ error: "Collaborateur introuvable (a-t-il passé le test ?)" });

    const mgr = profilDepuisFiche(recM);
    const col = profilDepuisFiche(recC);
    if (!mgr.archetype || !col.archetype) {
      return res.status(422).json({ error: "Profil incomplet pour l'un des deux (analyse non terminée)" });
    }

    // 1. scores objectifs (serveur)
    const scores = calculerScores(mgr, col);
    // 2. analyse qualitative (IA)
    let analyse = null;
    try { analyse = await genererAnalyse(construirePrompt(mgr, col, scores)); } catch (e) { analyse = null; }

    return res.status(200).json({
      ok: true,
      manager: { nom: mgr.nom, archetype: mgr.archetype, famille: mgr.famille },
      collaborateur: { nom: col.nom, archetype: col.archetype, famille: col.famille },
      scores,        // destiné au RH
      analyse,       // partageable aux deux
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};


// ---- robustesse : fetch avec délai maximal (coupe proprement avant le timeout plateforme) ----
async function fetchAvecDelai(url, options, ms) {
  const delai = ms || 55000;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delai);
  try {
    return await fetch(url, Object.assign({}, options || {}, { signal: controleur.signal }));
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("Service externe trop lent (délai dépassé), merci de réessayer.");
    throw e;
  } finally {
    clearTimeout(minuteur);
  }
}
