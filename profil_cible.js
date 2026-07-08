// ============================================================
// api/profil_cible.js — Profil cible d'un recrutement
//   POST { cle, code, fichePoste }  → l'IA lit la fiche de poste,
//     en extrait les soft skills attendus et les traduit en profil
//     cible Sinéa (familles, Big Five, pilotage, comportements).
//     Le profil est sauvegardé dans la campagne ("Profil cible (JSON)").
//   POST { cle, code, action:"lire" } → relit le profil cible sauvegardé.
//
//   LIMITE ASSUMÉE : Sinéa mesure l'adéquation comportementale (soft
//   skills), jamais les compétences techniques. Le profil cible ne
//   contient que ce qui est réellement déductible de la fiche.
// ============================================================

const { appliquerCors } = require("./_cors");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 2200;

function champFormule(v) { return String(v == null ? "" : v).replace(/[\\"]/g, ""); }

async function airtableGet(table, params = "") {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

async function airtablePatch(table, id, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable PATCH ${res.status}`);
  return await res.json();
}

async function trouverCampagne(code) {
  const formula = encodeURIComponent(`{Code campagne} = "${champFormule(code)}"`);
  const data = await airtableGet("Campagnes", `?filterByFormula=${formula}&maxRecords=1`);
  return (data.records && data.records[0]) || null;
}

function construirePrompt(fichePoste) {
  return `Tu es un expert en évaluation comportementale au travail. Une entreprise recrute et te donne sa fiche de poste. Ta mission : en extraire le PROFIL COMPORTEMENTAL CIBLE, traduit dans le référentiel Sinéa, pour permettre ensuite de mesurer l'adéquation des candidats.

FICHE DE POSTE (texte fourni par l'entreprise) :
"""
${String(fichePoste).slice(0, 6000)}
"""

RÉFÉRENTIEL SINÉA :
- 4 familles : RELATION (lien, humain, cohésion), ACTION (énergie, exécution, résultat), STRUCTURE (cadre, rigueur, fiabilité), VISION (cap, innovation, hauteur de vue).
- Big Five sur 100 : E extraversion, A agréabilité, C conscience, N sensibilité au stress (un N bas = grande stabilité), O ouverture.
- Pilotage : energie (sprinteur, endurant, cyclique, deepworker), autorite (cadre, sens, liberte, contributeur), collaboration (autonome, cooperatif, interdependant, federateur), reconnaissance (resultats, effort, relation, autonomie).
- Comportements : stress (accelerateur, methodique, retrait, appui), conflit (affrontement, mediation, compromis, evitement), risque (audacieux, calcule, prudent, securitaire), changement (moteur, adaptable, pragmatique, ancre).

RÈGLES IMPÉRATIVES D'HONNÊTETÉ :
- Tu déduis UNIQUEMENT ce que la fiche permet réellement de déduire. Pour toute dimension que la fiche n'éclaire pas, mets null. Un profil cible partiel et juste vaut mieux qu'un profil complet inventé.
- bigFive_importance indique le poids de chaque trait pour CE poste : 2 si le trait est central, 1 s'il compte, 0 s'il est indifférent. Un poste n'exige jamais tout.
- Tu travailles sur les soft skills et le comportement. Ignore totalement les compétences techniques, les diplômes et l'expérience : ils sont hors périmètre.

Réponds STRICTEMENT en JSON valide, sans aucun texte autour, au format exact :
{
  "intitule_poste": "l'intitulé du poste tel que lu dans la fiche",
  "resume": "environ 50 mots : le cœur comportemental de ce poste (ce que la personne devra ÊTRE au quotidien, au-delà de ce qu'elle devra savoir faire)",
  "famille_principale": "RELATION, ACTION, STRUCTURE ou VISION",
  "famille_secondaire": "une deuxième famille utile, ou null",
  "bigFive_cible": { "E": 0-100 ou null, "A": 0-100 ou null, "C": 0-100 ou null, "N": 0-100 ou null, "O": 0-100 ou null },
  "bigFive_importance": { "E": 0-2, "A": 0-2, "C": 0-2, "N": 0-2, "O": 0-2 },
  "pilotage_cible": { "energie": "valeur ou null", "autorite": "valeur ou null", "collaboration": "valeur ou null", "reconnaissance": "valeur ou null" },
  "contextuel_cible": { "stress": "valeur ou null", "conflit": "valeur ou null", "risque": "valeur ou null", "changement": "valeur ou null" },
  "soft_skills": ["3 à 5 soft skills clés extraites de la fiche, formulées en quelques mots chacune"],
  "justification": "environ 40 mots : sur quels éléments de la fiche tu t'appuies pour ce profil cible"
}
Règles d'écriture : aucun tiret cadratin. Formulations affirmatives.`;
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { cle, code, fichePoste, action } = body || {};
    // garde-fou anti-rafale : on limite la cadence d'un même appelant
    const okCadence = await verifierCadence(identifiantAppelant(req, body), 8);
    if (!okCadence) return res.status(429).json({ ok:false, raison:"trop_rapide", erreur:"Trop de requêtes rapprochées. Patientez quelques secondes." });
    const cleRecue = ((req.headers || {})["x-dashboard-key"]) || cle;
    if (!DASHBOARD_KEY || cleRecue !== DASHBOARD_KEY) return res.status(401).json({ error: "Accès non autorisé" });
    if (!code) return res.status(400).json({ error: "code de campagne manquant" });

    const campagne = await trouverCampagne(code);
    if (!campagne) return res.status(404).json({ error: "Campagne introuvable" });

    // ---- lecture seule du profil cible sauvegardé ----
    if (action === "lire") {
      let cible = null;
      try { cible = JSON.parse(campagne.fields["Profil cible (JSON)"] || "null"); } catch (e) { cible = null; }
      return res.status(200).json({ ok: true, cible });
    }

    // ---- génération depuis la fiche de poste ----
    if (!fichePoste || String(fichePoste).trim().length < 60) {
      return res.status(400).json({ error: "Fiche de poste trop courte pour une lecture fiable (60 caractères minimum)" });
    }
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "Configuration IA manquante" });

    const apiRes = await fetchAvecDelai(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: "user", content: construirePrompt(fichePoste) }] }),
    });
    if (!apiRes.ok) return res.status(500).json({ error: `IA ${apiRes.status}` });
    const data = await apiRes.json();
    const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const clean = txt.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    let cible = null;
    try { cible = JSON.parse(clean); } catch { cible = null; }
    if (!cible || !cible.famille_principale) return res.status(502).json({ error: "Lecture de la fiche illisible, réessayez" });
    cible.genere_le = new Date().toISOString();

    // sauvegarde sur la campagne (dégradé gracieux si la colonne est absente)
    try { await airtablePatch("Campagnes", campagne.id, { "Profil cible (JSON)": JSON.stringify(cible) }); } catch (e) {}

    return res.status(200).json({ ok: true, cible });
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
