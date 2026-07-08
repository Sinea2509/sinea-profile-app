// ============================================================
// api/fiche_reflexe.js — Fiche réflexe métier PDF (1 page)
//   POST { token }       → accès participant (token individuel du test)
//   POST { cle, email }  → accès RH depuis le dashboard
//   Réponse : le PDF binaire (Content-Type application/pdf)
//   Pipeline : Airtable (module spé du profil) → HTML 1 page → PDFShift → PDF
//   Variables d'env requises : AIRTABLE_TOKEN, AIRTABLE_BASE_ID, DASHBOARD_KEY, PDFSHIFT_API_KEY
// ============================================================

const { appliquerCors } = require("./_cors");
const { construireFicheHTML } = require("./fiche_reflexe_template.js");

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const PDFSHIFT_API_KEY = process.env.PDFSHIFT_API_KEY;
const TABLE_REPONDANTS = "Répondants";

async function trouverRepondant(filterFormula) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE_REPONDANTS)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  const data = await res.json();
  return (data.records && data.records[0]) || null;
}

// Choisit le module SPÉCIALISÉ le plus récent (manager ou commercial).
// Gère les deux formats : structure à modules { socle:{...}, commercial:{...} }
// et résultat à plat (dernier test, scoresBigFive à la racine).
function choisirModuleSpe(jsonBrut) {
  let data;
  try { data = typeof jsonBrut === "string" ? JSON.parse(jsonBrut) : jsonBrut; } catch (e) { return null; }
  if (!data) return null;
  if (data.scoresBigFive) {
    // format à plat : un module spé si le test courant en était un
    if (data.speStyle && (data.diagType === "manager" || data.diagType === "commercial")) {
      return { cle: data.diagType, profil: data, contenu: {}, date: data.date || 0 };
    }
    return null;
  }
  const candidats = Object.entries(data)
    .filter(([cle, m]) => m && m.profil && m.profil.speStyle && (cle === "manager" || cle === "commercial"))
    .map(([cle, m]) => ({ cle, profil: m.profil, contenu: m.contenu || {}, date: m.date || 0 }));
  if (!candidats.length) return null;
  return candidats.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

function fetchAvecDelai(url, options, ms) {
  const delai = ms || 55000;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delai);
  return fetch(url, Object.assign({}, options || {}, { signal: controleur.signal }))
    .catch((e) => {
      if (e && e.name === "AbortError") throw new Error("Service externe trop lent (délai dépassé), merci de réessayer");
      throw e;
    })
    .finally(() => clearTimeout(minuteur));
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!PDFSHIFT_API_KEY) return res.status(500).json({ error: "PDFSHIFT_API_KEY manquante dans la configuration Vercel" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { token, cle, email } = body;
    const cleFournie = ((req.headers || {})["x-dashboard-key"]) || cle;

    // ----- retrouver le répondant (même périmètre d'accès que le portrait) -----
    let record = null;
    if (token) {
      record = await trouverRepondant(`{Token} = "${String(token).replace(/"/g, "")}"`);
    } else if (email && (!cleFournie || (DASHBOARD_KEY && cleFournie === DASHBOARD_KEY))) {
      record = await trouverRepondant(`LOWER({Email}) = "${String(email).toLowerCase().replace(/"/g, "")}"`);
    } else {
      return res.status(401).json({ error: "Accès non autorisé" });
    }
    if (!record) return res.status(404).json({ error: "Profil introuvable" });

    const f = record.fields || {};
    // Analyses (JSON) d'abord : c'est lui qui porte le contenu IA (plan, réflexes) fusionné par module.
    const mod = choisirModuleSpe(f["Analyses (JSON)"]) || choisirModuleSpe(f["Résultat complet (JSON)"]);
    if (!mod) {
      return res.status(404).json({ error: "La fiche réflexe se débloque après un parcours commercial ou management" });
    }

    const p = mod.profil;
    const ap = mod.contenu[mod.cle === "manager" ? "mgmt_angles_plan" : "com_angles_plan"];
    const refIA = mod.contenu[mod.cle === "manager" ? "mgmt_reflexes" : "com_reflexes"];
    const dateTest = mod.date ? new Date(mod.date) : new Date();

    const html = construireFicheHTML({
      prenom: f["Prénom"] || "",
      nom: f["Nom"] || "",
      archetype: (p.dominante && p.dominante.nom) || "",
      famille: (p.dominante && p.dominante.famille) || "",
      diagType: mod.cle,
      speStyle: p.speStyle,
      speDims: p.speDims || {},
      plan: ap && Array.isArray(ap.plan) ? ap.plan : null,
      reflexesIA: refIA && refIA.reflexes ? refIA.reflexes : null,
      date: dateTest.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      fontHtml: `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700;800&display=swap" rel="stylesheet">`,
    });

    // ----- PDFShift -----
    const shift = await fetchAvecDelai("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from("api:" + PDFSHIFT_API_KEY).toString("base64"),
      },
      body: JSON.stringify({ source: html, format: "A4" }),
    });
    if (!shift.ok) {
      const err = await shift.text();
      return res.status(502).json({ error: `PDFShift ${shift.status}: ${err.slice(0, 150)}` });
    }
    const pdf = Buffer.from(await shift.arrayBuffer());

    const nomFichier = `Fiche_Reflexe_${(f["Prénom"] || "")}_${(f["Nom"] || "")}`.replace(/[^a-zA-Z0-9_À-ÿ-]/g, "").slice(0, 60) || "Fiche_Reflexe";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nomFichier}.pdf"`);
    return res.status(200).send(pdf);
  } catch (e) {
    return res.status(500).json({ error: (e && e.message) || "Erreur interne" });
  }
};
