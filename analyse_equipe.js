// ============================================================
// api/analyse_equipe.js — Analyse stratégique d'une équipe (campagne)
//   POST { cle, code, force } → génère (ou récupère) l'analyse SWOT + dynamiques + plan
//   L'analyse est mise en cache dans la campagne (champ "Analyse equipe (JSON)")
//   pour éviter de la régénérer (coût IA) à chaque consultation.
//   v2 : exploite les dimensions de pilotage (énergie, collaboration, autorité,
//   reconnaissance), la fiabilité des profils et le coût d'adaptation.
// ============================================================

const { appliquerCors } = require("./_cors");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 6000;
const VERSION_ANALYSE = 2; // v2 : dimensions de pilotage + fiabilité + coût d'adaptation

async function airtableGet(table, params = "") {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

async function airtableAll(table, params = "") {
  let records = []; let offset = null;
  do {
    const sep = params.includes("?") ? "&" : "?";
    const p = offset ? `${params}${sep}offset=${offset}` : params;
    const data = await airtableGet(table, p);
    records = records.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return records;
}

async function airtablePatch(table, id, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable PATCH ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

function parseJSON(texte) {
  let clean = String(texte).trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

// Extrait le profil riche du champ "Résultat complet (JSON)" (même logique que dashboard.js)
function extraireProfilRiche(jsonBrut) {
  if (!jsonBrut) return null;
  let data;
  try { data = typeof jsonBrut === "string" ? JSON.parse(jsonBrut) : jsonBrut; } catch (e) { return null; }
  if (data && data.scoresBigFive) return data;
  const modules = Object.values(data || {}).filter((m) => m && m.profil);
  if (!modules.length) return null;
  const avecSpe = modules.filter((m) => m.profil.speStyle);
  const choisi = (avecSpe.length ? avecSpe : modules).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
  return choisi.profil;
}

// Libellés courts pour le prompt (lisibles par l'IA)
const LIB = {
  energie: { sprinteur: "sprinteur (pics courts et intenses)", endurant: "endurant (effort régulier)", cyclique: "cyclique (alternance intensité et récupération)", deepworker: "deep-worker (concentration longue)" },
  collaboration: { autonome: "autonome", cooperatif: "coopératif", interdependant: "interdépendant", federateur: "fédérateur" },
  autorite: { cadre: "besoin de cadre clair", sens: "besoin de sens", liberte: "besoin de liberté", contributeur: "besoin d'être associé aux décisions" },
  reconnaissance: { resultats: "reconnaissance par les résultats", effort: "reconnaissance de l'effort", relation: "reconnaissance par la considération", autonomie: "reconnaissance par la confiance accordée" },
  stress: { accelerateur: "accélère sous stress", methodique: "se structure sous stress", retrait: "prend du recul sous stress", appui: "cherche l'appui sous stress" },
  motivation: { accomplissement: "moteur accomplissement", reconnaissance: "moteur reconnaissance", sens: "moteur sens", maitrise: "moteur maîtrise" },
};
const lib = (dim, val) => (val && LIB[dim] && LIB[dim][val]) ? LIB[dim][val] : null;

const REGLES = `Règles d'écriture : ton de conseil professionnel, clair et direct, à la fois rigoureux et accessible (comme un consultant senior qui parle à un dirigeant). Phrases nettes. Aucun tiret cadratin, utilisez un point médian ou reformulez. Formulations affirmatives. Sentence case. Chaque analyse doit être concrète, actionnable et ancrée dans la composition réelle de l'équipe, jamais générique.`;

// Construit le prompt d'analyse à partir des profils de l'équipe
function construirePrompt(nomCampagne, type, membres) {
  // synthèse de la composition
  const familles = { RELATION: 0, ACTION: 0, STRUCTURE: 0, VISION: 0 };
  membres.forEach((m) => { if (familles[m.famille] !== undefined) familles[m.famille]++; });
  const compo = Object.entries(familles).map(([f, n]) => `${f}: ${n}`).join(", ");

  // Familles sous-représentées : donnée objective qui nourrit la recommandation de recrutement.
  // On raisonne en proportion, pas en absolu : une famille à 0 ou très minoritaire est un angle mort potentiel.
  const total = membres.length || 1;
  const LABEL_FAMILLE = { RELATION: "Relation (le lien, l'humain, la cohésion)", ACTION: "Action (l'énergie, l'exécution, le résultat)", STRUCTURE: "Structure (le cadre, la rigueur, la fiabilité)", VISION: "Vision (le cap, l'innovation, la hauteur de vue)" };
  const famillesTriees = Object.entries(familles).sort((x, y) => x[1] - y[1]);
  const absentes = famillesTriees.filter(([, n]) => n === 0).map(([f]) => f);
  const minoritaires = famillesTriees.filter(([, n]) => n > 0 && n / total <= 0.15).map(([f]) => f);
  const dominantesEq = famillesTriees.filter(([, n]) => n / total >= 0.5).map(([f]) => f);
  const diagnosticCouverture = [
    absentes.length ? `Familles totalement absentes : ${absentes.map((f) => LABEL_FAMILLE[f]).join(" ; ")}.` : "",
    minoritaires.length ? `Familles très minoritaires (sous 15% de l'équipe) : ${minoritaires.map((f) => LABEL_FAMILLE[f]).join(" ; ")}.` : "",
    dominantesEq.length ? `Familles surreprésentées (la moitié de l'équipe ou plus) : ${dominantesEq.map((f) => LABEL_FAMILLE[f]).join(" ; ")}.` : "",
  ].filter(Boolean).join("\n");

  // ===== Synthèses de pilotage (agrégats sur les membres qui ont les données) =====
  const compter = (cle) => {
    const c = {};
    membres.forEach((m) => { const v = m.pilotage && m.pilotage[cle]; if (v) c[v] = (c[v] || 0) + 1; });
    return c;
  };
  const fmtCompte = (cle) => {
    const c = compter(cle);
    const entries = Object.entries(c);
    if (!entries.length) return null;
    return entries.map(([v, n]) => `${lib(cle, v) || v}: ${n}`).join(", ");
  };
  const lignesPilotage = [];
  const dEnergie = fmtCompte("energie"); if (dEnergie) lignesPilotage.push(`Rythmes d'énergie : ${dEnergie}`);
  const dCollab = fmtCompte("collaboration"); if (dCollab) lignesPilotage.push(`Modes de collaboration : ${dCollab}`);
  const dAutorite = fmtCompte("autorite"); if (dAutorite) lignesPilotage.push(`Rapports au cadre : ${dAutorite}`);
  const dReco = fmtCompte("reconnaissance"); if (dReco) lignesPilotage.push(`Leviers de reconnaissance : ${dReco}`);
  const dStress = fmtCompte("stress"); if (dStress) lignesPilotage.push(`Réactions au stress : ${dStress}`);
  const dMotiv = fmtCompte("motivation"); if (dMotiv) lignesPilotage.push(`Moteurs de motivation : ${dMotiv}`);

  // Fiabilité : profils à lire avec prudence
  const fiabFaibles = membres.filter((m) => m.fiabilite !== null && m.fiabilite < 70).map((m) => `${m.nom} (${m.fiabilite}%)`);
  const fiabDispo = membres.filter((m) => m.fiabilite !== null);
  if (fiabDispo.length) {
    const moy = Math.round(fiabDispo.reduce((s, m) => s + m.fiabilite, 0) / fiabDispo.length);
    lignesPilotage.push(`Fiabilité moyenne des profils : ${moy}%${fiabFaibles.length ? ` · profils à lire avec prudence (cohérence des réponses plus faible) : ${fiabFaibles.join(", ")}` : ""}`);
  }
  // Coût d'adaptation : signal d'usure silencieuse
  const coutsEleves = membres.filter((m) => m.coutAdaptation === "élevé").map((m) => m.nom);
  if (coutsEleves.length) lignesPilotage.push(`Coût d'adaptation élevé (écart important entre tempérament naturel et comportement au travail, risque d'usure silencieuse) : ${coutsEleves.join(", ")}`);

  const blocPilotage = lignesPilotage.length
    ? `\n\nDonnées de pilotage de l'équipe :\n${lignesPilotage.join("\n")}`
    : "";

  // ===== Liste des membres (enrichie quand les données existent) =====
  const listeMembres = membres.map((m, i) => {
    let ligne = `${i + 1}. ${m.nom || "Anonyme"} · archétype ${m.dominante || "?"} (famille ${m.famille || "?"})`;
    if (m.bigFive && m.bigFive.E !== null) ligne += ` · Big Five E${m.bigFive.E} A${m.bigFive.A} C${m.bigFive.C} N${m.bigFive.N} O${m.bigFive.O}`;
    const traits = [];
    if (m.pilotage) {
      ["energie", "autorite", "reconnaissance", "collaboration"].forEach((k) => { const l = lib(k, m.pilotage[k]); if (l) traits.push(l); });
    }
    if (m.fiabilite !== null && m.fiabilite < 70) traits.push(`fiabilité du profil ${m.fiabilite}% (à confirmer en entretien)`);
    if (m.coutAdaptation === "élevé") traits.push("coût d'adaptation élevé");
    if (m.speStyle) traits.push(`style ${m.speStyle}`);
    if (traits.length) ligne += ` · ${traits.join(" · ")}`;
    return ligne;
  }).join("\n");

  const focusType = type === "manager"
    ? "Cette équipe est composée de managers : analyse leur posture managériale collective."
    : type === "commercial"
    ? "Cette équipe est composée de commerciaux : analyse leur dynamique commerciale collective."
    : "Analyse la dynamique professionnelle collective de cette équipe.";

  const consignesPilotage = lignesPilotage.length ? `
Exploite activement les données de pilotage dans toute l'analyse :
- Croise les rythmes d'énergie avec la charge (par exemple une majorité de sprinteurs sans culture de récupération signale un risque d'épuisement collectif ; des deep-workers dans un environnement morcelé signalent une perte de performance évitable).
- Croise les rapports au cadre entre eux et avec le management (des besoins de cadre et des besoins de liberté qui cohabitent demandent un management différencié explicite).
- Utilise les leviers de reconnaissance pour des recommandations différenciées (féliciter les résultats des uns, l'effort des autres, accorder de l'autonomie aux troisièmes).
- Traite tout coût d'adaptation élevé comme un point d'attention RH prioritaire (usure silencieuse, risque de désengagement ou de départ).
- Traite toute fiabilité faible comme une invitation à valider le profil en entretien, jamais comme un défaut de la personne.
- Dans focus_individuel, le conseil de chaque membre doit mobiliser ses dimensions de pilotage quand elles existent (son rythme, son besoin de cadre, son levier de reconnaissance), pour donner au manager un mode d'emploi réellement personnalisé.` : "";

  return `Tu es un consultant senior en organisation et dynamique d'équipe. Tu produis une analyse stratégique de l'équipe "${nomCampagne}" pour aider un RH ou un manager à la piloter. ${focusType}

Composition de l'équipe (${membres.length} personnes) :
Répartition des familles : ${compo}${diagnosticCouverture ? `\nDiagnostic de couverture (à exploiter pour la recommandation de recrutement) :\n${diagnosticCouverture}` : ""}${blocPilotage}
Membres :
${listeMembres}
${consignesPilotage}

Produis une analyse stratégique complète et actionnable.

Pour la recommandation de recrutement (champ "recrutement"), raisonne en consultant senior, pas en cochant des cases :
- Croise DEUX niveaux de lecture, jamais un seul. D'abord les familles d'archétypes (la couverture des grands rôles). Ensuite, et c'est aussi important, les DIMENSIONS DE PILOTAGE de l'équipe : son équilibre de rythmes d'énergie, ses rapports au cadre, ses leviers de reconnaissance, ses modes de collaboration, ses réactions au stress.
- Repère les déséquilibres de pilotage comme des manques à part entière. Exemples : une équipe sans deep-worker dans un métier de concentration, une équipe 100% autonome sans personne pour faire le lien transverse, une majorité de profils qui ont besoin de cadre sans aucun pilote autonome, une équipe entière en sprint sans culture de récupération. Un déséquilibre de pilotage peut être plus pénalisant qu'une famille absente.
- Pars toujours des BESOINS RÉELS de l'équipe (ses angles morts, ses risques, ce que sa composition l'empêche de faire), jamais d'une logique de collection où il faudrait tout cocher. Une famille absente ou un rythme manquant n'est un manque QUE s'il répond à un besoin réel. Une équipe très homogène peut être un atout pour certaines missions, dis-le quand c'est le cas.
- Si l'équipe est déjà équilibrée sur les deux niveaux, assume-le et recommande de consolider plutôt que de recruter par principe.
- La fiche de poste doit être concrète et utilisable telle quelle par un RH. Elle relie le profil recherché À LA FOIS aux dimensions Big Five ET aux dimensions de pilotage qui manquent (par exemple "un profil au rythme deep-worker, autonome, qui apporte le cadre absent"), et décrit le comportement attendu au quotidien.
- Adapte la recommandation à la TAILLE de l'équipe. Une petite équipe a en général un manque prioritaire unique. Une équipe de dix personnes ou plus peut avoir deux manques distincts (par exemple une famille absente ET un déséquilibre de rythme) : dans ce cas, propose un profil prioritaire détaillé, et mentionne brièvement le second besoin.
- Relie le profil à recruter à la DYNAMIQUE de l'équipe : recruter pour accélérer une croissance n'est pas recruter pour stabiliser et fiabiliser. Déduis l'intention probable de la composition (une équipe très Action qui s'épuise a besoin de structure pour durer ; une équipe très Structure qui ronronne a besoin de Vision pour se renouveler) et formule la recommandation dans cette logique de trajectoire.

Réponds STRICTEMENT en JSON valide, sans aucun texte autour, au format exact :
{
  "synthese": "un paragraphe de 80 mots qui capte l'identité collective de cette équipe et son profil dominant",
  "swot": {
    "forces": ["3 forces collectives concrètes de cette équipe, chacune environ 25 mots, ancrée dans sa composition réelle"],
    "faiblesses": ["3 faiblesses ou angles morts collectifs, chacun environ 25 mots, formulés avec tact comme des points de vigilance"],
    "opportunites": ["3 opportunités que cette équipe peut saisir grâce à sa composition, chacune environ 25 mots"],
    "risques": ["3 risques à surveiller dans cette configuration d'équipe, chacun environ 25 mots"]
  },
  "dynamiques": "un paragraphe de 100 mots sur les dynamiques internes : complémentarités naturelles, tensions potentielles entre profils, frictions de rythmes ou de besoins, ce qui fait que cette équipe fonctionne ou coince",
  "risques_rh": ["3 points d'attention RH spécifiques (rétention, usure, montée en compétence, équilibre, recrutement à venir), chacun environ 25 mots"],
  "plan_action": [
    {"titre": "titre court de l'action", "desc": "environ 35 mots, une action concrète de pilotage pour le manager ou le RH"},
    {"titre": "...", "desc": "..."},
    {"titre": "...", "desc": "..."},
    {"titre": "...", "desc": "..."}
  ],
  "focus_individuel": [
    {"nom": "nom exact du membre", "conseil": "environ 30 mots, un conseil de management personnalisé pour faire grandir cette personne dans l'équipe"}
  ],
  "recrutement": {
    "diagnostic": "un paragraphe de 70 mots qui dit honnêtement si cette équipe a besoin d'un profil complémentaire et pourquoi, en s'appuyant sur ses angles morts réels. Si l'équipe est déjà équilibrée, dis-le clairement et recommande de consolider plutôt que de diversifier.",
    "profil_cible": "le type de profil à viser en une phrase (famille et orientation), ou 'consolidation des profils existants' si aucun recrutement n'est prioritaire",
    "fiche_poste": {
      "intitule": "un intitulé de profil parlant qui combine famille et pilotage, par exemple 'Un profil Structure au rythme deep-worker pour ancrer l'exécution'",
      "pourquoi": "environ 45 mots : ce que ce profil apporterait précisément à CETTE équipe, en comblant un angle mort d'archétype ET un manque de pilotage identifiés",
      "profil_archetype": "la famille ou l'archétype visé en quelques mots",
      "profil_pilotage": "les dimensions de pilotage recherchées en quelques mots (rythme, rapport au cadre, mode de collaboration), tirées des manques réels de l'équipe",
      "traits_recherches": ["3 traits ou comportements clés à rechercher, chacun environ 15 mots, reliés au Big Five quand c'est pertinent"],
      "signaux_entretien": ["2 questions ou signaux concrets à observer en entretien pour repérer ce profil, chacun environ 18 mots"],
      "vigilance": "environ 25 mots : le risque d'intégration à anticiper avec ce nouveau profil dans l'équipe actuelle"
    },
    "besoin_secondaire": "vide si l'équipe est petite ou n'a qu'un manque. Sinon, environ 30 mots décrivant un second profil utile, moins prioritaire que le premier"
  }
}
Pour focus_individuel, produis une entrée par membre de l'équipe (utilise leur nom exact). Sois précis et utile pour chacun.
${REGLES}`;
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "Configuration IA manquante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { cle, code, force } = body || {};
    // garde-fou anti-rafale : on limite la cadence d'un même appelant
    const okCadence = await verifierCadence(identifiantAppelant(req, body), 8);
    if (!okCadence) return res.status(429).json({ ok:false, raison:"trop_rapide", erreur:"Trop de requêtes rapprochées. Patientez quelques secondes." });
    const cleRecue = ((req.headers || {})["x-dashboard-key"]) || cle;
    if (!DASHBOARD_KEY || cleRecue !== DASHBOARD_KEY) return res.status(401).json({ error: "Accès non autorisé" });
    if (!code) return res.status(400).json({ error: "code manquant" });

    // trouver la campagne
    const formula = encodeURIComponent(`{Code campagne} = "${champFormule(code)}"`);
    const camp = await airtableGet("Campagnes", `?filterByFormula=${formula}&maxRecords=1`);
    const campRecord = (camp.records && camp.records[0]) || null;
    if (!campRecord) return res.status(404).json({ error: "Campagne introuvable" });
    const nomCampagne = campRecord.fields["Nom campagne"] || "";
    const type = (campRecord.fields["Type de test"] || "classic").toLowerCase();

    // récupérer les membres terminés (avant le cache : on en a besoin pour décider de régénérer)
    const repFormula = encodeURIComponent(`{Campagne} = "${champFormule(nomCampagne)}"`);
    const reps = await airtableAll("Répondants", `?filterByFormula=${repFormula}`);
    const membres = reps
      .filter((r) => (r.fields["Statut"] || "").toLowerCase().startsWith("termin"))
      .map((r) => {
        const riche = extraireProfilRiche(r.fields["Résultat complet (JSON)"] || r.fields["Analyses (JSON)"]);
        return {
          nom: r.fields["Nom"] || r.fields["Prénom"] || "",
          dominante: r.fields["Archétype dominant"] || "",
          famille: (r.fields["Famille dominante"] || "").toUpperCase(),
          bigFive: {
            E: r.fields["Big Five (E)"] ?? null, A: r.fields["Big Five (A)"] ?? null,
            C: r.fields["Big Five (C)"] ?? null, N: r.fields["Big Five (N)"] ?? null, O: r.fields["Big Five (O)"] ?? null,
          },
          pilotage: riche ? Object.assign({}, riche.contextuel || {}, riche.contextuelPlus || {}) : null,
          fiabilite: riche && riche.fiabilite && riche.fiabilite.score !== undefined ? riche.fiabilite.score : null,
          coutAdaptation: riche && riche.naturelAdapte ? (riche.naturelAdapte.cout || null) : null,
          speStyle: riche && riche.speStyle ? riche.speStyle : null,
        };
      });

    if (membres.length < 2) {
      return res.status(200).json({ ok: false, raison: "pas_assez", message: "Il faut au moins 2 analyses terminées pour générer une analyse d'équipe." });
    }

    // l'équipe a-t-elle des données de pilotage ? (au moins un membre)
    const aPilotage = membres.some((m) => m.pilotage && Object.keys(m.pilotage).length);

    // cache : renvoyer l'analyse existante, sauf si on force,
    // ou si elle date d'avant la v2 alors que l'équipe a désormais des données de pilotage
    if (!force) {
      const cacheRaw = campRecord.fields["Analyse equipe (JSON)"];
      if (cacheRaw) {
        const cache = parseJSON(cacheRaw);
        const cacheObsolete = cache && (cache._version || 1) < VERSION_ANALYSE && aPilotage;
        if (cache && !cacheObsolete) return res.status(200).json({ ok: true, analyse: cache, cache: true });
      }
    }

    // générer l'analyse via l'IA
    const prompt = construirePrompt(nomCampagne, type, membres);
    const apiRes = await fetchAvecDelai(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, messages: [{ role: "user", content: prompt }] }),
    });
    if (!apiRes.ok) {
      const err = await apiRes.text();
      return res.status(500).json({ error: `IA ${apiRes.status}: ${err.slice(0, 150)}` });
    }
    const data = await apiRes.json();
    const texte = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const analyse = parseJSON(texte);
    if (!analyse) return res.status(500).json({ error: "Réponse IA non exploitable" });
    analyse._version = VERSION_ANALYSE;

    // mettre en cache dans la campagne
    try { await airtablePatch("Campagnes", campRecord.id, { "Analyse equipe (JSON)": JSON.stringify(analyse) }); } catch (e) {}

    return res.status(200).json({ ok: true, analyse, cache: false, nbMembres: membres.length });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};


// ---- sécurité : neutralise guillemets et antislashs avant interpolation dans une formule Airtable ----
function champFormule(v) {
  return String(v == null ? "" : v).replace(/[\\"]/g, "");
}


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
