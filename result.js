// ============================================================
// MODULE RESULT — Restitution premium COMPLÈTE
// 3 blocs + questions ouvertes + validation + 5 moments IA
// ============================================================
const Result = (() => {
  const FAM = { RELATION:'#F98272', ACTION:'#F5A623', STRUCTURE:'#3EADFF', VISION:'#5E59C7' };
  const BF_INFO = {
    E:['Extraversion','Réservé','Expansif'], A:['Agréabilité','Affirmé','Conciliant'],
    C:['Conscience','Spontané','Méthodique'], N:['Stabilité','Sensible','Imperturbable'],
    O:['Ouverture','Pragmatique','Inventif']
  };
  // Lecture en clair de chaque dimension selon la zone du score
  const BF_ZONES = {
    E: { low: "Vous puisez votre énergie dans le calme et les échanges choisis : la profondeur plutôt que le volume.", mid: "Vous alternez avec aisance entre moments d'échange et temps pour vous.", high: "Le contact des autres vous dynamise : vous pensez et avancez en interagissant." },
    A: { low: "Vous dites les choses et défendez votre position : la franchise prime sur la diplomatie.", mid: "Vous savez être direct quand il le faut et conciliant quand c'est utile.", high: "Vous privilégiez l'harmonie et la coopération : le lien passe avant le rapport de force." },
    C: { low: "Vous fonctionnez à l'élan et à la souplesse, en ajustant au fil de l'eau.", mid: "Vous structurez quand l'enjeu le demande, avec une vraie souplesse le reste du temps.", high: "Organisation, fiabilité, suivi : vous menez les choses au bout, avec méthode." },
    N: { low: "Vous ressentez fort : cette sensibilité est un radar précieux, à ménager sous pression.", mid: "Vous encaissez la plupart des secousses tout en restant à l'écoute de vos signaux.", high: "Peu de choses vous ébranlent : vous gardez un calme rare, même dans la tempête." },
    O: { low: "Vous préférez l'éprouvé et le concret : ce qui marche vous intéresse plus que ce qui brille.", mid: "Curieux sans être dispersé : vous explorez le neuf quand il a du sens.", high: "Les idées, l'inédit et l'imaginaire vous attirent : vous explorez naturellement." },
  };
  const POLE_TIPS = {
    'Réservé':"Énergie tournée vers l'intérieur : réflexion, calme, petits comités", 'Expansif':"Énergie tournée vers les autres : échange, spontanéité, dynamisme",
    'Affirmé':"Direct et franc : dit les choses, défend sa position", 'Conciliant':"Coopératif et chaleureux : cherche l'harmonie et l'accord",
    'Spontané':"Souple et réactif : avance à l'élan, s'adapte en chemin", 'Méthodique':"Organisé et fiable : planifie, suit, termine",
    'Sensible':"Ressent intensément : capte les signaux et les tensions", 'Imperturbable':"Stable émotionnellement : garde son calme sous pression",
    'Pragmatique':"Ancré dans le concret : privilégie ce qui a fait ses preuves", 'Inventif':"Attiré par le neuf : idées, imagination, exploration",
  };
  const validations = {};
  const openAnswers = {};
  const selectedActions = new Set();
  let RES = null;

  function dataSlug(nom){ return SINEA_DATA.slugs[nom]; }
  function img(nom){ const s=SINEA_DATA.images[nom]; return s?`${s}.webp`:''; }

  // Visuel : matrice SWOT (forces, vigilances, leviers, frictions)
  function matriceSwot(res){
    const dc = contenu(res.dominante.nom) || {};
    const li = arr => (arr || []).map(x => `<li>${x}</li>`).join('');
    const forces = dc.forces || [];
    const vig = dc.vigilance || [];
    const leviers = dc.leviers || [];
    const compl = dc.complementarites || {};
    // frictions : à partir des frictions relationnelles
    const frictions = [];
    if (compl.pourquoi_friction) frictions.push(compl.pourquoi_friction);
    if (compl.friction && compl.friction.length) frictions.push(`Vigilance avec les profils comme ${compl.friction.join(', ')}.`);
    if (!forces.length && !vig.length) return '';
    return `
      <div class="swot-grid">
        <div class="swot-cell swot-f">
          <div class="swot-titre">Vos forces</div>
          <div class="swot-sous">ce qui vient de vous</div>
          <ul>${li(forces)}</ul>
        </div>
        <div class="swot-cell swot-v">
          <div class="swot-titre">Vos vigilances</div>
          <div class="swot-sous">ce qui vient de vous</div>
          <ul>${li(vig)}</ul>
        </div>
        <div class="swot-cell swot-l">
          <div class="swot-titre">Vos leviers</div>
          <div class="swot-sous">à activer</div>
          <ul>${li(leviers)}</ul>
        </div>
        <div class="swot-cell swot-r">
          <div class="swot-titre">Vos frictions</div>
          <div class="swot-sous">à anticiper</div>
          <ul>${li(frictions)}</ul>
        </div>
      </div>`;
  }

  // Visuel : naturel vs adapté (coût d'adaptation par dimension)
  function carteNaturelAdapte(res){
    const na = res.naturelAdapte;
    if (!na || !na.adapte || !Object.keys(na.adapte).length) return '';
    const lignes = ['E','A','C','N','O'].filter(d => na.adapte[d] !== undefined).map(d => {
      const [name, low, high] = BF_INFO[d];
      // pour N on inverse l'affichage (cohérent avec les jauges : N affiché en "stabilité")
      const nat = d === 'N' ? 100 - na.naturel[d] : na.naturel[d];
      const adp = d === 'N' ? 100 - na.adapte[d] : na.adapte[d];
      const ecart = Math.abs(adp - nat);
      const fort = ecart >= 25;
      return `
        <div class="na-row">
          <div class="na-top"><span class="na-name">${name}</span>${fort ? '<span class="na-flag">effort notable</span>' : ''}</div>
          <div class="na-track">
            <div class="na-link" style="left:${Math.min(nat,adp)}%;width:${ecart}%"></div>
            <div class="na-dot na-nat" style="left:${nat}%" title="Naturel"></div>
            <div class="na-dot na-adp" style="left:${adp}%" title="Au travail"></div>
          </div>
        </div>`;
    }).join('');
    const coutTxt = { 'faible':'faible', 'modéré':'modéré', 'élevé':'élevé' }[na.cout] || 'modéré';
    return `
      <div class="na-card">
        <div class="na-legend">
          <span><span class="na-leg-dot na-nat"></span>Votre naturel</span>
          <span><span class="na-leg-dot na-adp"></span>Au travail</span>
        </div>
        ${lignes}
        <div class="na-cout">Coût d'adaptation global : <strong>${coutTxt}</strong></div>
        ${pepite(FAITS_COUT[na.cout] || FAITS_COUT['modéré'], 'pepite-energie')}
      </div>`;
  }

  // Libellés des styles et dimensions spé
  const STYLE_LABELS = {
    visionnaire:'Visionnaire', chef_de_file:'Chef de file', democratique:'Démocratique',
    directif:'Directif', coaching:'Coaching', affiliatif:'Affiliatif',
    challenger:'Challenger', relationnel:'Relationnel', battant:'Battant', solitaire:'Indépendant', resolveur:'Résolveur'
  };
  const SPE_DIM_LABELS = {
    delegation:{ titre:'Votre délégation', profils:{ controle:'Contrôle', cadre:'Cadre clair', autonomie:'Autonomie', lacher_prise:'Lâcher-prise' } },
    feedback:{ titre:'Votre feedback', profils:{ direct:'Direct', factuel:'Factuel', enveloppe:'Enveloppé', questionnant:'Questionnant' } },
    exigence_bienveillance:{ titre:'Exigence et bienveillance', profils:{ exigence:'Exigeant', equilibre:'Équilibré', bienveillance:'Bienveillant' } },
    closing:{ titre:'Votre closing', profils:{ pousseur:'Pousseur', guide:'Guide', patient:'Patient', facilitateur:'Facilitateur' } },
    objection:{ titre:'Face à l\'objection', profils:{ frontal:'Frontal', recadrage:'Recadrage', contournement:'Contournement', ecoute:'Écoute' } },
    chasseur_eleveur:{ titre:'Chasseur ou éleveur', profils:{ chasseur:'Chasseur', mixte:'Mixte', eleveur:'Éleveur' } }
  };
  // Description courte de CHAQUE position : toujours affichée sous les pastilles,
  // et utilisée en repli quand l'analyse IA de la dimension est absente du contenu figé.
  const SPE_DIM_DESC = {
    delegation:{
      controle:"Vous gardez la main sur l'exécution et vérifiez les détails qui comptent. Cette présence rassure sur la qualité, et votre progression passe par des zones de confiance déléguées explicitement.",
      cadre:"Vous déléguez volontiers à l'intérieur d'un cadre clair : objectif, jalons, points de contrôle. Vos équipes savent où elles vont et ce qui leur appartient.",
      autonomie:"Vous confiez des missions entières et laissez vos collaborateurs choisir leur chemin. Cette confiance fait grandir, et elle gagne à s'accompagner de points de synchronisation réguliers.",
      lacher_prise:"Vous déléguez en profondeur, résultats compris, et intervenez à la demande. Ce lâcher-prise libère les profils matures et demande un cadre minimal pour sécuriser les plus juniors."
    },
    feedback:{
      direct:"Vous dites les choses vite et sans détour. Cette franchise fait gagner du temps à tout le monde, et elle porte d'autant mieux qu'elle s'ouvre sur une question.",
      factuel:"Vous appuyez vos retours sur des faits observables et des exemples datés. Cette objectivité rend votre feedback solide et facile à recevoir.",
      enveloppe:"Vous soignez la forme autant que le fond : le moment, le ton, l'angle. Vos retours préservent la relation et gagnent à rester précis sur l'attendu.",
      questionnant:"Vous faites émerger le constat par vos questions plutôt que de l'asséner. Cette approche responsabilise, et un message clair en conclusion ancre le changement."
    },
    exigence_bienveillance:{
      exigence:"Votre curseur penche vers l'exigence : la barre est haute et visible. Cela tire l'équipe vers le haut, et la reconnaissance explicite des efforts entretient l'élan.",
      equilibre:"Vous tenez les deux : un niveau d'attente élevé et une vraie attention aux personnes. Cet équilibre crée une sécurité exigeante où l'on ose et où l'on progresse.",
      bienveillance:"Votre curseur penche vers la bienveillance : la relation et la confiance d'abord. Ce climat fait parler vrai, et des attendus chiffrés protègent votre niveau d'exigence."
    },
    closing:{
      pousseur:"Vous créez l'élan final : vous posez la question qui engage et assumez la tension du moment. Redoutable sur les cycles courts, ce style gagne à laisser respirer les décideurs prudents.",
      guide:"Vous amenez la signature par étapes : chaque oui intermédiaire prépare le suivant. Le client se sent accompagné, et votre rythme sécurise les ventes engageantes.",
      patient:"Vous laissez la décision mûrir et concluez quand le client est prêt. Cette patience fidélise, et un jalon daté posé tôt protège vos cycles de l'enlisement.",
      facilitateur:"Vous levez les obstacles un à un jusqu'à rendre la décision évidente. Le client signe parce que tout est fluide : votre force tient dans la préparation du terrain."
    },
    objection:{
      frontal:"Vous prenez l'objection de face et y répondez pied à pied. Cette assurance rassure les profils directs, et une reformulation préalable montre que vous avez vraiment entendu.",
      recadrage:"Vous replacez l'objection dans le tableau d'ensemble : l'enjeu global relativise le point de friction. Vous transformez un blocage en arbitrage favorable.",
      contournement:"Vous évitez l'affrontement et revenez sur le sujet sous un autre angle, au bon moment. Cette souplesse préserve la relation et gagne à toujours traiter le fond.",
      ecoute:"Vous creusez l'objection avant d'y répondre : derrière la première phrase se cache souvent la vraie réserve. Cette écoute désamorce et nourrit votre proposition."
    },
    chasseur_eleveur:{
      chasseur:"Votre énergie va à la conquête : ouvrir des portes, créer des opportunités, signer de nouveaux comptes. Le neuf vous stimule, et un relais de suivi sécurise la durée.",
      mixte:"Vous alternez conquête et culture de votre portefeuille selon les périodes. Cette polyvalence vous rend précieux, et des plages dédiées à chaque mode protègent votre efficacité.",
      eleveur:"Votre force est dans la durée : développer vos comptes, approfondir la confiance, faire grandir le chiffre existant. La régularité de votre présence devient votre meilleur argument."
    }
  };
  // Tous les styles d'un référentiel (pour situer le dominant)
  const STYLES_PAR_TYPE = {
    manager:['visionnaire','chef_de_file','democratique','directif','coaching','affiliatif'],
    commercial:['challenger','relationnel','battant','solitaire','resolveur']
  };

  function carteStyle(res){
    const type = res.diagType;
    const dom = res.speStyle;
    if (!dom || !STYLES_PAR_TYPE[type]) return '';
    const pastilles = STYLES_PAR_TYPE[type].map(st =>
      `<span class="dimc-opt ${st === dom ? 'dimc-sel' : ''}">${STYLE_LABELS[st] || st}</span>`
    ).join('');
    const titre = type === 'manager' ? 'Votre style de leadership dominant' : 'Votre style de vente dominant';
    return `<div class="dimc-card"><div class="dimc-row"><div class="dimc-titre">${titre}</div><div class="dimc-opts">${pastilles}</div></div></div>`;
  }

  // Le plan de progression métier affiché, transmis ensuite aux défis SeedUp
  let planSpeCourant = null;

  // ---- Le pari sur soi : la personne se positionne d'instinct avant la révélation ----
  let parisSpe = {};
  function chargerParis(diagType){
    try { parisSpe = JSON.parse(localStorage.getItem('sinea_paris_' + diagType) || '{}') || {}; }
    catch(e){ parisSpe = {}; }
  }
  function parierDim(axe, valeur){
    parisSpe[axe] = valeur;
    try { localStorage.setItem('sinea_paris_' + ((RES && RES.diagType) || 'spe'), JSON.stringify(parisSpe)); } catch(e){}
    const zone = document.getElementById('dimc-zone');
    if (zone && RES) zone.innerHTML = carteDimensionsSpe(RES);
    sauvegarderInteractions();
  }

  function carteDimensionsSpe(res){
    const dims = res.speDims || {};
    if (!Object.keys(dims).length) return '';
    const ordre = res.diagType === 'manager'
      ? ['delegation','feedback','exigence_bienveillance']
      : ['closing','objection','chasseur_eleveur'];
    const blocs = ordre.filter(d => dims[d] && SPE_DIM_LABELS[d]).map(d => {
      const conf = SPE_DIM_LABELS[d];
      const choisi = dims[d];
      const pari = parisSpe[d];
      // État 1 · le pari : la personne se positionne d'instinct, la mesure reste cachée
      if (!pari){
        const boutons = Object.entries(conf.profils).map(([key, label]) =>
          `<button type="button" class="dimc-opt dimc-opt-btn" onclick="Result.parierDim('${d}','${key}')">${label}</button>`
        ).join('');
        return `<div class="dimc-row"><div class="dimc-titre">${conf.titre}</div><p class="dimc-question">D'instinct, vous vous voyez plutôt...</p><div class="dimc-opts">${boutons}</div><button type="button" class="dimc-skip" onclick="Result.parierDim('${d}','_skip')">Voir ma mesure directement</button></div>`;
      }
      // État 2 · la révélation : la mesure s'affiche, l'intuition reste visible si elle diverge
      const pastilles = Object.entries(conf.profils).map(([key, label]) => {
        const cls = key === choisi ? ' dimc-sel' : (key === pari ? ' dimc-pari' : '');
        return `<span class="dimc-opt${cls}">${label}</span>`;
      }).join('');
      let verdict = '';
      if (pari !== '_skip'){
        verdict = pari === choisi
          ? `<p class="dimc-verdict dimc-accord">Votre intuition rejoint la mesure : belle lucidité sur vous-même.</p>`
          : `<p class="dimc-verdict">Votre intuition disait ${conf.profils[pari] || ''}. La mesure vous situe ${conf.profils[choisi] || ''} : un écart précieux à explorer.</p>`;
      }
      const desc = (SPE_DIM_DESC[d] || {})[choisi] || '';
      return `<div class="dimc-row"><div class="dimc-titre">${conf.titre}</div><div class="dimc-opts">${pastilles}</div>${verdict}${desc ? `<p class="dimc-desc">${desc}</p>` : ''}</div>`;
    }).join('');
    return blocs ? `<div class="dimc-card">${blocs}</div>` : '';
  }

  // Visuel : carte des dimensions profondes (profil dominant mis en évidence parmi 4)
  const DIM_LABELS = {
    stress: { titre: 'Face au stress', profils: { accelerateur:'Accélérateur', methodique:'Méthodique', retrait:'En retrait', appui:'Cherche appui' } },
    motivation: { titre: 'Ce qui vous motive', profils: { accomplissement:'Accomplissement', reconnaissance:'Reconnaissance', sens:'Quête de sens', maitrise:'Maîtrise' } },
    risque: { titre: 'Face au risque', profils: { audacieux:'Audacieux', calcule:'Calculé', prudent:'Prudent', securitaire:'Sécuritaire' } },
    changement: { titre: 'Face au changement', profils: { moteur:'Moteur', adaptable:'Adaptable', pragmatique:'Pragmatique', ancre:'Ancré' } },
    conflit: { titre: 'Face au conflit', profils: { affrontement:'Direct', mediation:'Médiateur', compromis:'Compromis', evitement:'Évitant' } }
  };
  // Les 4 dimensions de pilotage (ancrées SDT / modèle SMART)
  const DIM_PLUS_LABELS = {
    energie: { titre: 'Énergie & rythme', modele: 'Modèle SMART', profils: { sprinteur:'Sprinteur', endurant:'Endurant', cyclique:'Cyclique', deepworker:'Deep-worker' } },
    collaboration: { titre: 'Collaboration', modele: 'Modèle SMART', profils: { autonome:'Autonome', cooperatif:'Coopératif', interdependant:'Interdépendant', federateur:'Fédérateur' } },
    autorite: { titre: 'Rapport au cadre', modele: 'Self-Determination Theory', profils: { cadre:'Besoin de cadre', sens:'Besoin de sens', liberte:'Besoin de liberté', contributeur:'Contributeur' } },
    reconnaissance: { titre: 'Reconnaissance', modele: 'Self-Determination Theory', profils: { resultats:'Résultats', effort:'Effort', relation:'Relation', autonomie:'Autonomie' } }
  };
  // Textes de repli (par règles) si l'IA est indisponible pour les dimensions de pilotage
  const DIM_PLUS_FALLBACK = {
    energie: { sprinteur:"Votre énergie fonctionne par pics. Vous donnez le meilleur sur des séquences courtes et intenses, puis vous avez besoin de relâcher pour recharger. Protégez de vrais temps de récupération après vos sprints.", endurant:"Votre énergie est régulière et fiable. Vous tenez un effort constant dans la durée, ce qui fait de vous un point d'appui sur les projets longs. Votre rythme est une force, pas un retard.", cyclique:"Votre énergie alterne phases intenses et phases de récupération. Bien gérée, cette alternance vous protège de l'épuisement tout en délivrant de forts moments. Expliquez ce fonctionnement à votre entourage.", deepworker:"Vous performez dans la concentration longue et ininterrompue. Le morcellement est votre principal ennemi. Protégez vos plages de concentration comme une ressource précieuse." },
    collaboration: { autonome:"Vous donnez le meilleur en pilotant votre périmètre de façon indépendante. La clarté de votre responsabilité est votre carburant. Maintenez des points de synchronisation pour rester connecté au collectif.", cooperatif:"Vous avancez mieux dans l'échange et le faire-ensemble. Cette ouverture est un liant pour l'équipe. Préservez aussi des temps de production individuelle.", interdependant:"Vous articulez naturellement votre travail avec celui des autres. Cette vision systémique fluidifie les projets transverses et évite les silos.", federateur:"Vous tirez votre énergie de l'animation du collectif. Ce rôle moteur est précieux pour la dynamique d'équipe. Laissez de la place aux autres pour contribuer." },
    autorite: { cadre:"Vous avancez mieux avec des règles et des attentes claires. Cette structure est un repère qui vous libère. Quand le cadre manque, demandez-le explicitement.", sens:"Vous adhérez quand la direction est justifiée et porteuse de sens. Comprendre le pourquoi transforme une consigne en engagement. Face à une décision imposée, demandez le sens plutôt que de vous résigner.", liberte:"Vous donnez le meilleur avec une large marge de manœuvre. La confiance et l'autonomie sont vos carburants. Donnez de la visibilité à votre manager pour que votre liberté repose sur la confiance.", contributeur:"Vous cherchez à influencer les décisions, pas seulement à les suivre. Être associé à ce qui vous concerne est essentiel à votre engagement. Choisissez vos combats pour renforcer votre voix." },
    reconnaissance: { resultats:"Vous avez besoin que vos résultats soient vus et nommés. Pour rester engagé, vos réussites doivent être explicitement soulignées.", effort:"Vous avez besoin que l'investissement, et pas seulement le résultat, soit reconnu. Un manager attentif au chemin parcouru nourrit votre engagement.", relation:"Vous vous nourrissez de la qualité du lien et de la considération. Une attention sincère vaut pour vous plus qu'une récompense formelle.", autonomie:"Pour vous, la plus belle reconnaissance est la confiance qu'on vous accorde : plus d'autonomie, plus de responsabilités." }
  };
  function carteDimensionsPlus(res){
    const ctx = res.contextuelPlus || {};
    if (!Object.keys(ctx).length) return '';
    const ordre = ['energie','collaboration','autorite','reconnaissance'];
    const blocs = ordre.filter(d => ctx[d] && DIM_PLUS_LABELS[d]).map(d => {
      const conf = DIM_PLUS_LABELS[d];
      const choisi = ctx[d];
      const defs = (((SINEA_DATA.contextuelles_plus || {}).dimensions || {})[d] || {}).description_profils || {};
      const pastilles = Object.entries(conf.profils).map(([key, label]) => {
        const tip = (defs[key] || '').replace(/"/g, '&quot;');
        return `<span class="dimc-opt ${key === choisi ? 'dimc-sel' : ''}"${tip ? ` data-tip="${tip}"` : ''}>${label}</span>`;
      }).join('');
      return `
        <div class="dimc-row">
          <div class="dimc-titre">${conf.titre} <span class="dimc-modele">${conf.modele}</span></div>
          <div class="dimc-opts">${pastilles}</div>
        </div>`;
    }).join('');
    return blocs ? `<div class="dimc-card">${blocs}</div>` : '';
  }
  // Badge de fiabilité du profil (cohérence des réponses)
  function badgeFiabilite(res){
    const f = res.fiabilite;
    if (!f || f.score === undefined) return '';
    const couleur = f.score >= 85 ? '#3EAD8B' : (f.score >= 70 ? '#F9A876' : '#F98272');
    return `
      <div class="r-fiab" style="border-color:${couleur}40;background:${couleur}0d">
        <div class="r-fiab-txt"><div class="r-fiab-lab">Fiabilité de votre profil</div><div class="r-fiab-msg">${f.message || ''}</div></div>
        <div class="r-fiab-score" style="color:${couleur}">${f.score}%</div>
      </div>`;
  }
  function carteDimensions(res){
    const ctx = res.contextuel || {};
    if (!Object.keys(ctx).length) return '';
    const ordre = ['stress','motivation','risque','changement','conflit'];
    const blocs = ordre.filter(d => ctx[d] && DIM_LABELS[d]).map(d => {
      const conf = DIM_LABELS[d];
      const choisi = ctx[d];
      const defs = (((SINEA_DATA.contextuelles || {}).dimensions || {})[d] || {}).description_profils || {};
      const pastilles = Object.entries(conf.profils).map(([key, label]) => {
        const tip = (defs[key] || '').replace(/"/g, '&quot;');
        return `<span class="dimc-opt ${key === choisi ? 'dimc-sel' : ''}"${tip ? ` data-tip="${tip}"` : ''}>${label}</span>`;
      }).join('');
      return `
        <div class="dimc-row">
          <div class="dimc-titre">${conf.titre}</div>
          <div class="dimc-opts">${pastilles}</div>
        </div>`;
    }).join('');
    return blocs ? `<div class="dimc-card">${blocs}</div>` : '';
  }

  // Visuel : classement complet des 20 archétypes avec barres de score par famille
  function classementComplet(res){
    const cl = res.classement || [];
    if (!cl.length) return '';
    const scoreMax = cl[0].score || 1;
    const scoreMin = cl[cl.length - 1].score || 0;
    const amplitude = (scoreMax - scoreMin) || 1;
    const lignes = cl.map((item, i) => {
      const color = FAM[item.famille] || '#999';
      // largeur relative : du plus fort (100%) au plus faible (~22%)
      const pct = 22 + ((item.score - scoreMin) / amplitude) * 78;
      const isTop = i < 3;
      const rang = i + 1;
      return `
        <div class="rk-row ${isTop ? 'rk-top' : ''}">
          <div class="rk-rang">${rang}</div>
          <div class="rk-body">
            <div class="rk-nom">${item.nom}</div>
            <div class="rk-bar-track"><div class="rk-bar-fill" style="width:${pct}%;background:${color}"></div></div>
          </div>
        </div>`;
    }).join('');
    return `<div class="rk-list">${lignes}</div>`;
  }
  function contenu(nom){ const s=dataSlug(nom); return (SINEA_DATA.contenu&&SINEA_DATA.contenu[s])||{}; }
  function rarete(nom){ const s=dataSlug(nom); return (SINEA_DATA.rarete&&SINEA_DATA.rarete[s])||{pct:'',niveau:''}; }
  // Rareté de la COMBINAISON dominant + secondaire (plus marquante que le dominant seul)
  function rareteCombinee(res){
    const dom = res.dominante;
    const sec = (res.secondaires && res.secondaires[0]) ? res.secondaires[0] : null;
    const rd = rarete(dom.nom);
    const surNDom = (rd && rd.pct) ? Math.max(2, Math.round(100 / rd.pct)) : null;
    if (!sec || !rd.pct) return Object.assign({}, rd, surNDom ? { surN: surNDom, affichage: '1 sur ' + surNDom.toLocaleString('fr-FR') } : {});
    const rs = rarete(sec.nom);
    if (!rs.pct) return Object.assign({}, rd, surNDom ? { surN: surNDom, affichage: '1 sur ' + surNDom.toLocaleString('fr-FR') } : {});
    // probabilité d'avoir cette paire (en %) : produit des deux proportions
    let pctCombi = (rd.pct * rs.pct) / 100;
    if (pctCombi <= 0) pctCombi = 0.01;
    // toujours exprimé en "1 sur N" : plus parlant qu'un pourcentage
    const surN = Math.max(2, Math.round(100 / pctCombi));
    const affichage = '1 sur ' + surN.toLocaleString('fr-FR');
    return { pct: null, affichage, surN, niveau: 'combinaison', combi: true };
  }
  function verbe(nom){ const l=Object.values(SINEA_DATA.personnages||{}); const p=l.find(x=>x.nom===nom); return p?(p.verbe_signature||p.role||p.axe||''):''; }
  function initiale(nom){ return nom.replace(/^(La |Le |L')/,'').charAt(0); }

  function radarSvg(radar, color){
    const fams=['RELATION','ACTION','STRUCTURE','VISION'], labels=['REL','ACT','STR','VIS'];
    const vals=fams.map(f=>radar[f]||0); const cx=120,cy=120,R=72,n=4;
    const ang=i=>(2*Math.PI*i/n)-Math.PI/2; let p='';
    [0.25,0.5,0.75,1].forEach(l=>{ const pts=vals.map((_,i)=>`${cx+Math.cos(ang(i))*R*l},${cy+Math.sin(ang(i))*R*l}`).join(' '); p+=`<polygon points="${pts}" fill="none" stroke="#E4E2DC" stroke-width="1"/>`; });
    vals.forEach((_,i)=>{ p+=`<line x1="${cx}" y1="${cy}" x2="${cx+Math.cos(ang(i))*R}" y2="${cy+Math.sin(ang(i))*R}" stroke="#E4E2DC" stroke-width="1"/>`; });
    const dp=vals.map((v,i)=>`${cx+Math.cos(ang(i))*R*(v/100)},${cy+Math.sin(ang(i))*R*(v/100)}`).join(' ');
    p+=`<polygon points="${dp}" fill="${color}33" stroke="${color}" stroke-width="2.5"/>`;
    vals.forEach((v,i)=>{ const x=cx+Math.cos(ang(i))*R*(v/100),y=cy+Math.sin(ang(i))*R*(v/100); p+=`<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`; });
    labels.forEach((l,i)=>{ const lr=R+22,x=cx+Math.cos(ang(i))*lr,y=cy+Math.sin(ang(i))*lr; const a=Math.abs(Math.cos(ang(i)))<0.3?'middle':(Math.cos(ang(i))>0?'start':'end'); p+=`<text x="${x}" y="${y+4}" text-anchor="${a}" font-size="11" font-weight="600" font-family="Manrope" fill="#747474">${l}</text>`; });
    return `<svg viewBox="0 0 240 240" width="220" height="220">${p}</svg>`;
  }
  // Radar des styles commerciaux / leadership (n branches selon le référentiel)
  function radarStyleSpe(res, color){
    const type = res.diagType;
    const styles = STYLES_PAR_TYPE[type];
    const scores = res.speStyleScores || {};
    if (!styles || !Object.keys(scores).length) return '';
    const vals = styles.map(s => scores[s] || 0);
    const maxv = Math.max(...vals, 1); // normaliser sur le max
    const cx=140, cy=130, R=82, n=styles.length;
    const ang=i=>(2*Math.PI*i/n)-Math.PI/2; let p='';
    [0.25,0.5,0.75,1].forEach(l=>{ const pts=vals.map((_,i)=>`${cx+Math.cos(ang(i))*R*l},${cy+Math.sin(ang(i))*R*l}`).join(' '); p+=`<polygon points="${pts}" fill="none" stroke="#E4E2DC" stroke-width="1"/>`; });
    vals.forEach((_,i)=>{ p+=`<line x1="${cx}" y1="${cy}" x2="${cx+Math.cos(ang(i))*R}" y2="${cy+Math.sin(ang(i))*R}" stroke="#E4E2DC" stroke-width="1"/>`; });
    const dp=vals.map((v,i)=>`${cx+Math.cos(ang(i))*R*(v/maxv)},${cy+Math.sin(ang(i))*R*(v/maxv)}`).join(' ');
    p+=`<polygon points="${dp}" fill="${color}33" stroke="${color}" stroke-width="2.5"/>`;
    vals.forEach((v,i)=>{ const x=cx+Math.cos(ang(i))*R*(v/maxv),y=cy+Math.sin(ang(i))*R*(v/maxv); p+=`<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`; });
    styles.forEach((st,i)=>{ const lr=R+24,x=cx+Math.cos(ang(i))*lr,y=cy+Math.sin(ang(i))*lr; const a=Math.abs(Math.cos(ang(i)))<0.3?'middle':(Math.cos(ang(i))>0?'start':'end'); p+=`<text x="${x}" y="${y+4}" text-anchor="${a}" font-size="11" font-weight="600" font-family="Manrope" fill="#747474">${STYLE_LABELS[st]||st}</text>`; });
    return `<svg viewBox="-20 0 320 260" width="100%" style="max-width:340px">${p}</svg>`;
  }

  // Petite pépite décalée : un fait surprenant et vrai, glissé pour faire sourire et apprendre.
  function pepite(texte, id){
    if (!texte) return '';
    return `<div class="r-pepite"${id ? ` id="${id}"` : ''}><span class="r-pepite-ico">✦</span><span class="r-pepite-txt">${texte}</span></div>`;
  }
  // Faits liés à la dimension Big Five la plus marquante du profil (pôle haut ou bas).
  const FAITS_BIGFIVE = {
    E: { high: "Le saviez-vous ? Parler en public arrive en tête des peurs humaines, devant la mort elle-même. Les profils expansifs comme vous font figure d'exception.",
         low:  "Le saviez-vous ? Le cerveau d'un introverti montre une activité plus intense face à la nouveauté. Votre quête de calme a une vraie base biologique." },
    A: { high: "Le saviez-vous ? Bâiller est contagieux surtout chez les personnes très empathiques. Votre attention aux autres se lit jusque dans ces petits réflexes.",
         low:  "Le saviez-vous ? Les personnes les plus directes négocient en moyenne de meilleurs salaires. Votre franc-parler est un atout mesurable." },
    C: { high: "Le saviez-vous ? Une étude célèbre montre que les enfants capables d'attendre une guimauve réussissaient mieux plus tard. Votre discipline est de cette trempe.",
         low:  "Le saviez-vous ? Beaucoup de grandes inventions sont nées d'un esprit qui suit ses impulsions. Votre spontanéité est un terrain fertile." },
    N: { high: "Le saviez-vous ? Garder son calme sous stress fait baisser le rythme cardiaque de l'entourage. Votre sang-froid agit littéralement sur les autres.",
         low:  "Le saviez-vous ? Une forte sensibilité émotionnelle va de pair avec une mémoire plus vive des détails. Votre radar intérieur est un don, pas un défaut." },
    O: { high: "Le saviez-vous ? Les cerveaux très ouverts à la nouveauté établissent davantage de connexions inattendues entre les idées. La vôtre carbure à ça.",
         low:  "Le saviez-vous ? S'appuyer sur l'éprouvé est la stratégie qui fait gagner le plus souvent au poker. Votre pragmatisme a ses lettres de noblesse." },
  };
  // Choisit le trait le plus extrême (le plus loin du centre 50) et renvoie le fait adapté.
  function faitBigFive(bf){
    let best = null, ecartMax = -1;
    ['E','A','C','N','O'].forEach(d => {
      const val = d === 'N' ? 100 - bf[d] : bf[d];
      const ecart = Math.abs(val - 50);
      if (ecart > ecartMax) { ecartMax = ecart; best = { d, val }; }
    });
    if (!best || ecartMax < 12) return ''; // profil trop central : pas de pépite forcée
    const f = FAITS_BIGFIVE[best.d];
    return best.val >= 50 ? f.high : f.low;
  }
  // Fait lié au coût d'adaptation (écart entre naturel et comportement au travail).
  const FAITS_COUT = {
    'faible': "Le saviez-vous ? Travailler proche de sa vraie nature réduit la fatigue mentale de fin de journée. Votre énergie vous remercie.",
    'modéré': "Le saviez-vous ? Le cerveau dépense de l'énergie réelle à jouer un rôle, comme un muscle qui force. Votre équilibre reste tout à fait tenable.",
    'élevé':  "Le saviez-vous ? Les acteurs de théâtre récupèrent après une représentation comme après un effort physique. Jouer un rôle au travail coûte vraiment de l'énergie.",
  };

  function spectres(bf){
    // qualificatif selon la position sur l'axe
    const qualif = (v, low, high) => {
      if (v >= 78) return `très ${high.toLowerCase()}`;
      if (v >= 60) return `plutôt ${high.toLowerCase()}`;
      if (v >= 41) return 'équilibré';
      if (v >= 23) return `plutôt ${low.toLowerCase()}`;
      return `très ${low.toLowerCase()}`;
    };
    return ['E','A','C','N','O'].map(d=>{
      const val=d==='N'?100-bf[d]:bf[d]; const [name,low,high]=BF_INFO[d];
      const q = qualif(val, low, high);
      const desc = (BF_ZONES[d] && (val >= 60 ? BF_ZONES[d].high : (val <= 40 ? BF_ZONES[d].low : BF_ZONES[d].mid))) || '';
      return `<div class="spectre-row">
        <div class="spectre-top"><span class="spectre-name">${name}</span><span class="spectre-qualif">${q}</span></div>
        <p class="spectre-desc">${desc}</p>
        <div class="spectre-ends"><span data-tip="${(POLE_TIPS[low]||'').replace(/"/g,'&quot;')}">${low}</span><span data-tip="${(POLE_TIPS[high]||'').replace(/"/g,'&quot;')}">${high}</span></div>
        <div class="spectre-track">
          <div class="spectre-grad"></div>
          <div class="spectre-fill" style="width:${val}%"></div>
          <div class="spectre-dot" style="left:${val}%"></div>
        </div></div>`;
    }).join('');
  }
  function schemaScience(nbRep){
    const n = nbRep || 45;
    return `<div class="sci-flow">
      <div class="sci-box"><div class="sci-n">${n}</div><div class="sci-l">réponses</div></div>
      <div class="sci-ar">→</div>
      <div class="sci-box"><div class="sci-n">5</div><div class="sci-l">dimensions</div></div>
      <div class="sci-ar">→</div>
      <div class="sci-box sci-dark"><div class="sci-n">1+2</div><div class="sci-l">archétypes</div></div>
    </div>`;
  }

  function render(res){
    RES = res;
    const dom=res.dominante, color=FAM[dom.famille];
    const dc=contenu(dom.nom), rar=rareteCombinee(res);
    const roles=['Dominante','Secondaire','Nuance'];

    // ---- Bloc spé (management ou commercial), affiché si le diagnostic en a une ----
    const dt = res.diagType || 'classic';
    if (dt !== 'classic') chargerParis(dt);
    let speBlocHtml = '';
    if (dt === 'manager') {
      speBlocHtml = `
      <div class="r-bloc" id="b-spe">
        <div class="r-bloc-head"><span class="r-bloc-tag">Votre métier</span><h2>Votre management</h2></div>
        <p class="r-bloc-intro">Votre personnalité éclaire votre manière de manager. Voici comment vos traits se traduisent dans votre posture de leader.</p>
        <div class="r-section-tag">Votre style en un coup d'œil</div>
        ${carteStyle(res)}
        <div class="r-card" style="text-align:center">${radarStyleSpe(res, color)}</div>
        <div id="dimc-zone">${carteDimensionsSpe(res)}</div>
        <div class="r-section-tag">Comment votre personnalité nourrit votre management</div>
        <div class="r-ia" id="ia-mgmt_croisement"><div class="r-ia-tag">Votre ADN de manager</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre rapport à la délégation</div>
        <div class="r-ia" id="ia-dim_delegation"><div class="r-ia-tag">Votre délégation</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre style de feedback</div>
        <div class="r-ia" id="ia-dim_feedback"><div class="r-ia-tag">Votre feedback</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Exigence et bienveillance</div>
        <div class="r-ia" id="ia-dim_exigence"><div class="r-ia-tag">Votre curseur d'exigence</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos moments clés de manager</div>
        <div class="r-ia" id="ia-mgmt_moments_cles"><div class="r-ia-tag">Votre posture en situation</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos formulations en situation</div>
        <div class="r-ia" id="ia-mgmt_formulations"><div class="r-ia-tag">Vos mots à vous</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos leviers de motivation d'équipe</div>
        <div class="r-ia" id="ia-mgmt_motivation_equipe"><div class="r-ia-tag">Motiver votre équipe</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos contextes de réussite</div>
        <div class="r-ia" id="ia-mgmt_contextes_reussite"><div class="r-ia-tag">Analyse Sinéa</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Le manager que vous êtes</div>
        <div class="r-ia" id="ia-mgmt_synthese_leadership"><div class="r-ia-tag">En synthèse</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos angles morts et votre plan de progression</div>
        <div class="r-ia" id="ia-spe_plan"><div class="r-ia-tag">Votre plan de progression</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <button type="button" class="spe-fiche-btn" id="fiche-btn" onclick="Result.telechargerFiche('fiche-btn')">Ma fiche réflexe (1 page PDF)</button>
      </div>`;
    } else if (dt === 'commercial') {
      speBlocHtml = `
      <div class="r-bloc" id="b-spe">
        <div class="r-bloc-head"><span class="r-bloc-tag">Votre métier</span><h2>Votre approche commerciale</h2></div>
        <p class="r-bloc-intro">Votre personnalité éclaire votre manière de vendre. Voici comment vos traits se traduisent dans votre posture commerciale.</p>
        <div class="r-section-tag">Votre style en un coup d'œil</div>
        ${carteStyle(res)}
        <div class="r-card" style="text-align:center">${radarStyleSpe(res, color)}</div>
        <div id="dimc-zone">${carteDimensionsSpe(res)}</div>
        <div class="r-section-tag">Comment votre personnalité nourrit votre vente</div>
        <div class="r-ia" id="ia-com_croisement"><div class="r-ia-tag">Votre ADN de commercial</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre rapport au closing</div>
        <div class="r-ia" id="ia-dim_closing"><div class="r-ia-tag">Votre closing</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre posture face à l'objection</div>
        <div class="r-ia" id="ia-dim_objection"><div class="r-ia-tag">Face aux objections</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre tempérament commercial</div>
        <div class="r-ia" id="ia-dim_chasseur"><div class="r-ia-tag">Analyse Sinéa</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos moments clés de vente</div>
        <div class="r-ia" id="ia-com_moments_cles"><div class="r-ia-tag">Votre posture en situation</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos formulations en situation</div>
        <div class="r-ia" id="ia-com_formulations"><div class="r-ia-tag">Vos mots à vous</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre style de relation client</div>
        <div class="r-ia" id="ia-com_relation_client"><div class="r-ia-tag">Analyse Sinéa</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos contextes de réussite commerciale</div>
        <div class="r-ia" id="ia-com_contextes_reussite"><div class="r-ia-tag">Analyse Sinéa</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Le commercial que vous êtes</div>
        <div class="r-ia" id="ia-com_synthese_vendeur"><div class="r-ia-tag">En synthèse</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos angles morts et votre plan de progression</div>
        <div class="r-ia" id="ia-spe_plan"><div class="r-ia-tag">Votre plan de progression</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <button type="button" class="spe-fiche-btn" id="fiche-btn" onclick="Result.telechargerFiche('fiche-btn')">Ma fiche réflexe (1 page PDF)</button>
      </div>`;
    }

    // ---- Sommaire dynamique (reflète les blocs réellement présents) ----
    const modeCandidat = res.modeCampagne === 'recrutement';
    const tocItems = modeCandidat ? [
      { href: 'b0', label: 'Comprendre la méthode' },
      { href: 'b-familles', label: 'Les 4 familles' },
      { href: 'b1', label: 'Vous connaître' },
    ] : [
      { href: 'b0', label: 'Comprendre la méthode' },
      { href: 'b-familles', label: 'Les 4 familles' },
      { href: 'b1', label: 'Vous connaître' },
      { href: 'b-dims', label: 'Vos dimensions profondes' },
      { href: 'b2', label: 'Lire les autres' },
      { href: 'b3', label: 'Passer à l\'action' },
    ];
    if (!modeCandidat && dt === 'manager') tocItems.push({ href: 'b-spe', label: 'Votre management' });
    else if (!modeCandidat && dt === 'commercial') tocItems.push({ href: 'b-spe', label: 'Votre approche commerciale' });
    const tocHtml = tocItems.map((it, i) =>
      `<a href="#${it.href}" class="r-toc-i"><span class="r-toc-n">${String(i).padStart(2, '0')}</span><span>${it.label}</span></a>`
    ).join('');

    document.getElementById('r-kicker').textContent='Votre archétype';
    document.getElementById('r-archetype').textContent=dom.nom;
    document.getElementById('r-verb').textContent=verbe(dom.nom);
    document.getElementById('r-hero').style.setProperty('--fam-color',color);
    const portrait=document.getElementById('r-portrait-img'); portrait.src=img(dom.nom); portrait.alt=dom.nom;

    const blendSegs=Object.entries(res.blend).map(([nom,pct])=>{
      const fam=nom===dom.nom?dom.famille:(res.secondaires.find(s=>s.nom===nom)?.famille||'RELATION');
      return `<div class="r-blend-seg" style="flex:${pct};background:${FAM[fam]}">${pct}%</div>`;}).join('');
    const chips=Object.entries(res.blend).map(([nom,pct],i)=>{
      const fam=nom===dom.nom?dom.famille:(res.secondaires.find(s=>s.nom===nom)?.famille||'RELATION');
      return `<div class="r-chip"><span class="r-chip-dot" style="background:${FAM[fam]}"></span><b>${nom}</b><span class="r-chip-role">${roles[i]||''}</span></div>`;}).join('');

    const secHtml=res.secondaires.map(s=>{
      const sc=contenu(s.nom); const col=FAM[s.famille];
      return `<div class="r-sec" style="--fam-color:${col}">
        <div class="r-sec-head"><div class="r-sec-badge" style="background:${col}">${initiale(s.nom)}</div>
          <div><div class="r-sec-name">${s.nom}</div><div class="r-sec-fam" style="color:${col}">${s.famille}</div></div></div>
        <p class="r-sec-ess">${sc.essence||''}</p></div>`;}).join('');

    const forcesProposees=[...(dc.forces||[]), ...forcesSituationnelles(res)];
    const forcesVal=forcesProposees.map((f,i)=>validItem('force',i,f)).join('');
    const vigVal=(dc.vigilance||[]).map((v,i)=>validItem('vig',i,v)).join('');

    const cles=SINEA_DATA.cles_familles||{};
    const famBlocks=['RELATION','ACTION','STRUCTURE','VISION'].map(f=>{
      const k=cles[f]; if(!k) return '';
      const mine=f===dom.famille;
      const faire=(k.communiquer?.a_faire||[]).map(x=>`<li>${x}</li>`).join('');
      const eviter=(k.communiquer?.a_eviter||[]).map(x=>`<li>${x}</li>`).join('');
      return `<div class="r-fam" style="--fam-color:${FAM[f]}">
        <div class="r-fam-head"><span class="r-fam-name" style="color:${FAM[f]}">${f}</span>${mine?'<span class="r-fam-mine">Votre famille</span>':''}</div>
        <p class="r-fam-rec">${k.reconnaitre||''}</p>
        <div class="r-fam-grid">
          <div><span class="r-fc-t r-fc-do">À faire</span><ul class="r-do">${faire}</ul></div>
          <div><span class="r-fc-t r-fc-dont">À éviter</span><ul class="r-dont">${eviter}</ul></div>
        </div></div>`;}).join('');

    const maCle=cles[dom.famille]||{};
    const conflitRows=['RELATION','ACTION','STRUCTURE','VISION'].filter(f=>f!==dom.famille).map(f=>{
      const k=cles[f]; if(!k) return '';
      return `<div class="r-cf-row"><div class="r-cf-badge" style="background:${FAM[f]}">${f[0]}</div>
        <div><b style="color:${FAM[f]}">${f}</b><p>${k.en_conflit||''}</p></div></div>`;}).join('');

    // Bandeau d'accès rapide vers la partie spé (commercial / manager)
    let accesRapide = '';
    if (dt === 'commercial' || dt === 'manager') {
      const labelSpe = dt === 'commercial' ? 'votre approche commerciale' : 'votre management';
      accesRapide = `<a href="#b-spe" class="r-acces-rapide"><span class="r-acces-rapide-txt">Accéder directement à ${labelSpe}</span><span class="r-acces-rapide-fleche">↓</span></a>`;
    }

    const html=`
      <p class="r-essence">${dc.essence||''}</p>

      <div class="r-toc">${tocHtml}</div>
      ${accesRapide}
      </div>

      <div class="r-bloc" id="b0">
        <div class="r-bloc-head"><span class="r-bloc-tag">Méthode</span><h2>Comment ce portrait est établi</h2></div>
        ${schemaScience(dt === 'classic' ? 55 : 91)}
        <div class="r-card"><p>Votre profil repose sur le <b>Big Five</b>, le modèle de personnalité le plus validé scientifiquement. Vos réponses se traduisent en cinq dimensions, puis en archétypes qui les rendent vivantes.</p></div>
        <div class="r-compare">
          <div class="r-cmp r-cmp-a"><div class="r-cmp-t">DISC, Process Com</div>reposent sur des typologies en cases, souvent moins validées.</div>
          <div class="r-cmp r-cmp-b"><div class="r-cmp-t">Sinéa Profile</div>mesure des dimensions continues, puis les combine en un profil nuancé et unique.</div>
        </div>
        <div class="r-card">${badgeFiabilite(res)}<p style="margin:0"><b>Pourquoi vos réponses sont fiables.</b> Nos questions utilisent un choix forcé, sans réponse neutre, ce qui limite le biais de complaisance. Votre profil mêle plusieurs archétypes, car une personne réelle ne tient jamais dans une seule case.</p></div>
      </div>

      <div class="r-bloc" id="b-familles">
        <div class="r-bloc-head"><span class="r-bloc-tag">Le système</span><h2>Les 4 familles de profils</h2></div>
        <p class="r-familles-intro">Chaque archétype appartient à l'une des quatre grandes familles. Elles donnent une lecture simple et immédiate de ce qui anime chaque personne. <strong>Votre famille est mise en avant ci-dessous.</strong></p>
        <div class="r-familles-grid">${htmlFamilles(dom.famille)}</div>
      </div>

      <div class="r-bloc" id="b1">
        <div class="r-bloc-head"><span class="r-bloc-tag">Bloc 1</span><h2>Vous connaître en profondeur</h2></div>
        <div class="r-section-tag">Qui vous êtes</div>
        <div class="r-ia" id="ia-ouverture"><div class="r-ia-tag">Votre portrait</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">L'alchimie de vos forces</div>
        <div class="r-ia" id="ia-alchimie"><div class="r-ia-tag">Lecture croisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre combinaison</div>
        <div class="r-card"><div class="r-blend">${blendSegs}</div><div class="r-chips">${chips}</div></div>
        ${(res.classement && res.classement.length) ? `
        <div class="r-section-tag">Votre affinité avec les 20 archétypes</div>
        <p class="r-hint">Votre profil est une signature unique. Voici votre proximité avec chacun des 20 archétypes.</p>
        <div class="r-card">${classementComplet(res)}</div>` : ''}
        <div class="r-section-tag">Les dynamiques entre vos forces</div>
        <p class="r-hint">Vos trois archétypes ne coexistent pas, ils interagissent deux à deux.</p>
        <div id="ia-dynamiques"><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos forces secondaires</div>
        <div class="r-secs-grid">${secHtml}</div>
        <div class="r-section-tag">Votre tempérament</div>
        <div class="r-card"><div class="r-temperament"><div class="r-radar">${radarSvg(res.radarFamilles,color)}</div><div class="r-spectres">${spectres(res.scoresBigFive)}</div></div>${pepite(faitBigFive(res.scoresBigFive), 'pepite-trait')}</div>
        <div class="r-ia" id="ia-bigfive"><div class="r-ia-tag">Ce que révèle le croisement de vos dimensions</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre naturel et votre adaptation au travail</div>
        <p class="r-hint">L'écart entre qui vous êtes spontanément et comment vous agissez au travail révèle où vous fournissez un effort.</p>
        ${carteNaturelAdapte(res)}
        <div class="r-section-tag">Vous en situation</div>
        <div class="r-ia" id="ia-situation"><div class="r-ia-tag">Votre profil en action</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos forces, à valider</div>
        <p class="r-hint">Cochez ce qui résonne le plus chez vous : <b>vos choix orientent les plans d'action et les défis</b> que nous vous proposerons ensuite.</p>
        <div class="r-validables-grid">${forcesVal}</div>
        <div class="r-section-tag">La matrice de votre personnalité</div>
        <p class="r-hint">Une vue d'ensemble de vos forces, vigilances, leviers de développement et points de friction.</p>
        ${matriceSwot(res)}
      </div>

      <div class="r-bloc" id="b-dims">
        <div class="r-bloc-head"><span class="r-bloc-tag">Approfondissement</span><h2>Vos dimensions profondes</h2></div>
        <p class="r-bloc-intro">Cinq registres révèlent comment vous fonctionnez face aux situations clés du quotidien professionnel.</p>
        <div class="r-section-tag">Votre profil en un coup d'œil</div>
        ${carteDimensions(res)}
        <div class="r-section-tag">Votre rapport au stress</div>
        <div class="r-ia" id="ia-dim_stress"><div class="r-ia-tag">Sous tension</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos moteurs profonds</div>
        <div class="r-ia" id="ia-dim_motivation"><div class="r-ia-tag">Vos moteurs</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre rapport au risque</div>
        <div class="r-ia" id="ia-dim_risque"><div class="r-ia-tag">Votre boussole</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre rapport au changement</div>
        <div class="r-ia" id="ia-dim_changement"><div class="r-ia-tag">Face au mouvement</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre posture face au conflit</div>
        <div class="r-ia" id="ia-dim_conflit"><div class="r-ia-tag">Dans la friction</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        ${Object.keys(res.contextuelPlus || {}).length ? `
        <div class="r-bloc-head" style="margin-top:34px"><span class="r-bloc-tag">Pilotage</span><h2>Vos dimensions de pilotage</h2></div>
        <p class="r-bloc-intro">Quatre dimensions, fondées sur la Self-Determination Theory et le modèle SMART, révèlent comment vous piloter et travailler avec vous au quotidien.</p>
        <div class="r-section-tag">Vos dimensions en un coup d'œil</div>
        ${carteDimensionsPlus(res)}
        <div class="r-section-tag">Votre énergie et votre rythme</div>
        <div class="r-ia" id="ia-dim_energie"><div class="r-ia-tag">Votre tempo</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre mode de collaboration</div>
        <div class="r-ia" id="ia-dim_collaboration"><div class="r-ia-tag">Avec les autres</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre rapport au cadre</div>
        <div class="r-ia" id="ia-dim_autorite"><div class="r-ia-tag">Vous et le cadre</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Ce qui nourrit votre engagement</div>
        <div class="r-ia" id="ia-dim_reconnaissance"><div class="r-ia-tag">Votre carburant</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>` : ''}
      </div>

      <div class="r-bloc" id="b2">
        <div class="r-bloc-head"><span class="r-bloc-tag">Bloc 2</span><h2>Lire et comprendre les autres</h2></div>
        <p class="r-bloc-intro">Votre profil vous offre une grille de lecture des autres. En identifiant la famille de vos interlocuteurs, vous adaptez votre communication et désamorcez les tensions plus vite.</p>
        <div class="r-section-tag">Votre carte des familles</div>
        <div class="r-card"><div class="r-radar">${radarSvg(res.radarFamilles,color)}</div></div>
        <div class="r-section-tag">Communiquer avec chaque famille</div>
        <div class="r-fams-grid">${famBlocks}</div>
        <div class="r-section-tag">Gérer les conflits</div>
        <div class="r-card"><div class="r-ia-tag">Votre style en conflit</div><p style="margin:0">${maCle.en_conflit||''}</p></div>
        <p class="r-hint">Désamorcer selon le profil d'en face :</p>
        <div class="r-cf-grid">${conflitRows}</div>
        <div class="r-section-tag">Vos angles morts relationnels</div>
        <div class="r-ia" id="ia-angles"><div class="r-ia-tag">Vos angles morts</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
      </div>

      <div class="r-bloc" id="b3">
        <div class="r-bloc-head"><span class="r-bloc-tag">Bloc 3</span><h2>Passer à l'action</h2></div>
        <div class="r-section-tag">Vos points de vigilance</div>
        <p class="r-hint">Lesquels aimeriez-vous travailler ?</p>
        <div class="r-validables-grid">${vigVal}</div>
        <div class="r-section-tag">Votre moteur</div>
        <div class="r-validable r-val-moteur" id="v-moteur-0" onclick="Result.toggleValid('moteur',0)"><div class="r-val-check">✓</div><p>${dc.moteur||''}</p></div>
        <div class="r-section-tag">Deux questions pour vous</div>
        <div class="r-opens-grid">
        <div class="r-open">
          <label class="r-open-q">Si vous deviez retenir une seule phrase de ce portrait, laquelle garderiez-vous, et pourquoi celle-là maintenant ?</label>
          <textarea class="r-open-input" id="open-1" rows="3" placeholder="Votre réponse..." oninput="Result.saveOpen('q1', this.value)"></textarea>
        </div>
        <div class="r-open">
          <label class="r-open-q">Imaginez votre version la plus accomplie au travail. Que fait-elle naturellement que vous aimeriez faire avec plus d'aisance ?</label>
          <textarea class="r-open-input" id="open-2" rows="3" placeholder="Votre réponse..." oninput="Result.saveOpen('q2', this.value)"></textarea>
        </div>
        </div>
        <div class="r-section-tag">Vos pistes d'action</div>
        <div class="r-ia" id="ia-actions"><div class="r-ia-tag">L'IA propose, vous choisissez</div><p class="r-hint" style="margin-top:0">Sélectionnez les habitudes à développer.</p><div class="r-ia-loading"><span class="mini-spin"></span>Génération...</div></div>
        <div class="r-section-tag">Votre signature</div>
        <div class="r-rare"><div class="r-rare-num">${rar.affichage || (rar.pct?rar.pct+'%':'')}</div><div class="r-rare-txt" id="pepite-rarete">${phraseSignature(res, rar)}</div></div>
      </div>

      ${speBlocHtml}

      <div class="r-mode-emploi" id="mode-emploi-bloc" style="display:none;">
        <div class="r-me-head">
          <div class="r-me-kicker">Hors norme</div>
          <h2 class="r-me-title" id="mode-emploi-titre">Le mode d'emploi de moi-même</h2>
          <p class="r-me-sub">Une fiche à partager à votre équipe pour mieux travailler ensemble.</p>
        </div>
        <div class="r-me-card" id="mode-emploi-contenu"></div>
      </div>

      <div class="r-carte-bloc" id="carte-bloc">
        <div class="r-me-head">
          <div class="r-me-kicker">À partager</div>
          <h2 class="r-me-title">Votre carte d'archétype</h2>
          <p class="r-me-sub">Téléchargez votre carte et partagez votre profil sur LinkedIn.</p>
        </div>
        <div class="r-carte-preview" id="carte-preview"></div>
        <button class="r-carte-btn" id="carte-share-btn">Télécharger ma carte</button>
        <button class="r-carte-btn r-pdf-btn" id="portrait-pdf-btn" onclick="Result.telechargerPortrait()" style="display:none;margin-top:10px;background:#1A1A2E">Télécharger mon portrait complet (PDF)</button>
      </div>

      <div class="r-chat-bloc" id="chat-bloc">
        <div class="r-me-head">
          <div class="r-me-kicker">Vos 3 questions</div>
          <h2 class="r-me-title">Vos questions à votre coach</h2>
          <p class="r-me-sub">Votre coach Sinéa a lu votre portrait. Posez-lui jusqu'à trois questions pour aller plus loin. <span class="r-chat-compteur" id="chat-compteur"></span></p>
        </div>
        <div class="r-chat-window" id="chat-window">
          <div class="r-chat-suggestions" id="chat-suggestions"></div>
        </div>
        <div class="r-chat-input-row">
          <input class="r-chat-input" id="chat-input" type="text" placeholder="Posez une question sur vous..." maxlength="500" />
          <button class="r-chat-send" id="chat-send" aria-label="Envoyer">→</button>
        </div>
      </div>

      <div class="r-compat-bloc" id="compat-bloc">
        <div class="r-me-head">
          <div class="r-me-kicker">En équipe</div>
          <h2 class="r-me-title">Vos compatibilités d'équipe</h2>
          <p class="r-me-sub">Comment votre profil se combine avec les autres familles.</p>
        </div>
        <div class="r-compat-grid" id="compat-grid"></div>
      </div>

      <div class="r-fin-cta">
        <h3>Votre portrait est prêt</h3>
        <p>Retrouvez votre analyse et la suite de votre parcours dans votre espace.</p>
        <button class="btn-primary btn-light r-cta-espace" onclick="App.goToEspace()">Accéder à mon espace</button>
      </div>
    `;
    document.getElementById('r-body').innerHTML=html;

    // ---- Découverte guidée : le personnage d'abord, le coach au clic ----
    if (res.modeCampagne === 'recrutement') appliquerModeCandidat();
    installerCtaDecouverte(dom, res);

    // Câbler la carte partageable (aperçu + bouton de téléchargement)
    const carteSlug = img(dom.nom).replace('.webp', '');
    const cartePreview = document.getElementById('carte-preview');
    const famKeyCarte = (dom.famille || '').toUpperCase();
    const famCarte = COULEURS_FAMILLE[famKeyCarte] || COULEURS_FAMILLE.VISION;
    if (cartePreview) {
      cartePreview.innerHTML = `
        <div class="r-carte-mini" style="background:linear-gradient(145deg, ${famCarte.c1}, ${famCarte.c2});">
          <div class="r-carte-mini-logo">SINÉA</div>
          <div class="r-carte-mini-perso"><img src="${img(dom.nom)}" alt="${dom.nom}"/></div>
          <div class="r-carte-mini-nom">${dom.nom}</div>
          <div class="r-carte-mini-fam">Famille ${famCarte.label}</div>
        </div>`;
    }
    const carteBtn = document.getElementById('carte-share-btn');
    const prenomUser = (window.App && App.getPrenom) ? App.getPrenom() : '';
    if (carteBtn) carteBtn.onclick = () => genererCarte(dom.nom, dom.famille, carteSlug, prenomUser);

    // Câbler le chat avec l'archétype
    initChat(dom, res);

    // Remplir les compatibilités d'équipe
    const compatGrid = document.getElementById('compat-grid');
    if (compatGrid) compatGrid.innerHTML = htmlCompatibilites(dom.famille);

    generateIA(res);
  }

  // ============================================================
  // LE CHAT AVEC SON ARCHÉTYPE
  // ============================================================
  const CHAT_URL = "https://sinea-profile-ia.vercel.app/api/chat";
  const PDF_URL = "https://sinea-profile-ia.vercel.app/api/pdf_portrait";

  // ----- Portrait PDF premium (visible si un token individuel est présent dans l'URL) -----
  function lireToken(){
    try { return new URLSearchParams(location.search).get('token') || null; } catch(e){ return null; }
  }
  let emailCourant = '';
  function setEmail(e){ emailCourant = e || ''; }
  function initPortraitPdf(){
    const dispo = lireToken() || emailCourant;
    const btn = document.getElementById('portrait-pdf-btn');
    if (btn && dispo) btn.style.display = '';
    // bouton compact en HAUT de la restitution (dans le hero)
    const hero = document.getElementById('r-hero');
    if (hero && dispo && !document.getElementById('portrait-pdf-haut')) {
      const b = document.createElement('button');
      b.id = 'portrait-pdf-haut';
      b.className = 'r-hero-pdf';
      b.type = 'button';
      b.textContent = 'Télécharger mon portrait PDF';
      b.onclick = () => telechargerPortrait('portrait-pdf-haut');
      hero.appendChild(b);
    }
  }
  // Détection mobile : iOS/Android ignorent l'attribut download sur un blob.
  // Sur mobile on ouvre le PDF dans un onglet (lecture + partage/enregistrement natif),
  // sur desktop on déclenche un vrai téléchargement.
  function estMobile(){
    return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent || '') ||
           (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
  }
  function remettreFichier(blob, nomFichier, fenetrePreouverte){
    const url = URL.createObjectURL(blob);
    if (estMobile()){
      // une fenêtre pré-ouverte au clic évite le blocage de pop-up ; sinon on tente l'ouverture
      if (fenetrePreouverte && !fenetrePreouverte.closed){ fenetrePreouverte.location = url; }
      else { const w = window.open(url, '_blank'); if (!w) location.href = url; }
      setTimeout(()=>URL.revokeObjectURL(url), 60000);
      return true; // ouvert en onglet
    }
    const a = document.createElement('a');
    a.href = url; a.download = nomFichier;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    return false; // téléchargé
  }

  const FICHE_URL = "https://sinea-profile-ia.vercel.app/api/fiche_reflexe";
  async function telechargerFiche(btnId){
    const btn = document.getElementById(btnId || 'fiche-btn');
    const token = lireToken();
    if ((!token && !emailCourant) || !btn) return;
    const texte = btn.textContent;
    const preFenetre = estMobile() ? window.open('', '_blank') : null;
    btn.textContent = 'Génération de votre fiche…';
    btn.disabled = true;
    try {
      const rep = await fetch(FICHE_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(token ? { token } : { email: emailCourant }) });
      if (!rep.ok) throw new Error('génération indisponible');
      const blob = await rep.blob();
      const ouvert = remettreFichier(blob, 'Fiche_Reflexe_Sinea.pdf', preFenetre);
      btn.textContent = ouvert ? 'Fiche ouverte ✓' : 'Fiche téléchargée ✓';
      setTimeout(()=>{ btn.textContent = texte; btn.disabled = false; }, 3500);
    } catch(e){
      if (preFenetre && !preFenetre.closed) preFenetre.close();
      btn.textContent = 'Réessayer le téléchargement';
      btn.disabled = false;
    }
  }

  async function telechargerPortrait(btnId){
    const btn = document.getElementById(btnId || 'portrait-pdf-btn');
    const token = lireToken();
    if ((!token && !emailCourant) || !btn) return;
    const texte = btn.textContent;
    // pré-ouvrir l'onglet AU CLIC sur mobile (un open() après await serait bloqué)
    const preFenetre = estMobile() ? window.open('', '_blank') : null;
    btn.textContent = 'Génération de votre portrait…';
    btn.disabled = true;
    try {
      const rep = await fetch(PDF_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(token ? { token } : { email: emailCourant }) });
      if (!rep.ok) throw new Error('génération indisponible');
      const blob = await rep.blob();
      const ouvert = remettreFichier(blob, 'Portrait_Sinea.pdf', preFenetre);
      btn.textContent = ouvert ? 'Portrait ouvert ✓' : 'Portrait téléchargé ✓';
      setTimeout(()=>{ btn.textContent = texte; btn.disabled = false; }, 3500);
    } catch(e){
      if (preFenetre && !preFenetre.closed) preFenetre.close();
      btn.textContent = 'Réessayer le téléchargement';
      btn.disabled = false;
    }
  }
  let chatHistorique = [];

  const QUESTIONS_SUGGEREES = [
    "Pourquoi je procrastine parfois ?",
    "Comment mieux gérer les conflits ?",
    "Quelle est ma plus grande force au travail ?",
    "Comment me ressourcer après une journée difficile ?",
  ];
  // Questions d'amorce personnalisées selon les dimensions mesurées de la personne
  const SUGG_CTX = {
    stress: { accelerateur: "Comment canaliser mon énergie quand la pression monte ?", methodique: "Pourquoi j'ai besoin de tout restructurer sous pression ?", retrait: "Pourquoi j'ai besoin de recul avant d'agir sous pression ?", appui: "Pourquoi je cherche du soutien quand la pression monte ?" },
    motivation: { accomplissement: "Comment me fixer des objectifs qui me portent vraiment ?", reconnaissance: "Comment rendre mon travail plus visible sans forcer ?", sens: "Comment nourrir mon besoin de sens au quotidien ?", maitrise: "Comment progresser plus vite dans ce qui me passionne ?" },
    conflit: { affrontement: "Comment dire les choses sans braquer les autres ?", mediation: "Comment apaiser un conflit sans m'oublier ?", compromis: "Quand le compromis devient-il un piège pour moi ?", evitement: "Comment oser aborder les sujets qui fâchent ?" },
    changement: { moteur: "Comment embarquer ceux qui freinent face au changement ?", adaptable: "Comment garder mon cap quand tout bouge ?", pragmatique: "Comment trier les changements qui valent le coup ?", ancre: "Comment mieux vivre les changements imposés ?" },
    risque: { audacieux: "Comment sécuriser mes paris sans perdre mon audace ?", calcule: "Comment décider plus vite sans tout recalculer ?", prudent: "Comment oser davantage sans me mettre en danger ?", securitaire: "Comment sortir de ma zone de confort en sécurité ?" },
  };
  function suggestionsPersonnalisees(res, dom) {
    const ctx = res.contextuel || {};
    const liste = [];
    ['stress','motivation','conflit','changement','risque'].forEach((dd) => {
      const q = SUGG_CTX[dd] && SUGG_CTX[dd][ctx[dd]];
      if (q && liste.length < 3) liste.push(q);
    });
    liste.push(`Quelle est ma plus grande force en tant que ${dom.nom} ?`);
    return liste.length > 1 ? liste.slice(0, 4) : QUESTIONS_SUGGEREES;
  }

  // L'intro ne se joue qu'une fois par session de lecture (pas à chaque reprise).
  let introDejaJouee = false;
  // Mode candidat (campagne de recrutement) : restitution allégée à l'essentiel valorisant.
  // On retire les blocs profonds, le mode d'emploi, le chat et les défis ; le portrait,
  // l'alchimie, le Big Five, les pépites et la signature restent : c'est le cadeau du candidat.
  function appliquerModeCandidat(){
    // la signature rareté ("vous êtes 1 sur N") vit dans b3 : on la déplace dans
    // "Vous connaître" avant de retirer le bloc, c'est un des cadeaux du candidat.
    const rare = document.querySelector('#b3 .r-rare');
    const b1 = document.getElementById('b1');
    if (rare && b1) {
      const tag = rare.previousElementSibling && rare.previousElementSibling.classList.contains('r-section-tag')
        ? rare.previousElementSibling : null;
      if (tag) b1.appendChild(tag);
      b1.appendChild(rare);
    }
    ['b-dims', 'b2', 'b3', 'b-spe', 'mode-emploi-bloc'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    // essentiel valorisant : on garde forces et leviers, on retire vigilances et frictions
    document.querySelectorAll('#b1 .swot-v, #b1 .swot-r').forEach((el) => el.remove());
    // toute trace du chat ou des défis hors blocs retirés
    document.querySelectorAll('[id^="chat-"], [class*="chat-coach"], #screen-defis .defi, .r-defis-cta').forEach((el) => {
      const bloc = el.closest('.r-bloc');
      if (bloc) bloc.remove(); else el.remove();
    });
  }

  // Le personnage se découvre en premier : le coach attend le clic, sans voler la révélation.
  function installerCtaDecouverte(dom, res){
    const hero = document.getElementById('r-hero');
    if (!hero || document.getElementById('cta-decouvrir')) return;
    const b = document.createElement('button');
    b.id = 'cta-decouvrir';
    b.className = 'r-hero-go';
    b.type = 'button';
    b.textContent = 'Découvrir mon analyse ↓';
    b.onclick = () => {
      if (res.modeCampagne === 'recrutement') {
        const cible = document.querySelector('.r-toc') || document.getElementById('b0');
        if (cible) cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        jouerIntroCoach(dom);
      }
    };
    hero.appendChild(b);

    // Le génie surgit de lui-même après que le personnage a eu le temps d'être découvert.
    // Garde-fous : pas en mode candidat, une seule fois (introDejaJouee), et jamais
    // par-dessus le contenu si la personne a déjà commencé à descendre vers son analyse.
    if (res.modeCampagne !== 'recrutement') {
      setTimeout(() => {
        if (!introDejaJouee && window.scrollY < 120) jouerIntroCoach(dom);
      }, 2500);
    }
  }

  function jouerIntroCoach(dom){
    if (introDejaJouee) return;
    introDejaJouee = true;
    const prenom = (window.App && App.getPrenom) ? App.getPrenom() : '';
    // si l'utilisateur a déjà épuisé ses questions (reprise tardive), on n'impose pas l'intro longue
    const ov = document.createElement('div');
    ov.className = 'coach-intro';
    ov.innerHTML = `
      <div class="coach-intro-card">
        <div class="coach-intro-orb"><span class="coach-intro-orb-core"></span></div>
        <div class="coach-intro-step" data-step="1">
          <p class="coach-intro-hi">Bonjour${prenom ? ' ' + prenom : ''}.</p>
          <p class="coach-intro-line">Je suis votre coach Sinéa.</p>
        </div>
        <div class="coach-intro-step" data-step="2">
          <p class="coach-intro-line">Voici votre portrait, fondé sur vos réponses.<br>Prenez le temps de le lire attentivement.</p>
        </div>
        <div class="coach-intro-step" data-step="3">
          <p class="coach-intro-line"><strong>Et comme un génie sorti de sa lampe</strong>, je réalise ensuite vos <strong>trois questions</strong>.</p>
          <p class="coach-intro-hint">Trois, pas une de plus. Choisissez-les bien.</p>
          <button class="coach-intro-go" id="coach-intro-go">Découvrir mon portrait</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('on'));

    const steps = ov.querySelectorAll('.coach-intro-step');
    let i = 0;
    const montrer = (n) => steps.forEach((s, k) => s.classList.toggle('show', k === n));
    montrer(0);
    const t1 = setTimeout(() => montrer(1), 2300);
    const t2 = setTimeout(() => montrer(2), 4800);
    const fermer = () => {
      clearTimeout(t1); clearTimeout(t2);
      ov.classList.remove('on');
      setTimeout(() => ov.remove(), 500);
      const toc = document.querySelector('.r-toc');
      const cible = toc || document.getElementById('b0');
      if (cible) setTimeout(() => cible.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    };
    // bouton de fin (apparaît à l'étape 3) + clic n'importe où après la dernière étape
    ov.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'coach-intro-go') { fermer(); return; }
      // si on est déjà à la dernière étape, un clic ferme aussi
      if (steps[2] && steps[2].classList.contains('show')) fermer();
    });
    // sécurité : fermeture auto si la personne ne fait rien
    setTimeout(() => { if (document.body.contains(ov)) fermer(); }, 14000);
  }

  function initChat(dom, res) {
    chatHistorique = [];
    const win = document.getElementById('chat-window');
    const sugg = document.getElementById('chat-suggestions');
    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    if (!win || !input || !send) return;

    // message d'accueil
    win.querySelectorAll('.r-chat-msg').forEach(e => e.remove());
    const prenomChat = (window.App && App.getPrenom) ? App.getPrenom() : '';
    ajouterMessageChat('assistant', `Bonjour${prenomChat ? ' ' + prenomChat : ''}, je suis votre coach Sinéa. J'ai lu votre portrait ${dom.nom} en entier. Posez-moi jusqu'à trois questions pour creuser ce qui vous intrigue.`);
    majCompteurChat(3);

    // suggestions cliquables
    if (sugg) {
      sugg.innerHTML = suggestionsPersonnalisees(res, dom).map(q => `<button class="r-chat-sugg">${q}</button>`).join('');
      sugg.querySelectorAll('.r-chat-sugg').forEach(btn => {
        btn.onclick = () => { input.value = btn.textContent; envoyerMessageChat(dom, res); };
      });
    }

    send.onclick = () => envoyerMessageChat(dom, res);
    input.onkeydown = (e) => { if (e.key === 'Enter') envoyerMessageChat(dom, res); };
  }

  function ajouterMessageChat(role, texte) {
    const win = document.getElementById('chat-window');
    if (!win) return null;
    const div = document.createElement('div');
    div.className = 'r-chat-msg r-chat-' + (role === 'assistant' ? 'bot' : 'user');
    div.textContent = texte;
    win.appendChild(div);
    win.scrollTop = win.scrollHeight;
    return div;
  }

  // Met à jour l'affichage "il vous reste N question(s)".
  function majCompteurChat(restant){
    const el = document.getElementById('chat-compteur');
    if (!el) return;
    if (restant > 0) el.textContent = `Il vous reste ${restant} question${restant > 1 ? 's' : ''}.`;
    else el.textContent = 'Vous avez utilisé vos trois questions.';
  }
  // Désactive la saisie quand les 3 questions sont consommées.
  function verrouillerChat(){
    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    const sugg = document.getElementById('chat-suggestions');
    if (input) { input.disabled = true; input.placeholder = 'Vos trois questions ont été posées'; }
    if (send) send.disabled = true;
    if (sugg) sugg.style.display = 'none';
  }

  function envoyerMessageChat(dom, res) {
    const input = document.getElementById('chat-input');
    const sugg = document.getElementById('chat-suggestions');
    if (!input) return;
    const question = (input.value || '').trim();
    if (!question) return;
    input.value = '';
    if (sugg) sugg.style.display = 'none'; // masquer les suggestions après la première question

    ajouterMessageChat('user', question);
    chatHistorique.push({ role: 'user', content: question });

    // indicateur de saisie
    const loader = ajouterMessageChat('assistant', '...');
    if (loader) loader.classList.add('r-chat-loading');

    fetch(CHAT_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archetype: dom.nom, famille: dom.famille, bigFive: res.scoresBigFive,
        contextuel: res.contextuel || {}, contextuelPlus: res.contextuelPlus || {},
        question, historique: chatHistorique,
        email: emailCourant || undefined, token: lireToken() || undefined,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (loader) loader.remove();
        if (data && data.limite) {
          // quota de 3 questions atteint
          ajouterMessageChat('assistant', data.message || "Vous avez utilisé vos trois questions.");
          majCompteurChat(0);
          verrouillerChat();
        } else if (data && data.ok && data.reponse) {
          ajouterMessageChat('assistant', data.reponse);
          chatHistorique.push({ role: 'assistant', content: data.reponse });
          if (typeof data.restant === 'number') {
            majCompteurChat(data.restant);
            if (data.restant <= 0) verrouillerChat();
          }
        } else {
          ajouterMessageChat('assistant', "Je ne peux pas répondre pour le moment. Réessayez dans un instant.");
        }
      })
      .catch(() => {
        if (loader) loader.remove();
        ajouterMessageChat('assistant', "La connexion a échoué. Réessayez dans un instant.");
      });
  }

  function validItem(type, i, txt){
    validLabels[`${type}_${i}`]=txt;
    return `<div class="r-validable" id="v-${type}-${i}" onclick="Result.toggleValid('${type}',${i})"><div class="r-val-check">✓</div><p>${txt}</p></div>`;
  }
  // Forces situationnelles : formulées depuis les registres et le pilotage de la personne
  const FORCES_SITU = {
    stress: { accelerateur: 'Monter en intensité quand la pression arrive', methodique: 'Garder une méthode claire sous pression', retrait: 'Prendre du recul pour analyser avant d\'agir', appui: 'Être un point d\'appui pour les autres sous pression' },
    motivation: { accomplissement: 'Aller au bout de ce que vous commencez', reconnaissance: 'Tirer le meilleur de vous quand votre travail est vu', sens: 'Vous engager à fond quand le projet a du sens', maitrise: 'Creuser un sujet jusqu\'à le maîtriser vraiment' },
    risque: { audacieux: 'Oser quand les autres hésitent', calcule: 'Évaluer finement avant de vous engager', prudent: 'Sécuriser ce qui doit l\'être', securitaire: 'Protéger le collectif des paris hasardeux' },
    changement: { moteur: 'Impulser le changement autour de vous', adaptable: 'Vous ajuster vite quand tout bouge', pragmatique: 'Trier ce qui mérite de changer de ce qui marche', ancre: 'Rester un repère stable quand tout bouge' },
    conflit: { affrontement: 'Nommer les désaccords sans détour', mediation: 'Apaiser et trouver le terrain d\'entente', compromis: 'Construire des solutions acceptables par tous', evitement: 'Choisir vos combats avec discernement' },
    energie: { sprinteur: 'Délivrer fort sur des séquences intenses', endurant: 'Tenir la distance sur les projets longs', cyclique: 'Alterner intensité et récupération avec justesse', deepworker: 'Produire en profondeur, loin du bruit' },
    collaboration: { autonome: 'Piloter votre périmètre en toute autonomie', cooperatif: 'Faire grandir les idées par l\'échange', interdependant: 'Connecter votre travail à celui des autres', federateur: 'Animer et entraîner le collectif' },
  };
  function forcesSituationnelles(res){
    const out=[];
    const ctx=Object.assign({}, res.contextuel||{}, res.contextuelPlus||{});
    Object.entries(FORCES_SITU).forEach(([dim,map])=>{
      const choisi=ctx[dim];
      if(choisi && map[choisi]) out.push(map[choisi]);
    });
    return out.slice(0,5); // au plus 5 propositions personnalisées en plus des forces d'archétype
  }
  const validLabels={};
  function toggleValid(type,i){
    const key=`${type}_${i}`; validations[key]=!validations[key];
    document.getElementById(`v-${type}-${i}`).classList.toggle('sel',validations[key]);
    sauvegarderInteractions();
  }
  function saveOpen(q,v){ openAnswers[q]=v; sauvegarderInteractions(); }

  // Collecte les choix de l'utilisateur (forces validées, vigilances, réponses ouvertes, pistes) et les envoie
  let interTimer = null;
  function sauvegarderInteractions(){
    if (!window.App || !App.envoyerInteractions) return;
    if (interTimer) clearTimeout(interTimer);
    interTimer = setTimeout(() => {
      const inter = {
        forces_validees: Object.keys(validations).filter(k => k.startsWith('force_') && validations[k]),
        forces_libelles: Object.keys(validations).filter(k => k.startsWith('force_') && validations[k]).map(k => validLabels[k]).filter(Boolean),
        vigilances_validees: Object.keys(validations).filter(k => k.startsWith('vigilance_') && validations[k]),
        moteur_valide: !!validations['moteur_0'],
        reponses_ouvertes: Object.assign({}, openAnswers),
        pistes_choisies: Array.from(selectedActions),
        auto_perception: (RES && RES.speDims) ? Object.keys(parisSpe).filter(a => parisSpe[a] && parisSpe[a] !== '_skip' && SPE_DIM_LABELS[a]).map(a => ({
          axe: a,
          titre: SPE_DIM_LABELS[a].titre,
          pari: SPE_DIM_LABELS[a].profils[parisSpe[a]] || parisSpe[a],
          mesure: SPE_DIM_LABELS[a].profils[RES.speDims[a]] || RES.speDims[a] || '',
          accord: parisSpe[a] === RES.speDims[a]
        })) : [],
        diagType: RES ? RES.diagType : 'classic',
      };
      App.envoyerInteractions(inter);
    }, 1500);
  }
  function toggleAction(i){ const el=document.getElementById('act-'+i); el.classList.toggle('sel'); if(selectedActions.has(i))selectedActions.delete(i);else selectedActions.add(i); sauvegarderInteractions(); }
  function niveauTxt(niv){ return {'répandu':'Vous avez un profil répandu','courant':'Vous avez un profil courant','peu commun':'Vous avez un profil peu commun','rare':'Vous avez un profil rare'}[niv]||'Votre profil est unique'; }

  // Comparaisons amusantes calibrées sur la rareté (1 sur N).
  // Chaque palier propose plusieurs images : on en choisit une de façon stable
  // (déterministe selon le profil, pour ne pas changer à chaque rafraîchissement).
  const STATS_RARETE = [
    { max: 20, images: [
      "Le saviez-vous ? Environ 1 personne sur 10 est gauchère (source : Statista). Votre profil joue dans le même ordre de rareté.",
      "Pour situer : à peu près 1 personne sur 25 a les yeux bleus hors d'Europe. Une singularité du même genre que la vôtre.",
      "Repère chiffré : près d'1 personne sur 13 est daltonienne chez les hommes. Votre profil est une exception comparable." ] },
    { max: 80, images: [
      "Le saviez-vous ? Seulement 1 personne sur 50 a les yeux verts, la couleur la plus rare au monde (source : Wikipédia). Votre profil tutoie cette rareté.",
      "Pour situer : environ 1 personne sur 100 a les yeux gris. Vous êtes dans cette catégorie des profils peu communs.",
      "Repère chiffré : à peu près 1 chat domestique sur 3 000 est roux et femelle. La nature aime ces exceptions, vous en êtes une." ] },
    { max: 300, images: [
      "Le saviez-vous ? La rousseur naturelle concerne 1 personne sur 50 à sur 100 dans le monde. Votre profil est encore un cran au-dessus.",
      "Pour situer : être ambidextre vrai concerne environ 1 personne sur 100. Votre rareté dépasse même la sienne.",
      "Repère chiffré : naître avec une fossette au menton touche moins d'1 personne sur 5, mais votre combinaison est bien plus rare encore." ] },
    { max: 2000, images: [
      "Le saviez-vous ? Naître un 29 février arrive 1 fois sur 1 461 (probabilité mathématique). Votre profil est à peu près aussi inattendu.",
      "Pour situer : l'hétérochromie, ces yeux de deux couleurs, concerne moins d'1 personne sur 1 000. Vous partagez ce niveau de singularité.",
      "Repère chiffré : un trèfle à quatre feuilles, c'est 1 sur 5 000 (étude Share the Luck, 5,7 millions de trèfles analysés). Vous en approchez la rareté." ] },
    { max: Infinity, images: [
      "Le saviez-vous ? Un trèfle à quatre feuilles, c'est déjà 1 sur 5 000 (étude Share the Luck). Votre profil va encore au-delà.",
      "Pour situer : réussir un trou en un au golf, c'est environ 1 sur 12 500 pour un amateur (source : National Hole-in-One Registry). Votre rareté dépasse ce coup de maître.",
      "Repère chiffré : pêcher un homard bleu, c'est environ 1 sur 2 millions (estimation des biologistes marins). Une vraie pièce de collection, comme vous." ] },
  ];
  function statRarete(surN, graine){
    const palier = STATS_RARETE.find(p => surN <= p.max) || STATS_RARETE[STATS_RARETE.length - 1];
    const i = Math.abs(graine) % palier.images.length;
    return palier.images[i];
  }
  // graine stable : longueur cumulée des noms (ne bouge pas d'un chargement à l'autre)
  function graineProfil(res){
    const a = (res.dominante && res.dominante.nom) || '';
    const b = (res.secondaires && res.secondaires[0] && res.secondaires[0].nom) || '';
    let g = 0; for (const c of (a + b)) g += c.charCodeAt(0); return g;
  }

  // Phrase signature : la rareté en "1 sur N" + une stat amusante qui change selon le palier
  function phraseSignature(res, rar){
    const dom = res.dominante;
    const sec = (res.secondaires && res.secondaires[0]) ? res.secondaires[0] : null;
    if (rar && rar.surN) {
      const stat = statRarete(rar.surN, graineProfil(res));
      const qui = (sec && rar.combi)
        ? `Votre duo ${dom.nom} et ${sec.nom}`
        : `Votre profil ${dom.nom}`;
      return `${qui} se rencontre chez environ 1 personne sur ${rar.surN.toLocaleString('fr-FR')}. ${stat}`;
    }
    // repli si la rareté n'est pas calculable
    if (sec && rar && rar.combi) {
      return `Votre duo ${dom.nom} et ${sec.nom} dessine une signature peu commune.`;
    }
    return `Votre profil ${dom.nom} dessine une signature peu commune.`;
  }

  // Backend IA (Vercel) : génère toutes les sections du portrait en parallèle.
  const BACKEND_URL = "https://sinea-profile-ia.vercel.app/api/generer";

  // Convertit le gras markdown **texte** en <strong>
  function mdInline(t){
    return String(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }
  // Met en forme un contenu IA : sous-titres en gras détachés, paragraphes aérés
  function paras(t){
    const blocs = String(t).split("\n").filter(p => p.trim());
    let out = "";
    for (const bloc of blocs){
      const m = mdInline(bloc.trim());
      // Si le bloc est entièrement un sous-titre en gras, le styler comme sous-titre
      if (m.startsWith('<strong>') && m.endsWith('</strong>') && (m.match(/<strong>/g) || []).length === 1){
        const inner = m.replace('<strong>','').replace('</strong>','');
        out += `<p class="r-ia-subtitle">${inner}</p>`;
      } else {
        out += `<p>${m}</p>`;
      }
    }
    return out;
  }

  // Appelle le backend UNE fois : il génère toutes les sections en parallèle côté serveur.
  async function callWorker(res){
    const payload = {
      profil: {
        dominante: res.dominante.nom,
        famille: res.dominante.famille,
        secondaires: res.secondaires.map(s=>s.nom),
        blend: res.blend || {},
        bigFive: res.scoresBigFive
      },
      tensions: res.tensions || [],
      reponses_ouvertes: Object.assign({}, res.reponsesOuvertes || {}, openAnswers),
      forces_validees: Object.keys(validations).filter(k => k.startsWith('force_') && validations[k]).map(k => validLabels[k]).filter(Boolean),
      naturel_adapte: (res.naturelAdapte ? { naturel: res.naturelAdapte.naturel, adapte: res.naturelAdapte.adapte, ecarts: res.naturelAdapte.ecarts } : {}),
      cout_adaptation: (res.naturelAdapte ? res.naturelAdapte.cout : 'modéré'),
      // Spé déterminée par le lien (manager / commercial / classic)
      spe: (res.diagType && res.diagType !== 'classic') ? res.diagType : null,
      // Mode recrutement : le back génère la restitution candidat allégée
      mode: res.modeCampagne === 'recrutement' ? 'recrutement' : null,
      style_dominant: res.speStyle || null,
      // Dimensions enrichies calculées par l'app
      contextuel: res.contextuel || {},
      contextuel_plus: res.contextuelPlus || {},
      fiabilite: res.fiabilite || null,
      spe_dims: res.speDims || {}
    };
    const r = await fetch(BACKEND_URL, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error("Backend "+r.status);
    const d = await r.json();
    if(!d.ok) throw new Error(d.erreur||"Erreur backend");
    return d.contenu;
  }

  // Affiche une section, avec repli si elle a échoué.
  // Génère le HTML des 4 familles (avec mise en avant de celle de la personne)
  function htmlFamilles(familleActive) {
    const famKey = (familleActive || '').toUpperCase();
    const familles = [
      { key: 'RELATION', nom: 'Relation', essence: 'Tisser les liens, créer l\'harmonie, prendre soin du collectif.' },
      { key: 'ACTION', nom: 'Action', essence: 'Avancer, décider, transformer l\'énergie en résultats.' },
      { key: 'STRUCTURE', nom: 'Structure', essence: 'Organiser, fiabiliser, bâtir des fondations solides.' },
      { key: 'VISION', nom: 'Vision', essence: 'Imaginer, explorer, ouvrir des horizons nouveaux.' },
    ];
    return familles.map(f => {
      const c = COULEURS_FAMILLE[f.key] || COULEURS_FAMILLE.VISION;
      const active = f.key === famKey ? ' r-famille-active' : '';
      const badge = f.key === famKey ? '<span class="r-famille-vous">Votre famille</span>' : '';
      return `
        <div class="r-famille-card${active}" style="--fc1:${c.c1};--fc2:${c.c2};">
          <div class="r-famille-pastille" style="background:linear-gradient(135deg, ${c.c1}, ${c.c2});"></div>
          <div class="r-famille-nom">${f.nom}${badge}</div>
          <p class="r-famille-essence">${f.essence}</p>
        </div>`;
    }).join('');
  }

  // Génère le HTML du bloc compatibilités à partir de la famille dominante
  function htmlCompatibilites(famille) {
    const famKey = (famille || '').toUpperCase();
    const c = COMPATIBILITES[famKey];
    if (!c) return '';
    const labelFam = LABELS_FAMILLE[famKey] || '';
    const carte = (data, type) => {
      const fam = COULEURS_FAMILLE[data.fam] || COULEURS_FAMILLE.VISION;
      const badge = type === 'forte' ? 'Synergie naturelle' : (type === 'belle' ? 'Belle complémentarité' : 'Demande de l\'attention');
      return `
        <div class="r-compat-card">
          <div class="r-compat-bar" style="background:linear-gradient(180deg, ${fam.c1}, ${fam.c2});"></div>
          <div class="r-compat-in">
            <div class="r-compat-badge r-compat-${type}">${badge}</div>
            <div class="r-compat-titre">${data.titre}</div>
            <p class="r-compat-txt">${data.txt}</p>
            ${data.conseil ? `<div class="r-compat-conseil"><span class="r-compat-conseil-label">Le conseil</span>${data.conseil}</div>` : ''}
          </div>
        </div>`;
    };
    // carte "avec votre propre famille"
    const mf = MEME_FAMILLE[famKey];
    const famCouleur = COULEURS_FAMILLE[famKey] || COULEURS_FAMILLE.VISION;
    let carteMemeFamille = '';
    if (mf) {
      carteMemeFamille = `
        <div class="r-compat-card r-compat-card-soi">
          <div class="r-compat-bar" style="background:linear-gradient(180deg, ${famCouleur.c1}, ${famCouleur.c2});"></div>
          <div class="r-compat-in">
            <div class="r-compat-badge r-compat-soi">Votre famille</div>
            <div class="r-compat-titre">${mf.titre}</div>
            <p class="r-compat-txt">${mf.txt}</p>
            ${mf.conseil ? `<div class="r-compat-conseil"><span class="r-compat-conseil-label">Le conseil</span>${mf.conseil}</div>` : ''}
          </div>
        </div>`;
    }
    // rappel de sa famille en intro
    const rappel = labelFam ? `<p class="r-compat-rappel">Vous appartenez à la famille <strong>${labelFam}</strong>. Voici comment vous vous accordez avec chaque profil.</p>` : '';
    return rappel + carteMemeFamille + carte(c.forte, 'forte') + carte(c.belle, 'belle') + carte(c.attention, 'attention');
  }

  // ============================================================
  // LES COMPATIBILITÉS D'ÉQUIPE (par famille, formulées avec nuance)
  // ============================================================
  const LABELS_FAMILLE = { RELATION: 'Relation', ACTION: 'Action', STRUCTURE: 'Structure', VISION: 'Vision' };
  // Comment bien communiquer avec les personnes de SA PROPRE famille
  const MEME_FAMILLE = {
    RELATION: { titre: 'Avec votre propre famille Relation', txt: "Vous partagez le même goût du lien et de l'harmonie. Ensemble, vous créez un climat chaleureux et soudé.", conseil: "Veillez à ce que l'attention aux autres ne fasse pas oublier la décision : nommez clairement qui tranche et quand." },
    ACTION: { titre: 'Avec votre propre famille Action', txt: "Vous partagez la même énergie et le même goût du résultat. Ensemble, vous avancez vite et fort.", conseil: "Accordez-vous des temps de respiration pour éviter la course permanente : planifiez les moments où l'on consolide avant de repartir." },
    STRUCTURE: { titre: 'Avec votre propre famille Structure', txt: "Vous partagez le même sens du cadre et de la fiabilité. Ensemble, vous bâtissez du solide.", conseil: "Laissez de la place à la spontanéité et à l'expérimentation : fixez-vous un espace où tout n'a pas besoin d'être cadré à l'avance." },
    VISION: { titre: 'Avec votre propre famille Vision', txt: "Vous partagez le même goût des idées et des horizons larges. Ensemble, vous imaginez grand.", conseil: "Désignez qui transforme les idées en actions concrètes : sans cela, les belles intentions risquent de rester en l'air." },
  };
  // Pour chaque famille : avec qui la synergie est naturelle, et avec qui la complémentarité demande de l'attention.
  const COMPATIBILITES = {
    RELATION: {
      forte: { fam: 'VISION', titre: 'Avec les profils Vision', txt: "Votre sens du lien donne corps aux idées qu'ils imaginent. Ensemble, vous transformez une vision en aventure collective portée par les gens.", conseil: "Proposez-leur de porter leurs idées auprès de l'équipe, c'est là que votre duo brille." },
      belle: { fam: 'STRUCTURE', titre: 'Avec les profils Structure', txt: "Vous apportez la chaleur humaine, ils apportent le cadre. Cette alliance crée des équipes à la fois solides et soudées.", conseil: "Laissez-leur poser le cadre, et occupez-vous d'embarquer les personnes dedans." },
      attention: { fam: 'ACTION', titre: 'Avec les profils Action', txt: "Leur rythme rapide et votre attention aux personnes se complètent quand vous accordez vos tempos. Posez ensemble le bon équilibre entre vitesse et écoute.", conseil: "Convenez en amont des moments où l'on accélère et de ceux où l'on prend soin du collectif." },
    },
    ACTION: {
      forte: { fam: 'STRUCTURE', titre: 'Avec les profils Structure', txt: "Votre énergie avance, leur rigueur sécurise. Ensemble, vous transformez l'élan en résultats qui tiennent dans la durée.", conseil: "Confiez-leur le suivi et le cadrage, gardez pour vous l'impulsion et la mise en mouvement." },
      belle: { fam: 'VISION', titre: 'Avec les profils Vision', txt: "Ils ouvrent les horizons, vous les atteignez. Cette alliance donne des projets ambitieux qui passent vraiment à l'action.", conseil: "Demandez-leur le cap à 3 ans, puis transformez-le en plan d'action des 3 prochains mois." },
      attention: { fam: 'RELATION', titre: 'Avec les profils Relation', txt: "Votre rythme et leur attention aux personnes se renforcent quand vous accordez vos tempos. Gardez ensemble le lien autant que la cadence.", conseil: "Avant de lancer un sprint, prenez un instant avec eux pour vérifier que l'équipe suit." },
    },
    STRUCTURE: {
      forte: { fam: 'ACTION', titre: 'Avec les profils Action', txt: "Votre cadre canalise leur énergie, leur élan donne vie à vos plans. Ensemble, vous alliez fiabilité et mouvement.", conseil: "Posez le cadre une fois pour toutes, puis laissez-leur la liberté d'avancer dedans." },
      belle: { fam: 'RELATION', titre: 'Avec les profils Relation', txt: "Vous posez la structure, ils tissent le lien. Cette alliance crée des équipes organisées et humaines à la fois.", conseil: "Appuyez-vous sur eux pour faire accepter vos process, ils savent les rendre désirables." },
      attention: { fam: 'VISION', titre: 'Avec les profils Vision', txt: "Leur foisonnement d'idées et votre besoin de cadre se complètent quand vous valorisez l'exploration avant de structurer. Laissez de l'espace à l'idée avant de l'ordonner.", conseil: "Accordez-leur un temps d'idéation libre, puis proposez de structurer ce qui est ressorti." },
    },
    VISION: {
      forte: { fam: 'RELATION', titre: 'Avec les profils Relation', txt: "Vos idées prennent vie grâce à leur talent pour embarquer les gens. Ensemble, vous donnez du sens et de l'âme aux projets.", conseil: "Confiez-leur la diffusion de votre vision, ils la rendront vivante pour toute l'équipe." },
      belle: { fam: 'ACTION', titre: 'Avec les profils Action', txt: "Vous imaginez loin, ils concrétisent vite. Cette alliance transforme les grandes idées en réalisations tangibles.", conseil: "Donnez-leur une idée claire et un premier pas concret, ils feront le reste." },
      attention: { fam: 'STRUCTURE', titre: 'Avec les profils Structure', txt: "Votre créativité et leur sens du cadre se complètent quand vous accueillez la structure comme un appui. Ensemble, donnez forme à l'idée sans l'enfermer.", conseil: "Présentez-leur vos idées comme des pistes à structurer ensemble, pas comme des décisions figées." },
    },
  };

  // ============================================================
  // LA CARTE PARTAGEABLE (image carrée à télécharger pour LinkedIn/Insta)
  // ============================================================
  const COULEURS_FAMILLE = {
    RELATION: { c1: '#F98272', c2: '#F9A876', label: 'Relation' },
    ACTION:   { c1: '#F5A623', c2: '#FAC56E', label: 'Action' },
    STRUCTURE:{ c1: '#3EADFF', c2: '#7CC8FF', label: 'Structure' },
    VISION:   { c1: '#5E59C7', c2: '#8E89E8', label: 'Vision' },
  };
  const PHRASES_CARTE = {
    "La Tisseuse": "Je relie les personnes et fais tenir les liens.",
    "Le Passeur": "Je relie les personnes et transmets ce qui compte.",
    "Le Roc": "Je suis le point d'appui sur lequel on compte.",
    "Le Diplomate": "J'accorde les points de vue avec finesse.",
    "L'Ambassadeur": "Je porte haut les idées et rassemble.",
    "Le Capitaine": "Je donne le cap et j'entraîne vers le but.",
    "L'Indomptable": "J'ouvre la voie et j'ose là où d'autres hésitent.",
    "Le Champion": "Je suis le moteur qui entraîne vers le résultat.",
    "Le Pionnier": "J'explore et j'ouvre des chemins neufs.",
    "Le Résilient": "Je rebondis et je tiens dans la durée.",
    "L'Architecte": "Je construis la structure et la vision d'ensemble.",
    "La Sentinelle": "Je protège et j'anticipe ce qui vient.",
    "Le Gardien": "Je veille à la justesse et à la solidité.",
    "L'Orfèvre": "Je cisèle le détail juste et le travail bien fait.",
    "Le Stratège": "Je lis loin et je pose les bons coups.",
    "Le Conteur": "Je donne du sens et j'embarque par le récit.",
    "L'Étincelle": "J'allume les idées et l'énergie créative.",
    "Le Veilleur": "Je perçois les signaux faibles avant les autres.",
    "L'Explorateur": "Je repousse les horizons par curiosité.",
    "Le Révélateur": "Je fais émerger le potentiel des autres.",
  };

  function genererCarte(archetype, famille, slug, prenom) {
    // s'assurer que la police est chargée avant de dessiner (sinon police générique sur le PNG)
    const lancer = () => genererCarteRendu(archetype, famille, slug, prenom);
    if (document.fonts && document.fonts.ready) {
      Promise.all([
        document.fonts.load('800 76px Poppins'),
        document.fonts.load('600 30px Poppins'),
        document.fonts.load('400 34px Poppins'),
        document.fonts.load('700 38px Poppins'),
      ]).then(() => document.fonts.ready).then(lancer).catch(lancer);
    } else {
      lancer();
    }
  }

  function genererCarteRendu(archetype, famille, slug, prenom) {
    const taille = 1080; // carré HD pour les réseaux
    const canvas = document.createElement('canvas');
    canvas.width = taille; canvas.height = taille;
    const ctx = canvas.getContext('2d');
    const fam = COULEURS_FAMILLE[(famille || '').toUpperCase()] || COULEURS_FAMILLE.VISION;

    // fond dégradé diagonal
    const grad = ctx.createLinearGradient(0, 0, taille, taille);
    grad.addColorStop(0, fam.c1); grad.addColorStop(1, fam.c2);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, taille, taille);

    // halo lumineux central
    const halo = ctx.createRadialGradient(taille/2, taille*0.42, 60, taille/2, taille*0.42, taille*0.6);
    halo.addColorStop(0, 'rgba(255,255,255,0.22)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, taille, taille);

    // fonction de dessin du texte (appelée après chargement de l'image)
    const dessinerTexte = () => {
      // logo Sinéa en haut
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '700 38px Poppins, Arial, sans-serif';
      ctx.fillText('SINÉA', taille/2, 92);
      ctx.font = '500 22px Poppins, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('PROFIL', taille/2, 124);

      // prénom de la personne (si disponible)
      if (prenom) {
        ctx.font = '600 30px Poppins, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(prenom, taille/2, taille*0.605);
      }

      // nom de l'archétype (grand)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 76px Poppins, Arial, sans-serif';
      ctx.fillText(archetype, taille/2, taille*0.72);

      // famille (pastille)
      ctx.font = '600 30px Poppins, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('Famille ' + fam.label, taille/2, taille*0.72 + 52);

      // phrase signature (avec retour à la ligne automatique)
      const phrase = PHRASES_CARTE[archetype] || '';
      ctx.font = '400 34px Poppins, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      const mots = phrase.split(' ');
      let ligne = ''; let y = taille*0.84; const maxW = taille*0.82; const lh = 46;
      const lignes = [];
      mots.forEach(m => {
        const test = ligne ? ligne + ' ' + m : m;
        if (ctx.measureText(test).width > maxW && ligne) { lignes.push(ligne); ligne = m; }
        else ligne = test;
      });
      if (ligne) lignes.push(ligne);
      lignes.forEach((l, i) => ctx.fillText(l, taille/2, y + i*lh));

      // mention bas
      ctx.font = '500 24px Poppins, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('sineaformation.fr', taille/2, taille - 48);

      // télécharger
      telechargerCanvas(canvas, archetype);
    };

    // dessiner le personnage (rond, au centre haut) puis le texte
    if (slug) {
      const img = new Image();
      img.onload = () => {
        const d = taille*0.34; const cx = taille/2; const cy = taille*0.36;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, d/2, 0, Math.PI*2); ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 8; ctx.stroke();
        ctx.clip();
        ctx.drawImage(img, cx - d/2, cy - d/2, d, d);
        ctx.restore();
        dessinerTexte();
      };
      img.onerror = () => dessinerTexte();
      img.src = slug + '.webp';
    } else {
      dessinerTexte();
    }
  }

  function telechargerCanvas(canvas, archetype) {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Mon-archetype-Sinea-${archetype.replace(/[^a-zA-Z]/g, '')}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const btn = document.getElementById('carte-share-btn');
      if (btn) { const old = btn.textContent; btn.textContent = 'Carte téléchargée'; setTimeout(() => { btn.textContent = old; }, 2200); }
    }, 'image/png');
  }

  function partagerModeEmploi(me, archetype, cible){
    const lignes = [];
    const estManager = cible === 'manager';
    const titre = estManager ? `Mon mode d'emploi pour mon manager · ${archetype}` : `Mon mode d'emploi · ${archetype}`;
    lignes.push(titre);
    lignes.push('');
    if (me.intro) { lignes.push(me.intro); lignes.push(''); }

    if (estManager && me.avec_manager) {
      const mgr = me.avec_manager;
      if (Array.isArray(mgr.ce_dont_jai_besoin)) {
        lignes.push('Ce dont j\'ai besoin de mon manager :');
        mgr.ce_dont_jai_besoin.forEach(x => lignes.push('· ' + x)); lignes.push('');
      }
      if (Array.isArray(mgr.comment_me_motiver)) {
        lignes.push('Comment me motiver et me faire progresser :');
        mgr.comment_me_motiver.forEach(x => lignes.push('· ' + x)); lignes.push('');
      }
      if (mgr.comment_me_faire_un_retour) { lignes.push('Comment me faire un retour : ' + mgr.comment_me_faire_un_retour); lignes.push(''); }
    } else {
      const col = me.avec_collegues || { pour_bien_travailler: me.pour_bien_travailler, ce_qui_me_motive: me.ce_qui_me_motive, ma_communication: me.ma_communication };
      if (Array.isArray(col.pour_bien_travailler)) {
        lignes.push('Pour bien travailler avec moi :');
        col.pour_bien_travailler.forEach(x => lignes.push('· ' + x)); lignes.push('');
      }
      if (Array.isArray(col.ce_qui_me_motive)) {
        lignes.push('Ce qui me motive :');
        col.ce_qui_me_motive.forEach(x => lignes.push('· ' + x)); lignes.push('');
      }
      if (col.ma_communication) { lignes.push('Ma communication : ' + col.ma_communication); lignes.push(''); }
    }
    if (me.en_un_mot) lignes.push(me.en_un_mot);
    lignes.push('');
    lignes.push('Réalisé avec Sinéa Profile');
    const texte = lignes.join('\n');

    const btnId = estManager ? 'mode-emploi-share-mgr' : 'mode-emploi-share-col';
    if (navigator.share) {
      navigator.share({ title: titre, text: texte }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(texte).then(() => {
        const btn = document.getElementById(btnId);
        if (btn) { const old = btn.textContent; btn.textContent = 'Copié, prêt à partager'; setTimeout(() => { btn.textContent = old; }, 2200); }
      }).catch(() => {});
    }
  }
  function partagerModeEmploiOLD(me, archetype){
    // construire un texte propre à partager
    const lignes = [];
    lignes.push(`Mon mode d'emploi · ${archetype}`);
    lignes.push('');
    if (me.intro) lignes.push(me.intro);
    lignes.push('');
    if (Array.isArray(me.pour_bien_travailler)) {
      lignes.push('Pour bien travailler avec moi :');
      me.pour_bien_travailler.forEach(x => lignes.push('· ' + x));
      lignes.push('');
    }
    if (Array.isArray(me.ce_qui_me_motive)) {
      lignes.push('Ce qui me motive :');
      me.ce_qui_me_motive.forEach(x => lignes.push('· ' + x));
      lignes.push('');
    }
    if (Array.isArray(me.ce_qui_me_freine)) {
      lignes.push('Ce qui m\'aide à donner le meilleur :');
      me.ce_qui_me_freine.forEach(x => lignes.push('· ' + x));
      lignes.push('');
    }
    if (me.ma_communication) { lignes.push('Ma communication : ' + me.ma_communication); lignes.push(''); }
    if (me.en_un_mot) lignes.push(me.en_un_mot);
    lignes.push('');
    lignes.push('Réalisé avec Sinéa Profile');
    const texte = lignes.join('\n');
    // partage natif si disponible (mobile), sinon copie presse-papier
    if (navigator.share) {
      navigator.share({ title: `Mon mode d'emploi · ${archetype}`, text: texte }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(texte).then(() => {
        const btn = document.getElementById('mode-emploi-share');
        if (btn) { const old = btn.textContent; btn.textContent = 'Copié, prêt à partager'; setTimeout(() => { btn.textContent = old; }, 2200); }
      }).catch(() => {});
    }
  }

  function poseSection(elId, tag, contenu, fallback){
    const el = document.getElementById(elId);
    if(!el) return;
    if(contenu && typeof contenu === 'string'){
      el.innerHTML = `<div class="r-ia-tag">${tag}</div>` + paras(contenu);
    } else {
      el.innerHTML = `<div class="r-ia-tag">${tag}</div>` + fallback;
    }
  }

  // Au second passage (module commercial/manager), on oriente directement
  // la personne vers SA nouvelle analyse plutôt que de la laisser en haut du socle.
  function orienterVersModule(res){
    const type = (res.diagType || 'classic').toLowerCase();
    if (type === 'classic') return;
    const bloc = document.getElementById('b-spe');
    if (!bloc) return;
    const libelle = type === 'commercial' ? 'commerciale' : 'managériale';
    // bannière en haut de la restitution
    const hero = document.getElementById('r-hero');
    if (hero && !document.getElementById('r-bandeau-module')) {
      const b = document.createElement('div');
      b.id = 'r-bandeau-module';
      b.className = 'r-bandeau-module';
      b.innerHTML = `<span>Votre analyse ${libelle} est prête.</span><button type="button">La découvrir ↓</button>`;
      b.querySelector('button').onclick = () => bloc.scrollIntoView({ behavior: 'smooth', block: 'start' });
      hero.parentNode.insertBefore(b, hero.nextSibling);
    }
    // La personne découvre d'abord son personnage : le bandeau signale le module, sans forcer le défilement.
  }

  async function generateIA(res){
    initPortraitPdf();
    orienterVersModule(res);
    const dom=res.dominante;
    const dc=contenu(dom.nom);
    const sec=res.secondaires.map(s=>s.nom).join(' et ');
    const situ=dc.en_situation||{};
    try{
      // Si on revoit une analyse sauvegardée : on utilise le contenu figé, sans rappeler l'IA
      const c = res.contenuFige ? res.contenuFige : await callWorker(res);
      // Sauvegarder l'analyse générée (figée) pour la revoir depuis l'espace perso
      if (!res.contenuFige) {
        try {
          const typeAnalyse = (res.diagType && res.diagType !== 'classic') ? res.diagType : 'socle';
          // on sauvegarde le contenu IA + un profil léger pour pouvoir tout réafficher
          const profilLeger = {
            dominante: res.dominante,
            secondaires: res.secondaires,
            scoresBigFive: res.scoresBigFive,
            radarFamilles: res.radarFamilles,
            blend: res.blend,
            naturelAdapte: res.naturelAdapte,
            contextuel: res.contextuel,
            contextuelPlus: res.contextuelPlus,
            fiabilite: res.fiabilite,
            speStyle: res.speStyle,
            speStyleScores: res.speStyleScores,
            speDims: res.speDims,
            diagType: res.diagType,
          };
          if (window.App && App.sauverAnalyse) App.sauverAnalyse(typeAnalyse, { contenu: c, profil: profilLeger });
        } catch (e) {}
      }
      poseSection('ia-ouverture','Votre portrait', c.ouverture, `<p>${dc.essence||''}</p>`);
      poseSection('ia-alchimie','Lecture croisée', c.alchimie,
        `<p>Votre combinaison de ${dom.nom} et de ${sec} compose une signature singulière.</p>`);
      poseSection('ia-bigfive','Ce que révèle le croisement de vos dimensions', c.temperament,
        `<p>Le croisement de vos dimensions dessine un tempérament cohérent avec votre profil ${dom.nom}.</p>`);
      poseSection('ia-situation','Votre profil en action', c.situation,
        `<p>${situ.reunion||''}</p><p>${situ.pression||''}</p>`);
      poseSection('ia-angles','Vos angles morts', c.angles_relationnels,
        `<p>À force de jouer vos forces, certains aspects de votre impact peuvent vous échapper.</p>`);

      // Le mode d'emploi de moi-même (fiche partageable, 2 parties : collègues + manager)
      const meBloc = document.getElementById('mode-emploi-bloc');
      const meContenu = document.getElementById('mode-emploi-contenu');
      if (meBloc && meContenu && c.mode_emploi && !c.mode_emploi._erreur) {
        const me = c.mode_emploi;
        const liste = (arr) => Array.isArray(arr) ? arr.map(x => `<li>${x}</li>`).join('') : '';
        // compat : ancien format (à la racine) ou nouveau (avec_collegues / avec_manager)
        const col = me.avec_collegues || { pour_bien_travailler: me.pour_bien_travailler, ce_qui_me_motive: me.ce_qui_me_motive, ma_communication: me.ma_communication };
        const mgr = me.avec_manager || null;

        const blocCollegues = `
          <div class="r-me-section">
            <div class="r-me-label">Pour bien travailler avec moi</div>
            <ul class="r-me-list">${liste(col.pour_bien_travailler)}</ul>
          </div>
          ${Array.isArray(col.ce_qui_me_motive) ? `<div class="r-me-section"><div class="r-me-label">Ce qui me motive</div><ul class="r-me-list">${liste(col.ce_qui_me_motive)}</ul></div>` : ''}
          ${col.ma_communication ? `<div class="r-me-section"><div class="r-me-label">Ma communication</div><p class="r-me-comm">${col.ma_communication}</p></div>` : ''}
        `;
        const blocManager = mgr ? `
          <div class="r-me-section">
            <div class="r-me-label">Ce dont j'ai besoin de mon manager</div>
            <ul class="r-me-list">${liste(mgr.ce_dont_jai_besoin)}</ul>
          </div>
          ${Array.isArray(mgr.comment_me_motiver) ? `<div class="r-me-section"><div class="r-me-label">Comment me motiver et me faire progresser</div><ul class="r-me-list">${liste(mgr.comment_me_motiver)}</ul></div>` : ''}
          ${mgr.comment_me_faire_un_retour ? `<div class="r-me-section"><div class="r-me-label">Comment me faire un retour</div><p class="r-me-comm">${mgr.comment_me_faire_un_retour}</p></div>` : ''}
        ` : '';

        meContenu.innerHTML = `
          <div class="r-me-perso">${dom.nom}</div>
          ${me.intro ? `<p class="r-me-intro">${me.intro}</p>` : ''}
          ${mgr ? `<div class="r-me-tabs">
            <button class="r-me-tab active" data-tab="collegues">Avec mes collègues</button>
            <button class="r-me-tab" data-tab="manager">Avec mon manager</button>
          </div>` : ''}
          <div class="r-me-panel" id="r-me-panel-collegues">${blocCollegues}</div>
          ${mgr ? `<div class="r-me-panel" id="r-me-panel-manager" style="display:none;">${blocManager}</div>` : ''}
          ${me.en_un_mot ? `<div class="r-me-mot">${me.en_un_mot}</div>` : ''}
          <div class="r-me-shares">
            <button class="r-me-share" id="mode-emploi-share-col">Partager à mes collègues</button>
            ${mgr ? `<button class="r-me-share r-me-share-2" id="mode-emploi-share-mgr">Partager à mon manager</button>` : ''}
          </div>
        `;
        meBloc.style.display = 'block';

        // onglets
        const tabs = meContenu.querySelectorAll('.r-me-tab');
        tabs.forEach(tab => {
          tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const which = tab.getAttribute('data-tab');
            const pc = document.getElementById('r-me-panel-collegues');
            const pm = document.getElementById('r-me-panel-manager');
            if (pc) pc.style.display = which === 'collegues' ? 'block' : 'none';
            if (pm) pm.style.display = which === 'manager' ? 'block' : 'none';
          };
        });

        // boutons de partage (collègues + manager)
        const shareCol = document.getElementById('mode-emploi-share-col');
        if (shareCol) shareCol.onclick = () => partagerModeEmploi(me, dom.nom, 'collegues');
        const shareMgr = document.getElementById('mode-emploi-share-mgr');
        if (shareMgr) shareMgr.onclick = () => partagerModeEmploi(me, dom.nom, 'manager');
      }

      // Les 3 dynamiques entre les forces (format JSON : paires)
      const dynEl = document.getElementById('ia-dynamiques');
      if (dynEl) {
        let dyn = c.combo_dynamiques;
        // tolérance : contenu sauvegardé en chaîne JSON (anciennes analyses) → on le parse
        if (typeof dyn === 'string') {
          const propre = dyn.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
          try { dyn = JSON.parse(propre); } catch (e) { dyn = null; }
        }
        if (dyn && !Array.isArray(dyn) && Array.isArray(dyn.paires)) dyn = dyn.paires;
        if (dyn && Array.isArray(dyn) && dyn.length) {
          dynEl.innerHTML = dyn.map(d => `
            <div class="dyn-card">
              <div class="dyn-paire">${d.paire || ''}</div>
              <div class="dyn-titre">${d.titre || ''}</div>
              <p class="dyn-desc">${d.desc || ''}</p>
            </div>`).join('');
        } else {
          dynEl.innerHTML = `<div class="r-card"><p>Vos trois forces s'équilibrent et se renforcent mutuellement.</p></div>`;
        }
      }

      // Pépites générées par IA (faits vérifiables, calés sur le profil) : remplacent le fallback
      if (c.pepites && typeof c.pepites === 'object') {
        const majPepite = (id, txt) => {
          if (!txt) return;
          const el = document.getElementById(id);
          if (!el) return;
          const cible = el.querySelector('.r-pepite-txt') || el;
          cible.textContent = txt;
        };
        majPepite('pepite-rarete', c.pepites.rarete);
        majPepite('pepite-trait', c.pepites.trait);
        majPepite('pepite-energie', c.pepites.energie);
      }

      // Dimensions profondes (socle)
      poseSection('ia-dim_stress','Sous tension', c.dim_stress, `<p>Votre rapport au stress reflète votre tempérament.</p>`);
      poseSection('ia-dim_motivation','Vos moteurs', c.dim_motivation, `<p>Vos moteurs profonds guident vos choix.</p>`);
      poseSection('ia-dim_risque','Votre boussole', c.dim_risque, `<p>Votre rapport au risque éclaire vos décisions.</p>`);
      poseSection('ia-dim_changement','Face au mouvement', c.dim_changement, `<p>Votre rapport au changement façonne votre adaptabilité.</p>`);
      poseSection('ia-dim_conflit','Dans la friction', c.dim_conflit, `<p>Votre posture face au conflit révèle votre style relationnel.</p>`);
      // Dimensions de pilotage (énergie, collaboration, autorité, reconnaissance)
      if (res.contextuelPlus) {
        const cp = res.contextuelPlus;
        const fb = (dim) => `<p>${(DIM_PLUS_FALLBACK[dim] && DIM_PLUS_FALLBACK[dim][cp[dim]]) || ''}</p>`;
        if (cp.energie) poseSection('ia-dim_energie','Votre tempo', c.dim_energie, fb('energie'));
        if (cp.collaboration) poseSection('ia-dim_collaboration','Avec les autres', c.dim_collaboration, fb('collaboration'));
        if (cp.autorite) poseSection('ia-dim_autorite','Vous et le cadre', c.dim_autorite, fb('autorite'));
        if (cp.reconnaissance) poseSection('ia-dim_reconnaissance','Votre carburant', c.dim_reconnaissance, fb('reconnaissance'));
      }

      // Bloc spé (manager OU commercial)
      // En repli, chaque dimension affiche la description de la position de la personne (jamais une phrase creuse).
      const fbSpe = (axe, txt) => { const v=(res.speDims||{})[axe]; const t=(SPE_DIM_DESC[axe]||{})[v]; return `<p>${t||txt}</p>`; };
      poseSection('ia-mgmt_croisement','Votre ADN de manager', c.mgmt_croisement, `<p>Votre personnalité nourrit directement votre posture de manager.</p>`);
      poseSection('ia-com_croisement','Votre ADN de commercial', c.com_croisement, `<p>Votre personnalité nourrit directement votre posture commerciale.</p>`);
      // Manager
      poseSection('ia-dim_delegation','Votre délégation', c.dim_delegation, fbSpe('delegation','Votre rapport à la délégation structure votre management.'));
      poseSection('ia-dim_feedback','Votre feedback', c.dim_feedback, fbSpe('feedback','Votre style de feedback influence votre équipe.'));
      poseSection('ia-dim_exigence',"Votre curseur d'exigence", c.dim_exigence, fbSpe('exigence_bienveillance','Votre équilibre exigence et bienveillance définit votre leadership.'));
      poseSection('ia-mgmt_moments_cles','Votre posture en situation', c.mgmt_moments_cles, `<p>Vos moments clés de manager révèlent votre style.</p>`);
      poseSection('ia-mgmt_formulations','Vos mots à vous', c.mgmt_formulations, `<p>Vos formulations personnalisées apparaissent à la génération de votre analyse.</p>`);
      poseSection('ia-mgmt_motivation_equipe','Motiver votre équipe', c.mgmt_motivation_equipe, `<p>Vous motivez votre équipe à votre manière.</p>`);
      poseSection('ia-mgmt_contextes_reussite','Analyse Sinéa', c.mgmt_contextes_reussite, `<p>Certains contextes révèlent le meilleur de votre management.</p>`);
      poseSection('ia-mgmt_synthese_leadership','En synthèse', c.mgmt_synthese_leadership, `<p>Votre signature de leadership est unique.</p>`);
      // Commercial
      poseSection('ia-dim_closing','Votre closing', c.dim_closing, fbSpe('closing','Votre rapport au closing structure votre vente.'));
      poseSection('ia-dim_objection','Face aux objections', c.dim_objection, fbSpe('objection',"Votre posture face à l'objection révèle votre aisance."));
      poseSection('ia-dim_chasseur','Analyse Sinéa', c.dim_chasseur, fbSpe('chasseur_eleveur','Votre tempérament commercial oriente votre approche.'));
      poseSection('ia-com_moments_cles','Votre posture en situation', c.com_moments_cles, `<p>Vos moments clés de vente révèlent votre style.</p>`);
      poseSection('ia-com_formulations','Vos mots à vous', c.com_formulations, `<p>Vos formulations personnalisées apparaissent à la génération de votre analyse.</p>`);
      poseSection('ia-com_relation_client','Analyse Sinéa', c.com_relation_client, `<p>Vous construisez la relation client à votre manière.</p>`);
      poseSection('ia-com_contextes_reussite','Analyse Sinéa', c.com_contextes_reussite, `<p>Certains contextes révèlent le meilleur de votre vente.</p>`);
      poseSection('ia-com_synthese_vendeur','En synthèse', c.com_synthese_vendeur, `<p>Votre signature commerciale est unique.</p>`);

      // Plan de progression dans le bloc métier : angles morts + 3 axes concrets
      const ap = c.mgmt_angles_plan || c.com_angles_plan;
      planSpeCourant = (ap && Array.isArray(ap.plan)) ? ap.plan : null;
      const elPlan = document.getElementById('ia-spe_plan');
      if (elPlan){
        if (ap && (ap.angles || (Array.isArray(ap.plan) && ap.plan.length))){
          let ph = `<div class="r-ia-tag">Votre plan de progression</div>`;
          if (ap.angles) ph += `<p class="spe-angles">${mdInline(String(ap.angles))}</p>`;
          if (Array.isArray(ap.plan)) ph += ap.plan.map((a,i)=>`<div class="spe-plan-card"><span class="spe-plan-num">Axe ${i+1}</span><div class="spe-plan-titre">${a.titre||''}</div><p class="spe-plan-desc">${a.desc||''}</p></div>`).join('');
          elPlan.innerHTML = ph;
        } else {
          elPlan.innerHTML = `<div class="r-ia-tag">Votre plan de progression</div><p>Vos axes de progression personnalisés apparaissent à la génération de votre analyse.</p>`;
        }
      }

      // Actions (depuis le plan de la spé si présent, sinon leviers)
      const plan = (c.mgmt_angles_plan && c.mgmt_angles_plan.plan) || (c.com_angles_plan && c.com_angles_plan.plan);
      if(plan && Array.isArray(plan)){
        document.getElementById('ia-actions').innerHTML=`<div class="r-ia-tag">L'IA propose, vous choisissez</div>
          <p class="r-hint" style="margin-top:0">Sélectionnez les pistes à développer.</p><div class="r-actions-grid">`+
          plan.map((a,i)=>`<div class="r-action" id="act-${i}" onclick="Result.toggleAction(${i})"><div class="r-action-check">✓</div><p>${a.titre}. ${a.desc}</p></div>`).join('')+`</div>`;
      } else { posefallbackActions(dc); }
    }catch(e){
      // Repli complet : tout le contenu d'exemple s'affiche
      poseSection('ia-ouverture','Votre portrait', null, `<p>${dc.essence||''}</p>`);
      poseSection('ia-alchimie','Lecture croisée', null, `<p>Votre combinaison de ${dom.nom} et de ${sec} compose une signature singulière.</p>`);
      poseSection('ia-bigfive','Votre tempérament', null, `<p>Le croisement de vos dimensions dessine un tempérament cohérent avec votre profil.</p>`);
      poseSection('ia-situation','Votre profil en action', null, `<p>${situ.reunion||''}</p><p>${situ.pression||''}</p>`);
      poseSection('ia-angles','Vos angles morts', null, `<p>À force de jouer vos forces, certains aspects de votre impact peuvent vous échapper.</p>`);
      // Dimensions contextuelles : repli générique
      poseSection('ia-dim_stress','Sous tension', null, `<p>Votre rapport au stress reflète votre tempérament.</p>`);
      poseSection('ia-dim_motivation','Vos moteurs', null, `<p>Vos moteurs profonds guident vos choix.</p>`);
      poseSection('ia-dim_risque','Votre boussole', null, `<p>Votre rapport au risque éclaire vos décisions.</p>`);
      poseSection('ia-dim_changement','Face au mouvement', null, `<p>Votre rapport au changement façonne votre adaptabilité.</p>`);
      poseSection('ia-dim_conflit','Dans la friction', null, `<p>Votre posture face au conflit révèle votre style relationnel.</p>`);
      // Dimensions de pilotage : repli par règles (personnalisé selon le profil mesuré)
      if (res.contextuelPlus) {
        const cp = res.contextuelPlus;
        const fb = (dim) => `<p>${(DIM_PLUS_FALLBACK[dim] && DIM_PLUS_FALLBACK[dim][cp[dim]]) || ''}</p>`;
        if (cp.energie) poseSection('ia-dim_energie','Votre tempo', null, fb('energie'));
        if (cp.collaboration) poseSection('ia-dim_collaboration','Avec les autres', null, fb('collaboration'));
        if (cp.autorite) poseSection('ia-dim_autorite','Vous et le cadre', null, fb('autorite'));
        if (cp.reconnaissance) poseSection('ia-dim_reconnaissance','Votre carburant', null, fb('reconnaissance'));
      }
      posefallbackActions(dc);
    }
  }

  function posefallbackActions(dc){
    const zone = document.getElementById('ia-actions');
    if(!zone) return; // bloc retiré (mode candidat)
    const fb=(dc.leviers||['Affirmer vos besoins avec assurance','Oser le désaccord constructif']);
    zone.innerHTML=`<div class="r-ia-tag">Vos pistes d'action</div><div class="r-actions-grid">`+
      fb.map((l,i)=>`<div class="r-action" id="act-${i}" onclick="Result.toggleAction(${i})"><div class="r-action-check">✓</div><p>${l}</p></div>`).join('')+`</div>`;
  }

  // ---- Moment 3 : recueil d'avis (validation + matière pour les défis) ----
  const avis = {};

  function finishSeedup(){
    showMoment3();
  }

  function showMoment3(){
    const m3 = SINEA_DATA.moment3;
    let scr = document.getElementById('screen-moment3');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-moment3';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    const noteQ = m3.questions.find(q => q.type === 'note');
    const notesHtml = Array.from({length: noteQ.max}, (_, i) => {
      const v = i + 1;
      return `<button class="m3-note" id="m3n-${v}" onclick="Result.setNote(${v})">${v}</button>`;
    }).join('');
    const textQs = m3.questions.filter(q => q.type === 'texte_court').map(q => `
      <div class="m3-field">
        <label class="m3-q">${q.question}${q.optionnel ? ' <span class="m3-opt">(optionnel)</span>' : ''}</label>
        <textarea class="m3-input" rows="2" placeholder="${q.placeholder}" oninput="Result.setAvis('${q.id}', this.value)"></textarea>
      </div>`).join('');
    scr.innerHTML = `
      <div class="m3-scroll">
        <button class="qo-back" onclick="Result.backFromMoment3()">← Retour au portrait</button>
        <div class="m3-head">
          <div class="m3-kicker">Dernière étape</div>
          <h2 class="m3-title">Votre ressenti</h2>
          <p class="m3-sub">${m3.intro}</p>
        </div>
        <div class="m3-field m3-field-note">
          <label class="m3-q">${noteQ.question}</label>
          <div class="m3-notes">${notesHtml}</div>
          <div class="m3-notes-labels"><span>${noteQ.min_label}</span><span>${noteQ.max_label}</span></div>
        </div>
        ${textQs}
        <button class="btn-primary m3-submit" id="m3-submit" disabled onclick="Result.submitMoment3()">Découvrir mes défis SeedUp</button>
      </div>`;
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    window.scrollTo(0, 0);
  }

  function setNote(v){
    avis.AVIS_RESSEMBLANCE = v;
    const max = SINEA_DATA.moment3.questions.find(q => q.type === 'note').max;
    for (let i = 1; i <= max; i++) {
      document.getElementById('m3n-' + i).classList.toggle('sel', i <= v);
    }
    // la note rend le bouton actif (le reste est optionnel/incitatif)
    document.getElementById('m3-submit').disabled = false;
  }

  function setAvis(id, val){ avis[id] = val; }

  function backFromMoment3(){
    document.getElementById('screen-moment3').classList.remove('active');
    document.getElementById('screen-result').classList.add('active');
  }

  function backFromDefis(){
    document.getElementById('screen-defis').classList.remove('active');
    showMoment3();
  }

  function submitMoment3(){
    showDefis();
  }

  // ---- Écran des défis SeedUp ----
  const DEFIS_URL = "https://sinea-profile-ia.vercel.app/api/defis";

  async function showDefis(){
    let scr = document.getElementById('screen-defis');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-defis';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    // écran de chargement le temps de générer
    scr.innerHTML = `
      <div class="defis-scroll">
        <div class="defis-loading">
          <span class="mini-spin"></span>
          <p>Création de vos défis personnalisés...</p>
        </div>
      </div>`;
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    window.scrollTo(0, 0);

    // Construire le payload défis : profil + avis
    const payload = {
      profil: {
        dominante: RES.dominante.nom,
        famille: RES.dominante.famille,
        secondaires: RES.secondaires.map(s => s.nom),
        bigFive: RES.scoresBigFive
      },
      spe: (RES.diagType && RES.diagType !== 'classic') ? RES.diagType : null,
      avis: {
        resonance: avis.AVIS_RESONANCE || '',
        priorite: avis.AVIS_PRIORITE || '',
        defi_pro: avis.AVIS_DEFI_PRO || ''
      },
      plan_progression: (planSpeCourant || []).map(a => a.titre).filter(Boolean)
    };

    try {
      const r = await fetch(DEFIS_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error("Défis " + r.status);
      const d = await r.json();
      const defis = d.defis || d.contenu || [];
      renderDefis(scr, defis);
    } catch (e) {
      // Fallback : message clair si le backend n'est pas joignable
      renderDefis(scr, null);
    }
  }

  function renderDefis(scr, defis){
    let cards = '';
    if (defis && Array.isArray(defis) && defis.length) {
      cards = defis.map((df, i) => `
        <div class="defi-card">
          <div class="defi-num">Défi ${i + 1}</div>
          <h3 class="defi-titre">${df.titre || ''}</h3>
          <p class="defi-texte">${df.defi || df.description || ''}</p>
          ${df.duree ? `<div class="defi-meta">${df.duree} min · niveau ${df.niveau || 1}</div>` : ''}
        </div>`).join('');
    } else {
      cards = `<div class="defi-card"><p class="defi-texte">Vos défis personnalisés seront générés ici une fois l'application connectée à votre espace SeedUp.</p></div>`;
    }
    scr.innerHTML = `
      <div class="defis-scroll">
        <button class="qo-back" onclick="Result.backFromDefis()">← Retour</button>
        <div class="defis-head">
          <div class="defis-kicker">SeedUp</div>
          <h2 class="defis-title">Vos premiers défis</h2>
          <p class="defis-sub">Choisissez un défi par jour. Chacun ancre une prise de conscience de votre portrait dans votre quotidien.</p>
        </div>
        <div class="defis-list">${cards}</div>
        <div class="defis-foot">
          <p>Ces défis vous accompagnent sur les prochaines semaines, à votre rythme.</p>
        </div>
      </div>`;
    window.scrollTo(0, 0);
  }

  return { telechargerPortrait, telechargerFiche, setEmail, render, toggleValid, saveOpen, toggleAction, parierDim, finishSeedup, setNote, setAvis, submitMoment3, backFromMoment3, backFromDefis, htmlCompatibilites };
})();

// Exposer Result globalement (pour que controller.js puisse appeler Result.htmlCompatibilites)
window.Result = Result;
