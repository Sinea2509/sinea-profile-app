// ============================================================
// api/_cors.js — Gestion centralisée du CORS (liste blanche d'origines)
// ============================================================

// Origines autorisées à appeler le backend Sinéa Profile.
// On autorise les domaines connus + leurs variantes (avec/sans www).
const ORIGINES_AUTORISEES = [
  "https://sinea-profile-app.vercel.app",
  "https://sineaformation.fr",
  "https://www.sineaformation.fr",
  "https://profile.sineaformation.fr",
  "https://sineaperformance.fr",
  "https://www.sineaperformance.fr",
  "https://profile.sineaperformance.fr",
];

// Renvoie true si l'origine est autorisée.
// Tolère aussi les déploiements de preview Vercel du projet
// (anciens : sinea-profile-app-*.vercel.app ; récents : sinea-profile-*-sinea2509s-projects.vercel.app).
function origineAutorisee(origin) {
  if (!origin) return false;
  if (ORIGINES_AUTORISEES.includes(origin)) return true;
  // déploiements preview Vercel de l'app, tous formats :
  //  - https://sinea-profile-app-xxxx.vercel.app
  //  - https://sinea-profile-xxxx-sinea2509s-projects.vercel.app
  //  - https://sinea-profile-xxxx.vercel.app
  if (/^https:\/\/sinea-profile[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

// Applique les en-têtes CORS sur la réponse.
// Si l'origine est autorisée, on la renvoie ; sinon on ne met pas l'en-tête (le navigateur bloquera).
function appliquerCors(req, res) {
  const origin = req.headers && (req.headers.origin || req.headers.Origin);
  if (origineAutorisee(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Dashboard-Key");
}

module.exports = { appliquerCors, origineAutorisee, ORIGINES_AUTORISEES };
