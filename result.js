// ============================================================
// MODULE RESULT — Restitution premium COMPLÈTE
// 3 blocs + questions ouvertes + validation + 5 moments IA
// ============================================================
const Result = (() => {
  const FAM = { RELATION:'#F98272', ACTION:'#F9A876', STRUCTURE:'#5474F5', VISION:'#8884F0' };
  const BF_INFO = {
    E:['Extraversion','Réservé','Expansif'], A:['Agréabilité','Affirmé','Conciliant'],
    C:['Conscience','Spontané','Méthodique'], N:['Stabilité','Sensible','Imperturbable'],
    O:['Ouverture','Pragmatique','Inventif']
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

  function carteDimensionsSpe(res){
    const dims = res.speDims || {};
    if (!Object.keys(dims).length) return '';
    const ordre = res.diagType === 'manager'
      ? ['delegation','feedback','exigence_bienveillance']
      : ['closing','objection','chasseur_eleveur'];
    const blocs = ordre.filter(d => dims[d] && SPE_DIM_LABELS[d]).map(d => {
      const conf = SPE_DIM_LABELS[d];
      const choisi = dims[d];
      const pastilles = Object.entries(conf.profils).map(([key, label]) =>
        `<span class="dimc-opt ${key === choisi ? 'dimc-sel' : ''}">${label}</span>`
      ).join('');
      return `<div class="dimc-row"><div class="dimc-titre">${conf.titre}</div><div class="dimc-opts">${pastilles}</div></div>`;
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
  function carteDimensions(res){
    const ctx = res.contextuel || {};
    if (!Object.keys(ctx).length) return '';
    const ordre = ['stress','motivation','risque','changement','conflit'];
    const blocs = ordre.filter(d => ctx[d] && DIM_LABELS[d]).map(d => {
      const conf = DIM_LABELS[d];
      const choisi = ctx[d];
      const pastilles = Object.entries(conf.profils).map(([key, label]) =>
        `<span class="dimc-opt ${key === choisi ? 'dimc-sel' : ''}">${label}</span>`
      ).join('');
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
      return `<div class="spectre-row">
        <div class="spectre-top"><span class="spectre-name">${name}</span><span class="spectre-qualif">${q}</span></div>
        <div class="spectre-ends"><span>${low}</span><span>${high}</span></div>
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
    const dc=contenu(dom.nom), rar=rarete(dom.nom);
    const roles=['Dominante','Secondaire','Nuance'];

    // ---- Bloc spé (management ou commercial), affiché si le diagnostic en a une ----
    const dt = res.diagType || 'classic';
    let speBlocHtml = '';
    if (dt === 'manager') {
      speBlocHtml = `
      <div class="r-bloc" id="b-spe">
        <div class="r-bloc-head"><span class="r-bloc-tag">Votre métier</span><h2>Votre management</h2></div>
        <p class="r-bloc-intro">Votre personnalité éclaire votre manière de manager. Voici comment vos traits se traduisent dans votre posture de leader.</p>
        <div class="r-section-tag">Votre style en un coup d'œil</div>
        ${carteStyle(res)}
        ${carteDimensionsSpe(res)}
        <div class="r-section-tag">Comment votre personnalité nourrit votre management</div>
        <div class="r-ia" id="ia-mgmt_croisement"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre rapport à la délégation</div>
        <div class="r-ia" id="ia-dim_delegation"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre style de feedback</div>
        <div class="r-ia" id="ia-dim_feedback"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Exigence et bienveillance</div>
        <div class="r-ia" id="ia-dim_exigence"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos moments clés de manager</div>
        <div class="r-ia" id="ia-mgmt_moments_cles"><div class="r-ia-tag">Votre posture en situation</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos leviers de motivation d'équipe</div>
        <div class="r-ia" id="ia-mgmt_motivation_equipe"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos contextes de réussite</div>
        <div class="r-ia" id="ia-mgmt_contextes_reussite"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Le manager que vous êtes</div>
        <div class="r-ia" id="ia-mgmt_synthese_leadership"><div class="r-ia-tag">En synthèse</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
      </div>`;
    } else if (dt === 'commercial') {
      speBlocHtml = `
      <div class="r-bloc" id="b-spe">
        <div class="r-bloc-head"><span class="r-bloc-tag">Votre métier</span><h2>Votre approche commerciale</h2></div>
        <p class="r-bloc-intro">Votre personnalité éclaire votre manière de vendre. Voici comment vos traits se traduisent dans votre posture commerciale.</p>
        <div class="r-section-tag">Votre style en un coup d'œil</div>
        ${carteStyle(res)}
        ${carteDimensionsSpe(res)}
        <div class="r-section-tag">Comment votre personnalité nourrit votre vente</div>
        <div class="r-ia" id="ia-mgmt_croisement"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre rapport au closing</div>
        <div class="r-ia" id="ia-dim_closing"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre posture face à l'objection</div>
        <div class="r-ia" id="ia-dim_objection"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre tempérament commercial</div>
        <div class="r-ia" id="ia-dim_chasseur"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos moments clés de vente</div>
        <div class="r-ia" id="ia-com_moments_cles"><div class="r-ia-tag">Votre posture en situation</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre style de relation client</div>
        <div class="r-ia" id="ia-com_relation_client"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos contextes de réussite commerciale</div>
        <div class="r-ia" id="ia-com_contextes_reussite"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Le commercial que vous êtes</div>
        <div class="r-ia" id="ia-com_synthese_vendeur"><div class="r-ia-tag">En synthèse</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
      </div>`;
    }

    // ---- Sommaire dynamique (reflète les blocs réellement présents) ----
    const tocItems = [
      { href: 'b0', label: 'Comprendre la méthode' },
      { href: 'b1', label: 'Vous connaître' },
      { href: 'b-dims', label: 'Vos dimensions profondes' },
      { href: 'b2', label: 'Lire les autres' },
      { href: 'b3', label: 'Passer à l\'action' },
    ];
    if (dt === 'manager') tocItems.push({ href: 'b-spe', label: 'Votre management' });
    else if (dt === 'commercial') tocItems.push({ href: 'b-spe', label: 'Votre approche commerciale' });
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

    const forcesVal=(dc.forces||[]).map((f,i)=>validItem('force',i,f)).join('');
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

    const html=`
      <p class="r-essence">${dc.essence||''}</p>

      <div class="r-toc">${tocHtml}</div>
      </div>

      <div class="r-bloc" id="b0">
        <div class="r-bloc-head"><span class="r-bloc-tag">Méthode</span><h2>Comment ce portrait est établi</h2></div>
        ${schemaScience(dt === 'classic' ? 55 : 91)}
        <div class="r-card"><p>Votre profil repose sur le <b>Big Five</b>, le modèle de personnalité le plus validé scientifiquement. Vos réponses se traduisent en cinq dimensions, puis en archétypes qui les rendent vivantes.</p></div>
        <div class="r-compare">
          <div class="r-cmp r-cmp-a"><div class="r-cmp-t">DISC, Process Com</div>reposent sur des typologies en cases, souvent moins validées.</div>
          <div class="r-cmp r-cmp-b"><div class="r-cmp-t">Sinéa Profile</div>mesure des dimensions continues, puis les combine en un profil nuancé et unique.</div>
        </div>
        <div class="r-card"><p style="margin:0"><b>Pourquoi vos réponses sont fiables.</b> Nos questions utilisent un choix forcé, sans réponse neutre, ce qui limite le biais de complaisance. Votre profil mêle plusieurs archétypes, car une personne réelle ne tient jamais dans une seule case.</p></div>
      </div>

      <div class="r-bloc" id="b1">
        <div class="r-bloc-head"><span class="r-bloc-tag">Bloc 1</span><h2>Vous connaître en profondeur</h2></div>
        <div class="r-section-tag">Qui vous êtes</div>
        <div class="r-ia" id="ia-ouverture"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">L'alchimie de vos forces</div>
        <div class="r-ia" id="ia-alchimie"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre combinaison</div>
        <div class="r-card"><div class="r-blend">${blendSegs}</div><div class="r-chips">${chips}</div></div>
        <div class="r-section-tag">Votre affinité avec les 20 archétypes</div>
        <p class="r-hint">Votre profil est une signature unique. Voici votre proximité avec chacun des 20 archétypes.</p>
        <div class="r-card">${classementComplet(res)}</div>
        <div class="r-section-tag">Les dynamiques entre vos forces</div>
        <p class="r-hint">Vos trois archétypes ne coexistent pas, ils interagissent deux à deux.</p>
        <div id="ia-dynamiques"><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos forces secondaires</div>
        <div class="r-secs-grid">${secHtml}</div>
        <div class="r-section-tag">Votre tempérament</div>
        <div class="r-card"><div class="r-temperament"><div class="r-radar">${radarSvg(res.radarFamilles,color)}</div><div class="r-spectres">${spectres(res.scoresBigFive)}</div></div></div>
        <div class="r-ia" id="ia-bigfive"><div class="r-ia-tag">Ce que révèle le croisement de vos dimensions</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre naturel et votre adaptation au travail</div>
        <p class="r-hint">L'écart entre qui vous êtes spontanément et comment vous agissez au travail révèle où vous fournissez un effort.</p>
        ${carteNaturelAdapte(res)}
        <div class="r-section-tag">Vous en situation</div>
        <div class="r-ia" id="ia-situation"><div class="r-ia-tag">Votre profil en action</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos forces, à valider</div>
        <p class="r-hint">Ce qui résonne le plus avec vous ?</p>
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
        <div class="r-ia" id="ia-dim_stress"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Vos moteurs profonds</div>
        <div class="r-ia" id="ia-dim_motivation"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre rapport au risque</div>
        <div class="r-ia" id="ia-dim_risque"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre rapport au changement</div>
        <div class="r-ia" id="ia-dim_changement"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
        <div class="r-section-tag">Votre posture face au conflit</div>
        <div class="r-ia" id="ia-dim_conflit"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
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
        <div class="r-ia" id="ia-angles"><div class="r-ia-tag">Analyse personnalisée</div><div class="r-ia-loading"><span class="mini-spin"></span>Analyse...</div></div>
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
        <div class="r-rare"><div class="r-rare-num">${rar.pct?rar.pct+'%':''}</div><div class="r-rare-txt">${niveauTxt(rar.niveau)}</div></div>
      </div>

      ${speBlocHtml}

      <div class="r-seedup">
        <h3>Continuez avec SeedUp</h3>
        <p>Transformez ce portrait en défis concrets, ancrés dans votre quotidien.</p>
        <button class="btn-primary btn-light" onclick="Result.finishSeedup()">Envoyer vers SeedUp</button>
      </div>
    `;
    document.getElementById('r-body').innerHTML=html;
    generateIA(res);
  }

  function validItem(type, i, txt){
    return `<div class="r-validable" id="v-${type}-${i}" onclick="Result.toggleValid('${type}',${i})"><div class="r-val-check">✓</div><p>${txt}</p></div>`;
  }
  function toggleValid(type,i){
    const key=`${type}_${i}`; validations[key]=!validations[key];
    document.getElementById(`v-${type}-${i}`).classList.toggle('sel',validations[key]);
  }
  function saveOpen(q,v){ openAnswers[q]=v; }
  function toggleAction(i){ const el=document.getElementById('act-'+i); el.classList.toggle('sel'); if(selectedActions.has(i))selectedActions.delete(i);else selectedActions.add(i); }
  function niveauTxt(niv){ return {'répandu':'Vous avez un profil répandu','courant':'Vous avez un profil courant','peu commun':'Vous avez un profil peu commun','rare':'Vous avez un profil rare'}[niv]||'Votre profil est unique'; }

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
      naturel_adapte: (res.naturelAdapte ? { naturel: res.naturelAdapte.naturel, adapte: res.naturelAdapte.adapte, ecarts: res.naturelAdapte.ecarts } : {}),
      cout_adaptation: (res.naturelAdapte ? res.naturelAdapte.cout : 'modéré'),
      // Spé déterminée par le lien (manager / commercial / classic)
      spe: (res.diagType && res.diagType !== 'classic') ? res.diagType : null,
      style_dominant: res.speStyle || null,
      // Dimensions enrichies calculées par l'app
      contextuel: res.contextuel || {},
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
  function poseSection(elId, tag, contenu, fallback){
    const el = document.getElementById(elId);
    if(!el) return;
    if(contenu && typeof contenu === 'string'){
      el.innerHTML = `<div class="r-ia-tag">${tag}</div>` + paras(contenu);
    } else {
      el.innerHTML = `<div class="r-ia-tag">${tag}</div>` + fallback;
    }
  }

  async function generateIA(res){
    const dom=res.dominante;
    const dc=contenu(dom.nom);
    const sec=res.secondaires.map(s=>s.nom).join(' et ');
    const situ=dc.en_situation||{};
    try{
      const c = await callWorker(res);
      poseSection('ia-ouverture','Analyse personnalisée', c.ouverture, `<p>${dc.essence||''}</p>`);
      poseSection('ia-alchimie','Analyse personnalisée', c.alchimie,
        `<p>Votre combinaison de ${dom.nom} et de ${sec} compose une signature singulière.</p>`);
      poseSection('ia-bigfive','Ce que révèle le croisement de vos dimensions', c.temperament,
        `<p>Le croisement de vos dimensions dessine un tempérament cohérent avec votre profil ${dom.nom}.</p>`);
      poseSection('ia-situation','Votre profil en action', c.situation,
        `<p>${situ.reunion||''}</p><p>${situ.pression||''}</p>`);
      poseSection('ia-angles','Analyse personnalisée', c.angles_relationnels,
        `<p>À force de jouer vos forces, certains aspects de votre impact peuvent vous échapper.</p>`);

      // Les 3 dynamiques entre les forces (format JSON : paires)
      const dynEl = document.getElementById('ia-dynamiques');
      if (dynEl) {
        const dyn = c.combo_dynamiques;
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

      // Dimensions profondes (socle)
      poseSection('ia-dim_stress','Analyse personnalisée', c.dim_stress, `<p>Votre rapport au stress reflète votre tempérament.</p>`);
      poseSection('ia-dim_motivation','Analyse personnalisée', c.dim_motivation, `<p>Vos moteurs profonds guident vos choix.</p>`);
      poseSection('ia-dim_risque','Analyse personnalisée', c.dim_risque, `<p>Votre rapport au risque éclaire vos décisions.</p>`);
      poseSection('ia-dim_changement','Analyse personnalisée', c.dim_changement, `<p>Votre rapport au changement façonne votre adaptabilité.</p>`);
      poseSection('ia-dim_conflit','Analyse personnalisée', c.dim_conflit, `<p>Votre posture face au conflit révèle votre style relationnel.</p>`);

      // Bloc spé (manager OU commercial)
      poseSection('ia-mgmt_croisement','Analyse personnalisée', c.mgmt_croisement, `<p>Votre personnalité nourrit directement votre posture professionnelle.</p>`);
      // Manager
      poseSection('ia-dim_delegation','Analyse personnalisée', c.dim_delegation, `<p>Votre rapport à la délégation structure votre management.</p>`);
      poseSection('ia-dim_feedback','Analyse personnalisée', c.dim_feedback, `<p>Votre style de feedback influence votre équipe.</p>`);
      poseSection('ia-dim_exigence','Analyse personnalisée', c.dim_exigence, `<p>Votre équilibre exigence et bienveillance définit votre leadership.</p>`);
      poseSection('ia-mgmt_moments_cles','Votre posture en situation', c.mgmt_moments_cles, `<p>Vos moments clés de manager révèlent votre style.</p>`);
      poseSection('ia-mgmt_motivation_equipe','Analyse personnalisée', c.mgmt_motivation_equipe, `<p>Vous motivez votre équipe à votre manière.</p>`);
      poseSection('ia-mgmt_contextes_reussite','Analyse personnalisée', c.mgmt_contextes_reussite, `<p>Certains contextes révèlent le meilleur de votre management.</p>`);
      poseSection('ia-mgmt_synthese_leadership','En synthèse', c.mgmt_synthese_leadership, `<p>Votre signature de leadership est unique.</p>`);
      // Commercial
      poseSection('ia-dim_closing','Analyse personnalisée', c.dim_closing, `<p>Votre rapport au closing structure votre vente.</p>`);
      poseSection('ia-dim_objection','Analyse personnalisée', c.dim_objection, `<p>Votre posture face à l'objection révèle votre aisance.</p>`);
      poseSection('ia-dim_chasseur','Analyse personnalisée', c.dim_chasseur, `<p>Votre tempérament commercial oriente votre approche.</p>`);
      poseSection('ia-com_moments_cles','Votre posture en situation', c.com_moments_cles, `<p>Vos moments clés de vente révèlent votre style.</p>`);
      poseSection('ia-com_relation_client','Analyse personnalisée', c.com_relation_client, `<p>Vous construisez la relation client à votre manière.</p>`);
      poseSection('ia-com_contextes_reussite','Analyse personnalisée', c.com_contextes_reussite, `<p>Certains contextes révèlent le meilleur de votre vente.</p>`);
      poseSection('ia-com_synthese_vendeur','En synthèse', c.com_synthese_vendeur, `<p>Votre signature commerciale est unique.</p>`);

      // Actions (depuis le plan de la spé si présent, sinon leviers)
      const plan = (c.mgmt_angles_plan && c.mgmt_angles_plan.plan) || (c.com_angles_plan && c.com_angles_plan.plan);
      if(plan && Array.isArray(plan)){
        document.getElementById('ia-actions').innerHTML=`<div class="r-ia-tag">L'IA propose, vous choisissez</div>
          <p class="r-hint" style="margin-top:0">Sélectionnez les pistes à développer.</p><div class="r-actions-grid">`+
          plan.map((a,i)=>`<div class="r-action" id="act-${i}" onclick="Result.toggleAction(${i})"><div class="r-action-check">✓</div><p>${a.titre}. ${a.desc}</p></div>`).join('')+`</div>`;
      } else { posefallbackActions(dc); }
    }catch(e){
      // Repli complet : tout le contenu d'exemple s'affiche
      poseSection('ia-ouverture','Analyse personnalisée', null, `<p>${dc.essence||''}</p>`);
      poseSection('ia-alchimie','Analyse personnalisée', null, `<p>Votre combinaison de ${dom.nom} et de ${sec} compose une signature singulière.</p>`);
      poseSection('ia-bigfive','Votre tempérament', null, `<p>Le croisement de vos dimensions dessine un tempérament cohérent avec votre profil.</p>`);
      poseSection('ia-situation','Votre profil en action', null, `<p>${situ.reunion||''}</p><p>${situ.pression||''}</p>`);
      poseSection('ia-angles','Analyse personnalisée', null, `<p>À force de jouer vos forces, certains aspects de votre impact peuvent vous échapper.</p>`);
      posefallbackActions(dc);
    }
  }

  function posefallbackActions(dc){
    const fb=(dc.leviers||['Affirmer vos besoins avec assurance','Oser le désaccord constructif']);
    document.getElementById('ia-actions').innerHTML=`<div class="r-ia-tag">Vos pistes d'action</div><div class="r-actions-grid">`+
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
      }
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

  return { render, toggleValid, saveOpen, toggleAction, finishSeedup, setNote, setAvis, submitMoment3, backFromMoment3, backFromDefis };
})();
