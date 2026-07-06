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
    return REFERENTIEL.map((comp) => {
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
      let zone = 'neutre';
      if (potentiel <= 40) zone = 'economie';
      else if (potentiel >= 62 && expression >= 58) zone = 'appui';
      else if (potentiel >= 60 && (potentiel - expression >= 8 || expression < 55)) zone = 'opportunite';
      return { id: comp.id, nom: comp.nom, famille: comp.famille, potentiel, expression, zone };
    });
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

  window.Competences = { REFERENTIEL, POSTES, scorer, prioriser, collectif, matcherCompetence, expressionDepuis, NOTICE, COULEURS_FAMILLES, COULEURS_FAMILLES_LISTE };
})();
