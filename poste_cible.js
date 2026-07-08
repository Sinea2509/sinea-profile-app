// ============================================================
// api/poste_cible.js — Le référentiel de poste sur mesure du client
// (pondérations des 16 compétences pour le brief de développement).
// Persisté dans le champ optionnel "Postes (JSON)" de la table
// Entreprises, sur le modèle du carnet coach : tout fonctionne sans
// le champ (repli navigateur côté portail), la persistance s'active
// dès qu'il existe. Distinct de profil_cible.js (recrutement).
//   action "charger" : super admin, ou clé RH de CETTE entreprise
//   action "sauver"  : super admin uniquement
// ============================================================

const { appliquerCors } = require("./_cors");

const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
let CLES_RH = {};
try { CLES_RH = JSON.parse(process.env.DASHBOARD_CLES_RH || "{}"); } catch (e) { CLES_RH = {}; }

function normEnt(v) { return String(v || "").trim().toLowerCase(); }

async function trouverEntreprise(nom) {
  const cible = normEnt(nom);
  for (const nomTable of ["Entreprises", "Entreprise"]) {
    let offset = "";
    try {
      do {
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(nomTable)}?pageSize=100${offset ? `&offset=${offset}` : ""}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        if (!res.ok) break;
        const data = await res.json();
        for (const r of data.records || []) {
          const f = r.fields || {};
          const nomRec = f["Nom"] || f["Name"] || f["Nom entreprise"] || f["Entreprise"] || "";
          if (normEnt(nomRec) === cible) return { table: nomTable, record: r };
        }
        offset = data.offset || "";
      } while (offset);
    } catch (e) { /* table absente sous ce nom : on tente l'autre */ }
  }
  return null;
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
  const estSuper = !!DASHBOARD_KEY && cleRecue === DASHBOARD_KEY;
  const entrepriseRH = (!estSuper && cleRecue && CLES_RH[cleRecue]) || null;
  if (!estSuper && !entrepriseRH) return res.status(401).json({ erreur: "Accès non autorisé" });

  const entreprise = String(body.entreprise || "").trim();
  if (!entreprise) return res.status(400).json({ erreur: "Entreprise manquante" });
  if (entrepriseRH && normEnt(entrepriseRH) !== normEnt(entreprise)) {
    return res.status(403).json({ erreur: "Hors de votre périmètre" });
  }

  if (!AIRTABLE_BASE || !AIRTABLE_TOKEN) return res.status(500).json({ erreur: "Airtable non configuré" });

  try {
    if (body.action === "charger") {
      const trouve = await trouverEntreprise(entreprise);
      if (!trouve) return res.status(404).json({ erreur: "Entreprise introuvable" });
      let coefs = null;
      try { coefs = JSON.parse(trouve.record.fields["Postes (JSON)"] || "null"); } catch (e) { coefs = null; }
      return res.status(200).json({ ok: true, coefs });
    }

    if (body.action === "sauver") {
      if (!estSuper) return res.status(403).json({ erreur: "Réservé au super admin" });
      if (!body.coefs || typeof body.coefs !== "object") return res.status(400).json({ erreur: "Coefficients manquants" });
      const trouve = await trouverEntreprise(entreprise);
      if (!trouve) return res.status(404).json({ erreur: "Entreprise introuvable" });
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(trouve.table)}/${trouve.record.id}`;
      const rep = await fetch(url, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { "Postes (JSON)": JSON.stringify(body.coefs).slice(0, 95000) }, typecast: true }),
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
