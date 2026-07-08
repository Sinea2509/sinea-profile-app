// ============================================================
// api/generer.js — Fonction Vercel principale Sinéa Profile
// Reçoit les données du test, génère les sections via Claude,
// applique le garde-fou éditorial, renvoie le contenu en JSON.
// Endpoint : POST /api/generer
// ============================================================

const { appliquerCors } = require("./_cors");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");
const { PROMPTS, SECTIONS_SOCLE, REGLES, ficheProfil } = require("./prompts.js");
const { PROMPTS_DIM, SECTIONS_DIM_SOCLE, SECTIONS_DIM_PILOTAGE, SECTIONS_DIM_MANAGER, SECTIONS_DIM_COMMERCIAL } = require("./prompts_dimensions.js");
const { PROMPTS_SPE, SECTIONS_SPE_MANAGER, SECTIONS_SPE_COMMERCIAL } = require("./prompts_spe_enrichi.js");
const { nettoyer, detecterNegations } = require("./editorial.js");

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 2000;

// Codes d'erreur passagers qui justifient un nouvel essai
const CODES_REESSAI = [429, 500, 502, 503, 529];

// Sections dont la réponse attendue est du JSON structuré
const SECTIONS_JSON = ["takeovers", "mgmt_angles_plan", "com_angles_plan", "mgmt_reflexes", "com_reflexes", "mode_emploi", "combo_dynamiques", "pepites", "angles_coaching"];

// Sections de synthèse : générées en second passage, nourries du contenu
// réellement produit par les autres sections, pour une vraie cohérence.
const SECTIONS_SYNTHESE = ["mgmt_synthese_leadership", "com_synthese_vendeur"];
const SOURCES_SYNTHESE = {
  mgmt_synthese_leadership: ["mgmt_croisement", "dim_delegation", "dim_feedback", "dim_exigence", "mgmt_motivation_equipe"],
  com_synthese_vendeur: ["com_croisement", "dim_closing", "dim_objection", "dim_chasseur", "com_relation_client"],
};

// Construit le bloc system commun à toutes les sections d'un même portrait.
// Marqué pour la mise en cache : payé une fois (écriture), relu à coût réduit
// par tous les appels suivants pendant la génération.
function blocSystemeCommun(data) {
  const texte = ficheProfil(data)
    + "\n\n" + REGLES
    + "\nDes règles complémentaires propres à certaines sections peuvent figurer dans la consigne : elles s'ajoutent à celles-ci.";
  return [{ type: "text", text: texte, cache_control: { type: "ephemeral" } }];
}

// Écrit le cache avant le lancement en parallèle : un appel minimal qui
// traite le bloc system et le dépose dans le cache. Non bloquant en cas
// d'échec (au pire, les premières lectures repaient l'entrée plein tarif).
async function chaufferCache(apiKey, systeme) {
  try {
    await fetchAvecDelai(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1,
        system: systeme,
        messages: [{ role: "user", content: "ok" }],
      }),
    }, 20000);
  } catch (e) { /* volontairement silencieux */ }
}

// Appel unitaire à Claude : bloc system partagé, réessais sur erreurs
// passagères, comptage d'usage pour le suivi du coût réel.
async function genererSection(apiKey, prompt, systeme, compteur) {
  let derniereErreur = null;
  for (let essai = 0; essai < 3; essai++) {
    if (essai > 0) await new Promise((r) => setTimeout(r, essai * 1500 + Math.random() * 600));
    let res;
    try {
      res = await fetchAvecDelai(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systeme,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch (e) {
      // Délai dépassé : on s'arrête (budget temps de la fonction).
      // Erreur réseau passagère (connexion coupée en rafale) : nouvel essai.
      if (e && /trop lent/.test(e.message || "")) throw e;
      derniereErreur = e;
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      if (compteur && data.usage) {
        compteur.appels += 1;
        compteur.entree += data.usage.input_tokens || 0;
        compteur.sortie += data.usage.output_tokens || 0;
        compteur.cacheEcrit += data.usage.cache_creation_input_tokens || 0;
        compteur.cacheLu += data.usage.cache_read_input_tokens || 0;
      }
      return (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
    }
    const corps = await res.text();
    derniereErreur = new Error(`API ${res.status}: ${corps.slice(0, 200)}`);
    if (!CODES_REESSAI.includes(res.status)) throw derniereErreur;
  }
  throw derniereErreur;
}

// Génération d'une section texte avec garde-fou éditorial : si une tournure
// interdite s'est glissée (négation du type "ce n'est pas X, c'est Y"),
// une seule régénération ciblée est tentée, à coût réduit grâce au cache.
async function genererSectionTexte(apiKey, prompt, systeme, compteur) {
  const texte = await genererSection(apiKey, prompt, systeme, compteur);
  if (!detecterNegations(texte).length) return texte;
  try {
    const reprise = await genererSection(
      apiKey,
      prompt + "\n\nATTENTION : ta version précédente contenait une tournure interdite du type \"ce n'est pas X, c'est Y\". Réécris entièrement la section en formulations affirmatives, sans aucune tournure de ce type.",
      systeme,
      compteur
    );
    return detecterNegations(reprise).length ? texte : reprise;
  } catch (e) {
    return texte;
  }
}

function parseJSON(texte) {
  const clean = texte.replace(/```json\s*|\s*```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

function listeSections(data) {
  // Mode recrutement : restitution candidat allégée (l'essentiel valorisant).
  // Les sections des blocs masqués côté candidat ne sont pas générées : économie directe.
  if (data.mode === "recrutement") {
    return { sections: ["ouverture", "alchimie", "combinaison", "combo_dynamiques", "takeovers", "temperament", "pepites"], tensions: [] };
  }
  const sections = [...SECTIONS_SOCLE, ...SECTIONS_DIM_SOCLE];
  // Dimensions de pilotage : seulement si le test a mesuré ces dimensions
  // (compatibilité totale avec les anciens profils qui ne les ont pas)
  if (data.contextuel_plus && Object.keys(data.contextuel_plus).length) {
    sections.push(...SECTIONS_DIM_PILOTAGE);
  }
  if (data.spe === "manager") {
    sections.push("mgmt_croisement", "mgmt_angles_plan", "mgmt_reflexes");
    sections.push(...SECTIONS_DIM_MANAGER);
    sections.push(...SECTIONS_SPE_MANAGER);
  } else if (data.spe === "commercial") {
    sections.push("com_croisement", "com_angles_plan", "com_reflexes");
    sections.push(...SECTIONS_DIM_COMMERCIAL);
    sections.push(...SECTIONS_SPE_COMMERCIAL);
  }
  return { sections, tensions: data.tensions || [] };
}

async function genererRestitution(apiKey, data) {
  const { sections, tensions } = listeSections(data);
  const resultat = {};
  const taches = [];
  const systeme = blocSystemeCommun(data);
  const compteur = { appels: 0, entree: 0, sortie: 0, cacheEcrit: 0, cacheLu: 0 };

  // Écrit le cache une fois, pour que tous les appels parallèles le lisent
  await chaufferCache(apiKey, systeme);

  // Phase 1 : toutes les sections sauf les synthèses, en parallèle
  const sectionsSynthese = sections.filter((n) => SECTIONS_SYNTHESE.includes(n));
  const sectionsDirectes = sections.filter((n) => !SECTIONS_SYNTHESE.includes(n));

  for (const nom of sectionsDirectes) {
    const promptFn = PROMPTS[nom] || PROMPTS_DIM[nom] || PROMPTS_SPE[nom];
    if (!promptFn) continue;
    const prompt = promptFn(data);
    const generation = SECTIONS_JSON.includes(nom)
      ? genererSection(apiKey, prompt, systeme, compteur)
      : genererSectionTexte(apiKey, prompt, systeme, compteur);
    taches.push(
      generation
        .then((texte) => {
          if (SECTIONS_JSON.includes(nom)) {
            resultat[nom] = parseJSON(texte) || { _erreur: true, _brut: nettoyer(texte) };
          } else {
            resultat[nom] = nettoyer(texte);
          }
        })
        .catch((e) => { resultat[nom] = { _erreur: true, _message: e.message }; })
    );
  }

  resultat.tensions = [];
  tensions.forEach((tension, i) => {
    const prompt = PROMPTS.tension(data, tension);
    taches.push(
      genererSectionTexte(apiKey, prompt, systeme, compteur)
        .then((texte) => { resultat.tensions[i] = { titre: tension.titre, axe: tension.axe, analyse: nettoyer(texte) }; })
        .catch((e) => { resultat.tensions[i] = { titre: tension.titre, axe: tension.axe, _erreur: true, _message: e.message }; })
    );
  });

  await Promise.all(taches);

  // Phase 2 : les synthèses, nourries de l'essentiel du contenu déjà produit,
  // pour prolonger le portrait au lieu de le répéter.
  for (const nom of sectionsSynthese) {
    const promptFn = PROMPTS[nom] || PROMPTS_DIM[nom] || PROMPTS_SPE[nom];
    if (!promptFn) continue;
    const extrait = extraitPourSynthese(resultat, SOURCES_SYNTHESE[nom] || []);
    const prompt = promptFn(data)
      + (extrait ? `\n\nPour la cohérence d'ensemble, voici l'essentiel déjà établi par les autres sections du portrait. Appuie ta synthèse dessus et prolonge-le, sans le répéter mot pour mot :\n${extrait}` : "");
    try {
      const texte = await genererSectionTexte(apiKey, prompt, systeme, compteur);
      resultat[nom] = nettoyer(texte);
    } catch (e) {
      resultat[nom] = { _erreur: true, _message: e.message };
    }
  }

  // Suivi du coût réel : journaux Vercel + usage attaché à la réponse,
  // que le front persiste avec le portrait (coût mesuré, plus estimé).
  const coutUsd = Math.round((compteur.entree * 5 + compteur.cacheEcrit * 6.25 + compteur.cacheLu * 0.5 + compteur.sortie * 25) / 1e6 * 10000) / 10000;
  const sansCacheUsd = Math.round(((compteur.entree + compteur.cacheEcrit + compteur.cacheLu) * 5 + compteur.sortie * 25) / 1e6 * 10000) / 10000;
  resultat._usage = {
    appels: compteur.appels, entree: compteur.entree, sortie: compteur.sortie,
    cacheEcrit: compteur.cacheEcrit, cacheLu: compteur.cacheLu,
    cout_usd: coutUsd, sans_cache_usd: sansCacheUsd,
  };
  console.log(`[generer] ${compteur.appels} appels | entrée ${compteur.entree} | sortie ${compteur.sortie} | cache écrit ${compteur.cacheEcrit} | cache lu ${compteur.cacheLu} | coût ${coutUsd}$ (sans cache ${sansCacheUsd}$)`);
  return resultat;
}

// Concatène des extraits des sections sources pour nourrir une synthèse.
function extraitPourSynthese(resultat, cles) {
  const morceaux = [];
  for (const c of cles) {
    const v = resultat[c];
    if (typeof v === "string" && v) morceaux.push(v.slice(0, 420));
  }
  return morceaux.join("\n\n");
}

// Handler Vercel
module.exports = async (req, res) => {
  // CORS restreint aux domaines autorisés
  appliquerCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ erreur: "Clé API non configurée" });

  const data = req.body;
  if (!data || !data.profil || !data.profil.bigFive) {
    return res.status(400).json({ erreur: "Données de profil manquantes" });
  }

  // garde-fou anti-rafale : génération complète = appel coûteux, on impose
  // un délai minimal entre deux requêtes d'un même appelant.
  const okCadence = await verifierCadence(identifiantAppelant(req, data), 8);
  if (!okCadence) {
    return res.status(429).json({ erreur: "Trop de requêtes rapprochées. Patientez quelques secondes avant de réessayer." });
  }

  try {
    const contenu = await genererRestitution(apiKey, data);
    return res.status(200).json({ ok: true, contenu });
  } catch (e) {
    return res.status(500).json({ erreur: e.message });
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
