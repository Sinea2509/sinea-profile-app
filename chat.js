// ============================================================
// api/chat.js — Le chat avec son archétype
// POST { archetype, famille, bigFive, question, historique }
//   → réponse IA personnalisée selon le profil
// ============================================================

const { appliquerCors } = require("./_cors");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_QUESTIONS = 3; // nombre de questions autorisées par personne dans le chat coach
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const TABLE_REPONDANTS = "Répondants";

// ---- sécurité : neutralise guillemets et antislashs avant interpolation dans une formule ----
function champFormule(v) { return String(v == null ? "" : v).replace(/[\\"]/g, ""); }

// Retrouve le répondant par email OU par token, renvoie { id, fields } ou null.
async function trouverRepondant({ email, token }) {
  if (!AIRTABLE_BASE || !AIRTABLE_TOKEN) return null;
  let formule = null;
  if (email) formule = `LOWER({Email}) = "${champFormule(email).trim().toLowerCase()}"`;
  else if (token) formule = `{Token} = "${champFormule(token)}"`;
  if (!formule) return null;
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE_REPONDANTS)}?filterByFormula=${encodeURIComponent(formule)}&maxRecords=1`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!r.ok) return null;
  const d = await r.json();
  return (d.records && d.records[0]) || null;
}

// Incrémente le compteur de questions du chat pour ce répondant.
async function incrementerQuestions(recId, valeurActuelle) {
  if (!AIRTABLE_BASE || !AIRTABLE_TOKEN || !recId) return;
  await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE_REPONDANTS)}/${recId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { "Questions chat": Number(valeurActuelle || 0) + 1 }, typecast: true }),
  });
}
const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 700;

function bfStr(bf) {
  if (!bf) return "non précisé";
  return `extraversion ${bf.E}, agréabilité ${bf.A}, conscienciosité ${bf.C}, stabilité émotionnelle ${100 - (bf.N || 50)}, ouverture ${bf.O}`;
}

// Libellés humains des profils de dimensions (registres + pilotage)
const LIBELLES_DIM = {
  stress: { accelerateur: "accélère sous pression", methodique: "se structure sous pression", retrait: "prend du recul sous pression", appui: "cherche l'appui des autres sous pression" },
  motivation: { accomplissement: "mû par l'atteinte d'objectifs", reconnaissance: "mû par la reconnaissance", sens: "mû par le sens", maitrise: "mû par la maîtrise et la progression" },
  risque: { audacieux: "audacieux face au risque", calcule: "prend des risques calculés", prudent: "prudent face au risque", securitaire: "recherche la sécurité" },
  changement: { moteur: "moteur du changement", adaptable: "s'adapte avec souplesse", pragmatique: "accepte le changement justifié", ancre: "attaché à la stabilité" },
  conflit: { affrontement: "aborde le conflit de front", mediation: "médiateur dans le conflit", compromis: "cherche le compromis", evitement: "évite l'affrontement direct" },
  energie: { sprinteur: "énergie en pics courts et intenses (sprinteur)", endurant: "énergie régulière et constante (endurant)", cyclique: "énergie cyclique alternant intensité et récupération", deepworker: "performe en concentration longue (deep-worker)" },
  collaboration: { autonome: "donne le meilleur en autonomie", cooperatif: "avance mieux dans l'échange", interdependant: "travaille en interdépendance", federateur: "fédère et anime le collectif" },
  autorite: { cadre: "a besoin d'un cadre et d'attentes claires", sens: "a besoin de comprendre le pourquoi", liberte: "a besoin d'une large marge de manœuvre", contributeur: "a besoin d'être associé aux décisions" },
  reconnaissance: { resultats: "a besoin que ses résultats soient vus", effort: "a besoin que son investissement soit reconnu", relation: "se nourrit de la considération et du lien", autonomie: "la confiance accordée vaut toute récompense" }
};
function dimsStr(contextuel, contextuelPlus) {
  const lignes = [];
  const tous = Object.assign({}, contextuel || {}, contextuelPlus || {});
  for (const [dim, profil] of Object.entries(tous)) {
    const lib = LIBELLES_DIM[dim] && LIBELLES_DIM[dim][profil];
    if (lib) lignes.push(lib);
  }
  return lignes.length ? lignes.join(" ; ") : "";
}

// Persiste le compteur de vœux par jeton, en tolérance de panne totale :
// un échec Airtable ne doit jamais priver la personne de sa réponse.
async function persisterVoeu(token) {
  try {
    if (!token || !AIRTABLE_BASE || !AIRTABLE_TOKEN) return;
    const formula = encodeURIComponent(`FIND('"jeton":"${String(token).replace(/"/g, "")}"', {Interactions (JSON)})`);
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE_REPONDANTS)}?filterByFormula=${formula}&maxRecords=1`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!r.ok) return;
    const d = await r.json();
    const rec = d.records && d.records[0];
    if (!rec) return;
    let inter = {};
    try { inter = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
    inter.voeux = Math.min(99, (inter.voeux || 0) + 1);
    await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE_REPONDANTS)}/${rec.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { "Interactions (JSON)": JSON.stringify(inter) }, typecast: true }),
    });
  } catch (e) { /* silence assumé */ }
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Configuration IA manquante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { archetype, famille, bigFive, contextuel, contextuelPlus, question, historique, email, token } = body || {};
    // garde-fou anti-rafale : on limite la cadence d'un même appelant
    const okCadence = await verifierCadence(identifiantAppelant(req, body), 6);
    if (!okCadence) return res.status(429).json({ ok:false, raison:"trop_rapide", error:"Trop de requêtes rapprochées. Patientez quelques secondes." });
    if (!question || !archetype) return res.status(400).json({ error: "Question ou profil manquant" });

    // garde-fou : limiter la longueur de la question
    const q = String(question).slice(0, 500);

    // ---- verrou : 3 questions maximum par personne ----
    // On identifie la personne (email ou token) et on lit son compteur dans Airtable.
    let repondant = null, questionsPosees = 0;
    try {
      repondant = await trouverRepondant({ email, token });
      if (repondant) questionsPosees = Number(repondant.fields["Questions chat"] || 0);
    } catch (e) { /* en cas d'erreur Airtable, on n'empêche pas de répondre */ }
    if (repondant && questionsPosees >= MAX_QUESTIONS) {
      return res.status(200).json({ ok: false, limite: true, posees: questionsPosees, max: MAX_QUESTIONS,
        message: `Vous avez utilisé vos ${MAX_QUESTIONS} questions. J'espère vous avoir éclairé sur votre profil.` });
    }

    const dims = dimsStr(contextuel, contextuelPlus);
    const systeme = `Tu es le coach Sinéa : le coach personnel attitré de cette personne. Tu as son profil complet sous les yeux : archétype "${archetype}" (famille ${famille}). Tu connais ses traits : ${bfStr(bigFive)}.${dims ? `\nTu connais aussi ses dimensions mesurées : ${dims}. Mobilise-les quand la question s'y prête (rythme de travail, relation au manager, motivation, collaboration), sans les réciter mécaniquement.` : ''}
Tu réponds à ses questions sur elle-même, son fonctionnement au travail, ses relations, ses blocages, ses forces. Tu es un coach senior qui impacte : chaleureux, direct, exigeant, jamais complaisant.
STRUCTURE OBLIGATOIRE de chaque réponse, en quatre temps enchaînés naturellement, sans titres ni liste :
1) Une phrase qui reformule le cœur de sa question, avec ses mots à elle.
2) Ta réponse, ancrée dans SON profil : au moins une référence concrète et nommée (son archétype ${archetype}, un trait avec sa tendance, une dimension mesurée, un écart entre nature et travail). Cite le chiffre quand il frappe.
3) Une perspective qui déplace : un angle mort de son profil, un paradoxe, un recadrage exigeant. Jamais une validation plate.
4) Termine en alternant d'un tour à l'autre : soit UNE question puissante et ouverte qui la fait réfléchir un cran plus loin, soit UN micro-pas concret et daté (demain, à ta prochaine réunion).
Longueur : 90 à 140 mots.
Règles impératives :
- Tutoie la personne (tu, toi, ton).
- INTERDITS ABSOLUS : toute phrase qui vaudrait pour n'importe qui, "excellente question", les compliments creux, reformuler sans répondre, dépasser 140 mots.
- N'utilise jamais de tiret cadratin. Utilise un point médian ou reformule.
- Formule de manière affirmative, sans tournures négatives du type "ce n'est pas X mais Y".
- Si la question sort du champ de la personnalité ou du travail, ramène avec douceur vers ce que tu peux éclairer de son profil.
- Tu ne donnes jamais de conseil médical, juridique ou financier.`;

    const messages = [];
    // historique éventuel (pour garder le fil)
    if (Array.isArray(historique)) {
      historique.slice(-6).forEach((m) => {
        if (m && m.role && m.content) messages.push({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 800) });
      });
    }
    messages.push({ role: "user", content: q });

    const apiRes = await fetchAvecDelai(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: systeme, messages }),
    });
    if (!apiRes.ok) {
      const err = await apiRes.text();
      return res.status(500).json({ error: `IA ${apiRes.status}: ${err.slice(0, 150)}` });
    }
    const data = await apiRes.json();
    try { await persisterVoeu(req.body && req.body.token); } catch (e) {}
    const reponse = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    // la réponse a réussi : on consomme une question
    let restant = null;
    if (repondant) {
      try { await incrementerQuestions(repondant.id, questionsPosees); } catch (e) {}
      restant = Math.max(0, MAX_QUESTIONS - (questionsPosees + 1));
    }
    return res.status(200).json({ ok: true, reponse, restant, max: MAX_QUESTIONS });
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
