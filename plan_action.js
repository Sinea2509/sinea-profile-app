// ============================================================
// api/plan_action.js — Genere un plan d'action structure et riche
//
// A partir de ce que la personne a coche dans sa restitution (forces,
// points de vigilance, ce qu'elle veut developper), genere :
//  - une synthese (le cap) : 2 a 3 phrases nommant les priorites,
//    reliees a l'archetype.
//  - pour chaque element coche, un objectif en TROIS COUCHES :
//      . objectif    : le cap, une phrase claire, mesurable, datee.
//      . premier_pas : la plus petite action concrete a demarrer cette semaine.
//      . indicateur  : le signe observable qui montre que c'est acquis.
//    chaque objectif porte un HORIZON (Maintenant / Bientot / Plus tard)
//    plutot qu'une priorite abstraite.
//
// Appel : POST /api/plan_action  body = {
//   profil: { dominante, famille, bigFive, secondaires },
//   forces: [..textes..], vigilances: [..textes..], objectifs: [..textes..],
//   thematique: "votre posture de leader" (optionnel)
// }
// Renvoie : { synthese: "...", actions: [ { thematique, type, horizon,
//                          objectif, premier_pas, indicateur } ] }
// ============================================================

const { nettoyer } = require("./editorial.js");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 4200;

function bfStr(bf) {
  if (!bf) return "";
  return "Extraversion " + bf.E + ", Agreabilite " + bf.A + ", Conscience " + bf.C
    + ", Stabilite emotionnelle " + (100 - bf.N) + ", Ouverture " + bf.O + " (sur 100)";
}

function listeOuVide(arr) {
  return (arr && arr.length) ? arr.map(function (t, i) { return "  " + (i + 1) + ". " + t; }).join("\n") : "  (aucun)";
}

function promptPlan(d) {
  const p = d.profil || {};
  const them = (d.thematique && String(d.thematique).trim()) ? String(d.thematique).trim() : "";
  const ctx = (d.contexte && String(d.contexte).trim()) ? String(d.contexte).trim() : "";
  return "Tu es le coach Sinea. Tu transformes ce qu'une personne a retenu de son portrait psychometrique en une FEUILLE DE ROUTE personnelle, concrete et professionnelle.\n\n"
    + "PROFIL\n"
    + "Archetype : " + (p.dominante || "") + " (famille " + (p.famille || "") + ").\n"
    + "Big Five : " + bfStr(p.bigFive) + ".\n\n"
    + "CE QUE LA PERSONNE A ELLE-MEME COCHE / EXPRIME\n"
    + "Forces qu'elle reconnait comme siennes (a CAPITALISER) :\n" + listeOuVide(d.forces) + "\n"
    + "Points de vigilance qu'elle veut travailler (a faire PROGRESSER) :\n" + listeOuVide(d.vigilances) + "\n"
    + "Leviers de developpement qu'elle veut EXPLORER :\n" + listeOuVide(d.objectifs) + "\n\n"
    + (ctx ? ("CONTEXTE EXPRIME PAR LA PERSONNE AVEC SES PROPRES MOTS (sa projection, son defi du moment) : \"" + ctx + "\". Sers-toi de ce contexte pour ancrer les objectifs et la synthese dans sa realite, en l'integrant avec finesse. Ne le recopie pas tel quel comme un objectif.\n\n") : "")
    + (them ? ("CAP DE LA FORMATION : oriente les objectifs vers " + them + ".\n\n") : "")
    + "TA MISSION\n"
    + "1) Redige une SYNTHESE (le cap) : 2 a 3 phrases qui nomment les 2 ou 3 priorites se degageant de ce qu'elle a coche, "
    + "et qui les relient a son archetype d'" + (p.dominante || "archetype") + ". Tu t'adresses directement a la personne, avec chaleur, sans la survendre. "
    + "Cette synthese donne une intention d'ensemble a la feuille de route.\n"
    + "2) Pour CHAQUE element coche, genere un objectif en TROIS COUCHES :\n"
    + "- thematique : le domaine en 1 a 3 mots (ex : Relationnel, Organisation, Leadership, Communication, Strategie, Gestion du stress).\n"
    + "- type : exactement un mot selon l'origine. \"Capitaliser\" pour une force, \"Progresser\" pour un point de vigilance, \"Explorer\" pour un objectif de developpement.\n"
    + "- horizon : exactement un de ces mots. \"Maintenant\" (a engager sous 30 jours), \"Bientot\" (1 a 3 mois), \"Plus tard\" (au-dela de 3 mois). "
    + "Par defaut : les points de vigilance en Maintenant, les forces a capitaliser en Bientot, l'exploration en Plus tard. Nuance si c'est pertinent pour la personne.\n"
    + "- objectif : le cap a atteindre. UNE phrase claire qui commence par un verbe d'action, contient un element mesurable concret et un horizon de temps realiste (ex : 'd'ici un mois', 'sur les trois prochaines semaines'). Concrete, ancree dans le quotidien professionnel.\n"
    + "- premier_pas : la PLUS PETITE action concrete pour demarrer des cette semaine. Elle commence par un verbe, tient en une phrase courte, et reste faisable en quelques minutes ou quelques jours (ex : 'Des lundi, bloquez trente minutes recurrentes le vendredi'). C'est le declic, pas tout le chemin.\n"
    + "- indicateur : le signe OBSERVABLE qui montrera que l'objectif est acquis. Formule-le comme un constat concret et verifiable (ex : 'Chaque membre repart de la reunion avec une action claire'). Pas une intention, un resultat visible.\n\n"
    + "REGLES DE STYLE (imperatives)\n"
    + "- Vouvoiement.\n"
    + "- Formulations 100% affirmatives : aucune tournure negative, aucune negation. Reformule toujours en positif.\n"
    + "- Interdiction absolue des tirets cadratins. Utilise une virgule, un point, ou deux-points.\n"
    + "- Pas de phrase du type 'Ce qui compte, ce n'est pas X, c'est Y'.\n"
    + "- Ton chaleureux, professionnel, concret. Niveau B2B premium.\n\n"
    + "FORMAT DE SORTIE\n"
    + "Reponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour, sans balises Markdown. "
    + "Structure exacte : { \"synthese\": \"...\", \"actions\": [ { \"thematique\": \"...\", \"type\": \"...\", \"horizon\": \"...\", \"objectif\": \"...\", \"premier_pas\": \"...\", \"indicateur\": \"...\" } ] }.";
}

async function genererPlan(data, apiKey) {
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
      messages: [{ role: "user", content: promptPlan(data) }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("API " + res.status + ": " + err.slice(0, 300));
  }
  const json = await res.json();
  let txt = (json.content && json.content[0] && json.content[0].text) || "{}";
  const clean = txt.replace(/```json/g, "").replace(/```/g, "").trim();
  let parsed = JSON.parse(clean);
  // tolerance : l'IA peut renvoyer directement un tableau d'actions
  if (Array.isArray(parsed)) parsed = { synthese: "", actions: parsed };
  let actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  // nettoyage editorial de chaque champ texte
  actions = actions.map(function (a) {
    return {
      thematique: nettoyer(String(a.thematique || "")),
      type: nettoyer(String(a.type || "")),
      horizon: nettoyer(String(a.horizon || "Bientot")),
      objectif: nettoyer(String(a.objectif || a.objectif_smart || "")),
      premier_pas: nettoyer(String(a.premier_pas || "")),
      indicateur: nettoyer(String(a.indicateur || "")),
    };
  });
  return { synthese: nettoyer(String(parsed.synthese || "")), actions: actions };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ erreur: "Methode non autorisee" });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ erreur: "Cle API non configuree" });

    let data = req.body;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) { return res.status(400).json({ erreur: "Corps JSON invalide" }); }
    }
    data = data || {};

    // garde-fou anti-rafale (tolerant aux pannes)
    try {
      const id = identifiantAppelant(req, "plan_action");
      const ok = await verifierCadence(id, 8000);
      if (!ok) return res.status(429).json({ erreur: "Trop rapide, reessayez dans un instant." });
    } catch (e) {}

    // si rien n'a ete coche, on ne sollicite pas l'IA
    const rien = !(data.forces && data.forces.length) && !(data.vigilances && data.vigilances.length) && !(data.objectifs && data.objectifs.length);
    if (rien) return res.status(200).json({ synthese: "", actions: [], vide: true });

    const out = await genererPlan(data, apiKey);
    return res.status(200).json({ synthese: out.synthese, actions: out.actions });
  } catch (e) {
    return res.status(500).json({ erreur: "Generation impossible : " + (e && e.message ? e.message : String(e)) });
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
