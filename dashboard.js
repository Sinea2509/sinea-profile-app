  const API_BASE = "https://sinea-profile-ia.vercel.app/api";
  const BACKEND = API_BASE + "/dashboard";
  const ANALYSE_URL = API_BASE + "/analyse_equipe";
  const COMPAT_URL = API_BASE + "/compatibilite";
  const GRILLE_URL = API_BASE + "/grille_entretien";
  const FRONT_APP = "https://sinea-profile-app.vercel.app";
  const CODEX_URL = API_BASE + "/codex";
  const COACH_ENVOI_URL = API_BASE + "/coach_envoi";
  const LIEN_URL = API_BASE + "/lien_apprenant";
  const DIAG_URL = API_BASE + "/diag_env";
  let entrepriseCourante = "";
  const PROFIL_CIBLE_URL = API_BASE + "/profil_cible";
  const BRIEF_URL = API_BASE + "/brief_campagne";
  const RAPPORT_URL = API_BASE + "/rapport_campagne";
  console.log('Sinea Dashboard v135');
  window.addEventListener('error', function(e){ console.error('[Sinéa v135]', e.message, (e.filename||'') + ':' + (e.lineno||'')); });
  const BRIEF_DEV_URL = API_BASE + "/brief_developpement";
  const COACH_URL = API_BASE + "/coach_hebdo";
  const POSTE_CIBLE_URL = API_BASE + "/poste_cible";
  const PROG_URL = API_BASE + "/progression";
  const ENTRETIEN_URL = API_BASE + "/entretien_candidat";
  let vueRecrutementForcee = false;  // section recrutement ouverte manuellement sur une campagne standard
  let derniereCompat = null;     // dernière compatibilité affichée (pour l'export)
  let derniereAnalyseEq = null;  // dernière analyse d'équipe affichée (pour l'export et la grille)
  let derniereGrille = null;     // dernière grille d'entretien générée
  let cleAcces = "";
  let SUPER = false;          // clé super admin : vue transverse + brief de campagne
  let superData = null;       // données d'ensemble (qualité, activité, alertes) pour l'export
  let briefCourant = null;    // dernier brief SeedUp généré (pour l'export)
  let rapportCourant = null;  // dernier rapport de fin de campagne (pour l'export)
  let codeCampagneCourant = "";
  let charts = {};
  let codeCampagneActuelle = "";

  const FAM_COLORS = { RELATION:'#F98272', ACTION:'#F5A623', STRUCTURE:'#3EADFF', VISION:'#5E59C7' };
  const FAM_LABELS = { RELATION:'Relation', ACTION:'Action', STRUCTURE:'Structure', VISION:'Vision' };
  const FAM_ORDER = ['RELATION','ACTION','STRUCTURE','VISION'];

  // ===== MODULE ANALYSE DATA (sans IA) =====
// ============================================================
// analyse_data.js — Analyse data avancée d'une équipe SANS IA
// Calculs statistiques + génération de textes explicatifs par règles.
// Utilisé par le dashboard pour la vue campagne.
// ============================================================


const BF_LABELS = { E:'Extraversion', A:'Agréabilité', C:'Conscience', N:'Stabilité émotionnelle', O:'Ouverture' };
const BF_KEYS = ['E','A','C','N','O'];

// Descriptions des familles (ce qu'elles apportent à une équipe)
const FAM_APPORT = {
  RELATION: "le liant humain, l'écoute et la cohésion du collectif",
  ACTION: "l'énergie d'exécution, la prise de décision et l'avancement concret",
  STRUCTURE: "la rigueur, la fiabilité et la qualité dans la durée",
  VISION: "l'innovation, la prise de hauteur et l'anticipation"
};
const FAM_MANQUE = {
  RELATION: "La dimension relationnelle est peu représentée. L'équipe pourrait manquer de liant dans les moments de tension et négliger le climat collectif.",
  ACTION: "La dimension Action est peu représentée. L'équipe pourrait peiner à trancher et à transformer les réflexions en décisions concrètes.",
  STRUCTURE: "La dimension Structure est peu représentée. L'équipe pourrait manquer de rigueur dans le suivi et la fiabilisation des process.",
  VISION: "La dimension Vision est peu représentée. L'équipe pourrait rester dans l'opérationnel et manquer de recul stratégique."
};

function moyenne(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function ecartType(arr){
  if(arr.length<2) return 0;
  const m=moyenne(arr);
  return Math.sqrt(arr.reduce((s,v)=>s+Math.pow(v-m,2),0)/arr.length);
}

// Calcule l'analyse complète d'une équipe à partir des répondants terminés
function analyserEquipe(repondants){
  const membres = repondants.filter(r=>{
    const s=String(r.statut||'').toLowerCase();
    return (s==='terminé'||s==='termine') && r.bigFive && r.bigFive.E!=null;
  });
  const n = membres.length;
  if(n===0) return null;

  // === FAMILLES ===
  const famCount = { RELATION:0, ACTION:0, STRUCTURE:0, VISION:0 };
  membres.forEach(m=>{ const f=(m.famille||'').toUpperCase(); if(famCount[f]!==undefined) famCount[f]++; });
  const famPct = {}; FAM_ORDER.forEach(f=>famPct[f]=Math.round(famCount[f]/n*100));
  const famTriees = FAM_ORDER.slice().sort((a,b)=>famCount[b]-famCount[a]);
  const famDom = famTriees[0];
  const famAbsentes = FAM_ORDER.filter(f=>famCount[f]===0);
  const famFaibles = FAM_ORDER.filter(f=>famCount[f]>0 && famPct[f]<15);

  // === BIG FIVE moyenne + dispersion ===
  const bfStats = {};
  BF_KEYS.forEach(k=>{
    const vals = membres.map(m=>Number(m.bigFive[k])||0);
    const moy = Math.round(moyenne(vals));
    const sd = Math.round(ecartType(vals));
    bfStats[k] = { moyenne:moy, ecartType:sd, min:Math.min(...vals), max:Math.max(...vals),
      // affichage : N inversé en "stabilité"
      affiche: k==='N' ? 100-moy : moy };
  });

  // === DIVERSITÉ COGNITIVE ===
  // basée sur le nombre de familles représentées + dispersion Big Five moyenne
  const famRepresentees = FAM_ORDER.filter(f=>famCount[f]>0).length;
  const dispMoyenne = moyenne(BF_KEYS.map(k=>bfStats[k].ecartType));
  // score 0-100 : combine couverture familles (0-4) et dispersion
  const scoreDiv = Math.min(100, Math.round((famRepresentees/4)*55 + Math.min(dispMoyenne,30)/30*45));
  let nivDiv, txtDiv;
  if(scoreDiv>=70){ nivDiv='élevée'; txtDiv="forte complémentarité"; }
  else if(scoreDiv>=45){ nivDiv='modérée'; txtDiv="complémentarité équilibrée"; }
  else { nivDiv='faible'; txtDiv="forte homogénéité"; }

  // === ARCHÉTYPES ===
  const archCount = {};
  membres.forEach(m=>{ const a=m.dominante||'?'; archCount[a]=(archCount[a]||0)+1; });
  const archUniques = Object.keys(archCount).length;
  const archTriees = Object.entries(archCount).sort((a,b)=>b[1]-a[1]);

  // === PROFILS EXTRÊMES (par dimension) ===
  const extremes = {};
  BF_KEYS.forEach(k=>{
    let hi=membres[0], lo=membres[0];
    membres.forEach(m=>{ if((Number(m.bigFive[k])||0)>(Number(hi.bigFive[k])||0))hi=m; if((Number(m.bigFive[k])||0)<(Number(lo.bigFive[k])||0))lo=m; });
    extremes[k]={ haut:{nom:hi.nom,val:Number(hi.bigFive[k])||0}, bas:{nom:lo.nom,val:Number(lo.bigFive[k])||0} };
  });

  return {
    n, membres,
    familles:{ count:famCount, pct:famPct, triees:famTriees, dominante:famDom, absentes:famAbsentes, faibles:famFaibles, representees:famRepresentees },
    bigFive:bfStats,
    diversite:{ score:scoreDiv, niveau:nivDiv, texte:txtDiv, archetypesUniques:archUniques },
    archetypes:{ count:archCount, uniques:archUniques, triees:archTriees },
    extremes,
  };
}

// ====== GÉNÉRATION DE TEXTES EXPLICATIFS (par règles, sans IA) ======

// Texte d'analyse des familles
function texteFamilles(a){
  const f=a.familles;
  const dom=f.dominante, second=f.triees[1];
  let t = `Cette équipe de ${a.n} personne${a.n>1?'s':''} est orientée principalement vers <strong>${FAM_LABELS[dom]}</strong> (${f.pct[dom]}%), ce qui lui apporte ${FAM_APPORT[dom]}. `;
  if(f.count[second]>0){
    t += `La dimension <strong>${FAM_LABELS[second]}</strong> (${f.pct[second]}%) complète ce socle en apportant ${FAM_APPORT[second]}. `;
  }
  if(f.representees===4){
    t += `Les quatre familles sont représentées : c'est une équipe complète, capable de mobiliser tous les registres selon les situations. `;
  } else if(f.absentes.length){
    t += f.absentes.map(fa=>FAM_MANQUE[fa]).join(' ') + ' ';
  }
  if(f.faibles.length && !f.absentes.length){
    t += `Restez attentif aux dimensions ${f.faibles.map(x=>FAM_LABELS[x]).join(' et ')}, faiblement présentes, qui pourraient devenir des angles morts sous pression. `;
  }
  return t.trim();
}

// Texte d'analyse Big Five (avec dispersion)
function texteBigFive(a){
  const bf=a.bigFive;
  // trait le plus élevé et le plus bas (en valeur affichée)
  const parAffiche = BF_KEYS.map(k=>({k, v:bf[k].affiche, label: k==='N'?'Stabilité émotionnelle':BF_LABELS[k]}));
  const triHaut = parAffiche.slice().sort((x,y)=>y.v-x.v);
  const plusHaut = triHaut[0], plusBas = triHaut[triHaut.length-1];
  // trait le plus dispersé
  const plusDisperse = BF_KEYS.map(k=>({k,sd:bf[k].ecartType,label:BF_LABELS[k]})).sort((x,y)=>y.sd-x.sd)[0];

  let t = `Le trait le plus marqué de l'équipe est <strong>${plusHaut.label}</strong> (${plusHaut.v}/100 en moyenne), tandis que <strong>${plusBas.label}</strong> est le moins prononcé (${plusBas.v}/100). `;
  // interprétation du trait dominant
  const interpHaut = {
    E:"L'équipe est tournée vers l'extérieur, à l'aise dans l'échange et l'animation.",
    A:"L'équipe privilégie la coopération, la bienveillance et l'harmonie relationnelle.",
    C:"L'équipe est rigoureuse, organisée et fiable dans ses engagements.",
    N:"L'équipe fait preuve de stabilité émotionnelle et de résilience face à la pression.",
    O:"L'équipe est curieuse, ouverte aux idées nouvelles et à l'expérimentation."
  };
  if(interpHaut[plusHaut.k]) t += interpHaut[plusHaut.k]+' ';

  // dispersion
  if(plusDisperse.sd>=20){
    t += `Sur le plan de l'homogénéité, c'est sur <strong>${plusDisperse.label}</strong> que les profils diffèrent le plus (écart-type de ${plusDisperse.sd} points) : l'équipe rassemble ici des tempéraments très contrastés, ce qui est une richesse à condition de bien faire dialoguer ces différences. `;
  } else {
    t += `Les profils sont relativement homogènes sur l'ensemble des traits (dispersion modérée), ce qui facilite la compréhension mutuelle mais peut limiter la diversité des points de vue. `;
  }
  return t.trim();
}

// Texte d'analyse de la diversité
function texteDiversite(a){
  const d=a.diversite;
  let t = `Avec un indice de diversité <strong>${d.niveau}</strong> (${d.score}/100), cette équipe présente une ${d.texte}. `;
  t += `Elle réunit <strong>${a.archetypes.uniques} archétype${a.archetypes.uniques>1?'s':''} distinct${a.archetypes.uniques>1?'s':''}</strong> sur ${a.n} membre${a.n>1?'s':''}, répartis sur <strong>${a.familles.representees} des 4 familles</strong>. `;
  if(d.score>=70){
    t += `Cette complémentarité est un atout majeur : les profils se complètent et couvrent un large spectre de compétences comportementales. Le défi consiste à faire travailler ensemble des personnes qui fonctionnent différemment. `;
  } else if(d.score>=45){
    t += `L'équipe trouve un équilibre entre cohésion et diversité. Les membres se comprennent tout en apportant des angles différents. `;
  } else {
    t += `L'équipe est très homogène : ses membres se ressemblent et se comprennent vite, ce qui fluidifie la collaboration. En contrepartie, veillez à introduire des points de vue extérieurs pour éviter l'angle mort collectif. `;
  }
  return t.trim();
}

// Calcule la position (x,y) d'un membre sur la cartographie
// X : Relation (0) <-> Tâche (100) = orientation vers les gens ou vers le résultat
// Y : Réflexion (0) <-> Action (100) = énergie posée ou tournée vers le mouvement
function positionCarto(m){
  const bf=m.bigFive||{};
  const A=Number(bf.A)||50, C=Number(bf.C)||50, E=Number(bf.E)||50, O=Number(bf.O)||50;
  // X : plus C est haut et A bas => orienté tâche ; plus A haut => orienté relation
  let x = 50 + (C - A)/2;
  // Y : plus E est haut => action ; plus O domine (réflexion/idées) tempère
  let y = E*0.65 + (100-O)*0.35;
  x=Math.max(5,Math.min(95,Math.round(x)));
  y=Math.max(5,Math.min(95,Math.round(y)));
  return {x,y};
}

// Texte d'analyse de la cartographie
function texteCartographie(a, repondants){
  const membres=a.membres;
  const pts=membres.map(m=>({nom:m.nom,famille:(m.famille||'').toUpperCase(),...positionCarto(m)}));
  // détecter dispersion spatiale
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const etX=ecartType(xs), etY=ecartType(ys);
  const etalement=Math.round((etX+etY)/2);
  // quadrant dominant
  const quad={ha:0,hr:0,ba:0,br:0}; // haut-action/tâche, etc.
  pts.forEach(p=>{ const droite=p.x>=50, haut=p.y>=50; if(haut&&droite)quad.ha++; else if(haut&&!droite)quad.hr++; else if(!haut&&droite)quad.ba++; else quad.br++; });
  const quadNoms={ha:"orientés action et résultat",hr:"orientés action et relation",ba:"posés et orientés résultat",br:"posés et orientés relation"};
  const quadMax=Object.entries(quad).sort((x,y)=>y[1]-x[1])[0];

  let t=`Cette carte positionne chaque membre selon deux axes : son orientation (vers les personnes ou vers les tâches) et son énergie (posée et réfléchie, ou tournée vers l'action). `;
  if(quadMax[1]>=Math.ceil(membres.length/2)){
    t+=`La majorité des profils se regroupe dans la zone des personnes <strong>${quadNoms[quadMax[0]]}</strong>, ce qui donne à l'équipe une couleur dominante claire. `;
  } else {
    t+=`Les profils se répartissent sur plusieurs zones, signe d'une équipe aux registres variés. `;
  }
  if(etalement>=22){
    t+=`L'étalement est important : les membres occupent des positions très différentes, ce qui confirme une vraie complémentarité. Les personnes situées aux extrémités apportent des perspectives uniques et méritent une attention particulière pour rester pleinement intégrées. `;
  } else if(etalement>=12){
    t+=`L'équipe présente un étalement modéré : assez de proximité pour se comprendre, assez de variété pour se compléter. `;
  } else {
    t+=`Les membres sont resserrés sur la carte : ils partagent une façon de fonctionner très proche, gage de fluidité mais à compléter par des profils différents pour élargir le champ de vision. `;
  }
  // zones vides
  const vides=[]; if(!quad.ha)vides.push("action et résultat"); if(!quad.hr)vides.push("action et relation"); if(!quad.ba)vides.push("réflexion et résultat"); if(!quad.br)vides.push("réflexion et relation");
  if(vides.length && vides.length<4){
    t+=`Aucun membre ne se positionne dans le registre ${vides.join(', ou ')} : c'est un angle naturel à surveiller selon les besoins de l'équipe.`;
  }
  return t.trim();
}



  // ===== MODULE SOCLE PLUS (archétype, reco, swot, indicateurs) =====
// ============================================================
// analyse_socle_plus.js — Analyse socle UNIQUE (sans IA)
// Archétype d'équipe, recommandations d'activation, SWOT data, indicateurs.
// Se branche sur le résultat de analyserEquipe(reps).
// ============================================================

const FAM_LABELS_2 = { RELATION:'Relation', ACTION:'Action', STRUCTURE:'Structure', VISION:'Vision' };

// ====== 1. ARCHÉTYPE D'ÉQUIPE ======
// Combine les 2 familles dominantes en une identité collective mémorable.
const ARCHETYPES_EQUIPE = {
  'ACTION+STRUCTURE': { nom:"L'équipe Bâtisseuse", essence:"Elle transforme les décisions en résultats concrets et fiables. Son moteur : avancer vite, mais bien.", force:"exécution rigoureuse" },
  'ACTION+RELATION':  { nom:"L'équipe Conquérante", essence:"Elle conjugue énergie d'action et sens du collectif. Son moteur : atteindre les objectifs en embarquant les gens.", force:"mobilisation et conquête" },
  'ACTION+VISION':    { nom:"L'équipe Pionnière", essence:"Elle ose, teste et défriche. Son moteur : transformer les idées neuves en mouvement.", force:"innovation et audace" },
  'STRUCTURE+RELATION':{ nom:"L'équipe Gardienne", essence:"Elle protège la qualité et le climat. Son moteur : la fiabilité au service des personnes.", force:"stabilité et confiance" },
  'STRUCTURE+VISION': { nom:"L'équipe Architecte", essence:"Elle conçoit des systèmes pensés pour durer. Son moteur : structurer une vision de long terme.", force:"conception stratégique" },
  'RELATION+VISION':  { nom:"L'équipe Inspirante", essence:"Elle donne du sens et fédère autour d'idées. Son moteur : embarquer les gens vers un futur désirable.", force:"sens et inspiration" },
};

function archetypeEquipe(a){
  const f=a.familles;
  const tri=f.triees; // déjà triées par effectif décroissant
  const dom=tri[0], second=tri[1];
  // équilibre : si les 4 familles sont à moins de 10 points d'écart en %
  const pcts=Object.values(f.pct);
  const ecart=Math.max(...pcts)-Math.min(...pcts);
  if(ecart<=12 && f.representees===4){
    return { nom:"L'équipe Polyvalente", essence:"Aucune famille ne domine : cette équipe est complète et adaptable, capable de mobiliser tous les registres selon les situations. Son défi : choisir un cap commun plutôt que se disperser.", force:"polyvalence", dom, second };
  }
  // mono-dominante très forte
  if(f.pct[dom]>=55){
    const labels={RELATION:"L'équipe Relationnelle",ACTION:"L'équipe Énergique",STRUCTURE:"L'équipe Méthodique",VISION:"L'équipe Visionnaire"};
    const ess={RELATION:"Le collectif et l'humain priment sur tout. Son moteur : la qualité des liens.",ACTION:"Le mouvement et le résultat priment. Son moteur : l'action immédiate.",STRUCTURE:"La rigueur et la fiabilité priment. Son moteur : la maîtrise.",VISION:"Les idées et l'avenir priment. Son moteur : l'imagination."};
    return { nom:labels[dom], essence:ess[dom]+" Cette force marquée gagne à s'entourer des autres registres pour rester équilibrée.", force:FAM_LABELS_2[dom].toLowerCase(), dom, second };
  }
  // combinaison de 2 familles
  const cle=[dom,second].sort().join('+');
  const found=ARCHETYPES_EQUIPE[cle];
  if(found) return {...found, dom, second};
  // fallback
  return { nom:"L'équipe "+FAM_LABELS_2[dom], essence:"Cette équipe s'appuie principalement sur la dimension "+FAM_LABELS_2[dom]+".", force:FAM_LABELS_2[dom].toLowerCase(), dom, second };
}

function texteArchetypeEquipe(a){
  const arch=archetypeEquipe(a);
  const f=a.familles;
  let t=`Au-delà des profils individuels, l'équipe possède une personnalité collective. Avec une dominante <strong>${FAM_LABELS_2[arch.dom]}</strong>`;
  if(arch.second && f.pct[arch.second]>0) t+=` portée par <strong>${FAM_LABELS_2[arch.second]}</strong>`;
  t+=`, elle se révèle comme <strong>${arch.nom}</strong>. ${arch.essence}`;
  return t.trim();
}

// ====== 2. RECOMMANDATIONS D'ACTIVATION ======
// Que faire concrètement avec cette typologie d'équipe.
function recommandationsActivation(a){
  const f=a.familles, bf=a.bigFive;
  const recos=[];

  // Animer les réunions (selon famille dominante)
  const animer={
    RELATION:"Ouvrez vos réunions par un temps d'échange humain. Cette équipe a besoin de se sentir reliée avant d'entrer dans le concret.",
    ACTION:"Allez droit au but : ordres du jour courts, décisions claires, prochaines actions. Cette équipe déteste les réunions qui s'éternisent.",
    STRUCTURE:"Préparez des ordres du jour précis et documentés. Cette équipe apprécie le cadre, les données et les comptes rendus écrits.",
    VISION:"Laissez de l'espace pour les idées et le pourquoi. Cette équipe se mobilise quand on relie le sujet à une vision plus large."
  };
  recos.push({ titre:"Animer les réunions", desc:animer[f.dominante] });

  // Confier les rôles (selon ce qui est présent)
  const roles=[];
  if(f.count.ACTION>0) roles.push("confiez le pilotage et les deadlines aux profils Action");
  if(f.count.STRUCTURE>0) roles.push("appuyez-vous sur les profils Structure pour la qualité et le suivi");
  if(f.count.RELATION>0) roles.push("laissez les profils Relation gérer la cohésion et les tensions");
  if(f.count.VISION>0) roles.push("sollicitez les profils Vision pour le cadrage stratégique et les idées neuves");
  if(roles.length) recos.push({ titre:"Répartir les rôles", desc:"Pour tirer parti de la complémentarité : "+roles.join(', ')+"." });

  // Combler les angles morts
  if(f.absentes.length){
    const manques={RELATION:"nommer un référent cohésion ou faire appel à un facilitateur externe",ACTION:"introduire un cadre de décision clair pour éviter l'immobilisme",STRUCTURE:"mettre en place des process et un suivi rigoureux",VISION:"organiser des temps dédiés à la prise de recul stratégique"};
    recos.push({ titre:"Compenser les angles morts", desc:"La dimension "+f.absentes.map(x=>FAM_LABELS_2[x]).join(' et ')+" est absente. Pensez à "+f.absentes.map(x=>manques[x]).join(', et ')+"." });
  }

  // Selon la stabilité émotionnelle de l'équipe
  const stab=bf.N.affiche; // déjà inversé
  if(stab<45){
    recos.push({ titre:"Accompagner sous pression", desc:"L'équipe est sensible au stress. Sécurisez les périodes de tension par une communication claire et un soutien managérial rapproché." });
  } else if(stab>=65){
    recos.push({ titre:"Capitaliser sur la résilience", desc:"L'équipe garde son calme sous pression : elle peut porter des projets exigeants et servir d'ancrage dans les moments difficiles." });
  }

  return recos;
}

// ====== 3. SWOT DATA (par règles) ======
function swotData(a){
  const f=a.familles, bf=a.bigFive, d=a.diversite;
  const forces=[], faiblesses=[], opportunites=[], risques=[];

  // FORCES : familles fortes + traits hauts
  f.triees.slice(0,2).forEach(fam=>{ if(f.pct[fam]>=25){
    const txt={RELATION:"Forte cohésion et sens du collectif",ACTION:"Grande capacité d'exécution et d'avancement",STRUCTURE:"Rigueur et fiabilité dans la durée",VISION:"Créativité et vision stratégique"};
    forces.push(txt[fam]);
  }});
  if(bf.C.moyenne>=62) forces.push("Sérieux et sens de l'engagement (conscience élevée)");
  if(bf.A.moyenne>=65) forces.push("Climat coopératif et bienveillant");
  if(bf.N.affiche>=62) forces.push("Stabilité émotionnelle face à la pression");
  if(d.score>=70) forces.push("Forte complémentarité des profils");
  if(!forces.length) forces.push("Équipe équilibrée sans excès marqué");

  // FAIBLESSES : familles absentes/faibles + traits bas
  f.absentes.concat(f.faibles).forEach(fam=>{
    const txt={RELATION:"Dimension relationnelle peu présente",ACTION:"Capacité de décision et d'exécution à renforcer",STRUCTURE:"Rigueur et suivi à structurer",VISION:"Prise de recul stratégique limitée"};
    if(txt[fam] && !faiblesses.includes(txt[fam])) faiblesses.push(txt[fam]);
  });
  if(bf.C.moyenne<45) faiblesses.push("Organisation et constance à consolider");
  if(d.score<45) faiblesses.push("Profils très homogènes : risque d'angle mort collectif");
  if(!faiblesses.length) faiblesses.push("Pas de faiblesse structurelle marquée");

  // OPPORTUNITÉS : ce que l'équipe peut développer
  if(f.count.VISION>0 && f.count.ACTION>0) opportunites.push("Transformer les idées en projets concrets rapidement");
  if(f.count.RELATION>0 && f.count.STRUCTURE>0) opportunites.push("Construire une culture d'équipe solide et durable");
  if(d.score>=60) opportunites.push("Faire dialoguer les profils pour des décisions plus complètes");
  opportunites.push("Confier à chacun un rôle aligné sur sa zone de force naturelle");

  // RISQUES : angles morts comportementaux
  if(f.count.STRUCTURE===0 || f.pct.STRUCTURE<15) risques.push("Décisions précipitées ou suivi insuffisant");
  if(f.count.ACTION===0 || f.pct.ACTION<15) risques.push("Lenteur à trancher et à passer à l'action");
  if(f.count.RELATION===0 || f.pct.RELATION<15) risques.push("Tensions mal gérées faute de liant relationnel");
  if(f.count.VISION===0 || f.pct.VISION<15) risques.push("Manque de hauteur stratégique, focalisation sur l'opérationnel");
  if(bf.A.moyenne>=78) risques.push("Recherche d'harmonie au détriment des débats francs");
  if(!risques.length) risques.push("Pas de risque comportemental majeur identifié");

  return { forces, faiblesses, opportunites, risques };
}

// ====== 4. INDICATEURS SURPRENANTS ======
function indicateurs(a){
  const ind=[];
  const f=a.familles, bf=a.bigFive, d=a.diversite;

  // Pensée unique
  let penseeUnique;
  if(d.score<45) penseeUnique={niveau:"élevé",txt:"Les profils se ressemblent fortement. Risque de converger trop vite sans explorer d'alternatives."};
  else if(d.score<70) penseeUnique={niveau:"modéré",txt:"L'équipe garde une diversité de points de vue suffisante pour éviter la pensée unique."};
  else penseeUnique={niveau:"faible",txt:"La diversité des profils protège bien l'équipe contre la pensée unique."};
  ind.push({ cle:"Risque de pensée unique", valeur:penseeUnique.niveau, texte:penseeUnique.txt });

  // Profil de communication
  let commu;
  const E=bf.E.moyenne, A=bf.A.moyenne;
  if(E>=60 && A>=60) commu="Chaleureuse et expressive : l'équipe échange volontiers et cherche l'harmonie.";
  else if(E>=60 && A<60) commu="Directe et affirmée : l'équipe débat ouvertement, parfois avec franchise.";
  else if(E<50 && A>=60) commu="Posée et à l'écoute : l'équipe privilégie les échanges calmes et le consensus.";
  else commu="Factuelle et réservée : l'équipe communique de façon mesurée, centrée sur le concret.";
  ind.push({ cle:"Style de communication", valeur:"", texte:commu });

  // Gestion du changement (Ouverture)
  let chgt;
  if(bf.O.moyenne>=62) chgt="L'équipe accueille le changement avec curiosité : terrain favorable aux transformations.";
  else if(bf.O.moyenne>=45) chgt="L'équipe accepte le changement s'il est expliqué et accompagné.";
  else chgt="L'équipe préfère la stabilité : accompagnez les changements progressivement, avec du sens.";
  ind.push({ cle:"Rapport au changement", valeur:"", texte:chgt });

  return ind;
}



  // ===== MODULE ANALYSES AVANCÉES (données riches) =====
// ============================================================
// analyse_avancee.js — 6 analyses d'équipe poussées (sans IA)
// Basées sur les données RÉELLES : contextuel (stress, conflit...),
// naturelAdapte (coût d'adaptation), familles, Big Five, speStyle.
// Chaque analyse vérifie la disponibilité des données et le dit
// honnêtement si elles manquent (zéro bullshit).
// ============================================================

const CTX_LABELS = {
  stress: { accelerateur:"accélérateur", methodique:"méthodique", retrait:"en retrait stratégique", appui:"en recherche d'appui" },
  conflit: { affrontement:"frontal", mediation:"médiateur", compromis:"facilitateur de compromis", evitement:"évitant" },
  changement: { moteur:"moteur du changement", adaptable:"adaptable", pragmatique:"pragmatique", ancre:"ancré" },
  risque: { audacieux:"audacieux", calcule:"calculé", prudent:"prudent", securitaire:"sécuritaire" },
  motivation: { accomplissement:"l'accomplissement", reconnaissance:"la reconnaissance", sens:"le sens", maitrise:"la maîtrise" }
};

function membresValides(reps){
  return reps.filter(r=>{
    const s=String(r.statut||'').toLowerCase();
    return (s==='terminé'||s==='termine') && r.bigFive && r.bigFive.E!=null;
  });
}
function avecContextuel(membres){ return membres.filter(m=>m.contextuel && m.contextuel.stress); }
function avecAdapte(membres){ return membres.filter(m=>m.naturelAdapte && m.naturelAdapte.cout); }

// ====== 1. % DE COMPLÉMENTARITÉ ======
// Croise 3 niveaux : familles (couverture), Big Five (dispersion utile), profils contextuels (variété des modes)
function complementarite(membres){
  const n=membres.length;
  if(n<2) return null;
  // niveau 1 : couverture des familles (max 4)
  const fams=new Set(membres.map(m=>(m.famille||'').toUpperCase()).filter(Boolean));
  const scoreFam=(fams.size/4)*100;
  // niveau 2 : dispersion Big Five utile (écart-type moyen, optimal autour de 18-25)
  const ds=['E','A','C','N','O'].map(k=>{
    const vs=membres.map(m=>Number(m.bigFive[k])||0);
    const moy=vs.reduce((a,b)=>a+b,0)/vs.length;
    return Math.sqrt(vs.reduce((s,v)=>s+Math.pow(v-moy,2),0)/vs.length);
  });
  const dispMoy=ds.reduce((a,b)=>a+b,0)/ds.length;
  const scoreDisp=Math.min(100,(dispMoy/22)*100); // 22 points d'écart-type = dispersion riche
  // niveau 3 : variété des modes contextuels (si données dispo)
  const ctx=avecContextuel(membres);
  let scoreCtx=null;
  if(ctx.length>=2){
    let variete=0, dims=0;
    ['stress','conflit','changement','risque'].forEach(d=>{
      const profils=new Set(ctx.map(m=>m.contextuel[d]).filter(Boolean));
      if(profils.size>0){ variete += Math.min(profils.size,3)/3; dims++; }
    });
    scoreCtx = dims? (variete/dims)*100 : null;
  }
  // pondération : familles 40%, Big Five 30%, contextuel 30% (ou redistribué si absent)
  let score;
  if(scoreCtx!=null) score=Math.round(scoreFam*0.4 + scoreDisp*0.3 + scoreCtx*0.3);
  else score=Math.round(scoreFam*0.55 + scoreDisp*0.45);
  return { score:Math.min(100,score), scoreFam:Math.round(scoreFam), scoreDisp:Math.round(scoreDisp), scoreCtx:scoreCtx!=null?Math.round(scoreCtx):null, basesCtx:ctx.length, n };
}

function texteComplementarite(c, membres){
  if(!c) return "Au moins 2 profils complets sont nécessaires pour mesurer la complémentarité.";
  let t=`L'équipe atteint <strong>${c.score}% de complémentarité</strong>, un indice qui croise trois niveaux de lecture. `;
  t+=`La couverture des familles (${c.scoreFam}%) mesure la variété des registres comportementaux présents. `;
  t+=`La dispersion des tempéraments (${c.scoreDisp}%) évalue si les personnalités se complètent ou se dupliquent. `;
  if(c.scoreCtx!=null){
    t+=`La variété des modes de fonctionnement (${c.scoreCtx}%) compare les réactions face au stress, au conflit, au changement et au risque, mesurées sur ${c.basesCtx} membre${c.basesCtx>1?'s':''}. `;
  } else {
    t+=`Les modes de fonctionnement contextuels (stress, conflit, changement) ne sont pas encore disponibles pour cette équipe : l'indice s'appuie sur les familles et les tempéraments. `;
  }
  if(c.score>=70) t+=`À ce niveau, l'équipe dispose d'une vraie richesse interne : les angles de vue se complètent, à condition d'organiser le dialogue entre des personnes qui fonctionnent différemment.`;
  else if(c.score>=45) t+=`L'équipe trouve un équilibre fonctionnel : assez de proximité pour se comprendre vite, assez de différence pour se compléter.`;
  else t+=`L'équipe est fortement homogène : la collaboration est fluide, et le regard extérieur devient indispensable pour éviter l'angle mort collectif.`;
  return t;
}

// ====== 2. RISQUES EN SITUATION DE STRESS ======
// Basé sur les profils stress réels + coûts d'adaptation
function risquesStress(membres){
  const ctx=avecContextuel(membres);
  const adapte=avecAdapte(membres);
  if(!ctx.length && !adapte.length) return null;

  const risques=[];
  // répartition des profils stress
  const compte={accelerateur:0,methodique:0,retrait:0,appui:0};
  ctx.forEach(m=>{ if(compte[m.contextuel.stress]!==undefined) compte[m.contextuel.stress]++; });
  const tot=ctx.length;

  if(tot>0){
    if(compte.accelerateur/tot>=0.5){
      risques.push({ titre:"Emballement collectif", desc:`${compte.accelerateur} membre${compte.accelerateur>1?'s':''} sur ${tot} accélèrent sous pression. En crise, l'équipe risque de multiplier les actions dans l'urgence sans prioriser, et de s'épuiser sur des fronts secondaires. Un rituel de priorisation expresse (10 minutes, 3 priorités max) canalise cette énergie.` });
    }
    if(compte.retrait/tot>=0.4){
      risques.push({ titre:"Silence au mauvais moment", desc:`${compte.retrait} membre${compte.retrait>1?'s':''} sur ${tot} se mettent en retrait sous pression pour analyser. Le risque : un déficit de communication précisément quand l'équipe a besoin de signaux. Convenir d'un point de synchronisation court mais obligatoire en période tendue protège le collectif.` });
    }
    if(compte.accelerateur>0 && compte.retrait>0){
      risques.push({ titre:"Désynchronisation des rythmes", desc:`L'équipe mélange des profils qui accélèrent (${compte.accelerateur}) et des profils qui se retirent pour analyser (${compte.retrait}). Sous stress, les premiers peuvent vivre le silence des seconds comme un désengagement, et inversement. Nommer explicitement ces différences de mode désamorce les procès d'intention.` });
    }
    if(compte.appui/tot>=0.4){
      risques.push({ titre:"Besoin de présence managériale", desc:`${compte.appui} membre${compte.appui>1?'s':''} sur ${tot} cherchent l'appui et l'échange sous pression. En période de crise, un management distant ou silencieux serait coûteux : prévoir des points de contact rapprochés pendant les pics.` });
    }
  }
  // coût d'adaptation élevé = risque d'épuisement
  if(adapte.length){
    const couts={eleve:0,modere:0,faible:0};
    adapte.forEach(m=>{ const c=(m.naturelAdapte.cout||'').replace('é','e'); if(c.indexOf('elev')>=0)couts.eleve++; else if(c.indexOf('moder')>=0)couts.modere++; else couts.faible++; });
    if(couts.eleve>0){
      const noms=adapte.filter(m=>(m.naturelAdapte.cout||'').indexOf('lev')>=0).map(m=>m.nom.split(' ')[0]);
      risques.push({ titre:"Risque d'épuisement par sur-adaptation", desc:`${couts.eleve} membre${couts.eleve>1?'s':''} (${noms.join(', ')}) fonctionne${couts.eleve>1?'nt':''} au quotidien avec un coût d'adaptation élevé : leur posture professionnelle s'écarte fortement de leur nature profonde. Sous stress prolongé, ce sur-effort se paie en fatigue, en irritabilité ou en désengagement. Leur offrir des espaces où leur style naturel peut s'exprimer protège leur énergie.` });
    }
  }
  if(!risques.length) risques.push({ titre:"Pas de risque majeur identifié", desc:"Les profils de réaction au stress disponibles ne révèlent pas de déséquilibre marqué dans cette équipe." });
  return { risques, basesCtx:ctx.length, basesAdapte:adapte.length, total:membres.length };
}

// ====== 3. MEILLEURS BINÔMES ======
// Score de complémentarité par paire : familles différentes + Big Five complémentaires + modes stress compatibles
function meilleursBinomes(membres){
  if(membres.length<2) return null;
  const paires=[];
  for(let i=0;i<membres.length;i++){
    for(let j=i+1;j<membres.length;j++){
      const a=membres[i], b=membres[j];
      let score=0; const raisons=[];
      // familles différentes = complémentarité de registre
      if((a.famille||'').toUpperCase()!==(b.famille||'').toUpperCase()){
        score+=30; raisons.push(`registres complémentaires (${a.famille} et ${b.famille})`);
      }
      // Big Five complémentaires : l'un fort là où l'autre est faible (C et O surtout)
      const dC=Math.abs((a.bigFive.C||50)-(b.bigFive.C||50));
      const dO=Math.abs((a.bigFive.O||50)-(b.bigFive.O||50));
      const dE=Math.abs((a.bigFive.E||50)-(b.bigFive.E||50));
      if(dC>=25){ score+=20; raisons.push("équilibre rigueur et souplesse"); }
      if(dO>=25){ score+=20; raisons.push("équilibre innovation et pragmatisme"); }
      if(dE>=25){ score+=10; raisons.push("équilibre animation et écoute"); }
      // modes stress compatibles (un accélérateur + un méthodique = duo efficace ; deux accélérateurs = surchauffe)
      if(a.contextuel && b.contextuel){
        const sa=a.contextuel.stress, sb=b.contextuel.stress;
        if((sa==='accelerateur'&&sb==='methodique')||(sa==='methodique'&&sb==='accelerateur')){ score+=20; raisons.push("sous pression, l'un accélère pendant que l'autre structure"); }
        if((sa==='retrait'&&sb==='appui')||(sa==='appui'&&sb==='retrait')){ score+=10; raisons.push("sous pression, l'un analyse pendant que l'autre maintient le lien"); }
        if(sa===sb && sa==='accelerateur'){ score-=15; }
        // conflit : un frontal + un médiateur = duo qui ose ET répare
        const ca=a.contextuel.conflit, cb=b.contextuel.conflit;
        if((ca==='affrontement'&&cb==='mediation')||(ca==='mediation'&&cb==='affrontement')){ score+=15; raisons.push("face au désaccord, l'un ose dire, l'autre répare le lien"); }
      }
      if(score>0) paires.push({ a:a.nom, b:b.nom, score, raisons });
    }
  }
  paires.sort((x,y)=>y.score-x.score);
  return paires.slice(0,3);
}

// ====== 4. ANGLES MORTS (enrichi) ======
function anglesMorts(membres, famillesStats){
  const angles=[];
  // familles absentes
  const FAM_TXT={RELATION:"Personne ne porte naturellement le registre relationnel : la cohésion, la gestion des tensions et le climat reposent sur des efforts d'adaptation plutôt que sur un talent naturel.",ACTION:"Personne ne porte naturellement le registre de l'action : le passage à la décision et l'élan d'exécution demandent un effort à toute l'équipe.",STRUCTURE:"Personne ne porte naturellement le registre de la structure : le suivi, la rigueur et la fiabilisation reposent sur la bonne volonté plutôt que sur un réflexe.",VISION:"Personne ne porte naturellement le registre de la vision : la prise de recul et l'anticipation stratégique risquent de passer après l'opérationnel."};
  ['RELATION','ACTION','STRUCTURE','VISION'].forEach(f=>{ if(!famillesStats[f]) angles.push({titre:"Registre "+f.toLowerCase()+" absent", desc:FAM_TXT[f]}); });
  // modes contextuels absents (sur les membres qui ont la donnée)
  const ctx=avecContextuel(membres);
  if(ctx.length>=3){
    const conflits=new Set(ctx.map(m=>m.contextuel.conflit));
    if(!conflits.has('affrontement')){
      angles.push({titre:"Personne n'ose l'affrontement direct", desc:`Sur les ${ctx.length} membres mesurés, aucun n'aborde naturellement le désaccord de front. Les sujets qui fâchent risquent de rester sous le tapis jusqu'à ce qu'ils explosent. L'équipe gagne à ritualiser un espace où le désaccord est explicitement autorisé et attendu.`});
    }
    const changements=new Set(ctx.map(m=>m.contextuel.changement));
    if(!changements.has('moteur')){
      angles.push({titre:"Pas de moteur du changement", desc:`Aucun des ${ctx.length} membres mesurés n'initie spontanément le changement. L'équipe s'adapte mais ne provoque pas : les transformations devront être portées de l'extérieur ou par le manager.`});
    }
    const risquesP=new Set(ctx.map(m=>m.contextuel.risque));
    if(!risquesP.has('audacieux') && !risquesP.has('calcule')){
      angles.push({titre:"Aversion au risque généralisée", desc:`Les profils mesurés penchent tous vers la prudence ou la sécurité. L'équipe protège bien l'existant, et risque de laisser passer les opportunités qui demandent un pari.`});
    }
  }
  if(!angles.length) angles.push({titre:"Pas d'angle mort structurel", desc:"Les registres et modes de fonctionnement mesurés couvrent les besoins essentiels d'une équipe."});
  return angles;
}

// ====== 5. STYLE NATUREL VS AU TRAVAIL / SOUS PRESSION ======
function naturelVsTravail(membres){
  const adapte=avecAdapte(membres);
  const ctx=avecContextuel(membres);
  if(!adapte.length && !ctx.length) return null;
  const items=[];
  // par membre avec donnée naturelAdapte
  adapte.forEach(m=>{
    const na=m.naturelAdapte;
    const cout=(na.cout||'').toLowerCase();
    let lecture;
    if(cout.indexOf('lev')>=0) lecture="s'adapte fortement au travail : sa posture professionnelle s'écarte beaucoup de sa nature profonde, un effort qui coûte de l'énergie au quotidien";
    else if(cout.indexOf('mod')>=0) lecture="ajuste sa posture au travail de façon modérée : un équilibre globalement tenable";
    else lecture="travaille proche de sa nature : peu d'effort d'adaptation, une énergie préservée";
    const stress=m.contextuel && m.contextuel.stress ? ` Sous pression, son mode est ${CTX_LABELS.stress[m.contextuel.stress]||m.contextuel.stress}.` : '';
    items.push({ nom:m.nom, cout:na.cout, ecart:na.moyenneEcart, texte:`${m.nom.split(' ')[0]} ${lecture}.${stress}` });
  });
  // synthèse équipe
  let synthese='';
  if(adapte.length){
    const nbEleve=adapte.filter(m=>(m.naturelAdapte.cout||'').indexOf('lev')>=0).length;
    const pct=Math.round(nbEleve/adapte.length*100);
    if(pct>=40) synthese=`Attention : ${pct}% des membres mesurés fonctionnent avec un coût d'adaptation élevé. Cette équipe « joue un rôle » une grande partie du temps, ce qui la rend performante en façade et vulnérable à l'usure. Créer des espaces d'authenticité (rétrospectives franches, temps informels) est un investissement direct dans sa durabilité.`;
    else if(nbEleve>0) synthese=`La plupart des membres travaillent proche de leur nature. ${nbEleve} personne${nbEleve>1?'s':''} porte${nbEleve>1?'nt':''} en revanche un coût d'adaptation élevé et mérite${nbEleve>1?'nt':''} une attention particulière.`;
    else synthese=`L'équipe travaille globalement proche de sa nature : l'énergie n'est pas consommée à jouer un rôle, un facteur protecteur précieux.`;
  }
  return { items, synthese, bases:adapte.length, total:membres.length };
}

// ====== 6. AXES DE DÉVELOPPEMENT / FORMATION ======
// Déduits des écarts naturel/adapté dominants, des angles morts et des registres faibles
function axesFormation(membres, famillesStats){
  const axes=[];
  const adapte=avecAdapte(membres);
  const ctx=avecContextuel(membres);
  // écarts d'adaptation dominants par dimension -> besoins de formation ciblés
  if(adapte.length>=2){
    const dims={E:0,A:0,C:0,N:0,O:0}; let nb=0;
    adapte.forEach(m=>{ if(m.naturelAdapte.ecarts){ ['E','A','C','N','O'].forEach(k=>{ dims[k]+=Math.abs(m.naturelAdapte.ecarts[k]||0); }); nb++; } });
    if(nb){
      ['E','A','C','N','O'].forEach(k=>dims[k]=dims[k]/nb);
      const triees=Object.entries(dims).sort((a,b)=>b[1]-a[1]);
      const [dimMax,ecartMax]=triees[0];
      if(ecartMax>=25){
        const FORMATIONS={
          A:{titre:"Assertivité et communication authentique",desc:`L'équipe force massivement son registre relationnel (écart moyen de ${Math.round(ecartMax)} points entre nature et posture). Une formation à l'assertivité aiderait chacun à exprimer son point de vue sans sur-jouer la diplomatie, réduisant le coût d'adaptation quotidien.`},
          E:{titre:"Prise de parole et présence sereine",desc:`L'équipe force son exposition sociale (écart moyen de ${Math.round(ecartMax)} points). Un travail sur la prise de parole authentique permettrait d'être présent sans se sur-adapter, et de doser l'exposition selon les enjeux réels.`},
          N:{titre:"Gestion de la pression et récupération",desc:`L'équipe maintient une vigilance forcée (écart moyen de ${Math.round(ecartMax)} points sur la stabilité). Une formation à la gestion du stress et aux stratégies de récupération protégerait l'énergie collective.`},
          C:{titre:"Organisation personnelle et priorisation",desc:`L'équipe force sa rigueur au-delà de sa nature (écart de ${Math.round(ecartMax)} points). Des méthodes d'organisation simples rendraient cette rigueur moins coûteuse.`},
          O:{titre:"Créativité et ouverture en confiance",desc:`L'équipe force son ouverture (écart de ${Math.round(ecartMax)} points). Des formats d'idéation cadrés rendraient l'exploration plus naturelle.`}
        };
        if(FORMATIONS[dimMax]) axes.push(FORMATIONS[dimMax]);
      }
    }
  }
  // registres faibles -> compétences à développer collectivement
  const FAM_FORM={
    VISION:{titre:"Prise de recul et vision stratégique",desc:"Le registre Vision est peu présent : un atelier de prise de hauteur régulier (revue stratégique trimestrielle animée) compenserait ce manque naturel et installerait le réflexe."},
    RELATION:{titre:"Cohésion et intelligence relationnelle",desc:"Le registre Relation est peu présent : un travail sur l'écoute, le feedback et la gestion des tensions donnerait à l'équipe les outils que personne ne porte naturellement."},
    ACTION:{titre:"Décision et passage à l'action",desc:"Le registre Action est peu présent : des méthodes de décision rapide (cadres de décision, délégation claire) compenseraient la tendance naturelle à différer."},
    STRUCTURE:{titre:"Méthode et fiabilisation",desc:"Le registre Structure est peu présent : des outils de suivi simples et partagés sécuriseraient l'exécution sans dépendre d'un profil qui n'existe pas dans l'équipe."}
  };
  const total=Object.values(famillesStats).reduce((a,b)=>a+b,0)||1;
  ['RELATION','ACTION','STRUCTURE','VISION'].forEach(f=>{
    const pct=(famillesStats[f]||0)/total*100;
    if(pct<15 && FAM_FORM[f]) axes.push(FAM_FORM[f]);
  });
  // gestion du conflit si évitement dominant
  if(ctx.length>=3){
    const evit=ctx.filter(m=>m.contextuel.conflit==='evitement').length;
    if(evit/ctx.length>=0.5){
      axes.push({titre:"Conversations difficiles et feedback direct",desc:`${evit} membres sur ${ctx.length} évitent naturellement le conflit. Une formation aux conversations difficiles donnerait à l'équipe le courage relationnel qui lui manque structurellement, avant que les non-dits ne s'accumulent.`});
    }
  }
  if(!axes.length) axes.push({titre:"Consolidation des forces",desc:"Aucun besoin structurel marqué : l'investissement le plus rentable consiste à approfondir les forces existantes et la connaissance mutuelle des modes de fonctionnement."});
  return axes.slice(0,4);
}

// Relie chaque axe de développement à l'offre Sinéa correspondante (accroche commerciale)
const SINEA_PARCOURS = {
  "Assertivité et communication authentique":"Parcours Soft Skills · Assertivité et communication",
  "Prise de parole et présence sereine":"Parcours Prise de parole et impact",
  "Gestion de la pression et récupération":"Parcours Gestion du stress et énergie durable",
  "Organisation personnelle et priorisation":"Parcours Efficacité et organisation",
  "Créativité et ouverture en confiance":"Atelier Créativité et idéation",
  "Prise de recul et vision stratégique":"Parcours Leadership et vision stratégique",
  "Cohésion et intelligence relationnelle":"Parcours Cohésion et intelligence relationnelle",
  "Décision et passage à l'action":"Parcours Management et prise de décision",
  "Méthode et fiabilisation":"Parcours Méthode et excellence opérationnelle",
  "Conversations difficiles et feedback direct":"Parcours Conversations difficiles et feedback",
  "Consolidation des forces":"Accompagnement sur-mesure d'approfondissement"
};
function parcoursSinea(titre){ return SINEA_PARCOURS[titre] || "Parcours sur-mesure Sinéa"; }


  // ===== FIN MODULE ANALYSE DATA =====


  // ===== ANALYSES NOUVELLES DIMENSIONS (équipe) =====
  function analyseEnergieEq(membres){
    const avec=membres.filter(m=>m.energie&&m.energie.profil); if(avec.length<2)return null;
    const c={sprinteur:0,endurant:0,cyclique:0,deepworker:0}; avec.forEach(m=>c[m.energie.profil]++); const t=avec.length;
    const r=[];
    if(c.sprinteur/t>=0.5)r.push({titre:"Risque d'épuisement collectif",desc:`${c.sprinteur} membres sur ${t} fonctionnent par pics intenses. Sans culture de récupération, l'accumulation mène à l'usure. Installez des temps de respiration.`});
    if(c.sprinteur>0&&c.endurant>0)r.push({titre:"Friction de rythme",desc:`L'équipe mêle ${c.sprinteur} sprinteur(s) et ${c.endurant} endurant(s). Sans explicitation, chacun peut mal lire le rythme de l'autre. Nommez ces différences.`});
    if(c.deepworker>0)r.push({titre:"Protéger la concentration",desc:`${c.deepworker} membre(s) performe(nt) en concentration longue. Préservez des plages calmes sans interruption.`});
    if(!r.length)r.push({titre:"Rythmes compatibles",desc:"Les rythmes de l'équipe se complètent sans friction majeure."});
    return {compte:c,risques:r,total:t};
  }
  function analyseAutoriteEq(membres){
    const avec=membres.filter(m=>m.autorite); if(avec.length<2)return null;
    const c={cadre:0,sens:0,liberte:0,contributeur:0}; avec.forEach(m=>c[m.autorite.profil]++); const t=avec.length;
    const r=[];
    if(c.cadre/t>=0.5)r.push({titre:"Équipe en demande de cadre",desc:`${c.cadre}/${t} ont besoin d'un cadre clair. Un management structurant les sécurisera.`});
    if(c.liberte/t>=0.5)r.push({titre:"Équipe en demande d'autonomie",desc:`${c.liberte}/${t} ont besoin de liberté. Un management délégatif les fera s'épanouir.`});
    if(c.cadre>0&&c.liberte>0)r.push({titre:"Besoins de management opposés",desc:`L'équipe mêle des profils en demande de cadre (${c.cadre}) et de liberté (${c.liberte}). Individualisez votre posture managériale.`});
    if(!r.length)r.push({titre:"Rapport au cadre homogène",desc:"L'équipe partage un rapport au cadre cohérent."});
    return {compte:c,risques:r,total:t};
  }
  function analyseRecoEq(membres){
    const avec=membres.filter(m=>m.reconnaissance); if(avec.length<2)return null;
    const c={resultats:0,effort:0,relation:0,autonomie:0}; avec.forEach(m=>c[m.reconnaissance.profil]++); const t=avec.length;
    const lab={resultats:"la reconnaissance des résultats",effort:"la reconnaissance de l'effort",relation:"la considération humaine",autonomie:"la confiance et l'autonomie"};
    const dom=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
    const r=[{titre:"Levier de reconnaissance dominant",desc:`L'équipe est surtout sensible à ${lab[dom[0]]} (${dom[1]}/${t}). Orientez la reconnaissance dans ce sens, tout en individualisant.`}];
    if(c.relation>0&&c.resultats>0)r.push({titre:"Reconnaissances à individualiser",desc:`Certains se nourrissent de résultats (${c.resultats}), d'autres de relation (${c.relation}). Une reconnaissance uniforme ratera la moitié de l'équipe.`});
    return {compte:c,risques:r,total:t};
  }
  function analyseCollabEq(membres){
    const avec=membres.filter(m=>m.collaboration); if(avec.length<2)return null;
    const c={autonome:0,cooperatif:0,interdependant:0,federateur:0}; avec.forEach(m=>c[m.collaboration.profil]++); const t=avec.length;
    const r=[];
    if(c.autonome/t>=0.5)r.push({titre:"Risque de silos",desc:`${c.autonome}/${t} fonctionnent en autonomie. L'équipe risque de devenir une somme d'individus. Instaurez des rituels de partage.`});
    if(c.federateur===0&&t>=3)r.push({titre:"Pas d'animateur naturel",desc:"Aucun membre ne tire spontanément le collectif. La dynamique devra être portée par le manager."});
    if(c.federateur>=2)r.push({titre:"Plusieurs animateurs",desc:`${c.federateur} profils fédérateurs : clarifiez qui anime quoi pour éviter les chevauchements.`});
    if(!r.length)r.push({titre:"Collaboration équilibrée",desc:"L'équipe mêle autonomie et coopération sans déséquilibre."});
    return {compte:c,risques:r,total:t};
  }

  // ===== FICHE APPRENANT (modale au clic sur un membre) =====
  let repsCourants = [];
  const MGR_CONSEILS = {
    stress: {
      accelerateur: { lab:"Accélérateur", txt:"Sous pression, il passe immédiatement à l'action et accélère. Canalisez cette énergie sur les vraies priorités (3 maximum) pour éviter la dispersion dans l'urgence." },
      methodique: { lab:"Méthodique", txt:"Sous pression, il se structure et organise. Donnez-lui quelques minutes pour hiérarchiser : son plan sera un atout pour toute l'équipe." },
      retrait: { lab:"Retrait stratégique", txt:"Sous pression, il s'isole pour analyser avant d'agir. N'interprétez pas son silence comme un désengagement : convenez d'un moment de retour et son analyse sera précieuse." },
      appui: { lab:"Recherche d'appui", txt:"Sous pression, il cherche l'échange et le soutien. Soyez présent et disponible pendant les pics : un management distant lui coûte cher dans ces moments." }
    },
    conflit: {
      affrontement: { lab:"Frontal", txt:"Il aborde le désaccord de front, avec franchise. C'est une ressource rare : aidez-le à soigner la forme pour que son courage relationnel reste audible." },
      mediation: { lab:"Médiateur", txt:"Il cherche à comprendre et réconcilier les positions. Appuyez-vous sur lui quand des tensions traversent l'équipe." },
      compromis: { lab:"Compromis", txt:"Il cherche le terrain d'entente équilibré. Fiable dans les négociations, veillez à ce qu'il ne cède pas sur l'essentiel pour préserver l'accord." },
      evitement: { lab:"Évitant", txt:"Il préfère désamorcer ou contourner la tension. Créez des espaces sûrs où il peut exprimer un désaccord tôt, sinon les sujets sensibles resteront sous le tapis." }
    },
    motivation: {
      accomplissement: { lab:"Accomplissement", txt:"Son moteur : atteindre des objectifs ambitieux. Fixez-lui des défis mesurables et célébrez les caps franchis." },
      reconnaissance: { lab:"Reconnaissance", txt:"Son moteur : l'impact visible et la reconnaissance. Un feedback explicite et régulier est pour lui un carburant, pas un bonus." },
      sens: { lab:"Sens", txt:"Son moteur : l'utilité de ce qu'il fait. Reliez ses missions à leur impact réel, sinon l'engagement s'érode même si tout va bien en surface." },
      maitrise: { lab:"Maîtrise", txt:"Son moteur : progresser et approfondir. Offrez-lui des terrains d'expertise et des formations pointues ; la précipitation permanente l'use." }
    },
    changement: {
      moteur: { lab:"Moteur", txt:"Il initie et pousse le changement. Confiez-lui les transformations à porter : il en fera un terrain de jeu." },
      adaptable: { lab:"Adaptable", txt:"Il accueille le changement avec souplesse. Un allié naturel des transitions, veillez juste à ce qu'il n'absorbe pas tout sans exprimer ses besoins." },
      pragmatique: { lab:"Pragmatique", txt:"Il accepte le changement s'il est justifié. Expliquez le pourquoi avant le comment : son adhésion se gagne par les raisons." },
      ancre: { lab:"Ancré", txt:"Il valorise la stabilité et les repères. Annoncez les changements tôt et accompagnez progressivement : le brusquer crée de la résistance durable." }
    },
    risque: {
      audacieux: { lab:"Audacieux", txt:"Il prend des risques avec aisance. Confiez-lui les paris et les territoires inexplorés, en cadrant les enjeux critiques." },
      calcule: { lab:"Calculé", txt:"Il ose après avoir évalué. Le profil idéal pour les décisions engageantes : donnez-lui les données et il tranchera juste." },
      prudent: { lab:"Prudent", txt:"Il limite son exposition au risque. Sa vigilance protège l'équipe ; sécurisez le cadre quand vous lui demandez de sortir de sa zone." },
      securitaire: { lab:"Sécuritaire", txt:"Il recherche la stabilité et les terrains connus. Précieux pour fiabiliser l'existant ; les missions exploratoires lui coûtent cher." }
    }
  };

  // Ce que la personne a coché et écrit dans sa restitution (par type d'analyse)
  function blocInteractions(inter){
    if(!inter || typeof inter!=='object') return '';
    var libType={socle:'Portrait socle', manager:'Module manager', commercial:'Module commercial'};
    var h='';
    Object.keys(inter).forEach(function(type){
      var it=inter[type]||{}; var morceaux='';
      if(it.auto_perception&&it.auto_perception.length){
        var ap='';
        it.auto_perception.forEach(function(x){ ap+='<p>'+esc(x.titre||x.axe)+' : intuition <b>'+esc(x.pari)+'</b>, mesure <b>'+esc(x.mesure)+'</b>'+(x.accord?' · en accord':' · écart à explorer en débrief')+'</p>'; });
        morceaux+='<div class="fm-inter-row"><span class="fm-inter-lab">Auto-perception avant révélation</span>'+ap+'</div>';
      }
      var forces=(it.forces_libelles&&it.forces_libelles.length)?it.forces_libelles:(it.forces_validees||[]);
      if(forces.length) morceaux+='<div class="fm-inter-row"><span class="fm-inter-lab">Forces où elle se reconnaît</span><p>'+forces.map(esc).join(' · ')+'</p></div>';
      if(it.vigilances_validees&&it.vigilances_validees.length) morceaux+='<div class="fm-inter-row"><span class="fm-inter-lab">Vigilances reconnues</span><p>'+it.vigilances_validees.length+' point(s) validé(s)</p></div>';
      var ro=it.reponses_ouvertes||{};
      Object.keys(ro).forEach(function(k){ if(ro[k]&&String(ro[k]).trim()) morceaux+='<div class="fm-inter-row"><span class="fm-inter-lab">Réponse libre</span><p class="fm-inter-libre">'+esc(ro[k])+'</p></div>'; });
      if(it.pistes_choisies&&it.pistes_choisies.length) morceaux+='<div class="fm-inter-row"><span class="fm-inter-lab">Pistes d\'action choisies</span><p>'+it.pistes_choisies.map(esc).join(' · ')+'</p></div>';
      if(it.clarification&&it.clarification.reponse){
        var cl=it.clarification;
        var ctx=cl.cas==='serre' ? ('Profil serré entre '+esc(cl.archetype1)+' et '+esc(cl.archetype2)) : 'Précision sur un point de nuance';
        morceaux+='<div class="fm-inter-row"><span class="fm-inter-lab">Question de clarification · '+ctx+'</span><p style="font-size:12px;color:#8A8AA0;margin-bottom:3px">'+esc(cl.question)+'</p><p class="fm-inter-libre">'+esc(cl.reponse)+'</p></div>';
      }
      if(morceaux) h+='<div class="fm-inter-type">'+esc(libType[type]||type)+'</div>'+morceaux;
    });
    if(!h) return '';
    return '<div class="fm-section"><div class="fm-section-titre">Ses réponses dans la restitution</div>'+h+'</div>';
  }

  function ouvrirMembre(idx){
    const m = repsCourants[idx];
    if(!m) return;
    membreFicheCourant = m;
    setTimeout(function(){ try { majFitFiche(); } catch (e) { console.warn("[Sinéa]", e); } }, 0);
    const f=(m.famille||'').toUpperCase(); const col=FAM_COLORS[f]||'#999';
    const ctx=m.contextuel||{};
    const na=m.naturelAdapte||null;
    // blocs "comment le manager"
    let mgrHtml='';
    ['stress','conflit','motivation','changement','risque'].forEach(d=>{
      const v=ctx[d]; const c=v && MGR_CONSEILS[d] && MGR_CONSEILS[d][v];
      if(c) mgrHtml+=`<div class="fm-conseil"><div class="fm-conseil-head"><span class="fm-dim">${d==='stress'?'Sous pression':d==='conflit'?'Face au conflit':d==='motivation'?'Moteur profond':d==='changement'?'Face au changement':'Rapport au risque'}</span><span class="fm-profil">${esc(c.lab)}</span></div><p>${esc(c.txt)}</p></div>`;
    });
    if(!mgrHtml) mgrHtml='<p class="reco-desc">Les modes de fonctionnement contextuels ne sont pas disponibles pour ce profil (analyse passée avant leur mise en place).</p>';
    // coût d'adaptation
    let coutHtml='';
    if(na && na.cout){
      const c=(na.cout||'').indexOf('lev')>=0?'eleve':((na.cout||'').indexOf('mod')>=0?'modere':'faible');
      const alerte={eleve:"Signal RH important : sa posture professionnelle s'écarte fortement de sa nature. Sujet à aborder en entretien : où peut-il être davantage lui-même ?",modere:"Équilibre globalement tenable entre nature et posture professionnelle.",faible:"Il travaille proche de sa nature : énergie préservée, facteur de durabilité."}[c];
      coutHtml=`<div class="fm-section"><div class="fm-section-titre">Coût d'adaptation</div><div class="nat-item nat-${c}" style="margin-top:8px"><div class="nat-cout">${esc(na.cout)}${na.moyenneEcart!=null?' · écart moyen '+na.moyenneEcart:''}</div><div class="reco-desc">${esc(alerte)}</div></div></div>`;
    }
    // Big Five barres
    const bf=m.bigFive||{};
    const bfRows=[['E','Extraversion'],['A','Agréabilité'],['C','Conscience'],['N','Stabilité émotionnelle'],['O','Ouverture']].map(([k,lab])=>{
      let v=Number(bf[k]); if(isNaN(v)) return ''; if(k==='N') v=100-v;
      return `<div class="fm-bf"><span>${lab}</span><div class="compl-bar"><i style="width:${Math.round(v)}%"></i></div><b>${Math.round(v)}</b></div>`;
    }).join('');
    // style spé
    let speHtml='';
    if(m.speStyle){
      const scores=m.speStyleScores||{};
      const tri=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
      speHtml=`<div class="fm-section"><div class="fm-section-titre">Style ${esc(m.speStyle)}</div>${tri.map(([s,v])=>`<div class="fm-bf"><span style="text-transform:capitalize">${esc(s.replace(/_/g,' '))}</span><div class="compl-bar"><i style="width:${Math.round(v*2)}%"></i></div><b>${Math.round(v)}</b></div>`).join('')}</div>`;
    }
    // énergie / rythme
    let energieHtml='';
    if(m.energie && m.energie.profil){
      const EN={sprinteur:["Sprinteur","Donne le meilleur sur des pics courts et intenses. Confiez-lui les missions à deadline, prévoyez des temps de récupération."],endurant:["Endurant","Tient un effort régulier et fiable dans la durée. Appuyez-vous sur lui pour les projets longs."],cyclique:["Cyclique","Alterne phases intenses et phases calmes. Ses creux préparent ses pics, ne les lisez pas comme un désengagement."],deepworker:["Deep-worker","Performe en concentration longue. Protégez ses créneaux sans réunion ni interruption."]};
      const e=EN[m.energie.profil];
      if(e) energieHtml=`<div class="fm-section"><div class="fm-section-titre">Énergie & rythme</div><div class="dim-item"><div class="dim-head"><span class="dim-nom-i">Rythme de travail</span><span class="dim-prof-i">${esc(e[0])}</span></div><div class="reco-desc">${esc(e[1])}</div><div class="dim-modele-i">Modèle SMART</div></div></div>`;
    }
    // dimensions de pilotage (collaboration, autorité, reconnaissance)
    const posteDef = (m.speStyleScores && Object.prototype.hasOwnProperty.call(m.speStyleScores, 'challenger')) ? 'commercial' : 'manager';
    let pilotageHtml='';
    const DIMS_PILOT={
      collaboration:{titre:"Collaboration",modele:"Modèle SMART",profils:{autonome:["Autonome","Donne le meilleur en pilotant son périmètre seul. Confiez-lui un cadre clair, évitez le micro-management."],cooperatif:["Coopératif","S'épanouit dans l'échange et le travail à plusieurs. Intégrez-le aux dynamiques collectives."],interdependant:["Interdépendant","Articule son travail avec celui des autres. Placez-le aux interfaces, sur les projets transverses."],federateur:["Fédérateur","Anime et fait avancer le collectif. Confiez-lui des rituels ou sous-groupes à animer."]}},
      autorite:{titre:"Rapport au cadre",modele:"Self-Determination Theory",profils:{cadre:["Besoin de cadre","Donnez-lui des attentes explicites et stables. Le flou le déstabilise."],sens:["Besoin de sens","Expliquez toujours le pourquoi : le sens est sa condition d'adhésion."],liberte:["Besoin de liberté","Accordez-lui autonomie et confiance. Le contrôle excessif le démotive."],contributeur:["Contributeur","Associez-le aux décisions qui le concernent : il s'engage quand il est consulté."]}},
      reconnaissance:{titre:"Reconnaissance",modele:"Self-Determination Theory",profils:{resultats:["Résultats","Soulignez explicitement ses réussites. Ne passez pas au sujet suivant sans marquer le coup."],effort:["Effort","Reconnaissez l'investissement et le chemin, pas seulement le résultat final."],relation:["Relation","Accordez-lui attention sincère et considération, au-delà des chiffres."],autonomie:["Autonomie","Récompensez-le en lui confiant plus d'autonomie : c'est sa vraie reconnaissance."]}}
    };
    ['collaboration','autorite','reconnaissance'].forEach(d=>{
      const data=m[d];
      if(data && data.profil && DIMS_PILOT[d].profils[data.profil]){
        const [nom,desc]=DIMS_PILOT[d].profils[data.profil];
        pilotageHtml+=`<div class="dim-item"><div class="dim-head"><span class="dim-nom-i">${DIMS_PILOT[d].titre}</span><span class="dim-prof-i">${esc(nom)}</span></div><div class="reco-desc">${esc(desc)}</div><div class="dim-modele-i">${DIMS_PILOT[d].modele}</div></div>`;
      }
    });
    if(pilotageHtml) pilotageHtml=`<div class="fm-section"><div class="fm-section-titre">Dimensions de pilotage</div><div class="dim-grid-i">${pilotageHtml}</div></div>`;
    // badge fiabilité
    let fiabHtml='';
    if(m.fiabilite && m.fiabilite.score!=null){
      const fs=m.fiabilite.score; const fc=fs>=85?'#3EAD8B':(fs>=70?'#F9A876':'#F98272');
      fiabHtml=`<div class="fm-fiab" style="border-color:${fc}33;background:${fc}0d"><div><div class="fm-fiab-lab">Fiabilité du profil</div><div class="fm-fiab-msg">${esc(m.fiabilite.message||'')}</div></div><div class="fm-fiab-score" style="color:${fc}">${fs}%</div></div>`;
    }
    const interHtml = blocInteractions(m.interactions);
    const html=`
      <div class="fm-overlay" onclick="if(event.target===this)fermerMembre()">
        <div class="fm-card">
          <button class="fm-close" onclick="fermerMembre()">×</button>
          <div class="fm-head">
            <div class="membre-ava" style="background:${col};width:56px;height:56px;font-size:20px;border-radius:15px">${esc(initiales(m.nom))}</div>
            <div style="flex:1"><div class="fm-nom">${esc(m.nom||'')}</div><div class="fm-arch" style="color:${col}">${esc(m.dominante||'')} · ${esc(FAM_LABELS[f]||f)}</div></div>
            ${m.email ? `<button class="fm-pdf-btn" id="fm-pdf-btn" onclick="telechargerPortraitMembre(${idx})">Portrait PDF</button>` : ''}
            ${m.email ? `<button class="fm-pdf-btn" onclick="ouvrirEnvoiCoach('apprenant', ${idx})">Envoyer au coach</button>` : ''}
            ${m.email ? `<button class="fm-pdf-btn" onclick="voirCommeApprenant(${idx}, this)">Voir comme lui</button>` : ''}
            ${m.email ? `<button class="fm-pdf-btn" onclick="copierLienApprenant(${idx}, this)">Copier son lien</button>` : ''}
          </div>
          <div class="fm-section"><div class="fm-section-titre">Comment le manager</div>${mgrHtml}</div>
          ${fiabHtml}
          ${coutHtml}
          ${energieHtml}
          ${pilotageHtml}
          <div class="fm-section"><div class="fm-section-titre">Brief de développement</div>
            <div class="bd-intro">Le potentiel vient de sa nature, l'expression de son comportement au travail. Choisissez le poste de référence :</div>
            <div class="bd-postes">
              <button type="button" class="bd-poste ${posteDef==='manager'?'on':''}" data-p="manager" onclick="choisirPosteBrief(this)">Manager</button>
              <button type="button" class="bd-poste ${posteDef==='commercial'?'on':''}" data-p="commercial" onclick="choisirPosteBrief(this)">Commercial</button>
              <button type="button" class="bd-poste" data-p="expert" onclick="choisirPosteBrief(this)">Expert</button>
              <button type="button" class="bd-poste" data-p="custom" onclick="choisirPosteBrief(this)">Sur mesure</button>
            </div>
            <div class="bd-custom-lien"><a onclick="toggleEditeurPoste()">Définir le profil cible de l'entreprise</a></div>
            <div id="bd-custom-editor" style="display:none"></div>\n            <div id="bd-custom-statut"></div>\n            <div id="bd-fit"></div>
            <button class="fm-pdf-btn bd-btn" id="bd-btn" onclick="genererBriefDev(${idx})">Générer le brief</button>
            <div id="bd-zone"></div>
          </div>
          <div class="fm-section"><div class="fm-section-titre">Tempérament</div>${bfRows}</div>
          ${speHtml}
          ${interHtml}
        </div>
      </div>`;
    const div=document.createElement('div'); div.id='fiche-membre'; div.innerHTML=html;
    document.body.appendChild(div);
    chargerBriefDevSauve(idx);
  }
  function fermerMembre(){ const d=document.getElementById('fiche-membre'); if(d) d.remove(); }

  const PDF_PORTRAIT_URL = API_BASE + "/pdf_portrait";
  // ===== Le brief de développement individuel (logique TMA) =====
  // Le portail calcule tout en local via le moteur de compétences,
  // l'endpoint ne fait que rédiger : le périmètre des données reste ici.
  let briefDevCourant = null;
  let collectifCourant = null;   // les trois réponses compétences de l'équipe
  let axesForces = null;         // axes imposés au prochain brief de campagne (chantier)
  let coachEtat = null;          // le carnet coach de la campagne courante { semaines: {...} }

  // ===== Le profil cible sur mesure : le référentiel de poste du client =====
  // v1 : mémorisé sur ce navigateur par entreprise. La persistance serveur
  // viendra dans une passe suivante si l'usage le confirme.
  let posteCustomCourant = null;   // référentiel serveur de l'entreprise courante, chargé à l'ouverture
  function clePosteCustom(ent){ return 'sinea_poste_' + String(ent || (campagneData && campagneData.entreprise) || 'defaut').toLowerCase().replace(/[^a-z0-9]/g, '_'); }
  function chargerPosteCustom(){
    if (posteCustomCourant) return posteCustomCourant;
    try { return JSON.parse(localStorage.getItem(clePosteCustom()) || 'null'); } catch (e) { return null; }
  }
  function toggleEditeurPoste(){
    const z = document.getElementById('bd-custom-editor');
    if (!z || !window.Competences) return;
    if (z.style.display !== 'none'){ z.style.display = 'none'; return; }
    const coefs = chargerPosteCustom() || Competences.POSTES.manager.coefs;
    const opts = [[0.7, 'Secondaire'], [1, 'Utile'], [1.35, 'Déterminante']];
    z.innerHTML = '<div class="bd-custom-note">Pondérez chaque compétence pour le poste cible de ' + esc((campagneData && campagneData.entreprise) || 'ce client') + ' :</div>'
      + Competences.REFERENTIEL.map(c => '<div class="bd-custom-row"><span>' + esc(c.nom) + '</span><select id="pc-' + c.id + '">'
        + opts.map(o => '<option value="' + o[0] + '"' + (Math.abs((coefs[c.id] || 1) - o[0]) < 0.01 ? ' selected' : '') + '>' + o[1] + '</option>').join('')
        + '</select></div>').join('')
      + '<button class="exp-btn exp-mini" onclick="sauverPosteCustom()">Enregistrer le profil cible</button>';
    z.style.display = 'block';
  }
  function sauverPosteCustom(){
    const coefs = {};
    Competences.REFERENTIEL.forEach(c => {
      const sel = document.getElementById('pc-' + c.id);
      if (sel) coefs[c.id] = Number(sel.value) || 1;
    });
    try { localStorage.setItem(clePosteCustom(), JSON.stringify(coefs)); } catch (e) { console.warn("[Sinéa]", e); }
    posteCustomCourant = coefs;
    const z = document.getElementById('bd-custom-editor');
    if (z) z.style.display = 'none';
    const chip = document.querySelector('.bd-poste[data-p="custom"]');
    if (chip) choisirPosteBrief(chip);
    // Persistance serveur : partagée entre appareils et utilisateurs du portail
    const statut = document.getElementById('bd-custom-statut');
    const ent = (campagneData && campagneData.entreprise) || '';
    if (!SUPER){
      if (statut) statut.innerHTML = '<div class="ch-alerte">Profil enregistré sur ce navigateur. L\'enregistrement serveur est réservé au super admin.</div>';
      return;
    }
    fetch(POSTE_CIBLE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': cleAcces },
      body: JSON.stringify({ action: 'sauver', entreprise: ent, coefs: coefs }) })
      .then(r => r.json())
      .then(d => {
        if (!statut) return;
        if (d && d.ok) statut.innerHTML = '<div class="bd-custom-ok">Profil cible de ' + esc(ent) + ' enregistré : partagé entre appareils et briefs.</div>';
        else if (d && d.raison === 'champ_manquant') statut.innerHTML = '<div class="ch-alerte">Pour partager ce profil entre appareils, ajoutez un champ texte long nommé exactement <b>Postes (JSON)</b> à votre table Entreprises. En attendant, il est enregistré sur ce navigateur.</div>';
        else statut.innerHTML = '<div class="ch-alerte">Enregistré sur ce navigateur. Le serveur a répondu une erreur, réessayez plus tard.</div>';
      })
      .catch(() => { if (statut) statut.innerHTML = '<div class="ch-alerte">Enregistré sur ce navigateur. Serveur injoignable à l\'instant.</div>'; });
  }

  function choisirPosteBrief(btn){
    document.querySelectorAll('.bd-poste').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('on');
    btn.setAttribute('aria-pressed', 'true');
    try { majFitFiche(); } catch (e) {}
  }

  function genererBriefDev(idx){
    const m = (typeof repsCourants !== 'undefined' && repsCourants[idx]) || (campagneData && campagneData.repondants ? campagneData.repondants[idx] : null);
    const zone = document.getElementById('bd-zone');
    const btn = document.getElementById('bd-btn');
    if (!m || !zone || !window.Competences) return;
    if (!m.bigFive || m.bigFive.O === null || m.bigFive.O === undefined){
      zone.innerHTML = '<div class="empty">Profil incomplet : le brief demande les scores Big Five.</div>'; return;
    }
    const posteEl = document.querySelector('.bd-poste.on');
    const poste = posteEl ? posteEl.getAttribute('data-p') : 'manager';
    let coefsCustom = null;
    if (poste === 'custom'){
      coefsCustom = chargerPosteCustom();
      if (!coefsCustom){ toggleEditeurPoste(); zone.innerHTML = '<div class="empty">Définissez d\'abord le profil cible de l\'entreprise ci-dessus, puis relancez.</div>'; if (btn){ btn.disabled = false; btn.textContent = 'Générer le brief'; } return; }
    }
    const comps = Competences.scorer(m.bigFive, m.naturelAdapte && m.naturelAdapte.ecarts, m.speDims);
    const pri = Competences.prioriser(comps, poste === 'custom' ? 'manager' : poste, coefsCustom);
    const leger = (c) => ({ nom: c.nom, famille: c.famille, potentiel: c.potentiel, expression: c.expression, motif: c.motif || '' });
    const prenom = String(m.nom || '').trim().split(/\s+/)[0] || '';
    const seedupActif = (m.nbSeedup || 0) > 0;
    const evolution = calculerEvolution(m);
    if (btn){ btn.disabled = true; btn.textContent = 'Génération du brief...'; }
    zone.innerHTML = squeletteHtml(5);
    fetch(BRIEF_DEV_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': cleAcces },
      body: JSON.stringify({
        nom: m.nom || '', prenom: prenom, archetype: m.dominante || '', famille: m.famille || '',
        poste: pri.poste, cout: (m.naturelAdapte && m.naturelAdapte.cout) || '',
        appuis: pri.appuis.map(leger), opportunites: pri.opportunites.map(leger), vigilances: pri.vigilances.map(leger),
        seedupActif: seedupActif, nbDefis: m.nbSeedup || 0, defisFaits: m.seedupTitres || [],
        evolution: evolution,
        regards: (function(){
          const tmp = {}; attacherRegards(tmp, m);
          if (!tmp._regards) return null;
          const vu = (c) => ({ nom: c.nom, vu: Math.round(tmp._regards.vals[c.id] !== undefined ? tmp._regards.vals[c.id] : -1) });
          return { n: tmp._regards.n, appuis: pri.appuis.map(vu).filter(x => x.vu >= 0), opportunites: pri.opportunites.map(vu).filter(x => x.vu >= 0) };
        })(),
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (btn){ btn.disabled = false; btn.textContent = 'Générer le brief'; }
        if (!d || !d.ok || !d.brief){ zone.innerHTML = '<div class="empty">La génération a échoué. Réessayez dans un instant.</div>'; return; }
        briefDevCourant = d.brief;
        briefDevCourant._m = m; briefDevCourant._poste = pri.poste;
        briefDevCourant._pri = { appuis: pri.appuis.map(leger), opportunites: pri.opportunites.map(leger), vigilances: pri.vigilances.map(leger) };
        briefDevCourant._seedupActif = seedupActif;
        briefDevCourant._evolution = evolution;
        briefDevCourant._comps = comps;
        briefDevCourant._compsApres = (m.remesure && m.remesure.ecarts) ? Competences.scorer(m.bigFive, m.remesure.ecarts, m.speDims) : null;
        briefDevCourant._pistes = m.pistesLibelles || [];
        attacherRegards(briefDevCourant, m);
        briefDevCourant._date = new Date().toISOString();
        // Persistance : le brief se range avec les interactions de la personne,
        // la prochaine ouverture de fiche l'affiche sans regénérer ni repayer.
        if (m.email){
          fetch(PROG_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_interactions', email: m.email, type_analyse: 'brief_dev',
              interactions: { poste: poste, posteNom: pri.poste, brief: d.brief, pri: briefDevCourant._pri, date: briefDevCourant._date } }),
          }).catch(() => {});
        }
        zone.innerHTML = rendreBriefDev(briefDevCourant) +
          '<div class="bd-export"><button class="exp-btn exp-mini" onclick="exporterBriefDev()">Exporter en PDF</button></div>';
      })
      .catch(() => {
        if (btn){ btn.disabled = false; btn.textContent = 'Générer le brief'; }
        zone.innerHTML = '<div class="empty">Erreur réseau pendant la génération.</div>';
      });
  }

  // ===== Le débrief coach hebdomadaire (Phase C, super admin) =====
  // Les défis de la semaine s'agrègent seuls, se mappent sur le référentiel,
  // le coach ajoute trois phrases, l'IA rédige la restitution RH. Moins de
  // cinq minutes par semaine, sinon personne ne le fera.
  function lundiDeLaDate(iso){
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (isNaN(d)) return '';
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }

  function semainesCoach(){
    const cartes = {};
    (campagneData.repondants || []).forEach(r => {
      if (String(r.nom || '').toLowerCase().indexOf('test') >= 0) return;
      (r.seedupListe || []).forEach(x => {
        const sem = lundiDeLaDate(x.d);
        if (!sem) return;
        const c = cartes[sem] || (cartes[sem] = { n: 0, actifs: new Set(), reussites: [], comps: {} });
        c.n++;
        c.actifs.add(r.nom || '');
        if (typeof x.r === 'number') c.reussites.push(x.r);
        const m = window.Competences ? Competences.matcherCompetence(x.t) : null;
        const nomC = m ? m.nom : 'Autres gestes';
        c.comps[nomC] = (c.comps[nomC] || 0) + 1;
      });
    });
    return Object.entries(cartes)
      .map(([sem, c]) => ({
        semaine: sem, n: c.n, actifs: c.actifs.size,
        reussite: c.reussites.length ? Math.round(c.reussites.reduce((a, b) => a + b, 0) / c.reussites.length * 10) / 10 : null,
        competences: Object.entries(c.comps).map(([nom, n]) => ({ nom, n })).sort((a, b) => b.n - a.n),
      }))
      .sort((a, b) => b.semaine.localeCompare(a.semaine));
  }

  function renderCoachHebdo(){
    if (!SUPER || !campagneData) return '';
    const semaines = semainesCoach();
    if (!semaines.length) return '';
    coachEtat = (campagneData.coach && campagneData.coach.semaines) ? JSON.parse(JSON.stringify(campagneData.coach)) : { semaines: {} };
    let h = '<div class="panel ce-panel"><div class="ce-head"><div><div class="panel-title">Débrief coach hebdomadaire</div><div class="panel-sub">Les défis s\'agrègent seuls, ajoutez votre regard, la restitution RH se rédige.</div></div><button class="exp-btn exp-mini" onclick="exporterCoachHebdo()">Restitution RH (PDF)</button></div>';
    h += '<div id="ch-notice"></div>';
    semaines.slice(0, 8).forEach(sm => {
      const sauve = coachEtat.semaines[sm.semaine] || {};
      const dateFr = new Date(sm.semaine + 'T12:00:00').toLocaleDateString('fr-FR');
      h += '<div class="ch-week" id="ch-' + sm.semaine + '">'
        + '<div class="ch-week-head"><span class="ch-week-titre">Semaine du ' + dateFr + '</span>'
        + '<span class="ch-week-stats">' + sm.n + ' défis · ' + sm.actifs + ' actif' + (sm.actifs > 1 ? 's' : '') + (sm.reussite !== null ? ' · réussite ' + sm.reussite + '/10' : '') + '</span>'
        + (sauve.synthese ? '<span class="ch-badge">Enregistrée</span>' : '') + '</div>'
        + '<div class="ch-comps">' + sm.competences.slice(0, 5).map(c => '<span class="ce-chip">' + esc(c.nom) + ' · ' + c.n + '</span>').join('') + '</div>'
        + '<textarea class="ch-regard" id="ch-regard-' + sm.semaine + '" placeholder="Votre regard de coach, trois phrases suffisent...">' + esc(sauve.regard || '') + '</textarea>'
        + '<div class="ch-actions"><button class="exp-btn exp-mini" id="ch-rediger-' + sm.semaine + '" onclick="redigerSemaineCoach(\'' + sm.semaine + '\')">Rédiger la restitution</button>'
        + '<button class="exp-btn exp-mini ch-save" id="ch-sauver-' + sm.semaine + '" onclick="sauverCoach(\'' + sm.semaine + '\')">Enregistrer</button></div>'
        + '<div class="ch-synt" id="ch-synt-' + sm.semaine + '">' + (sauve.synthese ? rendreSyntheseCoach(sauve) : '') + '</div>'
        + '</div>';
    });
    h += '</div>';
    return h;
  }

  function rendreSyntheseCoach(sv){
    let h = '<p class="ch-synt-txt">' + esc(sv.synthese || '') + '</p>';
    if (Array.isArray(sv.points) && sv.points.length) h += '<ul class="ch-points">' + sv.points.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>';
    return h;
  }

  function statsSemaine(sem){
    return semainesCoach().find(x => x.semaine === sem) || null;
  }

  function redigerSemaineCoach(sem){
    const sm = statsSemaine(sem);
    const btn = document.getElementById('ch-rediger-' + sem);
    const zone = document.getElementById('ch-synt-' + sem);
    if (!sm || !zone) return;
    const regard = (document.getElementById('ch-regard-' + sem) || {}).value || '';
    // La synthèse précédente assure la continuité de la narration
    const cles = Object.keys(coachEtat.semaines).filter(k => k < sem).sort();
    const precedent = cles.length ? (coachEtat.semaines[cles[cles.length - 1]].synthese || '') : '';
    if (btn){ btn.disabled = true; btn.textContent = 'Rédaction...'; }
    zone.innerHTML = squeletteHtml(3);
    fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': cleAcces },
      body: JSON.stringify({
        action: 'rediger', entreprise: campagneData.entreprise || '', campagne: campagneData.nom || codeCampagneCourant,
        periode: new Date(sem + 'T12:00:00').toLocaleDateString('fr-FR'),
        stats: { n: sm.n, actifs: sm.actifs, reussite: sm.reussite },
        competences: sm.competences, regard: regard, precedent: precedent,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (btn){ btn.disabled = false; btn.textContent = 'Rédiger la restitution'; }
        if (!d || !d.ok){ zone.innerHTML = '<div class="empty">La rédaction a échoué. Réessayez.</div>'; return; }
        coachEtat.semaines[sem] = Object.assign(coachEtat.semaines[sem] || {}, {
          regard: regard, synthese: d.synthese, points: d.points || [],
          stats: { n: sm.n, actifs: sm.actifs, reussite: sm.reussite },
          competences: sm.competences, maj: new Date().toISOString(),
        });
        zone.innerHTML = rendreSyntheseCoach(coachEtat.semaines[sem]);
      })
      .catch(() => {
        if (btn){ btn.disabled = false; btn.textContent = 'Rédiger la restitution'; }
        zone.innerHTML = '<div class="empty">Erreur réseau.</div>';
      });
  }

  function sauverCoach(sem){
    const btn = document.getElementById('ch-sauver-' + sem);
    const notice = document.getElementById('ch-notice');
    const regard = (document.getElementById('ch-regard-' + sem) || {}).value || '';
    const sm = statsSemaine(sem);
    coachEtat.semaines[sem] = Object.assign(coachEtat.semaines[sem] || {}, {
      regard: regard,
      stats: sm ? { n: sm.n, actifs: sm.actifs, reussite: sm.reussite } : (coachEtat.semaines[sem] || {}).stats,
      competences: sm ? sm.competences : (coachEtat.semaines[sem] || {}).competences,
      maj: new Date().toISOString(),
    });
    if (btn){ btn.disabled = true; btn.textContent = 'Enregistrement...'; }
    fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': cleAcces },
      body: JSON.stringify({ action: 'sauver', code: codeCampagneCourant, coach: coachEtat }),
    })
      .then(r => r.json())
      .then(d => {
        if (btn){ btn.disabled = false; }
        if (d && d.ok){
          if (btn){ btn.textContent = 'Enregistré ✓'; setTimeout(() => { btn.textContent = 'Enregistrer'; }, 2500); }
          campagneData.coach = coachEtat;
        } else if (d && d.raison === 'champ_manquant'){
          if (btn) btn.textContent = 'Enregistrer';
          if (notice) notice.innerHTML = '<div class="ch-alerte">Pour activer la sauvegarde, ajoutez un champ texte long nommé exactement <b>Coach (JSON)</b> à votre table Campagnes dans Airtable. Tout le reste fonctionne déjà : rédaction et export inclus.</div>';
        } else {
          if (btn) btn.textContent = 'Erreur';
          setTimeout(() => { if (btn) btn.textContent = 'Enregistrer'; }, 2500);
        }
      })
      .catch(() => { if (btn){ btn.disabled = false; btn.textContent = 'Erreur'; setTimeout(() => { btn.textContent = 'Enregistrer'; }, 2500); } });
  }

  function exporterCoachHebdo(){
    if (!coachEtat) return;
    const cles = Object.keys(coachEtat.semaines).sort();
    if (!cles.length){ alert('Aucune semaine rédigée pour l\'instant.'); return; }
    let corps = '<p>Restitution hebdomadaire du coach SeedUp : les compétences réellement travaillées sur le terrain, semaine après semaine.</p>';
    cles.forEach(sem => {
      const sv = coachEtat.semaines[sem];
      if (!sv || (!sv.synthese && !sv.regard)) return;
      const st = sv.stats || {};
      corps += '<h2>Semaine du ' + new Date(sem + 'T12:00:00').toLocaleDateString('fr-FR') + '</h2>';
      corps += '<p class="brief-intention">' + (st.n || 0) + ' défis · ' + (st.actifs || 0) + ' participant(s) actif(s)' + (st.reussite ? ' · réussite ' + st.reussite + '/10' : '') + '</p>';
      if ((sv.competences || []).length) corps += '<p>' + sv.competences.slice(0, 6).map(c => '<span class="ce-chip">' + esc(c.nom) + ' · ' + c.n + '</span>').join(' ') + '</p>';
      if (sv.synthese) corps += '<p>' + esc(sv.synthese) + '</p>';
      if ((sv.points || []).length) corps += '<ul>' + sv.points.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>';
      if (sv.regard) corps += '<p class="ch-regard-pdf"><i>Le regard du coach : ' + esc(sv.regard) + '</i></p>';
    });
    ouvrirImpression('Restitution coach SeedUp · ' + (campagneData.entreprise || '') + ' · ' + (campagneData.nom || codeCampagneCourant), corps);
  }

  // ===== Les compétences de l'équipe : trois réponses (Phase B) =====
  // Entièrement déterministe, calculé en local sur les profils déjà chargés.
  const FAM_COULEURS_CE = (window.Competences && window.Competences.COULEURS_FAMILLES) || { RELATION: '#F98272', ACTION: '#E8951A', STRUCTURE: '#2C97E0', VISION: '#5E59C7' };

  // ===== Le tableau de bord de campagne consolidé (Phase D) =====
  // Un écran : la qualité vécue, la carte des compétences, les preuves
  // d'évolution, le fil du coach. Le document de pilotage hebdomadaire.
  function membresCompetences(){
    return (campagneData.repondants || [])
      .filter(r => String(r.statut || '').toLowerCase().startsWith('termin'))
      .filter(r => String(r.nom || '').toLowerCase().indexOf('test') < 0);
  }

  function renderTableauCampagne(){
    if (!campagneData || !window.Competences) return '';
    const reps = membresCompetences();
    if (reps.length < 2) return '';
    const coll = Competences.collectif(reps.map(r => ({ nom: r.nom || '', bigFive: r.bigFive, ecarts: r.naturelAdapte && r.naturelAdapte.ecarts, dims: r.speDims })));
    if (!coll) return '';
    const moyDe = (arr) => { const v = arr.filter(x => typeof x === 'number'); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
    const nR = moyDe(reps.map(r => r.noteR)), nU = moyDe(reps.map(r => r.noteU)), nC = moyDe(reps.map(r => r.noteC));
    const pTot = reps.reduce((a, r) => a + (r.pariTot || 0), 0), pOk = reps.reduce((a, r) => a + (r.pariOk || 0), 0);
    const fiabs = moyDe(reps.map(r => r.fiabilite && r.fiabilite.score));
    const couts = moyDe(reps.map(r => r.coutUsd));
    const nbSd = reps.filter(r => (r.nbSeedup || 0) > 0).length;
    const kpi = (n, l) => '<div class="sup-kpi"><div class="sup-kpi-n">' + (n === null || n === undefined ? '·' : n) + '</div><div class="sup-kpi-l">' + l + '</div></div>';
    let h = '<div class="panel ce-panel"><div class="ce-head"><div><div class="panel-title">Tableau de bord de campagne</div><div class="panel-sub">La vue consolidée : qualité vécue, compétences, preuves et fil du coach.</div></div><div class="tb-actions"><button class="exp-btn exp-mini" onclick="exporterTableauCampagne()">Exporter (PDF)</button>' + ' <button class="exp-btn exp-mini" id="btn-csv-camp" onclick="exporterCsvCampagne()">CSV de cette campagne</button>' + '</div></div>';
    h += '<div class="sup-kpis tb-kpis">' + kpi(reps.length, 'Terminés') + kpi(nR !== null ? nR + '/5' : null, 'Ressemblance') + kpi(nU !== null ? nU + '/5' : null, 'Actions') + kpi(nC !== null ? nC + '/5' : null, 'Clarté') + kpi(pTot ? Math.round(100 * pOk / pTot) + '%' : null, 'Paris justes') + kpi(fiabs, 'Fiabilité') + kpi(couts !== null ? couts + ' $' : null, 'Coût moyen') + kpi(nbSd, 'Sur SeedUp') + '</div>';
    // La carte des compétences : potentiel (barre) contre expression (curseur)
    if (window.Visuels && (coll.matrice || []).length){
      const zonePour = (p, e) => window.Competences.zoneDe(p, e);
      const compsEq = coll.matrice.map(cm => ({ id: cm.id, nom: cm.nom, famille: cm.famille || ((Competences.REFERENTIEL.find(r => r.id === cm.id) || {}).famille), potentiel: cm.potMoyen, expression: cm.exprMoyenne, zone: zonePour(cm.potMoyen, cm.exprMoyenne), score: cm.potMoyen }));
      const tailles = {}; coll.matrice.forEach(cm => { tailles[cm.id] = cm.nbPorteurs || 1; });
      const topGisements = coll.matrice.slice().sort((a, b2) => b2.dormant - a.dormant).slice(0, 5).map(cm => cm.id);
      h += '<div class="ce-titre">La carte de l\'équipe</div><div class="bd-q16">'
        + window.Visuels.quadrantSvg(compsEq, { compact: true, taille: tailles, labels: topGisements, titreX: 'Potentiel moyen de l\'équipe', titreY: 'Expression moyenne' })
        + '</div><div class="sup-vide">La taille d\'un point suit le nombre de porteurs. Étiquettes : les cinq plus grands gisements.</div>';
    }
    h += '<div class="ce-titre">La carte des compétences de l\'équipe</div><div class="tb-carte">';
    const matTriee = (coll.matrice || []).slice().sort((a, b2) => (b2.dormant * b2.nbPorteurs) - (a.dormant * a.nbPorteurs) || b2.dormant - a.dormant);
    const ligneMat = (c) => '<div class="bd-mat-row"><span class="bd-mat-nom bd-mat-cx" onclick="ouvrirCodex(&quot;' + c.id + '&quot;)" title="Ouvrir la fiche de cette compétence">' + esc(c.nom) + '</span>'
      + '<div class="bd-jauge-bar"><div class="bd-jauge-pot" style="width:' + Math.round(c.potMoyen) + '%"></div><div class="bd-jauge-expr" style="left:' + Math.round(c.exprMoyenne) + '%"></div></div>'
      + '<span class="tb-mat-val">' + Math.round(c.potMoyen) + ' / ' + Math.round(c.exprMoyenne) + '</span></div>';
    h += matTriee.slice(0, 8).map(ligneMat).join('');
    if (matTriee.length > 8){
      h += '<div id="tb-mat-reste" style="display:none">' + matTriee.slice(8).map(ligneMat).join('') + '</div>'
        + '<button type="button" class="bd-mat-btn" id="tb-mat-btn" onclick="toggleMatriceTableau()">Voir les 16 compétences</button>';
    }
    h += '</div><div class="sup-vide">Triées par gisement décroissant. Barre violette : potentiel moyen. Curseur corail : expression moyenne au travail.</div>';
    // Les preuves d'évolution
    const preuves = reps.filter(r => r.remesure && r.naturelAdapte && typeof r.naturelAdapte.moyenneEcart === 'number' && typeof r.remesure.moyenneEcart === 'number');
    if (preuves.length){
      h += '<div class="ce-titre">Les preuves d\'évolution</div><div class="tb-preuves">'
        + preuves.map(r => '<span class="bd-preuve">' + esc(r.nom || '') + ' · ' + r.naturelAdapte.moyenneEcart + ' <span class="bd-preuve-fl">›</span> ' + r.remesure.moyenneEcart + '</span>').join(' ')
        + '</div>';
    }
    // Le fil du coach (les semaines enregistrées)
    const semSauvees = (campagneData.coach && campagneData.coach.semaines) ? Object.keys(campagneData.coach.semaines).sort() : [];
    if (semSauvees.length){
      h += '<div class="ce-titre">Le fil du coach</div>';
      semSauvees.slice(-3).forEach(k => {
        const sv = campagneData.coach.semaines[k];
        if (!sv || !sv.synthese) return;
        h += '<div class="tb-coach"><b>Semaine du ' + new Date(k + 'T12:00:00').toLocaleDateString('fr-FR') + '</b> · ' + esc(sv.synthese) + '</div>';
      });
    }
    h += '</div>';
    return h;
  }

  function toggleMatriceTableau(){
    const d = document.getElementById('tb-mat-reste');
    const b = document.getElementById('tb-mat-btn');
    if (!d) return;
    const ouvert = d.style.display !== 'none';
    d.style.display = ouvert ? 'none' : 'block';
    if (b) b.textContent = ouvert ? 'Voir les 16 compétences' : 'Réduire';
  }

  function exporterTableauCampagne(){
    const html = renderTableauCampagne();
    if (!html) return;
    ouvrirImpression('Tableau de bord · ' + (campagneData.entreprise || '') + ' · ' + (campagneData.nom || codeCampagneCourant), html.replace(/<button[^>]*>[^<]*<\/button>/g, ''));
  }

  async function exporterCsvCampagne(){
    const btn = document.getElementById('btn-csv-camp');
    if (btn){ btn.disabled = true; btn.textContent = 'Export...'; }
    try {
      const rep = await fetch(BACKEND + '?export=participants&campagne=' + encodeURIComponent(codeCampagneCourant), { headers: { 'X-Dashboard-Key': cleAcces } });
      if (!rep.ok) throw new Error('export');
      const blob = await rep.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'participants_campagne.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (btn){ btn.textContent = 'Exporté ✓'; setTimeout(() => { btn.textContent = 'CSV de cette campagne'; btn.disabled = false; }, 2500); }
    } catch (e) {
      if (btn){ btn.textContent = 'Erreur'; setTimeout(() => { btn.textContent = 'CSV de cette campagne'; btn.disabled = false; }, 2500); }
    }
  }


  function renderCompetencesEquipe(){
    if (!window.Competences || !campagneData) return '';
    const membres = (campagneData.repondants || [])
      .filter(r => String(r.statut || '').toLowerCase().startsWith('termin'))
      .filter(r => String(r.nom || '').toLowerCase().indexOf('test') < 0)
      .map(r => ({ nom: r.nom || '', bigFive: r.bigFive, ecarts: r.naturelAdapte && r.naturelAdapte.ecarts, dims: r.speDims }));
    collectifCourant = Competences.collectif(membres);
    if (!collectifCourant) return '';
    const c = collectifCourant;
    const pointFam = (f) => '<span class="ce-dot" style="background:' + (FAM_COULEURS_CE[f] || '#5E59C7') + '"></span>';
    let h = '<div class="panel ce-panel"><div class="ce-head"><div><div class="panel-title">Les compétences de l\'équipe</div><div class="panel-sub">Trois réponses, calculées sur ' + c.effectif + ' profils : qui est fort où, ce que personne ne couvre, où la formation rapporte le plus.</div></div><button class="exp-btn exp-mini" onclick="exporterCompetencesEquipe()">Exporter (PDF)</button></div>';
    // 1. Les référents naturels
    h += '<div class="ce-titre">Les référents naturels</div><div class="ce-refs">';
    c.referents.slice(0, 8).forEach(comp => {
      h += '<div class="ce-ref-row">' + pointFam(comp.famille) + '<span class="ce-ref-comp">' + esc(comp.nom) + '</span><span class="ce-ref-noms">' +
        comp.referents.map(x => '<span class="ce-chip">' + esc(x.nom) + ' · ' + Math.round(x.potentiel) + '</span>').join('') + '</span></div>';
    });
    if (!c.referents.length) h += '<div class="sup-vide">Aucun référent net ne se dégage encore.</div>';
    h += '</div>';
    // 2. Les compétences orphelines
    h += '<div class="ce-titre">Les compétences orphelines</div>';
    if (c.orphelines.length){
      h += '<div class="ce-orph">' + c.orphelines.slice(0, 5).map(o => '<span class="ce-chip ce-chip-orph">' + esc(o.nom) + ' · potentiel max ' + Math.round(o.maxPot) + '</span>').join('') + '</div>';
      h += '<p class="ce-note">Personne dans l\'équipe ne porte le potentiel de ' + (c.orphelines.length > 1 ? 'ces compétences' : 'cette compétence') + ' : le vrai risque structurel, à couvrir par recrutement, binôme externe ou externalisation.</p>';
    } else {
      h += '<p class="ce-note ce-note-ok">Aucune compétence orpheline : l\'équipe couvre l\'ensemble du référentiel. Un atout rare.</p>';
    }
    // 3. Le chantier de formation numéro un
    if (c.chantiers.length){
      const ch = c.chantiers[0];
      const motif = ch.motif === 'potentiel_dormant'
        ? 'Potentiel dormant moyen de +' + ch.dormant + ' points chez ' + ch.nbPorteurs + ' membre' + (ch.nbPorteurs > 1 ? 's' : '') + ' : le moteur est là, la formation prendra vite.'
        : 'Compétence clé au niveau collectif de ' + Math.round(ch.exprMoyenne) + ' avec un potentiel présent : progression réaliste par la pratique guidée.';
      h += '<div class="ce-titre">Le chantier de formation numéro un</div>';
      h += '<div class="ce-chantier">' + pointFam(ch.famille) + '<div class="ce-chantier-corps"><div class="ce-chantier-nom">' + esc(ch.nom) + '</div><p class="ce-note">' + motif + '</p>' +
        (c.chantiers.length > 1 ? '<div class="ce-runners">Ensuite : ' + c.chantiers.slice(1).map(x => '<span class="ce-chip">' + esc(x.nom) + '</span>').join(' ') + '</div>' : '') +
        '</div>' +
        (SUPER ? '<button class="analyse-cta-btn ce-btn" onclick="lancerBriefChantier()">Lancer le brief de campagne sur ce chantier</button>' : '') +
        '</div>';
    }
    h += '</div>';
    return h;
  }

  function lancerBriefChantier(){
    if (!collectifCourant || !collectifCourant.chantiers.length) return;
    axesForces = collectifCourant.chantiers.map(x => x.nom);
    const zone = document.getElementById('brief-zone');
    if (zone) zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
    genererBrief();
  }

  function exporterCompetencesEquipe(){
    if (!collectifCourant) return;
    const c = collectifCourant;
    let corps = '<p>Analyse déterministe sur ' + c.effectif + ' profils terminés. Le potentiel vient de la nature, l\'expression du comportement au travail.</p>';
    corps += '<h2>Les référents naturels</h2><ul>' + c.referents.map(comp => '<li><b>' + esc(comp.nom) + '</b> : ' + comp.referents.map(x => esc(x.nom) + ' (potentiel ' + Math.round(x.potentiel) + ')').join(', ') + '</li>').join('') + '</ul>';
    corps += '<h2>Les compétences orphelines</h2>' + (c.orphelines.length
      ? '<ul>' + c.orphelines.map(o => '<li><b>' + esc(o.nom) + '</b> : potentiel maximal ' + Math.round(o.maxPot) + ' dans l\'équipe</li>').join('') + '</ul><p>À couvrir par recrutement, binôme externe ou externalisation.</p>'
      : '<p>Aucune : l\'équipe couvre l\'ensemble du référentiel.</p>');
    if (c.chantiers.length){
      corps += '<h2>Les chantiers de formation</h2><ul>' + c.chantiers.map((ch, i) => '<li><b>' + (i + 1) + '. ' + esc(ch.nom) + '</b> : ' + (ch.motif === 'potentiel_dormant' ? 'potentiel dormant moyen de +' + ch.dormant + ' points chez ' + ch.nbPorteurs + ' membre(s)' : 'niveau collectif ' + Math.round(ch.exprMoyenne) + ', potentiel présent') + '</li>').join('') + '</ul>';
    }
    ouvrirImpression('Compétences de l\'équipe · ' + (campagneData.entreprise || '') + ' · ' + (campagneData.nom || codeCampagneCourant), corps);
  }

  function chargerBriefDevSauve(idx){

    const m = (typeof repsCourants !== 'undefined' && repsCourants[idx]) || (campagneData && campagneData.repondants ? campagneData.repondants[idx] : null);
    if (!m || !m.email || !window.Competences) return;
    fetch(PROG_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load_interactions', email: m.email }) })
      .then(r => r.json())
      .then(d => {
        const bd = d && d.interactions && d.interactions.brief_dev;
        const zone = document.getElementById('bd-zone');
        if (!zone) return;
        if (!bd || !bd.brief){
          // Sans brief sauvegardé, la matrice déterministe est déjà consultable
          if (m.bigFive && m.bigFive.O !== null && m.bigFive.O !== undefined){
            const comps = Competences.scorer(m.bigFive, m.naturelAdapte && m.naturelAdapte.ecarts, m.speDims);
            zone.innerHTML = '<button type="button" class="bd-mat-btn" id="bd-mat-btn" onclick="toggleMatrice()">Voir la matrice des 16 compétences</button>'
              + '<div id="bd-matrice" style="display:none">' + matriceHtml({ _comps: comps }) + '</div>';
          }
          return;
        }
        if (bd.poste) document.querySelectorAll('.bd-poste').forEach(x => x.classList.toggle('on', x.getAttribute('data-p') === bd.poste));
        briefDevCourant = bd.brief;
        briefDevCourant._m = m;
        briefDevCourant._poste = bd.posteNom || bd.poste || '';
        briefDevCourant._pri = bd.pri || { appuis: [], opportunites: [], vigilances: [] };
        briefDevCourant._seedupActif = (m.nbSeedup || 0) > 0;
        briefDevCourant._date = bd.date || '';
        briefDevCourant._comps = Competences.scorer(m.bigFive, m.naturelAdapte && m.naturelAdapte.ecarts, m.speDims);
        briefDevCourant._compsApres = (m.remesure && m.remesure.ecarts) ? Competences.scorer(m.bigFive, m.remesure.ecarts, m.speDims) : null;
        briefDevCourant._pistes = m.pistesLibelles || [];
        attacherRegards(briefDevCourant, m);
        briefDevCourant._evolution = calculerEvolution(m);
        zone.innerHTML = rendreBriefDev(briefDevCourant) +
          '<div class="bd-export"><button class="exp-btn exp-mini" onclick="exporterBriefDev()">Exporter en PDF</button></div>';
      })
      .catch(() => {});
  }

  // La preuve d'évolution : coût d'adaptation d'origine contre dernière re-mesure
  function calculerEvolution(m){
    const na = m.naturelAdapte;
    if (!m.remesure || !na || typeof na.moyenneEcart !== 'number' || typeof m.remesure.moyenneEcart !== 'number') return null;
    return {
      avant: na.moyenneEcart, apres: m.remesure.moyenneEcart,
      coutAvant: na.cout || '', coutApres: m.remesure.cout || '',
      date: m.remesure.date ? new Date(m.remesure.date).toLocaleDateString('fr-FR') : '',
    };
  }

  const ZONES_MAT = { appui: 'Appui', opportunite: 'Opportunité', neutre: 'Neutre', economie: 'Économie' };
  // ===== Le codex des compétences : la fiche référence, façon bibliothèque =====
  const DIMS_LIBELLES = { delegation: 'Délégation', feedback: 'Feedback', cadrage: 'Cadrage', posture: 'Posture', closing: 'Closing', objection: 'Objection' };
  const TRAITS_FR = { O: 'Ouverture', C: 'Conscience', E: 'Extraversion', A: 'Agréabilité', N: 'Stabilité émotionnelle', S: 'Stabilité émotionnelle' };
  // ===== La mission au coach : un apprenant ou tout le groupe =====
  // ===== L'incarnation : ouvrir l'espace d'un apprenant comme si on était lui =====
  function copierLienApprenant(idx, btn){
    const m = repsCourants[idx];
    if (!m || !m.email) return;
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    fetch(LIEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cle: cleAcces, email: m.email }) })
      .then(function (r2) { return r2.json(); })
      .then(function (dj) {
        if (dj && dj.ok && dj.lien) {
          const fini = function () { if (btn) { btn.textContent = 'Copié ✓'; setTimeout(function () { btn.disabled = false; btn.textContent = label; }, 1800); } };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(dj.lien).then(fini, function () { window.prompt('Copiez le lien :', dj.lien); fini(); });
          else { window.prompt('Copiez le lien :', dj.lien); fini(); }
        } else {
          if (btn) { btn.disabled = false; btn.textContent = label; }
          alert((dj && dj.error) || 'Lien indisponible.');
        }
      })
      .catch(function () { if (btn) { btn.disabled = false; btn.textContent = label; } alert('Réseau indisponible.'); });
  }

  function voirCommeApprenant(idx, btn){
    const m = repsCourants[idx];
    if (!m || !m.email) return;
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Ouverture...'; }
    fetch(LIEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cle: cleAcces, email: m.email }) })
      .then(function (r2) { return r2.json(); })
      .then(function (dj) {
        if (btn) { btn.disabled = false; btn.textContent = label; }
        if (dj && dj.ok && dj.lien) window.open(dj.lien, '_blank');
        else alert((dj && dj.error) || 'Lien indisponible.');
      })
      .catch(function () { if (btn) { btn.disabled = false; btn.textContent = label; } alert('Réseau indisponible.'); });
  }

  function ouvrirEnvoiCoach(mode, idx){
    const m = mode === 'apprenant' ? repsCourants[idx] : null;
    if (mode === 'apprenant' && (!m || !m.email)) return;
    const membres = mode === 'groupe' ? repsCourants.filter(function (r) { return r && r.email; }) : [];
    if (mode === 'groupe' && !membres.length) { alert('Aucun membre avec email dans cette campagne.'); return; }
    const recap = mode === 'apprenant'
      ? 'Le coach recevra la synthèse de <b>' + esc(m.nom || m.email) + '</b> et le lien vers son analyse complète.'
      : 'Le coach recevra le brief de <b>' + esc(entrepriseCourante || 'la campagne') + '</b> : ' + membres.length + ' profils, chacun avec son archétype et le lien vers son analyse complète.';
    const html = '<div class="fm-overlay" onclick="if(event.target===this)this.remove()"><div class="fm-card ec-card">'
      + '<button class="fm-close" onclick="this.closest(&quot;.fm-overlay&quot;).remove()">×</button>'
      + '<div class="cx-nom">Envoyer au coach</div>'
      + '<p class="cx-def">' + recap + '</p>'
      + '<label class="ec-lab">Email du coach</label><input type="email" id="ec-email" class="ec-in" placeholder="prenom.nom@exemple.fr"/>'
      + '<label class="ec-lab">Nom du coach <i>(facultatif)</i></label><input type="text" id="ec-nom" class="ec-in" placeholder="Marco Dalla Palma"/>'
      + '<label class="ec-lab">Votre message <i>(facultatif, en tête de l\'email)</i></label><textarea id="ec-msg" class="ec-in ec-txt" placeholder="Contexte de la mission, dates, attentes..."></textarea>'
      + '<button type="button" class="ec-btn" id="ec-btn" onclick="envoyerCoach(&quot;' + mode + '&quot;,' + (idx == null ? 'null' : idx) + ')">Envoyer la mission</button>'
      + '<p class="ec-etat" id="ec-etat"></p>'
      + '<button type="button" class="ec-diag" onclick="testerConfigEnvoi()">Vérifier la configuration d\'envoi</button>'
      + '<p class="ec-diag-r" id="ec-diag-r"></p>'
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    const inp = document.getElementById('ec-email');
    if (inp) inp.focus();
  }
  function testerConfigEnvoi(){
    const zone = document.getElementById('ec-diag-r');
    if (!zone) return;
    zone.textContent = 'Interrogation du back...';
    fetch(DIAG_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cle: cleAcces }) })
      .then(function (r2) { return r2.json(); })
      .then(function (dj) {
        if (!dj || !dj.presentes) { zone.textContent = (dj && dj.error) || 'Vérificateur indisponible : déployez le back v42.'; return; }
        const p = dj.presentes;
        zone.innerHTML = 'Brevo : <b>' + (p.BREVO_API_KEY ? 'configurée ✓' : 'ABSENTE sur ce back ✗') + '</b>'
          + ' · Expéditeur : <b>' + (p.BREVO_EXPEDITEUR ? 'personnalisé' : 'défaut Sinéa') + '</b>'
          + ' · PDFShift : <b>' + (p.PDFSHIFT_API_KEY ? '✓' : '✗') + '</b>'
          + ' · IA : <b>' + (p.ANTHROPIC_API_KEY ? '✓' : '✗') + '</b>'
          + (p.BREVO_API_KEY ? '' : '<br/>La clé Brevo vit ailleurs (autre projet Vercel ou autre nom). Ajoutez BREVO_API_KEY au projet du back puis redéployez.');
      })
      .catch(function () { zone.textContent = 'Réseau indisponible.'; });
  }

  function envoyerCoach(mode, idx){
    const email = (document.getElementById('ec-email') || {}).value || '';
    const etat = document.getElementById('ec-etat');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { if (etat) etat.textContent = 'Email du coach invalide.'; return; }
    const btn = document.getElementById('ec-btn');
    btn.disabled = true;
    btn.textContent = 'Envoi en cours...';
    const corps = {
      cle: cleAcces,
      mode: mode,
      coach: { email: email.trim(), nom: ((document.getElementById('ec-nom') || {}).value || '').trim() },
      message: ((document.getElementById('ec-msg') || {}).value || '').trim(),
    };
    if (mode === 'apprenant') {
      const m = repsCourants[idx];
      corps.apprenant = { email: m.email, nom: m.nom || '' };
    } else {
      corps.groupe = { campagne: entrepriseCourante, membres: repsCourants.filter(function (r) { return r && r.email; }).map(function (r) { return { email: r.email, nom: r.nom || '' }; }) };
    }
    fetch(COACH_ENVOI_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      .then(function (r2) { return r2.json(); })
      .then(function (dj) {
        if (dj && dj.ok) {
          const carte = document.querySelector('.ec-card');
          if (carte) carte.innerHTML = '<div class="cx-nom">Mission envoyée</div><p class="cx-def">Le coach a reçu « ' + esc(dj.sujet || '') + ' ».</p>';
          setTimeout(function () { const ov = document.querySelector('.fm-overlay'); if (ov) ov.remove(); }, 2400);
        } else {
          if (etat) etat.textContent = (dj && dj.error) || 'Envoi impossible.';
          btn.disabled = false;
          btn.textContent = 'Envoyer la mission';
        }
      })
      .catch(function () { if (etat) etat.textContent = 'Réseau indisponible.'; btn.disabled = false; btn.textContent = 'Envoyer la mission'; });
  }

  function rejouerQ16(input){
    const t = Math.max(0, Math.min(100, Number(input.value))) / 100;
    const box = input.closest('.bd-q16') || document;
    box.querySelectorAll('.q16-mv').forEach(g => {
      const y0 = Number(g.getAttribute('data-cy0'));
      const y1 = Number(g.getAttribute('data-cy1'));
      const y = (y0 + (y1 - y0) * t).toFixed(1);
      g.querySelectorAll('circle').forEach(c2 => c2.setAttribute('cy', y));
    });
  }

  // ===== L'organiseur : cinq onglets narratifs par reconnaissance des panneaux =====
  const PT_TABS = [['pilotage', 'Le poste de pilotage'], ['equipe', 'Les personnes'], ['dynamiques', 'La dynamique collective'], ['competences', 'Compétences & codex'], ['coach', 'Le coach']];
  function cibleOnglet(el){
    let t = '';
    if (el.querySelector) { const h = el.querySelector('.panel-title, .section-label, .archetype-label'); if (h) t = h.textContent || ''; }
    if (!t && el.classList && (el.classList.contains('section-label') || el.classList.contains('archetype-banner'))) t = el.textContent || '';
    if (el.classList && el.classList.contains('archetype-banner')) return 'pilotage';
    if (/Tableau de bord|Santé/i.test(t)) return 'pilotage';
    if (/membres de l'équipe|Positionnement des membres|carte de chaleur|adéquation au poste/i.test(t)) return 'equipe';
    if (/Composition de l'équipe|Répartition par famille|Profil Big Five|Risques en situation|Style naturel|binômes|Angles morts|Pilotage humain/i.test(t)) return 'dynamiques';
    if (/compétences de l'équipe/i.test(t)) return 'competences';
    if (/coach/i.test(t)) return 'coach';
    return null;
  }
  function organiserOnglets(cont){
    if (!cont || cont.querySelector('.pt-nav')) return;
    const enfants = Array.from(cont.children);
    let debut = -1;
    for (let i = 0; i < enfants.length; i++) { if (cibleOnglet(enfants[i])) { debut = i; break; } }
    if (debut < 0) return;
    const pages = {};
    PT_TABS.forEach(function (p2) { const dv = document.createElement('div'); dv.className = 'pt-page'; dv.setAttribute('data-pt', p2[0]); pages[p2[0]] = dv; });
    let courant = 'pilotage';
    enfants.slice(debut).forEach(function (e2) { const c2 = cibleOnglet(e2); if (c2) courant = c2; pages[courant].appendChild(e2); });
    const nav = document.createElement('div');
    nav.className = 'pt-nav';
    nav.innerHTML = PT_TABS.map(function (p2) { return '<button type="button" class="pt-b" data-pt="' + p2[0] + '" onclick="ptTab(&quot;' + p2[0] + '&quot;)">' + p2[1] + '</button>'; }).join('');
    cont.appendChild(nav);
    PT_TABS.forEach(function (p2) { cont.appendChild(pages[p2[0]]); });
    try { pages.pilotage.insertAdjacentHTML('afterbegin', stripEssentielHtml()); } catch (e) {}
    try { pages.competences.insertAdjacentHTML('beforeend', renderCodexGrid()); } catch (e) {}
    ptTab('pilotage');
  }
  function ptTab(t){
    document.querySelectorAll('.pt-page').forEach(function (p2) { p2.classList.toggle('on', p2.getAttribute('data-pt') === t); });
    document.querySelectorAll('.pt-b').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-pt') === t); });
  }
  // Le bandeau essentiel : quatre faits calculés, zéro IA
  function stripEssentielHtml(){
    try {
      const reps = membresCompetences();
      if (!reps.length || !window.Competences) return '';
      const faits = ['<b>' + reps.length + '</b> profils analysés'];
      // Le fit ne s'affiche que face à un vrai référentiel : le poste sur mesure
      const coefsCustom = posteCustomCourant ? coefsPoste('custom') : null;
      if (coefsCustom) {
        const fits = reps.map(function (r) { return { r: r, f: fitPoste(compsDe(r), coefsCustom) }; }).filter(function (x) { return x.f; });
        if (fits.length) {
          const moy = Math.round(fits.reduce(function (a, x) { return a + x.f.score; }, 0) / fits.length);
          const top = fits.slice().sort(function (a, b) { return b.f.score - a.f.score; })[0];
          faits.push('Fit au poste sur mesure : <b>' + moy + '%</b> en moyenne');
          faits.push('Meilleur fit : <b>' + esc(top.r.nom || '') + '</b> (' + top.f.score + '%)');
        }
      }
      // La qualité vécue, dès que des avis existent
      const notes = reps.filter(function (r) { return typeof r.noteR === 'number' || Number(r.noteR) >= 1; });
      if (notes.length) {
        const moyN = function (cle) { const v = notes.map(function (r) { return Number(r[cle]); }).filter(function (x) { return x >= 1; }); return v.length ? (v.reduce(function (a, b) { return a + b; }, 0) / v.length).toFixed(1) : null; };
        const mR = moyN('noteR'), mU = moyN('noteU'), mC = moyN('noteC');
        if (mR) faits.push('Qualité vécue : <b>' + mR + '</b> ressemblance · <b>' + (mU || '·') + '</b> utilité · <b>' + (mC || '·') + '</b> clarté (' + notes.length + ' avis)');
      }
      const SEU = Competences.SEUILS;
      const dormants = {};
      donneesHeat().forEach(function (l) {
        Object.entries(l.par).forEach(function (e2) { if (e2[1].p >= SEU.potAppui && e2[1].e < SEU.exprAppui) dormants[e2[0]] = (dormants[e2[0]] || 0) + 1; });
      });
      const gis = Object.entries(dormants).sort(function (a, b) { return b[1] - a[1]; })[0];
      const gisRef = gis ? Competences.REFERENTIEL.find(function (r2) { return r2.id === gis[0]; }) : null;
      if (gisRef) faits.push('Gisement n°1 : <b>' + esc(gisRef.nom) + '</b> (' + gis[1] + ' potentiels dormants)');
      return '<div class="pt-strip"><span class="pt-s-k">L\'essentiel</span>' + faits.map(function (f2) { return '<span class="pt-s-i">' + f2 + '</span>'; }).join('') + '<button type="button" class="pt-s-btn" onclick="ouvrirEnvoiCoach(&quot;groupe&quot;)">Envoyer au coach</button></div>';
    } catch (e) { return ''; }
  }
  // La grille du codex : la bibliothèque enfin visible
  function renderCodexGrid(){
    if (!window.Competences || !Competences.CODEX) return '';
    return '<div class="panel ce-panel"><div class="panel-title">Le codex des compétences</div>'
      + '<div class="panel-sub">La bibliothèque vivante des seize : trajectoire en quatre paliers, questions d\'entretien, et le regard incarné quand une fiche est ouverte.</div>'
      + '<div class="cxg">' + Competences.REFERENTIEL.map(function (r2) {
          const coul = (Competences.COULEURS_FAMILLES || {})[r2.famille] || '#8A879B';
          return '<button type="button" class="cxg-c" onclick="ouvrirCodex(&quot;' + r2.id + '&quot;)"><i style="background:' + coul + '"></i><b>' + esc(r2.nom) + '</b><span>' + esc((r2.def || '').slice(0, 74)) + '…</span></button>';
        }).join('') + '</div></div>';
  }

  function chargerIncarne(id){
    const zone = document.getElementById('cx-incarne');
    if (!zone || !membreFicheCourant || !membreFicheCourant.email || !window.Competences) return;
    const ref = Competences.REFERENTIEL.find(function (r2) { return r2.id === id; });
    if (!ref) return;
    zone.innerHTML = '<p class="cx-inc cx-inc-load">Néa observe le profil...</p>';
    const poidsStr = Object.entries(ref.poids || {}).sort(function (a, b) { return b[1] - a[1]; }).map(function (p2) { return p2[0] + ' ' + Math.round(p2[1] * 100) + '%'; }).join(', ');
    fetch(CODEX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cle: cleAcces, email: membreFicheCourant.email, compId: id, compNom: ref.nom, compDef: ref.def || '', poids: poidsStr }),
    }).then(function (r2) { return r2.json(); }).then(function (dj) {
      if (dj && dj.ok && dj.txt) zone.innerHTML = '<p class="cx-inc">' + esc(dj.txt) + '</p>' + (dj.cache ? '<p class="cx-inc-cache">Servi depuis le cache, généré une seule fois.</p>' : '');
      else zone.innerHTML = '<p class="cx-inc-err">Génération indisponible (' + esc((dj && dj.error) || 'inconnu') + ').</p>';
    }).catch(function () { zone.innerHTML = '<p class="cx-inc-err">Réseau indisponible, réessayez.</p>'; });
  }

  function ouvrirCodex(id){
    if (!window.Competences) return;
    const ref = Competences.REFERENTIEL.find(r => r.id === id);
    if (!ref) return;
    const coul = (Competences.COULEURS_FAMILLES || {})[ref.famille] || '#8A879B';
    const poids = Object.entries(ref.poids || {}).sort((a, b) => b[1] - a[1]).map(([t, p]) => (TRAITS_FR[t] || t) + ' ' + Math.round(p * 100) + '%').join(' · ');
    const dims = Object.entries(Competences.DIMS_VERS_COMPETENCES || {}).filter(([, ids]) => (ids || []).indexOf(id) >= 0).map(([dk]) => DIMS_LIBELLES[dk] || dk);
    let mesure = '', cc = null;
    try {
      const comps = membreFicheCourant ? compsDe(membreFicheCourant) : null;
      cc = comps ? comps.find(x => x.id === id) : null;
      if (cc) mesure = '<div class="cx-mesure"><span>Chez ' + esc(membreFicheCourant.prenom || membreFicheCourant.nom || 'ce membre') + '</span><b>nature ' + Math.round(cc.potentiel) + ' · travail ' + Math.round(cc.expression) + '</b><i class="bd-mat-zone z-' + cc.zone + '">' + (ZONES_MAT[cc.zone] || cc.zone) + '</i></div>';
    } catch (e) {}
    // La trajectoire de développement, quatre paliers vécus
    const cx = Competences.CODEX && Competences.CODEX[id];
    const palCourant = cc ? Competences.palierDe(cc.expression) : 0;
    const trajectoire = cx
      ? '<div class="cx-t">La trajectoire</div>' + cx.paliers.map(function (p2, i) {
          const num = i + 1;
          const etat = palCourant ? (num < palCourant ? ' fait' : (num === palCourant ? ' on' : '')) : '';
          return '<div class="cx-pal' + etat + '"><b>' + num + '. ' + Competences.PALIERS_NOMS[i] + (num === palCourant ? ' · vous êtes ici' : '') + '</b><p>' + esc(p2[0]) + '</p><em>' + (num === palCourant ? 'Votre prochain pas : ' : 'Défi : ') + esc(p2[1]) + '</em></div>';
        }).join('')
      : '';
    const facs = Competences.FACETTES && Competences.FACETTES[id];
    const facettesHtml = facs
      ? '<div class="cx-t">Les deux facettes</div>' + facs.map(function (f) {
          return '<div class="cx-fac"><b>' + esc(f.nom) + '</b><p>' + esc(f.def) + '</p><ul>' + f.defis.map(function (d2) { return '<li>' + esc(d2) + '</li>'; }).join('') + '</ul></div>';
        }).join('')
      : '';
    const entretienHtml = cx
      ? '<div class="cx-t">À explorer en entretien ou en 1:1</div><ul class="cx-prog">' + cx.entretien.map(function (q2) { return '<li>' + esc(q2) + '</li>'; }).join('') + '</ul>'
      : '';
    const incarneHtml = (membreFicheCourant && membreFicheCourant.email)
      ? '<div class="cx-t">Chez ' + esc(membreFicheCourant.prenom || 'cette personne') + ', en vrai</div><div id="cx-incarne"><button type="button" class="cx-inc-btn" onclick="chargerIncarne(&quot;' + id + '&quot;)">Écrire le regard incarné</button></div>'
      : '';
    const html = '<div class="fm-overlay" onclick="if(event.target===this)this.remove()"><div class="fm-card cx-card">'
      + '<button class="fm-close" onclick="this.closest(&quot;.fm-overlay&quot;).remove()">×</button>'
      + '<div class="cx-kicker" style="color:' + coul + '">' + esc(ref.famille) + '</div>'
      + '<div class="cx-nom">' + esc(ref.nom) + '</div>'
      + '<p class="cx-def">' + esc(ref.def || '') + '</p>'
      + mesure
      + '<div class="cx-t">Ce qui la nourrit</div><p class="cx-txt">' + poids + '</p>'
      + (dims.length ? '<div class="cx-t">Dimensions métier liées</div><p class="cx-txt">' + dims.join(' · ') + '</p>' : '')
      + '<div class="cx-t">Pour progresser</div><ul class="cx-prog">' + (ref.progresser || []).map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>'
      + trajectoire
      + facettesHtml
      + entretienHtml
      + incarneHtml
      + '<p class="cx-note">Potentiel : la facilité intrinsèque, lue sur le profil naturel. Expression : le comportement déclaré au travail, affiné par les dimensions métier.</p>'
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function deltasBrief(b){
    if (!b || !b._comps || !b._compsApres) return null;
    const d = {};
    b._compsApres.forEach(ap => {
      const av = b._comps.find(x => x.id === ap.id);
      if (av) d[ap.id] = { avant: av.expression, apres: ap.expression };
    });
    return d;
  }

  // ===== Sprint 2 : le fit au poste =====
  // Cibles d'expression par importance : déterminante 75, utile 60, secondaire 45.
  const cibleDe = (coef) => window.Competences.cibleDe(coef);
  function coefsPoste(posteId){
    if (posteId === 'custom') return chargerPosteCustom();
    const p = window.Competences && Competences.POSTES && Competences.POSTES[posteId];
    return p ? p.coefs : null;
  }
  let compsCache = new WeakMap();   // par membre, remis à zéro à chaque campagne
  function compsDe(m){
    if (!window.Competences || !m || !m.bigFive) return null;
    if (compsCache.has(m)) return compsCache.get(m);
    const c = Competences.scorer(m.bigFive, m.naturelAdapte && m.naturelAdapte.ecarts, m.speDims);
    compsCache.set(m, c);
    return c;
  }
  const fitPoste = (comps, coefs) => window.Competences.fitPoste(comps, coefs);
  function palierFit(sc){ return sc >= 80 ? 'haut' : sc >= 60 ? 'mi' : 'bas'; }

  // Le fit dans la fiche membre, recalculé au choix de la pastille de poste
  let membreFicheCourant = null;
  function majFitFiche(){
    const zone = document.getElementById('bd-fit');
    const m = membreFicheCourant;
    if (!zone || !m) return;
    const posteEl = document.querySelector('.bd-poste.on');
    const poste = posteEl ? posteEl.getAttribute('data-p') : 'manager';
    const coefs = coefsPoste(poste);
    if (!coefs){
      zone.innerHTML = poste === 'custom' ? '<div class="bd-fit-note">Définissez le profil cible sur mesure ci-dessus pour mesurer l\'adéquation.</div>' : '';
      return;
    }
    const compsM = compsDe(m);
    const fit = fitPoste(compsM, coefs);
    let projFiche = null;
    try {
      const engages = new Set((m.pistesLibelles || []).map(l2 => { const mm = Competences.matcherCompetence(l2 || ''); return mm && mm.id; }).filter(Boolean));
      if (engages.size && compsM) {
        const f2 = fitPoste(Competences.projeterComps(compsM, engages), coefs);
        if (f2 && fit && f2.score > fit.score) projFiche = f2.score;
      }
    } catch (e) {}
    if (!fit){ zone.innerHTML = ''; return; }
    zone.innerHTML = '<div class="bd-fit"><span class="bd-fit-score s-' + palierFit(fit.score) + '">' + fit.score + '%</span><span class="bd-fit-lab">d\'adéquation au poste sélectionné</span></div>'
      + (fit.gaps.length
        ? '<div class="bd-fit-gaps">' + fit.gaps.map(g => '<span class="bd-gap">' + esc(g.nom) + ' <b>' + g.exp + '</b><i>/' + g.cible + '</i>' + (g.moteur ? '<u title="Le potentiel est là : développable par la pratique">moteur présent</u>' : '') + '</span>').join('') + '</div>'
        : '<div class="bd-fit-gaps"><span class="bd-gap bd-gap-ok">Aucun écart sur les compétences déterminantes</span></div>');
    if (projFiche) zone.insertAdjacentHTML('beforeend', '<div class="bd-fit-proj">À 90 jours, engagements tenus : <b>' + projFiche + '%</b> <i>(hypothèse d\'ancrage, plafonnée par le potentiel)</i></div>');
    try {
      if (fit && fit.gaps && fit.gaps.length && window.Competences && Competences.CODEX) {
        const qs = fit.gaps.map(function (g) { const cx2 = Competences.CODEX[g.id]; return cx2 ? '<li><b>' + esc(g.nom) + '</b> · ' + esc(cx2.entretien[0]) + '</li>' : ''; }).join('');
        if (qs) zone.insertAdjacentHTML('beforeend', '<div class="cx-t" style="margin-top:10px">À explorer en entretien ou en 1:1</div><ul class="cx-prog bd-fit-qs">' + qs + '</ul>');
      }
    } catch (e) {}
  }

  // ===== Sprint 2 : la carte de chaleur de l'équipe =====
  const ABREV_COMP = { ecoute_active: 'Écoute', cooperation: 'Coop.', communication_influence: 'Influ.', developpement_autres: 'Dévl.', orientation_resultats: 'Résul.', prise_decision: 'Décis.', initiative: 'Initi.', resilience: 'Résil.', organisation: 'Organ.', rigueur: 'Rigue.', fiabilite_suivi: 'Fiabi.', analyse: 'Analy.', vision_strategique: 'Visio.', creativite: 'Créat.', adaptabilite: 'Adapt.', apprentissage: 'Appre.' };
  let heatTri = null;
  function donneesHeat(){
    return membresCompetences().map(r => {
      const comps = compsDe(r);
      if (!comps) return null;
      const par = {}; comps.forEach(c => { par[c.id] = { e: c.expression, p: c.potentiel }; });
      return { idx: repsCourants.indexOf(r), nom: r.nom || '', par: par };
    }).filter(Boolean);
  }
  function heatTable(){
    if (!window.Competences) return '';
    const refs = Competences.REFERENTIEL;
    let lignes = donneesHeat();
    if (!lignes.length) return '';
    if (heatTri) lignes = lignes.slice().sort((a, b) => ((b.par[heatTri] || {}).e || 0) - ((a.par[heatTri] || {}).e || 0));
    else lignes = lignes.slice().sort((a, b) => a.nom.localeCompare(b.nom));
    let h = '<table class="heat"><thead><tr><th class="heat-nom"></th>'
      + refs.map(rf => '<th class="heat-th' + (heatTri === rf.id ? ' on' : '') + '" onclick="triHeat(\'' + rf.id + '\')" title="' + esc(rf.nom) + ' · cliquer pour trier"><span>' + (ABREV_COMP[rf.id] || rf.id) + '</span></th>').join('')
      + '</tr></thead><tbody>';
    lignes.forEach(l => {
      h += '<tr><td class="heat-nom" onclick="ouvrirMembre(' + l.idx + ')">' + esc(l.nom) + '</td>'
        + refs.map(rf => {
          const v = l.par[rf.id] || { e: 0, p: 0 };
          const a = (0.06 + 0.74 * Math.max(0, Math.min(100, v.e)) / 100).toFixed(2);
          const SEU = window.Competences.SEUILS;
          const dormant = v.p >= SEU.potAppui && v.e < SEU.exprAppui;
          return '<td class="heat-c" style="background:rgba(94,89,199,' + a + ')" title="' + esc(rf.nom) + ' · expression ' + Math.round(v.e) + ' · potentiel ' + Math.round(v.p) + '">' + (dormant ? '<i class="heat-dot" title="Potentiel dormant"></i>' : '') + '</td>';
        }).join('') + '</tr>';
    });
    return h + '</tbody></table>';
  }
  function triHeat(id){
    heatTri = heatTri === id ? null : id;
    const z = document.getElementById('tb-heat');
    if (z) z.innerHTML = heatTable();
  }
  function renderHeatmapEquipe(){
    if (!window.Competences) return '';
    const t = heatTable();
    if (!t) return '';
    return '<div class="panel ce-panel"><div class="panel-title">La carte de chaleur de l\'équipe</div>'
      + '<div class="panel-sub">Chaque cellule teinte l\'expression au travail. Le point ambré signale un potentiel dormant. Cliquez une colonne pour trier, un nom pour ouvrir la fiche.</div>'
      + '<div class="heat-wrap" id="tb-heat">' + t + '</div>'
      + '<div class="heat-leg"><span class="heat-leg-grad"></span><span>expression 0 › 100</span><i class="heat-dot"></i><span>potentiel dormant</span></div></div>';
  }

  // ===== Sprint 2 : l'adéquation au poste, l'arme du staffing =====
  let fitPosteChoisi = null;
  function renderFitListe(){
    const coefs = coefsPoste(fitPosteChoisi);
    if (!coefs){
      return '<div class="empty">Le profil sur mesure de cette entreprise attend sa définition : ouvrez une fiche, pastille Sur mesure, Définir le profil cible.</div>';
    }
    const lignes = membresCompetences().map(r => {
      const comps = compsDe(r);
      const fit = fitPoste(comps, coefs);
      if (!fit) return null;
      let proj = null;
      try {
        const engages = new Set((r.pistesLibelles || []).map(l2 => { const mm = Competences.matcherCompetence(l2 || ''); return mm && mm.id; }).filter(Boolean));
        if (engages.size && comps) {
          const f2 = fitPoste(Competences.projeterComps(comps, engages), coefs);
          if (f2 && f2.score > fit.score) proj = f2.score;
        }
      } catch (e) {}
      return { idx: repsCourants.indexOf(r), nom: r.nom || '', fit: fit, proj: proj };
    }).filter(Boolean).sort((a, b) => b.fit.score - a.fit.score);
    if (!lignes.length) return '<div class="empty">Aucun profil terminé à évaluer.</div>';
    return lignes.map((l, i) =>
      '<div class="fit-row" onclick="ouvrirMembre(' + l.idx + ')">'
      + '<span class="fit-rang">' + (i + 1) + '</span>'
      + '<span class="fit-nom">' + esc(l.nom) + '</span>'
      + '<span class="fit-rail">' + (l.proj ? '<i class="fit-proj" style="width:' + l.proj + '%"></i>' : '') + '<i class="fit-barre f-' + palierFit(l.fit.score) + '" style="width:' + l.fit.score + '%"></i></span>'
      + '<span class="fit-score">' + l.fit.score + '%' + (l.proj ? '<em class="fit-projtag" title="Hypothèse : engagements tenus 90 jours (+' + Competences.BOOST_PROJECTION + ' pts d\'expression, plafonnés par le potentiel)">→ ' + l.proj + '% à 90 j</em>' : '') + '</span>'
      + '<span class="fit-gaps">' + l.fit.gaps.slice(0, 2).map(g => '<em>' + esc(g.nom) + ' ' + g.exp + '/' + g.cible + '</em>').join('') + '</span>'
      + '</div>').join('');
  }
  function renderFitPoste(){
    if (!window.Competences) return '';
    if (membresCompetences().length < 2) return '';
    if (!fitPosteChoisi) fitPosteChoisi = posteCustomCourant ? 'custom' : 'manager';
    const chips = [['manager', 'Manager'], ['commercial', 'Commercial'], ['expert', 'Expert'], ['custom', 'Sur mesure']]
      .map(([id, lab]) => '<button type="button" class="bd-poste fitp' + (fitPosteChoisi === id ? ' on' : '') + '" data-p="' + id + '" aria-pressed="' + (fitPosteChoisi === id) + '" onclick="choisirFitPoste(this)">' + lab + '</button>').join('');
    return '<div class="panel ce-panel"><div class="panel-title">L\'adéquation au poste</div>'
      + '<div class="panel-sub">Le classement de l\'équipe face au référentiel du poste, avec les écarts sur les compétences déterminantes. Moteur présent signifie que le potentiel y est : la pratique fera le reste.</div>'
      + '<div class="fit-chips">' + chips + '</div>'
      + '<div id="fit-liste">' + renderFitListe() + '</div></div>';
  }
  function choisirFitPoste(btn){
    fitPosteChoisi = btn.getAttribute('data-p');
    document.querySelectorAll('.fitp').forEach(b => { b.classList.toggle('on', b === btn); b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
    const z = document.getElementById('fit-liste');
    if (z) z.innerHTML = renderFitListe();
  }

  function matriceHtml(b){
    // La carte des 16 en tête, le détail ligne à ligne dessous
    const dts = deltasBrief(b);
    const enTete = (window.Visuels && b && b._comps)
      ? '<div class="bd-q16">' + window.Visuels.quadrantSvg(b._comps, { compact: true, deltas: dts })
        + (dts ? '<div class="q16-slider"><span>J0</span><input type="range" id="bd-q16-t" min="0" max="100" value="100" oninput="rejouerQ16(this)" aria-label="Rejouer les 90 jours"><span>J90</span></div>' : '')
        + '</div>'
      : '';
    const comps = b._comps || [];
    if (!comps.length) return '';
    return enTete + comps.map(c =>
      '<div class="bd-mat-row"><span class="bd-mat-nom bd-mat-cx" onclick="ouvrirCodex(&quot;' + c.id + '&quot;)" title="Ouvrir la fiche de cette compétence">' + esc(c.nom) + '</span>' +
      '<div class="bd-jauge-bar"><div class="bd-jauge-pot" style="width:' + Math.round(c.potentiel) + '%"></div><div class="bd-jauge-expr" style="left:' + Math.round(c.expression) + '%"></div></div>' +
      '<span class="tb-mat-val">' + Math.round(c.potentiel) + ' / ' + Math.round(c.expression) + '</span>' +
      ((b._regards && typeof b._regards.vals[c.id] === 'number') ? '<span class="bd-mat-oeil" title="Vu par ' + b._regards.n + ' regards">&#128065; ' + Math.round(b._regards.vals[c.id]) + '</span>' : '') +
      '<span class="bd-mat-zone z-' + c.zone + '">' + (ZONES_MAT[c.zone] || c.zone) + '</span></div>'
    ).join('');
  }
  function toggleMatrice(){
    const d = document.getElementById('bd-matrice');
    const b = document.getElementById('bd-mat-btn');
    if (!d) return;
    const ouvert = d.style.display !== 'none';
    d.style.display = ouvert ? 'none' : 'block';
    if (b) b.textContent = ouvert ? 'Voir la matrice des 16 compétences' : 'Masquer la matrice';
  }

  function squeletteHtml(n){
    let h = '<div class="sq-wrap">';
    for (let i = 0; i < (n || 3); i++) h += '<div class="sq-ligne" style="width:' + (92 - i * 14) + '%"></div>';
    return h + '</div>';
  }

  // Le regard des pairs par compétence : items directs prioritaires,
  // dérivation par les traits perçus sinon (même formule que l'expression).
  function attacherRegards(b, m){
    b._regards = null;
    if (!m || !m.miroir || m.miroir.n < 2 || !window.Competences) return;
    const cles = m.miroir.cles || {};
    const traitsOk = ['E', 'A', 'C', 'S', 'O'].every(k => typeof cles[k] === 'number');
    const derive = traitsOk ? Competences.expressionDepuis({ E: cles.E, A: cles.A, C: cles.C, S: cles.S, O: cles.O }) : {};
    const vals = {};
    Competences.REFERENTIEL.forEach(ref => {
      if (typeof cles['c_' + ref.id] === 'number') vals[ref.id] = cles['c_' + ref.id];
      else if (typeof derive[ref.id] === 'number') vals[ref.id] = derive[ref.id];
    });
    if (Object.keys(vals).length) b._regards = { n: m.miroir.n, vals: vals };
  }

  function jaugeComp(c){
    return '<div class="bd-jauge"><span class="bd-jauge-lab">Potentiel ' + Math.round(c.potentiel) + '</span><div class="bd-jauge-bar"><div class="bd-jauge-pot" style="width:' + Math.round(c.potentiel) + '%"></div><div class="bd-jauge-expr" style="left:' + Math.round(c.expression) + '%"></div></div><span class="bd-jauge-lab">Expression ' + Math.round(c.expression) + '</span></div>';
  }

  function rendreBriefDev(b){
    const pri = b._pri || { appuis: [], opportunites: [], vigilances: [] };
    const trouve = (liste, nom) => liste.find(c => c.nom === nom) || null;
    let h = '<div class="bd-brief">';
    if (b._date) h += '<div class="bd-date">Brief du ' + esc(new Date(b._date).toLocaleDateString('fr-FR')) + ' · poste ' + esc(b._poste || '') + ' · regénérez pour actualiser</div>';
    if (b._evolution) h += '<div class="bd-preuve">Preuve d\'évolution · coût d\'adaptation ' + b._evolution.avant + ' <span class="bd-preuve-fl">›</span> ' + b._evolution.apres + (b._evolution.coutApres ? ' (' + esc(b._evolution.coutApres) + ')' : '') + (b._evolution.date ? ' · re-mesuré le ' + esc(b._evolution.date) : '') + '</div>';
    h += '<div class="bd-accroche">' + esc(b.accroche || '') + '</div>';
    h += '<div class="bd-titre-sec">Forces d\'appui</div>';
    (b.appuis || []).forEach(a => {
      const c = trouve(pri.appuis, a.competence);
      h += '<div class="bd-carte bd-appui"><div class="bd-comp">' + esc(a.competence) + '</div>' + (c ? jaugeComp(c) : '') + '<p class="bd-usage">' + esc(a.usage || '') + '</p></div>';
    });
    h += '<div class="bd-titre-sec">Opportunités à investir</div>';
    (b.opportunites || []).forEach(o => {
      const c = trouve(pri.opportunites, o.competence);
      h += '<div class="bd-carte bd-opp"><div class="bd-comp">' + esc(o.competence) + '</div>' + (c ? jaugeComp(c) : '')
        + '<p class="bd-pourquoi">' + esc(o.pourquoi || '') + '</p>'
        + '<p class="bd-levier"><b>Levier :</b> ' + esc(o.levier || '') + '</p>'
        + (o.offre ? '<span class="bd-offre">' + esc(o.offre) + '</span>' : '');
      if (c && b._compsApres){
        const ap = b._compsApres.find(x => x.nom === o.competence);
        if (ap && ap.expression - c.expression >= 3){
          h += '<p class="bd-opp-evo">Preuve terrain : expression ' + Math.round(c.expression) + ' › ' + Math.round(ap.expression) + ' depuis la re-mesure.</p>';
        }
      }
      if (window.Competences && Array.isArray(b._pistes)){
        const act = b._pistes.find(a => { const mm = Competences.matcherCompetence(a); return mm && mm.nom === o.competence; });
        if (act) h += '<p class="bd-opp-action">Son action choisie « ' + esc(act.length > 80 ? act.slice(0, 80) + '…' : act) + ' » travaille déjà cette opportunité.</p>';
      }
      h += '</div>';
    });
    if ((b.vigilances || []).length){
      h += '<div class="bd-titre-sec">Vigilances de staffing</div>';
      b.vigilances.forEach(v => {
        h += '<div class="bd-carte bd-vigi"><div class="bd-comp">' + esc(v.competence) + '</div><p class="bd-usage">' + esc(v.strategie || '') + '</p></div>';
      });
    }
    // Le bloc SeedUp : actif quand les défis existent, vitrine grisée sinon
    const defisHtml = (b.opportunites || []).map(o =>
      (o.defis && o.defis.length) ? '<div class="bd-defi-ligne"><b>' + esc(o.competence) + '</b> : ' + o.defis.map(esc).join(' · ') + '</div>' : ''
    ).join('');
    if (b._seedupActif){
      h += '<div class="bd-seedup on"><div class="bd-seedup-head">SeedUp · Ancrage comportemental <span class="bd-badge-on">Actif · ' + ((b._m && b._m.nbSeedup) || 0) + ' défis réalisés</span></div>'
        + '<p class="bd-seedup-txt">Les opportunités ci-dessus se travaillent sur le terrain. Défis types à pousser :</p>' + defisHtml + '</div>';
    } else {
      h += '<div class="bd-seedup off"><div class="bd-seedup-head">SeedUp · Ancrage comportemental <span class="bd-badge-off">Non activé sur cette campagne</span></div>'
        + '<p class="bd-seedup-txt">Avec SeedUp, ces opportunités deviennent des défis de terrain de 5 minutes, personnalisés à son archétype, avec un débrief coach hebdomadaire et une preuve d\'évolution mesurée à 90 jours. Aperçu de ce que ' + esc((b._m && String(b._m.nom || '').split(' ')[0]) || 'la personne') + ' recevrait :</p>'
        + defisHtml + '</div>';
    }
    h += '<div class="bd-conclusion">' + esc(b.conclusion || '') + '</div>';
    h += '<button type="button" class="bd-mat-btn" id="bd-mat-btn" onclick="toggleMatrice()">Voir la matrice des 16 compétences</button>';
    h += '<div id="bd-matrice" style="display:none">' + matriceHtml(b) + '</div>';
    h += '</div>';
    return h;
  }

  function exporterBriefDev(){
    if (!briefDevCourant) return;
    const m = briefDevCourant._m || {};
    const corps = rendreBriefDev(briefDevCourant)
      .replace('id="bd-matrice" style="display:none"', 'id="bd-matrice"')
      .replace('>Voir la matrice des 16 compétences<', ' style="display:none">Matrice<');
    ouvrirImpression('Brief de développement · ' + (m.nom || '') + ' · ' + (briefDevCourant._poste || ''), '<div class="bd-brief-pdf">' + corps + '</div>');
  }

  // La matière calculée du portail, embarquée dans le portrait PDF
  function extraPortrait(m){
    try {
      const comps = compsDe(m);
      if (!comps || !window.Visuels) return {};
      const fam = { RELATION: [], ACTION: [], STRUCTURE: [], VISION: [] };
      comps.forEach(function (c2) { if (fam[c2.famille]) fam[c2.famille].push(c2.potentiel); });
      const familles = {};
      Object.keys(fam).forEach(function (k) { familles[k] = fam[k].length ? Math.round(fam[k].reduce(function (a, b) { return a + b; }, 0) / fam[k].length) : 0; });
      const zones = { appui: 0, levier: 0, gisement: 0, economie: 0 };
      comps.forEach(function (c2) { if (zones[c2.zone] != null) zones[c2.zone]++; });
      return { familles: familles, zones: zones, pistes: (m.pistesLibelles || []).slice(0, 6), quadrant: Visuels.quadrantSvg(comps, { compact: true }) };
    } catch (e) { return {}; }
  }

  async function telechargerPortraitMembre(idx){
    const m = repsCourants[idx];
    const btn = document.getElementById('fm-pdf-btn');
    if(!m || !m.email || !btn) return;
    const texte = btn.textContent;
    btn.textContent = 'Génération…'; btn.disabled = true;
    try{
      const rep = await fetch(PDF_PORTRAIT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cle: cleAcces, email: m.email, extra: extraPortrait(m) }) });
      if(!rep.ok) throw new Error('indisponible');
      const blob = await rep.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'Portrait_' + (m.nom||'membre').replace(/\s+/g,'_') + '.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 4000);
      btn.textContent = 'Téléchargé ✓';
      setTimeout(()=>{ btn.textContent = texte; btn.disabled = false; }, 3000);
    }catch(e){
      btn.textContent = 'Réessayer'; btn.disabled = false;
    }
  }


  function detruireCharts(){ for(const k in charts){ try{charts[k].destroy();}catch(e){} } charts={}; }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function initiales(nom){ const p=(nom||'').trim().split(/\s+/); return ((p[0]||'')[0]||'')+((p[1]||'')[0]||''); }

  function tenterConnexion(){
    const key = document.getElementById('login-key').value.trim();
    const err = document.getElementById('login-err');
    if(!key){ err.textContent='Entrez votre clé d\'accès.'; return; }
    err.textContent='Vérification...';
    fetch(BACKEND+'?liste=ensemble',{headers:{'X-Dashboard-Key':key}})
      .then(r=>{ if(r.status===401) throw new Error('cle'); return r.json(); })
      .then(data=>{
        cleAcces=key;
        document.getElementById('login').classList.add('hidden');
        document.getElementById('app').classList.add('active');
        afficherEnsemble(data);
      })
      .catch(e=>{ err.textContent=(e.message==='cle')?'Clé d\'accès incorrecte.':'Connexion impossible. Réessayez.'; });
  }
  function deconnexion(){ location.reload(); }

  function rechargerEnsemble(){
    const content=document.getElementById('content');
    content.innerHTML=`<div class="loading"><div class="spinner"></div><div>Chargement...</div></div>`;
    fetch(BACKEND+'?liste=ensemble',{headers:{'X-Dashboard-Key':cleAcces}}).then(r=>r.json()).then(afficherEnsemble);
  }

  // ====== VUE D'ENSEMBLE ======
  function afficherEnsemble(data){
    detruireCharts();
    SUPER = !!data.superAdmin;
    superData = data;
    const entreprises = data.entreprises || [];
    let html = `
      ${SUPER ? `<div class="super-badge">Sinéa · Super admin · vue transverse de tous les portails</div>` : ``}
      ${SUPER ? renderOnglets() : ``}
      <div class="stats-band">
        <div class="stat"><div class="stat-bar"></div><div class="stat-num">${entreprises.length}</div><div class="stat-lab">Entreprises</div></div>
        <div class="stat"><div class="stat-bar"></div><div class="stat-num">${data.totalCampagnes||0}</div><div class="stat-lab">Campagnes actives</div></div>
        <div class="stat"><div class="stat-bar"></div><div class="stat-num">${data.totalTermines||0}</div><div class="stat-lab">Profils analysés</div></div>
      </div>
      <div class="section-label">Vos entreprises</div>
      <div class="ent-grid">`;
    if(!entreprises.length) html += `<div class="empty">Aucune campagne pour le moment.</div>`;
    for(const ent of entreprises){
      html += `<div class="ent-card">
        <div class="ent-card-head">
          <div class="ent-name"><span class="bullet"></span>${esc(ent.entreprise)}</div>
          <div class="ent-info">${ent.totalTermines||0} profil${(ent.totalTermines||0)>1?'s':''} · ${(ent.campagnes||[]).length} campagne${(ent.campagnes||[]).length>1?'s':''}</div>
        </div>
        <div class="ent-campaigns">`;
      for(const c of (ent.campagnes||[])){
        const fams=c.familles||{}; const totF=FAM_ORDER.reduce((s,f)=>s+(fams[f]||0),0)||1;
        const chips=FAM_ORDER.map(f=>{const v=fams[f]||0;if(!v)return '';const w=Math.max(8,Math.round(v/totF*110));return `<span class="fam-chip" style="background:${FAM_COLORS[f]};width:${w}px"></span>`;}).join('');
        const pct=c.quota?Math.min(100,Math.round((c.utilisations||0)/c.quota*100)):0;
        const type=(c.type||'classic').toLowerCase();
        html += `<div class="camp-line" onclick="ouvrirCampagne('${esc(c.code||'')}')">
          <div class="camp-line-main">
            <div class="camp-line-top"><span class="camp-line-name">${esc(c.nom||'Sans nom')}</span><span class="camp-badge ${type}">${esc(type)}</span></div>
            <div class="camp-line-code">${esc(c.code||'')}</div>
            <div class="camp-line-fams">${chips}</div>
          </div>
          <div class="camp-line-right">
            <div class="camp-line-count">${c.nbTermines||0}<small> / ${c.quota||'∞'}</small></div>
            <div class="camp-line-gauge"><i style="width:${pct}%"></i></div>
          </div>
          <div class="camp-line-arrow">›</div>
        </div>`;
      }
      html += `</div></div>`;
    }
    html += `</div>`;
    document.getElementById('content').innerHTML = html;
    if (SUPER){
      const nav = document.getElementById('sup-onglets');
      if (nav){
        const camp = document.createElement('div'); camp.id = 'tab-campagne'; camp.className = 'tab-page';
        while (nav.nextSibling) camp.appendChild(nav.nextSibling);
        nav.insertAdjacentElement('afterend', camp);
        const qual = document.createElement('div'); qual.id = 'tab-qualite'; qual.className = 'tab-page';
        qual.innerHTML = renderPanneauQualite(data);
        nav.insertAdjacentElement('afterend', qual);
        const appr = document.createElement('div'); appr.id = 'tab-apprenant'; appr.className = 'tab-page';
        appr.innerHTML = renderPanneauApprenant();
        nav.insertAdjacentElement('afterend', appr);
        basculerOnglet(ongletCourant || 'campagne');
      }
    }
  }

  // ====== VUE CAMPAGNE (waouh) ======
  let fichePendingEmail = null;   // fiche à ouvrir automatiquement après chargement de la campagne
  function ouvrirDepuisPassation(el){
    const campNom = el.getAttribute('data-camp') || '';
    const email = el.getAttribute('data-email') || '';
    let code = '';
    ((superData && superData.entreprises) || []).forEach(e => (e.campagnes || []).forEach(c => { if (c.nom === campNom && !code) code = c.code; }));
    if (!code) return;
    fichePendingEmail = email;
    ouvrirCampagne(code);
  }

  function ouvrirCampagne(code){
    codeCampagneCourant = code;
    codeCampagneActuelle = code;
    detruireCharts();
    const content=document.getElementById('content');
    content.innerHTML=`<div class="loading"><div class="spinner"></div><div>Chargement de la campagne...</div></div>`;
    fetch(BACKEND+'?campagne='+encodeURIComponent(code),{headers:{'X-Dashboard-Key':cleAcces}})
      .then(r=>r.json()).then(afficherCampagne)
      .catch(()=>{ content.innerHTML=`<div class="empty">Erreur de chargement. <a onclick="rechargerEnsemble()" style="color:var(--c-purple-text);cursor:pointer">Retour</a></div>`; });
  }

  // ===== Sélection par équipe : la RH coche/décoche des membres pour une vue filtrée =====
  let campagneData = null;        // données complètes reçues du backend
  let selectionEquipe = null;     // Set des indices (dans data.repondants) des membres inclus dans la vue
  function indicesTermines(repsTous){
    const out=[]; (repsTous||[]).forEach((r,i)=>{ if(String(r.statut||'').toLowerCase().startsWith('termin')) out.push(i); });
    return out;
  }
  function trierMembres(btn){
    const mode = btn.getAttribute('data-tri');
    document.querySelectorAll('.tri-btn').forEach(function (b) { b.classList.toggle('on', b === btn); });
    const grid = document.querySelector('#content .membres-grid');
    if (!grid) return;
    const items = Array.from(grid.querySelectorAll('.membre'));
    const rangFam = function (f) { const i = FAM_ORDER.indexOf(f); return i < 0 ? 99 : i; };
    items.sort(function (a, b) {
      if (mode === 'nom') return (a.getAttribute('data-nom') || '').localeCompare(b.getAttribute('data-nom') || '');
      if (mode === 'famille') {
        const df = rangFam(a.getAttribute('data-fam')) - rangFam(b.getAttribute('data-fam'));
        return df !== 0 ? df : (a.getAttribute('data-nom') || '').localeCompare(b.getAttribute('data-nom') || '');
      }
      return Number(a.getAttribute('data-ordre') || 0) - Number(b.getAttribute('data-ordre') || 0);
    });
    items.forEach(function (m) { grid.appendChild(m); });
  }
  function copierRelance(lien){
    const txt = "Bonjour, votre profil Sinéa vous attend. Douze minutes suffisent pour découvrir votre archétype et vos leviers. Voici votre lien " + lien;
    const fini = function(){ const z = document.getElementById('attente-ok'); if (z){ z.textContent = 'Copié ✓'; setTimeout(function(){ z.textContent = ''; }, 2200); } };
    if (navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(fini).catch(function(){}); return; }
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove(); fini();
  }
  function filtrerMembres(q){
    const norme = String(q || '').toLowerCase().trim();
    document.querySelectorAll('#content .membre').forEach(function (m) {
      const t = (m.textContent || '').toLowerCase();
      m.style.display = (!norme || t.indexOf(norme) >= 0) ? '' : 'none';
    });
  }
  function toggleMembre(i){
    if(!selectionEquipe) return;
    if(selectionEquipe.has(i)) selectionEquipe.delete(i); else selectionEquipe.add(i);
    renderCampagneVue();
  }
  function selectionTous(){ selectionEquipe = new Set(indicesTermines((campagneData||{}).repondants)); renderCampagneVue(); }
  function selectionAucun(){ selectionEquipe = new Set(); renderCampagneVue(); }

  function afficherCampagne(data){
    compsCache = new WeakMap();
    // Le référentiel de poste de l'entreprise se charge en arrière-plan
    posteCustomCourant = null;
    entrepriseCourante = (data && data.entreprise) || entrepriseCourante;
    if (data && data.entreprise){
      fetch(POSTE_CIBLE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': cleAcces },
        body: JSON.stringify({ action: 'charger', entreprise: data.entreprise }) })
        .then(r => r.json())
        .then(d => {
          if (d && d.ok && d.coefs){
            posteCustomCourant = d.coefs;
            try { localStorage.setItem(clePosteCustom(data.entreprise), JSON.stringify(d.coefs)); } catch (e) {}
          }
        })
        .catch(() => {});
    }
    campagneData = data;
    selectionEquipe = null; // nouvelle campagne : tout le monde est sélectionné
    renderCampagneVue();
  }

  function renderCampagneVue(){
    const data = campagneData || {};
    detruireCharts();
    const camp=data.campagne||{}; const repsTous=data.repondants||[];
    const idxTerm = indicesTermines(repsTous);
    if(selectionEquipe===null) selectionEquipe = new Set(idxTerm);
    const filtreActif = selectionEquipe.size < idxTerm.length;
    // les calculs de la vue portent sur la sélection ; la liste des membres montre tout le monde
    const reps = repsTous.filter((r,i)=> selectionEquipe.has(i));
    // stats recalculées sur la sélection (familles, terminés)
    const statsBack = data.stats||{};
    const famSel = {RELATION:0,ACTION:0,STRUCTURE:0,VISION:0};
    reps.forEach(r=>{ const f=(r.famille||'').toUpperCase(); if(famSel[f]!==undefined) famSel[f]++; });
    const stats = { total: statsBack.total||0, termines: reps.length, familles: famSel };
    const fams=stats.familles||{}; const totF=FAM_ORDER.reduce((s,f)=>s+(fams[f]||0),0)||1;
    const termines=stats.termines||0; const total=stats.total||0;
    const pctComplet=total?Math.round((statsBack.termines||0)/total*100):0;
    // famille dominante
    let famDom='RELATION',famMax=-1; FAM_ORDER.forEach(f=>{if((fams[f]||0)>famMax){famMax=fams[f]||0;famDom=f;}});
    const type=(camp.type||'classic').toLowerCase();

    let html = `
      <div class="breadcrumb"><a onclick="rechargerEnsemble()">Vos entreprises</a><span class="sep">›</span>${esc(camp.entreprise||'')}<span class="sep">›</span><strong style="color:var(--c-dark)">${esc(camp.nom||'')}</strong></div>

      <div class="camp-hero">
        <div class="camp-hero-kicker">${esc(camp.entreprise||'')} · ${esc(type)}</div>
        <div class="camp-hero-title">${esc(camp.nom||'')}</div>
        <div class="camp-hero-sub">${filtreActif ? `Vue d'équipe filtrée : ${termines} profil${termines>1?'s':''} sélectionné${termines>1?'s':''} sur ${idxTerm.length}.` : `Photographie de l'équipe à partir de ${termines} profil${termines>1?'s':''} analysé${termines>1?'s':''}.`}</div>
        <div class="camp-hero-kpis">
          <div><div class="kpi-big-num">${termines}</div><div class="kpi-big-lab">${filtreActif?'Profils sélectionnés':'Profils analysés'}</div></div>
          <div><div class="kpi-big-num">${pctComplet}%</div><div class="kpi-big-lab">Taux de complétion</div></div>
          <div><div class="kpi-big-num" style="color:${FAM_COLORS[famDom]}">${FAM_LABELS[famDom]}</div><div class="kpi-big-lab">Famille dominante</div></div>
          <div><div class="kpi-big-num">${camp.quota||'∞'}</div><div class="kpi-big-lab">Quota de la campagne</div></div>
        </div>
      </div>`;

    if(termines===0){
      html += `<div class="empty">Aucun profil terminé pour cette campagne.</div>`;
      document.getElementById('content').innerHTML=html;
    try { organiserOnglets(document.getElementById('content')); } catch (e) { console.warn('[Sinéa]', e); }
      return;
    }

    // ===== ANALYSE : graphique + texte côte à côte =====
    const ad = analyserEquipe(reps);
    const bf=stats.moyenneBigFive||{};

    // ===== ARCHÉTYPE D'ÉQUIPE (identité collective) =====
    if(ad){
      const arch=archetypeEquipe(ad);
      html += `
      <div class="archetype-banner">
        <div class="archetype-glow"></div>
        <div class="archetype-label">L'identité de cette équipe</div>
        <div class="archetype-nom">${esc(arch.nom)}</div>
        <div class="archetype-essence">${esc(arch.essence)}</div>
        <div class="archetype-tags">
          <span class="archetype-tag" style="background:${FAM_COLORS[arch.dom]}">${FAM_LABELS[arch.dom]}</span>
          ${arch.second && ad.familles.pct[arch.second]>0?`<span class="archetype-tag" style="background:${FAM_COLORS[arch.second]}">${FAM_LABELS[arch.second]}</span>`:''}
        </div>
      </div>`;
    }

    // SECTION 1 — Familles (donut + texte)
    html += `
      <div class="section-label" style="margin-top:6px">Composition de l'équipe</div>
      <div class="duo">
        <div class="panel duo-visuel">
          <div class="panel-title">Répartition par famille</div>
          <div class="panel-sub">Les 4 familles Sinéa présentes dans l'équipe.</div>
          <div class="chart-box"><canvas id="chartDonut"></canvas></div>
          <div class="fam-legend">${FAM_ORDER.map(f=>{const v=fams[f]||0;const p=Math.round(v/totF*100);return `<div class="fam-legend-row"><span class="fam-legend-dot" style="background:${FAM_COLORS[f]}"></span><span class="fam-legend-name">${FAM_LABELS[f]}</span><span class="fam-legend-bar"><i style="width:${p}%;background:${FAM_COLORS[f]}"></i></span><span class="fam-legend-pct">${v} · ${p}%</span></div>`;}).join('')}</div>
        </div>
        <div class="panel duo-texte">
          <div class="duo-texte-titre"><span class="dot" style="background:${ad?FAM_COLORS[ad.familles.dominante]:'#999'}"></span>Profil collectif</div>
          <div class="ad-texte">${ad?texteFamilles(ad):''}</div>
        </div>
      </div>`;

    // SECTION 2 — Tempérament (radar Big Five + texte)
    html += `
      <div class="section-label">Tempérament de l'équipe</div>
      <div class="duo">
        <div class="panel duo-visuel">
          <div class="panel-title">Profil Big Five</div>
          <div class="panel-sub">La forme de personnalité moyenne, et l'écart entre les membres.</div>
          <div class="chart-box tall"><canvas id="chartRadarBF"></canvas></div>
        </div>
        <div class="panel duo-texte">
          <div class="duo-texte-titre"><span class="dot" style="background:var(--c-bleu-violet)"></span>Personnalité dominante</div>
          <div class="ad-texte">${ad?texteBigFive(ad):''}</div>
          ${ad?`<div class="ad-extremes-compact">${BF_KEYS.map(k=>{const e=ad.extremes[k];const lab=k==='N'?'Stabilité':BF_LABELS[k];const hv=k==='N'?100-e.haut.val:e.haut.val;return `<div class="ad-extc"><span class="ad-extc-lab">${lab}</span><span class="ad-extc-val">${esc(e.haut.nom.split(' ')[0])} · ${hv}</span></div>`;}).join('')}</div>`:''}
        </div>
      </div>`;

    // SECTION 3 — Cartographie premium (nuage de points + texte)
    html += `
      <div class="section-label">Cartographie de l'équipe</div>
      <div class="duo">
        <div class="panel duo-visuel">
          <div class="panel-title">Positionnement des membres</div>
          <div class="panel-sub">Chaque membre placé selon son orientation et son énergie.</div>
          <p class="carto-lecture">Chaque point est un membre, plac\u00e9 par son profil. L'horizontale va de l'orientation relation \u00e0 l'orientation t\u00e2che, la verticale de la r\u00e9flexion pos\u00e9e \u00e0 l'\u00e9nergie d'action. Survolez un point pour lire le membre et sa position.</p>
          <div class="carto-wrap">
            <div class="carto-axe-y haut">Action</div>
            <div class="carto-axe-y bas">Réflexion</div>
            <div class="carto-axe-x gauche">Relation</div>
            <div class="carto-axe-x droite">Tâche</div>
            <div class="carto-quad tl">Action + relation</div>
            <div class="carto-quad tr">Action + tâche</div>
            <div class="carto-quad bl">Réflexion + relation</div>
            <div class="carto-quad br">Réflexion + tâche</div>
            <div class="chart-box tall"><canvas id="chartCarto"></canvas></div>
          </div>
        </div>
        <div class="panel duo-texte">
          <div class="duo-texte-titre"><span class="dot" style="background:var(--c-pink)"></span>Lecture de la carte</div>
          <div class="ad-texte">${ad?texteCartographie(ad,reps):''}</div>
        </div>
      </div>`;

    // ===== ANALYSES AVANCÉES (données riches : contextuel, naturel/adapté) =====
    const membres_av = membresValides(reps);
    if(membres_av.length>=2){
      const compl=complementarite(membres_av);
      const rStress=risquesStress(membres_av);
      const binomes=meilleursBinomes(membres_av);
      const angles=anglesMorts(membres_av, fams);
      const natTrav=naturelVsTravail(membres_av);
      const axes=axesFormation(membres_av, fams);

      // Complémentarité (avec jauge %)
      if(compl){
        html += `
        <div class="section-label">Complémentarité</div>
        <div class="panel" style="margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:26px;flex-wrap:wrap;margin-bottom:16px">
            <div class="compl-cercle"><b>${compl.score}%</b><span>complémentarité</span></div>
            <div style="flex:1;min-width:240px">
              <div class="compl-sous"><span>Couverture des registres</span><div class="compl-bar"><i style="width:${compl.scoreFam}%"></i></div><b>${compl.scoreFam}%</b></div>
              <div class="compl-sous"><span>Dispersion des tempéraments</span><div class="compl-bar"><i style="width:${compl.scoreDisp}%"></i></div><b>${compl.scoreDisp}%</b></div>
              ${compl.scoreCtx!=null?`<div class="compl-sous"><span>Variété des modes (stress, conflit...)</span><div class="compl-bar"><i style="width:${compl.scoreCtx}%"></i></div><b>${compl.scoreCtx}%</b></div>`:''}
            </div>
          </div>
          <div class="ad-texte">${texteComplementarite(compl, membres_av)}</div>
        </div>`;
      }

      // Risques sous stress
      if(rStress){
        html += `
        <div class="section-label">Sous pression</div>
        <div class="panel" style="margin-bottom:20px">
          <div class="panel-title">Risques en situation de stress</div>
          <div class="panel-sub">Déduits des modes de réaction réels mesurés sur ${rStress.basesCtx||0} membre${(rStress.basesCtx||0)>1?'s':''}${rStress.basesAdapte?` et des coûts d'adaptation de ${rStress.basesAdapte}`:''}.</div>
          <div class="reco-grid">
            ${rStress.risques.map(r=>`<div class="risque-item"><div class="risque-titre">${esc(r.titre)}</div><div class="reco-desc">${esc(r.desc)}</div></div>`).join('')}
          </div>
        </div>`;
      }

      // Naturel vs travail
      if(natTrav && natTrav.items.length){
        html += `
        <div class="panel" style="margin-bottom:20px">
          <div class="panel-title">Style naturel et style au travail</div>
          <div class="panel-sub">L'écart entre la nature profonde de chacun et sa posture professionnelle, mesuré sur ${natTrav.bases} membre${natTrav.bases>1?'s':''}.</div>
          ${natTrav.synthese?`<div class="ad-texte" style="margin-bottom:16px">${esc(natTrav.synthese)}</div>`:''}
          <div class="nat-grid">
            ${natTrav.items.map(i=>{const c=(i.cout||'').indexOf('lev')>=0?'eleve':((i.cout||'').indexOf('mod')>=0?'modere':'faible');return `<div class="nat-item nat-${c}"><div class="nat-cout">${esc(i.cout||'?')}</div><div class="reco-desc">${esc(i.texte)}</div></div>`;}).join('')}
          </div>
        </div>`;
      }

      // Binômes
      if(binomes && binomes.length){
        html += `
        <div class="section-label">Collaborations</div>
        <div class="panel" style="margin-bottom:20px">
          <div class="panel-title">Les binômes à fort potentiel</div>
          <div class="panel-sub">Les paires dont les profils se complètent le mieux, pour les projets à deux ou les parrainages.</div>
          <div class="binome-grid">
            ${binomes.map((b,i)=>`<div class="binome-item"><div class="binome-rang">${i+1}</div><div><div class="binome-noms">${esc(b.a.split(' ')[0])} + ${esc(b.b.split(' ')[0])}</div><div class="reco-desc">${b.raisons.map(r=>esc(r)).join(' · ')}</div></div></div>`).join('')}
          </div>
        </div>`;
      }

      // Angles morts
      if(angles && angles.length){
        html += `
        <div class="panel" style="margin-bottom:20px">
          <div class="panel-title">Angles morts</div>
          <div class="panel-sub">Ce que la composition de l'équipe ne couvre pas naturellement.</div>
          <div class="reco-grid">
            ${angles.map(a=>`<div class="angle-item"><div class="risque-titre">${esc(a.titre)}</div><div class="reco-desc">${esc(a.desc)}</div></div>`).join('')}
          </div>
        </div>`;
      }

      // Axes de formation
      if(axes && axes.length){
        html += `
        <div class="section-label">Développement</div>
        <div class="panel" style="margin-bottom:20px">
          <div class="panel-title">Axes de développement et de formation</div>
          <div class="panel-sub">Déduits des écarts d'adaptation réels et des registres peu couverts.</div>
          <div class="reco-grid">
            ${axes.map((a,i)=>`<div class="reco-item"><div class="reco-num" style="background:var(--g-purpleblue)">${i+1}</div><div class="reco-body"><div class="reco-titre">${esc(a.titre)}</div><div class="reco-desc">${esc(a.desc)}</div><div class="reco-sinea"><span class="reco-sinea-tag">Le levier Sinéa</span>${esc(parcoursSinea(a.titre))}</div></div></div>`).join('')}
          </div>
          <a class="reco-cta" href="https://sineaformation.fr" target="_blank" rel="noopener">Construire le parcours de formation de cette équipe avec Sinéa</a>
        </div>`;
      }

      // ===== ANALYSES DES NOUVELLES DIMENSIONS (énergie, collaboration, autorité, reconnaissance) =====
      const aEnergie=analyseEnergieEq(membres_av);
      const aCollab=analyseCollabEq(membres_av);
      const aAutorite=analyseAutoriteEq(membres_av);
      const aReco=analyseRecoEq(membres_av);
      const blocsDim=[];
      if(aEnergie) blocsDim.push({label:"Rythmes de l'équipe",sub:`Profils d'énergie · modèle SMART · sur ${aEnergie.total} membre${aEnergie.total>1?'s':''}`,risques:aEnergie.risques});
      if(aCollab) blocsDim.push({label:"Modes de collaboration",sub:`Comment l'équipe travaille ensemble · sur ${aCollab.total} membre${aCollab.total>1?'s':''}`,risques:aCollab.risques});
      if(aAutorite) blocsDim.push({label:"Besoins de management",sub:`Rapport au cadre · Self-Determination Theory · sur ${aAutorite.total} membre${aAutorite.total>1?'s':''}`,risques:aAutorite.risques});
      if(aReco) blocsDim.push({label:"Leviers de reconnaissance",sub:`Ce qui motive l'équipe · Self-Determination Theory · sur ${aReco.total} membre${aReco.total>1?'s':''}`,risques:aReco.risques});
      if(blocsDim.length){
        html += `<div class="section-label">Pilotage humain</div>`;
        blocsDim.forEach(b=>{
          html += `
          <div class="panel" style="margin-bottom:16px">
            <div class="panel-title">${esc(b.label)}</div>
            <div class="panel-sub">${esc(b.sub)}</div>
            <div class="reco-grid">
              ${b.risques.map(r=>`<div class="angle-item"><div class="risque-titre">${esc(r.titre)}</div><div class="reco-desc">${esc(r.desc)}</div></div>`).join('')}
            </div>
          </div>`;
        });
      }
    }

    // ===== RECOMMANDATIONS D'ACTIVATION =====
    if(ad){
      const recos=recommandationsActivation(ad);
      html += `
      <div class="section-label">Activer cette équipe</div>
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-title">Que faire avec cette typologie de profils</div>
        <div class="panel-sub">Des leviers concrets pour piloter et tirer le meilleur de cette équipe.</div>
        <div class="reco-grid">
          ${recos.map((r,i)=>`<div class="reco-item"><div class="reco-num">${i+1}</div><div class="reco-body"><div class="reco-titre">${esc(r.titre)}</div><div class="reco-desc">${esc(r.desc)}</div></div></div>`).join('')}
        </div>
      </div>`;
    }

    // ===== SWOT DATA + INDICATEURS =====
    if(ad){
      const sw=swotData(ad);
      const inds=indicateurs(ad);
      const liSW=arr=>arr.map(x=>`<li>${esc(x)}</li>`).join('');
      html += `
      <div class="section-label">Forces et vigilances</div>
      <div class="panel" style="margin-bottom:20px">
        <div class="panel-title">Lecture stratégique de l'équipe</div>
        <div class="panel-sub">Une matrice déduite des données, sans intelligence artificielle.</div>
        <div class="swot-grid" style="margin-top:18px">
          <div class="swot-card swot-f"><div class="swot-card-title">Forces</div><ul>${liSW(sw.forces)}</ul></div>
          <div class="swot-card swot-w"><div class="swot-card-title">Points de vigilance</div><ul>${liSW(sw.faiblesses)}</ul></div>
          <div class="swot-card swot-o"><div class="swot-card-title">Opportunités</div><ul>${liSW(sw.opportunites)}</ul></div>
          <div class="swot-card swot-r"><div class="swot-card-title">Risques</div><ul>${liSW(sw.risques)}</ul></div>
        </div>
      </div>

      <div class="panel" style="margin-bottom:20px">
        <div class="panel-title">Indicateurs de dynamique</div>
        <div class="panel-sub">Des signaux comportementaux pour mieux comprendre l'équipe.</div>
        <div class="ind-grid">
          ${inds.map(i=>`<div class="ind-card"><div class="ind-cle">${esc(i.cle)}${i.valeur?` <span class="ind-val">${esc(i.valeur)}</span>`:''}</div><div class="ind-txt">${esc(i.texte)}</div></div>`).join('')}
        </div>
      </div>`;
    }

    // Membres (tous les terminés, avec case à cocher pour composer la vue d'équipe)
    html += `<div class="panel" style="margin-bottom:20px">
      <div class="panel-title">Les membres de l'équipe</div>
      <div class="panel-sub">Cochez les membres à inclure dans la vue (par équipe, par service, par manager). Toutes les analyses de la page se recalculent sur la sélection.</div>
      <div class="sel-bar">
        <span class="sel-count">${selectionEquipe.size}/${idxTerm.length} sélectionné${selectionEquipe.size>1?'s':''}</span>
        <button class="sel-btn" onclick="selectionTous()">Tout cocher</button>
        <button class="sel-btn" onclick="selectionAucun()">Tout décocher</button>
      </div>
      <div class="membres-filtre"><input type="search" id="membres-filtre" placeholder="Filtrer par nom ou archétype…" oninput="filtrerMembres(this.value)"></div>
      <div class="membres-tri"><span class="tri-lab">Trier</span><button class="tri-btn on" data-tri="defaut" onclick="trierMembres(this)">Arrivée</button><button class="tri-btn" data-tri="nom" onclick="trierMembres(this)">Nom</button><button class="tri-btn" data-tri="famille" onclick="trierMembres(this)">Famille</button></div>
      <div class="membres-grid">`;
    repsCourants = repsTous;
    if (fichePendingEmail){
      const iF = repsTous.findIndex(r => String(r.email || '').toLowerCase() === fichePendingEmail.toLowerCase());
      fichePendingEmail = null;
      if (iF >= 0) setTimeout(function(){ voirMembre(iF); }, 150);
    }
    for(let ri=0; ri<repsTous.length; ri++){
      const r = repsTous[ri];
      if(!String(r.statut||'').toLowerCase().startsWith('termin')) continue;
      const f=(r.famille||'').toUpperCase(); const col=FAM_COLORS[f]||'#999';
      const coche = selectionEquipe.has(ri);
      html += `<div class="membre membre-clic ${coche?'':'membre-exclu'}" data-ordre="${ri}" data-fam="${f}" data-nom="${esc((r.nom||'').toLowerCase())}"><label class="membre-check" onclick="event.stopPropagation()"><input type="checkbox" ${coche?'checked':''} onchange="toggleMembre(${ri})"></label><div class="membre-corps" onclick="ouvrirMembre(${ri})"><div class="membre-ava" style="background:${col}">${esc(initiales(r.nom))}</div><div class="membre-info"><div class="membre-nom">${esc(r.nom||'')}</div><div class="membre-arch">${esc(r.dominante||'')}</div></div><span class="membre-fleche">›</span></div></div>`;
    }
    html += `</div></div>`;

    const enAttente = repsTous.filter(function (r) { return !String(r.statut || '').toLowerCase().startsWith('termin'); });
    if (enAttente.length){
      const lienCamp = FRONT_APP + '/?token=' + encodeURIComponent(camp.code || codeCampagneCourant || '');
      html += `
      <div class="section-label">En attente (${enAttente.length})</div>
      <div class="attente-bloc">
        <div class="attente-chips">${enAttente.map(function (r) { return `<span class="attente-chip">${esc(r.prenom || r.nom || r.email || '')}</span>`; }).join('')}</div>
        <div class="attente-actions">
          <button class="attente-copier" onclick="copierRelance('${esc(lienCamp)}')">Copier un message de relance</button>
          <span class="attente-ok" id="attente-ok"></span>
        </div>
      </div>`;
    }

    // ==== Mode recrutement : profil cible + adéquation des candidats ====
    const modeRecrut = (camp.mode==='recrutement') || !!camp.profilCible || vueRecrutementForcee;
    if(modeRecrut){
      html += sectionRecrutementHtml(camp, repsTous);
    } else if(idxTerm.length>=1){
      html += '<div class="recrut-activer"><button class="sel-btn" onclick="vueRecrutementForcee=true;renderCampagneVue()">Activer la vue recrutement (profil cible et adéquation des candidats)</button></div>';
    }

    // Analyse stratégique IA
    if(idxTerm.length>=2){
      html += `
      <div class="section-label">Aller plus loin</div>
      <div class="analyse-cta">
        <div>
          <div class="analyse-cta-title">Approfondir avec l'analyse IA</div>
          <div class="analyse-cta-sub">L'intelligence artificielle relie les profils entre eux : synthèse narrative, SWOT, dynamiques internes, risques RH, plan d'action et conseil personnalisé par membre.${filtreActif?` <b>L'analyse porte sur la campagne entière (${idxTerm.length} profils), indépendamment de la sélection ci-dessus.</b>`:''}</div>
        </div>
        <button class="analyse-cta-btn" id="btn-analyse" onclick="genererAnalyse(codeCampagneCourant)">Générer l'analyse IA</button>
      </div>`;
    }
    html += `<div id="analyse-zone"></div>`;
    html += renderTableauCampagne();
    html += renderHeatmapEquipe();
    html += renderFitPoste();
    html += renderCompetencesEquipe();
    html += renderCoachHebdo();
    if (SUPER && idxTerm.length >= 2) {
      html += `
      <div class="analyse-cta brief-cta">
        <div>
          <div class="analyse-cta-title">Brief de campagne SeedUp</div>
          <div class="analyse-cta-sub">Le document de cadrage complet pour lancer la campagne d'ancrage de cette équipe : cap commun, 4 semaines de défis déclinés par famille, calibrage par membre, trame des sessions collectives.</div>
        </div>
        <button class="analyse-cta-btn" id="btn-brief" onclick="genererBrief()">Générer le brief</button>
      </div>`;
    }
    html += `<div id="brief-zone"></div>`;
    if (SUPER) {
      html += `
      <div class="analyse-cta brief-cta">
        <div>
          <div class="analyse-cta-title">Rapport de fin de campagne SeedUp</div>
          <div class="analyse-cta-sub">Déposez les exports SeedUp de la campagne : les stats générales, et le détail des défis réalisés pour le croisement avec les profils Sinéa. Le rapport d'impact destiné au sponsor se génère avec les tableaux, les enseignements et la suite proposée.</div>
          <div class="rapp-files">
            <label class="rapp-file"><span>Stats générales (CSV)</span><input type="file" id="rapp-stats" accept=".csv" /></label>
            <label class="rapp-file"><span>Défis réalisés (CSV)</span><input type="file" id="rapp-defis" accept=".csv" /></label>
          </div>
        </div>
        <div class="rapp-btns">
          <button class="analyse-cta-btn" id="btn-rapport" onclick="genererRapport()">Générer le rapport</button>
          <button class="analyse-cta-btn rapp-sync" id="btn-sync" onclick="synchroniserSeedup()">Synchroniser vers les espaces</button>
        </div>
      </div>
      <div id="sync-msg"></div>
      <div id="rapport-zone"></div>`;
    }

    // ==== Compatibilité manager / collaborateur ====
    if(idxTerm.length>=2){
      const opts = repsTous.map((r,ri)=> String(r.statut||'').toLowerCase().startsWith('termin') && r.email ? `<option value="${esc(r.email)}">${esc(r.nom||r.email)}</option>` : '').join('');
      html += `
      <div class="section-label">Compatibilité manager / collaborateur</div>
      <div class="compat-box">
        <div class="compat-intro">Sélectionnez un manager et l'un de ses collaborateurs. Sinéa calcule leur compatibilité de travail (fluidités naturelles et points à anticiper). Le score chiffré reste réservé à votre vue RH, l'analyse qualitative est conçue pour être partagée aux deux personnes. <span class="cadrage-note">Cet éclairage nourrit la réflexion et le dialogue. La décision finale reste humaine.</span></div>
        <div class="compat-selects">
          <div class="compat-field"><label>Manager</label><select id="compat-mgr"><option value="">Choisir…</option>${opts}</select></div>
          <div class="compat-field"><label>Collaborateur</label><select id="compat-col"><option value="">Choisir…</option>${opts}</select></div>
          <button class="compat-btn" id="compat-btn" onclick="lancerCompatibilite()">Analyser le binôme</button>
        </div>
        <div id="compat-zone"></div>
      </div>`;
    }
    html += `<div id="analyse-zone-2"></div>`;

    document.getElementById('content').innerHTML=html;
    try { organiserOnglets(document.getElementById('content')); } catch (e) { console.warn('[Sinéa]', e); }

    // ==== GRAPHIQUES ====
    requestAnimationFrame(()=>dessinerGraphiques(stats, reps));
  }

  function dessinerGraphiques(stats, reps){
    if(typeof Chart==='undefined') return; // CDN bloqué : la page reste fonctionnelle sans graphiques
    const fams=stats.familles||{};
    const famVals=FAM_ORDER.map(f=>fams[f]||0);
    const famCols=FAM_ORDER.map(f=>FAM_COLORS[f]);
    const famLabs=FAM_ORDER.map(f=>FAM_LABELS[f]);
    Chart.defaults.font.family="Manrope, sans-serif";
    Chart.defaults.color="#747474";

    const membres=reps.filter(r=>String(r.statut||'').toLowerCase().startsWith('termin') && r.bigFive && r.bigFive.E!=null);

    // 1) Donut familles
    const c1=document.getElementById('chartDonut');
    if(c1) charts.donut=new Chart(c1,{type:'doughnut',data:{labels:famLabs,datasets:[{data:famVals,backgroundColor:famCols,borderWidth:3,borderColor:'#fff',hoverOffset:8}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:false}},animation:{animateRotate:true,duration:900}}});

    // 2) Radar Big Five : moyenne + enveloppe (min/max) pour montrer la dispersion
    const bfKeys=['E','A','C','N','O'];
    const bfLabels=['Extraversion','Agréabilité','Conscience','Stabilité','Ouverture'];
    const val=(m,k)=>{ let v=Number(m.bigFive[k])||0; if(k==='N')v=100-v; return v; };
    const moy=bfKeys.map(k=>{ const vs=membres.map(m=>val(m,k)); return vs.length?Math.round(vs.reduce((a,b)=>a+b,0)/vs.length):0; });
    const mins=bfKeys.map(k=>{ const vs=membres.map(m=>val(m,k)); return vs.length?Math.min(...vs):0; });
    const maxs=bfKeys.map(k=>{ const vs=membres.map(m=>val(m,k)); return vs.length?Math.max(...vs):0; });
    const c2=document.getElementById('chartRadarBF');
    if(c2) charts.radarBF=new Chart(c2,{type:'radar',data:{labels:bfLabels,datasets:[
      {label:'Maximum',data:maxs,backgroundColor:'rgba(136,132,240,0.10)',borderColor:'rgba(136,132,240,0.30)',borderWidth:1,pointRadius:0,fill:true},
      {label:'Moyenne',data:moy,backgroundColor:'rgba(249,130,114,0.20)',borderColor:'#F98272',borderWidth:2.5,pointBackgroundColor:'#F98272',pointBorderColor:'#fff',pointRadius:5,pointHoverRadius:7,fill:true},
      {label:'Minimum',data:mins,backgroundColor:'rgba(255,255,255,0)',borderColor:'rgba(136,132,240,0.30)',borderWidth:1,pointRadius:0,fill:false}
    ]},options:{responsive:true,maintainAspectRatio:false,scales:{r:{beginAtZero:true,max:100,ticks:{stepSize:25,backdropColor:'transparent',font:{size:10}},grid:{color:'#ECE6F5'},angleLines:{color:'#ECE6F5'},pointLabels:{font:{size:12.5,weight:'700'},color:'#1A1A1A'}}},plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11},usePointStyle:true,padding:14}}},animation:{duration:900}}});

    // 3) Cartographie : nuage de points (un point par membre, couleur = famille)
    const datasetsByFam={};
    membres.forEach(m=>{
      const f=(m.famille||'').toUpperCase(); const pos=positionCarto(m);
      if(!datasetsByFam[f]) datasetsByFam[f]={label:FAM_LABELS[f]||f,data:[],backgroundColor:FAM_COLORS[f]||'#999',pointRadius:9,pointHoverRadius:12,borderColor:'#fff',borderWidth:2};
      datasetsByFam[f].data.push({x:pos.x,y:pos.y,nom:m.nom});
    });
    const labelsCarto={id:'labelsCarto',afterDatasetsDraw:function(chart){var cx=chart.ctx;cx.save();cx.font='600 11px Manrope, sans-serif';cx.fillStyle='#4A4A55';cx.textAlign='center';chart.data.datasets.forEach(function(ds,di){var meta=chart.getDatasetMeta(di);if(meta.hidden)return;meta.data.forEach(function(pt,i){var nom=(((ds.data[i]||{}).nom)||'').split(' ')[0];if(nom)cx.fillText(nom,pt.x,pt.y-13);});});cx.restore();}};
    const c3=document.getElementById('chartCarto');
    if(c3) charts.carto=new Chart(c3,{type:'scatter',data:{datasets:Object.values(datasetsByFam)},options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:14}},scales:{x:{min:0,max:100,grid:{color:'#F0EDF7'},ticks:{display:false},border:{display:false}},y:{min:0,max:100,grid:{color:'#F0EDF7'},ticks:{display:false},border:{display:false}}},plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11},usePointStyle:true,padding:12}},tooltip:{callbacks:{label:(c)=>{const p=c.raw;const lx=p.x<45?'orientation relation':(p.x>55?'orientation t\u00e2che':'\u00e9quilibre relation-t\u00e2che');const ly=p.y>55?"\u00e9nergie d'action":(p.y<45?'r\u00e9flexion pos\u00e9e':'tempo \u00e9quilibr\u00e9');return [p.nom, lx+' \u00b7 '+ly];}}}},animation:{duration:800}},plugins:[labelsCarto]});
  }

  // ====== ANALYSE STRATÉGIQUE ======
  function genererAnalyse(code, force){
    const btn=document.getElementById('btn-analyse'); const zone=document.getElementById('analyse-zone');
    if(btn){btn.disabled=true;btn.textContent='Génération en cours...';}
    if(zone) zone.innerHTML=`<div class="loading"><div class="spinner"></div><div>Analyse de l'équipe par l'IA, cela peut prendre une minute...</div></div>`;
    fetch(ANALYSE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cle:cleAcces,code:code,force:!!force})})
      .then(r=>r.json())
      .then(data=>{
        if(btn){btn.disabled=false;btn.textContent='Régénérer l\'analyse';}
        if(data&&data.ok&&data.analyse) afficherAnalyse(data.analyse,data.cache);
        else if(data&&data.raison==='pas_assez'){ if(zone)zone.innerHTML=`<div class="empty">${esc(data.message||'Il faut au moins 2 profils.')}</div>`; }
        else { if(zone)zone.innerHTML=`<div class="empty">L'analyse n'a pas pu être générée. Réessayez.</div>`; }
      })
      .catch(()=>{ if(btn){btn.disabled=false;btn.textContent='Générer l\'analyse';} if(zone)zone.innerHTML=`<div class="empty">Erreur de génération.</div>`; });
  }

  // ===== Export PDF : fenêtre d'impression dédiée (le navigateur propose Enregistrer en PDF) =====
  // ===== Brief de campagne SeedUp (super admin) =====
  // Le pont entre le diagnostic et l'ancrage : cap commun issu des axes mesurés,
  // 4 semaines de défis déclinés par famille, calibrage individuel déterministe.
  function niveauDepartMembre(m, coutParNom){
    const cout = String(coutParNom[m.nom] || '');
    if (cout.indexOf('lev') >= 0) return 1;
    const bf = m.bigFive || {};
    const stab = (bf.N === null || bf.N === undefined) ? null : 100 - Number(bf.N);
    if (stab !== null && stab >= 60 && Number(bf.E) >= 60) return 2;
    return 1;
  }

  function genererBrief(){
    const btn = document.getElementById('btn-brief');
    const zone = document.getElementById('brief-zone');
    if (!campagneData || !zone) return;
    const reps = (campagneData.repondants || []).filter(r => String(r.statut || '').toLowerCase().startsWith('termin'));
    if (reps.length < 2){ zone.innerHTML = '<div class="empty">Au moins deux profils terminés sont nécessaires pour un brief d\'équipe.</div>'; return; }
    if (btn){ btn.disabled = true; btn.textContent = 'Génération du brief...'; }
    const fams = { RELATION: 0, ACTION: 0, STRUCTURE: 0, VISION: 0 };
    reps.forEach(r => { const f = (r.famille || '').toUpperCase(); if (fams[f] !== undefined) fams[f]++; });
    let axes = [];
    if (axesForces && axesForces.length){
      axes = axesForces.slice(0, 4);
      axesForces = null;
    } else {
      try { axes = (axesFormation(reps, fams) || []).map(a => (a && a.titre) ? a.titre : a).filter(Boolean).slice(0, 4); } catch (e) { axes = []; }
    }
    let coutParNom = {};
    try {
      const ad = analyserEquipe(reps);
      (((ad || {}).natTrav || {}).items || []).forEach(it => { coutParNom[it.nom] = it.cout || ''; });
    } catch (e) { console.warn("[Sinéa]", e); }
    const membres = reps.map(m => ({
      nom: m.nom || '', famille: (m.famille || '').toUpperCase(), dominante: m.dominante || '',
      niveau: niveauDepartMembre(m, coutParNom), cout: coutParNom[m.nom] || 'faible',
    }));
    fetch(BRIEF_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': cleAcces },
      body: JSON.stringify({ entreprise: campagneData.entreprise || '', campagne: campagneData.nom || codeCampagneCourant, axes: axes, repartition: fams, membres: membres }),
    })
      .then(r => r.json())
      .then(d => {
        if (btn){ btn.disabled = false; btn.textContent = 'Générer le brief'; }
        if (!d || !d.ok || !d.brief){ zone.innerHTML = '<div class="empty">La génération du brief a échoué. Réessayez dans un instant.</div>'; return; }
        briefCourant = d.brief;
        briefCourant._membres = membres;
        briefCourant._entreprise = campagneData.entreprise || '';
        briefCourant._campagne = campagneData.nom || codeCampagneCourant;
        zone.innerHTML = rendreBrief(briefCourant);
        zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(() => {
        if (btn){ btn.disabled = false; btn.textContent = 'Générer le brief'; }
        zone.innerHTML = '<div class="empty">Erreur réseau pendant la génération.</div>';
      });
  }

  function briefCorpsHtml(b){
    let h = '';
    h += '<div class="brief-cap"><div class="brief-kicker">Le cap de la campagne</div><div class="brief-cap-txt">' + esc(b.cap || '') + '</div></div>';
    if (b.kickoff){
      h += '<h2>Le lancement</h2><p>' + esc(b.kickoff.message || '') + '</p>';
      if (Array.isArray(b.kickoff.points_cles) && b.kickoff.points_cles.length) h += '<ul>' + b.kickoff.points_cles.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>';
    }
    (b.semaines || []).forEach(sem => {
      h += '<div class="brief-week"><h2>Semaine ' + esc(String(sem.numero || '')) + ' · ' + esc(sem.theme || '') + '</h2>';
      if (sem.intention) h += '<p class="brief-intention">' + esc(sem.intention) + '</p>';
      (sem.defis || []).forEach(df => {
        h += '<div class="brief-defi"><div class="brief-defi-titre">' + esc(df.titre || '') + '</div><p>' + esc(df.defi || '') + '</p>';
        if (df.reussite) h += '<div class="brief-reussite">Réussite : ' + esc(df.reussite) + '</div>';
        const dec = df.declinaisons || {};
        const chips = Object.keys(dec).filter(f => dec[f]).map(f => '<div class="brief-decl"><span class="brief-decl-fam">' + esc(f) + '</span>' + esc(dec[f]) + '</div>').join('');
        if (chips) h += '<div class="brief-decls">' + chips + '</div>';
        h += '</div>';
      });
      h += '</div>';
    });
    const mem = b._membres || [];
    if (mem.length){
      h += '<h2>Calibrage par membre</h2><table class="brief-table"><tr><th>Membre</th><th>Archétype</th><th>Niveau de départ</th><th>Coût d\'adaptation</th></tr>';
      mem.forEach(m => { h += '<tr><td>' + esc(m.nom) + '</td><td>' + esc(m.dominante) + ' (' + esc(m.famille) + ')</td><td>Niveau ' + esc(String(m.niveau)) + '</td><td>' + esc(m.cout) + '</td></tr>'; });
      h += '</table>';
    }
    if (b.session_ic){
      h += '<h2>La session collective hebdomadaire (45 min)</h2>';
      if (Array.isArray(b.session_ic.trame)) h += '<ul>' + b.session_ic.trame.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>';
      if (b.session_ic.question_type) h += '<p class="brief-intention">Question type : ' + esc(b.session_ic.question_type) + '</p>';
    }
    if (b.mesure && Array.isArray(b.mesure.indicateurs) && b.mesure.indicateurs.length){
      h += '<h2>La mesure de fin de campagne</h2><ul>' + b.mesure.indicateurs.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>';
    }
    return h;
  }

  function rendreBrief(b){
    return '<div class="brief-card">' +
      '<div class="brief-head"><div><div class="brief-kicker">Brief de campagne SeedUp</div><div class="brief-titre">' + esc(b._entreprise || '') + (b._campagne ? ' · ' + esc(b._campagne) : '') + '</div></div>' +
      '<button class="exp-btn exp-mini" onclick="exporterBrief()">Exporter en PDF</button></div>' +
      briefCorpsHtml(b) + '</div>';
  }

  function exporterBrief(){
    if (!briefCourant) return;
    ouvrirImpression('Brief de campagne SeedUp · ' + (briefCourant._entreprise || ''), briefCorpsHtml(briefCourant));
  }

  // ===== Panneau super admin : recherche, alertes, activité, qualité =====
  function pctSup(n, base){ return base ? Math.round(100 * n / base) : 0; }

  let ongletCourant = 'campagne';
  function renderOnglets(){
    return '<div class="sup-onglets" id="sup-onglets">'
      + '<button type="button" class="sup-onglet" id="btn-tab-apprenant" onclick="basculerOnglet(\'apprenant\')">Apprenant</button>'
      + '<button type="button" class="sup-onglet on" id="btn-tab-campagne" onclick="basculerOnglet(\'campagne\')">Campagnes</button>'
      + '<button type="button" class="sup-onglet" id="btn-tab-qualite" onclick="basculerOnglet(\'qualite\')">Qualité du test</button>'
      + '</div>';
  }
  function basculerOnglet(n){
    ongletCourant = n;
    ['apprenant', 'campagne', 'qualite'].forEach(x => {
      const p = document.getElementById('tab-' + x);
      const b = document.getElementById('btn-tab-' + x);
      if (p) p.style.display = x === n ? 'block' : 'none';
      if (b) { b.classList.toggle('on', x === n); b.setAttribute('aria-pressed', x === n ? 'true' : 'false'); }
    });
  }
  function renderPanneauApprenant(){
    let h = '<div class="panel ce-panel"><div class="panel-title">Trouver un apprenant</div><div class="panel-sub">Tapez un nom, un prénom ou un email, puis ouvrez sa campagne et sa fiche complète, brief et portrait compris.</div>';
    h += '<div class="sup-rech"><input type="text" id="sup-rech-input" class="sup-rech-input" placeholder="Rechercher un participant (nom ou email)..." onkeydown="if(event.key===\'Enter\')rechercherParticipant()" /><button class="analyse-cta-btn sup-rech-btn" onclick="rechercherParticipant()">Rechercher</button></div>';
    h += '<div id="sup-rech-zone"></div></div>';
    return h;
  }

  function renderPanneauQualite(data){
    const q = data.qualite; const act = data.activite; const alertes = data.alertes || [];
    const qInd = ((data && data.qualite) || {}).indicateurs || {};
    const kpiInd = (o, lab) => '<div class="sup-kpi"><div class="sup-kpi-n">' + (o && o.moy !== null && o.moy !== undefined ? o.moy + '/5' : '·') + '</div><div class="sup-kpi-l">' + lab + (o && o.n ? ' (' + o.n + ')' : '') + '</div></div>';
    let hInd = '<div class="sup-grid">';
    hInd += '<div class="sup-card"><div class="sup-card-titre">La restitution, notée par les apprenants</div><div class="sup-kpis">'
      + kpiInd(qInd.ressemblance, 'Ressemblance') + kpiInd(qInd.utilite, 'Actions concrètes') + kpiInd(qInd.clarte, 'Clarté')
      + '</div><div class="sup-vide">Trois notes demandées à chaud, à la fin du portrait.</div></div>';
    hInd += '<div class="sup-card"><div class="sup-card-titre">D\'où viennent ces mesures ?</div><div class="sup-mesures">'
      + '<p><b>Le pari</b> est demandé juste avant la révélation du style métier : l\'intuition de la personne contre la mesure.</p>'
      + '<p><b>Les trois notes et le verbatim</b> sont demandés au moment 3, l\'écran de fin du portrait, à chaud.</p>'
      + '<p><b>La fiabilité</b> est calculée automatiquement sur la cohérence interne des réponses, sans rien demander.</p>'
      + '</div></div></div>';
    let h = hInd + '<div class="sup-panneau">';
    // Recherche transverse
    // Alertes
    if (alertes.length){
      const visibles = alertes.slice(0, 6);
      h += '<div class="sup-alertes">' + visibles.map(a =>
        '<div class="sup-alerte sup-alerte-' + esc(a.type) + '"><b>' + (a.type === 'quota' ? 'Quota' : 'Dormante') + '</b> · ' + esc(a.entreprise || '') + ' · ' + esc(a.campagne || '') + ' : ' + esc(a.detail || '') + '</div>'
      ).join('') + (alertes.length > 6 ? '<div class="sup-alerte-plus">+ ' + (alertes.length - 6) + ' autres alertes</div>' : '') + '</div>';
    }
    // Pouls d'activité
    if (act && Array.isArray(act.mois) && act.mois.length){
      const maxM = Math.max.apply(null, act.mois.map(x => x.n).concat([1]));
      const totalM = act.mois.reduce((a, x) => a + x.n, 0);
      const nomMois = (mo) => new Date(mo + '-15T12:00:00').toLocaleDateString('fr-FR', { month: 'short' });
      h += '<div class="sup-grid"><div class="sup-card"><div class="sup-card-titre">Passations par mois</div><div class="sup-spark sup-spark-mois">'
        + act.mois.map(x => '<div class="sup-bar-wrap" title="' + esc(x.mois) + ' : ' + x.n + '"><div class="sup-bar" style="height:' + Math.max(6, Math.round(100 * x.n / maxM)) + '%"></div><div class="sup-bar-n">' + x.n + '</div><div class="sup-bar-m">' + esc(nomMois(x.mois)) + '</div></div>').join('')
        + '</div><div class="sup-vide">' + totalM + ' passations sur 6 mois</div></div>';
      h += '<div class="sup-card"><div class="sup-card-titre">Dernières passations</div>'
        + ((act.dernieres || []).map(p => '<div class="sup-fil sup-fil-clic" data-camp="' + esc(p.campagne || '') + '" data-email="' + esc(p.email || '') + '" onclick="ouvrirDepuisPassation(this)" title="Ouvrir la fiche et l\'analyse"><span class="sup-fil-nom">' + esc(p.nom || '') + '</span><span class="sup-fil-det">' + esc(p.entreprise || '') + ' · ' + esc(p.campagne || '') + ' · ' + esc(p.dominante || '') + ' · ' + esc(String(p.date || '').slice(0, 10)) + '</span></div>').join('') || '<div class="sup-vide">Aucune passation datée.</div>')
        + '</div></div>';
    }
    // Qualité produit
    if (q){
      h += '<div class="sup-grid">';
      h += '<div class="sup-card"><div class="sup-card-titre">Qualité perçue</div>';
      h += '<div class="sup-kpis">'
        + '<div class="sup-kpi"><div class="sup-kpi-n">' + (q.noteMoyenne !== null && q.noteMoyenne !== undefined ? q.noteMoyenne : '·') + '</div><div class="sup-kpi-l">Note moyenne (' + q.nbNotes + ')</div></div>'
        + '<div class="sup-kpi"><div class="sup-kpi-n">' + (q.paris && q.paris.total ? pctSup(q.paris.accord, q.paris.total) + '%' : '·') + '</div><div class="sup-kpi-l">Paris justes (' + ((q.paris || {}).total || 0) + ')</div></div>'
        + '<div class="sup-kpi"><div class="sup-kpi-n">' + (q.fiabilite && q.fiabilite.moyenne !== null ? q.fiabilite.moyenne : '·') + '</div><div class="sup-kpi-l">Fiabilité moyenne</div></div>'
        + '</div>';
      const dist = q.distribution || {};
      const maxD = Math.max.apply(null, [1,2,3,4,5].map(k => dist[k] || 0).concat([1]));
      h += '<div class="sup-dist">' + [1,2,3,4,5].map(k => '<div class="sup-dist-col" title="Note ' + k + ' : ' + (dist[k] || 0) + '"><div class="sup-dist-bar" style="height:' + Math.max(4, Math.round(100 * (dist[k] || 0) / maxD)) + '%"></div><div class="sup-dist-l">' + k + '</div></div>').join('') + '</div>';
      h += '</div>';
      h += '<div class="sup-card"><div class="sup-card-titre">Ce que les apprenants utilisent</div><div class="sup-vide" style="margin:-4px 0 8px">Part des profils terminés ayant activé chaque fonctionnalité de leur espace.</div>';
      const ad = q.adoption || {};
      [['Plan d\'action', ad.plan], ['Défis SeedUp', ad.seedup], ['Re-mesure', ad.remesure], ['Miroir 360', ad.miroir]].forEach(x => {
        const p = pctSup(x[1] || 0, ad.base || 0);
        h += '<div class="sup-adop"><span class="sup-adop-l">' + x[0] + '</span><div class="sup-adop-bar"><div class="sup-adop-fill" style="width:' + p + '%"></div></div><span class="sup-adop-p">' + p + '%</span></div>';
      });
      h += '<div class="sup-vide">Base : ' + (ad.base || 0) + ' profils terminés' + (q.fiabilite && q.fiabilite.faible ? ' · ' + q.fiabilite.faible + ' protocole(s) à fiabilité basse' : '') + '</div>';
      h += '</div></div>';
      // Coût mesuré et santé technique
      const co = q.cout || {}; const sa = q.sante || {};
      h += '<div class="sup-grid">';
      h += '<div class="sup-card"><div class="sup-card-titre">Coût de génération mesuré</div><div class="sup-kpis">'
        + '<div class="sup-kpi"><div class="sup-kpi-n">' + (co.moyenUsd !== null && co.moyenUsd !== undefined ? co.moyenUsd + ' $' : '·') + '</div><div class="sup-kpi-l">Par portrait (' + (co.portraits || 0) + ')</div></div>'
        + '<div class="sup-kpi"><div class="sup-kpi-n">' + (co.totalUsd ? co.totalUsd + ' $' : '·') + '</div><div class="sup-kpi-l">Total mesuré</div></div>'
        + '<div class="sup-kpi"><div class="sup-kpi-n">' + (co.economieUsd ? co.economieUsd + ' $' : '·') + '</div><div class="sup-kpi-l">Économie du cache</div></div>'
        + '</div><div class="sup-vide">' + (co.portraits ? 'Mesuré sur ' + co.portraits + ' portrait(s) depuis la mise en place du suivi.' : 'La mesure démarre maintenant : passe un portrait test complet et cette carte se remplit au rechargement.') + '</div></div>';
      h += '<div class="sup-card"><div class="sup-card-titre">Santé technique</div><div class="sup-kpis">'
        + '<div class="sup-kpi"><div class="sup-kpi-n">' + (sa.completude !== null && sa.completude !== undefined ? sa.completude + '%' : '·') + '</div><div class="sup-kpi-l">Portraits complets</div></div>'
        + '<div class="sup-kpi"><div class="sup-kpi-n">' + (sa.portraitsErr || 0) + '</div><div class="sup-kpi-l">Portraits avec erreur</div></div>'
        + '<div class="sup-kpi"><div class="sup-kpi-n">' + (sa.sectionsErr || 0) + '</div><div class="sup-kpi-l">Sections en erreur</div></div>'
        + '</div><div class="sup-vide">Une section en erreur affiche son repli à la personne : à surveiller au-dessus de zéro.</div>'
        + ((sa.details || []).length ? '<button class="exp-btn exp-mini" onclick="toggleSanteDetail()">Voir le détail</button><div id="sup-sante-det" style="display:none">' + sa.details.map(dt => '<div class="sup-sante-ligne"><b>' + esc(dt.nom || '') + '</b> · ' + esc(dt.entreprise || '') + ' · ' + esc(dt.campagne || '') + '<br><span class="sup-res-det">Sections : ' + (dt.sections || []).map(esc).join(', ') + '</span></div>').join('') + '</div>' : '')
        + '</div>';
      h += '</div>';
      // Les avis à examiner : notes de 3 et moins, avec leur verbatim
      if ((q.avisAExaminer || []).length){
        h += '<div class="sup-card sup-card-large sup-card-alerte"><div class="sup-card-titre">Avis à examiner (note ≤ 3)</div>'
          + q.avisAExaminer.map(a => '<div class="sup-avis"><span class="sup-avis-note sup-avis-basse">' + esc(String(a.note)) + '/5</span><span class="sup-avis-txt">' + esc(a.texte) + '</span><span class="sup-avis-ent">' + esc(a.entreprise || '') + (a.campagne ? ' · ' + esc(a.campagne) : '') + '</span></div>').join('')
          + '</div>';
      }
      // La qualité par campagne, les plus fragiles en tête
      if ((q.parCampagne || []).length){
        h += '<div class="sup-card sup-card-large"><div class="sup-card-titre">Qualité par campagne (fragiles en tête)</div>'
          + '<table class="brief-table"><tr><th>Campagne</th><th>Terminés</th><th>Note</th><th>Paris justes</th><th>Fiabilité</th><th>Plan</th><th>Erreurs</th><th>Coût moyen</th></tr>'
          + q.parCampagne.slice(0, 10).map(c => '<tr><td><b>' + esc(c.campagne || '·') + '</b><br><span class="sup-res-det">' + esc(c.entreprise || '') + '</span></td><td>' + c.termines + '</td><td>' + (c.note !== null ? c.note + ' (' + c.nbNotes + ')' : '·') + '</td><td>' + (c.paris !== null ? c.paris + '%' : '·') + '</td><td>' + (c.fiab !== null ? c.fiab : '·') + '</td><td>' + c.plan + '%</td><td>' + (c.err ? '<span class="sup-err">' + c.err + '</span>' : '0') + '</td><td>' + (c.coutMoyen !== null ? c.coutMoyen + ' $' : '·') + '</td></tr>').join('')
          + '</table></div>';
      }
      if ((q.derniersAvis || []).length){
        h += '<div class="sup-card sup-card-large"><div class="sup-card-titre">Derniers avis</div>'
          + q.derniersAvis.map(a => '<div class="sup-avis"><span class="sup-avis-note">' + esc(String(a.note)) + '/5</span><span class="sup-avis-txt">' + esc(a.texte) + '</span><span class="sup-avis-ent">' + esc(a.entreprise || '') + '</span></div>').join('')
          + '</div>';
      }
      h += '<div class="sup-actions"><button class="exp-btn exp-mini" onclick="exporterRapportQualite()">Exporter le rapport qualité (PDF)</button> <button class="exp-btn exp-mini" id="btn-csv" onclick="exporterParticipantsCsv()">Exporter les participants (CSV)</button> <button class="exp-btn exp-mini" onclick="exporterNoticeScientifique()">Notice scientifique (PDF)</button></div>';
    }
    h += '</div>';
    return h;
  }

  function rechercherParticipant(){
    const inp = document.getElementById('sup-rech-input');
    const zone = document.getElementById('sup-rech-zone');
    if (!inp || !zone) return;
    const q = inp.value.trim();
    if (q.length < 2){ zone.innerHTML = ''; return; }
    zone.innerHTML = '<div class="sup-vide">Recherche...</div>';
    fetch(BACKEND + '?recherche=' + encodeURIComponent(q), { headers: { 'X-Dashboard-Key': cleAcces } })
      .then(r => r.json())
      .then(d => {
        const rs = (d && d.resultats) || [];
        if (!rs.length){ zone.innerHTML = '<div class="sup-vide">Aucun participant trouvé pour « ' + esc(q) + ' ».</div>'; return; }
        zone.innerHTML = rs.map((r, i) =>
          '<div class="sup-res"><div><b>' + esc(r.nom || r.email || 'Anonyme') + '</b> <span class="sup-res-det">' + esc(r.dominante || '') + (r.famille ? ' (' + esc(r.famille) + ')' : '') + ' · ' + esc(r.entreprise || '') + ' · ' + esc(r.campagne || '') + ' · ' + esc(r.statut || '') + '</span></div>' +
          (r.email && String(r.statut || '').toLowerCase().startsWith('termin') ? '<button class="exp-btn exp-mini" id="sup-pdf-' + i + '" onclick="telechargerPortraitEmail(\'' + esc(r.email) + '\',\'' + esc((r.nom || 'participant').replace(/'/g, '')) + '\',\'' + 'sup-pdf-' + i + '\')">Portrait PDF</button>' : '') +
          '</div>'
        ).join('');
      })
      .catch(() => { zone.innerHTML = '<div class="sup-vide">Erreur de recherche.</div>'; });
  }

  async function telechargerPortraitEmail(email, nom, btnId){
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const texte = btn.textContent;
    btn.textContent = 'Génération…'; btn.disabled = true;
    try {
      const rep = await fetch(PDF_PORTRAIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cle: cleAcces, email: email }) });
      if (!rep.ok) throw new Error('indisponible');
      const blob = await rep.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'Portrait_' + String(nom || 'participant').replace(/\s+/g, '_') + '.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      btn.textContent = 'Téléchargé ✓';
      setTimeout(() => { btn.textContent = texte; btn.disabled = false; }, 3000);
    } catch (e) {
      btn.textContent = 'Indisponible';
      setTimeout(() => { btn.textContent = texte; btn.disabled = false; }, 3000);
    }
  }

  // Export CSV de tous les participants : pilotage + analyse psychométrique
  // (réponses brutes et temps de réponse embarqués en colonnes JSON).
  async function exporterParticipantsCsv(){
    const btn = document.getElementById('btn-csv');
    if (btn){ btn.disabled = true; btn.textContent = 'Export...'; }
    try {
      const rep = await fetch(BACKEND + '?export=participants', { headers: { 'X-Dashboard-Key': cleAcces } });
      if (!rep.ok) throw new Error('export');
      const blob = await rep.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'participants_sinea.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (btn){ btn.textContent = 'Exporté ✓'; setTimeout(() => { btn.textContent = 'Exporter les participants (CSV)'; btn.disabled = false; }, 2500); }
    } catch (e) {
      if (btn){ btn.textContent = 'Erreur'; setTimeout(() => { btn.textContent = 'Exporter les participants (CSV)'; btn.disabled = false; }, 2500); }
    }
  }

  function exporterNoticeScientifique(){
    if (!window.Competences || !Competences.NOTICE) return;
    const N = Competences.NOTICE;
    const TRAITS_FR = { O: 'Ouverture', C: 'Conscience', E: 'Extraversion', A: 'Agréabilité', S: 'Stabilité émotionnelle' };
    let corps = N.preambule.map(p => '<p>' + esc(p) + '</p>').join('');
    corps += '<h2>Le référentiel, compétence par compétence</h2>';
    Competences.REFERENTIEL.forEach(c => {
      const poids = Object.entries(c.poids).map(([t, p]) => TRAITS_FR[t] + ' ' + Math.round(p * 100) + '%').join(' · ');
      corps += '<h3>' + esc(c.nom) + ' <span class="brief-decl-fam">' + esc(c.famille) + '</span></h3>'
        + '<p class="brief-intention">Pondération : ' + esc(poids) + '</p>'
        + '<p>' + esc((N.parComp || {})[c.id] || '') + '</p>';
    });
    ouvrirImpression('Notice scientifique · Référentiel de compétences Sinéa', corps);
  }

  function toggleSanteDetail(){
    const d = document.getElementById('sup-sante-det');
    if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
  }

  function exporterRapportQualite(){
    if (!superData || !superData.qualite) return;
    const q = superData.qualite; const act = superData.activite || {}; const alertes = superData.alertes || [];
    let corps = '<h2>Qualité perçue</h2>';
    corps += '<p>Note moyenne : <b>' + esc(String(q.noteMoyenne !== null ? q.noteMoyenne : 'aucune note')) + '</b> sur ' + q.nbNotes + ' notes. ';
    corps += 'Paris justes : <b>' + (q.paris && q.paris.total ? pctSup(q.paris.accord, q.paris.total) + '%' : 'aucun pari') + '</b> (' + ((q.paris || {}).total || 0) + ' paris). ';
    corps += 'Fiabilité moyenne des protocoles : <b>' + esc(String((q.fiabilite || {}).moyenne !== null ? (q.fiabilite || {}).moyenne : 'non mesurée')) + '</b>' + ((q.fiabilite || {}).faible ? ', dont ' + q.fiabilite.faible + ' protocole(s) à fiabilité basse' : '') + '.</p>';
    const ad = q.adoption || {};
    corps += '<h2>Adoption des briques</h2><ul>'
      + '<li>Plan d\'action : ' + pctSup(ad.plan || 0, ad.base || 0) + '% (' + (ad.plan || 0) + ' / ' + (ad.base || 0) + ')</li>'
      + '<li>Défis SeedUp synchronisés : ' + pctSup(ad.seedup || 0, ad.base || 0) + '% (' + (ad.seedup || 0) + ')</li>'
      + '<li>Re-mesure express : ' + pctSup(ad.remesure || 0, ad.base || 0) + '% (' + (ad.remesure || 0) + ')</li>'
      + '<li>Miroir 360 : ' + pctSup(ad.miroir || 0, ad.base || 0) + '% (' + (ad.miroir || 0) + ')</li></ul>';
    const sa = q.sante || {}; const co = q.cout || {};
    corps += '<h2>Santé technique et coût</h2><p>Portraits complets : <b>' + (sa.completude !== null && sa.completude !== undefined ? sa.completude + '%' : 'non mesuré') + '</b>' + (sa.portraitsErr ? ', ' + sa.portraitsErr + ' portrait(s) avec ' + sa.sectionsErr + ' section(s) en erreur' : ', aucune section en erreur') + '. '
      + 'Coût mesuré : <b>' + (co.moyenUsd !== null && co.moyenUsd !== undefined ? co.moyenUsd + ' $ par portrait' : 'en attente des premiers portraits') + '</b>' + (co.totalUsd ? ', ' + co.totalUsd + ' $ au total, ' + (co.economieUsd || 0) + ' $ économisés par le cache' : '') + '.</p>';
    if ((q.parCampagne || []).length){
      corps += '<h2>Qualité par campagne (fragiles en tête)</h2><ul>' + q.parCampagne.slice(0, 6).map(c => '<li><b>' + esc(c.campagne || '·') + '</b> (' + esc(c.entreprise || '') + ') : ' + c.termines + ' terminés, note ' + (c.note !== null ? c.note : 'aucune') + ', paris ' + (c.paris !== null ? c.paris + '%' : '·') + ', ' + c.err + ' erreur(s)</li>').join('') + '</ul>';
    }
    if ((q.avisAExaminer || []).length){
      corps += '<h2>Avis à examiner</h2><ul>' + q.avisAExaminer.map(a => '<li><b>' + esc(String(a.note)) + '/5</b> · ' + esc(a.texte) + ' <i>(' + esc(a.entreprise || '') + (a.campagne ? ' · ' + esc(a.campagne) : '') + ')</i></li>').join('') + '</ul>';
    }
    if ((q.derniersAvis || []).length){
      corps += '<h2>Derniers avis</h2><ul>' + q.derniersAvis.map(a => '<li><b>' + esc(String(a.note)) + '/5</b> · ' + esc(a.texte) + ' <i>(' + esc(a.entreprise || '') + ')</i></li>').join('') + '</ul>';
    }
    if ((act.semaines || []).length){
      corps += '<h2>Activité des 8 dernières semaines</h2><ul>' + act.semaines.map(x => '<li>Semaine du ' + esc(x.semaine) + ' : ' + x.n + ' passation(s)</li>').join('') + '</ul>';
    }
    if (alertes.length){
      corps += '<h2>Alertes</h2><ul>' + alertes.map(a => '<li><b>' + (a.type === 'quota' ? 'Quota' : 'Dormante') + '</b> · ' + esc(a.entreprise || '') + ' · ' + esc(a.campagne || '') + ' : ' + esc(a.detail || '') + '</li>').join('') + '</ul>';
    }
    ouvrirImpression('Rapport qualité Sinéa Profile', corps);
  }

  // ===== Rapport de fin de campagne SeedUp (super admin) =====
  // Analyse locale des exports SeedUp, croisement avec les profils Sinéa de la
  // campagne, puis narratif d'impact généré et tableaux calculés sur place.

  // Analyseur CSV robuste : guillemets, retours à la ligne dans les champs,
  // séparateur détecté (point-virgule ou virgule), BOM retiré.
  function parseCSVSeed(texte){
    texte = String(texte || '').replace(/^\uFEFF/, '');
    const premiere = texte.split(/\r?\n/)[0] || '';
    const sep = (premiere.split(';').length >= premiere.split(',').length) ? ';' : ',';
    const lignes = []; let ligne = []; let champ = ''; let dansQuote = false;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (dansQuote) {
        if (c === '"') { if (texte[i + 1] === '"') { champ += '"'; i++; } else dansQuote = false; }
        else champ += c;
      } else if (c === '"') dansQuote = true;
      else if (c === sep) { ligne.push(champ); champ = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texte[i + 1] === '\n') i++;
        ligne.push(champ); champ = '';
        if (ligne.some(x => String(x).trim() !== '')) lignes.push(ligne);
        ligne = [];
      } else champ += c;
    }
    ligne.push(champ);
    if (ligne.some(x => String(x).trim() !== '')) lignes.push(ligne);
    return lignes;
  }

  function lireFichier(input){
    return new Promise((resoudre) => {
      const f = input && input.files && input.files[0];
      if (!f) return resoudre(null);
      const lecteur = new FileReader();
      lecteur.onload = () => resoudre(String(lecteur.result || ''));
      lecteur.onerror = () => resoudre(null);
      lecteur.readAsText(f, 'utf-8');
    });
  }

  function normNom(v){
    return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  async function genererRapport(){
    const zone = document.getElementById('rapport-zone');
    const btn = document.getElementById('btn-rapport');
    if (!zone || !campagneData) return;
    const [txtStats, txtDefis] = await Promise.all([
      lireFichier(document.getElementById('rapp-stats')),
      lireFichier(document.getElementById('rapp-defis')),
    ]);
    if (!txtStats && !txtDefis){ zone.innerHTML = '<div class="empty">Déposez au moins un des deux exports SeedUp.</div>'; return; }
    if (btn){ btn.disabled = true; btn.textContent = 'Génération du rapport...'; }

    // 1. Stats générales : paires indicateur / valeur
    let stats = [];
    if (txtStats){
      const lg = parseCSVSeed(txtStats);
      stats = lg.filter(l => l.length >= 2 && normNom(l[0]) !== 'indicateur').map(l => ({ indicateur: String(l[0]).trim(), valeur: String(l[1]).trim() }));
    }

    // 2. Défis réalisés : agrégation par participant et par défi
    const calc = { participants: [], parFamille: [], defisTop: [], defisFlop: [], decrocheurs: [], faibles: [], verbatims: [], realisations: 0 };
    if (txtDefis){
      const lg = parseCSVSeed(txtDefis);
      if (lg.length > 1){
        const entetes = lg[0].map(h => normNom(h));
        const col = (deb) => entetes.findIndex(h => h.indexOf(deb) === 0);
        const iNom = col('nom'), iPrenom = col('prenom'), iDefi = col('defi realise'), iDeb = col('debrief'), iReu = col('note de reussite'), iNote = col('note du defi');
        const parts = {}; const defis = {};
        lg.slice(1).forEach(l => {
          const nomComplet = ((l[iPrenom] || '') + ' ' + (l[iNom] || '')).trim();
          const cle = normNom(nomComplet);
          if (!cle) return;
          calc.realisations++;
          const p = parts[cle] || (parts[cle] = { nom: nomComplet, n: 0, reussite: [], note: [] });
          p.n++;
          const vr = parseFloat(String(l[iReu] || '').replace(',', '.')); if (!isNaN(vr)) p.reussite.push(vr);
          const vn = parseFloat(String(l[iNote] || '').replace(',', '.')); if (!isNaN(vn)) p.note.push(vn);
          const titre = String(l[iDefi] || '').trim();
          if (titre){ const df = defis[titre] || (defis[titre] = { titre, n: 0, note: [] }); df.n++; if (!isNaN(vn)) df.note.push(vn); }
          const deb = String((iDeb >= 0 ? l[iDeb] : '') || '').trim();
          if (deb && deb.indexOf('http') !== 0 && deb.length > 25 && cle.indexOf('test') < 0){
            calc.verbatims.push({ participant: nomComplet, defi: titre, texte: deb.replace(/\s+/g, ' ').slice(0, 220), l: deb.length });
          }
        });
        const moy = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 100) / 100 : null;
        // Croisement avec les profils Sinéa de la campagne
        const profils = {};
        (campagneData.repondants || []).forEach(r => { profils[normNom(r.nom)] = r; });
        const famAgg = {};
        Object.values(parts).forEach(p => {
          const cle = normNom(p.nom);
          const estTest = cle.indexOf('test') >= 0;
          const prof = profils[cle] || profils[cle.split(' ').reverse().join(' ')] || null;
          const entree = { nom: p.nom, n: p.n, reussite: moy(p.reussite), note: moy(p.note), archetype: prof ? prof.dominante : '', famille: prof ? String(prof.famille || '').toUpperCase() : '', test: estTest };
          calc.participants.push(entree);
          if (!estTest && p.n < 3) calc.faibles.push(p.nom);
          if (!estTest && entree.famille){
            const fa = famAgg[entree.famille] || (famAgg[entree.famille] = { famille: entree.famille, participants: 0, nbDefis: 0, notes: [] });
            fa.participants++; fa.nbDefis += p.n; fa.notes.push.apply(fa.notes, p.note);
          }
        });
        calc.participants.sort((a, b) => b.n - a.n);
        calc.parFamille = Object.values(famAgg).map(f => ({ famille: f.famille, participants: f.participants, nbDefis: f.nbDefis, note: moy(f.notes) }));
        (campagneData.repondants || []).forEach(r => {
          if (!String(r.statut || '').toLowerCase().startsWith('termin')) return;
          const cle = normNom(r.nom);
          if (!parts[cle] && !parts[cle.split(' ').reverse().join(' ')] && cle.indexOf('test') < 0) calc.decrocheurs.push(r.nom);
        });
        const notes2 = Object.values(defis).filter(d => d.note.length >= 2).map(d => ({ titre: d.titre, n: d.n, note: moy(d.note) }));
        notes2.sort((a, b) => b.note - a.note);
        calc.defisTop = notes2.slice(0, 4);
        calc.defisFlop = notes2.slice(-3).reverse();
        calc.verbatims.sort((a, b) => b.l - a.l);
        calc.verbatims = calc.verbatims.slice(0, 5).map(v => ({ participant: v.participant, defi: v.defi, texte: v.texte }));
      }
    }

    fetch(RAPPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Dashboard-Key': cleAcces },
      body: JSON.stringify({
        entreprise: campagneData.entreprise || '', campagne: campagneData.nom || codeCampagneCourant,
        stats: stats, participants: calc.participants, parFamille: calc.parFamille,
        defisTop: calc.defisTop, defisFlop: calc.defisFlop,
        decrocheurs: calc.decrocheurs, faibles: calc.faibles, verbatims: calc.verbatims,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (btn){ btn.disabled = false; btn.textContent = 'Générer le rapport'; }
        if (!d || !d.ok || !d.rapport){ zone.innerHTML = '<div class="empty">La génération du rapport a échoué. Réessayez dans un instant.</div>'; return; }
        rapportCourant = d.rapport;
        rapportCourant._calc = calc;
        rapportCourant._stats = stats;
        rapportCourant._entreprise = campagneData.entreprise || '';
        rapportCourant._campagne = campagneData.nom || codeCampagneCourant;
        zone.innerHTML = '<div class="brief-card">' +
          '<div class="brief-head"><div><div class="brief-kicker">Rapport de fin de campagne SeedUp</div><div class="brief-titre">' + esc(rapportCourant._entreprise) + (rapportCourant._campagne ? ' · ' + esc(rapportCourant._campagne) : '') + '</div></div>' +
          '<button class="exp-btn exp-mini" onclick="exporterRapport()">Exporter en PDF</button></div>' +
          rapportCorpsHtml(rapportCourant) + '</div>';
        zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(() => {
        if (btn){ btn.disabled = false; btn.textContent = 'Générer le rapport'; }
        zone.innerHTML = '<div class="empty">Erreur réseau pendant la génération.</div>';
      });
  }

  // ===== Synchronisation SeedUp -> espaces apprenants =====
  // Lit le CSV des défis réalisés, joint chaque participant à son profil Sinéa
  // par le nom, puis écrit sa bibliothèque de défis (débrief et retour coach
  // compris) dans ses interactions, sous la clé "seedup" que lit son espace.
  // Idempotent : chaque envoi remplace la bibliothèque, redéposer le CSV
  // cumulé chaque semaine ne crée aucun doublon.
  async function synchroniserSeedup(){
    const msg = document.getElementById('sync-msg');
    const btn = document.getElementById('btn-sync');
    if (!msg || !campagneData) return;
    const txtDefis = await lireFichier(document.getElementById('rapp-defis'));
    if (!txtDefis){ msg.innerHTML = '<div class="empty">Déposez d\'abord le CSV des défis réalisés.</div>'; return; }
    if (btn){ btn.disabled = true; btn.textContent = 'Synchronisation...'; }

    const lg = parseCSVSeed(txtDefis);
    const entetes = lg[0].map(h => normNom(h));
    const col = (deb) => entetes.findIndex(h => h.indexOf(deb) === 0);
    const iNom = col('nom'), iPrenom = col('prenom'), iDefi = col('defi realise'), iDate = col('date'), iDeb = col('debrief'), iCoach = col('reponse du coach'), iReu = col('note de reussite'), iNote = col('note du defi');

    // Regrouper les réalisations par participant
    const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
    const versISO = (d) => { const m = String(d || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : String(d || '').slice(0, 10); };
    const parts = {};
    lg.slice(1).forEach(l => {
      const nomComplet = ((l[iPrenom] || '') + ' ' + (l[iNom] || '')).trim();
      const cle = normNom(nomComplet);
      if (!cle || cle.indexOf('test') >= 0) return;
      const p = parts[cle] || (parts[cle] = { nom: nomComplet, liste: [] });
      p.liste.push({
        d: versISO(iDate >= 0 ? l[iDate] : ''),
        t: String(l[iDefi] || '').trim().slice(0, 160),
        deb: String((iDeb >= 0 ? l[iDeb] : '') || '').trim().slice(0, 600),
        coach: String((iCoach >= 0 ? l[iCoach] : '') || '').trim().slice(0, 400),
        r: num(l[iReu]), n: num(l[iNote]),
      });
    });

    // Jointure vers les emails Sinéa de la campagne
    const profils = {};
    (campagneData.repondants || []).forEach(r => { if (r.email) profils[normNom(r.nom)] = r; });
    const aSync = []; const nonRelies = [];
    Object.values(parts).forEach(p => {
      const cle = normNom(p.nom);
      const prof = profils[cle] || profils[cle.split(' ').reverse().join(' ')] || null;
      if (prof) aSync.push({ email: prof.email, nom: p.nom, liste: p.liste });
      else nonRelies.push(p.nom);
    });
    if (!aSync.length){
      if (btn){ btn.disabled = false; btn.textContent = 'Synchroniser vers les espaces'; }
      msg.innerHTML = '<div class="empty">Aucun participant du CSV ne correspond à un profil de cette campagne.</div>';
      return;
    }

    // Écriture séquentielle, douce pour Airtable
    let ok = 0, echecs = 0;
    for (const p of aSync){
      msg.innerHTML = '<div class="sup-vide">Synchronisation de ' + esc(p.nom) + '... (' + (ok + echecs + 1) + ' / ' + aSync.length + ')</div>';
      try {
        p.liste.sort((a, b) => String(a.d).localeCompare(String(b.d)));
        const rep = await fetch(PROG_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_interactions', email: p.email, type_analyse: 'seedup', interactions: { liste: p.liste.slice(-60), maj: new Date().toISOString(), campagne: campagneData.nom || codeCampagneCourant, source: 'csv' } }),
        });
        if (rep.ok) ok++; else echecs++;
      } catch (e) { echecs++; }
    }
    if (btn){ btn.disabled = false; btn.textContent = 'Synchroniser vers les espaces'; }
    msg.innerHTML = '<div class="sup-vide"><b>' + ok + ' espace(s) apprenant(s) synchronisé(s)</b>'
      + (echecs ? ' · ' + echecs + ' échec(s)' : '')
      + (nonRelies.length ? ' · sans profil relié : ' + nonRelies.map(esc).join(', ') : '')
      + '. Les blocs « Vos défis de terrain » sont maintenant visibles dans leurs espaces, et Néa en parle à leur retour.</div>';
  }

  function rapportCorpsHtml(r){
    const calc = r._calc || {}; const stats = r._stats || [];
    let h = '';
    if (r.titre) h += '<div class="brief-cap"><div class="brief-kicker">' + esc(r.titre) + '</div><div class="brief-cap-txt">' + esc(r.synthese || '') + '</div></div>';
    if (stats.length){
      h += '<h2>Les chiffres de la campagne</h2><table class="brief-table"><tr><th>Indicateur</th><th>Valeur</th></tr>';
      stats.forEach(x => { h += '<tr><td>' + esc(x.indicateur) + '</td><td><b>' + esc(x.valeur) + '</b></td></tr>'; });
      h += '</table>';
    }
    if (r.lecture_chiffres) h += '<p class="brief-intention">' + esc(r.lecture_chiffres) + '</p>';
    if ((calc.participants || []).length){
      h += '<h2>Engagement par participant</h2><table class="brief-table"><tr><th>Participant</th><th>Profil Sinéa</th><th>Défis</th><th>Réussite /10</th><th>Note défis /5</th></tr>';
      calc.participants.forEach(p => { h += '<tr' + (p.test ? ' style="opacity:0.5"' : '') + '><td>' + esc(p.nom) + (p.test ? ' (test)' : '') + '</td><td>' + esc(p.archetype ? p.archetype + ' (' + p.famille + ')' : 'non relié') + '</td><td>' + p.n + '</td><td>' + (p.reussite ?? '·') + '</td><td>' + (p.note ?? '·') + '</td></tr>'; });
      h += '</table>';
    }
    if ((r.enseignements || []).length) h += '<h2>Les enseignements</h2><ul>' + r.enseignements.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>';
    if ((r.lecture_familles || []).length) h += '<h2>Lecture par famille</h2>' + r.lecture_familles.map(f => '<div class="brief-decl"><span class="brief-decl-fam">' + esc(f.famille) + '</span>' + esc(f.lecture) + '</div>').join('');
    if ((calc.defisTop || []).length){
      h += '<h2>Les défis qui ont pris</h2><ul>' + calc.defisTop.map(x => '<li><b>' + esc(x.titre) + '</b> : ' + x.n + ' réalisations, note ' + (x.note ?? '·') + '/5</li>').join('') + '</ul>';
      if ((calc.defisFlop || []).length) h += '<p class="brief-intention">À retravailler : ' + calc.defisFlop.map(x => esc(x.titre) + ' (' + (x.note ?? '·') + '/5)').join(' · ') + '</p>';
    }
    if ((r.suivi || []).length) h += '<h2>Suivi individuel</h2>' + r.suivi.map(sv => '<div class="brief-defi"><div class="brief-defi-titre">' + esc(sv.nom) + '</div><p>' + esc(sv.lecture) + '</p></div>').join('');
    if ((r.recommandations || []).length) h += '<h2>Recommandations</h2><ul>' + r.recommandations.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    if (r.suite) h += '<h2>La suite proposée</h2><p>' + esc(r.suite) + '</p>';
    return h;
  }

  function exporterRapport(){
    if (!rapportCourant) return;
    ouvrirImpression('Rapport de fin de campagne SeedUp · ' + (rapportCourant._entreprise || ''), rapportCorpsHtml(rapportCourant));
  }

  function ouvrirImpression(titre, corps){
    var w = window.open('', '_blank');
    if(!w){ alert('Autorisez les fenêtres pop-up pour exporter en PDF.'); return; }
    corps = '<div class="pdf-tete"><span class="pdf-marque">SINÉA PROFILE</span><span class="pdf-date">' + new Date().toLocaleDateString('fr-FR') + '</span></div>'
      + '<div class="pdf-conf">Document confidentiel · réservé à l\'usage du client</div>' + corps;
    var styles = "body{font-family:'Poppins','Manrope',-apple-system,Segoe UI,Roboto,sans-serif;color:#1A1A2E;max-width:800px;margin:0 auto;padding:0 0 40px;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact;}"+
      ".exp-band{height:9px;background:linear-gradient(90deg,#F98272,#E290EC 55%,#5E59C7);}"+
      ".pdf-tete{display:flex;justify-content:space-between;align-items:baseline;margin:14px 0 2px;}"+
      ".pdf-marque{font-size:12px;font-weight:800;letter-spacing:0.14em;color:#5E59C7;}"+
      ".pdf-date{font-size:11px;color:#8A879B;font-weight:600;}"+
      ".pdf-conf{font-size:10px;color:#B0AEB8;letter-spacing:0.04em;margin-bottom:10px;border-bottom:1px solid #EFEDE6;padding-bottom:8px;}"+
      "h3{font-size:14px;margin:16px 0 3px;}"+
      ".q16,.dp2{width:100%;height:auto;display:block;}"+
      ".bd-q16{margin:6px 0 14px;}"+
      ".brief-cap{padding:14px 16px;border-radius:14px;background:#F3F1FA;border-left:4px solid #5E59C7;margin:14px 0;}"+
      ".brief-kicker{font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#5E59C7;}"+
      ".brief-cap-txt{font-size:15px;font-weight:700;margin-top:3px;line-height:1.45;}"+
      ".brief-intention{font-size:13px;color:#6B6B72;font-style:italic;margin:6px 0 10px;}"+
      ".brief-defi{padding:11px 13px;border-radius:12px;background:#F8F7F4;margin-bottom:9px;page-break-inside:avoid;}"+
      ".brief-defi-titre{font-size:13.5px;font-weight:800;color:#5E59C7;margin-bottom:4px;}"+
      ".brief-reussite{font-size:12px;color:#6B6B72;font-weight:600;margin-bottom:7px;}"+
      ".brief-decls{margin-top:5px;}"+
      ".brief-decl{font-size:12px;line-height:1.5;background:#fff;border:1px solid #ECEAE3;border-radius:9px;padding:6px 9px;margin-bottom:4px;}"+
      ".brief-decl-fam{display:inline-block;font-size:10px;font-weight:800;letter-spacing:0.05em;color:#5E59C7;margin-right:6px;}"+
      ".brief-table{width:100%;border-collapse:collapse;font-size:12.5px;margin:8px 0;}"+
      ".brief-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#6B6B72;padding:6px 8px;border-bottom:2px solid #EFEDE6;}"+
      ".brief-table td{padding:7px 8px;border-bottom:1px solid #F0EEE8;}"+
      ".bd-date{font-size:11.5px;color:#8A879B;margin-bottom:8px;}"+
      ".bd-preuve{display:inline-block;font-size:12px;font-weight:800;color:#2F6B3E;background:#E9F3EC;border:1px solid #BCD9C4;border-radius:14px;padding:6px 12px;margin-bottom:10px;}"+
      ".bd-accroche{font-size:14px;line-height:1.6;padding:12px 14px;border-radius:12px;background:#F3F1FA;border-left:4px solid #5E59C7;margin-bottom:12px;}"+
      ".bd-titre-sec{font-size:11px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;color:#5E59C7;margin:14px 0 8px;}"+
      ".bd-carte{padding:11px 13px;border-radius:12px;margin-bottom:8px;background:#F8F7F4;page-break-inside:avoid;}"+
      ".bd-appui{border-left:4px solid #4C8F5D;}.bd-opp{border-left:4px solid #E8951A;}.bd-vigi{border-left:4px solid #B0AEB8;}"+
      ".bd-comp{font-size:13.5px;font-weight:800;margin-bottom:5px;}"+
      ".bd-usage,.bd-pourquoi,.bd-levier{font-size:12.5px;line-height:1.55;margin:4px 0;}"+
      ".bd-offre{display:inline-block;font-size:11px;font-weight:800;color:#5E59C7;background:#EEECf9;border-radius:12px;padding:4px 10px;margin-top:4px;}"+
      ".bd-jauge{display:flex;align-items:center;gap:8px;margin:4px 0 7px;}"+
      ".bd-jauge-lab{font-size:10px;font-weight:700;color:#6B6B72;white-space:nowrap;}"+
      ".bd-jauge-bar{position:relative;flex:1;height:8px;border-radius:5px;background:#ECEAE3;}"+
      ".bd-jauge-pot{position:absolute;top:0;left:0;bottom:0;border-radius:5px;background:#5E59C7;}"+
      ".bd-jauge-expr{position:absolute;top:-3px;width:3px;height:14px;border-radius:2px;background:#F98272;}"+
      ".bd-seedup{margin-top:14px;padding:12px 14px;border-radius:14px;page-break-inside:avoid;}"+
      ".bd-seedup.on{background:#EEF6F0;border:1px solid #BCD9C4;}"+
      ".bd-seedup.off{background:#F6F5F1;border:1.5px dashed #C9C5BA;}"+
      ".bd-seedup-head{font-size:12.5px;font-weight:800;margin-bottom:6px;}"+
      ".bd-badge-on{font-size:10px;font-weight:800;color:#fff;background:#4C8F5D;border-radius:12px;padding:3px 9px;margin-left:8px;}"+
      ".bd-badge-off{font-size:10px;font-weight:800;color:#8A879B;background:#ECEAE3;border-radius:12px;padding:3px 9px;margin-left:8px;}"+
      ".bd-seedup-txt{font-size:12px;line-height:1.55;color:#4A4A52;margin:0 0 7px;}"+
      ".bd-defi-ligne{font-size:11.5px;line-height:1.5;padding:6px 9px;background:#fff;border-radius:9px;margin-bottom:4px;border:1px solid #ECEAE3;}"+
      ".bd-conclusion{font-size:13px;line-height:1.6;font-style:italic;margin-top:12px;padding-top:10px;border-top:1px solid #ECEAE3;}"+
      ".bd-mat-row{display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid #F0EEE8;page-break-inside:avoid;}"+
      ".bd-mat-nom{flex:0 0 210px;font-size:12px;font-weight:600;}"+
      ".bd-mat-zone{flex:0 0 86px;text-align:center;font-size:10px;font-weight:800;border-radius:10px;padding:3px 0;}"+
      ".z-appui{background:#E4F0E7;color:#2F6B3E;}.z-opportunite{background:#FBEBD2;color:#8A5A00;}.z-neutre{background:#EFEDE6;color:#6B6B72;}.z-economie{background:#F5F4F0;color:#9A98A3;}"+
      ".ce-chip{display:inline-block;font-size:11px;font-weight:700;color:#5E59C7;background:#EEECF9;border-radius:12px;padding:3px 10px;margin:0 3px 3px 0;}"+
      ".ch-regard-pdf{font-size:12px;color:#6B6B72;}"+
      ".exp-wrap{padding:30px 42px 0;}"+
      ".exp-logo{font-size:13px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#5E59C7;}"+
      ".exp-logo span{color:#C9C3E8;margin-left:7px;}"+
      "h1{font-size:26px;font-weight:800;letter-spacing:-0.02em;margin:16px 0 6px;color:#1A1A2E;}"+
      ".exp-sous{font-size:13px;color:#8A8A98;margin-bottom:18px;}"+
      ".exp-badge{display:inline-block;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:5px 12px;border-radius:7px;background:#1A1A2E;color:#fff;margin-bottom:20px;}"+
      "h2{font-size:12.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#5E59C7;margin:26px 0 9px;padding-left:12px;border-left:3px solid #E290EC;}"+
      "p{font-size:13.5px;margin:0 0 11px;color:#33333F;}"+
      "ul{margin:0 0 14px;padding-left:2px;list-style:none;} li{font-size:13.5px;margin-bottom:8px;padding-left:20px;position:relative;color:#33333F;}"+
      "li::before{content:'';position:absolute;left:3px;top:7px;width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#F98272,#E290EC);}"+
      ".exp-cle{margin:18px 0;padding:16px 20px;background:linear-gradient(135deg,rgba(94,89,199,0.07),rgba(226,144,236,0.07));border-radius:12px;border-left:3px solid #5E59C7;font-style:italic;font-weight:600;font-size:14px;color:#33333F;}"+
      ".exp-score{font-size:38px;font-weight:800;margin:4px 0 14px;color:#5E59C7;}"+
      ".exp-dim{display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid #EEE;padding:7px 0;}"+
      ".exp-foot{margin:34px 42px 0;padding-top:16px;border-top:1px solid #ECECEC;font-size:11px;color:#A0A0AA;line-height:1.5;}"+
      "@media print{ .exp-wrap{padding-top:22px;} }";
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+titre+'</title><style>'+styles+'</style></head><body>'+
      '<div class="exp-band"></div><div class="exp-wrap"><div class="exp-logo">Sinéa<span>Profile</span></div>'+corps+
      '<div class="exp-foot">Document établi par Sinéa Profile · sineaformation.fr · Cet éclairage nourrit la réflexion et le dialogue, la décision finale reste humaine.</div>'+
      '</div><scr'+'ipt>window.onload=function(){setTimeout(function(){window.print();},350);};</scr'+'ipt></body></html>');
    w.document.close();
  }
  function expListe(arr){ return Array.isArray(arr)&&arr.length ? '<ul>'+arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>' : ''; }
  function dateFr(){ try{ return new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return ''; } }

  // Version PARTAGEABLE : aucune trace des scores ni des signaux RH, par construction.
  function exporterCompat(mode){
    var data = derniereCompat; if(!data){ return; }
    var a = data.analyse || {};
    var titre = 'Mieux travailler ensemble · '+data.manager.nom+' et '+data.collaborateur.nom;
    var corps = '<h1>'+esc(titre)+'</h1><div class="exp-sous">'+esc(data.manager.nom)+' ('+esc(data.manager.archetype)+') et '+esc(data.collaborateur.nom)+' ('+esc(data.collaborateur.archetype)+') · '+dateFr()+'</div>';
    if(mode==='complet'){
      corps += '<div class="exp-badge">Document interne RH</div>';
      var sc = data.scores||{}; var dims = sc.dimensions||{};
      corps += '<h2>Compatibilité globale</h2><div class="exp-score">'+(sc.global!=null?sc.global+'/100 · '+libScore(sc.global):'non calculée')+'</div>';
      corps += Object.keys(dims).map(function(k){ return '<div class="exp-dim"><span>'+esc(dims[k].label)+'</span><b>'+dims[k].score+'</b></div>'; }).join('');
      if(Array.isArray(a.signaux_rh)&&a.signaux_rh.length){ corps += '<h2>Signaux RH à surveiller</h2>'+expListe(a.signaux_rh); }
    }
    if(a.synthese) corps += '<h2>La dynamique du binôme</h2><p>'+esc(a.synthese)+'</p>';
    if(Array.isArray(a.points_fluides)) corps += '<h2>Ce qui fonctionne naturellement</h2>'+expListe(a.points_fluides);
    if(Array.isArray(a.points_attention)) corps += '<h2>Points à anticiper ensemble</h2>'+expListe(a.points_attention);
    if(Array.isArray(a.conseils_manager)) corps += '<h2>Conseils au manager</h2>'+expListe(a.conseils_manager);
    if(Array.isArray(a.conseils_collaborateur)) corps += '<h2>Conseils au collaborateur</h2>'+expListe(a.conseils_collaborateur);
    if(a.cle_de_voute) corps += '<div class="exp-cle">'+esc(a.cle_de_voute)+'</div>';
    ouvrirImpression(titre, corps);
  }

  function exporterAnalyseEq(){
    var a = derniereAnalyseEq; if(!a){ return; }
    var titre = 'Analyse stratégique d\'équipe';
    var corps = '<h1>'+esc(titre)+'</h1><div class="exp-sous">'+dateFr()+'</div><div class="exp-badge">Document interne RH</div>';
    if(a.synthese) corps += '<h2>Synthèse</h2><p>'+esc(a.synthese)+'</p>';
    var sw = a.swot||{};
    if(Array.isArray(sw.forces)) corps += '<h2>Forces</h2>'+expListe(sw.forces);
    if(Array.isArray(sw.faiblesses)) corps += '<h2>Points de vigilance</h2>'+expListe(sw.faiblesses);
    if(Array.isArray(sw.opportunites)) corps += '<h2>Opportunités</h2>'+expListe(sw.opportunites);
    if(Array.isArray(sw.risques)) corps += '<h2>Risques</h2>'+expListe(sw.risques);
    if(a.dynamiques) corps += '<h2>Dynamiques d\'équipe</h2><p>'+esc(a.dynamiques)+'</p>';
    if(Array.isArray(a.risques_rh)) corps += '<h2>Points d\'attention RH</h2>'+expListe(a.risques_rh);
    if(Array.isArray(a.plan_action)) corps += '<h2>Plan d\'action</h2>'+expListe(a.plan_action.map(function(p){return (p.titre?p.titre+' · ':'')+(p.desc||'');}));
    var r = a.recrutement;
    if(r){
      corps += '<h2>Recrutement</h2>';
      if(r.diagnostic) corps += '<p>'+esc(r.diagnostic)+'</p>';
      if(r.profil_cible) corps += '<p><b>Profil à viser :</b> '+esc(r.profil_cible)+'</p>';
      var fp = r.fiche_poste||{};
      if(fp.intitule) corps += '<p><b>'+esc(fp.intitule)+'</b></p>';
      if(fp.pourquoi) corps += '<p>'+esc(fp.pourquoi)+'</p>';
      if(Array.isArray(fp.traits_recherches)) corps += '<p><b>À rechercher :</b></p>'+expListe(fp.traits_recherches);
      if(Array.isArray(fp.signaux_entretien)) corps += '<p><b>À observer en entretien :</b></p>'+expListe(fp.signaux_entretien);
      if(fp.vigilance) corps += '<p><b>Vigilance d\'intégration :</b> '+esc(fp.vigilance)+'</p>';
      if(r.besoin_secondaire) corps += '<p><b>Second besoin :</b> '+esc(r.besoin_secondaire)+'</p>';
    }
    if(derniereGrille){
      corps += '<h2>Grille d\'entretien</h2>';
      if(derniereGrille.intro) corps += '<p>'+esc(derniereGrille.intro)+'</p>';
      (derniereGrille.criteres||[]).forEach(function(c){
        corps += '<p><b>'+esc(c.critere||'')+'</b></p>'+expListe(c.questions)+
          '<p>Signaux positifs :</p>'+expListe(c.signaux_positifs)+
          '<p>Signaux d\'alerte :</p>'+expListe(c.signaux_alerte);
      });
      var ms = derniereGrille.mise_en_situation;
      if(ms){ corps += '<p><b>Mise en situation :</b> '+esc(ms.consigne||'')+'</p>'+expListe(ms.attendus); }
      if(derniereGrille.question_integration) corps += '<p><b>Question d\'intégration :</b> '+esc(derniereGrille.question_integration)+'</p>';
      if(derniereGrille.conseil_notation) corps += '<p><b>Notation :</b> '+esc(derniereGrille.conseil_notation)+'</p>';
    }
    ouvrirImpression(titre, corps);
  }

  // ============================================================
  // VUE RECRUTEMENT : profil cible + adéquation des candidats
  // ============================================================

  function sectionRecrutementHtml(camp, repsTous){
    var cible = camp.profilCible || profilCibleCourant;
    var h = '<div class="section-label">Recrutement</div><div class="recrut-box">';
    h += '<div class="compat-intro">Collez la fiche de poste : Sinéa en extrait le profil comportemental cible (soft skills), puis mesure l\'adéquation de chaque candidat. '
      + 'L\'adéquation porte sur le comportement et les soft skills, jamais sur les compétences techniques. '
      + '<span class="cadrage-note">Aucun candidat n\'est écarté automatiquement. Cet éclairage structure vos entretiens, la décision finale reste humaine.</span></div>';
    if(!cible){
      h += '<textarea id="recrut-fiche" class="recrut-textarea" rows="7" placeholder="Collez ici le texte de votre fiche de poste (missions, contexte, qualités attendues)…"></textarea>';
      h += '<div class="compat-actions"><button class="compat-btn" id="recrut-btn" onclick="genererProfilCible()">Définir le profil cible depuis la fiche</button></div>';
      h += '<div id="recrut-cible-zone"></div>';
    } else {
      h += '<div id="recrut-cible-zone">'+profilCibleHtml(cible)+'</div>';
      h += '<div class="compat-actions"><button class="sel-btn" onclick="redefinirProfilCible()">Redéfinir depuis une autre fiche</button></div>';
      h += vueCandidatsHtml(cible, repsTous);
    }
    h += '</div>';
    return h;
  }

  let profilCibleCourant = null;

  function redefinirProfilCible(){
    profilCibleCourant = null;
    if(campagneData && campagneData.campagne) campagneData.campagne.profilCible = null;
    vueRecrutementForcee = true;
    renderCampagneVue();
  }

  function genererProfilCible(){
    var ta=document.getElementById('recrut-fiche'), btn=document.getElementById('recrut-btn'), zone=document.getElementById('recrut-cible-zone');
    if(!ta||!zone) return;
    var fiche=(ta.value||'').trim();
    if(fiche.length<60){ zone.innerHTML='<div class="compat-msg compat-err">Collez une fiche de poste un peu plus complète (60 caractères minimum).</div>'; return; }
    if(btn){ btn.disabled=true; btn.textContent='Lecture de la fiche…'; }
    zone.innerHTML='<div class="compat-msg">Extraction du profil comportemental cible…</div>';
    fetch(PROFIL_CIBLE_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Dashboard-Key':cleAcces},body:JSON.stringify({code:codeCampagneCourant,fichePoste:fiche})})
      .then(function(r){return r.json();})
      .then(function(data){
        if(btn){ btn.disabled=false; btn.textContent='Définir le profil cible depuis la fiche'; }
        if(data&&data.ok&&data.cible){
          profilCibleCourant=data.cible;
          if(campagneData&&campagneData.campagne) campagneData.campagne.profilCible=data.cible;
          renderCampagneVue();
        } else {
          zone.innerHTML='<div class="compat-msg compat-err">'+esc(data&&data.error?data.error:'Lecture impossible, réessayez.')+'</div>';
        }
      })
      .catch(function(){ if(btn){ btn.disabled=false; btn.textContent='Définir le profil cible depuis la fiche'; } zone.innerHTML='<div class="compat-msg compat-err">Connexion impossible. Réessayez.</div>'; });
  }

  var LIB_CIBLE = {
    energie:{sprinteur:'Sprinteur',endurant:'Endurant',cyclique:'Cyclique',deepworker:'Deep-worker'},
    autorite:{cadre:'Besoin de cadre',sens:'Besoin de sens',liberte:'Besoin de liberté',contributeur:'Associé aux décisions'},
    collaboration:{autonome:'Autonome',cooperatif:'Coopératif',interdependant:'Interdépendant',federateur:'Fédérateur'},
    reconnaissance:{resultats:'Par les résultats',effort:'De l\'effort',relation:'Par la considération',autonomie:'Par la confiance'},
    stress:{accelerateur:'Accélère sous stress',methodique:'Se structure sous stress',retrait:'Prend du recul',appui:'Cherche l\'appui'},
    conflit:{affrontement:'Aborde de front',mediation:'Médiateur',compromis:'Cherche le compromis',evitement:'Temporise'},
    risque:{audacieux:'Audacieux',calcule:'Risque calculé',prudent:'Prudent',securitaire:'Sécuritaire'},
    changement:{moteur:'Moteur du changement',adaptable:'Adaptable',pragmatique:'Pragmatique',ancre:'Ancré'}
  };
  function libCible(dim,val){ return (val&&LIB_CIBLE[dim]&&LIB_CIBLE[dim][val])?LIB_CIBLE[dim][val]:val; }

  function profilCibleHtml(c){
    var h='<div class="recrut-cible">';
    h+='<div class="recrut-cible-tit">Profil cible · '+esc(c.intitule_poste||'')+'</div>';
    if(c.resume) h+='<p class="recrut-cible-resume">'+esc(c.resume)+'</p>';
    h+='<div class="recrut-cible-tags">';
    if(c.famille_principale) h+='<span class="recrut-tag recrut-tag-fam">'+esc(c.famille_principale)+'</span>';
    if(c.famille_secondaire) h+='<span class="recrut-tag">'+esc(c.famille_secondaire)+'</span>';
    (c.soft_skills||[]).forEach(function(s){ h+='<span class="recrut-tag recrut-tag-soft">'+esc(s)+'</span>'; });
    h+='</div>';
    var bf=c.bigFive_cible||{}, imp=c.bigFive_importance||{};
    var noms={E:'Extraversion',A:'Agréabilité',C:'Conscience',N:'Gestion du stress',O:'Ouverture'};
    var lignes='';
    ['E','A','C','N','O'].forEach(function(k){
      if(bf[k]==null||!(imp[k]>0)) return;
      var v = k==='N' ? (100-bf[k]) : bf[k];
      lignes+='<div class="recrut-bf-ligne"><span>'+noms[k]+(imp[k]>=2?' <b class="recrut-imp">central</b>':'')+'</span><span class="recrut-bf-val">'+v+'</span></div>';
    });
    if(lignes) h+='<div class="recrut-cible-bf"><div class="grille-lab">Tempérament attendu</div>'+lignes+'</div>';
    var pils='';
    ['energie','autorite','collaboration','reconnaissance'].forEach(function(k){ var v=c.pilotage_cible&&c.pilotage_cible[k]; if(v) pils+='<span class="recrut-tag">'+esc(libCible(k,v))+'</span>'; });
    ['stress','conflit','risque','changement'].forEach(function(k){ var v=c.contextuel_cible&&c.contextuel_cible[k]; if(v) pils+='<span class="recrut-tag">'+esc(libCible(k,v))+'</span>'; });
    if(pils) h+='<div class="recrut-cible-bf"><div class="grille-lab">Fonctionnement attendu</div><div class="recrut-cible-tags">'+pils+'</div></div>';
    if(c.justification) h+='<p class="recrut-justif">'+esc(c.justification)+'</p>';
    h+='</div>';
    return h;
  }

  // ---- adéquation d'un candidat au profil cible (calcul déterministe, côté dashboard) ----
  function calculerAdequation(m, c){
    if(!m||!c) return null;
    var total=0, somme=0;
    var detail=[];
    // Big Five pondéré par l'importance du trait pour le poste
    var bf=c.bigFive_cible||{}, imp=c.bigFive_importance||{};
    var noms={E:'Extraversion',A:'Agréabilité',C:'Conscience',N:'Gestion du stress',O:'Ouverture'};
    ['E','A','C','N','O'].forEach(function(k){
      var cibleV=bf[k], p=Number(imp[k]||0), v=m.bigFive?Number(m.bigFive[k]):null;
      if(cibleV==null||p<=0||v==null||isNaN(v)) return;
      var ecart=Math.abs(v-cibleV);
      var s=Math.max(0, Math.round(100-Math.pow(ecart/10,1.6)*5.5));
      total+=s*p; somme+=p;
      detail.push({label:noms[k],score:s});
    });
    // famille (poids 1)
    if(c.famille_principale && m.famille){
      var f=(m.famille||'').toUpperCase();
      var s=(f===c.famille_principale)?100:(c.famille_secondaire&&f===c.famille_secondaire?85:55);
      total+=s; somme+=1; detail.push({label:'Famille de profil',score:s});
    }
    // pilotage (poids 0.8 par dimension définie)
    ['energie','autorite','collaboration','reconnaissance'].forEach(function(k){
      var cv=c.pilotage_cible&&c.pilotage_cible[k]; if(!cv) return;
      var mv=m[k]&&m[k].profil; if(!mv) return;
      var s=(mv===cv)?100:60;
      total+=s*0.8; somme+=0.8; detail.push({label:libCible(k,cv),score:s});
    });
    // contextuel (poids 0.8)
    ['stress','conflit','risque','changement'].forEach(function(k){
      var cv=c.contextuel_cible&&c.contextuel_cible[k]; if(!cv) return;
      var mv=m.contextuel&&m.contextuel[k]; if(!mv) return;
      var s=(mv===cv)?100:60;
      total+=s*0.8; somme+=0.8; detail.push({label:libCible(k,cv),score:s});
    });
    if(!somme) return null;
    return { global: Math.round(total/somme), detail: detail };
  }

  function vueCandidatsHtml(cible, repsTous){
    var cands=[];
    (repsTous||[]).forEach(function(r,ri){
      if(!String(r.statut||'').toLowerCase().startsWith('termin')) return;
      var adq=calculerAdequation(r,cible);
      cands.push({r:r,ri:ri,adq:adq});
    });
    cands.sort(function(a,b){ return ((b.adq&&b.adq.global)||0)-((a.adq&&a.adq.global)||0); });
    var h='<div class="recrut-cands">';
    h+='<div class="recrut-cands-tit">Candidats ('+cands.length+')</div>';
    h+='<div class="recrut-mgr"><label>Futur manager (email, doit avoir passé l\'analyse)</label><input type="email" id="recrut-mgr-email" placeholder="manager@entreprise.fr"></div>';
    if(!cands.length){ h+='<div class="compat-msg">Aucun candidat n\'a encore terminé l\'analyse sur cette campagne.</div></div>'; return h; }
    cands.forEach(function(x){
      var r=x.r, g=x.adq?x.adq.global:null;
      var col=g!=null?couleurScore(g):'#B8B8C8';
      var fiab=r.fiabilite&&r.fiabilite.score!=null?r.fiabilite.score:null;
      var fiabCl=fiab==null?'':(fiab>=75?'fiab-ok':(fiab>=60?'fiab-mid':'fiab-low'));
      h+='<div class="recrut-cand">';
      h+='<div class="recrut-cand-ligne" onclick="toggleDetailCand('+x.ri+')">';
      h+='<div class="recrut-cand-id"><b>'+esc(r.nom||r.email||'Anonyme')+'</b><span class="recrut-cand-arch">'+esc(r.dominante||'')+'</span></div>';
      h+='<div class="recrut-cand-badges">';
      if(fiab!=null) h+='<span class="recrut-badge '+fiabCl+'">Fiabilité '+fiab+'%</span>';
      if(r.naturelAdapte&&r.naturelAdapte.cout==='élevé') h+='<span class="recrut-badge fiab-low">Coût d\'adaptation élevé</span>';
      h+='<span class="recrut-adq" style="color:'+col+'">'+(g!=null?g:'·')+'<small>/100</small></span>';
      h+='</div></div>';
      h+='<div class="recrut-cand-detail" id="cand-detail-'+x.ri+'" style="display:none">';
      if(x.adq&&x.adq.detail&&x.adq.detail.length){
        h+='<div class="compat-dims">';
        x.adq.detail.forEach(function(dd){
          var c2=couleurScore(dd.score);
          h+='<div class="compat-dim"><div class="compat-dim-top"><span>'+esc(dd.label)+'</span><span class="compat-dim-val" style="color:'+c2+'">'+dd.score+'</span></div><div class="compat-dim-track"><div class="compat-dim-fill" style="width:'+dd.score+'%;background:'+c2+'"></div></div></div>';
        });
        h+='</div>';
      }
      h+='<div class="compat-actions">';
      h+='<button class="exp-btn exp-mini" onclick="event.stopPropagation();compatCandidat(\''+esc(r.email||'')+'\','+x.ri+')">Compatibilité avec le futur manager</button>';
      h+='<button class="exp-btn exp-mini" onclick="event.stopPropagation();entretienCandidat(\''+esc(r.email||'')+'\','+x.ri+')">Questions d\'entretien personnalisées</button>';
      h+='</div>';
      h+='<div class="recrut-cand-zone" id="cand-zone-'+x.ri+'"></div>';
      h+='</div></div>';
    });
    h+='</div>';
    return h;
  }

  function toggleDetailCand(ri){
    var el=document.getElementById('cand-detail-'+ri); if(!el)return;
    el.style.display = el.style.display==='none' ? 'block' : 'none';
  }

  function compatCandidat(email, ri){
    var mgrInput=document.getElementById('recrut-mgr-email');
    var zone=document.getElementById('cand-zone-'+ri); if(!zone)return;
    var em=(mgrInput&&mgrInput.value||'').trim();
    if(!em){ zone.innerHTML='<div class="compat-msg compat-err">Renseignez d\'abord l\'email du futur manager (champ en haut de la liste).</div>'; return; }
    if(!email){ zone.innerHTML='<div class="compat-msg compat-err">Ce candidat n\'a pas d\'email enregistré.</div>'; return; }
    zone.innerHTML='<div class="compat-msg">Calcul de la compatibilité candidat et futur manager…</div>';
    fetch(COMPAT_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Dashboard-Key':cleAcces},body:JSON.stringify({emailManager:em,emailCollaborateur:email})})
      .then(function(r){return r.json();})
      .then(function(data){
        if(data&&data.ok) afficherCompatibilite(data,'cand-zone-'+ri);
        else zone.innerHTML='<div class="compat-msg compat-err">'+esc(data&&data.error?data.error:'Analyse impossible.')+'</div>';
      })
      .catch(function(){ zone.innerHTML='<div class="compat-msg compat-err">Connexion impossible. Réessayez.</div>'; });
  }

  function entretienCandidat(email, ri){
    var zone=document.getElementById('cand-zone-'+ri); if(!zone)return;
    var cible=(campagneData&&campagneData.campagne&&campagneData.campagne.profilCible)||profilCibleCourant;
    if(!cible){ zone.innerHTML='<div class="compat-msg compat-err">Définissez d\'abord le profil cible.</div>'; return; }
    if(!email){ zone.innerHTML='<div class="compat-msg compat-err">Ce candidat n\'a pas d\'email enregistré.</div>'; return; }
    zone.innerHTML='<div class="compat-msg">Préparation des questions d\'entretien pour ce candidat…</div>';
    fetch(ENTRETIEN_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Dashboard-Key':cleAcces},body:JSON.stringify({email:email,profilCible:cible})})
      .then(function(r){return r.json();})
      .then(function(data){
        if(data&&data.ok&&data.entretien) afficherEntretienCandidat(data.entretien,'cand-zone-'+ri,data.candidat);
        else zone.innerHTML='<div class="compat-msg compat-err">'+esc(data&&data.error?data.error:'Génération impossible.')+'</div>';
      })
      .catch(function(){ zone.innerHTML='<div class="compat-msg compat-err">Connexion impossible. Réessayez.</div>'; });
  }

  var dernierEntretien = null;
  function afficherEntretienCandidat(g, zoneId, candidat){
    var zone=document.getElementById(zoneId); if(!zone)return;
    dernierEntretien = { g:g, candidat:candidat };
    var li=function(arr){ return Array.isArray(arr)?arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join(''):''; };
    var h='<div class="grille-result">';
    h+='<div class="grille-tit">Entretien personnalisé · '+esc((candidat&&candidat.nom)||'')+'</div>';
    if(g.lecture) h+='<p class="grille-intro">'+esc(g.lecture)+'</p>';
    if(Array.isArray(g.points_forts)&&g.points_forts.length){ h+='<div class="grille-lab grille-pos">Points d\'appui du candidat</div><ul class="grille-ul-pos">'+li(g.points_forts)+'</ul>'; }
    (g.ecarts||[]).forEach(function(e,i){
      h+='<div class="grille-crit"><div class="grille-crit-tit">'+(i+1)+'. '+esc(e.dimension||'')+'</div>';
      if(e.constat) h+='<p>'+esc(e.constat)+'</p>';
      if(Array.isArray(e.questions)) h+='<div class="grille-lab">Questions à poser</div><ul>'+li(e.questions)+'</ul>';
      h+='</div>';
    });
    if(Array.isArray(g.validation_fiabilite)&&g.validation_fiabilite.length){
      h+='<div class="grille-crit"><div class="grille-crit-tit">Validation du profil</div><p class="cadrage-note">La cohérence des réponses à l\'analyse invite à confirmer ces points de vive voix.</p><ul>'+li(g.validation_fiabilite)+'</ul></div>';
    }
    if(g.conseil_integration) h+='<div class="grille-note">'+esc(g.conseil_integration)+'</div>';
    h+='<div class="compat-actions"><button class="exp-btn exp-mini" onclick="exporterEntretienCandidat()">Exporter en PDF</button></div>';
    h+='</div>';
    zone.innerHTML=h;
  }

  function exporterEntretienCandidat(){
    var e=dernierEntretien; if(!e)return;
    var g=e.g; var nom=(e.candidat&&e.candidat.nom)||'Candidat';
    var titre='Entretien personnalisé · '+nom;
    var corps='<h1>'+esc(titre)+'</h1><div class="exp-sous">'+dateFr()+'</div><div class="exp-badge">Document interne RH</div>';
    if(g.lecture) corps+='<p>'+esc(g.lecture)+'</p>';
    if(Array.isArray(g.points_forts)) corps+='<h2>Points d\'appui</h2>'+expListe(g.points_forts);
    (g.ecarts||[]).forEach(function(x){ corps+='<h2>'+esc(x.dimension||'')+'</h2>'+(x.constat?'<p>'+esc(x.constat)+'</p>':'')+expListe(x.questions); });
    if(Array.isArray(g.validation_fiabilite)&&g.validation_fiabilite.length) corps+='<h2>Validation du profil</h2>'+expListe(g.validation_fiabilite);
    if(g.conseil_integration) corps+='<div class="exp-cle">'+esc(g.conseil_integration)+'</div>';
    ouvrirImpression(titre, corps);
  }

  function lancerCompatibilite(){
    const mgr=document.getElementById('compat-mgr'), col=document.getElementById('compat-col');
    const zone=document.getElementById('compat-zone'), btn=document.getElementById('compat-btn');
    if(!mgr||!col||!zone)return;
    const em=mgr.value, ec=col.value;
    if(!em||!ec){ zone.innerHTML='<div class="compat-msg">Choisissez un manager et un collaborateur.</div>'; return; }
    if(em===ec){ zone.innerHTML='<div class="compat-msg">Le manager et le collaborateur doivent être deux personnes différentes.</div>'; return; }
    btn.disabled=true; btn.textContent='Analyse en cours…';
    zone.innerHTML='<div class="compat-msg">Calcul de la compatibilité…</div>';
    fetch(COMPAT_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Dashboard-Key':cleAcces},body:JSON.stringify({emailManager:em,emailCollaborateur:ec})})
      .then(r=>r.json())
      .then(data=>{
        btn.disabled=false; btn.textContent='Analyser le binôme';
        if(data&&data.ok) afficherCompatibilite(data);
        else zone.innerHTML=`<div class="compat-msg compat-err">${esc(data&&data.error?data.error:'Analyse impossible.')}</div>`;
      })
      .catch(()=>{ btn.disabled=false; btn.textContent='Analyser le binôme'; zone.innerHTML='<div class="compat-msg compat-err">Connexion impossible. Réessayez.</div>'; });
  }

  function couleurScore(s){ if(s>=80)return '#3Fae6e'; if(s>=65)return '#5474F5'; if(s>=50)return '#F9A876'; return '#F98272'; }
  function libScore(s){ if(s>=80)return 'Très fluide'; if(s>=65)return 'Fluide'; if(s>=50)return 'À ajuster'; return 'Demande attention'; }

  function afficherCompatibilite(data, zoneId){
    var zone=document.getElementById(zoneId||'compat-zone'); if(!zone)return;
    derniereCompat = data;
    var sc=data.scores||{}; var a=data.analyse||{};
    var g=sc.global; var dims=sc.dimensions||{};
    var li=function(arr){ return Array.isArray(arr)?arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join(''):''; };
    var barres=Object.keys(dims).map(function(k){
      var dd=dims[k]; var c=couleurScore(dd.score);
      return '<div class="compat-dim"><div class="compat-dim-top"><span>'+esc(dd.label)+'</span><span class="compat-dim-val" style="color:'+c+'">'+dd.score+'</span></div><div class="compat-dim-track"><div class="compat-dim-fill" style="width:'+dd.score+'%;background:'+c+'"></div></div></div>';
    }).join('');
    var gc=couleurScore(g);
    var h='<div class="compat-result">';
    h+='<div class="compat-entete"><div class="compat-duo"><b>'+esc(data.manager.nom)+'</b> <span class="compat-role">manager · '+esc(data.manager.archetype)+'</span> <span class="compat-amp">avec</span> <b>'+esc(data.collaborateur.nom)+'</b> <span class="compat-role">'+esc(data.collaborateur.archetype)+'</span></div></div>';
    h+='<div class="compat-rh-bloc"><div class="compat-rh-badge">Réservé à votre vue RH</div>';
    h+='<div class="compat-global"><div class="compat-global-num" style="color:'+gc+'">'+(g!=null?g:'—')+'<span>/100</span></div><div class="compat-global-lab">Compatibilité globale<br><b style="color:'+gc+'">'+(g!=null?libScore(g):'')+'</b></div></div>';
    h+='<div class="compat-dims">'+barres+'</div>';
    if(Array.isArray(a.signaux_rh) && a.signaux_rh.length){
      h+='<div class="compat-signaux"><div class="compat-signaux-tit">Signaux RH à surveiller</div><ul>'+li(a.signaux_rh)+'</ul></div>';
    }
    h+='</div>';
    if(a.synthese){
      h+='<div class="compat-partage"><div class="compat-partage-badge">À partager aux deux personnes</div>';
      h+='<p class="compat-synthese">'+esc(a.synthese)+'</p>';
      if(Array.isArray(a.points_fluides)) h+='<div class="compat-sec compat-fluide"><h5>Ce qui fonctionne naturellement</h5><ul>'+li(a.points_fluides)+'</ul></div>';
      if(Array.isArray(a.points_attention)) h+='<div class="compat-sec compat-attn"><h5>Points à anticiper ensemble</h5><ul>'+li(a.points_attention)+'</ul></div>';
      if(Array.isArray(a.conseils_manager)) h+='<div class="compat-sec"><h5>Conseils au manager</h5><ul>'+li(a.conseils_manager)+'</ul></div>';
      if(Array.isArray(a.conseils_collaborateur)) h+='<div class="compat-sec"><h5>Conseils au collaborateur</h5><ul>'+li(a.conseils_collaborateur)+'</ul></div>';
      if(a.cle_de_voute) h+='<div class="compat-cle">'+esc(a.cle_de_voute)+'</div>';
      h+='</div>';
    } else {
      h+='<div class="compat-msg">Les scores sont calculés. L\'analyse qualitative n\'a pas pu être générée, réessayez.</div>';
    }
    h+='<div class="compat-actions">'+
      '<button class="exp-btn exp-vert" onclick="exporterCompat(\'partage\')">PDF à partager (sans les scores)</button>'+
      '<button class="exp-btn" onclick="exporterCompat(\'complet\')">PDF complet (usage RH)</button>'+
      '</div>';
    h+='</div>';
    zone.innerHTML=h;
  }

  function genererGrille(){
    var r = derniereAnalyseEq && derniereAnalyseEq.recrutement; var zone=document.getElementById('grille-zone'); var btn=document.getElementById('btn-grille');
    if(!r || !zone) return;
    if(btn){ btn.disabled=true; btn.textContent='Génération en cours…'; }
    zone.innerHTML='<div class="compat-msg">Construction de la grille d\'entretien…</div>';
    fetch(GRILLE_URL,{method:'POST',headers:{'Content-Type':'application/json','X-Dashboard-Key':cleAcces},body:JSON.stringify({fiche:r})})
      .then(function(rep){return rep.json();})
      .then(function(data){
        if(btn){ btn.disabled=false; btn.textContent='Régénérer la grille'; }
        if(data&&data.ok&&data.grille){ derniereGrille=data.grille; afficherGrille(data.grille); }
        else zone.innerHTML='<div class="compat-msg compat-err">'+esc(data&&data.error?data.error:'Génération impossible, réessayez.')+'</div>';
      })
      .catch(function(){ if(btn){ btn.disabled=false; btn.textContent='Générer la grille d\'entretien'; } zone.innerHTML='<div class="compat-msg compat-err">Connexion impossible. Réessayez.</div>'; });
  }

  function afficherGrille(g){
    var zone=document.getElementById('grille-zone'); if(!zone)return;
    var li=function(arr){ return Array.isArray(arr)?arr.map(function(x){return '<li>'+esc(x)+'</li>';}).join(''):''; };
    var h='<div class="grille-result">';
    h+='<div class="grille-tit">Grille d\'entretien structurée</div>';
    if(g.intro) h+='<p class="grille-intro">'+esc(g.intro)+'</p>';
    (g.criteres||[]).forEach(function(c,i){
      h+='<div class="grille-crit"><div class="grille-crit-tit">'+(i+1)+'. '+esc(c.critere||'')+'</div>';
      if(Array.isArray(c.questions)) h+='<div class="grille-lab">Questions à poser</div><ul>'+li(c.questions)+'</ul>';
      if(Array.isArray(c.signaux_positifs)) h+='<div class="grille-lab grille-pos">Signaux positifs</div><ul class="grille-ul-pos">'+li(c.signaux_positifs)+'</ul>';
      if(Array.isArray(c.signaux_alerte)) h+='<div class="grille-lab grille-neg">Signaux d\'alerte</div><ul class="grille-ul-neg">'+li(c.signaux_alerte)+'</ul>';
      h+='</div>';
    });
    var ms=g.mise_en_situation;
    if(ms){ h+='<div class="grille-crit"><div class="grille-crit-tit">Mise en situation</div><p>'+esc(ms.consigne||'')+'</p>'; if(Array.isArray(ms.attendus)) h+='<div class="grille-lab">À observer</div><ul>'+li(ms.attendus)+'</ul>'; h+='</div>'; }
    if(g.question_integration) h+='<div class="grille-crit"><div class="grille-crit-tit">Question d\'intégration</div><p>'+esc(g.question_integration)+'</p></div>';
    if(g.conseil_notation) h+='<div class="grille-note">'+esc(g.conseil_notation)+'</div>';
    h+='<div class="compat-actions"><button class="exp-btn" onclick="exporterAnalyseEq()">Exporter analyse et grille en PDF</button></div>';
    h+='</div>';
    zone.innerHTML=h;
  }

  function afficherAnalyse(a, cache){
    const zone=document.getElementById('analyse-zone'); if(!zone)return;
    derniereAnalyseEq = a; derniereGrille = null;
    const sw=a.swot||{};
    const li=arr=>Array.isArray(arr)?arr.map(x=>`<li>${esc(x)}</li>`).join(''):'';
    const plan=Array.isArray(a.plan_action)?a.plan_action.map(p=>`<div class="plan-item"><div class="plan-titre">${esc(p.titre||'')}</div><p class="plan-desc">${esc(p.desc||'')}</p></div>`).join(''):'';
    const focus=Array.isArray(a.focus_individuel)?a.focus_individuel.map(f=>`<div class="focus-item"><div class="focus-nom">${esc(f.nom||'')}</div><p class="focus-conseil">${esc(f.conseil||'')}</p></div>`).join(''):'';
    zone.innerHTML=`
      <div class="analyse-result">
        <div class="analyse-head-row"><div class="analyse-badge">Analyse stratégique${cache?' · enregistrée':' · nouvelle'}</div><button class="exp-btn exp-mini" onclick="exporterAnalyseEq()">Exporter en PDF</button></div>
        <div class="cadrage-note cadrage-bloc">Cet éclairage nourrit la réflexion et le dialogue. La décision finale reste humaine.</div>
        ${a.synthese?`<p class="analyse-synthese">${esc(a.synthese)}</p>`:''}
        <div class="swot-grid">
          <div class="swot-card swot-f"><div class="swot-card-title">Forces</div><ul>${li(sw.forces)}</ul></div>
          <div class="swot-card swot-w"><div class="swot-card-title">Points de vigilance</div><ul>${li(sw.faiblesses)}</ul></div>
          <div class="swot-card swot-o"><div class="swot-card-title">Opportunités</div><ul>${li(sw.opportunites)}</ul></div>
          <div class="swot-card swot-r"><div class="swot-card-title">Risques</div><ul>${li(sw.risques)}</ul></div>
        </div>
        ${a.dynamiques?`<div class="analyse-sec"><h4>Dynamiques d'équipe</h4><p>${esc(a.dynamiques)}</p></div>`:''}
        ${Array.isArray(a.risques_rh)?`<div class="analyse-sec"><h4>Points d'attention RH</h4><ul class="liste-rh">${li(a.risques_rh)}</ul></div>`:''}
        ${plan?`<div class="analyse-sec"><h4>Plan d'action de pilotage</h4><div class="plan-grid">${plan}</div></div>`:''}
        ${focus?`<div class="analyse-sec"><h4>Focus individuel</h4><div class="focus-grid">${focus}</div></div>`:''}
        ${blocRecrutement(a.recrutement)}
      </div>`;
  }

  // Bloc recrutement : diagnostic honnête + fiche de poste actionnable.
  function blocRecrutement(r){
    if(!r || typeof r!=='object') return '';
    const fp = r.fiche_poste || {};
    const li = arr => Array.isArray(arr)?arr.map(x=>`<li>${esc(x)}</li>`).join(''):'';
    const ficheHtml = (fp.intitule || fp.pourquoi) ? `
      <div class="reco-fiche">
        ${fp.intitule?`<div class="reco-fiche-titre">${esc(fp.intitule)}</div>`:''}
        ${fp.pourquoi?`<p class="reco-fiche-pourquoi">${esc(fp.pourquoi)}</p>`:''}
        ${(fp.profil_archetype||fp.profil_pilotage)?`<div class="reco-deux-niveaux">
          ${fp.profil_archetype?`<div class="reco-niv"><span class="reco-niv-lab">Côté archétype</span><span class="reco-niv-val">${esc(fp.profil_archetype)}</span></div>`:''}
          ${fp.profil_pilotage?`<div class="reco-niv"><span class="reco-niv-lab">Côté pilotage</span><span class="reco-niv-val">${esc(fp.profil_pilotage)}</span></div>`:''}
        </div>`:''}
        ${Array.isArray(fp.traits_recherches)?`<div class="reco-fiche-bloc"><span class="reco-fiche-lab">Ce qu'il faut rechercher</span><ul>${li(fp.traits_recherches)}</ul></div>`:''}
        ${Array.isArray(fp.signaux_entretien)?`<div class="reco-fiche-bloc"><span class="reco-fiche-lab">À observer en entretien</span><ul>${li(fp.signaux_entretien)}</ul></div>`:''}
        ${fp.vigilance?`<div class="reco-fiche-vig"><span class="reco-fiche-lab">Point de vigilance à l'intégration</span><p>${esc(fp.vigilance)}</p></div>`:''}
      </div>` : '';
    const secondaireHtml = r.besoin_secondaire ? `<div class="reco-secondaire"><span class="reco-fiche-lab">Second besoin, moins prioritaire</span><p>${esc(r.besoin_secondaire)}</p></div>` : '';
    const boutonGrille = (fp.intitule || r.profil_cible) ? `<div class="grille-cta"><button class="exp-btn" id="btn-grille" onclick="genererGrille()">Générer la grille d'entretien</button><span class="grille-cta-txt">Questions comportementales, signaux à observer, mise en situation et notation : le prolongement direct de cette fiche.</span></div><div id="grille-zone"></div>` : '';
    return `
      <div class="analyse-sec reco-recrut">
        <h4>Recrutement : quel profil compléterait l'équipe</h4>
        ${r.diagnostic?`<p class="reco-diag">${esc(r.diagnostic)}</p>`:''}
        ${r.profil_cible?`<div class="reco-cible"><span class="reco-cible-lab">Profil à viser</span> ${esc(r.profil_cible)}</div>`:''}
        ${ficheHtml}
        ${secondaireHtml}
        ${boutonGrille}
      </div>`;
  }
