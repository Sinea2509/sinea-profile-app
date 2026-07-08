// ============================================================
// pdf_portrait_template.js — Portrait individuel Sinéa Profile (PDF premium)
// Module pur : construirePortraitHTML(profil, contenuIA, opts) → HTML A4 print
//   profil     : l'objet profil stocké (dominante, scoresBigFive, contextuel, ...)
//   contenuIA  : les sections générées par l'IA au moment du test ({ouverture, bigfive, dim_stress, ...})
//   opts       : { prenom, nom, date, fontHtml, patternUrl, ficheArchetype, rarete, labelsContextuels }
// Aucune dépendance. Utilisable par l'endpoint backend et par les scripts locaux.
// ============================================================

const FAM_COLORS = { RELATION: "#F98272", ACTION: "#F5A623", STRUCTURE: "#3EADFF", VISION: "#5E59C7" };
const FAM_LABELS = { RELATION: "Relation", ACTION: "Action", STRUCTURE: "Structure", VISION: "Vision" };

const BF_LABELS = {
  E: { titre: "Énergie sociale", bas: "Réservé, économe en interactions", haut: "Expansif, nourri par le contact" },
  A: { titre: "Chaleur coopérative", bas: "Direct, orienté débat", haut: "Conciliant, orienté harmonie" },
  C: { titre: "Rigueur et structure", bas: "Spontané, flexible", haut: "Organisé, fiable" },
  N: { titre: "Sensibilité émotionnelle", bas: "Stable, imperturbable", haut: "Réactif, vit les enjeux intensément" },
  O: { titre: "Ouverture", bas: "Pragmatique, ancré dans l'éprouvé", haut: "Curieux, attiré par le nouveau" },
};

const REGISTRES = {
  stress: { titre: "Face au stress", profils: { accelerateur: "Accélérateur", methodique: "Méthodique", retrait: "En retrait", appui: "Cherche appui" } },
  motivation: { titre: "Ce qui vous motive", profils: { accomplissement: "Accomplissement", reconnaissance: "Reconnaissance", sens: "Quête de sens", maitrise: "Maîtrise" } },
  risque: { titre: "Face au risque", profils: { audacieux: "Audacieux", calcule: "Calculé", prudent: "Prudent", securitaire: "Sécuritaire" } },
  changement: { titre: "Face au changement", profils: { moteur: "Moteur", adaptable: "Adaptable", pragmatique: "Pragmatique", ancre: "Ancré" } },
  conflit: { titre: "Face au conflit", profils: { affrontement: "Direct", mediation: "Médiateur", compromis: "Compromis", evitement: "Évitant" } },
};

const PILOTAGE = {
  energie: { titre: "Énergie et rythme", modele: "Modèle SMART", profils: { sprinteur: "Sprinteur", endurant: "Endurant", cyclique: "Cyclique", deepworker: "Deep-worker" } },
  collaboration: { titre: "Collaboration", modele: "Modèle SMART", profils: { autonome: "Autonome", cooperatif: "Coopératif", interdependant: "Interdépendant", federateur: "Fédérateur" } },
  autorite: { titre: "Rapport au cadre", modele: "Self-Determination Theory", profils: { cadre: "Besoin de cadre", sens: "Besoin de sens", liberte: "Besoin de liberté", contributeur: "Contributeur" } },
  reconnaissance: { titre: "Reconnaissance", modele: "Self-Determination Theory", profils: { resultats: "Résultats", effort: "Effort", relation: "Relation", autonomie: "Autonomie" } },
};

const PILOTAGE_FALLBACK = {
  energie: { sprinteur: "Votre énergie fonctionne par pics. Vous donnez le meilleur sur des séquences courtes et intenses, puis vous avez besoin de relâcher pour recharger. Protégez de vrais temps de récupération après vos sprints.", endurant: "Votre énergie est régulière et fiable. Vous tenez un effort constant dans la durée, ce qui fait de vous un point d'appui sur les projets longs. Votre rythme est une force.", cyclique: "Votre énergie alterne phases intenses et phases de récupération. Bien gérée, cette alternance vous protège de l'épuisement tout en délivrant de forts moments. Expliquez ce fonctionnement à votre entourage.", deepworker: "Vous performez dans la concentration longue et ininterrompue. Le morcellement est votre principal adversaire. Protégez vos plages de concentration comme une ressource précieuse." },
  collaboration: { autonome: "Vous donnez le meilleur en pilotant votre périmètre de façon indépendante. La clarté de votre responsabilité est votre carburant. Maintenez des points de synchronisation pour rester connecté au collectif.", cooperatif: "Vous avancez mieux dans l'échange et le faire-ensemble. Cette ouverture est un liant pour l'équipe. Préservez aussi des temps de production individuelle.", interdependant: "Vous articulez naturellement votre travail avec celui des autres. Cette vision systémique fluidifie les projets transverses et évite les silos.", federateur: "Vous tirez votre énergie de l'animation du collectif. Ce rôle moteur est précieux pour la dynamique d'équipe. Laissez de la place aux autres pour contribuer." },
  autorite: { cadre: "Vous avancez mieux avec des règles et des attentes claires. Cette structure est un repère qui vous libère. Quand le cadre manque, demandez-le explicitement.", sens: "Vous adhérez quand la direction est justifiée et porteuse de sens. Comprendre le pourquoi transforme une consigne en engagement.", liberte: "Vous donnez le meilleur avec une large marge de manœuvre. La confiance et l'autonomie sont vos carburants. Donnez de la visibilité pour que votre liberté repose sur la confiance.", contributeur: "Vous cherchez à influencer les décisions qui vous concernent. Être associé est essentiel à votre engagement. Choisissez vos combats pour renforcer votre voix." },
  reconnaissance: { resultats: "Vous avez besoin que vos résultats soient vus et nommés. Pour rester engagé, vos réussites doivent être explicitement soulignées.", effort: "Vous avez besoin que l'investissement, et pas seulement le résultat, soit reconnu. Un regard attentif au chemin parcouru nourrit votre engagement.", relation: "Vous vous nourrissez de la qualité du lien et de la considération. Une attention sincère vaut pour vous plus qu'une récompense formelle.", autonomie: "Pour vous, la plus belle reconnaissance est la confiance accordée : plus d'autonomie, plus de responsabilités." },
};

// ---------- utilitaires ----------
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// markdown très léger des sections IA : **gras**, doubles sauts de ligne = paragraphes
function paras(texte) {
  if (!texte) return "";
  const safe = esc(texte).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  return safe.split(/\n\s*\n/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

function barre(label, val, couleur, sousBas, sousHaut) {
  const v = Math.max(0, Math.min(100, Math.round(val)));
  return `
  <div class="bf-row keep">
    <div class="bf-head"><span class="bf-lab">${esc(label)}</span><span class="bf-val" style="color:${couleur}">${v}</span></div>
    <div class="bf-track"><div class="bf-fill" style="width:${v}%;background:${couleur}"></div></div>
    <div class="bf-poles"><span>${esc(sousBas || "")}</span><span>${esc(sousHaut || "")}</span></div>
  </div>`;
}

function doubleBarre(label, vNat, vAda, couleur) {
  const n = Math.max(0, Math.min(100, Math.round(vNat)));
  const a = Math.max(0, Math.min(100, Math.round(vAda)));
  return `
  <div class="nb-row keep">
    <div class="nb-lab">${esc(label)}</div>
    <div class="nb-bars">
      <div class="nb-line"><span class="nb-tag">Naturel</span><div class="nb-track"><div class="nb-fill" style="width:${n}%;background:${couleur}"></div></div><span class="nb-num">${n}</span></div>
      <div class="nb-line"><span class="nb-tag">Au travail</span><div class="nb-track"><div class="nb-fill nb-ada" style="width:${a}%;background:${couleur}"></div></div><span class="nb-num">${a}</span></div>
    </div>
  </div>`;
}

function pastilles(profilsMap, choisi, couleur) {
  return `<div class="pills">` + Object.entries(profilsMap).map(([k, lab]) =>
    `<span class="pill ${k === choisi ? "pill-on" : ""}" ${k === choisi ? `style="background:${couleur};border-color:${couleur}"` : ""}>${esc(lab)}</span>`
  ).join("") + `</div>`;
}

function radarSvg(radar, couleur) {
  // losange 4 axes : RELATION (haut), ACTION (droite), STRUCTURE (bas), VISION (gauche)
  const cx = 125, cy = 102, R = 74;
  const pt = (val, angle) => {
    const r = R * (Math.max(8, Math.min(100, val)) / 100);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };
  const A = { RELATION: -Math.PI / 2, ACTION: 0, STRUCTURE: Math.PI / 2, VISION: Math.PI };
  const pts = ["RELATION", "ACTION", "STRUCTURE", "VISION"].map((f) => pt(radar[f] || 0, A[f]).join(",")).join(" ");
  const grid = [0.33, 0.66, 1].map((k) =>
    `<polygon points="${["RELATION", "ACTION", "STRUCTURE", "VISION"].map((f) => pt(100 * k, A[f]).join(",")).join(" ")}" fill="none" stroke="#E7E3F2" stroke-width="1"/>`
  ).join("");
  const lab = (f, dx, dy, anchor) => {
    const [x, y] = pt(118, A[f]);
    return `<text x="${x + dx}" y="${y + dy}" text-anchor="${anchor}" font-size="10.5" font-weight="800" fill="${FAM_COLORS[f]}">${FAM_LABELS[f].toUpperCase()}</text>`;
  };
  return `<svg viewBox="0 0 250 206" class="radar">
    ${grid}
    <polygon points="${pts}" fill="${couleur}22" stroke="${couleur}" stroke-width="2.5" stroke-linejoin="round"/>
    ${lab("RELATION", 0, -2, "middle")}${lab("ACTION", 4, 4, "start")}${lab("STRUCTURE", 0, 12, "middle")}${lab("VISION", -4, 4, "end")}
  </svg>`;
}

function badgeFiab(fiab) {
  if (!fiab || fiab.score === undefined) return "";
  const c = fiab.score >= 85 ? "#3EAD8B" : (fiab.score >= 70 ? "#E08A3C" : "#E0635C");
  return `
  <div class="fiab keep" style="border-color:${c}55;background:${c}0e">
    <div><div class="fiab-lab" style="color:${c}">Fiabilité de votre profil</div><div class="fiab-msg">${esc(fiab.message || "")}</div></div>
    <div class="fiab-score" style="color:${c}">${esc(fiab.score)}%</div>
  </div>`;
}

// ---------- générateur principal ----------
function construirePortraitHTML(profil, contenuIA, opts) {
  const p = profil || {};
  const c = contenuIA || {};
  const o = opts || {};
  const fiche = o.ficheArchetype || {};
  const dom = p.dominante || {};
  const fam = (dom.famille || "STRUCTURE").toUpperCase();
  const couleur = FAM_COLORS[fam] || "#5474F5";
  const bf = p.scoresBigFive || {};
  const personne = [o.prenom, o.nom].filter(Boolean).join(" ") || "";
  const dateStr = o.date || new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const patternUrl = o.patternUrl || "";
  const lblCtx = o.labelsContextuels || {}; // { stress: {description_profils:{...}}, ... }

  // blend : tableau trié
  const blend = Object.entries(p.blend || {}).sort((a, b) => b[1] - a[1]);

  // ---------- sections ----------
  const couverture = `
  <section class="cover">
    <div class="cover-halo"></div>
    ${patternUrl ? `<div class="cover-pattern" style="background-image:url('${patternUrl}')"></div>` : ""}
    <div class="cover-in">
      <div class="cover-brand">SINÉA&nbsp;PROFILE</div>
      <div class="cover-mid">
        <div class="cover-fam" style="background:${couleur}">${FAM_LABELS[fam]}</div>
        <h1 class="cover-title">${esc(dom.nom || "")}</h1>
        <div class="cover-essence">${esc(fiche.essence || "")}</div>
      </div>
      <div class="cover-foot">
        <div class="cover-line"></div>
        <div class="cover-person">${esc(personne)}</div>
        <div class="cover-date">Portrait individuel · ${esc(dateStr)}</div>
      </div>
    </div>
  </section>`;

  const methode = `
  <section class="chap">
    <div class="kicker" style="color:${couleur}">La méthode</div>
    <h2>Comment lire ce portrait</h2>
    <p class="lead">Ce portrait repose sur le <b>Big Five</b>, le modèle de personnalité le plus validé par la recherche, affiné par le questionnaire propriétaire Sinéa. Vos réponses dessinent un profil en <b>dimensions continues</b>, puis le rapprochent de l'un de nos <b>20 archétypes</b> répartis en 4 familles. Une personne réelle ne tient jamais dans une seule case : votre portrait assume les nuances.</p>
    ${badgeFiab(p.fiabilite)}
    <div class="grid2">
      <div class="card keep"><div class="card-t" style="color:${couleur}">Ce que vous allez découvrir</div><p>Votre archétype et sa composition, votre tempérament en cinq dimensions, l'écart entre votre naturel et votre comportement au travail, vos registres profonds, vos dimensions de pilotage, vos forces, et un mode d'emploi concret pour travailler avec vous.</p></div>
      <div class="card keep"><div class="card-t" style="color:${couleur}">Comment l'utiliser</div><p>Ce document sert votre développement et la qualité de vos collaborations. Partagez les pages « mode d'emploi » avec votre manager et votre équipe : elles disent comment obtenir le meilleur de vous.</p></div>
    </div>
  </section>`;

  const rarete = o.rarete && o.rarete.pct ? `<div class="rarete keep">Profil partagé par <b>${esc(o.rarete.pct)}%</b> des répondants · ${esc(o.rarete.niveau || "")}</div>` : "";
  const archetype = `
  <section class="chap">
    <div class="kicker" style="color:${couleur}">Votre archétype</div>
    <h2>${esc(dom.nom || "")} <span class="h2-fam" style="color:${couleur}">· famille ${FAM_LABELS[fam]}</span></h2>
    ${c.ouverture ? `<div class="ia">${paras(c.ouverture)}</div>` : `<p class="lead">${esc(fiche.essence || "")}</p><p>${esc(fiche.moteur || "")}</p>`}
    ${rarete}
    <div class="card keep">
      <div class="card-t" style="color:${couleur}">Votre composition</div>
      <p class="muted">Votre profil mélange plusieurs archétypes. Voici les trois qui vous composent.</p>
      ${blend.map(([nom, pct], i) => `
        <div class="blend-row"><span class="blend-nom">${i === 0 ? "★ " : ""}${esc(nom)}</span><div class="blend-track"><div class="blend-fill" style="width:${pct}%;background:${i === 0 ? couleur : "#C9C3DD"}"></div></div><span class="blend-pct">${pct}%</span></div>`).join("")}
    </div>
    ${c.alchimie ? `<div class="ia">${paras(c.alchimie)}</div>` : ""}
  </section>`;

  const stabilite = 100 - (Number(bf.N) || 50);
  const temperament = `
  <section class="chap">
    <div class="kicker" style="color:${couleur}">Votre tempérament</div>
    <h2>Cinq dimensions, un profil</h2>
    <div class="grid-bf">
      <div>
        ${barre(BF_LABELS.E.titre, bf.E, couleur, BF_LABELS.E.bas, BF_LABELS.E.haut)}
        ${barre(BF_LABELS.A.titre, bf.A, couleur, BF_LABELS.A.bas, BF_LABELS.A.haut)}
        ${barre(BF_LABELS.C.titre, bf.C, couleur, BF_LABELS.C.bas, BF_LABELS.C.haut)}
        ${barre("Stabilité émotionnelle", stabilite, couleur, "Réactif, vit les enjeux intensément", "Stable, imperturbable")}
        ${barre(BF_LABELS.O.titre, bf.O, couleur, BF_LABELS.O.bas, BF_LABELS.O.haut)}
      </div>
      <div class="radar-side keep">
        <div class="card-t" style="color:${couleur};text-align:center">Vos quatre familles</div>
        ${radarSvg(p.radarFamilles || {}, couleur)}
        <p class="muted" style="text-align:center">L'empreinte de votre énergie sur les quatre familles Sinéa.</p>
      </div>
    </div>
    ${c.bigfive ? `<div class="ia">${paras(c.bigfive)}</div>` : ""}
  </section>`;

  const na = p.naturelAdapte || null;
  const coutCouleur = na && na.cout === "élevé" ? "#E0635C" : (na && na.cout === "modéré" ? "#E08A3C" : "#3EAD8B");
  const naturelAdapte = !na ? "" : `
  <section class="chap">
    <div class="kicker" style="color:${couleur}">Naturel et adaptation</div>
    <h2>Qui vous êtes, qui vous montrez</h2>
    <p class="lead">Chacun ajuste son comportement au travail. Cet écart entre votre <b>tempérament naturel</b> et votre <b>comportement professionnel</b> a un coût en énergie : le connaître, c'est savoir où récupérer.</p>
    <div class="cout keep" style="border-color:${coutCouleur}55;background:${coutCouleur}0d">
      <div><div class="fiab-lab" style="color:${coutCouleur}">Coût d'adaptation : ${esc(na.cout || "")}</div>
      <div class="fiab-msg">${na.cout === "élevé" ? "Votre rôle vous demande de jouer loin de votre naturel. Cette plasticité est une compétence, et elle consomme : protégez des temps où vous fonctionnez « en naturel »." : na.cout === "modéré" ? "Vous ajustez votre posture au travail dans une mesure raisonnable. Restez attentif aux périodes où l'écart se creuse." : "Votre rôle vous permet de fonctionner proche de votre naturel : une configuration durable et économe en énergie."}</div></div>
      <div class="fiab-score" style="color:${coutCouleur}">${esc(Math.round(na.moyenneEcart || 0))}</div>
    </div>
    ${doubleBarre(BF_LABELS.E.titre, na.naturel?.E, na.adapte?.E, couleur)}
    ${doubleBarre(BF_LABELS.A.titre, na.naturel?.A, na.adapte?.A, couleur)}
    ${doubleBarre(BF_LABELS.C.titre, na.naturel?.C, na.adapte?.C, couleur)}
    ${doubleBarre("Stabilité émotionnelle", 100 - (na.naturel?.N ?? 50), 100 - (na.adapte?.N ?? 50), couleur)}
    ${doubleBarre(BF_LABELS.O.titre, na.naturel?.O, na.adapte?.O, couleur)}
  </section>`;

  const ctx = p.contextuel || {};
  const registres = !Object.keys(ctx).length ? "" : `
  <section class="chap">
    <div class="kicker" style="color:${couleur}">Vos registres profonds</div>
    <h2>Comment vous réagissez</h2>
    <p class="lead">Cinq registres mesurés en situation : ils décrivent vos réflexes quand le contexte se tend ou se transforme.</p>
    ${Object.entries(REGISTRES).map(([dim, conf]) => {
      const choisi = ctx[dim];
      if (!choisi) return "";
      const desc = lblCtx[dim]?.description_profils?.[choisi] || "";
      const ia = c["dim_" + dim];
      return `<div class="reg keep">
        <div class="reg-head"><span class="reg-t">${esc(conf.titre)}</span>${pastilles(conf.profils, choisi, couleur)}</div>
        ${ia ? `<div class="ia ia-tight">${paras(ia)}</div>` : `<p class="reg-desc">${esc(desc)}</p>`}
      </div>`;
    }).join("")}
  </section>`;

  const cp = p.contextuelPlus || {};
  const pilotage = !Object.keys(cp).length ? "" : `
  <section class="chap">
    <div class="kicker" style="color:${couleur}">Vos dimensions de pilotage</div>
    <h2>Comment travailler avec vous</h2>
    <p class="lead">Quatre dimensions fondées sur la <b>Self-Determination Theory</b> et le <b>modèle SMART</b> : votre rythme, votre mode de collaboration, votre rapport au cadre et ce qui nourrit votre engagement. Ce sont les clés de votre pilotage au quotidien.</p>
    ${Object.entries(PILOTAGE).map(([dim, conf]) => {
      const choisi = cp[dim];
      if (!choisi) return "";
      const ia = c["dim_" + dim];
      const fallback = (PILOTAGE_FALLBACK[dim] || {})[choisi] || "";
      return `<div class="reg keep">
        <div class="reg-head"><span class="reg-t">${esc(conf.titre)} <span class="reg-mod">${esc(conf.modele)}</span></span>${pastilles(conf.profils, choisi, couleur)}</div>
        <div class="ia ia-tight">${ia ? paras(ia) : `<p>${esc(fallback)}</p>`}</div>
      </div>`;
    }).join("")}
  </section>`;

  const forces = Array.isArray(fiche.forces) ? fiche.forces : [];
  const vigil = Array.isArray(fiche.vigilance) ? fiche.vigilance : (fiche.vigilance ? [fiche.vigilance] : []);
  const forcesAngles = `
  <section class="chap">
    <div class="kicker" style="color:${couleur}">Forces et vigilance</div>
    <h2>Ce qui fait votre valeur</h2>
    <div class="grid2">
      <div class="card keep"><div class="card-t" style="color:${couleur}">Vos forces</div>
        ${forces.map((f) => `<div class="li"><span class="li-dot" style="background:${couleur}"></span><span>${esc(f)}</span></div>`).join("")}
      </div>
      <div class="card keep"><div class="card-t" style="color:#8A82B8">Vos points de vigilance</div>
        ${vigil.map((f) => `<div class="li"><span class="li-dot" style="background:#C9C3DD"></span><span>${esc(f)}</span></div>`).join("")}
      </div>
    </div>
    ${c.angles ? `<div class="ia">${paras(c.angles)}</div>` : ""}
    ${c.situation ? `<div class="card keep"><div class="card-t" style="color:${couleur}">Vous, en situation</div><div class="ia ia-tight">${paras(c.situation)}</div></div>`
      : (fiche.en_situation ? `<div class="card keep"><div class="card-t" style="color:${couleur}">Vous, en situation</div>
        ${["reunion", "conflit", "pression"].map((k) => fiche.en_situation[k] ? `<div class="li"><span class="li-dot" style="background:${couleur}"></span><span>${esc(fiche.en_situation[k])}</span></div>` : "").join("")}</div>` : "")}
  </section>`;

  const comp = fiche.complementarites || {};
  const modeEmploi = `
  <section class="chap">
    <div class="kicker" style="color:${couleur}">Mode d'emploi</div>
    <h2>Pour ceux qui travaillent avec vous</h2>
    <p class="lead">Cette page se partage : à votre manager, à vos collègues. Elle dit comment obtenir le meilleur de votre profil.</p>
    <div class="grid2">
      <div class="card keep"><div class="card-t" style="color:${couleur}">Vos leviers</div>
        ${(fiche.leviers || []).map((l) => `<div class="li"><span class="li-dot" style="background:${couleur}"></span><span>${esc(l)}</span></div>`).join("")}
        ${cp.autorite ? `<div class="li"><span class="li-dot" style="background:${couleur}"></span><span>${esc((PILOTAGE_FALLBACK.autorite[cp.autorite] || "").split(".")[0])}.</span></div>` : ""}
        ${cp.reconnaissance ? `<div class="li"><span class="li-dot" style="background:${couleur}"></span><span>${esc((PILOTAGE_FALLBACK.reconnaissance[cp.reconnaissance] || "").split(".")[0])}.</span></div>` : ""}
      </div>
      <div class="card keep"><div class="card-t" style="color:${couleur}">Vos complémentarités</div>
        ${comp.matche ? `<div class="li"><span class="li-dot" style="background:#3EAD8B"></span><span><b>Vous matchez avec :</b> ${esc((comp.matche || []).join(", "))}. ${esc(comp.pourquoi_matche || "")}</span></div>` : ""}
        ${comp.friction ? `<div class="li"><span class="li-dot" style="background:#E0635C"></span><span><b>Friction possible avec :</b> ${esc((comp.friction || []).join(", "))}. ${esc(comp.pourquoi_friction || "")}</span></div>` : ""}
      </div>
    </div>
    ${c.actions ? `<div class="card keep"><div class="card-t" style="color:${couleur}">Vos prochains pas</div><div class="ia ia-tight">${paras(c.actions)}</div></div>` : ""}
    <div class="outro keep">
      <div class="outro-line"></div>
      <p><b>Et maintenant ?</b> Un profil prend sa valeur dans l'action. La méthode Sinéa relie ce diagnostic à des micro-défis comportementaux de 90 jours via SeedUp, pour ancrer durablement ce que ce portrait révèle.</p>
      <div class="outro-brand">SINÉA PROFILE · sineaformation.fr</div>
    </div>
  </section>`;

  // ---------- document ----------
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
${o.fontHtml || ""}
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { font-family: 'Manrope', sans-serif; color: #1A1A2E; font-size: 10.6pt; line-height: 1.52; }

  /* ----- couverture ----- */
  .cover { position: relative; width: 210mm; height: 297mm; background: #0F1232; overflow: hidden; page-break-after: always; z-index: 5; }
  .cover-halo { position: absolute; inset: 0; background: radial-gradient(circle at 50% 38%, #FF7D64 0%, #6E3D82 46%, #0F1232 78%); opacity: 0.9; }
  .cover-pattern { position: absolute; inset: 0; background-size: 300px; opacity: 0.16; mix-blend-mode: overlay; }
  .cover-in { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 22mm 20mm; color: #fff; }
  .cover-brand { font-size: 12px; font-weight: 800; letter-spacing: 0.35em; opacity: 0.92; }
  .cover-mid { text-align: center; margin-top: -10mm; }
  .cover-fam { display: inline-block; padding: 6px 18px; border-radius: 99px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 9mm; }
  .cover-title { font-size: 46pt; font-weight: 800; letter-spacing: -0.01em; line-height: 1.05; }
  .cover-essence { margin-top: 7mm; font-size: 13pt; font-style: italic; opacity: 0.9; max-width: 130mm; margin-left: auto; margin-right: auto; line-height: 1.5; }
  .cover-foot { text-align: center; }
  .cover-line { height: 3px; width: 60mm; margin: 0 auto 6mm; border-radius: 3px; background: linear-gradient(90deg,#F98272,#F9A876,#E290EC,#3EADFF); }
  .cover-person { font-size: 15pt; font-weight: 800; }
  .cover-date { font-size: 10pt; opacity: 0.75; margin-top: 2mm; }

  /* ----- flux ----- */
  .chap { page-break-before: always; padding: 17mm 17mm 20mm; }
  .kicker { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: 3mm; }
  h2 { font-size: 21pt; font-weight: 800; letter-spacing: -0.01em; margin-bottom: 5mm; }
  .h2-fam { font-size: 12pt; font-weight: 800; }
  .lead { font-size: 11.2pt; margin-bottom: 5mm; color: #2A2A40; }
  p { margin-bottom: 3mm; }
  b { font-weight: 800; }
  .muted { color: #76709A; font-size: 9.6pt; }
  .keep { page-break-inside: avoid; }

  .card { background: #FAF9F6; border: 1px solid #ECE8F4; border-radius: 14px; padding: 6mm 6mm 5mm; margin-bottom: 5mm; }
  .card-t { font-size: 10px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 3mm; }
  .grid2 { display: flex; gap: 5mm; } .grid2 > * { flex: 1; }
  .ia { background: #fff; border: 1px solid #ECE8F4; border-left: 3.5px solid #C9C3DD; border-radius: 10px; padding: 4.4mm 5.5mm; margin: 3.5mm 0 4.5mm; }
  .ia p { margin-bottom: 2.6mm; } .ia p:last-child { margin-bottom: 0; }
  .ia-tight { margin: 2.5mm 0 0; }

  .fiab, .cout { display: flex; justify-content: space-between; align-items: center; gap: 8mm; border: 1.5px solid; border-radius: 13px; padding: 5mm 6mm; margin: 5mm 0; }
  .fiab-lab { font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 1.5mm; }
  .fiab-msg { font-size: 9.8pt; color: #444; }
  .fiab-score { font-size: 24pt; font-weight: 800; }

  .blend-row { display: flex; align-items: center; gap: 4mm; margin-bottom: 3mm; }
  .blend-nom { width: 42mm; font-weight: 800; font-size: 10pt; }
  .blend-track { flex: 1; height: 9px; background: #EFECF6; border-radius: 99px; overflow: hidden; }
  .blend-fill { height: 100%; border-radius: 99px; }
  .blend-pct { width: 12mm; text-align: right; font-weight: 800; }
  .rarete { font-size: 9.8pt; color: #76709A; margin-bottom: 5mm; }

  .grid-bf { display: flex; gap: 7mm; align-items: flex-start; }
  .grid-bf > div:first-child { flex: 1.35; } .radar-side { flex: 1; background: #FAF9F6; border: 1px solid #ECE8F4; border-radius: 14px; padding: 5mm; }
  .radar { width: 100%; height: auto; }
  .bf-row { margin-bottom: 5mm; }
  .bf-head { display: flex; justify-content: space-between; font-weight: 800; font-size: 10.4pt; margin-bottom: 1.6mm; }
  .bf-track { height: 9px; background: #EFECF6; border-radius: 99px; overflow: hidden; }
  .bf-fill { height: 100%; border-radius: 99px; }
  .bf-poles { display: flex; justify-content: space-between; font-size: 8pt; color: #9A93BC; margin-top: 1.2mm; }

  .nb-row { display: flex; gap: 5mm; align-items: center; margin-bottom: 4.5mm; }
  .nb-lab { width: 40mm; font-weight: 800; font-size: 9.8pt; }
  .nb-bars { flex: 1; }
  .nb-line { display: flex; align-items: center; gap: 3mm; margin-bottom: 1.6mm; }
  .nb-tag { width: 18mm; font-size: 8pt; font-weight: 700; color: #9A93BC; }
  .nb-track { flex: 1; height: 7px; background: #EFECF6; border-radius: 99px; overflow: hidden; }
  .nb-fill { height: 100%; border-radius: 99px; } .nb-ada { opacity: 0.55; }
  .nb-num { width: 8mm; text-align: right; font-size: 8.6pt; font-weight: 800; }

  .reg { border: 1px solid #ECE8F4; border-radius: 13px; padding: 4.2mm 5.5mm; margin-bottom: 3.6mm; background: #fff; }
  .reg-head { display: flex; justify-content: space-between; align-items: center; gap: 5mm; flex-wrap: wrap; }
  .reg-t { font-weight: 800; font-size: 11pt; }
  .reg-mod { font-size: 8pt; font-weight: 600; font-style: italic; color: #9A93BC; margin-left: 2mm; }
  .reg-desc { margin-top: 2.5mm; color: #2A2A40; }
  .pills { display: flex; gap: 2mm; flex-wrap: wrap; }
  .pill { font-size: 8.4pt; font-weight: 700; padding: 1.6mm 3.4mm; border-radius: 99px; border: 1px solid #E4E0F0; color: #9A93BC; background: #FAF9F6; }
  .pill-on { color: #fff; }

  .li { display: flex; gap: 3mm; align-items: flex-start; margin-bottom: 2.6mm; font-size: 10pt; }
  .li-dot { width: 6px; height: 6px; border-radius: 99px; margin-top: 2.2mm; flex-shrink: 0; }

  .outro { margin-top: 8mm; text-align: center; }
  .outro-line { height: 3px; width: 52mm; margin: 0 auto 5mm; border-radius: 3px; background: linear-gradient(90deg,#F98272,#F9A876,#E290EC,#3EADFF); }
  .outro p { max-width: 130mm; margin: 0 auto 4mm; }
  .outro-brand { font-size: 9px; font-weight: 800; letter-spacing: 0.3em; color: #9A93BC; }

  .pdf-footer { position: fixed; bottom: 7mm; left: 17mm; right: 17mm; display: flex; justify-content: space-between; font-size: 7.6pt; font-weight: 700; letter-spacing: 0.08em; color: #B5AFD0; z-index: 1; }

/* ---- anti-coupures : aucun bloc scié entre deux pages ---- */
h1,h2,h3,h4{break-after:avoid;page-break-after:avoid;}
p,li{orphans:3;widows:3;}
.keep,.card,.bloc,.item,.pair,.reg,.dim,.pilot,.force,.dyn-card,.rk-row,.me-bloc,.swot-cell,.spectre-row,.dimc-card,.action,.chip,table,blockquote{break-inside:avoid;page-break-inside:avoid;}
</style></head>
<body>
  <div class="pdf-footer"><span>SINÉA PROFILE</span><span>${esc(personne)} · Document confidentiel</span></div>
  ${couverture}
  ${methode}
  ${archetype}
  ${temperament}
  ${naturelAdapte}
  ${registres}
  ${pilotage}
  ${forcesAngles}
  ${modeEmploi}
</body></html>`;
}

if (typeof module !== "undefined") module.exports = { construirePortraitHTML };
