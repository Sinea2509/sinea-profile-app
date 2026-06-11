// ============================================================
// MOTEUR DE SCORING (porté du Python validé v2.2)
// ============================================================
const DIMS = ['E','A','C','N','O'];
const POIDS_DIM = {E:1.0, A:1.0, C:1.0, N:0.8, O:1.0};
const BONUS_SINEA_MAX = 18;
const POINTS_REF = 3.0;

const FAMILY_COLORS = {
  RELATION: '#F98272', ACTION: '#F5A623', STRUCTURE: '#3EADFF', VISION: '#5E59C7'
};

function scorerBigFive(repMini) {
  // Echelle 4 niveaux SANS milieu. Conversion 1->0, 2->33.33, 3->66.67, 4->100.
  // Items negatifs inverses (5 - reponse) avant conversion.
  // V2 : si des reponses de choix force (MINI_CF_*) sont presentes,
  // le score = 70% swipe + 30% choix force (triangulation anti-desirabilite).
  const scoring = SINEA_DATA.mini_scoring;
  const inverses = new Set(SINEA_DATA.mini_inverses);
  const conv = {1:0.0, 2:33.333, 3:66.667, 4:100.0};
  const lettreMap = {extraversion:'E', agreabilite:'A', conscience:'C', neuroticisme:'N', ouverture:'O'};

  // index choix force par dimension
  const cfParDim = {};
  (SINEA_DATA.mini_choix_force || []).forEach(q => { cfParDim[q.dimension] = q; });

  const scores = {};
  for (const [dimNom, info] of Object.entries(scoring)) {
    let vals = [];
    for (const itemId of info.items) {
      let r = repMini[itemId];
      if (r === undefined || r === null) continue;
      if (inverses.has(itemId)) r = 5 - r;
      vals.push(conv[r]);
    }
    const moySwipe = vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : null;

    // contribution du choix force si repondu
    let valCF = null;
    const qcf = cfParDim[dimNom];
    if (qcf && repMini[qcf.id] !== undefined && repMini[qcf.id] !== null) {
      const choix = repMini[qcf.id]; // 'a' ou 'b'
      const v = (choix === 'a') ? qcf.a.valeur : qcf.b.valeur; // 1-4
      valCF = conv[v];
    }

    let final;
    if (moySwipe !== null && valCF !== null) final = moySwipe * 0.7 + valCF * 0.3;
    else if (moySwipe !== null) final = moySwipe;
    else if (valCF !== null) final = valCF;
    else final = 50;
    scores[lettreMap[dimNom]] = Math.round(final * 10) / 10;
  }
  return scores;
}

function calculerAffinites(scoresBf) {
  const profils = SINEA_DATA.profils;
  const noms = Object.keys(profils);
  const maxDist = Math.sqrt(DIMS.reduce((s,d)=> s + Math.pow(POIDS_DIM[d]*100,2), 0));
  const aff = {};
  for (const nom of noms) {
    let sumSq = 0;
    for (const d of DIMS) {
      const diff = (profils[nom][d] - scoresBf[d]) * POIDS_DIM[d];
      sumSq += diff*diff;
    }
    const dist = Math.sqrt(sumSq);
    aff[nom] = Math.round((100 * (1 - dist/maxDist)) * 100) / 100;
  }
  return aff;
}

// id court -> nom complet
const ID_TO_NOM = {};
for (const [id, p] of Object.entries(SINEA_DATA.personnages)) ID_TO_NOM[id] = p.nom;

function calculerPointsSinea(repSinea) {
  const points = {};
  for (const nom of Object.values(ID_TO_NOM)) points[nom] = 0;

  // indexer toutes les questions
  const questions = {};
  for (const qs of Object.values(SINEA_DATA.sinea_famille)) for (const q of qs) questions[q.id]=q;
  for (const q of SINEA_DATA.sinea_hybride) questions[q.id]=q;
  for (const q of SINEA_DATA.sinea_transversales) questions[q.id]=q;
  if (SINEA_DATA.sinea_repartitions) { for (const qr of SINEA_DATA.sinea_repartitions) questions[qr.id]=qr; }
  else if (SINEA_DATA.sinea_repartition) { questions[SINEA_DATA.sinea_repartition.id]=SINEA_DATA.sinea_repartition; }

  for (const [qid, rep] of Object.entries(repSinea)) {
    const q = questions[qid];
    const fmt = q.format || 'qcm';
    if (fmt === 'qcm') {
      const opt = q.options[rep];
      for (const [pid, pts] of Object.entries(opt.ponderation)) points[ID_TO_NOM[pid]] += pts;
    } else if (fmt === 'curseur') {
      const pos = parseFloat(rep);
      const pmax = q.points_max || POINTS_REF;
      points[ID_TO_NOM[q.pole_gauche.perso]] += pmax * (1 - pos/100);
      points[ID_TO_NOM[q.pole_droit.perso]] += pmax * (pos/100);
    } else if (fmt === 'repartition') {
      const total = q.points_total || 10;
      for (const axe of q.axes) {
        const ptsFam = rep[axe.famille] || 0;
        if (ptsFam <= 0) continue;
        const ptsNorm = (ptsFam/total) * POINTS_REF;
        for (const pid of axe.repartit_sur) points[ID_TO_NOM[pid]] += ptsNorm / axe.repartit_sur.length;
      }
    }
  }
  return points;
}

function calculerResultat(scoresBf, affinites, pointsSinea) {
  const profils = SINEA_DATA.profils;
  const familles = SINEA_DATA.familles;
  const noms = Object.keys(profils);

  // ===== ÉQUITÉ STRUCTURELLE : normalisation par potentiel =====
  // Chaque archétype peut gagner un total différent de points via les questions
  // (accident de rédaction). On normalise pour que tous aient le même potentiel.
  const potentiels = calculerPotentielsSinea();
  const potMoyen = Object.values(potentiels).reduce((a,b)=>a+b,0) / noms.length;
  const ptsNorm = {};
  for (const nom of noms) {
    const p = potentiels[nom] || potMoyen;
    ptsNorm[nom] = pointsSinea[nom] * (potMoyen / p);
  }

  // ===== DOSAGE EXPLICITE 60/40 =====
  // 60% tempérament (affinité Big Five, validé scientifiquement)
  // 40% questions Sinéa (signature propriétaire, affine le choix)
  const maxPts = Math.max(...Object.values(ptsNorm), 0.001);
  const score = {};
  for (const nom of noms) {
    const compAffinite = affinites[nom];                                // 0-100
    const compSinea = Math.pow(ptsNorm[nom] / maxPts, 1.3) * 100;       // 0-100
    score[nom] = 0.6 * compAffinite + 0.4 * compSinea;
  }

  const classement = [...noms].sort((a,b)=> score[b]-score[a]);
  const dominante = classement[0];
  const secondaires = [classement[1], classement[2]];

  // radar familles
  const radarBrut = {};
  for (const fam of ['RELATION','ACTION','STRUCTURE','VISION']) {
    const membres = noms.filter(n=> familles[n]===fam);
    radarBrut[fam] = membres.reduce((s,n)=> s+score[n],0)/membres.length;
  }
  const rmax = Math.max(...Object.values(radarBrut)), rmin = Math.min(...Object.values(radarBrut));
  const radar = {};
  for (const [f,v] of Object.entries(radarBrut)) radar[f] = rmax>rmin ? Math.round((v-rmin)/(rmax-rmin)*100) : 50;

  // blend sur écarts (4e comme plancher)
  const top4 = classement.slice(0,4).map(c=>score[c]);
  const plancher = top4[3] || 0;
  const ecarts = [0,1,2].map(i=> Math.max(score[classement[i]]-plancher, 0.1));
  const totalEc = ecarts.reduce((a,b)=>a+b,0);
  const blend = {};
  [0,1,2].forEach(i=> blend[classement[i]] = Math.round(ecarts[i]/totalEc*100));

  return {
    dominante: {nom: dominante, famille: familles[dominante], score: Math.round(score[dominante]*10)/10},
    secondaires: secondaires.map(s=>({nom:s, famille:familles[s], score: Math.round(score[s]*10)/10})),
    radarFamilles: radar,
    scoresBigFive: scoresBf,
    blend: blend,
    classement: classement.map(n=>({nom:n, score: Math.round(score[n]*10)/10, famille: familles[n]}))
  };
}

// Potentiel total de points sinea par archétype (somme de toutes les options possibles).
// Calculé une fois et mis en cache.
let _potentielsCache = null;
function calculerPotentielsSinea() {
  if (_potentielsCache) return _potentielsCache;
  const pot = {};
  for (const nom of Object.values(ID_TO_NOM)) pot[nom] = 0;
  for (const qs of Object.values(SINEA_DATA.sinea_famille)) for (const q of qs) {
    q.options.forEach(o => { for (const [pid, pts] of Object.entries(o.ponderation || {})) { const nom = ID_TO_NOM[pid]; if (nom) pot[nom] += pts; } });
  }
  SINEA_DATA.sinea_hybride.forEach(q => {
    [q.pole_gauche, q.pole_droit].forEach(p => { const nom = ID_TO_NOM[p.perso]; if (nom) pot[nom] += (q.points_max || POINTS_REF); });
  });
  (SINEA_DATA.sinea_transversales || []).forEach(q => {
    q.options.forEach(o => { for (const [pid, pts] of Object.entries(o.ponderation || {})) { const nom = ID_TO_NOM[pid]; if (nom) pot[nom] += pts; } });
  });
  _potentielsCache = pot;
  return pot;
}

function scorer(repMini, repSinea) {
  const scoresBf = scorerBigFive(repMini);
  const aff = calculerAffinites(scoresBf);
  const pts = calculerPointsSinea(repSinea);
  return calculerResultat(scoresBf, aff, pts);
}

// ---- Dimensions contextuelles (profil dominant par dimension) ----
function scorerContextuel(repCtx) {
  // repCtx = { CTX_STRESS_01: indexOption, ... }
  const data = SINEA_DATA.contextuelles;
  if (!data) return {};
  const parDim = {};
  const qById = {};
  data.questions.forEach(q => { qById[q.id] = q; });
  for (const [qid, repIdx] of Object.entries(repCtx)) {
    const q = qById[qid];
    if (!q) continue;
    const profil = q.options[repIdx]?.profil;
    if (!profil) continue;
    if (!parDim[q.dimension]) parDim[q.dimension] = {};
    parDim[q.dimension][profil] = (parDim[q.dimension][profil] || 0) + 1;
  }
  // profil dominant de chaque dimension
  const res = {};
  for (const [dim, compte] of Object.entries(parDim)) {
    res[dim] = Object.entries(compte).sort((a,b)=>b[1]-a[1])[0][0];
  }
  return res;
}

// ---- Nouvelles dimensions (énergie, collaboration, autorité, reconnaissance) ----
function scorerContextuelPlus(repCtxPlus) {
  const data = SINEA_DATA.contextuelles_plus;
  if (!data) return {};
  const parDim = {};
  const qById = {};
  data.questions.forEach(q => { qById[q.id] = q; });
  for (const [qid, repIdx] of Object.entries(repCtxPlus)) {
    const q = qById[qid];
    if (!q) continue;
    const profil = q.options[repIdx]?.profil;
    if (!profil) continue;
    if (!parDim[q.dimension]) parDim[q.dimension] = {};
    parDim[q.dimension][profil] = (parDim[q.dimension][profil] || 0) + 1;
  }
  const res = {};
  for (const [dim, compte] of Object.entries(parDim)) {
    res[dim] = Object.entries(compte).sort((a,b)=>b[1]-a[1])[0][0];
  }
  return res;
}

// ---- Score de fiabilité du profil (cohérence des réponses Big Five) ----
// repMini : { MINI_01: 1-4, ..., MINI_CF_E: 'a'|'b', ... }
// tempsReponses : { questionId: millisecondes } (optionnel)
function scorerFiabilite(repMini, tempsReponses) {
  const conv = {1:0.0, 2:33.333, 3:66.667, 4:100.0};
  const inverses = new Set(SINEA_DATA.mini_inverses);
  const signaux = [];
  let penalites = 0;

  // valeurs converties par trait (swipe seulement)
  const parTrait = {};
  SINEA_DATA.mini_items.forEach(it => {
    let r = repMini[it.id];
    if (r === undefined || r === null) return;
    if (inverses.has(it.id)) r = 5 - r;
    (parTrait[it.dimension] = parTrait[it.dimension] || []).push(conv[r]);
  });

  // SIGNAL 1 : cohérence interne (les items d'un même trait concordent-ils ?)
  let dispMax = 0, traitIncoherent = null;
  for (const [t, vals] of Object.entries(parTrait)) {
    if (vals.length < 2) continue;
    const moy = vals.reduce((a,b)=>a+b,0) / vals.length;
    const ecart = Math.sqrt(vals.reduce((s,v)=>s+Math.pow(v-moy,2),0) / vals.length);
    if (ecart > dispMax) { dispMax = ecart; traitIncoherent = t; }
  }
  if (dispMax > 45) { penalites += 18; signaux.push({ type:'incoherence', niveau:'fort', detail:'Réponses contradictoires sur un même trait' }); }
  else if (dispMax > 33) { penalites += 9; signaux.push({ type:'incoherence', niveau:'modéré', detail:'Légères contradictions internes' }); }

  // SIGNAL 2 : concordance swipe vs choix forcé
  let nbDesaccords = 0;
  (SINEA_DATA.mini_choix_force || []).forEach(q => {
    const c = repMini[q.id];
    const vals = parTrait[q.dimension];
    if (!c || !vals || !vals.length) return;
    const moySwipe = vals.reduce((a,b)=>a+b,0) / vals.length;
    const v = (c === 'a') ? q.a.valeur : q.b.valeur;
    const valCF = conv[v];
    if (Math.abs(moySwipe - valCF) > 55) nbDesaccords++;
  });
  if (nbDesaccords >= 2) { penalites += 20; signaux.push({ type:'desaccord', niveau:'fort', detail:'Plusieurs divergences entre auto-description et choix tranchés' }); }
  else if (nbDesaccords === 1) { penalites += 8; signaux.push({ type:'desaccord', niveau:'modéré', detail:'Une divergence entre auto-description et choix tranchés' }); }

  // SIGNAL 3 : réponses au hasard / patterns suspects
  const valeursBrutes = SINEA_DATA.mini_items.map(it => repMini[it.id]).filter(v => v !== undefined && v !== null);
  if (valeursBrutes.length >= 8) {
    const uniques = new Set(valeursBrutes);
    if (uniques.size === 1) { penalites += 30; signaux.push({ type:'uniforme', niveau:'fort', detail:'Toutes les réponses identiques' }); }
    else if (uniques.size === 2) { penalites += 10; signaux.push({ type:'faible_variance', niveau:'modéré', detail:'Très peu de variété dans les réponses' }); }
    const extremes = valeursBrutes.filter(v => v === 1 || v === 4).length;
    if (extremes === valeursBrutes.length && uniques.size > 1) { penalites += 6; signaux.push({ type:'extremes', niveau:'léger', detail:'Réponses toujours tranchées, jamais nuancées' }); }
  }

  // SIGNAL 4 : vitesse de réponse (si mesurée)
  if (tempsReponses) {
    const temps = SINEA_DATA.mini_items.map(it => tempsReponses[it.id]).filter(t => typeof t === 'number');
    if (temps.length >= 8) {
      const ratio = temps.filter(t => t < 800).length / temps.length;
      if (ratio > 0.5) { penalites += 18; signaux.push({ type:'vitesse', niveau:'fort', detail:'Plus de la moitié des réponses très rapides' }); }
      else if (ratio > 0.3) { penalites += 7; signaux.push({ type:'vitesse', niveau:'modéré', detail:'Plusieurs réponses très rapides' }); }
    }
  }

  const score = Math.max(0, Math.min(100, 100 - penalites));
  let niveau, message;
  if (score >= 85) { niveau = 'élevée'; message = 'Le profil est très cohérent : les réponses concordent et se confirment mutuellement.'; }
  else if (score >= 70) { niveau = 'bonne'; message = 'Le profil est cohérent dans l\'ensemble. Résultats fiables.'; }
  else if (score >= 50) { niveau = 'moyenne'; message = 'Le profil présente des tensions internes. Les résultats donnent une tendance, à confirmer par un échange.'; }
  else { niveau = 'faible'; message = 'Les réponses manquent de cohérence. À interpréter avec prudence.'; }

  return { score, niveau, message, signaux };
}

// ---- Dimensions spé (management ou commercial) ----
function scorerSpeDims(repSpe, type) {
  const bloc = type === 'manager' ? SINEA_DATA.spe_management : (type === 'commercial' ? SINEA_DATA.spe_commercial : null);
  if (!bloc) return {};
  const parDim = {};
  const qById = {};
  (bloc.dimensions.questions || []).forEach(q => { qById[q.id] = q; });
  for (const [qid, repIdx] of Object.entries(repSpe)) {
    const q = qById[qid];
    if (!q) continue;
    const profil = q.options[repIdx]?.profil;
    if (!profil) continue;
    if (!parDim[q.dimension]) parDim[q.dimension] = {};
    parDim[q.dimension][profil] = (parDim[q.dimension][profil] || 0) + 1;
  }
  const res = {};
  for (const [dim, compte] of Object.entries(parDim)) {
    res[dim] = Object.entries(compte).sort((a,b)=>b[1]-a[1])[0][0];
  }
  return res;
}

// ---- Style spé dominant (Goleman ou Challenger) à partir des QCM spé ----
function scorerSpeStyle(repSpeQcm, type) {
  const bloc = type === 'manager' ? SINEA_DATA.spe_management?.goleman : (type === 'commercial' ? SINEA_DATA.spe_commercial?.challenger : null);
  if (!bloc) return null;
  const qById = {};
  (bloc.questions || []).forEach(q => { qById[q.id] = q; });
  const scores = {};
  const add = (st, pts) => { if (st) scores[st] = (scores[st] || 0) + pts; };
  for (const [qid, rep] of Object.entries(repSpeQcm)) {
    const q = qById[qid];
    if (!q) continue;
    const fmt = q.format || 'qcm';
    if (fmt === 'qcm') {
      const opt = (q.options || [])[rep];
      if (opt && opt.styles) for (const [st, pts] of Object.entries(opt.styles)) add(st, pts);
    } else if (fmt === 'curseur') {
      // position 0-100 : répartit points_max entre pôle gauche et droit
      const pos = parseFloat(rep);
      if (!isNaN(pos) && q.pole_gauche && q.pole_droit) {
        const pmax = q.points_max || 3;
        add(q.pole_gauche.style, pmax * (1 - pos / 100));
        add(q.pole_droit.style, pmax * (pos / 100));
      }
    } else if (fmt === 'repartition') {
      // rep = { styleOuIndex: points } ; on relie chaque axe à son style
      if (rep && typeof rep === 'object' && q.axes) {
        q.axes.forEach((axe, i) => {
          const pts = rep[axe.style] ?? rep[i] ?? 0;
          if (pts > 0) add(axe.style, pts);
        });
      }
    }
  }
  const classement = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return classement.length ? classement[0][0] : null;
}

// Retourne les scores détaillés par style (pour les visuels radar/jauges)
function scorerSpeStyleScores(repSpeQcm, type) {
  const bloc = type === 'manager' ? SINEA_DATA.spe_management?.goleman : (type === 'commercial' ? SINEA_DATA.spe_commercial?.challenger : null);
  if (!bloc) return {};
  const qById = {};
  (bloc.questions || []).forEach(q => { qById[q.id] = q; });
  const scores = {};
  const add = (st, pts) => { if (st) scores[st] = (scores[st] || 0) + pts; };
  for (const [qid, rep] of Object.entries(repSpeQcm)) {
    const q = qById[qid];
    if (!q) continue;
    const fmt = q.format || 'qcm';
    if (fmt === 'qcm') {
      const opt = (q.options || [])[rep];
      if (opt && opt.styles) for (const [st, pts] of Object.entries(opt.styles)) add(st, pts);
    } else if (fmt === 'curseur') {
      const pos = parseFloat(rep);
      if (!isNaN(pos) && q.pole_gauche && q.pole_droit) {
        const pmax = q.points_max || 3;
        add(q.pole_gauche.style, pmax * (1 - pos / 100));
        add(q.pole_droit.style, pmax * (pos / 100));
      }
    } else if (fmt === 'repartition') {
      if (rep && typeof rep === 'object' && q.axes) {
        q.axes.forEach((axe, i) => {
          const pts = rep[axe.style] ?? rep[i] ?? 0;
          if (pts > 0) add(axe.style, pts);
        });
      }
    }
  }
  return scores;
}

// ---- Naturel vs adapté (coût d'adaptation au travail) ----
function scorerNaturelAdapte(repMini, repAdapte) {
  // Naturel : scores Big Five issus du mini-IPIP (déjà sur 0-100)
  const naturel = scorerBigFive(repMini);
  // Adapté : 1 question par dimension (échelle 1-4 -> 0-100)
  const conv = {1:0.0, 2:33.333, 3:66.667, 4:100.0};
  const map = { ADP_E:'E', ADP_A:'A', ADP_C:'C', ADP_N:'N', ADP_O:'O' };
  const adapte = {};
  for (const [qid, lettre] of Object.entries(map)) {
    if (repAdapte[qid] !== undefined) adapte[lettre] = Math.round((conv[repAdapte[qid]]) * 10) / 10;
  }
  // Écart par dimension et coût global
  const ecarts = {};
  let sommeEcart = 0, n = 0;
  for (const d of ['E','A','C','N','O']) {
    if (adapte[d] !== undefined && naturel[d] !== undefined) {
      ecarts[d] = Math.round((adapte[d] - naturel[d]) * 10) / 10;
      sommeEcart += Math.abs(ecarts[d]); n++;
    }
  }
  const moyenne = n ? sommeEcart / n : 0;
  let cout = 'faible';
  if (moyenne >= 33) cout = 'élevé';
  else if (moyenne >= 18) cout = 'modéré';
  return { naturel, adapte, ecarts, cout, moyenneEcart: Math.round(moyenne * 10) / 10 };
}

// Export
const Engine = { scorer, scorerBigFive, calculerAffinites, calculerPointsSinea, calculerResultat, scorerContextuel, scorerContextuelPlus, scorerFiabilite, scorerSpeDims, scorerSpeStyle, scorerSpeStyleScores, scorerNaturelAdapte };

