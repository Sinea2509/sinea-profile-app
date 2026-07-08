// ============================================================
// api/diag_quota.js — AUDIT TEMPORAIRE du quota / utilisations
//
// Appel : POST /api/diag_quota  avec body { "code": "LE-CODE-CAMPAGNE" }
// (ou en GET : /api/diag_quota?code=LE-CODE)
//
// Renvoie TOUT ce que le serveur voit pour cette campagne :
//  - le nom de campagne lu (champ "Nom campagne")
//  - le quota lu
//  - la présence/valeur de la colonne "Utilisations"
//  - combien de répondants matchent {Campagne} = ce nom
//  - combien sont "terminé", avec le détail des statuts trouvés
//  - les noms de campagne DISTINCTS réellement présents sur les répondants
//    (pour repérer un décalage invisible : espace, accent, casse…)
//
// But : diagnostiquer en 10 secondes pourquoi "Utilisations" reste à 0.
// À SUPPRIMER une fois le problème réglé.
// ============================================================

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

async function airtableGet(table, params = "") {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${table} ${res.status}`);
  return await res.json();
}

function champFormule(v) {
  return String(v == null ? "" : v).replace(/[\\"]/g, "");
}

async function trouverCampagne(code) {
  const codeNettoye = String(code).trim();
  const formula = encodeURIComponent(`LOWER(TRIM({Code campagne})) = "${champFormule(codeNettoye).toLowerCase()}"`);
  const data = await airtableGet("Campagnes", `?filterByFormula=${formula}&maxRecords=1`);
  return (data.records && data.records[0]) || null;
}

// récupère tous les répondants (paginé) pour analyser les noms de campagne réels
async function tousRepondants() {
  let out = [], offset = null, garde = 0;
  do {
    const data = await airtableGet("Répondants", offset ? `?offset=${offset}` : "");
    (data.records || []).forEach((r) => out.push(r));
    offset = data.offset;
  } while (offset && ++garde < 30);
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (!AIRTABLE_BASE || !AIRTABLE_TOKEN) {
      return res.status(500).json({ ok: false, probleme: "Config Airtable absente (AIRTABLE_BASE_ID / AIRTABLE_TOKEN)." });
    }

    // récupérer le code depuis body (POST) ou query (GET)
    let code = null;
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      code = body.code;
    } else {
      code = req.query && req.query.code;
    }
    if (!code) return res.status(400).json({ ok: false, probleme: "Fournir un code : body {code} ou ?code=..." });

    // 1) la campagne
    const campagne = await trouverCampagne(code);
    if (!campagne) {
      return res.status(200).json({ ok: false, etape: "campagne", probleme: "Aucune campagne trouvée pour ce code (champ 'Code campagne').", code: code });
    }
    const f = campagne.fields;
    const nomCampagne = f["Nom campagne"] || "";
    const quota = Number(f["Quota"] || 0);
    const colonneUtilisationsPresente = Object.prototype.hasOwnProperty.call(f, "Utilisations");
    const valeurUtilisations = colonneUtilisationsPresente ? f["Utilisations"] : "(colonne absente ou vide)";

    // 2) répondants qui matchent EXACTEMENT le nom
    let matchExact = 0, termines = 0;
    const statutsTrouves = {};
    if (nomCampagne) {
      const formula = encodeURIComponent(`{Campagne} = "${champFormule(nomCampagne)}"`);
      let offset = null, garde = 0;
      do {
        const data = await airtableGet("Répondants", `?filterByFormula=${formula}` + (offset ? `&offset=${offset}` : ""));
        (data.records || []).forEach((r) => {
          matchExact++;
          const s = (r.fields["Statut"] || "(vide)");
          statutsTrouves[s] = (statutsTrouves[s] || 0) + 1;
          const sl = String(s).toLowerCase();
          let fini = (sl === "terminé" || sl === "termine");
          if (!fini) { try { const a = JSON.parse(r.fields["Analyses (JSON)"] || "{}"); if (a && a.socle && a.socle.profil) fini = true; } catch (e) {} }
          if (fini) termines++;
        });
        offset = data.offset;
      } while (offset && ++garde < 20);
    }

    // 3) tous les noms de campagne DISTINCTS présents sur les répondants
    //    (pour repérer un décalage invisible avec le nom de la campagne)
    const repondants = await tousRepondants();
    const nomsDistincts = {};
    repondants.forEach((r) => {
      const c = r.fields["Campagne"];
      const key = (c === undefined || c === null || c === "") ? "(champ Campagne vide)" : JSON.stringify(c);
      nomsDistincts[key] = (nomsDistincts[key] || 0) + 1;
    });

    return res.status(200).json({
      ok: true,
      _lecture: "Ce que le serveur voit pour cette campagne",
      campagne: {
        id: campagne.id,
        "Nom campagne (lu)": nomCampagne || "(VIDE — c'est probablement le problème)",
        "Quota (lu)": quota,
        "Colonne Utilisations présente ?": colonneUtilisationsPresente,
        "Valeur Utilisations actuelle": valeurUtilisations,
      },
      comptage: {
        "Répondants où {Campagne} = nom exact": matchExact,
        "...dont terminés (= utilisations calculées)": termines,
        "Détail des statuts trouvés": statutsTrouves,
        "Quota bloquera l'accès ?": (quota > 0 && termines >= quota),
      },
      diagnostic_noms: {
        "_note": "Valeurs DISTINCTES du champ 'Campagne' sur TOUS les répondants. Le nom de la campagne doit apparaître ici à l'identique.",
        "Nom recherché": JSON.stringify(nomCampagne),
        "Noms réellement présents (avec nombre)": nomsDistincts,
      },
      conseils: construireConseils(nomCampagne, matchExact, termines, colonneUtilisationsPresente, nomsDistincts),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, probleme: "Exception : " + (e && e.message ? e.message : String(e)) });
  }
};

function construireConseils(nom, match, termines, colPresente, nomsDistincts) {
  const c = [];
  if (!nom) c.push("Le champ 'Nom campagne' de la campagne est VIDE. Remplis-le : c'est lui qui sert à compter. Sans lui, utilisations = 0 pour toujours.");
  if (nom && match === 0) {
    c.push("Aucun répondant n'a {Campagne} = '" + nom + "'. Regarde 'Noms réellement présents' : si tu vois une version proche (espace, accent, casse), c'est le décalage. Aligne les deux textes.");
  }
  if (nom && match > 0 && termines === 0) {
    c.push("Des répondants matchent le nom, mais AUCUN n'est compté comme terminé. Regarde 'Détail des statuts' : le code ne compte que 'terminé'. Si tes répondants ont un autre statut, c'est ça.");
  }
  if (!colPresente) c.push("La colonne 'Utilisations' n'est pas vue sur la campagne. Vérifie qu'elle existe, en Number, nommée exactement 'Utilisations'. Sans elle, le calcul marche quand même mais rien ne s'affiche dans Airtable.");
  if (nom && match > 0 && termines > 0 && colPresente) c.push("Tout semble correct : " + termines + " utilisation(s) devraient s'afficher. Si la colonne reste à 0, c'est qu'aucun code n'a été vérifié DEPUIS l'ajout de la colonne : la synchro se fait au moment d'une vérification de code. Vérifie un code une fois.");
  if (c.length === 0) c.push("Rien d'anormal détecté.");
  return c;
}
