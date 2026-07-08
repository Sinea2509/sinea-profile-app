// ============================================================
// api/grille_entretien.js — Grille d'entretien structurée
//   POST { cle, fiche } → grille d'entretien générée depuis la
//   fiche de poste produite par l'analyse d'équipe (recrutement).
//
//   C'est le PONT entre le diagnostic ("recrutez tel profil") et
//   l'action ("voici comment le repérer en entretien") : questions
//   comportementales, signaux à observer, mise en situation, notation.
// ============================================================

const { appliquerCors } = require("./_cors");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");

const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 2800;

const REGLES = `Règles d'écriture : ton de conseil professionnel, clair et direct (comme un consultant senior en recrutement). Phrases nettes. Aucun tiret cadratin, utilisez un point médian ou reformulez. Formulations affirmatives. Vouvoiement. Chaque question doit être concrète et réellement posable en entretien, jamais générique.`;

function construirePrompt(fiche) {
  const fp = fiche.fiche_poste || {};
  const traits = Array.isArray(fp.traits_recherches) ? fp.traits_recherches.join(" ; ") : "";
  const signaux = Array.isArray(fp.signaux_entretien) ? fp.signaux_entretien.join(" ; ") : "";
  return `Tu es un expert en recrutement structuré (entretiens comportementaux, méthode STAR). Un RH a identifié le profil à recruter pour compléter son équipe. Ta mission : produire la grille d'entretien complète qui lui permet de repérer ce profil de façon fiable et équitable.

PROFIL RECHERCHÉ :
Intitulé : ${fp.intitule || fiche.profil_cible || "profil complémentaire"}
Pourquoi ce profil : ${fp.pourquoi || fiche.diagnostic || ""}
Côté archétype : ${fp.profil_archetype || ""}
Côté pilotage : ${fp.profil_pilotage || ""}
Traits à rechercher : ${traits}
Premiers signaux identifiés : ${signaux}
Vigilance d'intégration : ${fp.vigilance || ""}

Construis une grille d'entretien STRUCTURÉE : pour chaque critère, des questions comportementales (faits passés, méthode STAR : situation, tâche, action, résultat), jamais des questions hypothétiques vagues. Les signaux doivent décrire des comportements observables dans la réponse, pas des impressions.

Réponds STRICTEMENT en JSON valide, sans aucun texte autour, au format exact :
{
  "intro": "environ 45 mots pour le recruteur : l'état d'esprit de cet entretien et ce qu'il cherche à vérifier en priorité",
  "criteres": [
    {
      "critere": "nom court du critère évalué",
      "questions": ["2 questions comportementales précises (faits passés), chacune environ 22 mots"],
      "signaux_positifs": ["2 comportements observables dans la réponse qui indiquent que le profil correspond, chacun environ 16 mots"],
      "signaux_alerte": ["2 signaux d'alerte observables, formulés factuellement, chacun environ 16 mots"]
    }
  ],
  "mise_en_situation": {
    "consigne": "environ 50 mots : une mise en situation concrète à proposer au candidat, directement liée au quotidien du poste et au manque de l'équipe",
    "attendus": ["3 éléments à observer dans la façon dont le candidat aborde la situation, chacun environ 15 mots"]
  },
  "question_integration": "une question d'entretien d'environ 25 mots qui teste la vigilance d'intégration identifiée (comment le candidat s'insérera dans la dynamique actuelle)",
  "conseil_notation": "environ 40 mots : comment noter de façon équitable (échelle simple par critère, décision collégiale, pièges d'évaluation à éviter)"
}
Produis 3 ou 4 critères, alignés sur les traits à rechercher.
${REGLES}`;
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { cle, fiche } = body || {};
    // garde-fou anti-rafale : on limite la cadence d'un même appelant
    const okCadence = await verifierCadence(identifiantAppelant(req, body), 8);
    if (!okCadence) return res.status(429).json({ ok:false, raison:"trop_rapide", erreur:"Trop de requêtes rapprochées. Patientez quelques secondes." });
    const cleRecue = ((req.headers || {})["x-dashboard-key"]) || cle;
    if (!DASHBOARD_KEY || cleRecue !== DASHBOARD_KEY) return res.status(401).json({ error: "Accès non autorisé" });
    if (!fiche || (!fiche.fiche_poste && !fiche.profil_cible)) return res.status(400).json({ error: "fiche de poste manquante" });
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "Configuration IA manquante" });

    const apiRes = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: "user", content: construirePrompt(fiche) }] }),
    });
    if (!apiRes.ok) return res.status(500).json({ error: `IA ${apiRes.status}: ${(await apiRes.text()).slice(0, 150)}` });
    const data = await apiRes.json();
    const txt = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const clean = txt.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    let grille = null;
    try { grille = JSON.parse(clean); } catch { grille = null; }
    if (!grille || !Array.isArray(grille.criteres)) return res.status(502).json({ error: "Grille illisible, réessayez" });

    return res.status(200).json({ ok: true, grille });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
