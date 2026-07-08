// ============================================================
// /api/codex : le comportement incarné du Codex vivant
// Décrit comment UNE compétence se manifeste chez UNE personne,
// à partir de son profil réel. Généré une seule fois par couple
// personne-compétence, puis servi depuis le cache Airtable
// (Interactions (JSON) → codex[compId]).
// Auth : clé super admin ou clé RH d'entreprise.
// ============================================================
const { appliquerCors } = require("./_cors");

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 300;
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const TABLE = "Répondants";
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
let CLES_RH = {};
try { CLES_RH = JSON.parse(process.env.DASHBOARD_CLES_RH || "{}"); } catch (e) { CLES_RH = {}; }

function cleValide(cle) {
  if (!cle) return false;
  if (DASHBOARD_KEY && cle === DASHBOARD_KEY) return true;
  return Object.values(CLES_RH).indexOf(cle) >= 0;
}

async function findByEmail(email) {
  const formula = encodeURIComponent(`LOWER({Email})=LOWER("${String(email).replace(/"/g, "")}")`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&maxRecords=1`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!r.ok) return null;
  const d = await r.json();
  return (d.records && d.records[0]) || null;
}

async function updateRecord(id, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${id}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!r.ok) throw new Error(`Airtable maj ${r.status}`);
}

function bfStr(bf) {
  if (!bf) return "";
  const noms = { O: "Ouverture", C: "Conscience", E: "Extraversion", A: "Agréabilité", N: "Sensibilité émotionnelle" };
  return Object.keys(noms).filter((k) => typeof bf[k] === "number").map((k) => `${noms[k]} ${Math.round(bf[k])}`).join(", ");
}

module.exports = async (req, res) => {
  if (appliquerCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  try {
    const body = req.body || {};
    if (!cleValide(String(body.cle || ""))) return res.status(401).json({ error: "Clé invalide" });
    const email = String(body.email || "").trim();
    const compId = String(body.compId || "").trim();
    const compNom = String(body.compNom || "").trim().slice(0, 80);
    const compDef = String(body.compDef || "").trim().slice(0, 300);
    if (!email || !compId || !compNom) return res.status(400).json({ error: "email, compId et compNom requis" });

    const rec = await findByEmail(email);
    if (!rec) return res.status(404).json({ ok: false, raison: "inconnu" });

    let inter = {};
    try { inter = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
    if (inter.codex && inter.codex[compId] && inter.codex[compId].txt) {
      return res.status(200).json({ ok: true, txt: inter.codex[compId].txt, cache: true });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Configuration IA manquante" });

    // Le profil réel de la personne, champs candidats tolérés
    let profil = {};
    ["Résultat (JSON)", "Profil (JSON)", "Analyse (JSON)"].forEach((champ) => {
      if (!Object.keys(profil).length && rec.fields[champ]) {
        try { profil = JSON.parse(rec.fields[champ]) || {}; } catch (e) {}
      }
    });
    const prenom = rec.fields["Prénom"] || "cette personne";
    const arch = profil.dominante || profil.archetype || (profil.classement && profil.classement[0] && profil.classement[0].nom) || "";
    const bf = profil.scoresBigFive || profil.bigFive || null;
    const na = profil.naturelAdapte || null;
    const ecartStr = na && typeof na.moyenneEcart === "number" ? `Écart moyen nature-travail : ${Math.round(na.moyenneEcart)} points.` : "";
    const poidsStr = String(body.poids || "").slice(0, 120);

    const systeme = `Tu écris pour le portail RH Sinéa Profile. En 55 à 85 mots, à la troisième personne, décris comment la compétence "${compNom}" se manifeste concrètement chez ${prenom}. Commence par "Chez ${prenom},".
Matière : définition de la compétence : ${compDef || compNom}. ${arch ? `Son archétype : ${arch}.` : ""} ${bf ? `Ses traits : ${bfStr(bf)}.` : ""} ${poidsStr ? `Traits porteurs de cette compétence : ${poidsStr}.` : ""} ${ecartStr}
Deux mouvements enchaînés : ce qui nourrit cette compétence chez cette personne, puis ce qui la freine ou la lui coûte.
Interdits absolus : le tiret cadratin, les listes, toute phrase qui vaudrait pour n'importe qui, les conditionnels mous.`;

    const apiRes = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: systeme, messages: [{ role: "user", content: "Écris le paragraphe." }] }),
    });
    if (!apiRes.ok) {
      const err = await apiRes.text();
      return res.status(500).json({ error: `IA ${apiRes.status}: ${err.slice(0, 120)}` });
    }
    const data = await apiRes.json();
    const txt = ((data.content || []).map((c) => c.text || "").join("") || "").trim().slice(0, 900);
    if (!txt) return res.status(500).json({ error: "Génération vide" });

    inter.codex = inter.codex || {};
    inter.codex[compId] = { txt, date: new Date().toISOString() };
    await updateRecord(rec.id, { "Interactions (JSON)": JSON.stringify(inter) });
    return res.status(200).json({ ok: true, txt, cache: false });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 160) });
  }
};
