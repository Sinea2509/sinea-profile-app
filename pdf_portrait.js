// ============================================================
// api/pdf_portrait.js — Génère le portrait individuel PDF premium
//   POST { token }                      → accès participant (token individuel du test)
//   POST { cle, email }                 → accès RH depuis le dashboard
//   Réponse : le PDF binaire (Content-Type application/pdf)
//   Pipeline : Airtable (profil + sections IA stockées) → HTML → PDFShift → PDF
//   Variables d'env requises : AIRTABLE_TOKEN, AIRTABLE_BASE_ID, DASHBOARD_KEY, PDFSHIFT_API_KEY
// ============================================================

const { appliquerCors } = require("./_cors");
const { construirePortraitHTML } = require("./pdf_portrait_template.js");
const SINEA_DATA = require("./sinea_data.js");

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const PDFSHIFT_API_KEY = process.env.PDFSHIFT_API_KEY;
const TABLE_REPONDANTS = "Répondants";
const APP_URL = "https://sinea-profile-app.vercel.app";

async function trouverRepondant(filterFormula) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE_REPONDANTS)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  const data = await res.json();
  return (data.records && data.records[0]) || null;
}

// Choisit le module le plus pertinent du "Résultat complet (JSON)" :
// priorité au module avec spécialisation (manager/commercial), sinon le socle.
function choisirModule(jsonBrut) {
  let data;
  try { data = typeof jsonBrut === "string" ? JSON.parse(jsonBrut) : jsonBrut; } catch (e) { return null; }
  if (!data) return null;
  if (data.scoresBigFive) return { profil: data, contenu: {} }; // ancien format à plat
  const modules = Object.values(data).filter((m) => m && m.profil);
  if (!modules.length) return null;
  const avecSpe = modules.filter((m) => m.profil.speStyle);
  const choisi = (avecSpe.length ? avecSpe : modules).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
  // fusion : le socle comble ce que le module n'aurait pas (profil et sections IA)
  const socle = data.socle && data.socle.profil ? data.socle : null;
  const profil = socle && socle !== choisi ? Object.assign({}, socle.profil, choisi.profil) : choisi.profil;
  const contenu = Object.assign({}, socle ? (socle.contenu || {}) : {}, choisi.contenu || {});
  return { profil, contenu, date: choisi.date };
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

    // ----- retrouver le répondant -----
    let record = null;
    if (token) {
      record = await trouverRepondant(`{Token} = "${String(token).replace(/"/g, "")}"`);
    } else if (email && (!cleFournie || (DASHBOARD_KEY && cleFournie === DASHBOARD_KEY))) {
      // l'email seul suffit : même niveau de confiance que l'espace personnel,
      // qui donne déjà accès aux analyses complètes avec l'email.
      // Si une clé est fournie (dashboard RH), elle doit être la bonne.
      record = await trouverRepondant(`LOWER({Email}) = "${String(email).toLowerCase().replace(/"/g, "")}"`);
    } else {
      return res.status(401).json({ error: "Accès non autorisé" });
    }
    if (!record) return res.status(404).json({ error: "Profil introuvable" });

    const f = record.fields || {};
    const mod = choisirModule(f["Résultat complet (JSON)"] || f["Analyses (JSON)"]);
    if (!mod || !mod.profil || !mod.profil.dominante) {
      return res.status(404).json({ error: "Aucun résultat complet pour ce profil" });
    }

    // ----- construire le HTML -----
    const nomArch = mod.profil.dominante.nom;
    const slug = SINEA_DATA.slugs ? SINEA_DATA.slugs[nomArch] : null;
    const fiche = (slug && SINEA_DATA.contenu && SINEA_DATA.contenu[slug]) || {};
    const rarete = SINEA_DATA.rarete ? (SINEA_DATA.rarete[slug] || SINEA_DATA.rarete[nomArch] || null) : null;
    const dateTest = mod.date ? new Date(mod.date) : new Date();

    const html = construirePortraitHTML(mod.profil, mod.contenu, {
      prenom: f["Prénom"] || "",
      nom: f["Nom"] || "",
      date: dateTest.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
      fontHtml: `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;700;800&display=swap" rel="stylesheet">`,
      patternUrl: `${APP_URL}/pattern.webp`,
      ficheArchetype: fiche,
      rarete,
      labelsContextuels: SINEA_DATA.contextuelles ? SINEA_DATA.contextuelles.dimensions : {},
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

    const nomFichier = `Portrait_Sinea_${(f["Prénom"] || "")}_${(f["Nom"] || "")}`.replace(/[^a-zA-Z0-9_À-ÿ-]/g, "").slice(0, 60) || "Portrait_Sinea";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${nomFichier}.pdf"`);
    return res.status(200).send(pdf);
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
