// ============================================================
// api/auth.js — Connexion sécurisée par code à 6 chiffres envoyé par email (Brevo)
// POST { action:"send_code", email }       → génère + envoie le code
// POST { action:"verify_code", email, code } → vérifie le code
// ============================================================

const { appliquerCors } = require("./_cors");
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const TABLE = "Répondants";

// Expéditeur de l'email (à adapter si besoin via variables d'env)
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "contact@sineaformation.fr";
const SENDER_NAME = process.env.BREVO_SENDER_NAME || "Sinéa Profile";

const DUREE_VALIDITE_MIN = 10; // le code expire après 10 minutes

async function findByEmail(email) {
  const formula = encodeURIComponent(`LOWER({Email}) = "${champFormule(email).toLowerCase()}"`);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE)}?filterByFormula=${formula}&maxRecords=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
  if (!res.ok) throw new Error(`Airtable lecture ${res.status}`);
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

async function envoyerCodeParEmail(email, prenom, code) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email: email, name: prenom || email }],
      subject: "Votre code de connexion Sinéa Profile",
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#5E59C7;">Votre code de connexion</h2>
          <p>Bonjour${prenom ? " " + prenom : ""},</p>
          <p>Voici votre code pour accéder à votre espace Sinéa Profile :</p>
          <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1A1A1A;background:#F4F1EC;padding:18px;text-align:center;border-radius:12px;margin:20px 0;">${code}</div>
          <p style="color:#747474;font-size:14px;">Ce code est valable ${DUREE_VALIDITE_MIN} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
          <p style="color:#747474;font-size:13px;margin-top:24px;">Sinéa Profile</p>
        </div>`,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!AIRTABLE_BASE || !AIRTABLE_TOKEN) return res.status(500).json({ error: "Configuration Airtable manquante" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action, email } = body || {};
    if (!email) return res.status(400).json({ error: "Email manquant" });
    const emailLower = email.toLowerCase().trim();

    // ---- SEND_CODE : générer et envoyer le code ----
    if (action === "send_code") {
      if (!BREVO_API_KEY) return res.status(500).json({ error: "Configuration email manquante" });
      const existing = await findByEmail(emailLower);
      // La connexion est réservée à ceux qui ont déjà un compte (au moins une analyse ou une progression).
      const aUnCompte = existing && (
        (existing.fields["Analyses (JSON)"] && existing.fields["Analyses (JSON)"] !== "{}") ||
        (existing.fields["Progression (JSON)"] && existing.fields["Progression (JSON)"] !== "{}")
      );
      if (!aUnCompte) {
        return res.status(200).json({ ok: false, no_account: true, error: "Aucun compte n'est associé à cet email. Commencez par passer le test." });
      }
      // générer un code à 6 chiffres
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiration = Date.now() + DUREE_VALIDITE_MIN * 60 * 1000;
      const fields = {
        "Code connexion": code,
        "Code expiration": String(expiration),
      };
      const prenom = existing.fields["Prénom"] || "";
      await updateRecord(existing.id, fields);
      // envoyer par email
      await envoyerCodeParEmail(emailLower, prenom, code);
      return res.status(200).json({ ok: true, message: "Code envoyé" });
    }

    // ---- VERIFY_CODE : vérifier le code saisi ----
    if (action === "verify_code") {
      const { code } = body;
      if (!code) return res.status(400).json({ error: "Code manquant" });
      const existing = await findByEmail(emailLower);
      if (!existing) return res.status(200).json({ ok: false, error: "Aucun compte trouvé" });
      const codeStocke = existing.fields["Code connexion"] || "";
      const expiration = parseInt(existing.fields["Code expiration"] || "0", 10);
      if (!codeStocke || String(code).trim() !== String(codeStocke).trim()) {
        return res.status(200).json({ ok: false, error: "Code incorrect" });
      }
      if (Date.now() > expiration) {
        return res.status(200).json({ ok: false, error: "Code expiré" });
      }
      // code valide : on l'efface (usage unique) et on renvoie OK
      await updateRecord(existing.id, { "Code connexion": "", "Code expiration": "" });
      return res.status(200).json({ ok: true, prenom: existing.fields["Prénom"] || "" });
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};


// ---- sécurité : neutralise guillemets et antislashs avant interpolation dans une formule Airtable ----
function champFormule(v) {
  return String(v == null ? "" : v).replace(/[\\"]/g, "");
}
