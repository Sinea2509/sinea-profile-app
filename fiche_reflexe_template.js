// ============================================================
// api/fiche_reflexe_template.js · Fiche réflexe métier (1 page A4)
//   Le condensé que la personne garde sous les yeux :
//   style dominant, 3 axes avec position et ligne réflexe, plan en 3 axes.
// ============================================================

const FAM_COLORS = { RELATION: "#F98272", ACTION: "#F5A623", STRUCTURE: "#3EADFF", VISION: "#5E59C7" };
const FAM_LABELS = { RELATION: "Relation", ACTION: "Action", STRUCTURE: "Structure", VISION: "Vision" };

const STYLE_LABELS = {
  visionnaire: "Visionnaire", chef_de_file: "Chef de file", democratique: "Démocratique",
  directif: "Directif", coaching: "Coaching", affiliatif: "Affiliatif",
  challenger: "Challenger", relationnel: "Relationnel", battant: "Battant", solitaire: "Indépendant", resolveur: "Résolveur",
};

const AXES = {
  manager: ["delegation", "feedback", "exigence_bienveillance"],
  commercial: ["closing", "objection", "chasseur_eleveur"],
};

const AXE_TITRES = {
  delegation: "Délégation", feedback: "Feedback", exigence_bienveillance: "Exigence et bienveillance",
  closing: "Closing", objection: "Face à l'objection", chasseur_eleveur: "Chasseur ou éleveur",
};

const POSITION_LABELS = {
  delegation: { controle: "Contrôle", cadre: "Cadre clair", autonomie: "Autonomie", lacher_prise: "Lâcher-prise" },
  feedback: { direct: "Direct", factuel: "Factuel", enveloppe: "Enveloppé", questionnant: "Questionnant" },
  exigence_bienveillance: { exigence: "Exigeant", equilibre: "Équilibré", bienveillance: "Bienveillant" },
  closing: { pousseur: "Pousseur", guide: "Guide", patient: "Patient", facilitateur: "Facilitateur" },
  objection: { frontal: "Frontal", recadrage: "Recadrage", contournement: "Contournement", ecoute: "Écoute" },
  chasseur_eleveur: { chasseur: "Chasseur", mixte: "Mixte", eleveur: "Éleveur" },
};

// La ligne réflexe : une consigne à soi, au présent, actionnable telle quelle.
const REFLEXES = {
  delegation: {
    controle: "Je choisis chaque semaine une tâche à confier entièrement, avec un point de contrôle daté.",
    cadre: "Je formule l'objectif et les jalons, puis je laisse le chemin.",
    autonomie: "Je confie la mission entière et je fixe un point de synchronisation régulier.",
    lacher_prise: "Je délègue le résultat et je reste disponible à la demande.",
  },
  feedback: {
    direct: "Je dis le fait, vite, puis j'ouvre sur une question.",
    factuel: "J'appuie chaque retour sur un exemple daté et observable.",
    enveloppe: "Je choisis le moment, et je termine par l'attendu précis.",
    questionnant: "Je fais émerger le constat par mes questions, puis je conclus par un message clair.",
  },
  exigence_bienveillance: {
    exigence: "Je garde la barre haute et je nomme explicitement les efforts.",
    equilibre: "Je tiens l'attente élevée et l'attention aux personnes, ensemble.",
    bienveillance: "Je protège la relation et je chiffre mes attendus.",
  },
  closing: {
    pousseur: "Je pose la question qui engage, puis je laisse respirer.",
    guide: "Je verrouille chaque oui intermédiaire avant d'avancer.",
    patient: "Je pose un jalon daté dès le début du cycle.",
    facilitateur: "Je lève l'obstacle suivant avant qu'il bloque la décision.",
  },
  objection: {
    frontal: "Je reformule d'abord, puis je réponds pied à pied.",
    recadrage: "Je replace l'objection dans l'enjeu global du client.",
    contournement: "Je note le point, je change d'angle, je traite le fond au bon moment.",
    ecoute: "Je creuse la première phrase pour trouver la vraie réserve.",
  },
  chasseur_eleveur: {
    chasseur: "Je bloque mes créneaux de conquête et je passe le relais du suivi.",
    mixte: "Je dédie des plages distinctes à la conquête et à la culture du portefeuille.",
    eleveur: "Je programme le contact régulier qui fait grandir chaque compte.",
  },
};

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// data : { prenom, nom, archetype, famille, diagType, speStyle, speDims, plan, date, fontHtml }
function construireFicheHTML(data) {
  const fam = (data.famille || "").toUpperCase();
  const col = FAM_COLORS[fam] || FAM_COLORS.VISION;
  const metier = data.diagType === "manager" ? "Management" : "Commercial";
  const styleLabel = STYLE_LABELS[data.speStyle] || data.speStyle || "";

  const axes = (AXES[data.diagType] || []).map((a) => {
    const pos = (data.speDims || {})[a];
    if (!pos) return "";
    const label = (POSITION_LABELS[a] || {})[pos] || pos;
    const ligneIA = data.reflexesIA && typeof data.reflexesIA[a] === "string" ? data.reflexesIA[a].trim() : "";
    const reflexe = ligneIA || (REFLEXES[a] || {})[pos] || "";
    return `
      <div class="axe">
        <div class="axe-head"><span class="axe-titre">${esc(AXE_TITRES[a] || a)}</span><span class="axe-pos">${esc(label)}</span></div>
        <p class="axe-reflexe">${esc(reflexe)}</p>
      </div>`;
  }).join("");

  const plan = Array.isArray(data.plan) && data.plan.length
    ? `
      <div class="bloc-titre">Mon plan de progression</div>
      ${data.plan.slice(0, 3).map((p, i) => `
        <div class="plan-item">
          <div class="plan-num">Axe ${i + 1}</div>
          <div class="plan-corps"><div class="plan-titre">${esc(p.titre || "")}</div><p class="plan-desc">${esc(p.desc || "")}</p></div>
        </div>`).join("")}`
    : `<div class="bloc-titre">Mon plan de progression</div><p class="plan-absent">Votre plan personnalisé se construit à la génération de votre analyse complète.</p>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">${data.fontHtml || ""}
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Manrope',sans-serif;color:#1A1A2E;background:#FAF8F3;width:210mm;height:296mm;overflow:hidden;}
  .page{padding:13mm 14mm;height:100%;display:flex;flex-direction:column;}
  .haut{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${col};padding-bottom:6mm;}
  .marque{font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${col};}
  .titre{font-size:25px;font-weight:800;margin-top:2mm;}
  .sous{font-size:11.5px;color:#6A6A80;margin-top:1mm;}
  .qui{text-align:right;}
  .qui-nom{font-size:14px;font-weight:800;}
  .qui-arch{font-size:11px;font-weight:700;color:${col};margin-top:1mm;}
  .qui-date{font-size:9.5px;color:#9A96A8;margin-top:1mm;}
  .style-bloc{margin-top:6mm;background:#fff;border:1px solid #ECE8DF;border-radius:10px;padding:5mm 6mm;display:flex;align-items:center;gap:6mm;}
  .style-lab{font-size:9.5px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#9A96A8;}
  .style-val{font-size:19px;font-weight:800;color:${col};}
  .bloc-titre{font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#9A96A8;margin:6mm 0 3mm;}
  .axe{background:#fff;border:1px solid #ECE8DF;border-radius:10px;padding:4mm 5mm;margin-bottom:2.5mm;}
  .axe-head{display:flex;justify-content:space-between;align-items:center;}
  .axe-titre{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;}
  .axe-pos{font-size:11px;font-weight:800;color:#fff;background:${col};border-radius:99px;padding:1.5mm 4mm;}
  .axe-reflexe{font-size:11.5px;line-height:1.5;color:#3A3A50;margin-top:2mm;font-style:italic;}
  .plan-item{display:flex;gap:4mm;background:#fff;border:1px solid #ECE8DF;border-radius:10px;padding:4mm 5mm;margin-bottom:2.5mm;}
  .plan-num{font-size:9.5px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${col};white-space:nowrap;padding-top:0.7mm;}
  .plan-titre{font-size:11.5px;font-weight:800;}
  .plan-desc{font-size:9.8px;line-height:1.5;color:#4A4A60;margin-top:1.2mm;}
  .plan-absent{font-size:10.5px;color:#6A6A80;font-style:italic;}
  .pied{margin-top:auto;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E4E0D6;padding-top:3mm;}
  .pied p{font-size:8.5px;color:#9A96A8;}
</style></head>
<body><div class="page">
  <div class="haut">
    <div>
      <div class="marque">Sinéa Profile · Fiche réflexe</div>
      <div class="titre">Mon réflexe ${esc(metier.toLowerCase())}</div>
      <div class="sous">L'essentiel de votre profil, à garder sous les yeux.</div>
    </div>
    <div class="qui">
      <div class="qui-nom">${esc((data.prenom || "") + " " + (data.nom || "")).trim()}</div>
      <div class="qui-arch">${esc(data.archetype || "")} · ${esc(FAM_LABELS[fam] || fam)}</div>
      <div class="qui-date">${esc(data.date || "")}</div>
    </div>
  </div>
  <div class="style-bloc"><span class="style-lab">Mon style dominant</span><span class="style-val">${esc(styleLabel)}</span></div>
  <div class="bloc-titre">Mes trois réflexes</div>
  ${axes}
  ${plan}
  <div class="pied"><p>Cet éclairage nourrit la réflexion et le dialogue. La décision finale reste humaine.</p><p>sineaformation.fr</p></div>
</div></body></html>`;
}

module.exports = { construireFicheHTML };
