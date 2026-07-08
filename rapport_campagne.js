// ============================================================
// api/rapport_campagne.js — Rapport de fin de campagne SeedUp
// Réservé à la clé super admin (DASHBOARD_KEY).
// POST { entreprise, campagne, stats, participants, parFamille,
//        defisTop, defisFlop, decrocheurs, faibles, verbatims }
//   → { ok, rapport } : le narratif d'impact destiné au sponsor,
//     les tableaux chiffrés restant calculés côté portail.
// ============================================================

const { appliquerCors } = require("./_cors");
const { nettoyer } = require("./editorial.js");

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 4000;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const CODES_REESSAI = [429, 500, 502, 503, 529];

function ligneParticipant(p) {
  return `- ${p.nom}${p.archetype ? ` (${p.archetype}${p.famille ? ", " + p.famille : ""})` : ""} : ${p.n} défis réalisés, réussite auto-évaluée ${p.reussite ?? "?"}/10, note des défis ${p.note ?? "?"}/5`;
}

function promptRapport(d) {
  const stats = (d.stats || []).map((s) => `- ${s.indicateur} : ${s.valeur}`).join("\n");
  const participants = (d.participants || []).map(ligneParticipant).join("\n");
  const familles = (d.parFamille || []).map((f) => `- ${f.famille} : ${f.participants} participant(s), ${f.nbDefis} défis, note moyenne ${f.note ?? "?"}/5`).join("\n");
  const top = (d.defisTop || []).map((x) => `- ${x.titre} (${x.n} réalisations, note ${x.note ?? "?"}/5)`).join("\n");
  const flop = (d.defisFlop || []).map((x) => `- ${x.titre} (${x.n} réalisations, note ${x.note ?? "?"}/5)`).join("\n");
  const verbatims = (d.verbatims || []).map((v) => `- ${v.participant} sur « ${v.defi} » : ${v.texte}`).join("\n");

  return "Tu rédiges le RAPPORT DE FIN DE CAMPAGNE SEEDUP destiné au sponsor client. SeedUp est la plateforme d'ancrage comportemental de Sinéa : des défis de terrain de 5 à 15 minutes, une analyse réflexive, un débrief coach. Ce rapport prouve l'impact et prépare la suite.\n\n"
    + `CAMPAGNE : ${d.campagne || "campagne"} · ${d.entreprise || "entreprise"}\n\n`
    + "INDICATEURS GLOBAUX SEEDUP\n" + (stats || "non fournis") + "\n\n"
    + "PARTICIPANTS (croisés avec leur profil Sinéa quand il existe)\n" + (participants || "non fournis") + "\n\n"
    + (familles ? "LECTURE PAR FAMILLE D'ARCHÉTYPES\n" + familles + "\n\n" : "")
    + (top ? "DÉFIS QUI ONT LE MIEUX FONCTIONNÉ\n" + top + "\n\n" : "")
    + (flop ? "DÉFIS QUI ONT MOINS PRIS\n" + flop + "\n\n" : "")
    + (d.decrocheurs && d.decrocheurs.length ? "PROFILS SINÉA SANS AUCUNE RÉALISATION : " + d.decrocheurs.join(", ") + "\n" : "")
    + (d.faibles && d.faibles.length ? "PARTICIPANTS À MOINS DE 3 DÉFIS : " + d.faibles.join(", ") + "\n" : "")
    + (verbatims ? "\nVERBATIMS DE DÉBRIEF (matière réflexive réelle)\n" + verbatims + "\n" : "")
    + "\nTA MISSION\n"
    + "Rédige le narratif du rapport : un titre exécutif, une synthèse de 4 à 6 phrases qui raconte ce que la campagne a produit, une lecture des chiffres qui donne du sens aux indicateurs (compare, relativise, éclaire), 3 à 4 enseignements concrets sur ce qui ancre et ce qui résiste dans cette équipe, une lecture par famille d'archétypes quand la donnée existe, un suivi individuel pour 2 ou 3 personnes qui méritent une attention (les plus engagées à valoriser, celles qui décrochent à relancer, formule avec bienveillance et sans jugement), 3 recommandations opérationnelles, et une proposition de suite en 2 ou 3 phrases qui ouvre naturellement sur la prochaine étape Sinéa.\n"
    + "Appuie-toi sur les verbatims pour incarner, cite-les avec parcimonie et en les raccourcissant. Ignore les comptes de test dans ton analyse.\n\n"
    + "RÈGLES D'ÉCRITURE STRICTES\n"
    + "Vouvoiement professionnel, adressé au sponsor. Phrases courtes, concret, zéro jargon creux. Aucun tiret cadratin, remplace par deux-points, virgule ou point. Formulations affirmatives uniquement, aucune tournure du type ce n'est pas X mais Y.\n\n"
    + "RÉPONDS STRICTEMENT EN JSON VALIDE, sans aucun texte autour, format exact :\n"
    + '{"titre":"...","synthese":"...","lecture_chiffres":"...","enseignements":["...","...","..."],"lecture_familles":[{"famille":"RELATION","lecture":"..."}],"suivi":[{"nom":"...","lecture":"..."}],"recommandations":["...","...","..."],"suite":"..."}';
}

function nettoyerRec(b) {
  if (!b || typeof b !== "object") return b;
  if (Array.isArray(b)) return b.map(nettoyerRec);
  const out = {};
  for (const [k, v] of Object.entries(b)) out[k] = typeof v === "string" ? nettoyer(v) : nettoyerRec(v);
  return out;
}

async function genererRapport(apiKey, data) {
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
          messages: [{ role: "user", content: promptRapport(data) }],
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
      return nettoyerRec(JSON.parse(clean));
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

  const cleRecue = ((req.headers || {})["x-dashboard-key"]) || body.cle;
  if (!DASHBOARD_KEY || cleRecue !== DASHBOARD_KEY) {
    return res.status(401).json({ erreur: "Accès réservé au super admin" });
  }
  if (!Array.isArray(body.stats) && !Array.isArray(body.participants)) {
    return res.status(400).json({ erreur: "Aucune donnée de campagne fournie" });
  }

  try {
    const rapport = await genererRapport(apiKey, body);
    return res.status(200).json({ ok: true, rapport });
  } catch (e) {
    return res.status(500).json({ ok: false, erreur: e.message });
  }
};

// ---- robustesse : fetch avec délai maximal ----
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
