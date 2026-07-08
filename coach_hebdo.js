// ============================================================
// api/coach_hebdo.js — Le débrief coach hebdomadaire (super admin)
// Deux actions :
//   "rediger" : à partir des chiffres de la semaine, des compétences
//     travaillées et du regard du coach, rédige la synthèse de
//     restitution destinée au RH.
//   "sauver"  : persiste le carnet coach de la campagne dans le champ
//     "Coach (JSON)" de la table Campagnes. Si le champ n'existe pas
//     encore, répond proprement { raison: "champ_manquant" } : tout le
//     reste fonctionne, la persistance s'active quand le champ existe.
// ============================================================

const { appliquerCors } = require("./_cors");
const { nettoyer } = require("./editorial.js");

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const CODES_REESSAI = [429, 500, 502, 503, 529];

function champFormule(v) {
  return String(v == null ? "" : v).replace(/[\\"]/g, "");
}

async function trouverCampagne(code) {
  const formula = encodeURIComponent(`{Code campagne} = "${champFormule(code)}"`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent("Campagnes")}?filterByFormula=${formula}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable lecture ${res.status}`);
  const data = await res.json();
  return (data.records && data.records[0]) || null;
}

function promptSynthese(d) {
  const comps = (d.competences || []).map((c) => `- ${c.nom} : ${c.n} défi${c.n > 1 ? "s" : ""}`).join("\n");
  return "Tu es le coach SeedUp de Sinéa. Tu rédiges la SYNTHÈSE HEBDOMADAIRE de restitution destinée à l'interlocuteur RH du client : le regard qualitatif sur ce que l'équipe a réellement travaillé sur le terrain cette semaine.\n\n"
    + `CAMPAGNE : ${d.campagne || ""} · ${d.entreprise || ""} · Semaine du ${d.periode || ""}\n\n`
    + "LES CHIFFRES DE LA SEMAINE\n"
    + `${(d.stats && d.stats.n) || 0} défis réalisés par ${(d.stats && d.stats.actifs) || 0} participant(s) actif(s), réussite auto-évaluée moyenne ${(d.stats && d.stats.reussite) || "?"}/10.\n\n`
    + "LES COMPÉTENCES TRAVAILLÉES (repérage automatique sur le référentiel Sinéa)\n" + (comps || "aucune identifiée") + "\n\n"
    + "LE REGARD DU COACH (matière humaine, à intégrer et valoriser)\n" + (d.regard || "aucun regard saisi cette semaine") + "\n\n"
    + (d.precedent ? "POUR MÉMOIRE, LA SYNTHÈSE PRÉCÉDENTE (assure la continuité, sans la répéter)\n" + String(d.precedent).slice(0, 500) + "\n\n" : "")
    + "TA MISSION\n"
    + "Rédige une synthèse de 5 à 7 phrases : ce que la semaine dit de l'ancrage, les compétences qui se travaillent vraiment, l'intensité et la dynamique, en intégrant le regard du coach comme le fil humain. Termine par 3 points d'attention ou de valorisation pour le RH, concrets et actionnables.\n\n"
    + "RÈGLES D'ÉCRITURE STRICTES\n"
    + "Vouvoiement au RH. Phrases courtes, concret, chaleur professionnelle. Aucun tiret cadratin, remplace par deux-points, virgule ou point. Formulations affirmatives uniquement, aucune tournure du type ce n'est pas X mais Y.\n\n"
    + "RÉPONDS STRICTEMENT EN JSON VALIDE, sans aucun texte autour, format exact :\n"
    + '{"synthese":"...","points":["...","...","..."]}';
}

async function rediger(apiKey, data) {
  let derniereErreur = null;
  for (let essai = 0; essai < 3; essai++) {
    if (essai > 0) await new Promise((r) => setTimeout(r, essai * 1500 + Math.random() * 600));
    let res;
    try {
      res = await fetchAvecDelai(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 1400, messages: [{ role: "user", content: promptSynthese(data) }] }),
      });
    } catch (e) {
      if (e && /trop lent/.test(e.message || "")) throw e;
      derniereErreur = e;
      continue;
    }
    if (res.ok) {
      const d = await res.json();
      const texte = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      const brut = JSON.parse(texte.replace(/```json\s*|\s*```/g, "").trim());
      return { synthese: nettoyer(String(brut.synthese || "")), points: (brut.points || []).map((p) => nettoyer(String(p))) };
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
  if (!DASHBOARD_KEY || cleRecue !== DASHBOARD_KEY) {
    return res.status(401).json({ erreur: "Accès réservé au super admin" });
  }

  try {
    if (body.action === "rediger") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ erreur: "Clé API non configurée" });
      const resultat = await rediger(apiKey, body);
      return res.status(200).json({ ok: true, ...resultat });
    }

    if (body.action === "sauver") {
      const code = String(body.code || "").trim();
      if (!code) return res.status(400).json({ erreur: "Code campagne manquant" });
      const rec = await trouverCampagne(code);
      if (!rec) return res.status(404).json({ erreur: "Campagne introuvable" });
      const contenu = JSON.stringify(body.coach || {}).slice(0, 95000);
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent("Campagnes")}/${rec.id}`;
      const rep = await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { "Coach (JSON)": contenu }, typecast: true }),
      });
      if (!rep.ok) {
        const txt = await rep.text();
        if (rep.status === 422 && /UNKNOWN_FIELD_NAME/.test(txt)) {
          return res.status(200).json({ ok: false, raison: "champ_manquant" });
        }
        throw new Error(`Airtable maj ${rep.status}: ${txt.slice(0, 200)}`);
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ erreur: "Action inconnue" });
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
