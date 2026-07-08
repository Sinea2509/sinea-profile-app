// ============================================================
// api/seedup_webhook.js — Récepteur temps réel des défis SeedUp
// SeedUp appelle cet endpoint à chaque défi validé (ou par lot) :
// POST { email, realisation: { date, defi, debrief, coach, reussite, note } }
// ou   { email, realisations: [ ... ] }
// Secret partagé requis : header "x-seedup-secret" ou body.secret,
// comparé à process.env.SEEDUP_WEBHOOK_SECRET.
// Les réalisations rejoignent les interactions de la personne sous
// la clé "seedup", celle que lit l'espace apprenant. Idempotent :
// une réalisation identique (défi + date) n'est jamais dupliquée.
// ============================================================

const { appliquerCors } = require("./_cors");

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const TABLE = "Répondants";
const SECRET = process.env.SEEDUP_WEBHOOK_SECRET || "";
const MAX_REALISATIONS = 60;

function champFormule(v) {
  return String(v == null ? "" : v).replace(/[\\"]/g, "");
}

async function findByEmail(email) {
  const formula = encodeURIComponent(`LOWER({Email}) = "${champFormule(email).toLowerCase()}"`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable lecture ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.records && data.records[0]) || null;
}

async function updateRecord(id, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable maj ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

// Normalise une réalisation entrante : champs bornés, date en ISO si possible
function normaliserRealisation(r) {
  if (!r || typeof r !== "object") return null;
  const t = String(r.defi || r.titre || "").trim().slice(0, 160);
  if (!t) return null;
  let d = String(r.date || "").trim();
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) d = `${m[3]}-${m[2]}-${m[1]}`;
  const num = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isNaN(n) ? null : n; };
  return {
    d: d.slice(0, 10),
    t,
    deb: String(r.debrief || "").trim().slice(0, 600),
    coach: String(r.coach || r.reponse_coach || "").trim().slice(0, 400),
    r: num(r.reussite),
    n: num(r.note),
  };
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

  const secretRecu = ((req.headers || {})["x-seedup-secret"]) || body.secret;
  if (!SECRET || secretRecu !== SECRET) {
    return res.status(401).json({ erreur: "Secret invalide" });
  }

  const email = String(body.email || "").trim();
  if (!email) return res.status(400).json({ erreur: "Email manquant" });

  const brutes = Array.isArray(body.realisations) ? body.realisations : (body.realisation ? [body.realisation] : []);
  const entrees = brutes.map(normaliserRealisation).filter(Boolean);
  if (!entrees.length) return res.status(400).json({ erreur: "Aucune réalisation valide" });

  try {
    const rec = await findByEmail(email);
    if (!rec) return res.status(200).json({ ok: false, raison: "profil_introuvable" });
    let toutes = {};
    try { toutes = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
    const sd = toutes.seedup || {};
    const liste = Array.isArray(sd.liste) ? sd.liste : [];
    const cles = new Set(liste.map((x) => (x.t || "") + "|" + (x.d || "")));
    let ajoutees = 0;
    entrees.forEach((e) => {
      const cle = e.t + "|" + e.d;
      if (cles.has(cle)) return;
      cles.add(cle);
      liste.push(e);
      ajoutees++;
    });
    liste.sort((a, b) => String(a.d).localeCompare(String(b.d)));
    toutes.seedup = { liste: liste.slice(-MAX_REALISATIONS), maj: new Date().toISOString(), source: "webhook" };
    await updateRecord(rec.id, { "Interactions (JSON)": JSON.stringify(toutes).slice(0, 95000) });
    return res.status(200).json({ ok: true, ajoutees, total: toutes.seedup.liste.length });
  } catch (e) {
    return res.status(500).json({ ok: false, erreur: e.message });
  }
};
