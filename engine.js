// ============================================================
// CONTRÔLEUR D'AFFICHAGE — App v2 mobile-first premium
// ============================================================
const App = (() => {
  let queue = [];          // séquence des questions
  let idx = 0;             // index courant
  const answers = {};      // réponses {id: valeur}
  let result = null;
  let diagType = 'classic'; // 'classic' | 'manager' | 'commercial' (déterminé par le lien)

  // ---- Sauvegarde de progression (localStorage) ----
  // Protège contre la perte de réponses si l'onglet se ferme pendant le test.
  const SAVE_KEY = 'sinea_profile_progress';

  function saveProgress() {
    try {
      const data = { v: 1, ts: Date.now(), diagType, idx, answers };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* localStorage indisponible : on continue sans sauvegarde */ }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Session valable 7 jours, et seulement si le type correspond au lien actuel
      const ageOk = (Date.now() - (data.ts || 0)) < 7 * 24 * 3600 * 1000;
      if (!ageOk) { clearProgress(); return null; }
      if (data.diagType !== diagType) return null; // lien différent : on ne mélange pas
      if (!data.answers || Object.keys(data.answers).length === 0) return null;
      return data;
    } catch (e) { return null; }
  }

  function clearProgress() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  // ---- Lecture du type de diagnostic depuis l'URL (?type=manager) ----
  function readDiagType() {
    try {
      const p = new URLSearchParams(window.location.search);
      const t = (p.get('type') || '').toLowerCase();
      if (t === 'manager' || t === 'commercial') return t;
    } catch (e) {}
    return 'classic';
  }

  // ---- Définition des chapitres selon le type ----
  function chapitres() {
    const ch = [
      { id: 'socle', titre: 'Votre personnalité', sous: 'Comment vous fonctionnez, spontanément.' },
      { id: 'contexte', titre: 'Votre rapport au monde', sous: 'Stress, motivation, changement : ce qui vous anime.' },
    ];
    if (diagType === 'manager') ch.push({ id: 'spe', titre: 'Votre management', sous: 'Votre posture de manager au quotidien.' });
    else if (diagType === 'commercial') ch.push({ id: 'spe', titre: 'Votre approche commerciale', sous: 'Votre façon de vendre et de convaincre.' });
    return ch;
  }

  // ---- Construction de la file de questions (avec chapitres) ----
  function buildQueue() {
    const d = SINEA_DATA;
    const q = [];

    // ===== CHAPITRE 1 : SOCLE =====
    d.mini_items.forEach(it => q.push({ kind: 'mini', id: it.id, item: it, chap: 'socle' }));
    Object.values(d.sinea_famille).forEach(list => {
      list.forEach(it => q.push({ kind: 'qcm', id: it.id, item: it, chap: 'socle' }));
    });
    d.sinea_hybride.forEach(it => q.push({ kind: 'curseur', id: it.id, item: it, chap: 'socle' }));
    (d.sinea_transversales || []).forEach(it => q.push({ kind: 'qcm', id: it.id, item: it, chap: 'socle' }));
    // Répartitions espacées dans le bloc socle
    const repart = (d.sinea_repartitions || []).map(it => ({ kind: 'repart', id: it.id, item: it, chap: 'socle' }));
    const base = q.length;
    const step = Math.floor(base / (repart.length + 1));
    repart.forEach((r, i) => {
      const pos = 20 + step * (i + 1) + i;
      q.splice(Math.min(pos, q.length), 0, r);
    });

    // ===== CHAPITRE 2 : CONTEXTE (dimensions contextuelles) =====
    (d.contextuelles?.questions || []).forEach(it => {
      q.push({ kind: 'ctx', id: it.id, item: it, chap: 'contexte' });
    });

    // ===== CHAPITRE 3 : SPÉ (selon le type) =====
    if (diagType === 'manager') {
      (d.spe_management.goleman.questions || []).forEach(it => q.push({ kind: 'qcm', id: it.id, item: it, chap: 'spe' }));
      (d.spe_management.dimensions.questions || []).forEach(it => q.push({ kind: 'ctx', id: it.id, item: it, chap: 'spe' }));
    } else if (diagType === 'commercial') {
      (d.spe_commercial.challenger.questions || []).forEach(it => q.push({ kind: 'qcm', id: it.id, item: it, chap: 'spe' }));
      (d.spe_commercial.dimensions.questions || []).forEach(it => q.push({ kind: 'ctx', id: it.id, item: it, chap: 'spe' }));
    }

    return q;
  }

  // Index des questions par chapitre (pour la progression par chapitre)
  function chapInfo() {
    const info = {};
    queue.forEach((item, i) => {
      if (!info[item.chap]) info[item.chap] = { first: i, count: 0, answeredIdx: [] };
      info[item.chap].count++;
    });
    return info;
  }

  function total() { return queue.length; }
  function answeredCount() { return Object.keys(answers).length; }

  // ---- Personnalisation de l'écran d'accueil selon le type ----
  function initCover() {
    diagType = readDiagType();
    const q = buildQueue();
    const nq = q.length;
    const nsec = chapitres().length;
    const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('cover-nq', nq);
    setTxt('cover-nsec', nsec);
    if (diagType === 'manager') {
      setTxt('cover-kicker', 'Profil de manager');
      const sub = document.getElementById('cover-sub');
      if (sub) sub.textContent = 'Un portrait fondé sur la science, pour révéler votre personnalité et votre style de management.';
    } else if (diagType === 'commercial') {
      setTxt('cover-kicker', 'Profil commercial');
      const sub = document.getElementById('cover-sub');
      if (sub) sub.textContent = 'Un portrait fondé sur la science, pour révéler votre personnalité et votre approche commerciale.';
    }
  }

  // ---- Navigation ----
  function start() {
    diagType = readDiagType();
    queue = buildQueue();
    // Reprise de session si une sauvegarde valide existe
    const saved = loadProgress();
    if (saved) {
      showResumePrompt(saved);
      return;
    }
    idx = 0;
    document.getElementById('screen-cover').classList.remove('active');
    showChapterIntro('socle', () => {
      document.getElementById('screen-question').classList.add('active');
      render();
    });
  }

  // ---- Écran de reprise de session ----
  function showResumePrompt(saved) {
    const nbRep = Object.keys(saved.answers).length;
    const pct = Math.round((nbRep / queue.length) * 100);
    let scr = document.getElementById('screen-resume');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-resume';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    scr.innerHTML = `
      <div class="chap-halo"></div>
      <div class="chap-in">
        <div class="chap-step">Bon retour</div>
        <h2 class="chap-title">Reprendre où<br/>vous en étiez</h2>
        <div class="chap-sub">Vous avez déjà répondu à ${nbRep} questions (${pct} %). Souhaitez-vous continuer votre parcours ?</div>
        <button class="chap-btn" id="resume-go">Reprendre</button>
        <button class="chap-btn-ghost" id="resume-restart">Recommencer à zéro</button>
      </div>`;
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    document.getElementById('resume-go').onclick = () => {
      // restaurer l'état
      Object.assign(answers, saved.answers);
      idx = Math.min(saved.idx || 0, queue.length - 1);
      scr.classList.remove('active');
      document.getElementById('screen-question').classList.add('active');
      render();
    };
    document.getElementById('resume-restart').onclick = () => {
      clearProgress();
      for (const k in answers) delete answers[k];
      idx = 0;
      scr.classList.remove('active');
      showChapterIntro('socle', () => {
        document.getElementById('screen-question').classList.add('active');
        render();
      });
    };
  }

  // ---- Écran de transition entre chapitres ----
  function showChapterIntro(chapId, onContinue) {
    const chaps = chapitres();
    const chap = chaps.find(c => c.id === chapId);
    if (!chap) { onContinue(); return; }
    const numero = chaps.findIndex(c => c.id === chapId) + 1;
    const totalChap = chaps.length;
    let scr = document.getElementById('screen-chapter');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-chapter';
      scr.className = 'screen';
      const host = document.querySelector('.app') || document.body;
      host.appendChild(scr);
    }
    scr.innerHTML = `
      <div class="chap-halo"></div>
      <div class="chap-in">
        <div class="chap-step">Étape ${numero} sur ${totalChap}</div>
        <h2 class="chap-title">${chap.titre}</h2>
        <div class="chap-sub">${chap.sous}</div>
        <button class="chap-btn" id="chap-go">Commencer</button>
      </div>`;
    // masquer les autres écrans
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    document.getElementById('chap-go').onclick = () => {
      scr.classList.remove('active');
      onContinue();
    };
  }

  function next() {
    if (answers[queue[idx].id] === undefined) return; // bloqué tant que pas répondu
    if (idx < queue.length - 1) {
      const curChap = queue[idx].chap;
      const nextChap = queue[idx + 1].chap;
      idx++;
      if (nextChap !== curChap) {
        // changement de chapitre : écran de transition
        document.getElementById('screen-question').classList.remove('active');
        showChapterIntro(nextChap, () => {
          document.getElementById('screen-question').classList.add('active');
          render();
        });
      } else {
        animateTransition('forward');
      }
    } else {
      finish();
    }
  }

  function prev() {
    if (idx > 0) {
      idx--;
      animateTransition('back');
    }
  }

  function animateTransition(dir) {
    const card = document.getElementById('q-card');
    card.style.transition = 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.4,0,0.2,1)';
    card.style.opacity = '0';
    card.style.transform = dir === 'forward' ? 'translateX(20px)' : 'translateX(-20px)';
    setTimeout(() => {
      render();
      card.style.transition = 'none';
      card.style.transform = dir === 'forward' ? 'translateX(-20px)' : 'translateX(20px)';
      requestAnimationFrame(() => {
        card.style.transition = 'opacity 0.34s ease, transform 0.42s cubic-bezier(0.22,1,0.36,1)';
        card.style.opacity = '1';
        card.style.transform = 'translateX(0)';
      });
    }, 200);
  }

  // ---- Rendu d'une question ----
  function render() {
    const cur = queue[idx];
    updateProgress();
    const body = document.getElementById('q-card');
    if (cur.kind === 'mini') body.innerHTML = renderMini(cur);
    else if (cur.kind === 'qcm' || cur.kind === 'ctx') body.innerHTML = renderQcm(cur);
    else if (cur.kind === 'curseur') body.innerHTML = renderCurseur(cur);
    else if (cur.kind === 'repart') body.innerHTML = renderRepart(cur);
    refreshNav();
  }

  function updateProgress() {
    // Progression DANS le chapitre courant (plus motivant qu'une barre globale)
    const cur = queue[idx];
    const chaps = chapitres();
    const chap = chaps.find(c => c.id === cur.chap);
    const firstIdx = queue.findIndex(q => q.chap === cur.chap);
    const chapItems = queue.filter(q => q.chap === cur.chap).length;
    const posInChap = idx - firstIdx + 1;
    const pct = (posInChap / chapItems) * 100;
    document.getElementById('q-bar-fill').style.width = pct + '%';
    const label = chap ? chap.titre : '';
    // Encouragement contextuel discret à certains moments
    const reste = chapItems - posInChap;
    let enc = '';
    if (reste === 0) enc = ' · dernière de cette étape';
    else if (reste <= 3 && chapItems > 6) enc = ` · plus que ${reste}`;
    else if (posInChap === Math.floor(chapItems / 2) && chapItems > 8) enc = ' · à mi-parcours';
    document.getElementById('q-step').textContent = `${label} · ${posInChap} / ${chapItems}${enc}`;

    // Panneau latéral desktop : chapitre, étape, note contextuelle
    const chapsAll = chapitres();
    const numChap = chapsAll.findIndex(c => c.id === cur.chap) + 1;
    const asideChap = document.getElementById('q-aside-chap');
    const asideStep = document.getElementById('q-aside-step');
    const asideNote = document.getElementById('q-aside-note');
    if (asideChap) asideChap.textContent = label;
    if (asideStep) asideStep.textContent = `Étape ${numChap} sur ${chapsAll.length}`;
    if (asideNote) {
      const notes = {
        socle: "Répondez spontanément. Il n'y a pas de bonne ou de mauvaise réponse, seulement la vôtre.",
        contexte: "Ces situations révèlent vos réflexes naturels face aux moments clés du quotidien.",
        spe: cur.chap === 'spe' && diagType === 'commercial'
          ? "Ces mises en situation éclairent votre façon de vendre et de convaincre."
          : "Ces mises en situation éclairent votre posture de manager au quotidien."
      };
      asideNote.textContent = notes[cur.chap] || notes.socle;
    }
  }

  // Tag de section selon le type
  function sectionTag(cur) {
    const tags = { mini: 'Vous, spontanément', qcm: 'En situation', ctx: 'Votre tendance', curseur: 'Entre deux pôles', repart: 'Vos priorités' };
    return tags[cur.kind] || '';
  }

  // ---- Mini-IPIP : échelle 4 niveaux ----
  function renderMini(cur) {
    const it = cur.item;
    const val = answers[cur.id];
    const niveaux = [
      { v: 1, label: 'Pas du tout moi' },
      { v: 2, label: 'Plutôt pas moi' },
      { v: 3, label: 'Plutôt moi' },
      { v: 4, label: 'Tout à fait moi' },
    ];
    const opts = niveaux.map(n => `
      <button class="q-opt ${val === n.v ? 'sel' : ''}" onclick="App.answer('${cur.id}', ${n.v})">
        <span class="q-dot"></span><span>${n.label}</span>
      </button>`).join('');
    return `
      <div class="q-tag">${sectionTag(cur)}</div>
      <div class="q-text">${it.texte}</div>
      <div class="q-options">${opts}</div>`;
  }

  // ---- QCM situationnel ----
  function renderQcm(cur) {
    const it = cur.item;
    const val = answers[cur.id];
    const opts = it.options.map((o, i) => `
      <button class="q-opt ${val === i ? 'sel' : ''}" onclick="App.answer('${cur.id}', ${i})">
        <span class="q-dot"></span><span>${o.texte}</span>
      </button>`).join('');
    return `
      <div class="q-tag">${sectionTag(cur)}</div>
      <div class="q-text">${it.situation || it.texte}</div>
      <div class="q-options">${opts}</div>`;
  }

  // ---- Curseur entre deux pôles (tactile) ----
  function renderCurseur(cur) {
    const it = cur.item;
    // Initialiser à 50 dès l'affichage : l'utilisateur peut valider le milieu sans avoir à toucher le curseur
    if (answers[cur.id] === undefined) answers[cur.id] = 50;
    const val = answers[cur.id];
    const pg = it.pole_gauche?.texte || it.gauche?.texte || it.pole_a || '';
    const pd = it.pole_droit?.texte || it.droite?.texte || it.pole_b || '';
    return `
      <div class="q-tag">${sectionTag(cur)}</div>
      <div class="q-text">${it.situation || it.texte || 'Où vous situez-vous ?'}</div>
      <div class="curseur-wrap">
        <div class="curseur-poles">
          <div class="cp cp-left">${pg}</div>
          <div class="cp cp-right">${pd}</div>
        </div>
        <input type="range" min="0" max="100" value="${val}" class="curseur-input"
          oninput="App.answerCurseur('${cur.id}', this.value)" />
        <div class="curseur-track-deco"><div class="curseur-fill" id="cf-${cur.id}" style="width:${val}%"></div></div>
        <div class="curseur-hint" id="ch-${cur.id}">${curseurLabel(val)}</div>
      </div>`;
  }

  function curseurLabel(v) {
    v = +v;
    if (v <= 15) return 'Très proche de la première';
    if (v <= 42) return 'Plutôt la première';
    if (v <= 58) return 'Entre les deux';
    if (v <= 85) return 'Plutôt la seconde';
    return 'Très proche de la seconde';
  }

  // ---- Répartition de points ----
  function renderRepart(cur) {
    const it = cur.item;
    const total = it.points_total || 10;
    const saved = answers[cur.id] || {};
    const rows = it.axes.map((a, i) => {
      const key = a.famille ?? a.style ?? a.cle ?? String(i);
      const v = saved[key] ?? 0;
      return `
        <div class="repart-row">
          <span class="repart-label">${a.texte}</span>
          <div class="repart-ctrl">
            <button class="repart-btn" onclick="App.repartChange('${cur.id}','${key}',-1)">−</button>
            <span class="repart-val" id="rv-${cur.id}-${key}">${v}</span>
            <button class="repart-btn" onclick="App.repartChange('${cur.id}','${key}',1)">+</button>
          </div>
        </div>`;
    }).join('');
    const used = Object.values(saved).reduce((s, x) => s + x, 0);
    return `
      <div class="q-tag">${sectionTag(cur)}</div>
      <div class="q-text">${it.situation || it.texte}</div>
      <div class="repart-counter">Points restants : <b id="rc-${cur.id}">${total - used}</b> / ${total}</div>
      <div class="repart-list">${rows}</div>`;
  }

  // ---- Gestion des réponses ----
  function answer(id, val) {
    answers[id] = val;
    saveProgress();
    // Mettre à jour visuellement la sélection sans tout re-render
    const opts = document.querySelectorAll('#q-card .q-opt');
    const cur = queue[idx];
    opts.forEach((o, i) => {
      // déterminer la valeur de cette option
      let optVal;
      if (cur.kind === 'mini') optVal = i + 1;
      else optVal = i;
      o.classList.toggle('sel', optVal === val);
    });
    refreshNav();
    // auto-avance douce après sélection (sauf dernière)
    if (idx < queue.length - 1) {
      clearTimeout(window._autoNext);
      window._autoNext = setTimeout(() => next(), 360);
    }
  }

  function answerCurseur(id, val) {
    answers[id] = +val;
    saveProgress();
    const fill = document.getElementById('cf-' + id);
    const hint = document.getElementById('ch-' + id);
    if (fill) fill.style.width = val + '%';
    if (hint) hint.textContent = curseurLabel(val);
    refreshNav();
  }

  function repartChange(id, key, delta) {
    const cur = queue[idx];
    const it = cur.item;
    const total = it.points_total || 10;
    if (!answers[id]) answers[id] = {};
    const cur_used = Object.values(answers[id]).reduce((s, x) => s + x, 0);
    const cur_val = answers[id][key] || 0;
    const newVal = cur_val + delta;
    if (newVal < 0) return;
    if (delta > 0 && cur_used >= total) return;
    answers[id][key] = newVal;
    saveProgress();
    document.getElementById(`rv-${id}-${key}`).textContent = newVal;
    const used = Object.values(answers[id]).reduce((s, x) => s + x, 0);
    document.getElementById('rc-' + id).textContent = total - used;
    // valide seulement si tous les points distribués
    if (used === total) { refreshNav(true); } else { refreshNav(false); }
  }

  // ---- Barre de navigation bas ----
  function refreshNav(forceValid) {
    const cur = queue[idx];
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    btnPrev.style.visibility = idx > 0 ? 'visible' : 'hidden';
    let answered = answers[cur.id] !== undefined;
    if (cur.kind === 'repart') {
      const total = cur.item.points_total || 10;
      const used = answers[cur.id] ? Object.values(answers[cur.id]).reduce((s, x) => s + x, 0) : 0;
      answered = used === total;
    }
    btnNext.disabled = !answered;
    btnNext.textContent = idx === queue.length - 1 ? 'Voir mon profil' : 'Continuer';
  }

  // ---- Finalisation ----
  function finish() {
    clearProgress(); // test terminé : plus besoin de la sauvegarde de reprise
    document.getElementById('screen-question').classList.remove('active');
    document.getElementById('screen-loader').classList.add('active');

    // Messages qui défilent pendant le calcul (l'attente devient un moment)
    const loaderP = document.querySelector('#screen-loader .loader-content p');
    const messages = [
      `Analyse de vos ${queue.length} réponses...`,
      'Mesure de vos dimensions de personnalité...',
      'Identification de vos archétypes dominants...',
      'Composition de votre portrait unique...'
    ];
    let mi = 0;
    if (loaderP) loaderP.textContent = messages[0];
    const msgTimer = setInterval(() => {
      mi++;
      if (loaderP && messages[mi]) {
        loaderP.style.opacity = '0';
        setTimeout(() => { loaderP.textContent = messages[mi]; loaderP.style.opacity = '1'; }, 200);
      }
    }, 750);

    // Répartir les réponses par type, selon la nature de chaque question
    const repMini = {}, repSinea = {}, repCtx = {}, repSpeQcm = {}, repSpeDims = {};
    const ctxIds = new Set((SINEA_DATA.contextuelles?.questions || []).map(q => q.id));
    const speDimIds = new Set([
      ...((SINEA_DATA.spe_management?.dimensions?.questions) || []).map(q => q.id),
      ...((SINEA_DATA.spe_commercial?.dimensions?.questions) || []).map(q => q.id),
    ]);
    queue.forEach(q => {
      const v = answers[q.id];
      if (q.kind === 'mini') repMini[q.id] = v;
      else if (q.chap === 'socle') repSinea[q.id] = v;
      else if (ctxIds.has(q.id)) repCtx[q.id] = v;
      else if (q.chap === 'spe' && speDimIds.has(q.id)) repSpeDims[q.id] = v;
      else if (q.chap === 'spe') repSpeQcm[q.id] = v;
    });

    setTimeout(() => {
      // Profil archétypal (socle, inchangé)
      result = Engine.scorer(repMini, repSinea);
      // Dimensions contextuelles + spé (nouveau)
      result.contextuel = Engine.scorerContextuel(repCtx);
      result.diagType = diagType;
      if (diagType !== 'classic') {
        result.speDims = Engine.scorerSpeDims(repSpeDims, diagType);
        result.speStyle = Engine.scorerSpeStyle(repSpeQcm, diagType);
      }
      clearInterval(msgTimer);
      document.getElementById('screen-loader').classList.remove('active');
      document.getElementById('screen-result').classList.add('active');
      Result.render(result);
      window.scrollTo(0, 0);
      document.getElementById('phone-scroll')?.scrollTo(0, 0);
    }, 2200);
  }

  return { start, next, prev, answer, answerCurseur, repartChange, initCover, getResult: () => result };
})();

// Personnaliser l'accueil dès le chargement (questions, étapes, type)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.initCover());
} else {
  App.initCover();
}
