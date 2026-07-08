// ============================================================
// api/brief_developpement.js — Le brief de développement individuel
// Une page de décision RH : forces d'appui avec leur usage,
// opportunités priorisées avec levier et offre, vigilances de
// staffing en stratégie. Accessible au super admin ET aux clés RH
// (l'endpoint rédige à partir des données transmises, sans accès
// aux données : le périmètre reste contrôlé par le portail).
// ============================================================

const { appliquerCors } = require("./_cors");
const { nettoyer } = require("./editorial.js");

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 2600;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
let CLES_RH = {};
try { CLES_RH = JSON.parse(process.env.DASHBOARD_CLES_RH || "{}"); } catch (e) { CLES_RH = {}; }
const CODES_REESSAI = [429, 500, 502, 503, 529];

const OFFRES_SINEA = "Parcours Management (posture, délégation, feedback), Parcours Vente SEED (prospection, closing, traitement des objections), Communication d'influence, Cohésion d'équipe et profils comportementaux, Gestion du stress et résilience, Formation sur mesure Sinéa.";

function ligneComp(c) {
  return `- ${c.nom} (potentiel ${Math.round(c.potentiel)}, expression ${Math.round(c.expression)}${c.motif ? `, motif : ${c.motif === "sous_expression" ? "potentiel encore peu exprimé au travail" : "compétence déterminante du poste, potentiel médian"}` : ""})`;
}

function promptBrief(d) {
  return "Tu rédiges le BRIEF DE DÉVELOPPEMENT d'un collaborateur pour son interlocuteur RH. Une page de décision, inspirée de la logique TMA : le potentiel d'une compétence vient des moteurs naturels de la personne, on investit là où le terreau est fertile, on économise l'énergie ailleurs. Formulation positive, sans jugement, orientée décision.\n\n"
    + `LA PERSONNE\n${d.prenom || d.nom} ${d.nom && d.prenom ? d.nom.replace(d.prenom, "").trim() : ""}, archétype ${d.archetype || "non précisé"} (famille ${d.famille || "?"}). Poste de référence : ${d.poste}.`
    + (d.cout ? ` Coût d'adaptation mesuré : ${d.cout}.` : "") + "\n\n"
    + "SES FORCES D'APPUI (potentiel et expression hauts)\n" + (d.appuis || []).map(ligneComp).join("\n") + "\n\n"
    + "SES OPPORTUNITÉS PRIORITAIRES POUR CE POSTE\n" + (d.opportunites || []).map(ligneComp).join("\n") + "\n\n"
    + ((d.vigilances || []).length ? "VIGILANCES DE STAFFING (potentiel bas sur une compétence déterminante du poste)\n" + d.vigilances.map(ligneComp).join("\n") + "\n\n" : "")
    + (d.evolution && typeof d.evolution.apres === "number"
      ? `ÉVOLUTION MESURÉE (re-mesure du ${d.evolution.date || "?"}) : coût d'adaptation passé de ${d.evolution.avant} à ${d.evolution.apres} (niveau ${d.evolution.coutApres || "?"}). C'est une preuve d'impact rare : intègre une phrase de preuve dans l'accroche ou la conclusion.\n\n`
      : "")
    + (d.regards && d.regards.n
      ? `REGARDS EXTERNES (miroir 360, ${d.regards.n} collègues)\nAppuis vus : ${(d.regards.appuis || []).map((x) => x.nom + " " + x.vu).join(", ") || "?"}. Opportunités vues : ${(d.regards.opportunites || []).map((x) => x.nom + " " + x.vu).join(", ") || "?"}. Intègre une phrase qui confirme ou nuance avec ces regards.\n\n`
      : "")
    + "CONTEXTE SEEDUP\n" + (d.seedupActif
      ? `SeedUp est actif : ${d.nbDefis || 0} défis de terrain déjà réalisés.${(d.defisFaits || []).length ? " Défis récents : " + d.defisFaits.join(" ; ") + ". Appuie une phrase du brief sur ce vécu terrain réel." : ""} Les défis types que tu proposes seront réellement poussés à la personne.`
      : "SeedUp est disponible en option sur cette campagne : propose quand même les défis types, ils serviront d'aperçu de ce que l'ancrage terrain apporterait.") + "\n\n"
    + "OFFRES SINÉA MOBILISABLES : " + OFFRES_SINEA + "\n\n"
    + "TA MISSION\n"
    + "Rédige : une accroche de 2 phrases qui situe la personne dans son poste avec justesse et chaleur professionnelle. Pour chaque force d'appui, un USAGE concret en une phrase à l'impératif adressée au RH ou au manager, du type confiez-lui, appuyez-vous sur elle pour, faites-en le référent de. Pour chaque opportunité, trois choses : POURQUOI MAINTENANT en une phrase, en t'appuyant sur le motif fourni (potentiel présent encore peu exprimé, la formation prendra vite ; ou compétence clé du rôle à potentiel médian, progression réaliste par la pratique guidée), un LEVIER concret et réaliste en une phrase, l'OFFRE Sinéa la plus pertinente du catalogue, et 2 DÉFIS DE TERRAIN types au format SeedUp, tutoiement, 15 à 25 mots chacun, avec déclencheur contextuel précis. Pour chaque vigilance, une STRATÉGIE de compensation en une phrase, binôme, process, délégation, jamais un verdict sur la personne. Termine par une conclusion de 2 phrases qui donne la trajectoire.\n\n"
    + "RÈGLES D'ÉCRITURE STRICTES\n"
    + "Vouvoiement au RH, la personne désignée par son prénom. Phrases courtes et concrètes. Varie les attaques des usages et des leviers, jamais deux fois le même verbe d'ouverture (confiez-lui, appuyez-vous sur, mettez-la sur, faites-en, sollicitez, associez). Aucun tiret cadratin, remplace par deux-points, virgule ou point. Formulations affirmatives uniquement, aucune tournure du type ce n'est pas X mais Y. Zéro jargon creux.\n\n"
    + "RÉPONDS STRICTEMENT EN JSON VALIDE, sans aucun texte autour, format exact :\n"
    + '{"accroche":"...","appuis":[{"competence":"...","usage":"..."}],"opportunites":[{"competence":"...","pourquoi":"...","levier":"...","offre":"...","defis":["...","..."]}],"vigilances":[{"competence":"...","strategie":"..."}],"conclusion":"..."}';
}

function nettoyerRec(b) {
  if (!b || typeof b !== "object") return b;
  if (Array.isArray(b)) return b.map(nettoyerRec);
  const out = {};
  for (const [k, v] of Object.entries(b)) out[k] = typeof v === "string" ? nettoyer(v) : nettoyerRec(v);
  return out;
}

async function generer(apiKey, data) {
  let derniereErreur = null;
  for (let essai = 0; essai < 3; essai++) {
    if (essai > 0) await new Promise((r) => setTimeout(r, essai * 1500 + Math.random() * 600));
    let res;
    try {
      res = await fetchAvecDelai(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: "user", content: promptBrief(data) }] }),
      });
    } catch (e) {
      if (e && /trop lent/.test(e.message || "")) throw e;
      derniereErreur = e;
      continue;
    }
    if (res.ok) {
      const d = await res.json();
      const texte = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return nettoyerRec(JSON.parse(texte.replace(/```json\s*|\s*```/g, "").trim()));
    }
    const corps = await res.text();
    derniereErreur = new Error("API " + res.status + ": " + corps.slice(0, 200));
    if (!CODES_REESSAI.includes(res.status)) throw derniereErreur;
  }
  throw derniereErreur;
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ erreur: "Corps JSON invalide" }); }
  }
  body = body || {};

  const cleRecue = ((req.headers || {})["x-dashboard-key"]) || body.cle;
  const autorise = (!!DASHBOARD_KEY && cleRecue === DASHBOARD_KEY) || (!!cleRecue && !!CLES_RH[cleRecue]);
  if (!autorise) return res.status(401).json({ erreur: "Accès non autorisé" });
  if (!Array.isArray(body.appuis) || !body.appuis.length) {
    return res.status(400).json({ erreur: "Aucune compétence fournie" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ erreur: "Clé API non configurée" });

  try {
    const brief = await generer(apiKey, body);
    return res.status(200).json({ ok: true, brief });
  } catch (e) {
    return res.status(500).json({ ok: false, erreur: e.message });
  }
};

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
