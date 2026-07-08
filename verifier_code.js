// ============================================================
// api/verifier_code.js — Vérification du magic code (accès au test)
//   action "verifier"  : { code } → { ok, type, restant } ou { ok:false, raison }
//   action "consommer" : { code } → incrémente le compteur d'utilisations (à la fin du test)
// ============================================================

const { appliquerCors } = require("./_cors");

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

async function airtableGet(table, params = "") {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
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

// Cherche une campagne par son magic code (insensible à la casse et aux espaces)
async function trouverCampagne(code) {
  const codeNettoye = String(code).trim();
  // on récupère par filtre exact d'abord
  const formula = encodeURIComponent(`LOWER(TRIM({Code campagne})) = "${champFormule(codeNettoye).toLowerCase()}"`);
  const data = await airtableGet("Campagnes", `?filterByFormula=${formula}&maxRecords=1`);
  return (data.records && data.records[0]) || null;
}

// Cherche un répondant par email (table Répondants)
async function trouverRepondant(email) {
  const formula = encodeURIComponent(`LOWER({Email}) = "${champFormule(email).trim().toLowerCase()}"`);
  const data = await airtableGet("Répondants", `?filterByFormula=${formula}&maxRecords=1`);
  return (data.records && data.records[0]) || null;
}

// Compte les répondants ayant terminé le socle pour une campagne donnée (par nom).
// C'est la mesure réelle du quota : 1 utilisation = 1 personne qui a fini.
async function compterTermines(nomCampagne) {
  if (!nomCampagne) return 0;
  const formula = encodeURIComponent(`{Campagne} = "${champFormule(nomCampagne)}"`);
  let url = `?filterByFormula=${formula}`;
  let total = 0, offset = null, gardeFou = 0;
  do {
    const data = await airtableGet("Répondants", url + (offset ? `&offset=${offset}` : ""));
    (data.records || []).forEach((r) => {
      const s = (r.fields["Statut"] || "").toLowerCase();
      let fini = (s === "terminé" || s === "termine");
      if (!fini) { try { const a = JSON.parse(r.fields["Analyses (JSON)"] || "{}"); if (a && a.socle && a.socle.profil) fini = true; } catch (e) {} }
      if (fini) total++;
    });
    offset = data.offset;
  } while (offset && ++gardeFou < 20);
  return total;
}

// Vrai si ce répondant a déjà une analyse terminée (socle fait)
function aDejaFait(rec) {
  if (!rec) return false;
  const f = rec.fields;
  const statut = (f["Statut"] || "").toLowerCase();
  if (statut === "terminé" || statut === "termine") return true;
  // sécurité : si des analyses existent dans le JSON
  try {
    const analyses = JSON.parse(f["Analyses (JSON)"] || "{}");
    if (analyses && analyses.socle && analyses.socle.profil) return true;
  } catch (e) {}
  return false;
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action, code, email } = body || {};
    if (!code) return res.status(400).json({ ok: false, raison: "code_manquant" });

    const campagne = await trouverCampagne(code);
    if (!campagne) return res.status(200).json({ ok: false, raison: "code_invalide" });

    const f = campagne.fields;
    const statut = (f["Statut"] || "").toLowerCase();
    const quota = Number(f["Quota"] || 0);
    const type = (f["Type de test"] || "classic").toLowerCase();
    const nomCampagne = f["Nom campagne"] || "";
    const mode = (f["Mode"] || "").toLowerCase(); // "recrutement" → parcours candidat (restitution allégée)
    const thematique = (f["Thématique"] || "").trim(); // optionnel : cap de la formation/campagne (ex: "le feedback")
    // utilisations réelles = nombre de répondants ayant terminé (calcul direct, fiable)
    const utilisations = await compterTermines(nomCampagne);
    // Visibilité côté Airtable : si une colonne "Utilisations" (Number) existe sur la
    // campagne, on la synchronise avec le compte réel. Purement indicatif : la source
    // de vérité reste le calcul direct. Si la colonne n'existe pas, rien ne casse.
    if (Number(f["Utilisations"] || -1) !== utilisations) {
      try { await airtablePatch("Campagnes", campagne.id, { "Utilisations": utilisations }); } catch (e) {}
    }

    // campagne désactivée
    if (statut === "fermée" || statut === "fermee" || statut === "inactif" || statut === "inactive") {
      return res.status(200).json({ ok: false, raison: "campagne_fermee" });
    }
    // quota épuisé
    if (quota > 0 && utilisations >= quota) {
      return res.status(200).json({ ok: false, raison: "quota_epuise" });
    }

    // ---- action "consommer" : conservée pour compatibilité, mais le quota est désormais
    // calculé en direct (1 par répondant terminé). Aucun compteur à incrémenter. ----
    if (action === "consommer") {
      return res.status(200).json({ ok: true, consomme: true, restant: quota > 0 ? Math.max(0, quota - utilisations) : null });
    }

    // ---- action "verifier" (défaut) : valider l'accès ----
    // Vérifier si cet email a déjà passé le socle, et croiser avec le type du code.
    if (email) {
      const rep = await trouverRepondant(email);
      const dejaSocle = aDejaFait(rep);
      if (dejaSocle) {
        // La personne a déjà fait le socle.
        if (type === "classic") {
          // un code socle pour quelqu'un qui a déjà le socle : pas de sens, on redirige vers l'espace
          return res.status(200).json({ ok: false, raison: "deja_fait", prenom: (rep.fields["Prénom"] || "") });
        }
        // un code manager/commercial : on AJOUTE le module à ses droits existants
        const droitsActuels = (rep.fields["Droits"] || "").toLowerCase();
        const dejaModule = droitsActuels.includes(type);
        const analysesFaites = (() => { try { return JSON.parse(rep.fields["Analyses (JSON)"] || "{}"); } catch (e) { return {}; } })();
        if (analysesFaites[type]) {
          // le module est déjà fait aussi : rien à ajouter, on redirige vers l'espace
          return res.status(200).json({ ok: false, raison: "module_deja_fait", prenom: (rep.fields["Prénom"] || ""), module: type });
        }
        // ajouter le droit du module (en conservant les droits existants)
        const nouveauxDroits = dejaModule ? droitsActuels : (droitsActuels ? droitsActuels + "," + type : type);
        if (!dejaModule) {
          try { await airtablePatch("Répondants", rep.id, { Droits: nouveauxDroits }); } catch (e) {}
        }
        return res.status(200).json({ ok: true, type, mode, campagne: nomCampagne, thematique: thematique || null, ajout_module: true, deja_socle: true, restant: quota > 0 ? Math.max(0, quota - utilisations) : null });
      }
    }

    return res.status(200).json({
      ok: true,
      type,
      mode,
      campagne: nomCampagne,
      thematique: thematique || null,
      restant: quota > 0 ? Math.max(0, quota - utilisations) : null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, raison: "erreur_serveur", message: String(e.message || e) });
  }
};


// ---- sécurité : neutralise guillemets et antislashs avant interpolation dans une formule Airtable ----
function champFormule(v) {
  return String(v == null ? "" : v).replace(/[\\"]/g, "");
}
