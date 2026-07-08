// ============================================================
// api/enregistrer.js — Enregistre un résultat de test dans Airtable
// Endpoint : POST /api/enregistrer
// Reçoit : { token, profil, resultatComplet }
// Trouve le répondant par son token, remplit ses résultats.
// ============================================================

const { appliquerCors } = require("./_cors");
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const TABLE_REPONDANTS = "Répondants";

// Recherche un répondant par son token
async function trouverRepondant(token) {
  const formula = encodeURIComponent(`{Token} = "${champFormule(token)}"`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE_REPONDANTS)}?filterByFormula=${formula}&maxRecords=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable lecture ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.records && data.records[0]) || null;
}

// Met à jour le répondant avec ses résultats
async function majRepondant(recordId, champs) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE_REPONDANTS)}/${recordId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: champs, typecast: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable écriture ${res.status}: ${err.slice(0, 200)}`);
  }
  return await res.json();
}

// Sérialise en restant sous la limite Airtable : on retire d'abord les champs
// les plus lourds et les moins critiques, plutôt que de couper le JSON (qui le rendrait invalide).
function serialiserBorne(objet, limite) {
  let copie = objet;
  let json = JSON.stringify(copie);
  if (json.length <= limite) return json;
  copie = Object.assign({}, objet); delete copie.tempsReponses;
  json = JSON.stringify(copie);
  if (json.length <= limite) return json;
  delete copie.reponsesBrutes;
  json = JSON.stringify(copie);
  if (json.length <= limite) return json;
  // dernier recours : un profil minimal toujours valide
  return JSON.stringify({
    dominante: copie.dominante || null, secondaires: copie.secondaires || [],
    scoresBigFive: copie.scoresBigFive || null, diagType: copie.diagType || null,
    speStyle: copie.speStyle || null, speDims: copie.speDims || null, _tronque: true,
  });
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  if (!AIRTABLE_BASE || !AIRTABLE_TOKEN) {
    return res.status(500).json({ error: "Configuration Airtable manquante" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { token, profil, resultatComplet, campagne } = body || {};

    if (!token) return res.status(400).json({ error: "Token manquant" });
    if (!profil) return res.status(400).json({ error: "Profil manquant" });

    // Trouver le répondant par son token
    const repondant = await trouverRepondant(token);
    if (!repondant) {
      return res.status(404).json({ error: "Répondant introuvable pour ce token" });
    }

    // Préparer les champs à remplir
    const bf = profil.bigFive || {};
    const champs = {
      "Statut": "terminé",
      ...(campagne ? { "Campagne": campagne } : {}),
      "Archétype dominant": profil.dominante || "",
      "Archétypes secondaires": (profil.secondaires || []).join(", "),
      "Famille dominante": profil.famille || "",
      "Big Five (E)": typeof bf.E === "number" ? bf.E : null,
      "Big Five (A)": typeof bf.A === "number" ? bf.A : null,
      "Big Five (C)": typeof bf.C === "number" ? bf.C : null,
      "Big Five (N)": typeof bf.N === "number" ? bf.N : null,
      "Big Five (O)": typeof bf.O === "number" ? bf.O : null,
      "Résultat complet (JSON)": serialiserBorne(resultatComplet || profil, 95000),
    };

    await majRepondant(repondant.id, champs);

    return res.status(200).json({ ok: true, nom: repondant.fields["Nom"] || "" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};


// ---- sécurité : neutralise guillemets et antislashs avant interpolation dans une formule Airtable ----
function champFormule(v) {
  return String(v == null ? "" : v).replace(/[\\"]/g, "");
}
