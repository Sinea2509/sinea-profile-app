// ============================================================
// api/brief_campagne.js — Génère le brief de campagne SeedUp d'une équipe
// Réservé à la clé super admin (DASHBOARD_KEY).
// POST { entreprise, campagne, axes, repartition, membres }
//   → { ok, brief } avec cap, kickoff, 4 semaines de défis déclinés
//     par famille, trame des sessions collectives et indicateurs.
// ============================================================

const { appliquerCors } = require("./_cors");
const { nettoyer } = require("./editorial.js");

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 4200;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const CODES_REESSAI = [429, 500, 502, 503, 529];

function promptBrief(d) {
  const famillesPresentes = Object.entries(d.repartition || {})
    .filter(([, n]) => Number(n) > 0)
    .map(([f]) => f);
  const axes = (d.axes || []).slice(0, 4);
  const membres = (d.membres || []).map((m) =>
    `- ${m.nom} : ${m.dominante || "profil"} (${m.famille || "?"}), niveau de départ ${m.niveau || 1}, coût d'adaptation ${m.cout || "faible"}`
  ).join("\n");

  return "Tu es l'ingénieur pédagogique de Sinéa. Tu prépares le BRIEF DE CAMPAGNE SEEDUP d'une équipe : le document de cadrage qui permet de lancer une campagne d'ancrage comportemental de 4 semaines (défis quotidiens de 5 à 15 minutes, analyse réflexive, débrief coach, sessions collectives hebdomadaires).\n\n"
    + "L'ÉQUIPE\n"
    + "Entreprise : " + (d.entreprise || "non précisée") + ". Campagne : " + (d.campagne || "équipe") + ".\n"
    + "Répartition des familles d'archétypes : " + famillesPresentes.map((f) => f + " " + d.repartition[f]).join(", ") + ".\n"
    + "Membres :\n" + membres + "\n\n"
    + "LE CAP\n"
    + (axes.length
      ? "Les axes de développement mesurés de cette équipe, par priorité : " + axes.join(" ; ") + ". L'axe 1 est le cap de la campagne, les suivants structurent les semaines."
      : "Aucun axe mesuré fourni : propose un cap crédible de développement managérial et relationnel pour cette équipe.")
    + "\n\n"
    + "TA MISSION\n"
    + "Produis le brief complet : le cap reformulé en une phrase mobilisatrice, un message de lancement pour le kick-off, 4 semaines avec chacune un thème, une intention, et 3 défis types. Chaque défi suit le format SeedUp : titre court qui intrigue, action concrète à l'impératif et au tutoiement (30 à 80 mots, avec un déclencheur contextuel précis : où, quand, avec qui), critère de réussite observable (10 à 30 mots), et une déclinaison d'angle en une phrase pour chaque famille présente (" + famillesPresentes.join(", ") + ") : le même défi, abordé par le lien pour RELATION, par l'action pour ACTION, par la structure pour STRUCTURE, par le sens pour VISION.\n"
    + "Termine par la trame type d'une session collective hebdomadaire de 45 minutes en 4 temps, une question type de lancement, et 3 indicateurs de mesure de fin de campagne.\n\n"
    + "SÉQUENÇAGE\n"
    + "Semaine 1 : amplifier les forces (défis de niveau 1 et 2, réussite rapide, engagement). Semaine 2 : le geste manquant (l'axe prioritaire, niveau 2). Semaine 3 : la profondeur (le point difficile de l'équipe, niveau 2 et 3). Semaine 4 : ancrage et engagement durable (rituels, transmission, niveau 2).\n"
    + (axes.length > 1 ? "Utilise les axes fournis comme thèmes des semaines, dans l'ordre, et complète si besoin.\n" : "")
    + "\n"
    + "RÈGLES D'ÉCRITURE STRICTES\n"
    + "Défis au tutoiement chaleureux. Le reste du brief au vouvoiement professionnel. Phrases courtes. Aucun tiret cadratin, remplace par deux-points, virgule ou point. Formulations affirmatives uniquement, aucune négation rhétorique du type ce n'est pas X mais Y. Pas de jargon RH creux, du concret réalisable en 15 minutes maximum.\n\n"
    + "RÉPONDS STRICTEMENT EN JSON VALIDE, sans aucun texte autour, format exact :\n"
    + '{"cap":"...","kickoff":{"message":"...","points_cles":["...","...","..."]},"semaines":[{"numero":1,"theme":"...","intention":"...","defis":[{"titre":"...","defi":"...","reussite":"...","declinaisons":{"RELATION":"...","ACTION":"..."}}]}],"session_ic":{"trame":["5 min : ...","15 min : ...","15 min : ...","10 min : ..."],"question_type":"..."},"mesure":{"indicateurs":["...","...","..."]}}';
}

function nettoyerBrief(b) {
  if (!b || typeof b !== "object") return b;
  if (Array.isArray(b)) return b.map(nettoyerBrief);
  const out = {};
  for (const [k, v] of Object.entries(b)) {
    out[k] = typeof v === "string" ? nettoyer(v) : nettoyerBrief(v);
  }
  return out;
}

async function genererBrief(apiKey, data) {
  let derniereErreur = null;
  for (let essai = 0; essai < 3; essai++) {
    if (essai > 0) await new Promise((r) => setTimeout(r, essai * 1500 + Math.random() * 600));
    let res;
    try {
      res = await fetchAvecDelai(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: [{ role: "user", content: promptBrief(data) }],
        }),
      });
    } catch (e) {
      if (e && /trop lent/.test(e.message || "")) throw e;
      derniereErreur = e;
      continue;
    }
    if (res.ok) {
      const d = await res.json();
      const texte = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      const clean = texte.replace(/```json\s*|\s*```/g, "").trim();
      const brief = JSON.parse(clean);
      return nettoyerBrief(brief);
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ erreur: "Clé API non configurée" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ erreur: "Corps JSON invalide" }); }
  }
  body = body || {};

  // Réservé à la clé super admin
  const cleRecue = ((req.headers || {})["x-dashboard-key"]) || body.cle;
  if (!DASHBOARD_KEY || cleRecue !== DASHBOARD_KEY) {
    return res.status(401).json({ erreur: "Accès réservé au super admin" });
  }
  if (!Array.isArray(body.membres) || body.membres.length < 2) {
    return res.status(400).json({ erreur: "Au moins deux membres sont nécessaires" });
  }

  try {
    const brief = await genererBrief(apiKey, body);
    return res.status(200).json({ ok: true, brief });
  } catch (e) {
    return res.status(500).json({ ok: false, erreur: e.message });
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
