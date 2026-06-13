// ============================================================
// CONTRÔLEUR D'AFFICHAGE · App v2 mobile-first premium
// ============================================================
const App = (() => {
  let queue = [];          // séquence des questions
  let idx = 0;             // index courant
  let answers = {};      // réponses {id: valeur}
  let answersTime = {};  // temps de réponse {id: ms} pour le score de fiabilité
  const openAnswers = {};  // réponses ouvertes (intention avant test + q1/q2 en restitution)
  let renderTimeStart = 0;
  function enregistrerTemps(id) {
    if (answersTime[id] !== undefined) return; // on garde le premier temps (pas les corrections)
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (renderTimeStart) answersTime[id] = Math.round(now - renderTimeStart);
  }
  let result = null;
  let diagType = 'classic'; // type du PARCOURS en cours : 'classic'(socle) | 'manager' | 'commercial'
  let modeCampagne = '';    // 'recrutement' → parcours candidat : écran d'information + restitution allégée
  let droits = '';          // droits de la personne (modules autorisés), issus du lien d'invitation
  let magicCode = '';       // magic code de campagne saisi par la personne (pour consommer le quota à la fin)
  let nomCampagne = '';     // nom de la campagne (renvoyé par la vérification du code, écrit sur le répondant)
  let thematiqueCampagne = ''; // cap de la formation/campagne (optionnel) : alimente la révélation et les défis
  let estAjoutModule = false; // true si ce parcours est un module ajouté sur un socle existant (ne re-consomme pas le quota)

  // ---- Sauvegarde de progression (localStorage + serveur Airtable) ----
  // Protège contre la perte de réponses si l'onglet se ferme pendant le test.
  const SAVE_KEY = 'sinea_profile_progress';
  const API_BASE = "https://sinea-profile-ia.vercel.app/api";
  const PROGRESSION_URL = API_BASE + "/progression";
  const AUTH_URL = API_BASE + "/auth";
  const VERIFIER_CODE_URL = API_BASE + "/verifier_code";
  let saveTimer = null;

  function saveProgress() {
    // 1) sauvegarde locale immédiate (secours rapide)
    try {
      const data = { v: 1, ts: Date.now(), diagType, idx, answers, openAnswers, magicCode, nomCampagne, estAjoutModule, droits, modeCampagne };
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
          campagne: nomCampagne,
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
    const corps = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_analyse",
        email: identite.email,
        type_analyse: typeAnalyse, // 'socle' ou 'commercial' ou 'manager'
        contenu: contenu,
        prenom: identite.prenom,
        nom: identite.nom,
        droits: droits,
      }),
    };
    // une analyse mérite une seconde chance : nouvel essai unique 3 s après un échec
    const envoyer = () => fetch(PROGRESSION_URL, corps);
    envoyer().then((r) => { if (!r.ok) throw new Error("statut " + r.status); })
      .catch(() => { setTimeout(() => { envoyer().catch(() => {}); }, 3000); });
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
    const ENREGISTRER_URL = API_BASE + "/enregistrer";
    const profil = {
      dominante: result.dominante ? result.dominante.nom : "",
      secondaires: (result.secondaires || []).map(s => s.nom),
      famille: result.dominante ? result.dominante.famille : "",
      bigFive: result.scoresBigFive || {},
    };
    // Les réponses brutes et les temps de réponse partent avec le résultat :
    // c'est la matière première de la future validation psychométrique (Phase 2).
    const complet = Object.assign({}, result, { reponsesBrutes: answers, tempsReponses: answersTime });
    fetch(ENREGISTRER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, profil, resultatComplet: complet, campagne: nomCampagne }),
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
    d.mini_items.forEach(it => q.push({ kind: 'swipe', id: it.id, item: it, chap: 'socle' }));
    // Choix forcé Big Five (anti-désirabilité, alimente aussi le score de fiabilité)
    (d.mini_choix_force || []).forEach(it => q.push({ kind: 'choixforce', id: it.id, item: it, chap: 'socle' }));
    // Questions "adapté" (comportement au travail) pour mesurer le coût d'adaptation
    (d.adapte?.questions || []).forEach(it => q.push({ kind: 'swipe', id: it.id, item: it, chap: 'socle' }));
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

    // ===== CHAPITRE 2 : CONTEXTE (dimensions contextuelles + nouvelles dimensions) =====
    (d.contextuelles?.questions || []).forEach(it => {
      q.push({ kind: 'ctx', id: it.id, item: it, chap: 'contexte' });
    });
    // Nouvelles dimensions : énergie, collaboration, autorité, reconnaissance
    (d.contextuelles_plus?.questions || []).forEach(it => {
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
    // mode dev : afficher le bouton de remplissage auto
    if (isDev()) {
      const dev = document.getElementById('dev-autofill');
      if (dev) dev.style.display = 'block';
    }
    diagType = readDiagType();
    // la cover présente le SOCLE (premier parcours), pas le module collé
    const ancienDiag = diagType;
    diagType = 'classic';
    const q = buildQueue();
    diagType = ancienDiag;
    const nq = q.length;
    const nsec = 2; // socle + contexte
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

  // ---- Écran de connexion dédié (depuis le bouton "Se connecter" de l'accueil) ----
  function goToConnexion() {
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    const scr = document.getElementById('screen-connexion');
    scr.classList.add('active');
    const submit = document.getElementById('cx-submit');
    if (submit && !submit.dataset.bound) { submit.onclick = soumettreConnexion; submit.dataset.bound = '1'; }
  }

  function goToCover() {
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-cover').classList.add('active');
  }

  function soumettreConnexion() {
    const email = (document.getElementById('cx-email').value || '').trim().toLowerCase();
    const err = document.getElementById('cx-error');
    if (!emailValide(email)) { err.textContent = 'Cette adresse email semble incorrecte.'; return; }
    err.textContent = 'Envoi du code...';
    identite.email = email;
    fetch(AUTH_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_code", email }),
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.ok) {
          err.textContent = '';
          document.getElementById('screen-connexion').classList.remove('active');
          afficherEcranCode(email);
        } else if (data && data.no_account) {
          err.innerHTML = "Aucun compte associé à cet email. <a href='#' id='cx-vers-test' style='color:var(--c-purple-text);font-weight:600;'>Commencer le test</a>";
          const lien = document.getElementById('cx-vers-test');
          if (lien) lien.onclick = (e) => { e.preventDefault(); document.getElementById('screen-connexion').classList.remove('active'); goToIdentif(); };
        } else {
          err.textContent = (data && data.error) || "Impossible d'envoyer le code.";
        }
      })
      .catch(() => { err.textContent = 'Connexion impossible. Réessayez dans un instant.'; });
  }

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
    goToMagicCode();
  }

  // Écran du magic code (après inscription, avant le test)
  function goToMagicCode() {
    const scr = document.getElementById('screen-magic');
    if (!scr) { start(); return; } // sécurité : si pas d'écran, on laisse passer
    scr.classList.add('active');
    const input = document.getElementById('magic-input');
    const submit = document.getElementById('magic-submit');
    const back = document.getElementById('magic-back');
    const err = document.getElementById('magic-error');
    if (input) input.value = '';
    if (err) err.textContent = '';
    if (submit) submit.onclick = submitMagicCode;
    if (input) input.onkeydown = (e) => { if (e.key === 'Enter') submitMagicCode(); };
    if (back) back.onclick = () => { scr.classList.remove('active'); goToIdentif(); };
    if (input) input.focus();
  }

  function brancherLienConnexion() {
    const lien = document.getElementById('magic-vers-connexion');
    if (lien) lien.onclick = (e) => {
      e.preventDefault();
      document.getElementById('screen-magic').classList.remove('active');
      goToConnexion();
      const champ = document.getElementById('cx-email');
      if (champ) champ.value = identite.email;
    };
  }

  // Écran d'information candidat (contexte recrutement) : transparence sur la méthode,
  // la confidentialité et la place de l'humain dans la décision. Affiché avant le test.
  function afficherInfoCandidat(suite) {
    const ov = document.createElement('div');
    ov.className = 'cand-info-overlay';
    ov.innerHTML = '<div class="cand-info-card">'
      + '<div class="cand-info-kicker">Avant de commencer</div>'
      + '<h2 class="cand-info-titre">Ce test éclaire, il ne décide pas</h2>'
      + '<p>Ce questionnaire évalue vos <b>soft skills</b> et votre façon naturelle de fonctionner au travail. Il porte sur le comportement, jamais sur vos compétences techniques.</p>'
      + '<p>Vos résultats servent à <b>préparer un échange de qualité</b> avec l\'entreprise. Ils restent confidentiels et la décision de recrutement appartient toujours à des humains.</p>'
      + '<p>Vous recevrez votre <b>portrait de personnalité</b>, qui reste le vôtre, quelle que soit la suite du processus.</p>'
      + '<p class="cand-info-note">Répondez spontanément : il n\'existe aucune bonne ou mauvaise réponse, et le test détecte mieux la sincérité que la perfection.</p>'
      + '<button class="cand-info-go" id="cand-info-go">J\'ai compris, commencer</button>'
      + '</div>';
    document.body.appendChild(ov);
    document.getElementById('cand-info-go').onclick = () => { ov.remove(); if (typeof suite === 'function') suite(); };
  }

  function consommerMagicCode() {
    if (!magicCode) return;
    fetch(VERIFIER_CODE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'consommer', code: magicCode }),
    }).catch(() => {});
  }

  function submitMagicCode() {
    const input = document.getElementById('magic-input');
    const submit = document.getElementById('magic-submit');
    const err = document.getElementById('magic-error');
    const code = (input.value || '').trim();
    if (!code) { err.textContent = 'Merci d\'entrer votre code d\'accès.'; return; }
    err.textContent = 'Vérification...';
    if (submit) submit.disabled = true;
    fetch(VERIFIER_CODE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verifier', code, email: identite.email }),
    })
      .then(r => r.json())
      .then(data => {
        if (submit) submit.disabled = false;
        if (data && data.ok) {
          magicCode = code;
          nomCampagne = data.campagne || '';
          droits = data.type || 'classic';
          modeCampagne = (data.mode || '').toLowerCase();
          thematiqueCampagne = data.thematique || '';
          try { window.SINEA_THEME = thematiqueCampagne; } catch(e){} // expose la thématique à la séquence de révélation
          err.textContent = '';
          document.getElementById('screen-magic').classList.remove('active');
          if (data.ajout_module && data.deja_socle) {
            // la personne a déjà le socle : on lance directement le module (pas de re-socle)
            estAjoutModule = true;
            diagType = data.type;
            commencerModule(data.type);
          } else {
            // parcours en deux étapes : le socle d'abord (start force diagType=classic),
            // le module manager/commercial se débloque ensuite (droits = data.type).
            estAjoutModule = false;
            droits = data.type || 'classic';
            if (modeCampagne === 'recrutement') afficherInfoCandidat(start);
            else start();
          }
        } else {
          const raison = data ? data.raison : '';
          if (raison === 'deja_fait') {
            err.innerHTML = 'Vous avez déjà passé ce test. <a href="#" id="magic-vers-connexion" style="color:var(--c-purple-text);font-weight:600;">Accéder à mon espace</a>';
            brancherLienConnexion();
          }
          else if (raison === 'module_deja_fait') {
            err.innerHTML = 'Vous avez déjà passé ce module. <a href="#" id="magic-vers-connexion" style="color:var(--c-purple-text);font-weight:600;">Accéder à mon espace</a>';
            brancherLienConnexion();
          }
          else if (raison === 'quota_epuise') err.textContent = 'Ce code a atteint son nombre maximum d\'utilisations. Contactez votre référent.';
          else if (raison === 'campagne_fermee') err.textContent = 'Ce code n\'est plus actif. Contactez votre référent.';
          else err.textContent = 'Ce code d\'accès est invalide. Vérifiez votre saisie.';
        }
      })
      .catch(() => {
        if (submit) submit.disabled = false;
        err.textContent = 'La vérification a échoué. Réessayez dans un instant.';
      });
  }

  function resumeIdentif() {
    const email = (document.getElementById('id-email').value || '').trim().toLowerCase();
    const err = document.getElementById('id-error');
    if (!emailValide(email)) { err.textContent = 'Entrez votre email pour vous reconnecter.'; return; }
    err.textContent = 'Envoi du code de connexion...';
    identite.email = email;
    // envoyer un code à 6 chiffres par email
    fetch(AUTH_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_code", email }),
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.ok) {
          err.textContent = '';
          document.getElementById('screen-identif').classList.remove('active');
          afficherEcranCode(email);
        } else {
          err.textContent = (data && data.error) || "Impossible d'envoyer le code.";
        }
      })
      .catch(() => { err.textContent = 'Connexion impossible. Réessayez dans un instant.'; });
  }

  // ---- Écran de saisie du code ----
  function afficherEcranCode(email) {
    const scr = document.getElementById('screen-code');
    scr.classList.add('active');
    document.getElementById('code-email-rappel').textContent = email;
    document.getElementById('code-saisie').value = '';
    document.getElementById('code-error').textContent = '';
    const submit = document.getElementById('code-submit');
    const resend = document.getElementById('code-resend');
    if (submit && !submit.dataset.bound) { submit.onclick = verifierCode; submit.dataset.bound = '1'; }
    if (resend && !resend.dataset.bound) { resend.onclick = renvoyerCode; resend.dataset.bound = '1'; }
  }

  function verifierCode() {
    const code = (document.getElementById('code-saisie').value || '').trim();
    const err = document.getElementById('code-error');
    if (code.length !== 6) { err.textContent = 'Entrez les 6 chiffres du code.'; return; }
    err.textContent = 'Vérification...';
    fetch(AUTH_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_code", email: identite.email, code }),
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.ok) {
          identite.prenom = data.prenom || identite.prenom;
          err.textContent = '';
          document.getElementById('screen-code').classList.remove('active');
          goToEspace();
        } else {
          err.textContent = (data && data.error) || 'Code incorrect.';
        }
      })
      .catch(() => { err.textContent = 'Connexion impossible. Réessayez.'; });
  }

  function renvoyerCode() {
    const err = document.getElementById('code-error');
    err.textContent = 'Envoi d\'un nouveau code...';
    fetch(AUTH_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_code", email: identite.email }),
    })
      .then(r => r.json())
      .then(data => { err.textContent = (data && data.ok) ? 'Nouveau code envoyé.' : 'Erreur lors de l\'envoi.'; })
      .catch(() => { err.textContent = 'Connexion impossible.'; });
  }

  // ---- Espace perso (compte utilisateur) ----
  const LABELS_MODULE = {
    socle: { titre: 'Votre portrait de personnalité', sub: 'Votre socle, vos forces, vos dimensions profondes.' },
    commercial: { titre: 'Votre approche commerciale', sub: 'Comment votre personnalité nourrit votre manière de vendre.' },
    manager: { titre: 'Votre style de management', sub: 'Comment votre personnalité façonne votre leadership.' },
  };

  const PDF_PORTRAIT_URL = API_BASE + "/pdf_portrait";
  async function telechargerPortraitEspace() {
    const btn = document.getElementById('espace-pdf-btn');
    if (!identite.email || !btn) return;
    const texte = btn.textContent;
    const estMob0 = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
    const preFenetre = estMob0 ? window.open('', '_blank') : null;
    btn.textContent = 'Génération de votre portrait…'; btn.disabled = true;
    try {
      const rep = await fetch(PDF_PORTRAIT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: identite.email }) });
      if (!rep.ok) throw new Error('indisponible');
      const blob = await rep.blob();
      const estMob = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
      const url = URL.createObjectURL(blob);
      if (estMob) {
        if (preFenetre && !preFenetre.closed) { preFenetre.location = url; } else { const w = window.open(url, '_blank'); if (!w) location.href = url; }
        setTimeout(()=>URL.revokeObjectURL(url), 60000);
      } else {
        const a = document.createElement('a'); a.href = url; a.download = 'Portrait_Sinea.pdf';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 4000);
      }
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      btn.textContent = 'Portrait téléchargé ✓';
      setTimeout(() => { btn.textContent = texte; btn.disabled = false; }, 3500);
    } catch (e) { btn.textContent = 'Réessayer le téléchargement'; btn.disabled = false; }
  }

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

  // Phrases d'accueil par archétype précis (ton inspirant + chaleureux, affirmatif)
  const ACCUEIL_ARCHETYPE = {
    "La Tisseuse": "Votre talent pour créer du lien et faire tenir les liens ensemble se lit déjà dans votre portrait.",
    "Le Passeur": "Votre art de relier les personnes et de transmettre transparaît dans votre portrait.",
    "Le Roc": "Votre présence solide, celle sur qui les autres s'appuient, éclaire votre portrait.",
    "Le Diplomate": "Votre finesse pour accorder les points de vue donne sa couleur à votre portrait.",
    "L'Ambassadeur": "Votre talent pour porter haut les idées et rassembler se révèle dans votre portrait.",
    "Le Capitaine": "Votre capacité à mener et à donner le cap transparaît dans votre portrait.",
    "L'Indomptable": "Votre énergie qui ouvre la voie et ose se lit déjà dans votre portrait.",
    "Le Champion": "Votre élan, ce moteur qui entraîne les autres vers le résultat, éclaire votre portrait.",
    "Le Pionnier": "Votre goût d'explorer et d'ouvrir des chemins neufs donne sa couleur à votre portrait.",
    "Le Résilient": "Votre force tranquille, celle qui rebondit et tient dans la durée, se révèle dans votre portrait.",
    "L'Architecte": "Votre sens de la structure et de la vision d'ensemble transparaît dans votre portrait.",
    "La Sentinelle": "Votre vigilance attentive, celle qui protège et anticipe, se lit dans votre portrait.",
    "Le Gardien": "Votre sens de la justesse et de la solidité éclaire votre portrait.",
    "L'Orfèvre": "Votre exigence du détail juste et du travail bien fait donne sa couleur à votre portrait.",
    "Le Stratège": "Votre capacité à lire loin et à poser les bons coups transparaît dans votre portrait.",
    "Le Conteur": "Votre talent pour donner du sens et embarquer par le récit se révèle dans votre portrait.",
    "L'Étincelle": "Votre énergie créative, celle qui allume les idées, se lit déjà dans votre portrait.",
    "Le Veilleur": "Votre regard qui perçoit les signaux faibles avant les autres éclaire votre portrait.",
    "L'Explorateur": "Votre curiosité qui repousse les horizons donne sa couleur à votre portrait.",
    "Le Révélateur": "Votre don pour faire émerger le potentiel des autres se révèle dans votre portrait.",
  };

  // Phrases d'accueil adaptées à la famille de l'archétype (repli si l'archétype n'est pas listé)
  const ACCUEIL_FAMILLE = {
    RELATION: "Votre talent pour relier les autres se lit déjà dans votre portrait.",
    ACTION: "Votre énergie et votre élan transparaissent dans votre portrait.",
    STRUCTURE: "Votre sens de la justesse et de la solidité éclaire votre portrait.",
    VISION: "Votre regard tourné vers l'horizon donne sa couleur à votre portrait.",
  };
  // Sous-phrase selon l'avancement
  function phraseAvancement(analyses, droitsTxt) {
    const aModuleDispo = (droitsTxt.includes('commercial') && !analyses.commercial) || (droitsTxt.includes('manager') && !analyses.manager);
    const toutFait = analyses.socle && (!droitsTxt.includes('commercial') || analyses.commercial) && (!droitsTxt.includes('manager') || analyses.manager);
    if (toutFait) return "Votre parcours est complet. Explorez vos analyses quand vous le souhaitez.";
    if (analyses.socle && aModuleDispo) return "Une exploration de plus vous attend pour révéler comment votre nature s'exprime au travail.";
    if (!analyses.socle) return "Votre première exploration vous attend.";
    return "Continuez votre parcours à votre rythme.";
  }

  function renderEspace(data) {
    const prenom = data.prenom || identite.prenom || '';
    const analyses = data.analyses || {};
    // archétype : depuis le champ Airtable, ou à défaut depuis le profil de l'analyse socle
    let archetype = data.archetype || '';
    let famille = data.famille || '';
    if ((!archetype) && analyses.socle && analyses.socle.profil && analyses.socle.profil.dominante) {
      archetype = analyses.socle.profil.dominante.nom || '';
      famille = analyses.socle.profil.dominante.famille || '';
    }
    const droitsTxt = (data.droits || droits || '').toLowerCase();
    const progression = data.progression || {};
    const progType = data.diagTypeEnCours || ''; // type du module en cours si applicable

    document.getElementById('espace-name').textContent = 'Bonjour ' + prenom;

    // Phrase d'accueil adaptée à la famille + avancement
    const accueilEl = document.getElementById('espace-accueil');
    if (accueilEl) {
      const famKey = (famille || '').toUpperCase();
      // priorité à la phrase par archétype précis, repli sur la famille
      const phraseFam = ACCUEIL_ARCHETYPE[archetype] || ACCUEIL_FAMILLE[famKey] || "Voici votre espace personnel, le reflet de votre singularité.";
      const phraseAv = phraseAvancement(analyses, droitsTxt);
      accueilEl.innerHTML = `<span class="espace-accueil-fam">${phraseFam}</span> <span class="espace-accueil-av">${phraseAv}</span>`;
    }

    // Barre de progression globale du parcours
    const progGlobalEl = document.getElementById('espace-prog-globale');
    if (progGlobalEl) {
      // total des explorations = socle + modules autorisés
      let total = 1; // socle
      if (droitsTxt.includes('commercial')) total++;
      if (droitsTxt.includes('manager')) total++;
      let faits = 0;
      if (analyses.socle) faits++;
      if (analyses.commercial) faits++;
      if (analyses.manager) faits++;
      const pctGlobal = Math.round((faits / total) * 100);
      progGlobalEl.innerHTML = `
        <div class="espace-pg-head"><span>Votre parcours</span><span>${faits} exploration${faits > 1 ? 's' : ''} sur ${total}</span></div>
        <div class="espace-pg-bar"><div class="espace-pg-fill" style="width:${pctGlobal}%"></div></div>`;
    }

    // afficher le personnage de l'archétype dans l'en-tête
    const persoEl = document.getElementById('espace-hero-perso');
    if (persoEl) {
      const slugImg = archetype ? (SINEA_DATA.images && SINEA_DATA.images[archetype]) : '';
      if (slugImg) {
        persoEl.innerHTML = `<img src="${slugImg}.webp" alt="${archetype}" />`;
        persoEl.style.display = 'block';
      } else {
        persoEl.style.display = 'none';
      }
    }
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
      faits.forEach(m => { resultatsHtml += carteResultat(m, (analyses[m] && analyses[m].date) || '', archetype); });
    }
    if (analyses.socle) {
      resultatsHtml += `<button class="espace-pdf-btn" id="espace-pdf-btn" onclick="App.telechargerPortraitEspace()">Télécharger mon portrait complet (PDF)</button>`;
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

    // Compatibilités d'équipe (si on connaît la famille de la personne)
    const compatEl = document.getElementById('espace-compat');
    const compatGridEl = document.getElementById('espace-compat-grid');
    if (compatEl && compatGridEl && famille && window.Result && Result.htmlCompatibilites) {
      const html = Result.htmlCompatibilites(famille);
      if (html) { compatGridEl.innerHTML = html; compatEl.style.display = 'block'; }
    }

    // câbler les boutons
    document.querySelectorAll('[data-revoir]').forEach(b => { b.onclick = () => revoirAnalyse(b.getAttribute('data-revoir')); });
    document.querySelectorAll('[data-commencer]').forEach(b => {
      b.onclick = () => {
        const mod = b.getAttribute('data-commencer');
        // le socle se lance via start() ; les modules spé via commencerModule()
        if (mod === 'socle') {
          document.getElementById('screen-espace').classList.remove('active');
          start();
        } else {
          commencerModule(mod);
        }
      };
    });
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
  function formaterDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
      return `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) { return ''; }
  }

  function carteResultat(mod, dateIso, archetype) {
    const l = LABELS_MODULE[mod];
    const dateTxt = formaterDate(dateIso);
    const dateLigne = dateTxt ? `<div class="esp-res-date">Réalisé le ${dateTxt}</div>` : '';
    // personnage de l'archétype (affiché pour le socle, qui porte le portrait de personnalité)
    const slug = (archetype && SINEA_DATA.images && SINEA_DATA.images[archetype]) ? SINEA_DATA.images[archetype] : '';
    const persoHtml = (mod === 'socle' && slug) ? `<div class="esp-res-perso"><img src="${slug}.webp" alt="${archetype}"/></div>` : '';
    return `<div class="esp-resultat">
      <div class="esp-res-glow"></div>
      <div class="esp-res-in">
        <div class="esp-res-texte">
          <div class="esp-res-badge">Complété · 100%</div>
          <div class="esp-res-title">${l.titre}</div>
          ${dateLigne}
          <div class="esp-res-actions">
            <button class="esp-res-btn" data-revoir="${mod}">Consulter mon analyse</button>
            <button class="esp-res-btn esp-res-btn-soon" disabled>Mon plan d'action · bientôt</button>
          </div>
        </div>
        ${persoHtml}
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
        if (!a || !a.profil || !a.profil.dominante) {
          alert("Cette analyse n'est pas encore disponible.");
          return;
        }
        // reconstruire l'objet résultat
        const res = Object.assign({}, a.profil);
        res.diagType = a.profil.diagType || mod;
        res.modeCampagne = a.profil.modeCampagne || '';
        // si le contenu IA a été sauvegardé, on le réaffiche à l'identique (figé) ;
        // sinon, on laisse generateIA le régénérer.
        if (a.contenu && typeof a.contenu === 'object' && Object.keys(a.contenu).length > 0) {
          res.contenuFige = a.contenu;
        }
        document.getElementById('screen-espace').classList.remove('active');
        document.getElementById('screen-result').classList.add('active');
        Result.render(res);
        if (Result.setEmail) Result.setEmail(identite.email || '');
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

  // ---- MODE DEV : remplir automatiquement le parcours pour tester sans répondre ----
  function isDev() {
    try { return new URLSearchParams(window.location.search).get('dev') === '1'; } catch (e) { return false; }
  }

  function valeurAleatoire(q) {
    const kind = q.kind;
    if (kind === 'mini' || kind === 'swipe') return 1 + Math.floor(Math.random() * 4); // échelle 1-4
    if (kind === 'choixforce') return Math.random() < 0.5 ? 'a' : 'b';
    if (kind === 'curseur') return Math.floor(Math.random() * 101); // 0-100
    if (kind === 'repart') {
      // répartir ~10 points sur les axes
      const item = q.item; const axes = (item && item.axes) || [];
      const out = {}; let reste = 10;
      axes.forEach((a, i) => { const v = i === axes.length - 1 ? reste : Math.floor(Math.random() * (reste + 1)); out[a.famille || a.style] = v; reste -= v; });
      return out;
    }
    // qcm / ctx : index d'option aléatoire
    const opts = (q.item && q.item.options) || [];
    return opts.length ? Math.floor(Math.random() * opts.length) : 0;
  }

  function autoFill() {
    // En mode dev : si pas d'identité, en mettre une de test (pour ne pas avoir à remplir l'identification)
    if (!identite.email) {
      identite.prenom = 'Test';
      identite.nom = 'Dev';
      identite.email = 'test.dev@sinea.fr';
    }
    // si on n'a pas encore lancé de parcours (queue vide), lancer le socle
    if (!queue || queue.length === 0) {
      droits = readDiagType();
      diagType = 'classic';
      queue = buildQueue();
    }
    // remplir toutes les réponses de la queue courante
    queue.forEach(q => { answers[q.id] = valeurAleatoire(q); });
    openAnswers['q1'] = 'Réponse de test pour la première question ouverte.';
    openAnswers['q2'] = 'Réponse de test pour la seconde question ouverte.';
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    finish();
  }

  function start() {
    // Le premier parcours est TOUJOURS le socle. Le type définit les DROITS (modules débloqués ensuite).
    // Le droit accordé par le magic code fait foi ; l'URL (?type=...) ne sert
    // que de repli pour les anciens liens directs sans code.
    if (!droits || droits === 'classic') droits = readDiagType();
    diagType = 'classic';    // on fait le socle
    queue = buildQueue();    // socle + contexte uniquement (le spé ne s'ajoute pas car diagType='classic')
    idx = 0;
    document.getElementById('screen-cover').classList.remove('active');
    document.getElementById('screen-identif').classList.remove('active');
    // Accueil animé (même univers que le coach) : donne du sens et installe le sérieux,
    // puis enchaîne sur la question d'intention, puis le test.
    jouerAccueil(() => {
      afficherIntention(() => {
        showChapterIntro('socle', () => {
          document.getElementById('screen-question').classList.add('active');
          render();
        });
      });
    });
  }

  // Accueil séquencé façon coach. Contenu adapté au parcours :
  // complet au socle (installe la crédibilité), court et ciblé pour les modules.
  function jouerAccueil(suite) {
    const estModule = estAjoutModule && diagType !== 'classic';
    let steps;
    if (!estModule) {
      steps = [
        { hi: 'Votre bilan commence', line: 'Votre personnalité tient en cinq dimensions.<br>Leur combinaison fait de vous quelqu\'un d\'unique.' },
        { line: 'Ce bilan repose sur le modèle des <strong>Big Five</strong>, la référence scientifique en psychologie de la personnalité, et transforme ces cinq dimensions en un portrait vivant.' },
        { line: 'Une seule chose compte ici : <strong>votre sincérité</strong>.', hint: 'Il existe autant de profils justes que de personnes. Le vôtre se dessine au fil de vos réponses spontanées.' },
        { line: 'Vous repartez avec une lecture fine de vos forces et de ce qui vous rend précieux au travail.', hint: 'Prenez ce temps pour vous.', bouton: 'Commencer' },
      ];
    } else if (diagType === 'manager') {
      steps = [
        { hi: 'Module management', line: 'Vous connaissez maintenant votre personnalité de fond.<br>Voyons comment elle façonne votre manière de <strong>manager</strong>.' },
        { line: 'Ce module éclaire votre posture de leader, vos réflexes face à une équipe, et les leviers qui vous rendront encore plus juste dans votre rôle.', hint: 'Répondez avec la même sincérité.', bouton: 'Commencer' },
      ];
    } else {
      steps = [
        { hi: 'Module commercial', line: 'Vous connaissez maintenant votre personnalité de fond.<br>Voyons comment elle s\'exprime dans votre façon de <strong>vendre</strong>.' },
        { line: 'Ce module révèle votre style commercial, vos réflexes en rendez-vous, et les leviers qui feront de vous un partenaire encore plus convaincant.', hint: 'Répondez avec la même sincérité.', bouton: 'Commencer' },
      ];
    }

    const ov = document.createElement('div');
    ov.className = 'coach-intro';
    const stepsHtml = steps.map((s, k) =>
      '<div class="coach-intro-step" data-step="' + (k + 1) + '">'
      + (s.hi ? '<p class="coach-intro-hi">' + s.hi + '</p>' : '')
      + '<p class="coach-intro-line">' + s.line + '</p>'
      + (s.hint ? '<p class="coach-intro-hint">' + s.hint + '</p>' : '')
      + (s.bouton ? '<button class="coach-intro-go" id="accueil-go">' + s.bouton + '</button>' : '')
      + '</div>'
    ).join('');
    ov.innerHTML = '<div class="coach-intro-card"><div class="coach-intro-orb"><span class="coach-intro-orb-core"></span></div>' + stepsHtml + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('on'));

    const stepEls = ov.querySelectorAll('.coach-intro-step');
    const montrer = (n) => stepEls.forEach((s, k) => s.classList.toggle('show', k === n));
    montrer(0);
    // cadence : ~2,5 s par message, sauf le dernier qui attend le clic
    const timers = [];
    for (let n = 1; n < steps.length; n++) {
      timers.push(setTimeout(() => montrer(n), n * 2500));
    }
    let fini = false;
    const fermer = () => {
      if (fini) return; fini = true;
      timers.forEach(clearTimeout);
      ov.classList.remove('on');
      setTimeout(() => { ov.remove(); suite(); }, 500);
    };
    ov.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'accueil-go') { fermer(); return; }
      // un clic sur le dernier message (déjà affiché) permet aussi de passer
      if (stepEls[steps.length - 1] && stepEls[steps.length - 1].classList.contains('show')) fermer();
    });
    // filet : bouton "passer" discret pour les pressés, dès le départ
    const skip = document.createElement('button');
    skip.className = 'coach-intro-skip';
    skip.textContent = 'Passer l\'introduction';
    skip.onclick = fermer;
    ov.querySelector('.coach-intro-card').appendChild(skip);
  }

  // Écran d'intention : une seule question ouverte, légère, optionnelle.
  function afficherIntention(suite) {
    if (estAjoutModule) { suite(); return; } // un module spé ne redemande pas l'intention
    const qo = (SINEA_DATA.questions_ouvertes && SINEA_DATA.questions_ouvertes.intention) || null;
    if (!qo) { suite(); return; }
    let scr = document.getElementById('screen-intention');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-intention';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    scr.innerHTML =
      '<div class="qo-scroll">' +
        '<div class="qo-head">' +
          '<div class="qo-kicker">Avant de commencer</div>' +
          '<h2 class="qo-title">Une question pour vous</h2>' +
          '<p class="qo-sub">Votre réponse nous accompagne, et nous vous la rappellerons à la fin de votre bilan.</p>' +
        '</div>' +
        '<div class="qo-field">' +
          '<label class="qo-q">' + qo.question + '</label>' +
          '<textarea class="qo-input" id="intention-input" rows="3" placeholder="' + (qo.placeholder || '') + '">' + (openAnswers.intention || '') + '</textarea>' +
        '</div>' +
        '<button class="btn-primary qo-submit" id="intention-go">Commencer le test</button>' +
        '<button class="btn-ghost" id="intention-skip">Passer</button>' +
      '</div>';
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    window.scrollTo(0, 0);
    const valider = () => {
      const v = document.getElementById('intention-input');
      if (v) { openAnswers.intention = (v.value || '').trim(); saveProgress(); }
      scr.classList.remove('active');
      suite();
    };
    document.getElementById('intention-go').onclick = valider;
    document.getElementById('intention-skip').onclick = () => { scr.classList.remove('active'); suite(); };
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
      if (saved.openAnswers) Object.assign(openAnswers, saved.openAnswers);
      idx = Math.min(saved.idx || 0, queue.length - 1);
      // restaurer le contexte de campagne (le quota se décompte bien même après une reprise)
      if (saved.magicCode) magicCode = saved.magicCode;
      if (saved.nomCampagne) nomCampagne = saved.nomCampagne;
      if (typeof saved.estAjoutModule === 'boolean') estAjoutModule = saved.estAjoutModule;
      if (saved.droits && (!droits || droits === 'classic')) droits = saved.droits;
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
    // À partir du 2e chapitre : célébration du chemin parcouru + invitation à affiner
    const firstIdx = queue.findIndex(q => q.chap === chapId);
    const pct = (queue.length && firstIdx > 0) ? Math.min(99, Math.round((firstIdx / queue.length) * 100)) : (queue.length ? Math.min(99, Math.round((idx / queue.length) * 100)) : 0);
    const C = 2 * Math.PI * 34; // circonférence de l'anneau (r=34)
    const encouragements = {
      contexte: { bravo: 'Première partie terminée', phrase: 'Le plus long est derrière vous. Encore quelques questions courtes pour affiner votre profil avec précision.' },
      spe: { bravo: 'Votre socle est complet', phrase: diagType === 'commercial' ? 'Place à la dernière étape : votre façon de vendre et de convaincre.' : 'Place à la dernière étape : votre posture de manager au quotidien.' },
    };
    const enc = numero > 1 ? encouragements[chapId] : null;
    const celebration = enc ? `
        <div class="chap-bravo chap-a1"><span class="chap-bravo-check">✓</span>${enc.bravo}</div>
        <div class="chap-ring chap-a2">
          <svg viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" class="chap-ring-bg"/>
            <circle cx="40" cy="40" r="34" class="chap-ring-fill" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - pct / 100)}"/>
          </svg>
          <div class="chap-ring-pct">${pct}%</div>
        </div>
        <div class="chap-encourage chap-a3">${enc.phrase}</div>` : '';
    scr.innerHTML = `
      <div class="chap-halo"></div>
      <div class="chap-in">
        <div class="chap-step ${enc ? 'chap-a1' : ''}">Étape ${numero} sur ${totalChap}</div>
        ${celebration}
        <h2 class="chap-title ${enc ? 'chap-a3' : ''}">${chap.titre}</h2>
        <div class="chap-sub ${enc ? 'chap-a4' : ''}">${chap.sous}</div>
        <button class="chap-btn ${enc ? 'chap-a4' : ''}" id="chap-go">${numero > 1 ? 'Continuer' : 'Commencer'}</button>
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
      // Fin du test : on va directement au calcul. Les questions ouvertes (projective
      // et difficulté) sont désormais posées au début de la restitution, au pic de motivation.
      finish();
    }
  }

  function saveOpen(id, val) { openAnswers[id] = val; saveProgress(); }

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
    else if (cur.kind === 'swipe') { body.innerHTML = renderSwipe(cur); initSwipeDrag(cur); }
    else if (cur.kind === 'choixforce') body.innerHTML = renderChoixForce(cur);
    else if (cur.kind === 'qcm' || cur.kind === 'ctx') body.innerHTML = renderQcm(cur);
    else if (cur.kind === 'curseur') body.innerHTML = renderCurseur(cur);
    else if (cur.kind === 'repart') body.innerHTML = renderRepart(cur);
    refreshNav();
    renderTimeStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
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
    const tags = { mini: 'Vous, spontanément', swipe: 'Vous, spontanément', choixforce: 'Ce qui vous ressemble le plus', qcm: 'En situation', ctx: 'Votre tendance', curseur: 'Entre deux pôles', repart: 'Vos priorités' };
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

  // ---- Swipe : carte d'affirmation, 4 réponses (échelle 1-4 conservée) ----
  function renderSwipe(cur) {
    const it = cur.item;
    const val = answers[cur.id];
    const niveaux = [
      { v: 1, label: 'Pas du tout', cls: 'sw-non' },
      { v: 2, label: 'Plutôt non', cls: 'sw-pnon' },
      { v: 3, label: 'Plutôt oui', cls: 'sw-poui' },
      { v: 4, label: 'Tout à fait', cls: 'sw-oui' },
    ];
    const btns = niveaux.map(n => `
      <button class="sw-btn ${n.cls} ${val === n.v ? 'sel' : ''}" onclick="App.answerSwipe('${cur.id}', ${n.v})">${n.label}</button>`).join('');
    return `
      <div class="q-tag">${sectionTag(cur)}</div>
      <div class="sw-zone">
        <div class="sw-card" id="sw-card">
          <span class="sw-mark sw-mark-oui">Oui</span>
          <span class="sw-mark sw-mark-non">Non</span>
          <div class="sw-quote">${it.texte}</div>
        </div>
      </div>
      <div class="sw-actions">${btns}</div>
      <p class="sw-hint">Glissez la carte ou touchez une réponse</p>`;
  }

  // Glisser la carte : droite = tout à fait (4), gauche = pas du tout (1)
  function initSwipeDrag(cur) {
    const card = document.getElementById('sw-card');
    if (!card) return;
    let sx = 0, dx = 0, drag = false;
    const st = e => { drag = true; sx = (e.touches ? e.touches[0].clientX : e.clientX); card.style.transition = 'none'; };
    const mv = e => {
      if (!drag) return;
      dx = (e.touches ? e.touches[0].clientX : e.clientX) - sx;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
      const oui = card.querySelector('.sw-mark-oui'), non = card.querySelector('.sw-mark-non');
      if (oui) oui.style.opacity = dx > 40 ? Math.min(dx / 120, 1) : 0;
      if (non) non.style.opacity = dx < -40 ? Math.min(-dx / 120, 1) : 0;
    };
    const en = () => {
      if (!drag) return;
      drag = false;
      if (Math.abs(dx) > 90) {
        animerSwipe(dx > 0);
        answerSwipe(cur.id, dx > 0 ? 4 : 1, true);
      } else {
        card.style.transition = 'transform 0.25s';
        card.style.transform = '';
        card.querySelectorAll('.sw-mark').forEach(m => m.style.opacity = 0);
      }
      dx = 0;
    };
    card.addEventListener('mousedown', st);
    card.addEventListener('touchstart', st, { passive: true });
    window.addEventListener('mousemove', mv);
    window.addEventListener('touchmove', mv, { passive: true });
    window.addEventListener('mouseup', en);
    window.addEventListener('touchend', en);
  }

  function animerSwipe(versOui) {
    const card = document.getElementById('sw-card');
    if (!card) return;
    card.style.transition = 'transform 0.3s, opacity 0.3s';
    card.style.transform = `translateX(${versOui ? '120%' : '-120%'}) rotate(${versOui ? 14 : -14}deg)`;
    card.style.opacity = '0';
  }

  function answerSwipe(id, val, dejaAnime) {
    if (!dejaAnime) animerSwipe(val >= 3);
    enregistrerTemps(id);
    answers[id] = val;
    saveProgress();
    refreshNav();
    if (idx < queue.length - 1) {
      clearTimeout(window._autoNext);
      window._autoNext = setTimeout(() => next(), 300);
    }
  }

  // ---- Choix forcé : deux options également désirables, on tranche ----
  function renderChoixForce(cur) {
    const it = cur.item;
    const val = answers[cur.id];
    return `
      <div class="q-tag">${sectionTag(cur)}</div>
      <div class="q-text">Vous vous reconnaissez davantage dans :</div>
      <div class="cfx-duo">
        <button class="cfx-opt ${val === 'a' ? 'sel' : ''}" onclick="App.answerChoixForce('${cur.id}', 'a')">${it.a.texte}</button>
        <div class="cfx-ou">ou</div>
        <button class="cfx-opt ${val === 'b' ? 'sel' : ''}" onclick="App.answerChoixForce('${cur.id}', 'b')">${it.b.texte}</button>
      </div>`;
  }

  function answerChoixForce(id, val) {
    enregistrerTemps(id);
    answers[id] = val;
    saveProgress();
    document.querySelectorAll('#q-card .cfx-opt').forEach((o, i) => {
      o.classList.toggle('sel', (i === 0 ? 'a' : 'b') === val);
    });
    refreshNav();
    if (idx < queue.length - 1) {
      clearTimeout(window._autoNext);
      window._autoNext = setTimeout(() => next(), 320);
    }
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
        <div class="curseur-rail-zone">
          <input type="range" min="0" max="100" value="${val}" class="curseur-input"
            oninput="App.answerCurseur('${cur.id}', this.value)" />
          ${answers['_touche_' + cur.id] ? '' : `<div class="curseur-demo" id="cd-${cur.id}"><span class="cd-bulle">Glissez</span><span class="cd-dot"></span></div>`}
        </div>
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
    enregistrerTemps(id);
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
    answers['_touche_' + id] = 1; // la personne a compris : la démo disparaît
    const demo = document.getElementById('cd-' + id);
    if (demo) demo.remove();
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
    const repMini = {}, repSinea = {}, repCtx = {}, repCtxPlus = {}, repSpeQcm = {}, repSpeDims = {}, repAdapte = {};
    const ctxIds = new Set((SINEA_DATA.contextuelles?.questions || []).map(q => q.id));
    const ctxPlusIds = new Set((SINEA_DATA.contextuelles_plus?.questions || []).map(q => q.id));
    const speDimIds = new Set([
      ...((SINEA_DATA.spe_management?.dimensions?.questions) || []).map(q => q.id),
      ...((SINEA_DATA.spe_commercial?.dimensions?.questions) || []).map(q => q.id),
    ]);
    // index : id -> { kind, chap } pour toutes les questions possibles
    const indexQuestions = {};
    const d = SINEA_DATA;
    d.mini_items.forEach(it => indexQuestions[it.id] = { kind: 'mini', chap: 'socle' });
    (d.mini_choix_force || []).forEach(it => indexQuestions[it.id] = { kind: 'mini', chap: 'socle' });
    (d.adapte?.questions || []).forEach(it => indexQuestions[it.id] = { kind: 'mini', chap: 'socle' });
    Object.values(d.sinea_famille).forEach(l => l.forEach(it => indexQuestions[it.id] = { kind: 'qcm', chap: 'socle' }));
    d.sinea_hybride.forEach(it => indexQuestions[it.id] = { kind: 'curseur', chap: 'socle' });
    (d.sinea_transversales || []).forEach(it => indexQuestions[it.id] = { kind: 'qcm', chap: 'socle' });
    (d.sinea_repartitions || []).forEach(it => indexQuestions[it.id] = { kind: 'repart', chap: 'socle' });
    (d.contextuelles?.questions || []).forEach(it => indexQuestions[it.id] = { kind: 'ctx', chap: 'contexte' });
    (d.contextuelles_plus?.questions || []).forEach(it => indexQuestions[it.id] = { kind: 'ctx', chap: 'contexte' });
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
      else if (ctxPlusIds.has(id)) repCtxPlus[id] = v;
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
        result.speDims = Engine.scorerSpeDims(repSpeDims, diagType, result.scoresBigFive);
        result.speStyle = Engine.scorerSpeStyle(repSpeQcm, diagType);
        result.speStyleScores = Engine.scorerSpeStyleScores(repSpeQcm, diagType);
      } else {
        // MODE SOCLE (ou parcours complet)
        result = Engine.scorer(repMini, repSinea);
        result.contextuel = Engine.scorerContextuel(repCtx);
        result.contextuelPlus = Engine.scorerContextuelPlus(repCtxPlus);
        result.fiabilite = Engine.scorerFiabilite(repMini, answersTime);
        result.diagType = diagType;
        result.reponsesOuvertes = openAnswers;
        result.naturelAdapte = Engine.scorerNaturelAdapte(repMini, repAdapte);
        if (diagType !== 'classic') {
          result.speDims = Engine.scorerSpeDims(repSpeDims, diagType, result.scoresBigFive);
          result.speStyle = Engine.scorerSpeStyle(repSpeQcm, diagType);
          result.speStyleScores = Engine.scorerSpeStyleScores(repSpeQcm, diagType);
        }
      }

      // Enregistrer le résultat dans Airtable (si un token est présent dans l'URL)
      enregistrerResultat(result);

      // Sauvegarder le profil dans l'espace perso (indépendamment de la génération IA,
      // pour que l'analyse soit retrouvable même si l'IA a un souci)
      try {
        const typeAnalyse = (result.diagType && result.diagType !== 'classic') ? result.diagType : 'socle';
        const profilLeger = {
          dominante: result.dominante, secondaires: result.secondaires,
          scoresBigFive: result.scoresBigFive, radarFamilles: result.radarFamilles,
          blend: result.blend, naturelAdapte: result.naturelAdapte, contextuel: result.contextuel,
          contextuelPlus: result.contextuelPlus, fiabilite: result.fiabilite,
          speStyle: result.speStyle, speStyleScores: result.speStyleScores, speDims: result.speDims,
          diagType: result.diagType,
          classement: result.classement,
          modeCampagne: modeCampagne || undefined,
        };
        // on sauvegarde d'abord le profil ; le contenu IA sera complété par result.js quand il arrive
        sauverAnalyse(typeAnalyse, { contenu: null, profil: profilLeger });
        // Le quota se décompte désormais CÔTÉ SERVEUR (progression.js, action
        // save_analyse) : une utilisation par personne, à sa première analyse.
        // Le front ne consomme plus rien (zéro risque de double décompte ou d'oubli).
        magicCode = '';
      } catch (e) {}

      clearInterval(msgTimer);
      document.getElementById('screen-loader').classList.remove('active');
      // Préparer la restitution en arrière-plan, puis lancer la révélation animée
      result.modeCampagne = modeCampagne;
      Result.render(result);
      if (Result.setEmail) Result.setEmail(identite.email || '');
      lancerRevelation(result);
      window.scrollTo(0, 0);
      document.getElementById('phone-scroll')?.scrollTo(0, 0);
    }, 2200);
  }

  // ============================================================
  // LA RÉVÉLATION ANIMÉE DU PORTRAIT
  // ============================================================
  function lancerRevelation(result) {
    const dom = result.dominante;
    if (!dom) { document.getElementById('screen-result').classList.add('active'); return; }
    const slug = (SINEA_DATA.images && SINEA_DATA.images[dom.nom]) ? SINEA_DATA.images[dom.nom] : '';
    const familleLabel = { RELATION: 'Relation', ACTION: 'Action', STRUCTURE: 'Structure', VISION: 'Vision' }[(dom.famille || '').toUpperCase()] || '';

    const scr = document.getElementById('screen-reveal');
    const intro = document.getElementById('reveal-intro');
    const perso = document.getElementById('reveal-perso');
    const imgEl = document.getElementById('reveal-img');
    const nomEl = document.getElementById('reveal-nom');
    const famEl = document.getElementById('reveal-famille');
    const cta = document.getElementById('reveal-cta');
    if (!scr) { document.getElementById('screen-result').classList.add('active'); return; }

    // réinitialiser
    perso.classList.remove('reveal-show'); nomEl.textContent = ''; famEl.classList.remove('reveal-show'); cta.classList.remove('reveal-show'); intro.classList.remove('reveal-fade');
    if (slug) imgEl.src = slug + '.webp';
    scr.classList.add('active');

    // séquence d'animation
    setTimeout(() => { perso.classList.add('reveal-show'); lancerParticules(dom.famille); }, 700);  // le personnage apparaît + particules
    setTimeout(() => { intro.classList.add('reveal-fade'); }, 1400);      // l'intro s'efface
    setTimeout(() => { ecrireNom(nomEl, dom.nom); }, 1600);              // le nom s'écrit lettre par lettre
    setTimeout(() => { famEl.textContent = 'Famille ' + familleLabel; famEl.classList.add('reveal-show'); }, 1600 + dom.nom.length * 75 + 300);
    setTimeout(() => { cta.classList.add('reveal-show'); }, 1600 + dom.nom.length * 75 + 800);

    cta.onclick = () => {
      scr.classList.remove('active');
      arreterParticules();
      document.getElementById('screen-result').classList.add('active');
      window.scrollTo(0, 0);
      document.getElementById('phone-scroll')?.scrollTo(0, 0);
    };
  }

  // Moteur de particules lumineuses pour la révélation
  let particulesRAF = null;
  function lancerParticules(famille) {
    const canvas = document.getElementById('reveal-particles');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    canvas.width = wrap.offsetWidth; canvas.height = wrap.offsetHeight;
    const ctx = canvas.getContext('2d');
    const couleurs = {
      RELATION: ['#F98272', '#F9A876', '#FFFFFF'],
      ACTION: ['#F5A623', '#FAC56E', '#FFE3B3'],
      STRUCTURE: ['#3EADFF', '#7CC8FF', '#FFFFFF'],
      VISION: ['#5E59C7', '#8E89E8', '#FFFFFF'],
    }[(famille || '').toUpperCase()] || ['#5E59C7', '#FFFFFF', '#F5A623'];

    const cx = canvas.width / 2, cy = canvas.height * 0.36;
    const particules = [];
    // jaillissement initial depuis le centre (le personnage)
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vitesse = 1.5 + Math.random() * 4;
      particules.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * vitesse, vy: Math.sin(angle) * vitesse - 1,
        r: 1.5 + Math.random() * 3,
        couleur: couleurs[Math.floor(Math.random() * couleurs.length)],
        vie: 1, declin: 0.006 + Math.random() * 0.01,
      });
    }
    // quelques particules flottantes ambiantes
    for (let i = 0; i < 25; i++) {
      particules.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4, vy: -0.2 - Math.random() * 0.4,
        r: 0.8 + Math.random() * 1.8,
        couleur: couleurs[Math.floor(Math.random() * couleurs.length)],
        vie: 1, declin: 0.002 + Math.random() * 0.004, ambiant: true,
      });
    }

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particules.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (!p.ambiant) p.vy += 0.02; // légère gravité pour le jaillissement
        p.vie -= p.declin;
        if (p.vie > 0) {
          ctx.globalAlpha = Math.max(0, Math.min(1, p.vie));
          ctx.fillStyle = p.couleur;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          // halo doux
          ctx.globalAlpha = Math.max(0, p.vie * 0.3);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2); ctx.fill();
        }
        // recycler les particules ambiantes
        if (p.ambiant && (p.vie <= 0 || p.y < -10)) {
          p.x = Math.random() * canvas.width; p.y = canvas.height + 10; p.vie = 1;
        }
      });
      ctx.globalAlpha = 1;
      particulesRAF = requestAnimationFrame(frame);
    }
    frame();
  }

  function arreterParticules() {
    if (particulesRAF) { cancelAnimationFrame(particulesRAF); particulesRAF = null; }
    const canvas = document.getElementById('reveal-particles');
    if (canvas) { const ctx = canvas.getContext('2d'); ctx && ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function ecrireNom(el, nom) {
    el.textContent = '';
    el.classList.add('reveal-typing');
    let i = 0;
    const timer = setInterval(() => {
      if (i >= nom.length) { clearInterval(timer); el.classList.remove('reveal-typing'); return; }
      el.textContent += nom[i]; i++;
    }, 75);
  }

  return { start, telechargerPortraitEspace, showChapterIntro, goToIdentif, goToConnexion, goToCover, goToEspace, sauverAnalyse, envoyerInteractions, autoFill, next, prev, answer, answerSwipe, answerChoixForce, answerCurseur, repartChange, initCover, saveOpen, getResult: () => result, getPrenom: () => identite.prenom || '' };
})();

// Personnaliser l'accueil dès le chargement (questions, étapes, type)
// Exposer App globalement (pour que result.js puisse appeler App.sauverAnalyse, App.getPrenom, etc.)
window.App = App;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.initCover());
} else {
  App.initCover();
}
