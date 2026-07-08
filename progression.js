// ============================================================
// api/progression.js — Sauvegarde et récupère la progression d'un répondant
// Identifiant principal : l'email.
// POST { action:"save", email, prenom, nom, answers, idx, diagType }
// POST { action:"load", email }
// ============================================================

const { appliquerCors } = require("./_cors");
const crypto = require("crypto");
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const TABLE = "Répondants";

async function findByEmail(email) {
  const formula = encodeURIComponent(`LOWER({Email}) = "${champFormule(email).toLowerCase()}"`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable lecture ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.records && data.records[0]) || null;
}

// Retrouve un répondant par le jeton d'invitation du miroir (stocké dans le JSON
// des interactions). Le jeton est validé en amont : hexadécimal strict, aucune
// injection possible dans la formule Airtable.
async function findByJeton(jeton) {
  const formula = encodeURIComponent(`FIND('"jeton":"${jeton}"', {Interactions (JSON)})`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable lecture ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.records && data.records[0]) || null;
}

async function createRecord(fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable création ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
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

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!AIRTABLE_BASE || !AIRTABLE_TOKEN) return res.status(500).json({ error: "Configuration Airtable manquante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action, email } = body || {};
    if (!email && action !== "miroir_repondre") return res.status(400).json({ error: "Email manquant" });

    // ---- LOAD : récupérer la progression ----
    if (action === "load") {
      const rec = await findByEmail(email);
      if (!rec) return res.status(200).json({ found: false });
      let answers = {};
      try { answers = JSON.parse(rec.fields["Progression (JSON)"] || "{}"); } catch (e) {}
      return res.status(200).json({
        found: true,
        prenom: rec.fields["Prénom"] || "",
        nom: rec.fields["Nom"] || "",
        statut: rec.fields["Statut"] || "en cours",
        answers,
        idx: rec.fields["Étape en cours"] || 0,
        // droits : quels modules cette personne peut faire
        droits: rec.fields["Droits"] || "",
      });
    }

    // ---- SAVE : enregistrer la progression ----
    if (action === "save") {
      const { prenom, nom, answers, idx, diagType, droits, campagne } = body;
      const fields = {
        "Email": email,
        "Progression (JSON)": JSON.stringify(answers || {}).slice(0, 95000),
        "Étape en cours": typeof idx === "number" ? idx : 0,
        "Statut": "en cours",
      };
      if (prenom) fields["Prénom"] = prenom;
      if (nom) fields["Nom"] = nom;
      if (droits) fields["Droits"] = droits;
      if (campagne) fields["Campagne"] = campagne; // rattache le répondant à sa campagne (clé du dashboard)

      const existing = await findByEmail(email);
      if (existing) {
        await updateRecord(existing.id, fields);
      } else {
        await createRecord(fields);
      }
      return res.status(200).json({ ok: true });
    }

    // ---- LOAD_INTERACTIONS : récupérer les choix interactifs stockés ----
    if (action === "load_interactions") {
      const rec = await findByEmail(email);
      if (!rec) return res.status(200).json({ found: false });
      let interactions = {};
      try { interactions = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
      return res.status(200).json({ found: true, interactions });
    }

    // ---- SAVE_INTERACTIONS : stocker les choix de l'utilisateur ----
    if (action === "save_interactions") {
      const { type_analyse, interactions } = body;
      const existing = await findByEmail(email);
      let toutes = {};
      if (existing) {
        try { toutes = JSON.parse(existing.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
      }
      toutes[type_analyse || "socle"] = interactions || {};
      const fields = {
        "Email": email,
        "Interactions (JSON)": JSON.stringify(toutes).slice(0, 95000),
      };
      if (existing) {
        await updateRecord(existing.id, fields);
      } else {
        await createRecord(fields);
      }
      return res.status(200).json({ ok: true });
    }

    // ---- SAVE_PLAN_SUIVI : statuts + ressentis du plan d'action (remontent au tableau de bord) ----
    // ---- MIROIR 360 LÉGER ----
    // La personne crée un jeton d'invitation ; ses collègues répondent par ce
    // jeton, sans compte et sans jamais voir son email. Tout vit dans le champ
    // Interactions (JSON), sous la clé "miroir".
    if (action === "miroir_init") {
      const rec = await findByEmail(email);
      if (!rec) return res.status(200).json({ ok: false, raison: "profil_introuvable" });
      let toutes = {};
      try { toutes = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
      if (!toutes.miroir || !toutes.miroir.jeton) {
        toutes.miroir = { jeton: crypto.randomBytes(10).toString("hex"), reponses: (toutes.miroir && toutes.miroir.reponses) || [] };
        await updateRecord(rec.id, { "Interactions (JSON)": JSON.stringify(toutes).slice(0, 95000) });
      }
      return res.status(200).json({ ok: true, jeton: toutes.miroir.jeton, nb: (toutes.miroir.reponses || []).length });
    }

    // ---- Les jalons du parcours : marqueurs idempotents de la checklist ----
  if (action === "jalon") {
    const jeton = String(body.jeton || "").trim();
    const cle = String(body.cle || "").trim();
    const CLES_JALONS = ["lecture"];
    if (!jeton || CLES_JALONS.indexOf(cle) < 0) return res.status(400).json({ error: "jalon invalide" });
    const rec = await findByJeton(jeton);
    if (!rec) return res.status(404).json({ ok: false, raison: "inconnu" });
    let inter = {};
    try { inter = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
    inter.jalons = inter.jalons || {};
    if (inter.jalons[cle]) return res.status(200).json({ ok: true, deja: true });
    inter.jalons[cle] = new Date().toISOString();
    await updateRecord(rec.id, { "Interactions (JSON)": JSON.stringify(inter) });
    return res.status(200).json({ ok: true });
  }

  // ---- Les jalons du parcours : petites vérités horodatées ----
  // Sert la checklist de l'espace. Liste blanche stricte.
  if (action === "jalon") {
    const jeton = String(body.jeton || "").trim();
    const jalon = String(body.jalon || "").trim();
    const AUTORISES = ["lecture"];
    if (!jeton || AUTORISES.indexOf(jalon) < 0) return res.status(400).json({ error: "jalon invalide" });
    const rec = await findByJeton(jeton);
    if (!rec) return res.status(404).json({ ok: false, raison: "inconnu" });
    let inter = {};
    try { inter = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
    inter.jalons = inter.jalons || {};
    if (!inter.jalons[jalon]) {
      inter.jalons[jalon] = new Date().toISOString();
      await updateRecord(rec.id, { "Interactions (JSON)": JSON.stringify(inter) });
    }
    return res.status(200).json({ ok: true });
  }

  // ---- Le pari du miroir : la personne prédit le regard des autres ----
  // Cinq axes 0-100, scellés avant les premières réponses. Sert le score
  // de lucidité quand les regards arrivent.
  if (action === "miroir_prediction") {
    const jeton = String(body.jeton || "").trim();
    if (!jeton) return res.status(400).json({ error: "jeton requis" });
    const brut = body.prediction || {};
    const prediction = {};
    ["E", "A", "C", "S", "O"].forEach((k) => {
      const v = parseInt(brut[k], 10);
      if (v >= 0 && v <= 100) prediction[k] = v;
    });
    if (Object.keys(prediction).length < 5) return res.status(400).json({ error: "prédiction incomplète" });
    const rec = await findByJeton(jeton);
    if (!rec) return res.status(404).json({ ok: false, raison: "inconnu" });
    let inter = {};
    try { inter = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
    inter.miroir = inter.miroir || {};
    if (inter.miroir.prediction) return res.status(200).json({ ok: true, deja: true });
    prediction.date = new Date().toISOString();
    inter.miroir.prediction = prediction;
    await updateRecord(rec.id, { "Interactions (JSON)": JSON.stringify(inter) });
    return res.status(200).json({ ok: true });
  }

  // ---- L'avis direct sur le portrait : autonome, hors flux de fin ----
  // Identité par jeton (le token du lien participant). Fusionne l'avis
  // dans l'interaction du diagnostic visé sans toucher au reste.
  if (action === "avis_direct") {
    const jeton = String(body.jeton || "").trim();
    const avisBrut = body.avis || {};
    if (!jeton) return res.status(400).json({ error: "jeton requis" });
    const avis = {};
    ["AVIS_RESSEMBLANCE", "AVIS_UTILITE", "AVIS_CLARTE"].forEach((k) => {
      const v = parseInt(avisBrut[k], 10);
      if (v >= 1 && v <= 5) avis[k] = v;
    });
    const verbatim = String(avisBrut.AVIS_VERBATIM || "").trim().slice(0, 600);
    if (verbatim) avis.AVIS_VERBATIM = verbatim;
    if (!Object.keys(avis).length) return res.status(400).json({ error: "avis vide" });
    avis.date = new Date().toISOString();
    const rec = await findByJeton(jeton);
    if (!rec) return res.status(404).json({ ok: false, raison: "inconnu" });
    let inter = {};
    try { inter = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
    const type = String(body.type || "").trim().toLowerCase();
    const cle = (type && inter[type]) ? type : (inter.socle ? "socle" : Object.keys(inter)[0]);
    if (!cle) return res.status(404).json({ ok: false, raison: "sans_diagnostic" });
    inter[cle] = inter[cle] || {};
    inter[cle].avis = avis;
    await updateRecord(rec.id, { "Interactions (JSON)": JSON.stringify(inter) });
    return res.status(200).json({ ok: true });
  }

  if (action === "miroir_repondre") {
      const jeton = String(body.jeton || "");
      if (!/^[a-f0-9]{16,32}$/.test(jeton)) return res.status(400).json({ ok: false, raison: "jeton_invalide" });
      const brut = body.reponses || {};
      const propre = {};
      for (const d of ["E", "A", "C", "S", "O"]) {
        const v = parseInt(brut[d], 10);
        if (!(v >= 1 && v <= 4)) return res.status(400).json({ ok: false, raison: "reponses_invalides" });
        propre[d] = v;
      }
      const rec = await findByJeton(jeton);
      if (!rec) return res.status(200).json({ ok: false, raison: "jeton_inconnu" });
      let toutes = {};
      try { toutes = JSON.parse(rec.fields["Interactions (JSON)"] || "{}"); } catch (e) {}
      const mir = toutes.miroir || {};
      if (mir.jeton !== jeton) return res.status(200).json({ ok: false, raison: "jeton_inconnu" });
      const liste = mir.reponses || [];
      if (liste.length >= 5) return res.status(200).json({ ok: false, raison: "complet" });
      liste.push({ date: new Date().toISOString(), r: propre });
      toutes.miroir = { jeton: mir.jeton, reponses: liste };
      await updateRecord(rec.id, { "Interactions (JSON)": JSON.stringify(toutes).slice(0, 95000) });
      return res.status(200).json({ ok: true, nb: liste.length });
    }

    if (action === "save_plan_suivi") {
      const { module: moduleNom, suivi } = body;
      const existing = await findByEmail(email);
      let tout = {};
      if (existing) {
        try { tout = JSON.parse(existing.fields["Suivi Plan (JSON)"] || "{}"); } catch (e) {}
      }
      tout[moduleNom || "socle"] = {
        suivi: suivi || [],
        maj: new Date().toISOString(),
      };
      const fields = {
        "Email": email,
        "Suivi Plan (JSON)": JSON.stringify(tout).slice(0, 95000),
      };
      if (existing) {
        await updateRecord(existing.id, fields);
      } else {
        await createRecord(fields);
      }
      return res.status(200).json({ ok: true });
    }

    // ---- LOAD_PLAN_SUIVI : recharger le suivi (pour réafficher les statuts/ressentis) ----
    if (action === "load_plan_suivi") {
      const existing = await findByEmail(email);
      let tout = {};
      if (existing) {
        try { tout = JSON.parse(existing.fields["Suivi Plan (JSON)"] || "{}"); } catch (e) {}
      }
      return res.status(200).json({ suivi_plan: tout });
    }

    // ---- SAVE_ANALYSE : stocker une analyse générée (figée) ----
    if (action === "save_analyse") {
      const { type_analyse, contenu, prenom, nom, droits } = body;
      if (!type_analyse || !contenu) return res.status(400).json({ error: "type_analyse ou contenu manquant" });
      const existing = await findByEmail(email);
      // récupérer les analyses déjà stockées, puis ajouter/remplacer celle-ci
      let analyses = {};
      if (existing) {
        try { analyses = JSON.parse(existing.fields["Analyses (JSON)"] || "{}"); } catch (e) {}
      }
      // préserver la date de première réalisation si l'analyse existait déjà
      const dateExistante = (analyses[type_analyse] && analyses[type_analyse].date) ? analyses[type_analyse].date : null;
      // préserver le contenu IA déjà sauvegardé si le nouveau payload arrive sans contenu
      // (évite qu'une sauvegarde "profil seul" écrase le vrai contenu généré : race condition)
      const ancienContenuIA = (analyses[type_analyse] && analyses[type_analyse].contenu) ? analyses[type_analyse].contenu : null;
      const nouveauContenuIA = (contenu && contenu.contenu) ? contenu.contenu : null;
      analyses[type_analyse] = contenu;
      if (!nouveauContenuIA && ancienContenuIA) {
        analyses[type_analyse].contenu = ancienContenuIA;
      }
      analyses[type_analyse].date = dateExistante || new Date().toISOString();
      const jsonAnalyses = JSON.stringify(analyses).slice(0, 95000);
      const fields = {
        "Email": email,
        "Analyses (JSON)": jsonAnalyses,
        "Statut": "terminé",
        // le module est fini : on vide la progression en cours pour ne plus afficher "en cours"
        "Progression (JSON)": "{}",
        "Étape en cours": 0,
      };
      if (prenom) fields["Prénom"] = prenom;
      if (nom) fields["Nom"] = nom;
      if (droits) fields["Droits"] = droits;
      // ----- colonnes plates (lecture rapide Airtable + dashboard) + copie complète -----
      // le profil léger voyage dans contenu.profil ; on le déplie en colonnes simples.
      const profilPlat = (contenu && contenu.profil) || {};
      const champsPlats = {
        "Résultat complet (JSON)": jsonAnalyses,
      };
      if (profilPlat.dominante && profilPlat.dominante.nom) {
        champsPlats["Archétype dominant"] = profilPlat.dominante.nom;
        champsPlats["Famille dominante"] = profilPlat.dominante.famille || "";
      }
      const bf = profilPlat.scoresBigFive || {};
      ["E", "A", "C", "N", "O"].forEach((k) => {
        if (typeof bf[k] === "number") champsPlats["Big Five (" + k + ")"] = Math.round(bf[k] * 10) / 10;
      });
      // tentative complète, puis repli sans les colonnes plates si l'une d'elles
      // n'existe pas dans la base (on ne perd JAMAIS la sauvegarde de l'analyse)
      const tenter = async (champs) => {
        if (existing) { await updateRecord(existing.id, champs); } else { await createRecord(champs); }
      };
      try {
        await tenter(Object.assign({}, fields, champsPlats));
      } catch (e) {
        await tenter(fields);
      }
      // ----- quota : décompte CÔTÉ SERVEUR, infaillible -----
      // Règle : le quota compte des personnes. On consomme une utilisation à la
      // toute première analyse du répondant (son socle). Les modules ajoutés
      // Le quota n'est plus un compteur à incrémenter : il est calculé en direct
      // par le dashboard et par verifier_code (1 utilisation = 1 répondant terminé).
      // Rien à faire ici : marquer le Statut "terminé" suffit à alimenter le calcul.
      return res.status(200).json({ ok: true });
    }

    // ---- LOAD_ANALYSE : récupérer les analyses stockées + la progression en cours ----
    if (action === "load_analyse") {
      const rec = await findByEmail(email);
      if (!rec) return res.status(200).json({ found: false });
      let analyses = {};
      try { analyses = JSON.parse(rec.fields["Analyses (JSON)"] || "{}"); } catch (e) {}
      let progression = {};
      try { progression = JSON.parse(rec.fields["Progression (JSON)"] || "{}"); } catch (e) {}
      return res.status(200).json({
        found: true,
        prenom: rec.fields["Prénom"] || "",
        nom: rec.fields["Nom"] || "",
        droits: rec.fields["Droits"] || "",
        archetype: rec.fields["Archétype dominant"] || "",
        famille: rec.fields["Famille dominante"] || "",
        analyses,
        progression,                              // les réponses déjà données (pour calculer le %)
        etape: rec.fields["Étape en cours"] || 0,
      });
    }

    return res.status(400).json({ error: "Action inconnue (save ou load)" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};


// ---- sécurité : neutralise guillemets et antislashs avant interpolation dans une formule Airtable ----
function champFormule(v) {
  return String(v == null ? "" : v).replace(/[\\"]/g, "");
}
