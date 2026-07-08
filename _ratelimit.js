// ============================================================
// api/_ratelimit.js — Protection légère anti-rafale (preventif)
//
// Garde-fou simple, sans dépendance externe, pour empêcher le
// martèlement des fonctions coûteuses (appels IA) par un même
// appelant. Ce n'est PAS un rate limiting complet (voir Upstash,
// prévu plus tard) : c'est un verrou minimal qui bloque l'abus
// grossier (rafales de requêtes) sans gêner un usage normal.
//
// Principe : on note l'horodatage du dernier appel par identifiant
// (email, code ou IP) dans une table Airtable "RateLimit", et on
// refuse si deux appels arrivent dans un intervalle trop court.
//
// Usage dans une fonction :
//   const { verifierCadence } = require("./_ratelimit");
//   const okCadence = await verifierCadence(identifiant, 4); // 4s mini
//   if (!okCadence) return res.status(429).json({ ok:false, raison:"trop_rapide",
//       message:"Trop de requêtes rapprochées. Patientez quelques secondes." });
//
// Tolérant aux pannes : si Airtable échoue, on LAISSE PASSER (on ne
// bloque jamais un usage légitime à cause d'une erreur d'infra).
// ============================================================

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const TABLE = "RateLimit";

// Construit une clé courte et neutre à partir de l'identifiant
function cleId(identifiant) {
  return String(identifiant == null ? "anon" : identifiant)
    .trim()
    .toLowerCase()
    .replace(/[\\"]/g, "")
    .slice(0, 120);
}

async function airtableGet(params = "") {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}${params}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable ${res.status}`);
  return await res.json();
}

async function airtableCreate(fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable POST ${res.status}`);
  return await res.json();
}

async function airtablePatch(id, fields) {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable PATCH ${res.status}`);
  return await res.json();
}

// Vérifie la cadence. Renvoie true si l'appel est autorisé, false s'il
// arrive trop vite après le précédent. delaiMin en secondes.
async function verifierCadence(identifiant, delaiMin = 4) {
  // Si la config Airtable manque, on ne bloque pas (sécurité = ne jamais
  // casser un usage légitime à cause d'une erreur d'infra).
  if (!AIRTABLE_BASE || !AIRTABLE_TOKEN) return true;

  const cle = cleId(identifiant);
  const maintenant = Date.now();

  try {
    const formula = encodeURIComponent(`{Cle} = "${cle}"`);
    const data = await airtableGet(`?filterByFormula=${formula}&maxRecords=1`);
    const rec = (data.records && data.records[0]) || null;

    if (rec) {
      const dernier = Number(rec.fields["Dernier appel (ms)"] || 0);
      const ecart = maintenant - dernier;
      if (ecart < delaiMin * 1000) {
        // trop rapide : on refuse (sans mettre à jour, pour ne pas repousser indéfiniment)
        return false;
      }
      // assez espacé : on met à jour l'horodatage et on autorise
      try { await airtablePatch(rec.id, { "Dernier appel (ms)": maintenant }); } catch (e) {}
      return true;
    }

    // premier appel connu pour cet identifiant : on l'enregistre et on autorise
    try { await airtableCreate({ "Cle": cle, "Dernier appel (ms)": maintenant }); } catch (e) {}
    return true;
  } catch (e) {
    // panne Airtable : on laisse passer (jamais bloquer un usage légitime)
    return true;
  }
}

// Récupère un identifiant d'appelant à partir de la requête : email/token
// fournis dans le corps, sinon l'IP (en dernier recours).
function identifiantAppelant(req, body) {
  const b = body || {};
  if (b.email) return "email:" + b.email;
  if (b.token) return "token:" + b.token;
  if (b.code) return "code:" + b.code;
  const ip = (req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "";
  return "ip:" + String(ip).split(",")[0].trim();
}

module.exports = { verifierCadence, identifiantAppelant };
