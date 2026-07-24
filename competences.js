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
    { id: 'ecoute_active', def: "Être pleinement disponible à l'autre : questions ouvertes, reformulation, silence qui laisse la place.", progresser: ["Dans votre prochain échange, posez deux questions ouvertes avant de donner votre avis.", "Reformulez en une phrase ce que l'autre vient de dire avant de répondre."], mots: ['ecoute','reformul','question ouverte','silence','comprendre'], nom: 'Écoute active', famille: 'RELATION', poids: { A: 0.55, S: 0.30, O: 0.15 } },
    { id: 'cooperation', def: "Faire gagner l'équipe avant de gagner seul : entraide spontanée, information partagée, coéquipier fiable.", progresser: ["Proposez votre aide sur un dossier qui ne vous rapporte rien cette semaine.", "Partagez une information utile avant qu'on vous la demande."], mots: ['ensemble','binome','entraide','collectif','coequip','collabor'], nom: 'Coopération', famille: 'RELATION', poids: { A: 0.50, E: 0.25, S: 0.25 } },
    { id: 'communication_influence', def: "Convaincre et embarquer : structurer son propos, adapter son message à l'auditoire, prendre la parole avec impact.", progresser: ["Préparez vos trois points clés avant chaque réunion importante.", "Ouvrez votre prochaine présentation par l'enjeu pour l'auditoire, jamais par le contexte."], mots: ['pitch','convain','argument','presenter','prise de parole','influence','recommandation','compliment'], nom: "Communication d'influence", famille: 'RELATION', poids: { E: 0.50, O: 0.25, A: 0.25 } },
    { id: 'developpement_autres', def: "Faire grandir : feedback régulier, délégation qui responsabilise, transmission du savoir-faire.", progresser: ["Donnez un feedback précis dans les 24 heures après une situation observée.", "Déléguez une tâche complète avec le pourquoi, en plus du quoi."], mots: ['feedback','coach','faire grandir','transmettre','former','mentor','deleg'], nom: 'Développement des autres', famille: 'RELATION', poids: { A: 0.45, O: 0.30, E: 0.25 } },
    { id: 'orientation_resultats', def: "Aller au bout : se fixer des cibles claires, conclure, tenir le cap jusqu'au résultat.", progresser: ["Terminez chaque journée en notant le résultat obtenu, plutôt que l'activité.", "Fixez une échéance à tout engagement pris en réunion."], mots: ['objectif','resultat','conclure','closing','signer','vente','vendre'], nom: 'Orientation résultats', famille: 'ACTION', poids: { C: 0.45, E: 0.30, S: 0.25 } },
    { id: 'prise_decision', def: "Trancher : instruire vite, choisir, assumer, ajuster ensuite.", progresser: ["Sur la prochaine décision réversible, tranchez en 24 heures maximum.", "Écrivez en deux lignes le critère qui départage avant d'arbitrer."], mots: ['decision','trancher','choisir','arbitr'], nom: 'Prise de décision', famille: 'ACTION', poids: { S: 0.40, E: 0.35, C: 0.25 } },
    { id: 'initiative', def: "Faire le premier pas : proposer, lancer, oser avant qu'on le demande.", progresser: ["Proposez une amélioration concrète à votre manager cette semaine.", "Prenez contact en premier avec la personne que vous repoussez d'appeler."], mots: ['oser','proposer','lancer','premier pas','initiative','contact a froid','prospect'], nom: 'Initiative', famille: 'ACTION', poids: { E: 0.40, O: 0.35, C: 0.25 } },
    { id: 'resilience', def: "Tenir sous pression : garder son calme, encaisser un refus, rebondir vite.", progresser: ["Après un refus, notez un apprentissage avant toute autre action.", "Prenez trois respirations lentes avant de répondre à un message irritant."], mots: ['stress','pression','respir','calme','refus','objection','echec','rejet'], nom: 'Résilience sous pression', famille: 'ACTION', poids: { S: 0.60, C: 0.20, O: 0.20 } },
    { id: 'organisation', def: "Structurer l'action : planifier, prioriser, protéger le temps important.", progresser: ["Bloquez deux créneaux de travail profond dans votre agenda de la semaine.", "Terminez la journée par une revue de cinq minutes qui prépare demain."], mots: ['planifi','calendrier','agenda','revue du soir','organis','priorit','to do'], nom: 'Organisation et planification', famille: 'STRUCTURE', poids: { C: 0.65, S: 0.20, O: 0.15 } },
    { id: 'rigueur', def: "Le souci du travail juste : vérifier, relire, viser le zéro défaut là où ça compte.", progresser: ["Relisez tout livrable sensible à froid, après une vraie pause.", "Créez une check-list pour votre tâche récurrente la plus risquée."], mots: ['verifi','relire','qualite','detail','zero erreur','checklist'], nom: 'Rigueur et qualité', famille: 'STRUCTURE', poids: { C: 0.60, S: 0.25, A: 0.15 } },
    { id: 'fiabilite_suivi', def: "Tenir ce qui est dit : traçabilité, relances, engagements honorés dans les délais.", progresser: ["Envoyez un compte rendu en trois lignes après chaque rendez-vous.", "Notez chaque engagement avec sa date, au moment même où vous le prenez."], mots: ['suivi','mail post','compte rendu','crm','tracer','relance'], nom: 'Fiabilité de suivi', famille: 'STRUCTURE', poids: { C: 0.55, A: 0.25, S: 0.20 } },
    { id: 'analyse', def: "Comprendre avant d'agir : les chiffres, les causes, la structure du problème.", progresser: ["Avant de proposer, écrivez le problème en une phrase et deux causes possibles.", "Appuyez votre prochaine recommandation sur un chiffre vérifié."], mots: ['analys','chiffre','donnee','indicateur','tableau de bord'], nom: 'Analyse', famille: 'STRUCTURE', poids: { O: 0.40, C: 0.40, S: 0.20 } },
    { id: 'vision_strategique', def: "Voir loin : relier le quotidien aux enjeux, donner un cap.", progresser: ["Reliez explicitement votre prochaine action à un objectif du trimestre.", "Prenez trente minutes pour écrire où votre périmètre doit être dans un an."], mots: ['strateg','long terme','vision'], nom: 'Vision stratégique', famille: 'VISION', poids: { O: 0.50, C: 0.25, E: 0.25 } },
    { id: 'creativite', def: "Générer du neuf : associer, imaginer, proposer autrement.", progresser: ["Cherchez trois options avant de retenir la première solution.", "Empruntez une pratique d'un autre métier et testez-la chez vous."], mots: ['idee','creativ','brainstorm','imagin','contre-intuitive','contre intuitive'], nom: 'Créativité', famille: 'VISION', poids: { O: 0.65, E: 0.20, S: 0.15 } },
    { id: 'adaptabilite', def: "Épouser le changement : improviser, changer de plan sans perdre le cap.", progresser: ["Face au prochain imprévu, listez deux plans B avant de réagir.", "Changez volontairement une routine cette semaine pour vous entraîner."], mots: ['adapt','improvis','imprevu','nouveau contexte'], nom: 'Adaptabilité', famille: 'VISION', poids: { O: 0.40, S: 0.35, E: 0.25 } },
    { id: 'apprentissage', def: "Progresser en continu : curiosité, veille, essais réguliers.", progresser: ["Testez une nouvelle méthode sur une tâche réelle cette semaine.", "Bloquez trente minutes hebdomadaires de veille sur votre métier."], mots: ['apprendre','lire un','formation','veille','nouvelle methode'], nom: 'Apprentissage continu', famille: 'VISION', poids: { O: 0.55, C: 0.25, S: 0.20 } },
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

  // Les dimensions métier mesurées affinent l'expression des compétences
  // qu'elles observent directement : le comportemental réel plutôt que le proxy.
  const DIMS_VERS_COMPETENCES = {
    developpement_autres: ['delegation', 'feedback'],
    organisation: ['cadrage'],
    communication_influence: ['posture'],
    orientation_resultats: ['closing'],
    resilience: ['objection'],
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
  function scorer(bigFive, ecarts, dims) {
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
    const liste = REFERENTIEL.map((comp) => {
      const potentiel = scoreCompetence(comp, nat);
      let expression = scoreCompetence(comp, adp);
      // Fusion avec les dimensions métier observées, quand elles existent
      const clesDims = DIMS_VERS_COMPETENCES[comp.id];
      if (clesDims && dims && typeof dims === 'object') {
        const vals = clesDims.map((k) => Number(dims[k])).filter((v) => !isNaN(v) && v >= 0 && v <= 100);
        if (vals.length) {
          const moyDims = vals.reduce((a, b) => a + b, 0) / vals.length;
          expression = Math.round((expression * 0.6 + moyDims * 0.4) * 10) / 10;
        }
      }
      const zone = zoneDe(potentiel, expression);
      return { id: comp.id, nom: comp.nom, famille: comp.famille, potentiel, expression, zone };
    });
    const __parGoulot = [...liste].sort((a, b) => Math.min(b.potentiel, b.expression) - Math.min(a.potentiel, a.expression));
    const __top3 = __parGoulot.slice(0, 3);
    const __seuils = {
      pot: Math.min(SEUILS.potAppui, Math.min(...__top3.map(cc => cc.potentiel))),
      expr: Math.min(SEUILS.exprAppui, Math.min(...__top3.map(cc => cc.expression))),
    };
    liste.forEach(cc => { cc.zone = zoneDe(cc.potentiel, cc.expression, __seuils); });
    liste.seuils = __seuils;
    return liste;
  }

  // prioriser(comps, posteId) : les 3 forces d'appui, les 3 opportunités où
  // investir en priorité pour CE poste, et jusqu'à 2 vigilances de staffing.
  function prioriser(comps, posteId, coefsCustom) {
    const poste = POSTES[posteId] || POSTES.manager;
    const coef = (id) => (coefsCustom && coefsCustom[id]) || poste.coefs[id] || 1;
    const nomPoste = coefsCustom ? 'Profil cible sur mesure' : poste.nom;
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
        .filter((c) => !idsAppuis.has(c.id) && !deja.has(c.id) && coef(c.id) >= 1.1 && c.potentiel >= 50 && c.potentiel < 66)
        .map((c) => ({ c: c, motif: 'levier_de_poste', s: coef(c.id) * 100 + c.potentiel }))
        .sort((a, b) => b.s - a.s);
      opportunitesBrutes = opportunitesBrutes.concat(leviers.slice(0, 3 - opportunitesBrutes.length));
    }
    const opportunites = opportunitesBrutes.map((x) => Object.assign({}, x.c, { motif: x.motif }));
    const vigilances = comps
      .filter((c) => coef(c.id) >= 1.2 && c.potentiel <= 46 && !idsAppuis.has(c.id))
      .sort((a, b) => a.potentiel - b.potentiel)
      .slice(0, 2);
    return { poste: nomPoste, appuis, opportunites, vigilances };
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
    const parMembre = valides.map((m) => ({ nom: m.nom || '', comps: scorer(m.bigFive, m.ecarts, m.dims) }));
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
        referents: triPot.filter((l) => l.potentiel >= Math.max(62, potMoyen + 6)).slice(0, 2),
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
    return { effectif: valides.length, referents, orphelines, chantiers: chantiers.slice(0, 3), matrice: parComp };
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

  // Expression de chaque compétence depuis un jeu de traits perçus
  // (E, A, C, S, O sur 0-100) : la vue des pairs via le miroir.
  function expressionDepuis(traits) {
    const t = { O: borne(Number(traits.O) || 0), C: borne(Number(traits.C) || 0), E: borne(Number(traits.E) || 0), A: borne(Number(traits.A) || 0), S: borne(Number(traits.S) || 0) };
    const out = {};
    REFERENTIEL.forEach((comp) => { out[comp.id] = scoreCompetence(comp, t); });
    return out;
  }

  // ===== La notice scientifique du référentiel =====
  const NOTICE = {
    preambule: [
      "Le référentiel Sinéa comprend seize compétences réparties sur les quatre familles du modèle (Relation, Action, Structure, Vision). Chaque compétence est pondérée sur les cinq grands facteurs de personnalité (Big Five), le cadre le plus validé de la psychologie différentielle, dont la structure et la validité prédictive en contexte professionnel sont établies par des décennies de méta-analyses.",
      "Le POTENTIEL d'une compétence est calculé sur le profil naturel : il traduit la facilité intrinsèque de développement, dans l'esprit des approches par les moteurs (dont TMA). L'EXPRESSION est calculée sur le profil adapté, le comportement déclaré en contexte de travail, affinée par les dimensions métier mesurées (délégation, feedback, cadrage, posture, closing, objection) lorsqu'elles existent, à hauteur de quarante pour cent.",
      "Limites et calibration : les mesures sont auto-déclarées. Trois mécanismes de calibration les consolident : la fiabilité interne (cohérence des réponses, signaux de hasard), le miroir 360 (le regard agrégé des pairs, comparé à l'expression calculée), et, à mesure que le volume de passations le permet, les normes empiriques qui remplaceront les seuils absolus par des percentiles réels.",
    ],
    parComp: {
      ecoute_active: "L'agréabilité prédit les comportements d'aide et la qualité relationnelle au travail (méta-analyses sur les comportements de citoyenneté organisationnelle) ; la stabilité émotionnelle soutient la disponibilité attentionnelle ; l'ouverture nourrit la curiosité pour le point de vue de l'autre.",
      cooperation: "L'agréabilité est le prédicteur central de la coopération et du travail en équipe ; l'extraversion facilite l'engagement dans l'interaction ; la stabilité protège la relation dans la durée.",
      communication_influence: "L'extraversion est le facteur le plus lié à l'émergence du leadership et à l'aisance de prise de parole (Judge et al., 2002) ; l'ouverture apporte la richesse argumentative, l'agréabilité l'accordage à l'auditoire.",
      developpement_autres: "Le développement d'autrui combine l'orientation vers les personnes (agréabilité), l'appétit de transmission (ouverture) et l'énergie relationnelle (extraversion) ; il est central dans les modèles de leadership transformationnel.",
      orientation_resultats: "La conscience est le prédicteur le plus robuste de la performance professionnelle toutes familles de métiers confondues (Barrick et Mount, 1991) ; l'extraversion ajoute la dynamique d'atteinte, la stabilité la constance de l'effort.",
      prise_decision: "La stabilité émotionnelle réduit l'évitement décisionnel et la paralysie sous incertitude ; l'extraversion favorise l'affirmation du choix ; la conscience structure l'instruction du choix.",
      initiative: "La proactivité est associée à l'extraversion et à l'ouverture (recherche de nouveauté, prise d'initiative) avec un socle de conscience pour transformer l'élan en action suivie.",
      resilience: "La stabilité émotionnelle est, par construction, le cœur de la résistance au stress et le protecteur documenté de l'épuisement ; la conscience apporte les stratégies de coping actives, l'ouverture la réévaluation cognitive.",
      organisation: "La planification et l'ordre sont des facettes constitutives de la conscience, dont la validité prédictive sur la performance de gestion est établie ; la stabilité soutient la tenue du cadre dans la durée.",
      rigueur: "L'exigence de qualité et le souci du détail relèvent des facettes d'application et de délibération de la conscience ; la stabilité limite les erreurs sous pression, l'agréabilité la rigueur au service du collectif.",
      fiabilite_suivi: "La fiabilité, tenir ce qui est dit dans les délais dits, est l'expression comportementale la plus directe de la conscience ; l'agréabilité y ajoute le souci de l'autre, la stabilité la régularité.",
      analyse: "La pensée analytique mobilise l'ouverture (intellect, goût des idées) et la conscience (méthode, vérification) ; la stabilité protège le jugement des biais émotionnels.",
      vision_strategique: "La projection à long terme s'appuie sur l'ouverture (pensée abstraite, imagination structurée), la conscience (cohérence des plans) et l'extraversion (capacité à porter le cap).",
      creativite: "L'ouverture est le prédicteur majeur et constant de la créativité mesurée ; l'extraversion facilite l'expression des idées, la stabilité leur maturation sans autocensure anxieuse.",
      adaptabilite: "La flexibilité face au changement combine l'ouverture (accueil de la nouveauté) et la stabilité émotionnelle (tolérance à l'incertitude), l'extraversion soutenant l'engagement dans le nouveau contexte.",
      apprentissage: "L'orientation d'apprentissage est portée par l'ouverture (curiosité épistémique) et la conscience (persévérance d'étude) ; la stabilité entretient l'effort face à la difficulté.",
    },
  };

  // Les couleurs des quatre familles, source unique pour tout le front
  const COULEURS_FAMILLES = { RELATION: '#F98272', ACTION: '#E8951A', STRUCTURE: '#2C97E0', VISION: '#5E59C7' };
  const COULEURS_FAMILLES_LISTE = ['#F98272', '#E8951A', '#3EADFF', '#5E59C7'];

  // Les seuils du modèle, source unique pour le moteur, le quadrant,
  // la carte de chaleur et l'adéquation au poste.
  const SEUILS = { potAppui: 62, exprAppui: 58, potLevier: 50 };
  function zoneDe(potentiel, expression, seuils) {
    const sx = (seuils && seuils.pot) || SEUILS.potAppui;
    const sy = (seuils && seuils.expr) || SEUILS.exprAppui;
    if (potentiel >= sx && expression >= sy) return 'appui';
    if (potentiel <= 40) return 'economie';
    if (potentiel >= 60 && (potentiel - expression >= 8 || expression < 55)) return 'opportunite';
    return 'neutre';
  }

  // ===== Le fit au poste, centralisé et testable =====
  // Cibles d'expression par importance : déterminante 75, utile 60, secondaire 45.
  function cibleDe(coef) { return coef >= 1.2 ? 75 : (coef >= 0.85 ? 60 : 45); }
  function fitPoste(comps, coefs) {
    if (!Array.isArray(comps) || !comps.length || !coefs) return null;
    let num = 0, den = 0;
    const gaps = [];
    comps.forEach((c) => {
      const coef = coefs[c.id] || 1;
      const cible = cibleDe(coef);
      num += coef * Math.max(0, Math.min(1, c.expression / cible));
      den += coef;
      if (coef >= 1.2 && c.expression < cible) gaps.push({ id: c.id, nom: c.nom, exp: Math.round(c.expression), cible: cible, manque: cible - c.expression, moteur: c.potentiel >= cible });
    });
    gaps.sort((a, b) => b.manque - a.manque);
    return den ? { score: Math.round(100 * num / den), gaps: gaps.slice(0, 3) } : null;
  }

  // ============================================================
  // LE CODEX VIVANT : la trajectoire de développement
  // Quatre paliers vécus, du premier geste à la transmission.
  // Chaque palier : [repère observable, micro-défi façon SeedUp].
  // Plus deux questions d'entretien comportementales par compétence.
  // ============================================================
  const PALIERS_NOMS = ["Premier geste", "En routine", "Sous pression", "Transmis aux autres"];
  function palierDe(expression) {
    if (expression < 45) return 1;
    if (expression < SEUILS.exprAppui) return 2;
    if (expression < 72) return 3;
    return 4;
  }
  const CODEX = {
    ecoute_active: { paliers: [
      ["Vous laissez l'autre finir ses phrases et vous posez une question avant de donner votre avis.", "Aujourd'hui, dans un échange, posez deux questions ouvertes avant toute suggestion."],
      ["Reformuler est devenu un réflexe, vos interlocuteurs disent se sentir compris.", "Terminez trois conversations cette semaine par une reformulation en une phrase."],
      ["En désaccord ou sous tension, vous écoutez encore avant de défendre votre position.", "Au prochain désaccord, reformulez la position adverse jusqu'au oui c'est ça, avant de répondre."],
      ["Autour de vous, on s'écoute davantage parce que vous le modelez et le demandez.", "En réunion, donnez la parole à la personne la plus silencieuse et reformulez son idée."]],
      entretien: ["Racontez-moi une conversation récente où vous avez changé d'avis en écoutant. Qu'avez-vous entendu exactement ?", "Décrivez un moment où quelqu'un se sentait incompris face à vous. Qu'avez-vous fait ?"] },
    cooperation: { paliers: [
      ["Vous partagez l'information utile quand on vous la demande.", "Partagez aujourd'hui une information utile avant qu'on vous la demande."],
      ["Aider un collègue fait partie de votre semaine normale, même sans bénéfice direct.", "Proposez votre aide sur un dossier qui ne vous rapporte rien cette semaine."],
      ["Quand les délais serrent, vous protégez le collectif au lieu de jouer votre partition seul.", "Sur votre prochaine urgence, demandez qui a besoin de quoi avant de foncer."],
      ["Vous créez les binômes et les rituels qui font coopérer les autres.", "Montez un binôme entre deux collègues qui gagneraient à travailler ensemble."]],
      entretien: ["Parlez-moi d'une fois où aider un collègue vous a coûté du temps sur vos propres objectifs. Comment avez-vous arbitré ?", "Racontez une situation où l'équipe a gagné grâce à une information que vous avez fait circuler."] },
    communication_influence: { paliers: [
      ["Vous préparez vos points clés avant les échanges qui comptent.", "Avant votre prochaine réunion, écrivez vos trois points clés sur une fiche."],
      ["Vos messages sont structurés, l'enjeu d'abord, et on retient ce que vous dites.", "Ouvrez votre prochaine présentation par l'enjeu pour l'auditoire, jamais par le contexte."],
      ["Face à un auditoire difficile ou une objection publique, vous gardez le cap et le sourire.", "À la prochaine objection, accueillez-la, reformulez-la, puis répondez en une idée."],
      ["On vous demande de porter les messages sensibles et vous préparez les autres à convaincre.", "Coachez un collègue sur son prochain pitch, trois points, un enjeu, une répétition."]],
      entretien: ["Racontez-moi la fois où vous avez fait changer d'avis un interlocuteur réticent. Comment vous y êtes-vous pris, étape par étape ?", "Décrivez une présentation qui s'est mal passée. Qu'avez-vous changé depuis ?"] },
    developpement_autres: { paliers: [
      ["Vous dites ce qui va et ce qui coince quand on vous le demande.", "Donnez aujourd'hui un feedback précis sur un fait des dernières 24 heures."],
      ["Le feedback et la délégation responsabilisante font partie de votre pratique régulière.", "Déléguez cette semaine une tâche complète avec le pourquoi, en plus du quoi."],
      ["Même débordé, vous ne reprenez pas la main, vous aidez l'autre à trouver son chemin.", "La prochaine fois qu'on vous apporte un problème, répondez par une question au lieu d'une solution."],
      ["Vous faites grandir des gens qui font grandir des gens, et cela se voit dans l'équipe.", "Confiez à quelqu'un le soin de former un tiers sur ce que vous lui avez appris."]],
      entretien: ["Parlez-moi de quelqu'un que vous avez fait progresser. Qu'avez-vous fait concrètement, et qu'est-ce que cette personne dirait de vous ?", "Racontez un feedback difficile que vous avez donné. Comment l'avez-vous préparé ?"] },
    orientation_resultats: { paliers: [
      ["Vous savez ce que vous devez livrer et pour quand.", "Écrivez ce matin le livrable précis de votre journée, une phrase."],
      ["Vous priorisez par l'impact et vous finissez ce que vous commencez.", "Identifiez la tâche à plus fort impact de la semaine et faites-la en premier chaque matin."],
      ["Quand tout presse, vous sacrifiez l'accessoire en le disant, jamais le résultat.", "Au prochain surcroît, annoncez explicitement ce que vous dépriorisez et pourquoi."],
      ["Vous donnez à l'équipe des caps mesurables et le goût de les atteindre.", "Formulez pour votre équipe un objectif chiffré à quinze jours et affichez-le."]],
      entretien: ["Racontez-moi un objectif que vous avez atteint contre vents et marées. Qu'avez-vous sacrifié en route ?", "Décrivez une fois où vous n'avez pas livré. Qu'est-ce qui s'est joué, et qu'avez-vous changé ?"] },
    prise_decision: { paliers: [
      ["Vous tranchez les petits sujets sans les faire remonter.", "Prenez aujourd'hui une décision que vous auriez normalement fait valider."],
      ["Vous décidez avec les données disponibles et vous assumez le résultat.", "Sur votre prochaine décision, fixez-vous une échéance et tenez-la, information complète ou pas."],
      ["Dans le flou ou l'urgence, vous posez un choix clair et vous l'expliquez.", "À la prochaine situation ambiguë, écrivez les deux options, choisissez en dix minutes, informez."],
      ["Vous rendez les autres capables de décider, cadre clair et droit à l'erreur.", "Définissez avec un collègue le périmètre où il décide seul désormais."]],
      entretien: ["Parlez-moi de la décision la plus inconfortable que vous ayez prise seul. Avec quelles informations, et qu'en est-il sorti ?", "Racontez une décision que vous avez trop retardée. Qu'est-ce que cela a coûté ?"] },
    initiative: { paliers: [
      ["Vous signalez les problèmes que vous voyez, sans attendre qu'on vous le demande.", "Signalez aujourd'hui un irritant que tout le monde contourne, avec une piste."],
      ["Vous lancez des améliorations dans votre périmètre sans permission préalable.", "Améliorez cette semaine un processus qui vous agace, puis montrez le avant-après."],
      ["Quand personne ne prend le sujet, vous le prenez, même hors de votre fiche de poste.", "Prenez le sujet orphelin de votre équipe et donnez-lui un premier pas cette semaine."],
      ["Vous créez un climat où les autres osent proposer et essayer.", "À la prochaine idée d'un collègue, répondez par comment on teste petit plutôt que par oui mais."]],
      entretien: ["Racontez-moi quelque chose que vous avez lancé sans qu'on vous le demande. Qu'est-ce qui vous a décidé ?", "Décrivez une initiative qui a échoué. Comment l'avez-vous assumée ?"] },
    resilience: { paliers: [
      ["Vous encaissez les contretemps sans les transformer en drame.", "Au prochain imprévu, écrivez la version factuelle en deux phrases avant d'en parler."],
      ["Après un échec, vous rebondissez vite et vous en tirez une leçon utilisable.", "Sur votre dernier raté, formulez la leçon en une phrase et la prochaine action."],
      ["Sous forte pression, vous restez stable et vous protégez votre énergie et celle des autres.", "Cette semaine, verrouillez un créneau de récupération non négociable et tenez-le."],
      ["Vous êtes le point d'ancrage des autres dans les tempêtes.", "Au prochain coup dur d'équipe, ouvrez la réunion par ce qui reste solide, avant le problème."]],
      entretien: ["Racontez-moi votre pire période professionnelle. Comment avez-vous tenu, concrètement, semaine après semaine ?", "Décrivez un échec qui vous a longtemps travaillé. Qu'en avez-vous fait ?"] },
    organisation: { paliers: [
      ["Vos journées ont une liste et vos engagements ont une trace.", "Ce soir, préparez la liste de demain, trois priorités maximum."],
      ["Vous planifiez la semaine, anticipez les échéances et tenez vos délais.", "Bloquez dès maintenant dans l'agenda les créneaux de vos deux gros livrables de la semaine."],
      ["Quand tout bouge, vous réorganisez vite sans rien laisser tomber au sol.", "Au prochain chamboulement, reconstruisez le plan en quinze minutes et communiquez-le."],
      ["Vos méthodes structurent l'équipe, on s'appuie sur vos rituels.", "Installez un rituel simple d'équipe, quinze minutes de revue hebdomadaire, et animez-le trois semaines."]],
      entretien: ["Décrivez-moi votre système d'organisation un lundi matin chargé. Concrètement, outil par outil.", "Racontez une période où vous avez jonglé avec trop de projets. Qu'avez-vous laissé tomber, et comment l'avez-vous choisi ?"] },
    rigueur: { paliers: [
      ["Vous relisez ce qui part et vous corrigez ce que vous voyez.", "Relisez votre prochain envoi important à voix basse avant de cliquer."],
      ["Vos livrables partent propres, les détails qui comptent sont vérifiés.", "Créez une check-list de cinq points pour votre livrable récurrent et appliquez-la."],
      ["Même dans l'urgence, vous tenez le niveau d'exigence sur ce qui ne pardonne pas.", "Sous le prochain délai serré, identifiez les deux vérifications non négociables et faites-les."],
      ["Votre exigence élève le standard des autres sans les écraser.", "Transformez votre check-list en standard d'équipe et présentez-la en dix minutes."]],
      entretien: ["Racontez-moi une erreur de détail qui a eu de grosses conséquences autour de vous. Qu'avez-vous mis en place ensuite ?", "Comment arbitrez-vous entre vite et parfait ? Donnez-moi un exemple récent des deux."] },
    fiabilite_suivi: { paliers: [
      ["Ce que vous promettez pour vendredi arrive vendredi.", "Ne promettez aujourd'hui que ce que vous pouvez tenir, et notez chaque engagement pris."],
      ["Vos engagements sont suivis, relancés, soldés, sans qu'on vous coure après.", "Faites ce vendredi la revue de vos engagements ouverts et soldez ou renégociez chacun."],
      ["Quand vous ne pouvez plus tenir, vous prévenez tôt et vous proposez un plan B.", "Au premier doute sur un délai, prévenez immédiatement avec une nouvelle date ferme."],
      ["Votre parole fait référence, on cale les plans sur vos engagements.", "Aidez un collègue débordé à renégocier proprement un engagement intenable."]],
      entretien: ["Parlez-moi d'un engagement que vous n'avez pas pu tenir. Quand l'avez-vous dit, et comment ?", "Comment suivez-vous vos promesses en cours ? Montrez-moi votre méthode réelle."] },
    analyse: { paliers: [
      ["Devant un problème, vous cherchez les faits avant les opinions.", "Sur le prochain problème, listez trois faits vérifiés avant toute hypothèse."],
      ["Vous décomposez les sujets complexes et vos conclusions sont sourcées.", "Prenez votre dossier flou du moment et découpez-le en trois sous-questions."],
      ["Sous pression, vous gardez la tête froide et vous distinguez le signal du bruit.", "Dans la prochaine urgence, posez par écrit qu'est-ce qu'on sait, qu'est-ce qu'on suppose."],
      ["Vos grilles de lecture équipent les autres pour penser mieux.", "Formalisez votre méthode d'analyse en une page et partagez-la à l'équipe."]],
      entretien: ["Racontez-moi un problème complexe que vous avez démêlé. Par où avez-vous commencé, et qu'avez-vous écarté ?", "Décrivez une fois où votre première analyse était fausse. Comment vous en êtes-vous aperçu ?"] },
    vision_strategique: { paliers: [
      ["Vous reliez votre travail quotidien aux enjeux d'ensemble.", "Pour votre tâche du jour, écrivez en une phrase à quel enjeu global elle sert."],
      ["Vous anticipez à quelques mois et vos choix du présent préparent la suite.", "Bloquez trente minutes cette semaine pour écrire où votre périmètre doit être dans six mois."],
      ["Dans le brouillard, vous maintenez un cap lisible et vous renoncez à ce qui en dévie.", "Identifiez une activité qui ne sert plus le cap et proposez son arrêt."],
      ["Vous donnez aux autres une histoire du futur qui oriente leurs décisions.", "Racontez la vision à votre équipe en trois phrases, le point de départ, le cap, le premier pas."]],
      entretien: ["Où voyez-vous votre métier dans trois ans, et qu'avez-vous déjà changé dans votre façon de travailler à cause de cela ?", "Racontez une décision court-termiste que vous avez refusée au nom de la suite. Qu'est-ce que cela a coûté sur le moment ?"] },
    creativite: { paliers: [
      ["Vous proposez des variantes quand la voie habituelle coince.", "Sur un irritant du jour, proposez une alternative, même imparfaite."],
      ["Vous générez régulièrement des idées neuves et vous en testez certaines.", "Cette semaine, testez une idée en version minuscule, une heure maximum."],
      ["Quand les contraintes étouffent, vous en faites un terrain de jeu.", "Prenez votre plus grosse contrainte actuelle et trouvez trois façons d'en faire un atout."],
      ["Vous animez la créativité des autres, vos formats font émerger leurs idées.", "Animez quinze minutes de génération d'idées en équipe avec une règle, aucune critique avant dix idées."]],
      entretien: ["Racontez-moi l'idée la plus inattendue que vous ayez fait aboutir. D'où venait-elle, et qui a fallu convaincre ?", "Décrivez une situation bloquée que vous avez débloquée par un angle inhabituel."] },
    adaptabilite: { paliers: [
      ["Vous acceptez les changements de plan sans friction excessive.", "Au prochain changement imposé, cherchez d'abord ce qu'il rend possible."],
      ["Vous changez de méthode ou d'interlocuteur avec aisance, selon le contexte.", "Adaptez consciemment votre communication à deux interlocuteurs très différents aujourd'hui."],
      ["Dans les grands virages, vous êtes rapidement opérationnel dans le nouveau monde.", "Sur le changement en cours, fixez-vous trois apprentissages à maîtriser sous quinze jours."],
      ["Vous aidez les autres à traverser le changement, vous en êtes le passeur.", "Repérez la personne la plus bousculée par le changement et offrez-lui trente minutes."]],
      entretien: ["Racontez-moi le plus gros changement subi de votre parcours. Qu'avez-vous fait la première semaine ?", "Décrivez une habitude de travail que vous avez abandonnée. Qu'est-ce qui vous a convaincu ?"] },
    apprentissage: { paliers: [
      ["Vous cherchez la réponse avant de demander, et vous retenez ce que vous trouvez.", "Sur la prochaine question, cherchez quinze minutes avant de solliciter quelqu'un."],
      ["Vous apprenez en continu, un sujet en cours, des sources régulières.", "Choisissez le sujet du mois et bloquez deux créneaux de trente minutes par semaine."],
      ["Vous apprenez vite sous contrainte, un nouveau domaine ne vous fait pas peur.", "Prenez une tâche légèrement au-dessus de votre niveau et livrez-la avec de l'aide."],
      ["Vous transformez ce que vous apprenez en savoir d'équipe.", "Partagez en dix minutes votre dernier apprentissage utile au reste de l'équipe."]],
      entretien: ["Qu'avez-vous appris de significatif ces six derniers mois, et comment l'avez-vous appris concrètement ?", "Racontez une compétence que vous avez dû acquérir en urgence. Votre méthode, jour par jour ?"] },
  };

    // La projection à 90 jours : hypothèse d'ancrage tenu.
  // Constante unique, à recalibrer sur les re-mesures réelles dès volume.
  const BOOST_PROJECTION = 12;
  function projeterComps(comps, idsEngages) {
    if (!Array.isArray(comps) || !idsEngages) return comps;
    const out = comps.map((c) => idsEngages.has(c.id)
      ? Object.assign({}, c, { expression: Math.min(100, Math.max(c.expression, Math.min(c.potentiel, c.expression + BOOST_PROJECTION))) })
      : c);
    if (comps.seuils) {
      out.seuils = comps.seuils;
      out.forEach((c) => { c.zone = zoneDe(c.potentiel, c.expression, comps.seuils); });
    }
    return out;
  }

  // ============================================================
  // LES FACETTES : l'étage d'exhaustivité sans dilution
  // Deux facettes contextuelles par compétence maîtresse. Elles
  // héritent du calcul de leur mère (aucune mesure séparée) et
  // portent chacune trois micro-défis pour la défithèque SeedUp.
  // ============================================================
  const FACETTES = {
    ecoute_active: [
      { id: "questionnement", nom: "Questionnement", def: "Faire émerger l'information et la réflexion par des questions ouvertes plutôt que par des affirmations.", defis: ["Dans votre prochain échange, remplacez votre premier conseil par une question ouverte.", "Préparez trois questions avant votre prochain point individuel, aucune fermée.", "Quand on vous demande votre avis aujourd'hui, répondez d'abord par : qu'en pensez-vous ?"] },
      { id: "empathie_tension", nom: "Empathie en tension", def: "Rester connecté au ressenti de l'autre quand la conversation chauffe, sans abandonner le fond.", defis: ["Au prochain désaccord, nommez l'émotion perçue chez l'autre avant de répondre sur le fond.", "Face à une critique aujourd'hui, remerciez et reformulez avant toute défense.", "Repérez le moment où votre interlocuteur se ferme et posez la question : qu'est-ce qui coince pour vous ?"] },
    ],
    cooperation: [
      { id: "travail_transverse", nom: "Travail transverse", def: "Coopérer efficacement au-delà de son équipe, avec d'autres métiers, d'autres priorités, d'autres langages.", defis: ["Identifiez cette semaine un interlocuteur d'un autre service et proposez-lui un café de trente minutes.", "Sur votre dossier en cours, demandez à un autre métier ce qui lui simplifierait la vie.", "Traduisez votre prochaine demande transverse dans le vocabulaire du destinataire, jamais dans le vôtre."] },
      { id: "gestion_conflit", nom: "Gestion de conflit", def: "Aborder les désaccords de front et tôt, pour qu'ils restent des divergences et non des ruptures.", defis: ["Nommez aujourd'hui un différend que vous évitez et proposez quinze minutes pour en parler.", "Au prochain conflit, écrivez la position de l'autre en une phrase juste avant de défendre la vôtre.", "Séparez explicitement les faits des interprétations lors de votre prochaine friction."] },
    ],
    communication_influence: [
      { id: "negociation", nom: "Négociation", def: "Construire des accords où chacun gagne quelque chose, en préparant ses positions et ses concessions.", defis: ["Avant votre prochaine négociation, écrivez votre idéal, votre acceptable et votre plancher.", "Demandez cette semaine quelque chose que vous n'osiez pas demander, en le justifiant par la valeur.", "À la prochaine objection de prix ou de délai, posez une question avant de concéder quoi que ce soit."] },
      { id: "prise_parole", nom: "Prise de parole publique", def: "Tenir un auditoire, du point d'équipe à la plénière, avec un message structuré et incarné.", defis: ["Ouvrez votre prochaine intervention par une question ou un chiffre, jamais par du contexte.", "Répétez à voix haute les soixante premières secondes de votre prochaine présentation.", "En réunion cette semaine, prenez la parole dans les cinq premières minutes."] },
    ],
    developpement_autres: [
      { id: "feedback", nom: "Feedback", def: "Donner des retours précis, factuels et réguliers, qui font progresser sans blesser.", defis: ["Donnez aujourd'hui un feedback positif précis, un fait, un impact, en moins de trente secondes.", "Sur le prochain point à corriger, décrivez le fait observé avant tout jugement.", "Demandez un feedback sur vous-même à une personne de votre choix cette semaine."] },
      { id: "delegation", nom: "Délégation responsabilisante", def: "Confier des missions entières avec le pourquoi, le cadre et le droit à l'erreur, puis tenir la distance.", defis: ["Déléguez cette semaine une tâche que vous aimez faire, pas seulement celle qui vous pèse.", "Sur votre prochaine délégation, donnez l'intention et le délai, jamais la méthode.", "Quand on vous rapporte un problème délégué, répondez par : que proposes-tu ?"] },
    ],
    orientation_resultats: [
      { id: "orientation_client", nom: "Orientation client", def: "Garder le client final, interne ou externe, comme juge de paix de la valeur produite.", defis: ["Sur votre livrable du jour, écrivez en une phrase ce que le client y gagne.", "Appelez un client ou utilisateur cette semaine pour lui demander ce qui l'agace le plus.", "À la prochaine décision d'équipe, posez la question : qu'est-ce que le client préférerait ?"] },
      { id: "sens_urgence", nom: "Sens de l'urgence", def: "Distinguer ce qui doit être fait maintenant de ce qui peut attendre, et agir en conséquence.", defis: ["Ce matin, identifiez l'action qui perd de la valeur chaque heure et faites-la en premier.", "Répondez aujourd'hui même au message que vous repoussez depuis trois jours.", "Fixez un délai à la prochaine demande floue : pour quand en avez-vous vraiment besoin ?"] },
    ],
    prise_decision: [
      { id: "arbitrage_incertitude", nom: "Arbitrage sous incertitude", def: "Décider avec des informations incomplètes, en explicitant les hypothèses et les risques acceptés.", defis: ["Sur votre décision en attente, listez ce que vous savez, ce que vous supposez, puis tranchez.", "Fixez-vous un budget d'information : deux sources, puis décision, pas une de plus.", "Écrivez le pire scénario réaliste de votre prochaine décision et son plan de secours en trois lignes."] },
      { id: "courage_managerial", nom: "Courage managérial", def: "Dire et faire ce qui est juste même quand c'est inconfortable, recadrer, refuser, trancher.", defis: ["Dites non cette semaine à une demande que vous auriez acceptée par confort.", "Abordez en direct le sujet sensible que vous traitez d'habitude par écrit.", "Recadrez un comportement dans les vingt-quatre heures au lieu d'attendre le prochain entretien."] },
    ],
    initiative: [
      { id: "intrapreneuriat", nom: "Intrapreneuriat", def: "Porter une idée comme un projet, avec un test, des alliés et une preuve, sans attendre de mandat.", defis: ["Transformez votre idée du moment en test d'une heure et fixez sa date cette semaine.", "Trouvez un allié pour votre idée et présentez-la lui en cinq minutes chrono.", "Écrivez la preuve minimale qui montrerait que votre idée vaut d'être poussée."] },
      { id: "proactivite_commerciale", nom: "Proactivité commerciale", def: "Créer les opportunités plutôt que les attendre, relancer, proposer, ouvrir des portes.", defis: ["Relancez aujourd'hui trois contacts silencieux avec un message personnalisé chacun.", "Proposez à un client existant une idée qui l'aide, sans rien vendre cette fois.", "Bloquez trente minutes de prospection ou de réseau demain matin, avant les mails."] },
    ],
    resilience: [
      { id: "gestion_stress", nom: "Gestion du stress", def: "Réguler sa pression au quotidien, par l'hygiène, les pauses et la mise à distance des pensées.", defis: ["Installez aujourd'hui une pause de cinq minutes sans écran entre deux réunions.", "Au prochain pic de stress, écrivez la pensée qui tourne, puis sa version factuelle.", "Verrouillez cette semaine une heure de récupération non négociable dans l'agenda."] },
      { id: "rebond", nom: "Rebond après échec", def: "Transformer vite un raté en apprentissage et en action suivante, sans rumination ni déni.", defis: ["Sur votre dernier raté, écrivez en trois lignes : le fait, la leçon, la prochaine action.", "Racontez un échec récent à un pair et demandez-lui ce qu'il aurait fait.", "Dans les vingt-quatre heures après un refus, relancez une action du même type."] },
    ],
    organisation: [
      { id: "gestion_priorites", nom: "Gestion des priorités", def: "Choisir consciemment ce qui passe devant, par l'impact, et assumer ce qui attend.", defis: ["Chaque matin cette semaine, écrivez vos trois priorités et barrez tout le reste.", "Identifiez la tâche que vous faites par habitude et qui ne produit plus rien : supprimez-la.", "Avant d'accepter une nouvelle demande aujourd'hui, nommez ce qu'elle fera glisser."] },
      { id: "conduite_projet", nom: "Conduite de projet", def: "Faire aboutir un projet multi-acteurs, jalons, responsabilités et suivi visibles pour tous.", defis: ["Sur votre projet en cours, écrivez les trois prochains jalons datés et partagez-les.", "Clarifiez aujourd'hui qui décide quoi sur votre projet, en une ligne par personne.", "Installez un point de quinze minutes hebdomadaire avec un ordre du jour en trois questions."] },
    ],
    rigueur: [
      { id: "qualite_livrable", nom: "Qualité du livrable", def: "Livrer propre du premier coup, orthographe, chiffres, formes, les détails qui font la confiance.", defis: ["Relisez votre prochain envoi important à voix basse avant de cliquer.", "Créez la check-list en cinq points de votre livrable récurrent et appliquez-la dès demain.", "Faites vérifier un chiffre clé par une seconde paire d'yeux avant votre prochaine diffusion."] },
      { id: "conformite", nom: "Conformité", def: "Respecter les règles, procédures et engagements contractuels sans les vivre comme des ennemis.", defis: ["Identifiez la règle que vous contournez le plus et comprenez cette semaine pourquoi elle existe.", "Sur votre prochain dossier, vérifiez le point de conformité qui ne pardonne pas avant tout le reste.", "Signalez proprement une procédure inadaptée plutôt que de la contourner en silence."] },
    ],
    fiabilite_suivi: [
      { id: "tenue_engagements", nom: "Tenue des engagements", def: "Faire de sa parole une monnaie fiable, promettre juste, livrer à l'heure, prévenir tôt.", defis: ["Aujourd'hui, ne promettez que ce que vous pouvez tenir et notez chaque engagement pris.", "Au premier doute sur un délai, prévenez immédiatement avec une nouvelle date ferme.", "Soldez ce vendredi vos engagements ouverts : fait, renégocié ou abandonné explicitement."] },
      { id: "suivi_client", nom: "Suivi client", def: "Tenir le fil après la vente ou la livraison, nouvelles régulières, relances propres, mémoire des dossiers.", defis: ["Envoyez aujourd'hui des nouvelles à un client sans rien lui demander.", "Notez après chaque échange client les deux informations à retenir pour la prochaine fois.", "Programmez la relance au moment où vous raccrochez, jamais plus tard."] },
    ],
    analyse: [
      { id: "esprit_critique", nom: "Esprit critique", def: "Interroger les évidences, les chiffres et les siennes propres, avant de conclure.", defis: ["Sur la prochaine affirmation entendue en réunion, demandez : qu'est-ce qui nous le prouve ?", "Cherchez activement un fait qui contredit votre hypothèse du moment.", "Sur un chiffre clé reçu cette semaine, remontez à sa source avant de le rediffuser."] },
      { id: "culture_donnee", nom: "Culture de la donnée", def: "Faire parler les données disponibles, les lire, les croiser, les mettre en forme utile.", defis: ["Remplacez une opinion par une mesure dans votre prochain arbitrage.", "Construisez cette semaine un mini-tableau de trois indicateurs qui comptent pour votre activité.", "Avant votre prochaine réunion, préparez le chiffre qui répond à la question qui fâche."] },
    ],
    vision_strategique: [
      { id: "sens_business", nom: "Sens du business", def: "Relier chaque décision à l'économie réelle, revenus, coûts, marges, valeur client.", defis: ["Sur votre action du jour, écrivez ce qu'elle rapporte ou économise, même approximativement.", "Demandez cette semaine à quelqu'un de la finance ce qui pèse vraiment dans le résultat.", "Au prochain choix d'équipe, posez la question : combien ça coûte, combien ça rapporte ?"] },
      { id: "anticipation_risques", nom: "Anticipation des risques", def: "Voir venir ce qui peut dérailler et préparer les parades avant d'en avoir besoin.", defis: ["Sur votre projet en cours, listez les trois risques majeurs et une parade par risque.", "Posez à votre équipe la question : qu'est-ce qui pourrait nous surprendre le mois prochain ?", "Préparez le plan B de votre prochain jalon critique avant qu'on vous le demande."] },
    ],
    creativite: [
      { id: "resolution_creative", nom: "Résolution créative", def: "Sortir des impasses par des angles inhabituels, analogies, inversions, contraintes fécondes.", defis: ["Sur le blocage du moment, demandez-vous : comment un autre métier le résoudrait-il ?", "Inversez le problème aujourd'hui : comment garantir l'échec ? Puis faites le contraire.", "Générez dix idées en dix minutes sur votre irritant, sans en juger aucune avant la fin."] },
      { id: "amelioration_continue", nom: "Amélioration continue", def: "Traquer les petits progrès systématiques, chaque semaine un irritant en moins, un geste en mieux.", defis: ["Supprimez cette semaine une étape inutile d'un processus que vous subissez.", "Après votre prochaine livraison, notez une chose à faire mieux la prochaine fois, une seule.", "Chronométrez une tâche récurrente et gagnez dix pour cent dessus d'ici vendredi."] },
    ],
    adaptabilite: [
      { id: "conduite_changement", nom: "Conduite du changement", def: "Aider un collectif à traverser un changement, sens, rythme, écoute des résistances.", defis: ["Sur le changement en cours, écrivez le pourquoi en deux phrases dites du point de vue de l'équipe.", "Allez écouter trente minutes la personne la plus réticente, sans argumenter.", "Célébrez publiquement cette semaine un premier pas réussi dans le nouveau monde."] },
      { id: "agilite_interculturelle", nom: "Agilité interculturelle", def: "Ajuster ses codes à des cultures d'entreprise, de métier ou de pays différents.", defis: ["Avant votre prochain échange avec une autre culture, renseignez-vous sur un code qui compte pour elle.", "Adaptez consciemment votre style à deux interlocuteurs très différents aujourd'hui et notez l'effet.", "Demandez à un interlocuteur d'une autre culture ce qui le surprend dans vos façons de faire."] },
    ],
    apprentissage: [
      { id: "veille_metier", nom: "Veille métier", def: "Rester à jour sur son domaine, sources choisies, rythme tenu, tri de l'utile.", defis: ["Choisissez deux sources de veille et bloquez vingt minutes hebdomadaires pour elles.", "Partagez à l'équipe cette semaine une trouvaille de veille en trois phrases.", "Désabonnez-vous aujourd'hui d'une source que vous ne lisez plus."] },
      { id: "apprendre_apprendre", nom: "Apprendre à apprendre", def: "Maîtriser sa propre méthode d'acquisition, objectifs, pratique espacée, restitution.", defis: ["Sur votre sujet du mois, fixez un objectif d'apprentissage vérifiable en une phrase.", "Expliquez à quelqu'un ce que vous venez d'apprendre : si vous butez, réapprenez ce point.", "Programmez trois rappels espacés, à trois jours, une semaine, un mois, sur votre dernier apprentissage."] },
    ],
  };

    window.Competences = { REFERENTIEL, POSTES, scorer, prioriser, collectif, matcherCompetence, expressionDepuis, NOTICE, COULEURS_FAMILLES, COULEURS_FAMILLES_LISTE, SEUILS, zoneDe, cibleDe, fitPoste, DIMS_VERS_COMPETENCES, CODEX, PALIERS_NOMS, palierDe, BOOST_PROJECTION, projeterComps, FACETTES };
})();
