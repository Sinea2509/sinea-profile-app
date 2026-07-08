// ============================================================
// api/question_clarification.js · La question sur mesure (générée par l'IA)
//
// Se déclenche dans deux cas de DOUTE, détectés côté front :
//   - "serre"     : les deux premiers archétypes sont au coude-à-coude
//   - "fiabilite" : la fiabilité est dans la zone 70-85 % (une tension interne)
//
// POST { cas, archetype1, archetype2, famille, bigFive, traitTension }
//   → { question }  une seule question ouverte, courte, ciblée sur le point de doute
//
// Important : cette question CLARIFIE le portrait. Elle ne remonte jamais le score
// de fiabilité (qui reste sincère). Sur un cas "serre", la réponse pourra faire
// pencher la nuance entre les deux archétypes, de façon transparente, côté front.
//
// Variable d'env requise : ANTHROPIC_API_KEY
// ============================================================

const { appliquerCors } = require("./_cors");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 200;

function bfStr(bf) {
  if (!bf) return "non précisé";
  return `extraversion ${bf.E}, agréabilité ${bf.A}, conscienciosité ${bf.C}, stabilité émotionnelle ${100 - (bf.N || 50)}, ouverture ${bf.O}`;
}

const LABELS_TRAIT = {
  extraversion: "son rapport aux autres et à l'énergie sociale",
  agreabilite: "son rapport à l'harmonie et au désaccord",
  conscience: "son rapport à l'organisation et à la rigueur",
  neuroticisme: "son rapport aux émotions et à la pression",
  ouverture: "son rapport à la nouveauté et aux idées",
};

function fetchAvecDelai(url, options, ms) {
  const delai = ms || 25000;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delai);
  return fetch(url, Object.assign({}, options || {}, { signal: controleur.signal }))
    .catch((e) => {
      if (e && e.name === "AbortError") throw new Error("Service externe trop lent (délai dépassé)");
      throw e;
    })
    .finally(() => clearTimeout(minuteur));
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Configuration IA manquante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { cas, archetype1, archetype2, famille, bigFive, traitTension } = body;
    // garde-fou anti-rafale : on limite la cadence d'un même appelant
    const okCadence = await verifierCadence(identifiantAppelant(req, body), 6);
    if (!okCadence) return res.status(429).json({ ok:false, raison:"trop_rapide", error:"Trop de requêtes rapprochées. Patientez quelques secondes." });

    let consigne;
    if (cas === "serre" && archetype2) {
      consigne = `Cette personne a deux profils très proches : "${archetype1}" et "${archetype2}". Les deux lui correspondent, et son score ne permet pas de trancher nettement lequel domine. `
        + `Rédige UNE seule question ouverte, courte (une phrase, 25 mots maximum), qui aide à savoir lequel de ces deux profils la décrit le mieux au quotidien. `
        + `La question doit porter sur une situation concrète de travail où les deux profils réagiraient différemment, pour que sa réponse révèle naturellement vers lequel elle penche. Ne nomme jamais les archétypes dans la question.`;
    } else {
      const focus = LABELS_TRAIT[traitTension] || "sa façon de fonctionner au travail";
      consigne = `Cette personne (archétype "${archetype1}", famille ${famille}) a répondu de façon un peu contrastée sur ${focus}. Ses réponses sur ce point se nuancent sans se contredire vraiment. `
        + `Rédige UNE seule question ouverte, courte (une phrase, 25 mots maximum), qui l'invite à préciser comment cela se traduit concrètement dans son travail. `
        + `La question doit être chaleureuse, donner envie de répondre, et porter sur une situation vécue plutôt que sur une abstraction.`;
    }

    const systeme = `Tu rédiges une unique question ouverte pour affiner le portrait psychométrique d'une personne. Profil : ${bfStr(bigFive)}.
${consigne}
Règles impératives :
- Vouvoie la personne.
- Renvoie UNIQUEMENT la question, sans préambule, sans guillemets, sans numéro.
- Une seule phrase, 25 mots maximum.
- N'utilise jamais de tiret cadratin. Utilise un point médian ou reformule.
- Formule de manière affirmative.`;

    const apiRes = await fetchAvecDelai(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: systeme, messages: [{ role: "user", content: "Génère la question maintenant." }] }),
    });
    if (!apiRes.ok) {
      const err = await apiRes.text();
      return res.status(502).json({ error: `IA ${apiRes.status}: ${err.slice(0, 120)}` });
    }
    const data = await apiRes.json();
    let question = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    question = question.replace(/^["'«»\s]+|["'«»\s]+$/g, "").replace(/\u2014/g, "·");
    if (!question) {
      // repli neutre si l'IA ne renvoie rien d'exploitable
      question = cas === "serre"
        ? "Décrivez une situation de travail récente où vous avez dû choisir entre avancer vite et prendre le temps de bien faire."
        : "Décrivez un moment de travail récent qui illustre bien votre façon naturelle de fonctionner.";
    }
    return res.status(200).json({ question });
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Erreur interne" });
  }
};
