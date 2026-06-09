// ============================================================
// CONTRÔLEUR D'AFFICHAGE — App v2 mobile-first premium
// ============================================================
const App = (() => {
  let queue = [];          // séquence des questions
  let idx = 0;             // index courant
  let answers = {};      // réponses {id: valeur}
  let result = null;
  let diagType = 'classic'; // type du PARCOURS en cours : 'classic'(socle) | 'manager' | 'commercial'
  let droits = '';          // droits de la personne (modules autorisés), issus du lien d'invitation

  // ---- Sauvegarde de progression (localStorage + serveur Airtable) ----
  // Protège contre la perte de réponses si l'onglet se ferme pendant le test.
  const SAVE_KEY = 'sinea_profile_progress';
  const PROGRESSION_URL = "https://sinea-profile-ia.vercel.app/api/progression";
  let saveTimer = null;

  function saveProgress() {
    // 1) sauvegarde locale immédiate (secours rapide)
    try {
      const data = { v: 1, ts: Date.now(), diagType, idx, answers };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* localStorage indisponible : on continue */ }
    // 2) sauvegarde serveur (différée pour ne pas spammer : 1 appel max / 2s)
    saveProgressServer();
  }

  function saveProgressServer() {
    if (!identite.email) return; // pas d'email = pas de sauvegarde serveur
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fetch(PROGRESSION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          email: identite.email,
          prenom: identite.prenom,
          nom: identite.nom,
          answers, idx, diagType,
          droits: droits,
        }),
      }).catch(() => {}); // silencieux : ne bloque jamais l'expérience
    }, 2000);
  }

  // Envoie les choix interactifs de l'utilisateur (forces validées, réponses ouvertes...) au serveur
  function envoyerInteractions(interactions) {
    if (!identite.email) return;
    fetch(PROGRESSION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_interactions",
        email: identite.email,
        type_analyse: interactions.diagType && interactions.diagType !== 'classic' ? interactions.diagType : 'socle',
        interactions: interactions,
      }),
    }).catch(() => {});
  }

  // Sauvegarde l'analyse IA générée (texte figé) pour pouvoir la revoir plus tard
  function sauverAnalyse(typeAnalyse, contenu) {
    if (!identite.email) return;
    fetch(PROGRESSION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_analyse",
        email: identite.email,
        type_analyse: typeAnalyse, // 'socle' ou 'commercial' ou 'manager'
        contenu: contenu,
      }),
    }).catch(() => {});
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

  // Lit le token individuel du répondant depuis l'URL (?token=...)
  function readToken() {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get('token') || null;
    } catch (e) { return null; }
  }

  // Envoie le résultat au backend pour remplir le répondant dans Airtable
  function enregistrerResultat(result) {
    const token = readToken();
    if (!token) return; // pas de token = test libre, on n'enregistre pas
    const ENREGISTRER_URL = "https://sinea-profile-ia.vercel.app/api/enregistrer";
    const profil = {
      dominante: result.dominante ? result.dominante.nom : "",
      secondaires: (result.secondaires || []).map(s => s.nom),
      famille: result.dominante ? result.dominante.famille : "",
      bigFive: result.scoresBigFive || {},
    };
    fetch(ENREGISTRER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, profil, resultatComplet: result }),
    }).catch(() => {}); // silencieux : ne bloque pas l'expérience
  }

  // Détermine le bon type d'affichage selon le format de la question
  function kindFromFormat(it, defaut) {
    const f = it.format || 'qcm';
    if (f === 'curseur') return 'curseur';
    if (f === 'repartition') return 'repart';
    return defaut || 'qcm';
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
  function buildQueue(moduleSeulType) {
    const d = SINEA_DATA;
    const q = [];

    // Mode "module seul" : on ne repasse pas le socle, juste les questions du module
    if (moduleSeulType) {
      if (moduleSeulType === 'manager') {
        (d.spe_management.goleman.questions || []).forEach(it => q.push({ kind: kindFromFormat(it, 'qcm'), id: it.id, item: it, chap: 'spe' }));
        (d.spe_management.dimensions.questions || []).forEach(it => q.push({ kind: 'ctx', id: it.id, item: it, chap: 'spe' }));
      } else if (moduleSeulType === 'commercial') {
        (d.spe_commercial.challenger.questions || []).forEach(it => q.push({ kind: kindFromFormat(it, 'qcm'), id: it.id, item: it, chap: 'spe' }));
        (d.spe_commercial.dimensions.questions || []).forEach(it => q.push({ kind: 'ctx', id: it.id, item: it, chap: 'spe' }));
      }
      return q;
    }

    // ===== CHAPITRE 1 : SOCLE =====
    d.mini_items.forEach(it => q.push({ kind: 'mini', id: it.id, item: it, chap: 'socle' }));
    // Questions "adapté" (comportement au travail) pour mesurer le coût d'adaptation
    (d.adapte?.questions || []).forEach(it => q.push({ kind: 'mini', id: it.id, item: it, chap: 'socle' }));
    Object.values(d.sinea_famille).forEach(list => {
      list.forEach(it => q.push({ kind: 'qcm', id: it.id, item: it, chap: 'socle' }));
    });
    d.sinea_hybride.forEach(it => q.push({ kind: 'curseur', id: it.id, item: it, chap: 'socle' }));
    (d.sinea_transversales || []).forEach(it => q.push({ kind: kindFromFormat(it, 'qcm'), id: it.id, item: it, chap: 'socle' }));
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
      (d.spe_management.goleman.questions || []).forEach(it => q.push({ kind: kindFromFormat(it, 'qcm'), id: it.id, item: it, chap: 'spe' }));
      (d.spe_management.dimensions.questions || []).forEach(it => q.push({ kind: 'ctx', id: it.id, item: it, chap: 'spe' }));
    } else if (diagType === 'commercial') {
      (d.spe_commercial.challenger.questions || []).forEach(it => q.push({ kind: kindFromFormat(it, 'qcm'), id: it.id, item: it, chap: 'spe' }));
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

    // Mosaïque des 20 personnages en fond de la page d'accueil
    const mosaic = document.getElementById('cover-mosaic');
    if (mosaic && !mosaic.dataset.filled && SINEA_DATA.images) {
      const slugs = Object.values(SINEA_DATA.images);
      // dupliquer pour remplir la grille si besoin
      const tiles = slugs.concat(slugs).slice(0, 40);
      mosaic.innerHTML = tiles.map(s => `<div class="cm-tile" style="background-image:url('${s}.webp')"></div>`).join('');
      mosaic.dataset.filled = '1';
    }
  }

  // ---- Navigation ----
  // ---- Écran d'identification ----
  const identite = { prenom: '', nom: '', email: '' };

  function goToIdentif() {
    document.getElementById('screen-cover').classList.remove('active');
    const scr = document.getElementById('screen-identif');
    scr.classList.add('active');
    // câbler les boutons une seule fois
    const submit = document.getElementById('id-submit');
    const resume = document.getElementById('id-resume');
    if (submit && !submit.dataset.bound) {
      submit.onclick = submitIdentif;
      submit.dataset.bound = '1';
    }
    if (resume && !resume.dataset.bound) {
      resume.onclick = resumeIdentif;
      resume.dataset.bound = '1';
    }
  }

  function emailValide(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  function submitIdentif() {
    const prenom = (document.getElementById('id-prenom').value || '').trim();
    const nom = (document.getElementById('id-nom').value || '').trim();
    const email = (document.getElementById('id-email').value || '').trim().toLowerCase();
    const err = document.getElementById('id-error');
    if (!prenom || !nom) { err.textContent = 'Merci d\'indiquer votre prénom et votre nom.'; return; }
    if (!emailValide(email)) { err.textContent = 'Cette adresse email semble incorrecte.'; return; }
    err.textContent = '';
    identite.prenom = prenom; identite.nom = nom; identite.email = email;
    document.getElementById('screen-identif').classList.remove('active');
    start();
  }

  function resumeIdentif() {
    const email = (document.getElementById('id-email').value || '').trim().toLowerCase();
    const err = document.getElementById('id-error');
    if (!emailValide(email)) { err.textContent = 'Entrez votre email pour vous reconnecter.'; return; }
    err.textContent = 'Recherche de votre espace...';
    identite.email = email;
    diagType = readDiagType();
    // Charger l'état complet de la personne (analyses + progression)
    fetch(PROGRESSION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "load_analyse", email }),
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.found) {
          identite.prenom = data.prenom || '';
          identite.nom = data.nom || '';
          const aDesAnalyses = data.analyses && Object.keys(data.analyses).length > 0;
          if (aDesAnalyses) {
            // la personne a déjà fait au moins un test → on l'envoie à son espace
            document.getElementById('screen-identif').classList.remove('active');
            goToEspace();
            return;
          }
        }
        // sinon : vérifier s'il y a une progression en cours à reprendre
        fetch(PROGRESSION_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "load", email }),
        })
          .then(r => r.json())
          .then(prog => {
            if (prog && prog.found && prog.answers && Object.keys(prog.answers).length > 0) {
              identite.prenom = prog.prenom || identite.prenom;
              answers = prog.answers; idx = prog.idx || 0;
              queue = buildQueue();
              document.getElementById('screen-identif').classList.remove('active');
              showResumePrompt({ diagType, idx, answers });
            } else {
              err.textContent = "Aucun compte trouvé pour cet email. Vous pouvez commencer le test.";
            }
          })
          .catch(() => { err.textContent = 'Connexion impossible. Réessayez dans un instant.'; });
      })
      .catch(() => { err.textContent = 'Connexion impossible. Réessayez dans un instant.'; });
  }

  // ---- Espace perso (compte utilisateur) ----
  const LABELS_MODULE = {
    socle: { titre: 'Votre portrait de personnalité', sub: 'Votre socle, vos forces, vos dimensions profondes.' },
    commercial: { titre: 'Votre approche commerciale', sub: 'Comment votre personnalité nourrit votre manière de vendre.' },
    manager: { titre: 'Votre style de management', sub: 'Comment votre personnalité façonne votre leadership.' },
  };

  function goToEspace() {
    // masquer les autres écrans
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    const scr = document.getElementById('screen-espace');
    scr.classList.add('active');
    // charger les données depuis le serveur
    if (!identite.email) return;
    fetch(PROGRESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load_analyse', email: identite.email }),
    })
      .then(r => r.json())
      .then(data => renderEspace(data || {}))
      .catch(() => renderEspace({}));
  }

  // Nombre de questions par module (pour le taux de complétion)
  const NB_QUESTIONS = { socle: 60, commercial: 36, manager: 36 };

  function renderEspace(data) {
    const prenom = data.prenom || identite.prenom || '';
    const archetype = data.archetype || '';
    const famille = data.famille || '';
    const analyses = data.analyses || {};
    const droitsTxt = (data.droits || droits || '').toLowerCase();
    const progression = data.progression || {};
    const progType = data.diagTypeEnCours || ''; // type du module en cours si applicable

    document.getElementById('espace-name').textContent = 'Bonjour ' + prenom;
    const archEl = document.getElementById('espace-arch');
    if (archetype) {
      const initiale = archetype.replace(/^(Le |La |L'|Les )/, '').charAt(0);
      archEl.innerHTML = `<span class="espace-arch-dot">${initiale}</span><span>${archetype}${famille ? ' · famille ' + famille.charAt(0) + famille.slice(1).toLowerCase() : ''}</span>`;
      archEl.style.display = 'inline-flex';
    } else {
      archEl.style.display = 'none';
    }

    // Calcul du % d'avancement par module (à partir des réponses sauvegardées)
    function pourcentage(mod) {
      const total = NB_QUESTIONS[mod] || 60;
      // compter les réponses qui appartiennent à ce module
      let repondu = 0;
      const ids = idsDuModule(mod);
      ids.forEach(id => { if (progression[id] !== undefined && progression[id] !== null) repondu++; });
      return Math.min(100, Math.round((repondu / total) * 100));
    }

    // ===== SECTION 1 : MES RÉSULTATS (modules terminés) =====
    const faits = ['socle', 'commercial', 'manager'].filter(m => analyses[m]);
    let resultatsHtml = '';
    if (faits.length) {
      resultatsHtml = '<div class="espace-label">Mes résultats</div>';
      faits.forEach(m => { resultatsHtml += carteResultat(m); });
    }
    document.getElementById('espace-resultats').innerHTML = resultatsHtml;

    // ===== SECTION 2 : VOTRE PARCOURS (à faire / en cours / verrouillé) =====
    const cards = [];
    // socle : si pas fait, on le propose (commencer ou continuer)
    if (!analyses.socle) {
      const pct = pourcentage('socle');
      cards.push(carteModule('socle', pct > 0 ? 'encours' : 'go', pct));
    }
    // modules selon droits (s'ils ne sont pas déjà faits)
    ['commercial', 'manager'].forEach(mod => {
      if (analyses[mod]) return; // déjà fait : il est dans "Mes résultats"
      const aLeDroit = droitsTxt.includes(mod);
      if (!aLeDroit) { cards.push(carteModule(mod, 'lock', 0)); return; }
      // a le droit : commencer ou continuer (uniquement si le socle est fait)
      if (!analyses.socle) { cards.push(carteModule(mod, 'attente', 0)); return; }
      const pct = pourcentage(mod);
      cards.push(carteModule(mod, pct > 0 ? 'encours' : 'go', pct));
    });
    let parcoursHtml = '';
    if (cards.length) {
      parcoursHtml = '<div class="espace-label">Votre parcours</div>' + cards.join('');
    }
    document.getElementById('espace-cards').innerHTML = parcoursHtml;

    // câbler les boutons
    document.querySelectorAll('[data-revoir]').forEach(b => { b.onclick = () => revoirAnalyse(b.getAttribute('data-revoir')); });
    document.querySelectorAll('[data-commencer]').forEach(b => { b.onclick = () => commencerModule(b.getAttribute('data-commencer')); });
  }

  // Liste des IDs de questions d'un module (pour calculer le %)
  function idsDuModule(mod) {
    const d = SINEA_DATA;
    if (mod === 'socle') {
      const ids = [];
      d.mini_items.forEach(it => ids.push(it.id));
      (d.adapte?.questions || []).forEach(it => ids.push(it.id));
      Object.values(d.sinea_famille).forEach(l => l.forEach(it => ids.push(it.id)));
      d.sinea_hybride.forEach(it => ids.push(it.id));
      (d.sinea_transversales || []).forEach(it => ids.push(it.id));
      (d.sinea_repartitions || []).forEach(it => ids.push(it.id));
      (d.contextuelles?.questions || []).forEach(it => ids.push(it.id));
      return ids;
    }
    if (mod === 'commercial') return (d.spe_commercial.challenger.questions || []).map(q => q.id).concat((d.spe_commercial.dimensions.questions || []).map(q => q.id));
    if (mod === 'manager') return (d.spe_management.goleman.questions || []).map(q => q.id).concat((d.spe_management.dimensions.questions || []).map(q => q.id));
    return [];
  }

  // Carte d'un résultat terminé (section "Mes résultats", en vitrine cliquable)
  function carteResultat(mod) {
    const l = LABELS_MODULE[mod];
    return `<div class="esp-resultat" data-revoir="${mod}">
      <div class="esp-res-glow"></div>
      <div class="esp-res-in">
        <div class="esp-res-label">Portrait complété</div>
        <div class="esp-res-title">${l.titre}</div>
        <div class="esp-res-cta">Consulter mon analyse →</div>
      </div>
    </div>`;
  }

  function carteModule(mod, etat, pct) {
    const l = LABELS_MODULE[mod];
    if (etat === 'go') {
      return `<div class="esp-card">
        <div class="esp-icon esp-ic-go">→</div>
        <div class="esp-body"><span class="esp-status esp-st-go">À découvrir</span><div class="esp-title">${l.titre}</div><div class="esp-sub">${l.sub}</div></div>
        <button class="esp-btn esp-btn-purple" data-commencer="${mod}">Commencer</button>
      </div>`;
    }
    if (etat === 'encours') {
      return `<div class="esp-card">
        <div class="esp-icon esp-ic-go">▷</div>
        <div class="esp-body">
          <span class="esp-status esp-st-go">En cours · ${pct}%</span>
          <div class="esp-title">${l.titre}</div>
          <div class="esp-progress"><div class="esp-progress-fill" style="width:${pct}%"></div></div>
        </div>
        <button class="esp-btn esp-btn-purple" data-commencer="${mod}">Continuer</button>
      </div>`;
    }
    if (etat === 'attente') {
      return `<div class="esp-card esp-locked">
        <div class="esp-icon esp-ic-lock">◔</div>
        <div class="esp-body"><span class="esp-status esp-st-lock">Bientôt</span><div class="esp-title">${l.titre}</div><div class="esp-lock-note">Disponible après votre portrait de personnalité.</div></div>
      </div>`;
    }
    return `<div class="esp-card esp-locked">
      <div class="esp-icon esp-ic-lock">🔒</div>
      <div class="esp-body"><span class="esp-status esp-st-lock">Verrouillé</span><div class="esp-title">${l.titre}</div><div class="esp-lock-note">Ce module n'est pas inclus dans votre accès.</div></div>
    </div>`;
  }

  function revoirAnalyse(mod) {
    if (!identite.email) return;
    fetch(PROGRESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load_analyse', email: identite.email }),
    })
      .then(r => r.json())
      .then(data => {
        const analyses = (data && data.analyses) || {};
        const a = analyses[mod];
        if (!a || !a.profil || !a.contenu) {
          alert("Cette analyse n'est pas disponible.");
          return;
        }
        // reconstruire l'objet résultat avec le contenu figé
        const res = Object.assign({}, a.profil);
        res.contenuFige = a.contenu;
        res.diagType = a.profil.diagType || mod;
        document.getElementById('screen-espace').classList.remove('active');
        document.getElementById('screen-result').classList.add('active');
        Result.render(res);
      })
      .catch(() => alert('Impossible de charger votre analyse pour le moment.'));
  }

  let profilSocleSauve = null; // profil du socle rechargé (pour les modules)
  let interactionsSocleSauve = null;

  function commencerModule(mod) {
    if (!identite.email) return;
    // récupérer le profil socle déjà calculé + les interactions (réponses ouvertes du socle)
    fetch(PROGRESSION_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load_analyse', email: identite.email }),
    })
      .then(r => r.json())
      .then(data => {
        const analyses = (data && data.analyses) || {};
        // le profil socle est stocké dans l'analyse socle
        profilSocleSauve = (analyses.socle && analyses.socle.profil) ? analyses.socle.profil : null;
        // récupérer aussi les réponses ouvertes du socle (pour nourrir le fil rouge)
        interactionsSocleSauve = null;
        fetch(PROGRESSION_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'load_interactions', email: identite.email }),
        })
          .then(r => r.json())
          .then(inter => {
            if (inter && inter.interactions && inter.interactions.socle) {
              interactionsSocleSauve = inter.interactions.socle;
            }
            lancerModule(mod);
          })
          .catch(() => lancerModule(mod));
      })
      .catch(() => alert('Impossible de lancer le module pour le moment.'));
  }

  function lancerModule(mod) {
    answers = {}; // le module ne réutilise pas les réponses brutes du socle (on a le profil figé)
    diagType = mod;
    queue = buildQueue(mod);
    idx = 0;
    document.getElementById('screen-espace').classList.remove('active');
    showChapterIntro('spe', () => {
      document.getElementById('screen-question').classList.add('active');
      render();
    });
  }

  function start() {
    // Le premier parcours est TOUJOURS le socle. Le type d'URL définit les DROITS (modules débloqués ensuite).
    droits = readDiagType(); // 'manager', 'commercial' ou 'classic'
    diagType = 'classic';    // on fait le socle
    queue = buildQueue();    // socle + contexte uniquement (le spé ne s'ajoute pas car diagType='classic')
    idx = 0;
    document.getElementById('screen-cover').classList.remove('active');
    document.getElementById('screen-identif').classList.remove('active');
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
      // Fin du test : poser les questions ouvertes avant le calcul
      showQuestionsOuvertes();
    }
  }

  // ---- Écran des questions ouvertes (analysées par l'IA) ----
  const openAnswers = {};

  function showQuestionsOuvertes() {
    const qo = SINEA_DATA.questions_ouvertes;
    let scr = document.getElementById('screen-open');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-open';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    const champs = qo.questions.map(q => `
      <div class="qo-field">
        <label class="qo-q">${q.question}</label>
        <textarea class="qo-input" rows="3" placeholder="${q.placeholder}" oninput="App.saveOpen('${q.id}', this.value)">${openAnswers[q.id] || ''}</textarea>
      </div>`).join('');
    scr.innerHTML = `
      <div class="qo-scroll">
        <button class="qo-back" onclick="App.backFromOpen()">← Retour aux questions</button>
        <div class="qo-head">
          <div class="qo-kicker">Presque terminé</div>
          <h2 class="qo-title">Vos mots comptent</h2>
          <p class="qo-sub">${qo.intro}</p>
        </div>
        ${champs}
        <button class="btn-primary qo-submit" onclick="App.submitOpen()">Découvrir mon portrait</button>
        <button class="btn-ghost" onclick="App.skipOpen()">Passer cette étape</button>
      </div>`;
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    window.scrollTo(0, 0);
  }

  function saveOpen(id, val) { openAnswers[id] = val; saveProgress(); }
  function backFromOpen() {
    // Revenir à la dernière question du test
    document.getElementById('screen-open').classList.remove('active');
    document.getElementById('screen-question').classList.add('active');
    render();
  }
  function submitOpen() {
    document.getElementById('screen-open').classList.remove('active');
    finish();
  }
  function skipOpen() {
    document.getElementById('screen-open').classList.remove('active');
    finish();
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

    // Répartir les réponses par type, selon la nature de chaque question.
    // On parcourt TOUTES les réponses disponibles (socle rechargé + module),
    // pas seulement la queue courante, pour que le scoring soit complet même en mode module seul.
    const repMini = {}, repSinea = {}, repCtx = {}, repSpeQcm = {}, repSpeDims = {}, repAdapte = {};
    const ctxIds = new Set((SINEA_DATA.contextuelles?.questions || []).map(q => q.id));
    const speDimIds = new Set([
      ...((SINEA_DATA.spe_management?.dimensions?.questions) || []).map(q => q.id),
      ...((SINEA_DATA.spe_commercial?.dimensions?.questions) || []).map(q => q.id),
    ]);
    // index : id -> { kind, chap } pour toutes les questions possibles
    const indexQuestions = {};
    const d = SINEA_DATA;
    d.mini_items.forEach(it => indexQuestions[it.id] = { kind: 'mini', chap: 'socle' });
    (d.adapte?.questions || []).forEach(it => indexQuestions[it.id] = { kind: 'mini', chap: 'socle' });
    Object.values(d.sinea_famille).forEach(l => l.forEach(it => indexQuestions[it.id] = { kind: 'qcm', chap: 'socle' }));
    d.sinea_hybride.forEach(it => indexQuestions[it.id] = { kind: 'curseur', chap: 'socle' });
    (d.sinea_transversales || []).forEach(it => indexQuestions[it.id] = { kind: 'qcm', chap: 'socle' });
    (d.sinea_repartitions || []).forEach(it => indexQuestions[it.id] = { kind: 'repart', chap: 'socle' });
    (d.contextuelles?.questions || []).forEach(it => indexQuestions[it.id] = { kind: 'ctx', chap: 'contexte' });
    (d.spe_management?.goleman?.questions || []).forEach(it => indexQuestions[it.id] = { kind: 'qcm', chap: 'spe' });
    (d.spe_management?.dimensions?.questions || []).forEach(it => indexQuestions[it.id] = { kind: 'ctx', chap: 'spe' });
    (d.spe_commercial?.challenger?.questions || []).forEach(it => indexQuestions[it.id] = { kind: 'qcm', chap: 'spe' });
    (d.spe_commercial?.dimensions?.questions || []).forEach(it => indexQuestions[it.id] = { kind: 'ctx', chap: 'spe' });

    Object.keys(answers).forEach(id => {
      const v = answers[id];
      const meta = indexQuestions[id];
      if (!meta) return;
      if (id.indexOf('ADP_') === 0) repAdapte[id] = v;
      else if (meta.kind === 'mini') repMini[id] = v;
      else if (meta.chap === 'socle') repSinea[id] = v;
      else if (ctxIds.has(id)) repCtx[id] = v;
      else if (meta.chap === 'spe' && speDimIds.has(id)) repSpeDims[id] = v;
      else if (meta.chap === 'spe') repSpeQcm[id] = v;
    });

    setTimeout(() => {
      if (profilSocleSauve && diagType !== 'classic') {
        // MODE MODULE : on réutilise le profil socle déjà calculé (archétype, Big Five, radar...)
        // et on ajoute seulement le scoring du module par-dessus.
        result = Object.assign({}, profilSocleSauve);
        result.diagType = diagType;
        // réponses ouvertes du socle (rechargées) pour nourrir le fil rouge
        result.reponsesOuvertes = (interactionsSocleSauve && interactionsSocleSauve.reponses_ouvertes) ? interactionsSocleSauve.reponses_ouvertes : {};
        result.speDims = Engine.scorerSpeDims(repSpeDims, diagType);
        result.speStyle = Engine.scorerSpeStyle(repSpeQcm, diagType);
        result.speStyleScores = Engine.scorerSpeStyleScores(repSpeQcm, diagType);
      } else {
        // MODE SOCLE (ou parcours complet)
        result = Engine.scorer(repMini, repSinea);
        result.contextuel = Engine.scorerContextuel(repCtx);
        result.diagType = diagType;
        result.reponsesOuvertes = openAnswers;
        result.naturelAdapte = Engine.scorerNaturelAdapte(repMini, repAdapte);
        if (diagType !== 'classic') {
          result.speDims = Engine.scorerSpeDims(repSpeDims, diagType);
          result.speStyle = Engine.scorerSpeStyle(repSpeQcm, diagType);
          result.speStyleScores = Engine.scorerSpeStyleScores(repSpeQcm, diagType);
        }
      }

      // Enregistrer le résultat dans Airtable (si un token est présent dans l'URL)
      enregistrerResultat(result);

      clearInterval(msgTimer);
      document.getElementById('screen-loader').classList.remove('active');
      document.getElementById('screen-result').classList.add('active');
      Result.render(result);
      window.scrollTo(0, 0);
      document.getElementById('phone-scroll')?.scrollTo(0, 0);
    }, 2200);
  }

  return { start, goToIdentif, goToEspace, sauverAnalyse, envoyerInteractions, next, prev, answer, answerCurseur, repartChange, initCover, saveOpen, submitOpen, skipOpen, backFromOpen, getResult: () => result };
})();

// Personnaliser l'accueil dès le chargement (questions, étapes, type)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.initCover());
} else {
  App.initCover();
}
