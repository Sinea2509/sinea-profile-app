// ============================================================
// competences.js — Le moteur de compétences Sinéa
// Inspiré de la logique TMA : le POTENTIEL d'une compétence vient
// des traits naturels (le moteur intrinsèque), son EXPRESSION vient
// du profil adapté (le comportement observable au travail).
// Le croisement donne quatre zones, formulées en positif :
//   appui      : potentiel et expression hauts, le terrain de jeu
//   opportunite: potentiel haut encore peu exprimé, là où la
//                formation rapporte le plus vite
//   neutre     : terrain médian, mobilisable sans forcer
//   economie   : potentiel bas, on compense ou on délègue plutôt
//                que de s'acharner
// Tout est déterministe : mêmes scores, mêmes zones.
// ============================================================

(function () {
  // S = stabilité émotionnelle = 100 - N. Les poids somment à 1.
  const REFERENTIEL = [
    { id: 'ecoute_active', mots: ['ecoute','reformul','question ouverte','silence','comprendre'], nom: 'Écoute active', famille: 'RELATION', poids: { A: 0.55, S: 0.30, O: 0.15 } },
    { id: 'cooperation', mots: ['ensemble','binome','entraide','collectif','coequip','collabor'], nom: 'Coopération', famille: 'RELATION', poids: { A: 0.50, E: 0.25, S: 0.25 } },
    { id: 'communication_influence', mots: ['pitch','convain','argument','presenter','prise de parole','influence','recommandation','compliment'], nom: "Communication d'influence", famille: 'RELATION', poids: { E: 0.50, O: 0.25, A: 0.25 } },
    { id: 'developpement_autres', mots: ['feedback','coach','faire grandir','transmettre','former','mentor','deleg'], nom: 'Développement des autres', famille: 'RELATION', poids: { A: 0.45, O: 0.30, E: 0.25 } },
    { id: 'orientation_resultats', mots: ['objectif','resultat','conclure','closing','signer','vente','vendre'], nom: 'Orientation résultats', famille: 'ACTION', poids: { C: 0.45, E: 0.30, S: 0.25 } },
    { id: 'prise_decision', mots: ['decision','trancher','choisir','arbitr'], nom: 'Prise de décision', famille: 'ACTION', poids: { S: 0.40, E: 0.35, C: 0.25 } },
    { id: 'initiative', mots: ['oser','proposer','lancer','premier pas','initiative','contact a froid','prospect'], nom: 'Initiative', famille: 'ACTION', poids: { E: 0.40, O: 0.35, C: 0.25 } },
    { id: 'resilience', mots: ['stress','pression','respir','calme','refus','objection','echec','rejet'], nom: 'Résilience sous pression', famille: 'ACTION', poids: { S: 0.60, C: 0.20, O: 0.20 } },
    { id: 'organisation', mots: ['planifi','calendrier','agenda','revue du soir','organis','priorit','to do'], nom: 'Organisation et planification', famille: 'STRUCTURE', poids: { C: 0.65, S: 0.20, O: 0.15 } },
    { id: 'rigueur', mots: ['verifi','relire','qualite','detail','zero erreur','checklist'], nom: 'Rigueur et qualité', famille: 'STRUCTURE', poids: { C: 0.60, S: 0.25, A: 0.15 } },
    { id: 'fiabilite_suivi', mots: ['suivi','mail post','compte rendu','crm','tracer','relance'], nom: 'Fiabilité de suivi', famille: 'STRUCTURE', poids: { C: 0.55, A: 0.25, S: 0.20 } },
    { id: 'analyse', mots: ['analys','chiffre','donnee','indicateur','tableau de bord'], nom: 'Analyse', famille: 'STRUCTURE', poids: { O: 0.40, C: 0.40, S: 0.20 } },
    { id: 'vision_strategique', mots: ['strateg','long terme','vision'], nom: 'Vision stratégique', famille: 'VISION', poids: { O: 0.50, C: 0.25, E: 0.25 } },
    { id: 'creativite', mots: ['idee','creativ','brainstorm','imagin','contre-intuitive','contre intuitive'], nom: 'Créativité', famille: 'VISION', poids: { O: 0.65, E: 0.20, S: 0.15 } },
    { id: 'adaptabilite', mots: ['adapt','improvis','imprevu','nouveau contexte'], nom: 'Adaptabilité', famille: 'VISION', poids: { O: 0.40, S: 0.35, E: 0.25 } },
    { id: 'apprentissage', mots: ['apprendre','lire un','formation','veille','nouvelle methode'], nom: 'Apprentissage continu', famille: 'VISION', poids: { O: 0.55, C: 0.25, S: 0.20 } },
  ];

  // Les profils de poste : coefficient d'importance par compétence.
  // 1.35 = déterminante pour le rôle, 1 = utile, 0.7 = secondaire.
  const POSTES = {
    manager: {
      nom: 'Manager',
      coefs: {
        developpement_autres: 1.35, communication_influence: 1.35, prise_decision: 1.35,
        ecoute_active: 1.2, organisation: 1.2, orientation_resultats: 1.2, cooperation: 1.1,
        fiabilite_suivi: 1.1, resilience: 1.1, adaptabilite: 1, vision_strategique: 1,
        initiative: 1, rigueur: 0.9, analyse: 0.9, apprentissage: 0.9, creativite: 0.7,
      },
    },
    commercial: {
      nom: 'Commercial',
      coefs: {
        communication_influence: 1.35, orientation_resultats: 1.35, initiative: 1.35,
        ecoute_active: 1.2, resilience: 1.2, adaptabilite: 1.1, prise_decision: 1.1,
        cooperation: 1, fiabilite_suivi: 1, creativite: 1, apprentissage: 0.9,
        organisation: 0.9, developpement_autres: 0.8, analyse: 0.8, vision_strategique: 0.8, rigueur: 0.7,
      },
    },
    expert: {
      nom: 'Expert / contributeur',
      coefs: {
        analyse: 1.35, rigueur: 1.35, apprentissage: 1.35,
        organisation: 1.2, fiabilite_suivi: 1.2, creativite: 1.1, resilience: 1,
        adaptabilite: 1, orientation_resultats: 1, initiative: 0.9, ecoute_active: 0.9,
        cooperation: 0.9, prise_decision: 0.9, vision_strategique: 0.9,
        communication_influence: 0.8, developpement_autres: 0.7,
      },
    },
  };

  function borne(v) { return Math.max(0, Math.min(100, v)); }

  function traitsDepuis(bigFive) {
    const bf = bigFive || {};
    const n = (x) => (typeof x === 'number' ? x : Number(x));
    return {
      O: borne(n(bf.O) || 0), C: borne(n(bf.C) || 0), E: borne(n(bf.E) || 0),
      A: borne(n(bf.A) || 0), S: borne(100 - (n(bf.N) || 50)),
    };
  }

  function scoreCompetence(comp, traits) {
    let s = 0;
    for (const [t, p] of Object.entries(comp.poids)) s += (traits[t] || 0) * p;
    return Math.round(s * 10) / 10;
  }

  // scorer(bigFive, ecarts) : bigFive = profil NATUREL ; ecarts = adapté moins
  // naturel par dimension (E,A,C,N,O), tel que transmis par le portail.
  // Sans écarts (mesure absente), l'expression vaut le potentiel.
  function scorer(bigFive, ecarts) {
    const nat = traitsDepuis(bigFive);
    let adp = nat;
    if (ecarts && typeof ecarts === 'object') {
      const bf = bigFive || {};
      const num = (x) => (typeof x === 'number' ? x : Number(x) || 0);
      adp = traitsDepuis({
        O: num(bf.O) + num(ecarts.O), C: num(bf.C) + num(ecarts.C),
        E: num(bf.E) + num(ecarts.E), A: num(bf.A) + num(ecarts.A),
        N: num(bf.N) + num(ecarts.N),
      });
    }
    return REFERENTIEL.map((comp) => {
      const potentiel = scoreCompetence(comp, nat);
      const expression = scoreCompetence(comp, adp);
      let zone = 'neutre';
      if (potentiel <= 40) zone = 'economie';
      else if (potentiel >= 62 && expression >= 58) zone = 'appui';
      else if (potentiel >= 60 && (potentiel - expression >= 8 || expression < 55)) zone = 'opportunite';
      return { id: comp.id, nom: comp.nom, famille: comp.famille, potentiel, expression, zone };
    });
  }

  // prioriser(comps, posteId) : les 3 forces d'appui, les 3 opportunités où
  // investir en priorité pour CE poste, et jusqu'à 2 vigilances de staffing.
  function prioriser(comps, posteId) {
    const poste = POSTES[posteId] || POSTES.manager;
    const coef = (id) => poste.coefs[id] || 1;
    const parScoreAppui = comps
      .filter((c) => c.potentiel >= 58 && c.expression >= 52)
      .map((c) => ({ c, s: ((c.potentiel + c.expression) / 2) * coef(c.id) }))
      .sort((a, b) => b.s - a.s);
    const appuis = parScoreAppui.slice(0, 3).map((x) => x.c);
    const idsAppuis = new Set(appuis.map((c) => c.id));
    // Opportunités de premier ordre : le potentiel est là, l'expression suit
    // encore (la vraie logique TMA, quand la mesure de l'adapté existe).
    const sousExprimees = comps
      .filter((c) => !idsAppuis.has(c.id) && c.potentiel >= 56 && (c.potentiel - c.expression >= 8 || c.expression < 55))
      .map((c) => ({ c: c, motif: 'sous_expression', s: (Math.max(c.potentiel - c.expression, 0) * 1.2 + Math.max(56 - c.expression, 0) * 0.8 + (c.potentiel - 56) * 0.3) * coef(c.id) }))
      .sort((a, b) => b.s - a.s);
    let opportunitesBrutes = sousExprimees.slice(0, 3);
    // Complément : les leviers de poste, compétences déterminantes pour le
    // rôle au potentiel médian, les axes de développement réalistes.
    if (opportunitesBrutes.length < 3) {
      const deja = new Set(opportunitesBrutes.map((x) => x.c.id));
      const leviers = comps
        .filter((c) => !idsAppuis.has(c.id) && !deja.has(c.id) && coef(c.id) >= 1.1 && c.potentiel >= 45 && c.potentiel < 66)
        .map((c) => ({ c: c, motif: 'levier_de_poste', s: coef(c.id) * 100 + c.potentiel }))
        .sort((a, b) => b.s - a.s);
      opportunitesBrutes = opportunitesBrutes.concat(leviers.slice(0, 3 - opportunitesBrutes.length));
    }
    const opportunites = opportunitesBrutes.map((x) => Object.assign({}, x.c, { motif: x.motif }));
    const vigilances = comps
      .filter((c) => coef(c.id) >= 1.2 && c.potentiel <= 46 && !idsAppuis.has(c.id))
      .sort((a, b) => a.potentiel - b.potentiel)
      .slice(0, 2);
    return { poste: poste.nom, appuis, opportunites, vigilances };
  }

  // ================= Le collectif en trois réponses =================
  // 1. Les référents naturels : qui est fort où, pour router les missions.
  // 2. Les compétences orphelines : personne n'a le potentiel, le vrai
  //    risque structurel qui appelle recrutement ou externalisation.
  // 3. Les chantiers de formation : le potentiel collectif dormant le plus
  //    grand, là où un euro de formation rapporte le plus vite.
  // membres : [{ nom, bigFive, ecarts }], profils terminés uniquement.
  function collectif(membres) {
    const valides = (membres || []).filter((m) => m && m.bigFive && m.bigFive.O !== null && m.bigFive.O !== undefined);
    if (valides.length < 2) return null;
    const parMembre = valides.map((m) => ({ nom: m.nom || '', comps: scorer(m.bigFive, m.ecarts) }));
    const parComp = REFERENTIEL.map((ref, i) => {
      const lignes = parMembre.map((pm) => ({ nom: pm.nom, potentiel: pm.comps[i].potentiel, expression: pm.comps[i].expression }));
      const triPot = lignes.slice().sort((a, b) => b.potentiel - a.potentiel);
      const maxPot = triPot[0].potentiel;
      const potMoyen = Math.round(lignes.reduce((s, l) => s + l.potentiel, 0) / lignes.length * 10) / 10;
      const exprMoyenne = Math.round(lignes.reduce((s, l) => s + l.expression, 0) / lignes.length * 10) / 10;
      // Le gisement dormant : chez ceux qui ont le potentiel, l'écart moyen
      // entre ce potentiel et l'expression observée au travail.
      const porteurs = lignes.filter((l) => l.potentiel >= 56);
      const dormant = porteurs.length
        ? Math.round(porteurs.reduce((s, l) => s + Math.max(l.potentiel - l.expression, 0), 0) / porteurs.length * 10) / 10
        : 0;
      return {
        id: ref.id, nom: ref.nom, famille: ref.famille,
        referents: triPot.filter((l) => l.potentiel >= 62).slice(0, 2),
        maxPot: maxPot, potMoyen: potMoyen, exprMoyenne: exprMoyenne,
        dormant: dormant, nbPorteurs: porteurs.length,
      };
    });
    const referents = parComp
      .filter((c) => c.referents.length)
      .sort((a, b) => b.referents[0].potentiel - a.referents[0].potentiel);
    const orphelines = parComp
      .filter((c) => c.maxPot < 55)
      .sort((a, b) => a.maxPot - b.maxPot);
    // Chantiers : d'abord le dormant réel (la vraie logique TMA), en repli le
    // niveau collectif faible sur une compétence au potentiel moyen présent.
    let chantiers = parComp
      .filter((c) => c.dormant >= 6 && c.nbPorteurs >= Math.max(2, Math.ceil(valides.length / 3)))
      .map((c) => Object.assign({}, c, { motif: 'potentiel_dormant', score: c.dormant * c.nbPorteurs }))
      .sort((a, b) => b.score - a.score);
    if (chantiers.length < 3) {
      const deja = new Set(chantiers.map((c) => c.id));
      const repli = parComp
        .filter((c) => !deja.has(c.id) && c.potMoyen >= 52 && c.exprMoyenne < 58 && c.maxPot >= 55)
        .map((c) => Object.assign({}, c, { motif: 'niveau_collectif', score: (58 - c.exprMoyenne) * 2 + (c.potMoyen - 52) }))
        .sort((a, b) => b.score - a.score);
      chantiers = chantiers.concat(repli.slice(0, 3 - chantiers.length));
    }
    return { effectif: valides.length, referents, orphelines, chantiers: chantiers.slice(0, 3) };
  }

  // Quel geste de compétence ce défi de terrain travaille-t-il ?
  // Repérage déterministe par lexiques : le titre normalisé contient-il
  // un des mots du lexique de la compétence ? En cas d'égalité, l'ordre
  // du référentiel tranche. Sans correspondance : null.
  function matcherCompetence(titre) {
    const t = String(titre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    let meilleur = null, score = 0;
    REFERENTIEL.forEach((ref) => {
      const hits = (ref.mots || []).filter((m) => t.indexOf(m) >= 0).length;
      if (hits > score) { score = hits; meilleur = ref; }
    });
    return meilleur ? { id: meilleur.id, nom: meilleur.nom, famille: meilleur.famille } : null;
  }

  window.Competences = { REFERENTIEL, POSTES, scorer, prioriser, collectif, matcherCompetence };
})();
