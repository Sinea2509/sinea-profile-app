// Marqueur de version et garde d'erreurs globale (source unique)
console.log("Sinea Profile v143 servie");
window.addEventListener('error', function (e) { console.error('[Sinéa v143]', e.message, (e.filename || '') + ':' + (e.lineno || '')); });

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
  let dataEspaceCourant = null;
  let compsEspaceCourant = null;
  let carteEspaceCourant = null;
  let filtreMiroirRel = null;
  let checklistCtx = null;
  let monArchetype = ''; // archétype de la personne, pour la situer dans le codex
  // ===== Personnages : variante masculine / féminine (option B) =====
  // S'active des que les visuels <slug>_h.webp et <slug>_f.webp sont en ligne.
  var VARIANTES_PERSO_ACTIVES = false; // passer à true une fois les visuels masculins/féminins déployés
  function variantePerso(){ try { return localStorage.getItem('sinea_perso_variant') || ''; } catch(e){ return ''; } }
  function setVariantePerso(v){ try { localStorage.setItem('sinea_perso_variant', v || ''); } catch(e){} }
  function srcPerso(slug){ if(!slug) return ''; var v=variantePerso(); return (VARIANTES_PERSO_ACTIVES && (v==='h'||v==='f')) ? (slug+'_'+v+'.webp') : (slug+'.webp'); }
  function onerrPerso(slug){ return "this.onerror=null;this.src='"+slug+".webp'"; }
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
    }).then(function (r) {
      if (r && r.ok) { interEnAttente = null; masquerSyncBandeau(); }
      else { retenirEchecSync(interactions); }
    }).catch(function () { retenirEchecSync(interactions); });
  }

  let interEnAttente = null;
  function bandeauHorsLigne(txt) {
    let b = document.getElementById('sync-bandeau');
    if (!b) {
      b = document.createElement('div');
      b.id = 'sync-bandeau';
      document.body.appendChild(b);
    }
    b.textContent = txt;
    b.style.display = 'block';
  }
  function retenirEchecSync(interactions) {
    interEnAttente = interactions;
    bandeauHorsLigne('Hors connexion. Vos derniers choix seront renvoy\u00e9s automatiquement.');
  }
  function masquerSyncBandeau() {
    const b = document.getElementById('sync-bandeau');
    if (b) b.style.display = 'none';
  }
  window.addEventListener('online', function () {
    if (interEnAttente) envoyerInteractions(interEnAttente);
  });

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
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { console.warn("[Sinéa]", e); }
  }

  // ---- Lecture du type de diagnostic depuis l'URL (?type=manager) ----
  function readDiagType() {
    try {
      const p = new URLSearchParams(window.location.search);
      const t = (p.get('type') || '').toLowerCase();
      if (t === 'manager' || t === 'commercial') return t;
    } catch (e) { console.warn("[Sinéa]", e); }
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
    const corps = JSON.stringify({ token, profil, resultatComplet: complet, campagne: nomCampagne });
    // L'enregistrement se bat : relances espacées puis retour du réseau,
    // avec un bandeau honnête pendant l'attente. Douze minutes de réponses
    // méritent mieux qu'un échec silencieux.
    let tentative = 0;
    const replanifier = function () {
      bandeauHorsLigne('Connexion instable. Votre r\u00e9sultat sera renvoy\u00e9 automatiquement, gardez cet onglet ouvert un instant.');
      if (tentative < 4) setTimeout(envoyer, [0, 2000, 6000, 15000][tentative] || 15000);
    };
    const envoyer = function () {
      tentative++;
      fetch(ENREGISTRER_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: corps })
        .then(function (r) { if (r && r.ok) { masquerSyncBandeau(); } else { replanifier(); } })
        .catch(replanifier);
    };
    window.addEventListener('online', function () { if (tentative >= 1) envoyer(); });
    envoyer();
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
      { id: 'socle2', titre: 'Votre style au travail', sous: 'Les nuances qui vous rendent unique.' },
      { id: 'contexte', titre: 'Votre rapport au monde', sous: 'Stress, motivation, changement : ce qui vous anime.' },
    ];
    if (diagType === 'manager') ch.push({ id: 'spe', titre: 'Votre management', sous: 'Votre posture de manager au quotidien.' });
    else if (diagType === 'commercial') ch.push({ id: 'spe', titre: 'Votre approche commerciale', sous: 'Votre façon de vendre et de convaincre.' });
    return ch;
  }

  // ---- Construction de la file de questions (avec chapitres) ----
  // Entrelace une liste d'items pour que deux items de la même dimension ne se suivent pas.
  // Méthode : on regroupe par dimension, puis on pioche à tour de rôle dans chaque groupe.
  function entrelacerParDimension(items) {
    const groupes = {};
    items.forEach(it => { (groupes[it.dimension] = groupes[it.dimension] || []).push(it); });
    const listes = Object.values(groupes);
    const out = [];
    let reste = true;
    while (reste) {
      reste = false;
      for (const liste of listes) {
        if (liste.length) { out.push(liste.shift()); reste = true; }
      }
    }
    return out;
  }

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

    // ===== CHAPITRE 1 : SOCLE , qui vous êtes, spontanément (Big Five) =====
    // On entremêle les items du mini-test pour que deux questions de la même dimension
    // ne se suivent pas, ce qui varie le parcours et réduit les biais de réponse en série.
    const miniEntrelace = entrelacerParDimension(d.mini_items);
    miniEntrelace.forEach(it => q.push({ kind: 'swipe', id: it.id, item: it, chap: 'socle' }));
    // Choix forcé Big Five (anti-désirabilité, alimente aussi le score de fiabilité)
    (d.mini_choix_force || []).forEach(it => q.push({ kind: 'choixforce', id: it.id, item: it, chap: 'socle' }));
    const finBloc1 = q.length; // on coupe ici pour faire souffler (mi-parcours du socle)

    // ===== CHAPITRE 1bis : SOCLE 2 , votre style au travail =====
    // Comportement adapté au travail, puis archétypes Sinéa
    (d.adapte?.questions || []).forEach(it => q.push({ kind: 'swipe', id: it.id, item: it, chap: 'socle2' }));
    Object.values(d.sinea_famille).forEach(list => {
      list.forEach(it => q.push({ kind: 'qcm', id: it.id, item: it, chap: 'socle2' }));
    });
    d.sinea_hybride.forEach(it => q.push({ kind: 'curseur', id: it.id, item: it, chap: 'socle2' }));
    (d.sinea_transversales || []).forEach(it => q.push({ kind: kindFromFormat(it, 'qcm'), id: it.id, item: it, chap: 'socle2' }));
    // Répartitions espacées dans ce second bloc
    const repart = (d.sinea_repartitions || []).map(it => ({ kind: 'repart', id: it.id, item: it, chap: 'socle2' }));
    const s2len = q.length - finBloc1;
    const step2 = Math.max(1, Math.floor(s2len / (repart.length + 1)));
    repart.forEach((r, i) => {
      const pos = finBloc1 + step2 * (i + 1) + i;
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
  function total() { return queue.length; }

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

  // La sortie de session, en face de la persistance de sept jours.
  // Elle efface la mémoire du navigateur, vide l'identité et ramène à l'accueil.
  function seDeconnecter() {
    try { localStorage.removeItem('sinea_chap_classic'); } catch (e) {}
    try { localStorage.removeItem('sinea_identite'); } catch (e) {}
    identite.email = '';
    identite.prenom = '';
    identite.nom = '';
    try { dataEspaceCourant = null; carteEspaceCourant = null; } catch (e) {}
    try {
      if (location.search) history.replaceState(null, '', location.pathname);
    } catch (e) {}
    goToCover();
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
          err.innerHTML = "Aucun compte associé à cet email. <a href='#' id='cx-vers-test' style='color:var(--c-purple-text);font-weight:600;'>Commencer l'analyse</a>";
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
      + '<h2 class="cand-info-titre">Cette analyse éclaire, elle ne décide pas</h2>'
      + '<p>Ce questionnaire évalue vos <b>soft skills</b> et votre façon naturelle de fonctionner au travail. Il porte sur le comportement, jamais sur vos compétences techniques.</p>'
      + '<p>Vos résultats servent à <b>préparer un échange de qualité</b> avec l\'entreprise. Ils restent confidentiels et la décision de recrutement appartient toujours à des humains.</p>'
      + '<p>Vous recevrez votre <b>portrait de personnalité</b>, qui reste le vôtre, quelle que soit la suite du processus.</p>'
      + '<p class="cand-info-note">Répondez spontanément : il n\'existe aucune bonne ou mauvaise réponse, et l\'analyse détecte mieux la sincérité que la perfection.</p>'
      + '<button class="cand-info-go" id="cand-info-go">J\'ai compris, commencer</button>'
      + '</div>';
    document.body.appendChild(ov);
    document.getElementById('cand-info-go').onclick = () => { ov.remove(); if (typeof suite === 'function') suite(); };
  }

  function submitMagicCode() {
    const input = document.getElementById('magic-input');
    const submit = document.getElementById('magic-submit');
    const err = document.getElementById('magic-error');
    const code = (input.value || '').trim();
    if (!code) { err.textContent = 'Merci d\'entrer votre code d\'accès.'; return; }
    err.innerHTML = '<span class="nea-dot"></span>Nous réveillons votre coach et préparons votre espace...';
    err.classList.add('nea-wake');
    if (submit) submit.disabled = true;
    const tWake = Date.now();
    fetch(VERIFIER_CODE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verifier', code, email: identite.email }),
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.ok) {
          magicCode = code;
          nomCampagne = data.campagne || '';
          droits = data.type || 'classic';
          modeCampagne = (data.mode || '').toLowerCase();
          thematiqueCampagne = data.thematique || '';
          try { window.SINEA_THEME = thematiqueCampagne; } catch(e){} // expose la thématique à la séquence de révélation
          // storytelling : le message de réveil vit au moins 3 s avant le lancement
          const reste = Math.max(0, 3000 - (Date.now() - tWake));
          setTimeout(() => {
            if (submit) submit.disabled = false;
            err.classList.remove('nea-wake');
            err.textContent = '';
            document.getElementById('screen-magic').classList.remove('active');
            if (data.ajout_module && data.deja_socle) {
              // la personne a déjà le socle : on lance directement le module (pas de re-socle)
              estAjoutModule = true;
              diagType = data.type;
              commencerModule(data.type);
            } else {
              estAjoutModule = false;
              droits = data.type || 'classic';
              if (identite.email) {
                fetch(PROGRESSION_URL, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'load_analyse', email: identite.email }),
                })
                  .then(r => r.json())
                  .then(a => {
                    const analyses = (a && a.analyses) || {};
                    if (analyses.socle) { goToEspace(); return; } // socle déjà fait : direction l'espace
                    if (modeCampagne === 'recrutement') afficherInfoCandidat(start);
                    else start();
                  })
                  .catch(() => { if (modeCampagne === 'recrutement') afficherInfoCandidat(start); else start(); });
              } else {
                if (modeCampagne === 'recrutement') afficherInfoCandidat(start);
                else start();
              }
            }
          }, reste);
        } else {
          if (submit) submit.disabled = false;
          err.classList.remove('nea-wake');
          const raison = data ? data.raison : '';
          if (raison === 'deja_fait') {
            err.innerHTML = 'Vous avez déjà passé cette analyse. <a href="#" id="magic-vers-connexion" style="color:var(--c-purple-text);font-weight:600;">Accéder à mon espace</a>';
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
        err.classList.remove('nea-wake');
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
    err.innerHTML = '<span class="nea-dot"></span>Nous réveillons votre coach et préparons votre espace...';
    err.classList.add('nea-wake');
    fetch(AUTH_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_code", email: identite.email, code }),
    })
      .then(r => r.json())
      .then(data => {
        err.classList.remove('nea-wake');
        if (data && data.ok) {
          identite.prenom = data.prenom || identite.prenom;
          err.textContent = '';
          document.getElementById('screen-code').classList.remove('active');
          goToEspace();
        } else {
          err.textContent = (data && data.error) || 'Code incorrect.';
        }
      })
      .catch(() => { err.classList.remove('nea-wake'); err.textContent = 'Connexion impossible. Réessayez.'; });
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
    const _sb = document.getElementById('r-selbar');
    if (_sb) _sb.classList.remove('on');
    const scr = document.getElementById('screen-espace');
    scr.classList.add('active');
    // charger les données depuis le serveur
    // porte d'audit : les bancs Chrome injectent une identité de test ici
    if (!identite.email && window.__auditEmail) identite.email = window.__auditEmail;
    if (!identite.email) return;
    try { localStorage.setItem('sinea_identite', JSON.stringify({ email: identite.email, prenom: identite.prenom || '', ts: Date.now() })); } catch (e) {}
    fetch(PROGRESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load_analyse', email: identite.email }),
    })
      .then(r => r.json())
      .then(data => { renderEspace(data || {}); chargerSuiteEspace(data || {}); })
      .catch(() => { renderEspace({}); bandeauHorsLigne('Connexion au serveur impossible. Rechargez la page dans un instant.'); });
  }

  // La suite de l'espace : un seul chargement des interactions, qui nourrit
  // le retour commenté de Néa et la re-mesure express.
  function chargerSuiteEspace(data) {
    if (!identite.email) return;
    fetch(PROGRESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load_interactions', email: identite.email }),
    })
      .then(r => r.json())
      .then(d => {
        try { if (d && d.suivi_plan) data.suivi_plan = d.suivi_plan; } catch (e) {}
        const carte = (d && d.interactions) || {};
        poserRetourNea(carte);
        poserRemesure(data, carte);
        poserMiroir(data, carte);
        try { checklistCtx = { data: dataEspaceCourant, carte: carte }; poserChecklist(dataEspaceCourant, carte); } catch (e) { console.warn('[Sinéa]', e); }
        try { poserCockpit(dataEspaceCourant, carte); } catch (e) { console.warn("[Sinéa]", e); }
        try { poserBandeauJour(dataEspaceCourant, carte); } catch (e) { console.warn("[Sinéa]", e); }
        try { poserCompetencesEspace(dataEspaceCourant, carte); } catch (e) { console.warn("[Sinéa]", e); }
        try { poserBanniere(dataEspaceCourant); } catch (e) { console.warn("[Sinéa]", e); }
        try { poserSparring(dataEspaceCourant); } catch (e) { console.warn("[Sinéa]", e); }
        try { const bt = document.querySelector('.esp-nav .esp-nav-b.on'); espTab(bt ? bt.getAttribute('data-t') : 'accueil'); } catch (e) {}
        try { if (window.Visuels && Visuels.brancherCurseur) Visuels.brancherCurseur(document.getElementById('esp-q16-t'), document.getElementById('esp-cp-matrice')); if (window.Visuels && Visuels.brancherTooltip) Visuels.brancherTooltip(document.getElementById('esp-cp-matrice')); } catch (e) {}
        poserSeedupEspace(carte);
      })
      .catch(() => {});
  }

  // Le retour commenté : Néa lit les interactions enregistrées, tous parcours
  // confondus (socle, manager, commercial), et accueille la personne avec un
  // mot sur sa progression réelle.
  function relanceNea() {
    try {
      const p = comptePlan((typeof dataEspaceCourant !== 'undefined' && dataEspaceCourant) || null);
      if (!p.total) return '';
      if (p.prochaine) return '<div class="nea-relance"><div class="nea-r-k">Néa vous relance</div><p>Vous avez engagé <b>« ' + p.prochaine + ' »</b>. Où en êtes-vous cette semaine ?</p><button type="button" class="nea-r-btn" onclick="App.ouvrirPlanDepuisResto(\'' + p.mod + '\')">Ouvrir mon plan</button></div>';
      return '<div class="nea-relance"><div class="nea-r-k">Néa vous félicite</div><p>Toutes vos pistes engagées sont menées au bout. Le moment est bon pour en choisir une nouvelle.</p><button type="button" class="nea-r-btn" onclick="App.ouvrirPlanDepuisResto(\'' + p.mod + '\')">Ouvrir mon plan</button></div>';
    } catch (e) { return ''; }
  }

  function poserRetourNea(carte) {
    const slot = document.getElementById('espace-nea');
    if (!slot) return;
    // Repli par défaut : aucune mention de Néa en seize retours de pilote.
    // Le module reste accessible en un geste, sous les défis, à instrumenter.
    let nbActions = 0, nbForces = 0;
    Object.values(carte).forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      nbActions += (it.pistes_choisies || []).length;
      nbForces += (it.forces_libelles || []).length;
    });
    const morceaux = [];
    // Les défis de terrain SeedUp d'abord : le mouvement le plus concret
    const sd = carte.seedup && Array.isArray(carte.seedup.liste) ? carte.seedup.liste : [];
    if (sd.length) {
      const reussites = sd.map(function (x) { return x.r; }).filter(function (v) { return typeof v === 'number'; });
      const moyR = reussites.length ? Math.round(reussites.reduce(function (a, b) { return a + b; }, 0) / reussites.length * 10) / 10 : null;
      morceaux.push('vous avez ancré ' + sd.length + ' défi' + (sd.length > 1 ? 's' : '') + ' sur le terrain' + (moyR !== null ? ' avec une réussite de ' + moyR + ' sur 10' : ''));
    }
    if (nbActions) morceaux.push('vous avez ' + nbActions + ' action' + (nbActions > 1 ? 's' : '') + ' en cours dans votre plan');
    if (nbForces) morceaux.push(nbForces + ' force' + (nbForces > 1 ? 's validées' : ' validée'));
    let phrase;
    if (morceaux.length) {
      phrase = 'Me revoici. Depuis votre portrait, ' + morceaux.join(' et ') + '. ' +
        (nbActions ? 'Continuez sur cette lancée, chaque action ancrée compte.' : 'Choisissez une première action dans votre plan, elle lance le mouvement.');
    } else {
      phrase = 'Me revoici. Votre portrait vous attend, et votre plan d\'action est le meilleur endroit pour transformer la lecture en mouvement.';
    }
    slot.innerHTML = relanceNea() +  '<div class="esp-nea">' +
      '<span class="esp-nea-img"><img src="Nea_detoure_full.png.webp" alt="Néa" onerror="this.style.display=\'none\'"/></span>' +
      '<div class="esp-nea-txt"><div class="esp-nea-label">Néa · votre coach</div><p>' + phrase + '</p></div>' +
      '</div>';
  }

  // ---- Vos compétences : la lecture Sinéa dans l'espace apprenant ----
  // Déterministe, calculé en local depuis le profil déjà chargé : la personne
  // voit ses appuis et ses opportunités, et ses défis SeedUp prennent sens.
  // L'espace en deux onglets : le développement d'un côté, le miroir à part
  function majValiderMiroir(){
    const btn = document.getElementById('mir-valider');
    if (!btn) return;
    const nb = MIROIR_QUESTIONS.filter(function (q2) { return q2.type !== 'texte'; }).length;
    const k = Object.keys(_mirRep).length;
    const rel = !!document.querySelector('.mir-page .mir-rel.on');
    const pret = k >= nb && rel;
    btn.disabled = !pret;
    btn.textContent = pret ? 'Envoyer mon regard' : (k < nb ? 'Envoyer mon regard · ' + k + '/' + nb : 'Choisissez votre relation ci-dessus');
  }
  function choisirRelMiroir(btn){
    btn.parentNode.querySelectorAll('.mir-rel').forEach(function (b) { b.classList.remove('on'); });
    btn.classList.add('on');
    majValiderMiroir();
  }
  function ouvrirCompDepuisCarte(id){
    try {
      const sv = document.querySelector('#esp-cp-matrice svg');
      if (sv) {
        sv.querySelectorAll('.q16-sel').forEach(function (g2) { g2.classList.remove('q16-sel'); });
        const g3 = sv.querySelector('g[data-comp="' + id + '"]');
        if (g3) g3.classList.add('q16-sel');
      }
    } catch (e) {}
    const zone = document.getElementById('esp-cp-focus');
    if (!zone || !window.Competences || !compsEspaceCourant) return;
    const c2 = compsEspaceCourant.find(function (x) { return x.id === id; });
    const ref = window.Competences.REFERENTIEL.find(function (r2) { return r2.id === id; });
    if (!c2 || !ref) return;
    const coul = (window.Competences.COULEURS_FAMILLES || {})[c2.famille] || '#8A879B';
    zone.innerHTML = '<div class="esp-cp-fcard"><button type="button" class="esp-cp-fx" onclick="document.getElementById(&quot;esp-cp-focus&quot;).innerHTML=&quot;&quot;">×</button>'
      + '<div class="esp-cp-fnom"><i style="background:' + coul + '"></i>' + echapValeur(c2.nom) + '<span>nature ' + Math.round(c2.potentiel) + ' · travail ' + Math.round(c2.expression) + '</span></div>'
      + (ref.def ? '<p class="esp-cp-def">' + echapValeur(ref.def) + '</p>' : '')
      + (function () {
          const d = Math.round(c2.expression) - Math.round(c2.potentiel);
          const lect = d >= 8 ? 'Votre quotidien exprime cette compétence au-delà de votre pente naturelle, ' + Math.round(c2.expression) + ' contre ' + Math.round(c2.potentiel) + '. Les gestes sont construits, il reste à les rendre confortables.'
            : d <= -8 ? 'Votre nature porte cette compétence plus haut que votre quotidien ne l\'exprime, ' + Math.round(c2.potentiel) + ' contre ' + Math.round(c2.expression) + '. Le moteur est là, la pratique fera le reste.'
            : 'Nature et quotidien s\'accordent sur cette compétence, autour de ' + Math.round((c2.potentiel + c2.expression) / 2) + '. Un terrain stable pour construire.';
          return '<p class="esp-cp-lecture">' + lect + '</p>';
        })()
      + ((window.Competences.CODEX && window.Competences.CODEX[id]) ? (function () {
          const cx = window.Competences.CODEX[id];
          const pal = window.Competences.palierDe(c2.expression);
          const p2 = cx.paliers[pal - 1];
          return p2 && p2[1] ? '<div class="esp-cp-pas"><u>VOTRE PROCHAIN PAS</u><p>' + echapValeur(p2[1]) + '</p></div>' : '';
        })() : '')
      + ((ref.progresser || []).length ? '<div class="esp-cp-prog-t">Pour progresser</div><ul class="esp-cp-prog">' + ref.progresser.map(function (p2) { return '<li>' + echapValeur(p2) + '</li>'; }).join('') + '</ul>' : '')
      + '<details class="esp-cp-plus"><summary>Aller plus loin · la trajectoire et les deux facettes</summary>'
      + ((window.Competences.CODEX && window.Competences.CODEX[id]) ? (function () {
          const cx = window.Competences.CODEX[id];
          const pal = window.Competences.palierDe(c2.expression);
          return '<div class="esp-cp-prog-t">Votre trajectoire</div>' + cx.paliers.map(function (p2, i) {
            const num = i + 1;
            const etat = num < pal ? ' fait' : (num === pal ? ' on' : '');
            return '<div class="fcx-pal' + etat + '"><b>' + num + '. ' + window.Competences.PALIERS_NOMS[i] + (num === pal ? ' · vous êtes ici' : '') + '</b>' + (num === pal ? '<em>Votre prochain pas : ' + echapValeur(p2[1]) + '</em>' : '') + '</div>';
          }).join('');
        })() : '')
      + ((window.Competences.FACETTES && window.Competences.FACETTES[id]) ? '<div class="esp-cp-prog-t">Les deux facettes</div>' + window.Competences.FACETTES[id].map(function (f) { return '<div class="fcx-fac"><b>' + echapValeur(f.nom) + '</b><span>' + echapValeur(f.def) + '</span><em>Défi : ' + echapValeur(f.defis[0]) + '</em></div>'; }).join('') : '')
      + '</details>'
      + '</div>';
    zone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function espTab(t){
    const groupes = {
      accueil: ['espace-banniere', 'espace-resultats', 'espace-prog-globale', 'espace-cards', 'espace-competences', 'espace-remesure', 'espace-compat'],
      dev: ['espace-accueil-resume', 'espace-cockpit', 'espace-checklist', 'espace-seedup', 'espace-sparring', 'espace-nea'],
      miroir: ['espace-miroir'],
    };
    const cache = function (id, visible) { const e = document.getElementById(id); if (e) e.classList.toggle('esp-hide', !visible); };
    Object.keys(groupes).forEach(function (g) { groupes[g].forEach(function (id) { cache(id, t === g); }); });
    document.querySelectorAll('.esp-nav-b').forEach(function (b) {
      const on = b.getAttribute('data-t') === t;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // v137 : le changement d'onglet remonte au haut du panneau et y pose le focus.
    // La garde évite le défilement parasite quand la personne est déjà en haut de page.
    const nav = document.querySelector('.esp-nav');
    if (nav && nav.getBoundingClientRect().top <= 12) {
      const doux = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      window.scrollTo({ top: nav.offsetTop - 10, behavior: doux });
    }
    const premier = (groupes[t] || []).map(function (id) { return document.getElementById(id); }).find(Boolean);
    if (premier) { premier.setAttribute('tabindex', '-1'); premier.focus({ preventScroll: true }); }
  }

  // ===== Le cockpit : l'action du jour et les engagements =====
  // ---- La bannière : famille, archétype, verbe, la carte d'identité d'équipe ----
  // La famille est le langage commun, l'archétype la profondeur. La bannière
  // se copie en une ligne pour une signature, un profil, un canal d'équipe.
  const COULEURS_FAM = { RELATION: '#F98272', ACTION: '#E8951A', STRUCTURE: '#3EADFF', VISION: '#5E59C7' };
  function poserBanniere(data) {
    const slot = document.getElementById('espace-banniere');
    if (!slot || !data) return;
    let dom = null;
    for (const m of ['socle', 'commercial', 'manager']) {
      const a2 = data.analyses && data.analyses[m];
      if (a2 && a2.profil && a2.profil.dominante) { dom = a2.profil.dominante; break; }
    }
    if (!dom || !dom.nom) { slot.innerHTML = ''; return; }
    const fam = dom.famille || SINEA_DATA.famille(dom.nom) || 'RELATION';
    const perso = SINEA_DATA.perso(dom.nom) || {};
    const gFam = (SINEA_DATA.familles_cle || {})[fam] || {};
    const verbe = perso.verbe_signature || perso.role || '';
    const c = COULEURS_FAM[fam] || '#5E59C7';
    const libFam = fam.charAt(0) + fam.slice(1).toLowerCase();
    slot.innerHTML = '<div class="esp-ban" style="border-color:' + c + '">'
      + (gFam.symbole ? '<span class="esp-ban-emb" style="color:' + c + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + gFam.symbole + '</svg></span>' : '')
      + '<span class="esp-ban-txt"><b>' + dom.nom + '</b><i>Famille ' + libFam + (verbe ? ' · ' + verbe : '') + '</i></span>'
      + '<button type="button" class="esp-ban-copie" onclick="App.copierBanniere(this)" data-t="'
      + echapValeur(dom.nom + ' · Famille ' + libFam + (verbe ? ' · ' + verbe : '') + ' · Sinéa Profile') + '" aria-live="polite">Copier ma carte</button>'
      + '</div>';
  }
  function copierBanniere(btn) {
    const t = btn.getAttribute('data-t') || '';
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
      function () { btn.textContent = 'Copiée'; setTimeout(function () { btn.textContent = 'Copier'; }, 1800); },
      function () { window.prompt('Votre bannière', t); }
    );
  }
  // ---- Le Sparring : s'entraîner contre un archétype avant la vraie conversation ----
  // On s'entraîne contre un personnage type du référentiel, jamais contre une
  // personne nommée. Trois minutes d'échange, puis le débrief en trois points.
  let sparEtat = null;
  let sparFam = '';  // v140 : aucun tempérament présélectionné, la personne choisit.
  const SPAR_SITUATIONS = ['Annoncer un retard', 'Demander des moyens', 'Recadrer sans casser'];
  function poserSparring(data) {
    const slot = document.getElementById('espace-sparring');
    if (!slot) return;
    const CLE = SINEA_DATA.familles_cle || {};
    const fams = ['RELATION', 'ACTION', 'STRUCTURE', 'VISION'].map(function (k) {
      const g = CLE[k] || {};
      return '<button type="button" class="spar-fam-b' + (k === sparFam ? ' on' : '') + '" data-fam="' + k + '" style="background:' + COULEURS_FAM[k] + '" onclick="App.sparChoisirFam(this)">'
        + '<span class="spar-ic"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + (g.symbole || '') + '</svg></span>'
        + '<span class="spar-fam-txt"><b>' + (g.verbe || k) + '</b><i>' + (g.repere || '') + '</i></span></button>';
    }).join('');
    const sits = SPAR_SITUATIONS.map(function (t, i) {
      return '<button type="button" class="spar-sit-b" onclick="App.sparSituation(this)">' + t + '</button>';
    }).join('');
    slot.innerHTML = '<div class="esp-rem spar">'
      + '<div class="esp-rem-kicker">Sparring · Entraînez la conversation</div>'
      + '<div class="esp-rem-titre" role="heading" aria-level="2">Choisissez le tempérament de votre interlocuteur</div>'
      + '<div class="spar-fam">' + fams + '</div>'
      + '<p class="spar-p">Vous vous entraînez contre le tempérament d\'une famille, jamais contre une personne nommée.</p>'
      + '<div class="spar-sit">' + sits + '</div>'
      + '<div class="spar-form">'
      + '<label class="spar-lab" for="spar-sujet">Votre situation, en une phrase</label>'
      + '<input id="spar-sujet" type="text" maxlength="200" placeholder="Annoncer un retard, demander des moyens…">'
      + '<button type="button" class="esp-rem-btn" id="spar-go" onclick="App.sparDemarrer()"' + (sparFam ? '' : ' disabled') + '>Démarrer l\'entraînement</button></div>'
      + '<div id="spar-fil"></div>'
      + '<div id="spar-saisie" style="display:none"><textarea id="spar-msg" rows="2" maxlength="600" placeholder="Votre réplique"></textarea>'
      + '<div class="spar-boutons"><button type="button" class="esp-rem-btn" onclick="App.sparEnvoyer()">Envoyer</button>'
      + '<button type="button" class="spar-debrief" onclick="App.sparDebrief()">Terminer et débriefer</button></div></div>'
      + '<div id="spar-verdict"></div>'
      + '</div>';
  }
  function sparChoisirFam(btn) {
    sparFam = btn.getAttribute('data-fam') || '';
    const go = document.getElementById('spar-go');
    if (go) go.disabled = !sparFam;
    document.querySelectorAll('.spar-fam-b').forEach(function (b2) { b2.classList.toggle('on', b2 === btn); });
  }
  function sparSituation(btn) {
    document.querySelectorAll('.spar-sit-b').forEach(function (b2) { b2.classList.toggle('on', b2 === btn); });
    const z = document.getElementById('spar-sujet');
    if (z) z.value = btn.textContent;
  }
  function sparDemarrer() {
    const cible = sparFam;
    const sujet = (document.getElementById('spar-sujet').value || '').trim() || 'une conversation de travail difficile';
    sparEtat = { cible: cible, sujet: sujet, historique: [] };
    document.getElementById('spar-fil').innerHTML = '';
    document.getElementById('spar-verdict').innerHTML = '';
    document.getElementById('spar-saisie').style.display = 'block';
    document.getElementById('spar-msg').focus();
  }
  function sparAfficher() {
    const fil = document.getElementById('spar-fil');
    fil.innerHTML = sparEtat.historique.map(function (m) {
      return '<div class="spar-m ' + (m.role === 'moi' ? 'moi' : 'lui') + '">' + echapValeur(m.texte) + '</div>';
    }).join('');
    fil.scrollTop = fil.scrollHeight;
  }
  async function sparAppeler(mode) {
    const r = await fetch(API_BASE + '/sparring', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identite.email || '', cible: sparEtat.cible, sujet: sparEtat.sujet, historique: sparEtat.historique, mode: mode }),
    });
    return r.json();
  }
  async function sparEnvoyer() {
    if (!sparEtat) return;
    const zone = document.getElementById('spar-msg');
    const t = (zone.value || '').trim();
    if (!t) return;
    zone.value = '';
    sparEtat.historique.push({ role: 'moi', texte: t });
    sparAfficher();
    try {
      const d = await sparAppeler('echange');
      if (d && d.reponse) { sparEtat.historique.push({ role: 'lui', texte: d.reponse }); sparAfficher(); }
    } catch (e) { console.warn('[Sinéa]', e); }
  }
  async function sparDebrief() {
    if (!sparEtat || sparEtat.historique.length < 2) return;
    const v = document.getElementById('spar-verdict');
    v.innerHTML = '<p class="spar-p">Analyse de votre entraînement en cours.</p>';
    try {
      const d = await sparAppeler('debrief');
      const db = (d && d.debrief) || {};
      v.innerHTML = '<div class="spar-verdict">'
        + (db.apaise ? '<p><b>Ce qui a apaisé.</b> ' + echapValeur(db.apaise) + '</p>' : '')
        + (db.declenche ? '<p><b>Ce qui a tendu.</b> ' + echapValeur(db.declenche) + '</p>' : '')
        + (db.phrase ? '<p><b>La phrase à garder.</b> « ' + echapValeur(db.phrase) + ' »</p>' : '')
        + '</div>';
      document.getElementById('spar-saisie').style.display = 'none';
    } catch (e) { v.innerHTML = '<p class="spar-p">Le débrief est indisponible, réessayez.</p>'; }
  }
  // v138 : le calcul de l'action du jour, partagé entre le cockpit et le bandeau du plan.
  // Retourne null quand aucune action ne se distingue, chaque appelant garde son repli.
  function calculerActionDuJour(data, carte){
    const socle = (data && data.analyses && data.analyses.socle) || {};
    const dateSocle = (socle.date || (socle.profil && socle.profil.date)) ? new Date(socle.date || socle.profil.date).getTime() : null;
    const jour = dateSocle ? Math.max(0, Math.round((Date.now() - dateSocle) / 86400000)) : null;
    const sd = (carte && carte.seedup && Array.isArray(carte.seedup.liste)) ? carte.seedup.liste : [];
    const remFaite = !!(carte && carte.remesure && Array.isArray(carte.remesure.liste) && carte.remesure.liste.length);
    const mir = (carte && carte.miroir) || {};
    const nbRegards = Array.isArray(mir.reponses) ? mir.reponses.length : 0;
    const aJeton = !!mir.jeton;
    const pistes = [];
    Object.values(carte || {}).forEach(function (it) {
      if (it && Array.isArray(it.pistes_libelles)) it.pistes_libelles.forEach(function (l) { if (l && pistes.indexOf(l) < 0) pistes.push(l); });
    });
    const joursAncres = Array.from(new Set(sd.map(function (x) { return String(x.d || '').slice(0, 10); }).filter(Boolean))).sort().reverse();
    let act = null;
    if (jour !== null && jour >= 83 && !remFaite) {
      act = { t: 'Votre re-mesure des 90 jours est ouverte', p: 'Dix minutes pour mesurer le chemin parcouru depuis votre portrait.', cta: 'Faire ma re-mesure', fn: "App.cockpitVers('espace-remesure')" };
    } else if (aJeton && nbRegards === 0) {
      act = { t: 'Votre Feedback 360 attend ses premiers regards', p: 'Trois messages prêts à copier vous attendent, trois minutes pour vos collègues.', cta: 'Ouvrir les invitations', fn: "App.allerFeedback('inviter')" };
    } else if (aJeton && !mir.prediction && nbRegards < 3) {
      act = { t: 'Faites votre pronostic Feedback 360', p: 'Trente secondes pour prédire le regard des autres. À l\'arrivée de leurs réponses : votre score de lucidité.', cta: 'Faire mon pronostic', fn: "App.allerFeedback('pari')" };
    } else if (!pistes.length) {
      act = { t: 'Choisissez vos premières actions', p: 'Vos opportunités sont identifiées : reliez-les à des actions concrètes pour lancer le programme.', cta: 'Voir mes compétences', fn: "App.cockpitVers('espace-competences')" };
    } else if (sd.length) {
      const dernier = joursAncres.length ? Math.round((Date.now() - new Date(joursAncres[0] + 'T12:00:00').getTime()) / 86400000) : 99;
      if (dernier >= 3) act = { t: 'Votre prochain défi vous attend', p: 'Dernier défi ancré il y a ' + dernier + ' jours. Une petite action aujourd\'hui relance la dynamique.', cta: 'Voir mes défis', fn: "App.cockpitVers('espace-seedup')" };
      else act = { t: 'La dynamique est en route', p: 'Continuez sur votre lancée, un défi ancré à la fois.', cta: 'Voir mes défis', fn: "App.cockpitVers('espace-seedup')" };
    } else if (!aJeton && jour !== null && jour >= 7) {
      act = { t: 'Et si vous demandiez un regard extérieur ?', p: 'Le Feedback 360 confronte votre lecture à celle de vos collègues, en trois minutes pour eux.', cta: 'Découvrir le Feedback 360', fn: "App.allerFeedback('haut')" };
    }
    return act;
  }

  // v138 : le bandeau du plan affiche l'action réelle du jour, jamais l'écran courant.
  function poserBandeauJour(data, carte){
    const resumeEl = document.getElementById('espace-accueil-resume');
    if (!resumeEl) return;
    const archetype = monArchetype || (data && data.archetype) || '';
    const famKey = (SINEA_DATA.famille(archetype) || '').toUpperCase();
    const coulFam = (window.Competences && Competences.COULEURS_FAMILLES && Competences.COULEURS_FAMILLES[famKey]) || '#FDFCF8';
    const act = calculerActionDuJour(data, carte)
      || { t: 'Reprenez vos prochaines étapes', cta: 'Voir mes étapes', fn: "App.cockpitVers('espace-checklist')" };
    resumeEl.innerHTML = '<div class="acc-resume">'
      + '<span class="acc-chip" style="border-color:' + coulFam + '">' + echapValeur(archetype || '') + (famKey ? ' · ' + famKey.charAt(0) + famKey.slice(1).toLowerCase() : '') + '</span>'
      + '<span class="acc-jour"><small>AUJOURD\'HUI</small>' + act.t + '</span>'
      + '<button type="button" class="esp-nav-b acc-cta" onclick="' + act.fn + '">' + act.cta + '</button>'
      + '</div>';
  }

  function poserCockpit(data, carte){
    const slot = document.getElementById('espace-cockpit');
    if (!slot || !data) return;
    const socle = (data.analyses && data.analyses.socle) || {};
    const dateSocle = (socle.date || (socle.profil && socle.profil.date)) ? new Date(socle.date || socle.profil.date).getTime() : null;
    const jour = dateSocle ? Math.max(0, Math.round((Date.now() - dateSocle) / 86400000)) : null;
    const sd = (carte && carte.seedup && Array.isArray(carte.seedup.liste)) ? carte.seedup.liste : [];
    const remFaite = !!(carte && carte.remesure && Array.isArray(carte.remesure.liste) && carte.remesure.liste.length);
    const mir = (carte && carte.miroir) || {};
    const nbRegards = Array.isArray(mir.reponses) ? mir.reponses.length : 0;
    const aJeton = !!mir.jeton;
    const pistes = [];
    Object.values(carte || {}).forEach(function (it) {
      if (it && Array.isArray(it.pistes_libelles)) it.pistes_libelles.forEach(function (l) { if (l && pistes.indexOf(l) < 0) pistes.push(l); });
    });
    const joursAncres = Array.from(new Set(sd.map(function (x) { return String(x.d || '').slice(0, 10); }).filter(Boolean))).sort().reverse();
    let serie = 0;
    if (joursAncres.length) {
      const d0 = new Date(); d0.setHours(12, 0, 0, 0);
      for (let k = 0; k < 120; k++) {
        const cle = new Date(d0.getTime() - k * 86400000).toISOString().slice(0, 10);
        if (joursAncres.indexOf(cle) >= 0) serie++;
        else if (k === 0) continue;
        else break;
      }
    }
    // v138 : le calcul vit dans calculerActionDuJour, partagé avec le bandeau du plan.
    const act = calculerActionDuJour(data, carte);
    if (window.Visuels) {
    }
    let planRapide = '';
    if (pistes.length) {
      const modPlan = (function () {
        for (const m of ['socle', 'commercial', 'manager']) {
          const it = carte && carte[m];
          if (it && Array.isArray(it.pistes_libelles) && it.pistes_libelles.length) return m;
        }
        return 'socle';
      })();
      planRapide = '<button type="button" class="ck-plan-btn" onclick="App.ouvrirPlanDepuisResto(\'' + modPlan + '\')">Ouvrir mon plan d\'action</button>';
    }
    let eng = '';
    if (pistes.length && window.Competences) {
      const compsDefis = new Set(sd.map(function (x) { const mm = Competences.matcherCompetence(x.t || ''); return mm && mm.id; }).filter(Boolean));
      eng = '<div class="esp-cp-titre" role="heading" aria-level="3" style="margin-top:14px">Vos engagements</div>' + pistes.slice(0, 3).map(function (l) {
        const mm = Competences.matcherCompetence(l);
        const enCours = mm && compsDefis.has(mm.id);
        return '<div class="ck-eng"><span class="ck-eng-etat' + (enCours ? ' on' : '') + '">' + (enCours ? '✓ en cours' : 'à lancer') + '</span><span class="ck-eng-txt">' + echapValeur(l) + (mm ? ' <i>· ' + echapValeur(mm.nom) + '</i>' : '') + '</span></div>';
      }).join('');
    }
    if (!act && !eng && !planRapide) { slot.innerHTML = ''; return; }
    const kick = 'Aujourd' + String.fromCharCode(39) + 'hui';
    slot.innerHTML = '<div class="esp-rem ck">'
      + (act
        ? '<div class="esp-rem-kicker">' + kick + (serie >= 2 ? ' · série de ' + serie + ' jours' : '') + '</div><div class="esp-rem-titre" role="heading" aria-level="2">' + act.t + '</div><p class="ck-p">' + act.p + '</p><button type="button" class="esp-rem-btn" onclick="' + act.fn + '">' + act.cta + '</button>'
        : '<div class="esp-rem-kicker">Votre programme des 90 jours</div>')
      + planRapide + eng + '</div>';
  }
  function cockpitVers(id){
    espTab('dev');
    const e = document.getElementById(id);
    if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function poserCompetencesEspace(data, carte){
    const slot = document.getElementById('espace-competences');
    if (!slot || !window.Competences || !data) return;
    const profil = data.analyses && data.analyses.socle && data.analyses.socle.profil;
    if (!profil || !profil.scoresBigFive) return;
    const ecarts = profil.naturelAdapte && profil.naturelAdapte.ecarts;
    const poste = (profil.speStyleScores && Object.prototype.hasOwnProperty.call(profil.speStyleScores, 'challenger')) ? 'commercial' : 'manager';
    const comps = Competences.scorer(profil.scoresBigFive, ecarts, profil.speDims);
    const pri = Competences.prioriser(comps, poste);
    if (!pri.appuis.length && !pri.opportunites.length) return;
    compsEspaceCourant = comps;
    const refPar = {};
    Competences.REFERENTIEL.forEach(function (r) { refPar[r.id] = r; });
    // Les actions du plan déjà choisies, pour le pont
    const actionsPlan = [];
    Object.values(carte || {}).forEach(function (it) {
      if (it && Array.isArray(it.pistes_libelles)) it.pistes_libelles.forEach(function (l) {
        if (l && actionsPlan.indexOf(l) < 0) actionsPlan.push(l);
      });
    });
    const seedupActif = !!(carte && carte.seedup && (carte.seedup.liste || []).length);
    const jauge = (c) => '<div class="esp-cp-jauge" title="Votre nature ' + Math.round(c.potentiel) + ' · Au travail ' + Math.round(c.expression) + '"><div class="esp-cp-pot" style="width:' + Math.round(c.potentiel) + '%"></div><div class="esp-cp-expr" style="left:' + Math.round(c.expression) + '%"></div></div><span class="esp-cp-val">' + Math.round(c.potentiel) + ' · ' + Math.round(c.expression) + '</span>';
    function pontPour(c){
      const action = actionsPlan.find(function (a) { const mm = Competences.matcherCompetence(a); return mm && mm.id === c.id; });
      if (action) return 'Votre action « ' + echapValeur(action.length > 70 ? action.slice(0, 70) + '…' : action) + ' » la travaille déjà.';
      const piste = (refPar[c.id] && refPar[c.id].progresser && refPar[c.id].progresser[0]) || '';
      return (piste ? 'Première piste : ' + echapValeur(piste) : '') + (seedupActif ? ' Vos défis SeedUp cibleront cette compétence.' : '');
    }
    function ligne(c, avecPont){
      const ref = refPar[c.id] || {};
      return '<div class="esp-cp-item">'
        + '<div class="esp-cp-ligne esp-cp-clic" onclick="App.toggleCompEspace(\'' + c.id + '\')"><span class="esp-cp-nom">' + echapValeur(c.nom) + '<span class="esp-cp-fleche" id="esp-cp-fl-' + c.id + '">▸</span></span>' + jauge(c) + '</div>'
        + '<div class="esp-cp-det" id="esp-cp-det-' + c.id + '" style="display:none">'
        + (ref.def ? '<p class="esp-cp-def">' + echapValeur(ref.def) + '</p>' : '')
        + ((ref.progresser || []).length ? '<div class="esp-cp-prog-t">Pour progresser</div><ul class="esp-cp-prog">' + ref.progresser.map(function (p) { return '<li>' + echapValeur(p) + '</li>'; }).join('') + '</ul>' : '')
        + (avecPont ? '<p class="esp-cp-pont-l">' + pontPour(c) + '</p>' : '')
        + '</div></div>';
    }
    let h = '<div class="esp-rem esp-cp">'
      + '<div class="esp-rem-kicker">Vos compétences · la lecture Sinéa</div>'
      + '<div class="esp-rem-titre" role="heading" aria-level="2">Là où votre nature vous porte</div>'
      + '<p class="esp-cp-intro">Le potentiel vient de votre nature profonde, l\'expression de votre comportement au travail. Touchez une compétence pour voir ce qu\'elle recouvre et comment la faire grandir.</p>'
      + '<div class="esp-cp-legende"><span><i class="esp-cp-leg-pot"></i>Potentiel, votre nature</span><span><i class="esp-cp-leg-expr"></i>Expression au travail</span><span class="esp-cp-leg-nb">Les nombres : potentiel · expression</span></div>';
    if (pri.appuis.length){
      h += '<div class="esp-cp-titre" role="heading" aria-level="3">Vos terrains d\'appui</div>' + pri.appuis.map(function (c) { return ligne(c, false); }).join('');
    }
    h += '<button type="button" class="esp-rem-btn esp-cp-mat-btn" id="esp-cp-deplier" onclick="App.deplierCompetences()">Voir toute ma carte des compétences</button>'
      + '<div id="esp-cp-suite" style="display:none">';
    if (pri.opportunites.length){
      h += '<div class="esp-cp-titre" role="heading" aria-level="3">Vos opportunités à investir</div>' + pri.opportunites.map(function (c) { return ligne(c, true); }).join('')
        + '<p class="esp-cp-pont">Le moteur est là, la pratique fera le reste' + (seedupActif ? ' : vos défis de terrain SeedUp travaillent précisément ces opportunités.' : '.') + '</p>';
    }
    // La carte des 16, avec les flèches d'évolution si une re-mesure existe
    let deltasQ = null;
    try {
      const remListe = carte && carte.remesure && Array.isArray(carte.remesure.liste) ? carte.remesure.liste : [];
      const rem = remListe.length ? remListe[remListe.length - 1] : null;
      if (rem && rem.ecarts) {
        const apres = Competences.scorer(profil.scoresBigFive, rem.ecarts, profil.speDims);
        deltasQ = {};
        apres.forEach(function (c2) {
          const av = comps.find(function (x) { return x.id === c2.id; });
          if (av) deltasQ[c2.id] = { avant: av.expression, apres: c2.expression };
        });
      }
    } catch (e) { console.warn("[Sinéa]", e); }
    h += '<button type="button" class="esp-rem-btn esp-cp-mat-btn" onclick="App.toggleMatriceEspace()">Découvrir ma Constellation</button>'
      + '<div id="esp-cp-matrice" style="display:none">'
      + '<div class="cstl"><div class="cstl-tete"><b>Ma Constellation</b><span>Seize compétences, trente-deux facettes. Vers la droite grandit votre potentiel naturel, vers le haut votre expression au travail. Vos appuis brillent en haut à droite, vos opportunités attendent en bas à droite, là où vos progrès se verront. Les étoiles étiquetées comptent pour vous, touchez les autres pour les découvrir.</span><button type="button" class="ckl-cta" onclick="App.ouvrirGlossaire()">Le glossaire · 16 + 32</button></div>'
      + '<div class="cstl-grid"><div class="cstl-carte">'
      + (window.Visuels ? Visuels.quadrantSvg(comps, { deltas: deltasQ, compact: true, clic: 'App.ouvrirCompDepuisCarte', labels: idsAValeur(comps) }) : '')
      + '<span class="cstl-hint">Glissez la carte pour explorer ses ' + window.Competences.REFERENTIEL.length + ' étoiles</span>'
      + '<span class="cstl-aide">Touchez une étoile : sa fiche s\'ouvre juste dessous.</span>'
      + '</div><div class="cstl-lecture">' + lectureCarte(comps) + '</div></div>'
      + '</div>'
      + (deltasQ ? '<div class="q16-slider"><span>J0</span><input type="range" id="esp-q16-t" min="0" max="100" value="100" aria-label="Rejouer les 90 jours"><span>J90</span></div>' : '')
      + '<div id="esp-cp-focus"></div>'
      + '</div>';
    h += '</div>';
    h += '</div>';
    slot.innerHTML = h;
  }

  function deplierCompetences(){
    const suite = document.getElementById('esp-cp-suite');
    const btn = document.getElementById('esp-cp-deplier');
    if (!suite) return;
    const ouvert = suite.style.display !== 'none';
    suite.style.display = ouvert ? 'none' : 'block';
    if (btn) btn.textContent = ouvert ? 'Voir toute ma carte des compétences' : 'Replier ma carte des compétences';
  }
  function toggleCompEspace(id){
    const d = document.getElementById('esp-cp-det-' + id);
    const f = document.getElementById('esp-cp-fl-' + id);
    if (!d) return;
    const ouvert = d.style.display !== 'none';
    d.style.display = ouvert ? 'none' : 'block';
    if (f) f.textContent = ouvert ? '▸' : '▾';
  }
  // ===== La lecture de la carte : ce que la Constellation dit, en clair =====
  function idsAValeur(comps){
    const appuis = comps.filter(function (x) { return x.zone === 'appui'; }).sort(function (a, b) { return (b.potentiel + b.expression) - (a.potentiel + a.expression); }).slice(0, 3);
    const opps = comps.filter(function (x) { return x.zone === 'opportunite'; }).sort(function (a, b) { return (b.potentiel - b.expression) - (a.potentiel - a.expression); }).slice(0, 2);
    return appuis.concat(opps).map(function (x) { return x.id; });
  }
  function chipCarte(c2, coul){
    return '<button type="button" class="cl-chip" style="border-color:' + coul + ';color:' + coul + '" onclick="App.ouvrirCompDepuisCarte(&quot;' + c2.id + '&quot;)">' + echapValeur(c2.nom) + '</button>';
  }
  function lectureCarte(comps){
    const appuis = comps.filter(function (x) { return x.zone === 'appui'; }).sort(function (a, b) { return (b.potentiel + b.expression) - (a.potentiel + a.expression); }).slice(0, 3);
    const opps = comps.filter(function (x) { return x.zone === 'opportunite'; }).sort(function (a, b) { return (b.potentiel - b.expression) - (a.potentiel - a.expression); }).slice(0, 2);
    const nVeille = comps.filter(function (x) { return x.zone === 'economie'; }).length;
    let h = '<div class="cl-kicker">La lecture de votre carte</div>';
    if (appuis.length) {
      h += '<div class="cl-bloc"><div class="cl-t" style="color:#3EAD8B">Vos appuis signature</div><div class="cl-chips">' + appuis.map(function (x) { return chipCarte(x, '#3EAD8B'); }).join('') + '</div><p class="cl-p">Nature et pratique alignées au plus haut : confiez-leur du poids, faites-les voir.</p></div>';
    }
    if (opps.length) {
      h += '<div class="cl-bloc"><div class="cl-t" style="color:#E08A3C">Vos opportunités rentables</div><div class="cl-chips">' + opps.map(function (x) { return chipCarte(x, '#E08A3C'); }).join('') + '</div><p class="cl-p">' + opps.map(function (x) { return echapValeur(x.nom) + ' : potentiel ' + Math.round(x.potentiel) + ', exprimé ' + Math.round(x.expression); }).join(' · ') + '. Le moteur est là, quatre-vingt-dix jours de pratique suffisent à le faire parler.</p></div>';
    }
    if (!appuis.length && !opps.length) h += '<p class="cl-p">Votre carte est équilibrée : touchez les étoiles pour explorer chaque compétence.</p>';
    if (nVeille) h += '<p class="cl-veille">' + nVeille + ' compétence' + (nVeille > 1 ? 's' : '') + ' en veille : normal, personne ne brille sur tous les fronts.</p>';
    h += '<p class="cl-p cl-fin">Chaque étoile a sa fiche : trajectoire en quatre paliers et deux facettes à travailler.</p>';
    return h;
  }
  function toggleMatriceEspace(){
    const d = document.getElementById('esp-cp-matrice');
    if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
  }


  // ---- Les défis de terrain SeedUp dans l'espace ----
  // Le bloc n'apparaît que si des données SeedUp existent pour la personne.
  // Il liste les défis un à un, avec leur réussite, leur débrief et le lien
  // vers l'action du plan qu'ils servent.
  function comptePlan(data) {
    const out = { faites: 0, total: 0, mod: 'socle', prochaine: '' };
    try {
      const tout = (data && data.suivi_plan) || {};
      Object.keys(tout).forEach(function (m) {
        const liste = (tout[m] && tout[m].suivi) || [];
        liste.forEach(function (p) {
          out.total++;
          if (p.statut === 'Fait') out.faites++;
          else if (!out.prochaine && p.objectif) { out.prochaine = String(p.objectif).slice(0, 110); out.mod = m; }
        });
      });
    } catch (e) {}
    return out;
  }

  function slugDeNom(nom) {
    const P = (window.SINEA_DATA && SINEA_DATA.personnages) || {};
    for (const k in P) { if (P[k] && P[k].nom === nom) return k; }
    return '';
  }

  function poserSeedupEspace(carte) {
    const planInfo = comptePlan((typeof dataEspaceCourant !== 'undefined' && dataEspaceCourant) || null);
    const slot = document.getElementById('espace-seedup');
    if (!slot) return;
    slot.innerHTML = '';
    const sd = carte.seedup || {};
    const liste = Array.isArray(sd.liste) ? sd.liste.slice() : [];
    // Les défis proposés lors de la restitution, retrouvés pour Ambre et les
    // autres : d'abord les interactions Airtable, sinon la mémoire de l'appareil.
    let proposes = [];
    for (const m of ['socle', 'commercial', 'manager']) {
      const it = carte[m];
      if (it && Array.isArray(it.defis_proposes) && it.defis_proposes.length) { proposes = it.defis_proposes; break; }
    }
    if (!proposes.length) {
      try {
        for (const suf of ['commercial', 'manager', 'classic']) {
          const d = JSON.parse(localStorage.getItem('sinea_defis_' + suf) || 'null');
          if (Array.isArray(d) && d.length) { proposes = d; break; }
        }
      } catch (e) {}
    }
    if (!liste.length && planInfo.total === 0 && !proposes.length) return;
    liste.sort(function (a, b) { return String(b.d || '').localeCompare(String(a.d || '')); });
    const reussites = liste.map(function (x) { return x.r; }).filter(function (v) { return typeof v === 'number'; });
    const moyR = reussites.length ? Math.round(reussites.reduce(function (a, b) { return a + b; }, 0) / reussites.length * 10) / 10 : null;
    const dateMaj = sd.maj ? new Date(sd.maj).toLocaleDateString('fr-FR') : '';

    // Étage 3 du pont : quels défis servent quelles actions du plan ?
    // Appariement déterministe par mots significatifs partagés, sans IA.
    const actionsPlan = [];
    Object.values(carte).forEach(function (it) {
      if (it && Array.isArray(it.pistes_libelles)) it.pistes_libelles.forEach(function (l) {
        if (l && actionsPlan.indexOf(l) < 0) actionsPlan.push(l);
      });
    });
    const VIDES = ['dans','avec','pour','votre','vous','cette','plus','sans','tous','toute','être','etre','faire','chaque','entre','avant','après','apres'];
    function motsSignif(t) {
      return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z ]/g, ' ').split(/\s+/)
        .filter(function (m) { return m.length >= 4 && VIDES.indexOf(m) < 0; });
    }
    function actionServie(titreDefi) {
      if (!actionsPlan.length) return '';
      const md = motsSignif(titreDefi);
      let meilleure = '', score = 0;
      actionsPlan.forEach(function (a) {
        const ma = motsSignif(a);
        let n = 0;
        md.forEach(function (m) { if (ma.indexOf(m) >= 0) n++; });
        if (n > score) { score = n; meilleure = a; }
      });
      return score >= 2 ? meilleure : '';
    }

    function carteDefi(x) {
      const dateTxt = x.d ? new Date(x.d + 'T12:00:00').toLocaleDateString('fr-FR') : '';
      let h = '<div class="esp-sd-item">';
      h += '<div class="esp-sd-top"><span class="esp-sd-titre">' + echapValeur(x.t || 'Défi') + '</span><span class="esp-sd-date">' + dateTxt + '</span></div>';
      const chips = [];
      if (typeof x.r === 'number') chips.push('Réussite ' + x.r + '/10');
      if (typeof x.n === 'number') chips.push('Défi noté ' + x.n + '/5');
      if (chips.length) h += '<div class="esp-sd-chips">' + chips.map(function (c) { return '<span class="esp-sd-chip">' + c + '</span>'; }).join('') + '</div>';
      const deb = String(x.deb || '').trim();
      if (deb) {
        if (deb.indexOf('http') === 0) h += '<a class="esp-sd-video" href="' + echapValeur(deb) + '" target="_blank" rel="noopener">Voir ma vidéo de débrief</a>';
        else h += '<p class="esp-sd-deb">« ' + echapValeur(deb) + ' »</p>';
      }
      const coach = String(x.coach || '').trim();
      if (coach) h += '<div class="esp-sd-coach"><span class="esp-sd-coach-lbl">Votre coach</span>' + echapValeur(coach) + '</div>';
      const sert = actionServie(x.t || '');
      if (sert) h += '<div class="esp-sd-lien">Sert votre action : « ' + echapValeur(sert.length > 90 ? sert.slice(0, 90) + '…' : sert) + ' »</div>';
      h += '</div>';
      return h;
    }

    slot.innerHTML = '<div class="esp-rem esp-sd">'
      + '<div class="esp-rem-kicker">SeedUp · Vos défis de terrain</div>'
      + '<div class="esp-rem-titre" role="heading" aria-level="2">' + (liste.length ? liste.length + ' défi' + (liste.length > 1 ? 's' : '') + ' ancré' + (liste.length > 1 ? 's' : '') : proposes.length + ' défi' + (proposes.length > 1 ? 's' : '') + ' proposé' + (proposes.length > 1 ? 's' : '')) + '</div>'
      + '<p class="jr-pourquoi">Quatre-vingt-dix jours pour transformer votre portrait en habitudes, un défi de terrain à la fois.</p>'
      + (planInfo.total > 0 ? '<p class="jr-plan-note">' + planInfo.faites + ' piste' + (planInfo.faites > 1 ? 's' : '') + ' de votre plan menée' + (planInfo.faites > 1 ? 's' : '') + ' au bout, sur ' + planInfo.total + '. <button type="button" class="jr-plan-btn" onclick="App.ouvrirPlanDepuisResto(\'' + planInfo.mod + '\')">Ouvrir mon plan</button></p>' : '')
      + '<div class="esp-sd-stats">'
      + (moyR !== null ? 'Réussite moyenne ' + moyR + '/10' : '')
      + (dateMaj ? (moyR !== null ? ' · ' : '') + 'mis à jour le ' + dateMaj : '') + '</div>'
      + (proposes.length ? '<div class="esp-sd-soustitre">Vos défis proposés</div>'
        + proposes.map(function (df) {
            return '<div class="esp-sd-item esp-sd-propose"><div class="esp-sd-top"><span class="esp-sd-titre">' + echapValeur(df.titre || 'Défi') + '</span></div>'
              + (df.defi ? '<p class="esp-sd-deb">' + echapValeur(df.defi) + '</p>' : '')
              + (df.duree ? '<div class="esp-sd-chips"><span class="esp-sd-chip">' + df.duree + ' min' + (df.niveau ? ' · niveau ' + df.niveau : '') + '</span></div>' : '')
              + '</div>';
          }).join('') : '')
      + (liste.length ? '<div class="esp-sd-soustitre">Vos défis, un à un</div>' : '')
      + liste.slice(0, 3).map(carteDefi).join('')
      + (liste.length > 3 ? '<div id="esp-sd-reste" style="display:none">' + liste.slice(3).map(carteDefi).join('') + '</div><button type="button" class="esp-rem-btn esp-sd-btn" id="esp-sd-plus">Voir mes ' + liste.length + ' défis</button>' : '')
      + '<p class="esp-sd-canal">Retrouvez l\'expérience complète dans votre application SeedUp.</p>'
      + '</div>';
    const plus = document.getElementById('esp-sd-plus');
    if (plus) plus.onclick = function () {
      const reste = document.getElementById('esp-sd-reste');
      if (reste) reste.style.display = 'block';
      plus.style.display = 'none';
    };
  }

  // ---- Re-mesure express de l'adaptation (pilier Ancrer) ----
  // La nature est stable, l'adaptation évolue : dix questions, deux minutes,
  // et la personne voit comment son coût d'adaptation a bougé dans le temps.
  const REMESURE_JOURS = 90;
  let _remRep = {};
  let _remContexte = null;

  function poserRemesure(data, carte) {
    const slot = document.getElementById('espace-remesure');
    if (!slot) return;
    slot.innerHTML = '';
    const socle = (data && data.analyses && data.analyses.socle) || null;
    const na = socle && socle.profil && socle.profil.naturelAdapte;
    if (!na || !na.naturel || !na.adapte) return;
    const force = /[?&]remesure=test/.test(location.search);
    const dateSocle = (socle.date || (socle.profil && socle.profil.date)) ? new Date(socle.date || socle.profil.date).getTime() : null;
    const liste = ((carte.remesure || {}).liste) || [];
    const derniere = liste.length ? liste[liste.length - 1] : null;
    const refTemps = derniere ? new Date(derniere.date).getTime() : dateSocle;
    const attenteOk = refTemps ? (Date.now() - refTemps) >= REMESURE_JOURS * 24 * 3600 * 1000 : true;
    _remContexte = { na: na, liste: liste };
    if (derniere) rendreEvolutionRemesure(slot, na, derniere, force || attenteOk);
    else if (force || attenteOk) rendreInvitationRemesure(slot);
  }

  function rendreInvitationRemesure(slot) {
    slot.innerHTML = `<div class="esp-rem">
      <div class="esp-rem-kicker">Re-mesure express</div>
      <div class="esp-rem-titre" role="heading" aria-level="2">Votre adaptation a-t-elle évolué ?</div>
      <p class="esp-rem-txt">Votre nature est stable, votre adaptation au travail évolue. Dix questions, deux minutes, et vous voyez le chemin parcouru depuis votre bilan.</p>
      <button type="button" class="esp-rem-btn" id="esp-rem-go">Commencer la re-mesure</button>
    </div>`;
    const go = document.getElementById('esp-rem-go');
    if (go) go.onclick = function () { ouvrirFormRemesure(slot); };
  }

  function ouvrirFormRemesure(slot) {
    _remRep = {};
    const qs = (SINEA_DATA.adapte && SINEA_DATA.adapte.questions) || [];
    const ancres = SINEA_DATA.mini_ancres || { 1: 'Pas du tout moi', 2: 'Plutôt pas moi', 3: 'Plutôt moi', 4: 'Tout à fait moi' };
    const lignes = qs.map(q => `<div class="esp-rem-q">
        <p class="esp-rem-q-txt">${q.texte}</p>
        <div class="esp-rem-opts">${[1, 2, 3, 4].map(v => `<button type="button" class="esp-rem-opt" data-q="${q.id}" data-v="${v}">${ancres[v]}</button>`).join('')}</div>
      </div>`).join('');
    slot.innerHTML = `<div class="esp-rem">
      <div class="esp-rem-kicker">Re-mesure express</div>
      <div class="esp-rem-titre" role="heading" aria-level="2">Votre comportement réel au travail, aujourd'hui</div>
      <p class="esp-rem-txt">Répondez avec spontanéité, en pensant à vos dernières semaines.</p>
      ${lignes}
      <button type="button" class="esp-rem-btn" id="esp-rem-valider" disabled>Voir mon évolution</button>
    </div>`;
    slot.querySelectorAll('.esp-rem-opt').forEach(function (b) {
      b.onclick = function () {
        const q = this.getAttribute('data-q');
        _remRep[q] = parseInt(this.getAttribute('data-v'), 10);
        slot.querySelectorAll('.esp-rem-opt[data-q="' + q + '"]').forEach(function (x) { x.classList.remove('on'); });
        this.classList.add('on');
        const btn = document.getElementById('esp-rem-valider');
        if (btn && Object.keys(_remRep).length >= qs.length) btn.disabled = false;
      };
    });
    const val = document.getElementById('esp-rem-valider');
    if (val) val.onclick = function () { validerRemesure(slot); };
  }

  function validerRemesure(slot) {
    const na = _remContexte && _remContexte.na;
    if (!na) return;
    const mesure = Engine.remesurerAdapte(_remRep, na.naturel);
    const entree = {
      date: new Date().toISOString(),
      adapte: mesure.adapte, ecarts: mesure.ecarts,
      cout: mesure.cout, moyenneEcart: mesure.moyenneEcart,
    };
    const liste = (_remContexte.liste || []).concat([entree]);
    _remContexte.liste = liste;
    fetch(PROGRESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_interactions', email: identite.email, type_analyse: 'remesure', interactions: { liste: liste } }),
    }).catch(() => {});
    rendreEvolutionRemesure(slot, na, entree, false);
  }

  function rendreEvolutionRemesure(slot, na, mesure, proposerNouvelle) {
    const avant = (typeof na.moyenneEcart === 'number') ? na.moyenneEcart : null;
    const apres = mesure.moyenneEcart;
    const delta = (avant !== null) ? Math.round((apres - avant) * 10) / 10 : null;
    let phrase;
    if (delta === null) phrase = `Votre re-mesure est enregistrée. Elle servira de point de comparaison pour la suite.`;
    else if (delta <= -3) phrase = `Votre coût d'adaptation a baissé de ${Math.abs(delta)} points. Vous travaillez plus proche de votre nature, le signe d'un ancrage qui prend.`;
    else if (delta >= 3) phrase = `Votre coût d'adaptation a augmenté de ${delta} points. Votre contexte vous demande davantage en ce moment : identifiez ce qui pèse, et préservez des espaces où vous fonctionnez au naturel.`;
    else phrase = `Votre coût d'adaptation est stable. Vous tenez votre équilibre entre nature et posture professionnelle.`;
    const dateTxt = mesure.date ? new Date(mesure.date).toLocaleDateString('fr-FR') : '';
    slot.innerHTML = `<div class="esp-rem">
      <div class="esp-rem-kicker">Votre évolution</div>
      <div class="esp-rem-titre" role="heading" aria-level="2">Coût d'adaptation : ${avant !== null ? avant + ' <span class="esp-rem-fleche">›</span> ' : ''}${apres}</div>
      <div class="esp-rem-cout">Niveau ${mesure.cout}${dateTxt ? ' · re-mesuré le ' + dateTxt : ''}</div>
      <div class="esp-nea" style="margin-top:12px"><span class="esp-nea-img"><img src="Nea_detoure_full.png.webp" alt="Néa" onerror="this.style.display='none'"/></span><div class="esp-nea-txt"><div class="esp-nea-label">Néa · votre coach</div><p>${phrase}</p></div></div>
      ${proposerNouvelle ? '<button type="button" class="esp-rem-btn" id="esp-rem-encore">Re-mesurer à nouveau</button>' : ''}
    </div>`;
    const enc = document.getElementById('esp-rem-encore');
    if (enc) enc.onclick = function () { ouvrirFormRemesure(slot); };
  }

  // ---- Miroir 360 : le regard des collègues, comparé au profil ----
  // Trois collègues au moins répondent à treize questions par un lien anonyme.
  // L'écart entre leur perception et le profil adapté devient une analyse.
  const MIROIR_QUESTIONS = [
    { d: 'E', label: 'Aller vers les autres', texte: 'Cette personne va spontanément vers les autres et prend sa place dans un groupe.' },
    { d: 'A', label: 'Attention aux autres', texte: 'Cette personne se montre attentive aux besoins des autres et cherche des solutions qui conviennent à chacun.' },
    { d: 'C', label: 'Organisation et fiabilité', texte: 'Cette personne est organisée et fiable dans ce qu\'elle entreprend.' },
    { d: 'S', label: 'Calme sous pression', texte: 'Cette personne garde son calme et sa stabilité quand la pression monte.' },
    { d: 'O', label: 'Curiosité et idées', texte: 'Cette personne propose volontiers des idées ou des approches nouvelles.' },
    { d: 'c_developpement_autres', label: 'Faire grandir les autres', texte: 'Cette personne aide les autres à progresser : elle transmet, donne du feedback, fait grandir.' },
    { d: 'c_communication_influence', label: 'Convaincre et embarquer', texte: 'Quand cette personne présente une idée, elle convainc et embarque son auditoire.' },
    { d: 'c_orientation_resultats', label: 'Aller au bout', texte: 'Cette personne va au bout de ce qu\'elle entreprend et conclut.' },
    { d: 'c_prise_decision', label: 'Trancher', texte: 'Cette personne tranche et assume ses décisions, même dans l\'incertitude.' },
    { d: 'c_cooperation', label: 'Esprit d\'équipe', texte: 'Cette personne joue collectif : elle aide spontanément et partage l\'information.' },
    { d: 'c_resilience', label: 'Solide sous pression', texte: 'Cette personne garde son calme et rebondit vite face aux difficultés.' },
    { d: 'c_fiabilite_suivi', label: 'Tient ses engagements', texte: 'Ce qui est convenu avec cette personne est fait, dans les délais.' },
    { d: 'conseil', type: 'texte', label: 'Un geste à continuer, un geste à oser', texte: 'Un geste que cette personne gagne à continuer, et un geste qu\'elle gagnerait à oser.' },
  ];
  const MIROIR_ANCRES = { 1: 'Pas du tout', 2: 'Plutôt pas', 3: 'Plutôt oui', 4: 'Tout à fait' };
  const MIROIR_CONV = { 1: 0.0, 2: 33.333, 3: 66.667, 4: 100.0 };
  let _mirRep = {};

  // Perception agrégée par dimension, avec le même adoucissement doux que le profil adapté
  const COMPS_360 = ['c_developpement_autres', 'c_communication_influence', 'c_orientation_resultats', 'c_prise_decision', 'c_cooperation', 'c_resilience', 'c_fiabilite_suivi'];
  function croiserRegards(reponsesTous) {
    const out = { confirmees: [], angles: [], discretes: [], partages: [], percu: {} };
    try {
      const data = dataEspaceCourant || {};
      const prof = (((data.analyses || {}).socle) || {}).profil || {};
      const bf = prof.scoresBigFive || prof.bigFive;
      if (!bf || !window.Competences) return out;
      const comps = Competences.scorer(bf, (prof.naturelAdapte && prof.naturelAdapte.ecarts) || null, null);
      const parId = {};
      comps.forEach(function (co) { parId[co.id] = co; });
      COMPS_360.forEach(function (id) {
        const notes = reponsesTous.map(function (rp) { return (rp.r || {})[id]; }).filter(function (v) { return v >= 1 && v <= 4; });
        const moiC = parId[id] || parId[id.replace(/^c_/, '')];
        if (notes.length) out.percu[id] = notes.reduce(function (a2, b2) { return a2 + MIROIR_CONV[b2]; }, 0) / notes.length;
        if (!notes.length || !moiC) return;
        const eux = Math.round(notes.reduce(function (a, b) { return a + b; }, 0) / notes.length / 3 * 100 - 100 / 3);
        const moi = Math.round(moiC.expression);
        const delta = eux - moi;
        const item = { id: id, nom: moiC.nom, moi: moi, eux: Math.max(0, eux), delta: delta };
        if (delta >= 15) out.angles.push(item);
        else if (delta <= -15) out.discretes.push(item);
        else if (eux >= 60 && moi >= 58) out.confirmees.push(item);
        else if (eux < 60 && moi < 58) out.partages.push(item);
        else out.confirmees.push(item);
      });
      ['confirmees', 'angles', 'discretes', 'partages'].forEach(function (k) {
        out[k].sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
      });
    } catch (e) {}
    return out;
  }

  function pisteExiste360(nom) {
    try {
      const tout = (dataEspaceCourant && dataEspaceCourant.suivi_plan) || {};
      let trouve = false;
      Object.keys(tout).forEach(function (m) {
        ((tout[m] || {}).suivi || []).forEach(function (p) { if (String(p.objectif || '').indexOf(nom) >= 0) trouve = true; });
      });
      return trouve;
    } catch (e) { return false; }
  }

  function mirCroiseHtml(reponsesTous) {
    if (!Array.isArray(reponsesTous) || reponsesTous.length < 3) {
      return reponsesTous && reponsesTous.length === 1
        ? '<div class="mir-croise mir-croise-attente"><p>Encore un regard et votre lecture croisée s\'ouvre ici : vos forces confirmées, vos angles morts, vos forces discrètes.</p></div>'
        : '';
    }
    const t = croiserRegards(reponsesTous);
    if (!t.confirmees.length && !t.angles.length && !t.discretes.length && !t.partages.length) return '';
    const carte = function (it, genre) {
      let phrase = '';
      let action = '';
      if (genre === 'angle') {
        phrase = 'Vos collègues vous voient plus fort que vous (+' + it.delta + '). Vous sous-estimez un appui qu\'ils utilisent déjà.';
        action = pisteExiste360(it.nom)
          ? '<span class="mc-fait">Dans votre plan ✓</span>'
          : '<button type="button" class="mc-btn" onclick="App.pisteDepuis360(\'' + it.id + '\', \'' + String(it.nom).replace(/'/g, '') + '\', this)">En faire une piste de mon plan</button>';
      } else if (genre === 'discrete') {
        phrase = 'Vous vous voyez plus fort qu\'eux (' + it.delta + '). Cette force reste invisible : montrez-la ou recalibrez-la.';
      } else if (genre === 'partage') {
        phrase = 'Bas des deux côtés : un chantier assumé, sans illusion.';
      } else {
        phrase = 'Vous et eux la voyez : un appui solide et public.';
      }
      return '<div class="mc-carte"><div class="mc-nom">' + it.nom + '</div><div class="mc-chiffres">vous ' + it.moi + ' · leurs regards ' + it.eux + '</div><p class="mc-p">' + phrase + '</p>' + action + '</div>';
    };
    const bloc = function (titre, sous, liste, genre, cls) {
      if (!liste.length) return '';
      return '<div class="mc-terr ' + cls + '"><div class="mc-t">' + titre + '</div><div class="mc-s">' + sous + '</div>' + liste.map(function (it) { return carte(it, genre); }).join('') + '</div>';
    };
    const mir2 = ((((dataEspaceCourant || {}).interactions || {}).socle) || {}).miroir || {};
    const pred = mir2.prediction || {};
    let luc = '';
    try {
      const cles = Object.keys(t.percu || {}).filter(function (k) { return pred[k] !== undefined && pred[k] !== null; });
      if (cles.length >= 3) {
        const ecart = cles.reduce(function (a2, k) { const pv = Number(pred[k]); const p100 = pv <= 4 ? (MIROIR_CONV[pv] || 0) : pv; return a2 + Math.abs(p100 - t.percu[k]); }, 0) / cles.length;
        const score = Math.max(0, Math.round(100 - ecart));
        const mot = score >= 75 ? ', une belle justesse.' : score >= 50 ? ', quelques surprises fécondes.' : ', le miroir vous apprend beaucoup.';
        luc = '<div class="mir-luc"><span class="mir-luc-k">LUCIDITÉ</span><b>' + score + ' / 100</b><p>Votre pronostic face à leur regard réel' + mot + '</p></div>';
      }
    } catch (e) {}
    return '<div class="mir-croise">' + luc + '<div class="mir-croise-head"><span class="esp-rem-kicker">La lecture croisée</span><h3>Vous, et leurs regards.</h3><p class="mc-intro">Sur les sept compétences observées, calculée sur ' + reponsesTous.length + ' regards.</p></div><div class="mc-grille">'
      + bloc('Vos forces cachées', 'Ils vous voient plus fort que vous, assumez cette marge.', t.angles, 'angle', 'mc-angle')
      + bloc('Forces confirmées', 'Visibles de vous comme d\'eux.', t.confirmees, 'conf', 'mc-conf')
      + bloc('À rendre visibles', 'Vous les vivez, ils les voient moins, montrez-les.', t.discretes, 'discrete', 'mc-disc')
      + bloc('Terrain partagé', 'Bas des deux côtés, en toute lucidité.', t.partages, 'partage', 'mc-part')
      + '</div></div>';
  }

  function planPourNea() {
    try {
      const tout = (dataEspaceCourant && dataEspaceCourant.suivi_plan) || {};
      const out = [];
      Object.keys(tout).forEach(function (m) {
        if (m.charAt(0) === '_') return;
        ((tout[m] || {}).suivi || []).forEach(function (p) {
          if (p && p.objectif) out.push({ objectif: String(p.objectif).slice(0, 110), statut: p.statut || 'À faire' });
        });
      });
      return out.slice(0, 8);
    } catch (e) { return []; }
  }

  function pisteDepuis360(id, nom, el) {
    try {
      const data = dataEspaceCourant || {};
      data.suivi_plan = data.suivi_plan || {};
      data.suivi_plan.socle = data.suivi_plan.socle || { suivi: [] };
      data.suivi_plan.socle.suivi = data.suivi_plan.socle.suivi || [];
      if (pisteExiste360(nom)) return;
      const objectif = "M'appuyer davantage sur ma " + nom + ' : une occasion concrète cette semaine, que mes collègues remarquent';
      data.suivi_plan.socle.suivi.push({ thematique: 'Regard 360', objectif: objectif, statut: 'À faire', ressenti: '', horizon: '2 semaines' });
      fetch(PROGRESSION_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_plan_suivi', email: identite.email, module: 'socle', suivi: data.suivi_plan.socle.suivi }),
      }).catch(function () {});
      try { if (el && el.parentNode) el.outerHTML = '<span class="mc-fait">Dans votre plan ✓</span>'; } catch (e) {}
      try { poserRetourNea(carteEspaceCourant); } catch (e) {}
      try { poserSeedupEspace(carteEspaceCourant); } catch (e) {}
    } catch (e) { console.warn('[Sinéa]', e); }
  }

  function agregerMiroir(reponses) {
    const percu = {};
    MIROIR_QUESTIONS.forEach(function (q) {
      const vals = reponses.map(function (rep) { return MIROIR_CONV[(rep.r || {})[q.d]]; }).filter(function (v) { return v !== undefined; });
      if (vals.length) {
        let m = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        m = 50 + (m - 50) * 0.94;
        percu[q.d] = Math.round(m * 10) / 10;
      }
    });
    return percu;
  }

  // v137 : les chiffres du miroir sortent d'une seule constante pour empêcher la redérive.
  // La durée correspond au questionnaire réel du répondant, treize questions.
  const MIROIR_CHIFFRES = { invites: '3 à 5', duree: '3 minutes', seuil: 3 };
  function guideMiroirHtml(lien){
    const msgs = [
      { cible: 'À un pair', txt: "Salut ! Je viens de faire mon profil Sinéa et il me propose un miroir 360 : ton regard extérieur en " + MIROIR_CHIFFRES.duree + ", anonyme et agrégé avec d'autres. Ça m'aiderait vraiment à progresser. Voici le lien : [LIEN]. Merci !" },
      { cible: 'À votre manager', txt: "Bonjour, dans le cadre de mon parcours Sinéa, je recueille quelques regards extérieurs sur mes compétences (" + MIROIR_CHIFFRES.duree + ", réponses agrégées). Votre point de vue compterait beaucoup pour cibler mes axes de progression. Le lien : [LIEN]. Merci d'avance." },
      { cible: 'À un collaborateur ou client interne', txt: "Bonjour, je travaille sur mon développement et j'aimerais votre regard honnête sur ma façon de collaborer (" + MIROIR_CHIFFRES.duree + ", anonyme dans l'agrégat). Votre avis m'est précieux : [LIEN]. Merci beaucoup !" },
    ];
    // v137 : sans lien, les messages restent en aperçu verrouillé, boutons désactivés.
    // Avec lien, le lien réel s'injecte dans le texte affiché et dans le texte copié.
    const verrou = !lien;
    return '<div class="esp-mir-guide">'
      + '<p class="esp-mir-principe"><b>Le principe.</b> Vous vous êtes décrit ; le miroir recueille comment les autres vous vivent. L\'écart entre les deux est la matière la plus riche du développement : ce que vous sous-estimez, ce que vous surestimez, ce que tout le monde voit sauf vous.</p>'
      + '<p class="esp-mir-principe"><b>À qui demander.</b> Visez ' + MIROIR_CHIFFRES.invites + ' personnes qui vous voient vraiment travailler, en mélangeant les angles : votre manager, un ou deux pairs, quelqu\'un que vous encadrez ou un client interne. Les réponses sont agrégées : personne n\'est identifiable.</p>'
      + '<div class="esp-mir-msgs' + (verrou ? ' mir-verrou' : '') + '">' + msgs.map(function (m) {
        const affiche = verrou
          ? m.txt.replace('[LIEN]', '<i>[votre lien]</i>')
          : m.txt.replace('[LIEN]', '<span class="mir-lien-injecte">' + lien + '</span>');
        const bouton = verrou
          ? '<button type="button" class="esp-rem-btn esp-mir-msg-btn" disabled>Copier ce message</button><p class="mir-note-verrou">Créez d\'abord votre lien d\'invitation.</p>'
          : '<button type="button" class="esp-rem-btn esp-mir-msg-btn" data-msg="' + echapValeur(m.txt.replace('[LIEN]', lien)) + '" aria-live="polite" onclick="App.copierMsgMiroir(this)">Copier ce message</button>';
        return '<div class="esp-mir-msg"><div class="esp-mir-msg-cible">' + m.cible + '</div><p class="esp-mir-msg-txt">' + affiche + '</p>' + bouton + '</div>';
      }).join('') + '</div></div>';
  }

  // ===== L'atterrissage précis dans le Feedback 360 =====
  function allerFeedback(cible){
    espTab('miroir');
    setTimeout(function () {
      if (cible === 'pari') {
        const corps = document.querySelector('.pari-corps');
        if (corps && corps.classList.contains('esp-hide')) corps.classList.remove('esp-hide');
      }
      // v137 : le volet des messages s'ouvre avant le défilement, sinon la cible reste invisible.
      if (cible === 'inviter') {
        const volet = document.querySelector('details.mir-msgs');
        if (volet) volet.open = true;
      }
      const sel = cible === 'pari' ? '.pari-open' : cible === 'inviter' ? '.esp-mir-msg' : '#espace-miroir';
      const el = document.querySelector(sel) || document.getElementById('espace-miroir');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: cible === 'haut' ? 'start' : 'center' });
    }, 140);
  }
  function copierMsgMiroir(btn){
    const inp = document.getElementById('esp-mir-input');
    const lien = (inp && inp.value) || '';
    // v137 : le lien vit déjà dans data-msg ; le remplacement reste en filet de sécurité.
    const txt = String(btn.getAttribute('data-msg') || '').replace('[LIEN]', lien);
    const fini = function(lib){ const av = btn.textContent; btn.textContent = lib || 'Copié ✓'; setTimeout(function(){ btn.textContent = av; }, 2000); };
    if (navigator.share) { navigator.share({ text: txt }).then(function () { fini('Partagé ✓'); }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { fini(); }).catch(function(){});
    else {
      const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); fini(); } catch (e) {} ta.remove();
    }
  }

  // ===== Vos prochaines étapes : le guide du parcours, neuf jalons détectés =====
  function poserChecklist(data, carte) {
    const slot = document.getElementById('espace-checklist');
    if (!slot) return;
    carte = carte || {};
    checklistCtx = { data: data, carte: carte };
    const jal = carte.jalons || {};
    const analyses = (data && data.analyses) || {};
    const modP = analyses.socle ? 'socle' : (Object.keys(analyses)[0] || 'socle');
    const sd = (carte.seedup && Array.isArray(carte.seedup.liste)) ? carte.seedup.liste : [];
    const remFaite = !!(carte.remesure && Array.isArray(carte.remesure.liste) && carte.remesure.liste.length);
    const mir = carte.miroir || {};
    const nbRegards = Array.isArray(mir.reponses) ? mir.reponses.length : 0;
    const aPlan = Object.values(carte).some(function (it) { return it && Array.isArray(it.pistes_libelles) && it.pistes_libelles.length; });
    const aAvis = window.__avisFait === true || Object.values(carte).some(function (it) { return it && it.avis && (it.avis.AVIS_RESSEMBLANCE || it.avis.AVIS_UTILITE || it.avis.AVIS_CLARTE); });
    const ITEMS = [
      { id: 'questionnaire', label: 'Répondre au questionnaire', pts: 5, fait: true, cta: '', lab: '' },
      { id: 'portrait', label: 'Recevoir votre portrait', pts: 5, fait: true, cta: '', lab: '' },
      { id: 'lecture', label: 'Lire votre analyse', pts: 10, fait: !!jal.lecture || false, cta: 'App.revoirAnalyse(&quot;' + modP + '&quot;)', lab: 'Ouvrir' },
      { id: 'voeux', label: 'Trois questions au coach', pts: 15, fait: !!jal.voeux || (Number(carte.voeux) || 0) >= 3, cta: 'App.revoirAnalyse(&quot;' + modP + '&quot;)', lab: 'Ouvrir' },
      { id: 'avis', label: 'Noter votre portrait', pts: 10, fait: !!jal.avis || aAvis, cta: 'if(window.Result&&Result.noterPortrait)Result.noterPortrait()', lab: 'Noter · 30 s' },
      { id: 'plan', label: aPlan ? 'Suivre votre plan d\'action' : 'Choisir votre plan d\'action', pts: 15, fait: !!jal.plan || aPlan, cta: aPlan ? 'App.ouvrirPlanDepuisResto(&quot;' + modP + '&quot;)' : 'App.revoirAnalyse(&quot;' + modP + '&quot;)', lab: aPlan ? 'Ouvrir' : 'Choisir' },
      { id: 'defi1', label: 'Ancrer un premier défi', pts: 15, fait: !!jal.defi1 || sd.length >= 1, cta: 'App.cockpitVers(&quot;espace-seedup&quot;)', lab: 'Ancrer' },
      { id: 'miroir', label: 'Lancer votre Feedback 360', pts: 10, fait: !!jal.miroir || !!mir.jeton, cta: 'App.allerFeedback(&quot;haut&quot;)', lab: 'Lancer' },
      { id: 'pari', label: 'Faire votre pronostic', pts: 10, fait: !!jal.pari || !!mir.prediction, cta: 'App.allerFeedback(&quot;pari&quot;)', lab: 'Pronostiquer' },
      { id: 'regards2', label: 'Recevoir trois regards', pts: 15, fait: !!jal.regards2 || nbRegards >= 3, cta: 'App.allerFeedback(&quot;inviter&quot;)', lab: 'Inviter' },
      { id: 'remesure', label: 'Re-mesure des 90 jours', pts: 30, fait: !!jal.remesure || remFaite, cta: 'App.cockpitVers(&quot;espace-remesure&quot;)', lab: 'Mesurer' },
    ];
    const faits = ITEMS.filter(function (x) { return x.fait; });
    const aFaire = ITEMS.filter(function (x) { return !x.fait; });

    const prochaines = aFaire.slice(0, 3).map(function (x) {
      return '<div class="ckl-row"><button type="button" class="ckl-ic" aria-label="Marquer « ' + x.label + ' » comme faite" title="Marquer comme faite" onclick="App.marquerFait(&quot;' + x.id + '&quot;, this)">○</button>'
        + '<span class="ckl-lab">' + x.label + '</span>'
        + '<button type="button" class="ckl-cta" onclick="' + x.cta + '">' + x.lab + '</button></div>';
    }).join('');
    const chipsFaits = faits.length
      ? '<div class="ckl-faits">' + faits.map(function (x) { return '<span class="ckl-fait-chip">✓ ' + x.label + '</span>'; }).join('') + '</div>'
      : '';
    slot.innerHTML = '<div class="ckl">'
      + '<div class="ckl-tete"><b>Vos prochaines étapes</b><span>' + faits.length + '/' + ITEMS.length + ' étape' + (faits.length > 1 ? 's' : '') + ' faite' + (faits.length > 1 ? 's' : '') + '</span></div>'
      + '<div class="ckl-bar"><i style="width:' + Math.round(faits.length / ITEMS.length * 100) + '%"></i></div>'
      + (aFaire.length ? '<div class="ckl-next-t">À faire maintenant</div>' + prochaines : '<p class="ckl-plus">Parcours complet, les onze étapes sont faites.</p>')
      + (aFaire.length > 3 ? '<p class="ckl-plus">Et ' + (aFaire.length - 3) + ' autre' + (aFaire.length - 3 > 1 ? 's' : '') + ' étape' + (aFaire.length - 3 > 1 ? 's' : '') + ' suivront, une à la fois.</p>' : '')
      + chipsFaits
      + '</div>';
  }
  function coupeMot(txt, n){
    if (txt.length <= n) return txt;
    return txt.slice(0, n).replace(/\s+\S*$/, '') + '…';
  }
  const ZONES_GLOS = { appui: ['Appui', '#3EAD8B'], opportunite: ['Opportunité', '#E08A3C'], neutre: ['Équilibre', '#5E59C7'], economie: ['En veille', '#8A879B'] };
  function chipDe(id){
    const cE = (compsEspaceCourant || []).filter(function (x) { return x.id === id; })[0];
    if (!cE || !ZONES_GLOS[cE.zone]) return '';
    const z = ZONES_GLOS[cE.zone];
    return '<em class="glos-z" style="background:' + z[1] + '1f;color:' + z[1] + '">' + z[0] + '</em>';
  }
  function ouvrirGlossaire(){
    if (document.getElementById('glos-ov') || !window.Competences) return;
    const ov = document.createElement('div');
    ov.id = 'glos-ov';
    ov.className = 'noter-ov';
    ov.innerHTML = '<div class="glos-card"><button type="button" class="noter-x" onclick="this.closest(&quot;.noter-ov&quot;).remove()">×</button>'
      + '<div class="noter-titre">Le glossaire · ' + window.Competences.REFERENTIEL.length + ' compétences</div>'
      + '<p class="noter-sub">Touchez une compétence : sa définition, votre mesure, sa trajectoire et ses facettes.</p>'
      + '<div class="glos-grid">' + Competences.REFERENTIEL.map(function (r) {
          const coul = (Competences.COULEURS_FAMILLES || {})[r.famille] || '#8A879B';
          return '<button type="button" class="glos-c" onclick="App.choisirGlossaire(&quot;' + r.id + '&quot;)"><i style="background:' + coul + '"></i><b>' + echapValeur(r.nom) + '</b>' + chipDe(r.id) + '<span>' + echapValeur(coupeMot(r.def || '', 64)) + '</span><span class="glos-f">' + ((Competences.FACETTES && Competences.FACETTES[r.id]) || []).map(function (f2) { return echapValeur(f2.nom); }).join(' · ') + '</span></button>';
        }).join('') + '</div></div>';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }
  function choisirGlossaire(id){
    const ov = document.getElementById('glos-ov');
    if (ov) ov.remove();
    try {
      const mat = document.getElementById('esp-cp-matrice');
      if (mat && getComputedStyle(mat).display === 'none') toggleMatriceEspace();
    } catch (e) {}
    ouvrirCompDepuisCarte(id);
    setTimeout(function () {
      const f = document.getElementById('esp-cp-focus');
      if (f && f.innerHTML.trim()) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 90);
  }
  function marquerFait(id, el){
    try {
      if (checklistCtx) {
        checklistCtx.carte.jalons = checklistCtx.carte.jalons || {};
        checklistCtx.carte.jalons[id] = new Date().toISOString();
        majChecklist();
      }
      const jeton = new URLSearchParams(window.location.search).get('token') || '';
      if (jeton) fetch(PROGRESSION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'jalon', jeton: jeton, jalon: id }) }).catch(function () {});
    } catch (e) { console.warn('[Sinéa]', e); }
  }
  function majChecklist() {
    if (checklistCtx) { try { poserChecklist(checklistCtx.data, checklistCtx.carte); } catch (e) { console.warn('[Sinéa]', e); } }
  }

  // ===== Le pari du miroir : prédire le regard des autres avant de le recevoir =====
  const AXES_PARI = [['E', 'Aisance sociale'], ['A', 'Chaleur'], ['C', 'Rigueur'], ['S', 'Solidité'], ['O', 'Curiosité']];
  function pariMiroirHtml(mir){
    if (mir && mir.prediction) {
      const p = mir.prediction;
      return '<div class="pari-bloc pari-scelle"><div class="esp-cp-titre" role="heading" aria-level="3">Votre pronostic est scellé</div><p class="pari-p">Vous découvrirez votre score de lucidité dès trois regards reçus.</p><div class="pari-vals">'
        + AXES_PARI.map(function (a) { return '<span class="pari-val">' + a[1] + '<b>' + (typeof p[a[0]] === 'number' ? p[a[0]] : '·') + '</b></span>'; }).join('') + '</div></div>';
    }
    return '<div class="pari-bloc"><div class="esp-cp-titre" role="heading" aria-level="3">Avant leurs regards, le vôtre</div>'
      + '<p class="pari-p">Trente secondes, cinq curseurs, avant que leurs réponses n\'arrivent.</p>'
      + '<p class="pari-why"><b>Pourquoi un pronostic ?</b> Prédisez le regard de vos collègues avant leurs réponses. L\'écart entre votre prédiction et leur perception devient votre <b>score de lucidité</b> : vos angles morts et vos forces cachées, chiffrés.</p>'
      + '<button type="button" class="esp-rem-btn pari-open" onclick="this.nextElementSibling.classList.toggle(&quot;esp-hide&quot;)">Sceller mon pronostic · 30 s</button>'
      + '<div class="pari-corps esp-hide">'
      + AXES_PARI.map(function (a) {
        return '<div class="pari-l"><span>' + a[1] + '</span><input type="range" min="0" max="100" value="55" data-k="' + a[0] + '" class="pari-r" oninput="this.nextElementSibling.textContent=this.value"><b>55</b></div>';
      }).join('')
      + '<button type="button" class="esp-rem-btn" onclick="App.envoyerPariMiroir(this)">Sceller mon pari</button><p class="pari-etat"></p></div></div>';
  }
  function envoyerPariMiroir(btn){
    const mir = (carteEspaceCourant && carteEspaceCourant.miroir) || {};
    if (!mir.jeton) return;
    const prediction = {};
    btn.parentNode.querySelectorAll('.pari-r').forEach(function (i2) { prediction[i2.getAttribute('data-k')] = parseInt(i2.value, 10); });
    btn.disabled = true;
    btn.textContent = 'Scellement...';
    fetch(PROGRESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'miroir_prediction', jeton: mir.jeton, email: identite.email || undefined, prediction: prediction }),
    }).then(function (r2) { return r2.json(); }).then(function (d) {
      if (d && d.ok) {
        carteEspaceCourant.miroir.prediction = prediction;
        poserMiroir(dataEspaceCourant, carteEspaceCourant);
      } else {
        btn.disabled = false;
        btn.textContent = 'Sceller mon pari';
        const et = btn.parentNode.querySelector('.pari-etat');
        if (et) et.textContent = 'Le scellement a échoué, réessayez.';
      }
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Sceller mon pari';
    });
  }
  function filtrerMiroir(rel){
    filtreMiroirRel = rel === 'tous' ? null : rel;
    try { poserMiroir(dataEspaceCourant, carteEspaceCourant); } catch (e) { console.warn('[Sinéa]', e); }
  }

  function poserMiroir(data, carte) {
    carteEspaceCourant = carte;
    const slot = document.getElementById('espace-miroir');
    if (!slot || !identite.email) return;
    slot.innerHTML = '';
    const socle = (data && data.analyses && data.analyses.socle) || null;
    const na = socle && socle.profil && socle.profil.naturelAdapte;
    if (!na || !na.adapte) return;
    const mir = carte.miroir || {};
    const jeton = mir.jeton || '';
    const reponsesTous = mir.reponses || [];
    const reponses = filtreMiroirRel ? reponsesTous.filter(function (rp) { return (rp.r || {}).relation === filtreMiroirRel; }) : reponsesTous;
    if (!jeton) {
      // v137 : la création du lien passe en tête, seule action de l'écran.
      // Les messages restent en aperçu verrouillé tant que le lien n'existe pas.
      slot.innerHTML = `<div class="esp-rem esp-mir">
        <div class="esp-rem-kicker">Mon regard 360</div>
        <div class="esp-rem-titre" role="heading" aria-level="2">Le regard de vos collègues</div>
        <p class="esp-rem-txt">Invitez ${MIROIR_CHIFFRES.invites} collègues à répondre à un questionnaire de ${MIROIR_CHIFFRES.duree}, réponses anonymes. L'analyse s'ouvre dès ${MIROIR_CHIFFRES.seuil} réponses. Vous découvrez l'écart entre la perception des autres et votre propre lecture.</p>
        <button type="button" class="esp-rem-btn mir-cta-large" id="esp-mir-init">Créer mon lien d'invitation</button>
        ${guideMiroirHtml('')}
      </div>`;
      const b = document.getElementById('esp-mir-init');
      if (b) b.onclick = function () {
        b.disabled = true;
        fetch(PROGRESSION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'miroir_init', email: identite.email }),
        })
          .then(r => r.json())
          .then(d => {
            if (d && d.ok && d.jeton) { carte.miroir = { jeton: d.jeton, reponses: [], cree: (new Date()).toISOString().slice(0, 10) }; poserMiroir(data, carte); }
            else b.disabled = false;
          })
          .catch(function () { b.disabled = false; });
      };
      return;
    }
    const lien = location.origin + location.pathname + '?miroir=' + jeton;
    const pariHtml = pariMiroirHtml(mir);
    // v137 : le bouton du lien est nommé, le lien s'injecte dans les messages,
    // et le volet reste ouvert tant qu'aucune réponse n'est reçue.
    const lienHtml = `<div class="esp-mir-lien"><input type="text" class="esp-mir-input" id="esp-mir-input" value="${lien}" readonly /><button type="button" class="esp-rem-btn esp-mir-copie" id="esp-mir-copie" aria-live="polite">Copier le lien</button></div>`;
    const blocLien = lienHtml + guideMiroirHtml(lien);
    if (reponses.length < 3) {
      const attente = reponses.length === 2
        ? '2 réponses reçues. L\'analyse s\'ouvre à la troisième, pour préserver l\'anonymat.'
        : reponses.length === 1
          ? '1 réponse reçue. L\'analyse s\'ouvre à la troisième, pour préserver l\'anonymat.'
          : 'Aucune réponse pour l\'instant. Partagez ce lien avec ' + MIROIR_CHIFFRES.invites + ' collègues, leurs réponses restent anonymes. L\'analyse s\'ouvre à la troisième.';
      const n3 = reponses.length;
      const pastilles = [0, 1, 2].map(function (i2) { return '<i class="mirh-p' + (i2 < n3 ? ' ok' : '') + '"></i>'; }).join('');
      slot.innerHTML = `<div class="esp-rem esp-mir">
        <div class="mirh"><div class="esp-rem-kicker">Mon regard 360</div>
          <div class="mirh-ligne"><span class="mirh-n">${n3}<small> / 3</small></span><span class="mirh-ps">${pastilles}</span></div>
          <p class="mirh-txt">${attente}</p></div>
        <div class="mir-et"><u>ÉTAPE 1 · INVITER</u>${lienHtml}
          <details class="mir-msgs"${n3 === 0 ? ' open' : ''}><summary>Les trois messages prêts à envoyer, et à qui demander</summary>${guideMiroirHtml(lien)}</details></div>
        <div class="mir-et"><u>ÉTAPE 2 · VOTRE PRONOSTIC</u>${pariHtml}</div>
        ${c360Html()}
      </div>`;
    } else {
      const percu = agregerMiroir(reponses);
      const vous = { E: na.adapte.E, A: na.adapte.A, C: na.adapte.C, S: (typeof na.adapte.N === 'number' ? Math.round((100 - na.adapte.N) * 10) / 10 : undefined), O: na.adapte.O };
      let maxDim = null, maxGap = 0;
      const vousComp = window.Competences ? Competences.expressionDepuis(vous) : {};
      const tableau = [];
      MIROIR_QUESTIONS.forEach(function (q) {
        if (q.type === 'texte') return;
        const p = percu[q.d];
        const v = q.d.indexOf('c_') === 0 ? vousComp[q.d.slice(2)] : vous[q.d];
        if (p === undefined || v === undefined) return;
        const g = Math.round((p - v) * 10) / 10;
        if (Math.abs(g) > Math.abs(maxGap)) { maxGap = g; maxDim = q; }
        tableau.push({ q: q, p: p, v: v, g: g });
      });
      tableau.sort(function (a, b) { return Math.abs(b.g) - Math.abs(a.g); });
      const lignes = '<div class="esp-cp-titre" role="heading" aria-level="3" style="margin-top:4px">Tous les regards, du plus grand écart au plus petit</div>'
        + tableau.map(function (t, i) {
          const delta = (t.g > 0 ? '+' : '') + Math.round(t.g);
          return `<div class="esp-mir-row${i < 2 && Math.abs(t.g) >= 10 ? ' esp-mir-gapmax' : ''}" data-d="${t.q.d}"><span class="esp-mir-lab">${t.q.label}</span><span class="esp-mir-vals"><span class="esp-mir-col">Eux <b>${Math.round(t.p)}</b></span><span class="esp-mir-col">Vous <b>${Math.round(t.v)}</b></span><span class="esp-mir-delta${t.g >= 0 ? ' pos' : ' neg'}">${delta}</span></span></div>`;
        }).join('');
      const RELS_MIR = { manager: 'manager', pair: 'pair', n1: 'personne encadrée', autre: 'autre' };
      const compteRel = {};
      reponses.forEach(function (rp) { const k2 = (rp.r || {}).relation; if (k2) compteRel[k2] = (compteRel[k2] || 0) + 1; });
      const repartition = Object.keys(compteRel).length
        ? ' · ' + Object.entries(compteRel).map(function (e2) { return e2[1] + ' ' + (RELS_MIR[e2[0]] || e2[0]) + (e2[1] > 1 ? 's' : ''); }).join(', ')
        : '';
      const impactHtml = '<p class="esp-mir-impact"><b>Ce que ces regards changent.</b> Ils confrontent votre lecture à la réalité perçue, nourrissent votre brief côté RH, et affûtent vos priorités : les plus grands écarts ci-dessous sont vos meilleures pistes de travail.</p>';
      const relsPresentes = {};
      reponsesTous.forEach(function (rp) { const k3 = (rp.r || {}).relation; if (k3) relsPresentes[k3] = (relsPresentes[k3] || 0) + 1; });
      const relsFiltrables = Object.entries(relsPresentes).filter(function (e3) { return e3[1] >= 2; });
      const chipsRel = (reponsesTous.length >= 3 && relsFiltrables.length)
        ? '<div class="mir-filtres">' + [['tous', 'Tous (' + reponsesTous.length + ')']].concat(relsFiltrables.map(function (e3) { return [e3[0], (RELS_MIR[e3[0]] || e3[0]) + 's (' + e3[1] + ')']; })).map(function (p3) {
            return '<button type="button" class="mir-rel mir-filtre' + (((filtreMiroirRel || 'tous') === p3[0]) ? ' on' : '') + '" onclick="App.filtrerMiroir(&quot;' + p3[0] + '&quot;)">' + p3[1] + '</button>';
          }).join('') + '</div>'
        : '';
      const pariM = mir.prediction || null;
      let lucHtml = '';
      if (pariM && percu) {
        const axesLuc = ['E', 'A', 'C', 'S', 'O'].filter(function (k4) { return typeof pariM[k4] === 'number' && typeof percu[k4] === 'number'; });
        if (axesLuc.length >= 3) {
          const moyEcart = axesLuc.reduce(function (a2, k4) { return a2 + Math.abs(pariM[k4] - percu[k4]); }, 0) / axesLuc.length;
          const luc = Math.max(0, Math.round(100 - moyEcart));
          const lect = luc >= 85 ? 'Vous vous voyez comme ils vous voient : rare.' : (luc >= 70 ? 'Bonne lucidité, quelques nuances à explorer.' : 'De vraies surprises : la meilleure matière de travail.');
          lucHtml = '<div class="mir-luc"><span class="mir-luc-score">' + luc + '<i>/100</i></span><span class="mir-luc-lab">Lucidité · votre pari face à leur regard</span><span class="mir-luc-lect">' + lect + '</span></div>';
        }
      }
      const radarHtml = (window.Visuels && window.Visuels.radarMiroirSvg) ? Visuels.radarMiroirSvg(vous, percu, pariM) : '';
      const conseilsRecus = reponses.map(function (rep) { return String((rep.r || {}).conseil || '').trim(); }).filter(function (t) { return t.length > 2; }).slice(0, 6);
      const conseilsHtml = conseilsRecus.length
        ? '<div class="esp-cp-titre" role="heading" aria-level="3" style="margin-top:14px">Les conseils reçus</div>' + conseilsRecus.map(function (t) { return '<p class="esp-mir-conseil">« ' + echapValeur(t) + ' »</p>'; }).join('')
        : '';
      let phrase;
      if (Math.abs(maxGap) < 12) {
        phrase = 'Le regard de vos collègues rejoint votre propre lecture. Ce que vous pensez montrer, ils le voient : une belle cohérence entre intérieur et extérieur.';
      } else if (maxGap > 0) {
        phrase = `Vos collègues perçoivent davantage de ${maxDim.label.toLowerCase()} que ce que vous vous accordez. Vous montrez plus que vous ne le pensez : appuyez-vous dessus.`;
      } else {
        phrase = `Vos collègues perçoivent moins de ${maxDim.label.toLowerCase()} que ce que vous pensez montrer. Cet écart dit quelque chose de précieux, angle mort ou réserve : explorez-le lors d'un prochain échange.`;
      }
      slot.innerHTML = `<div class="esp-rem esp-mir">
        <div class="esp-rem-kicker">Mon regard 360 · ${reponses.length} regards${repartition}</div>
        <div class="esp-rem-titre" role="heading" aria-level="2">Vu par vos collègues, comparé à vous au travail</div>
        ${chipsRel}
        ${impactHtml}
        ${radarHtml}
        ${mir.prediction ? '' : pariHtml}
        ${lucHtml}
        ${lignes}
        ${conseilsHtml}
        <div class="esp-nea" style="margin-top:12px"><span class="esp-nea-img"><img src="Nea_detoure_full.png.webp" alt="Néa" onerror="this.style.display='none'"/></span><div class="esp-nea-txt"><div class="esp-nea-label">Néa · votre coach</div><p>${phrase}</p></div></div>
        ${reponses.length < 5 ? '<p class="esp-rem-txt" style="margin:12px 0 8px">Ajoutez d\'autres regards pour affiner :</p>' + blocLien : ''}
      </div>`;
    }
    const cop = document.getElementById('esp-mir-copie');
    if (cop) cop.onclick = function () {
      const inp = document.getElementById('esp-mir-input');
      const fini = function () { cop.textContent = 'Copié !'; setTimeout(function () { cop.textContent = 'Copier'; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lien).then(fini).catch(function () { if (inp) { inp.select(); document.execCommand('copy'); fini(); } });
      else if (inp) { inp.select(); document.execCommand('copy'); fini(); }
    };
    if (jeton) {
      try { slot.insertAdjacentHTML('beforeend', mirCroiseHtml(reponsesTous)); } catch (e) {}
      try { slot.insertAdjacentHTML('afterbegin', mirEtapesHtml(mir, reponsesTous)); } catch (e) {}
      if (navigator.share) { try { slot.querySelectorAll('.esp-mir-msg-btn').forEach(function (b2) { if (b2.textContent.indexOf('Copier') === 0) b2.textContent = 'Partager ce message'; }); } catch (e) {} }
    }
  }

  // Le fil des quatre étapes du Feedback 360, cliquable
  function mirEtapesHtml(mir, reponses){
    const n = reponses.length;
    const etapes = [
      { lab: 'Lien créé', ok: true, cible: '.esp-mir-msg' },
      { lab: 'Pronostic', ok: !!mir.prediction, cible: '__pari' },
      { lab: n + ' regard' + (n > 1 ? 's' : '') + ' / 3', ok: n >= 3, cible: '.esp-mir-msg' },
      { lab: 'Analyse', ok: n >= 3, cible: '.mir-luc' },
    ];
    return '<div class="mir-etapes">' + etapes.map(function (e2) {
      return '<button type="button" class="mir-et' + (e2.ok ? ' ok' : '') + '" onclick="App.mirAller(&quot;' + e2.cible + '&quot;)">' + (e2.ok ? '✓ ' : '') + e2.lab + '</button>';
    }).join('') + '</div>'
      + (n < 3 ? '<p class="mir-note">' + ageLienMiroir(mir) + 'Encore ' + (3 - n) + ' regard' + (3 - n > 1 ? 's' : '') + ' et votre analyse s\'ouvre. Un message suffit à relancer.</p>' : '');
  }
  function ageLienMiroir(mir){
    if (!mir.cree) return '';
    const jours = Math.floor((Date.now() - Date.parse(mir.cree)) / 86400000);
    if (!(jours >= 7)) return '';
    return 'Lien créé il y a ' + jours + ' jours. ';
  }
  function mirAller(cible){
    if (cible === '__pari') { allerFeedback('pari'); return; }
    const el = document.querySelector(cible);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }


  // ---- Le formulaire collègue : ouvert par lien ?miroir=jeton, sans compte ----
  function rendreFormMiroir(jeton) {
    _mirRep = {};
    const ov = document.createElement('div');
    ov.className = 'mir-page';
    const lignes = MIROIR_QUESTIONS.map(function (q) {
      if (q.type === 'texte') {
        return `<div class="mir-q mir-q-texte"><div class="mir-q-titre">${q.label}</div><p class="mir-q-txt">${q.texte}</p><textarea id="mir-conseil" class="mir-conseil" placeholder="Deux phrases suffisent, elles resteront anonymes dans l'agrégat..."></textarea></div>`;
      }
      return '<div class="esp-rem-q"><p class="esp-rem-q-txt">' + q.texte + '</p><div class="esp-rem-opts">' +
        [1, 2, 3, 4].map(function (v) { return '<button type="button" class="esp-rem-opt" data-q="' + q.d + '" data-v="' + v + '">' + MIROIR_ANCRES[v] + '</button>'; }).join('') +
        '</div></div>';
    }).join('');
    const relationHtml = '<div class="mir-q"><div class="mir-q-titre">Votre relation avec cette personne</div><div class="mir-rels">'
      + [['manager', 'Son manager'], ['pair', 'Un pair'], ['n1', 'Elle m' + String.fromCharCode(39) + 'encadre'], ['autre', 'Autre']].map(function (p2) {
        return '<button type="button" class="mir-rel" data-r="' + p2[0] + '" onclick="App.choisirRelMiroir(this)">' + p2[1] + '</button>';
      }).join('') + '</div></div>';
    ov.innerHTML = '<div class="mir-card">' +
      '<div class="mir-head"><span class="esp-nea-img"><img src="Nea_detoure_full.png.webp" alt="Néa" onerror="this.style.display=\'none\'"/></span>' +
      '<div><div class="esp-rem-kicker">Feedback 360 · Sinéa</div><div class="esp-rem-titre" role="heading" aria-level="2">Votre regard sur un collègue</div></div></div>' +
      '<p class="esp-rem-txt">Une personne de votre entourage professionnel vous invite à partager votre perception. Douze regards et un conseil, trois minutes. Vos réponses sont anonymes et agrégées avec celles d\'autres collègues.</p>' +
      relationHtml +
      lignes +
      '<button type="button" class="esp-rem-btn" id="mir-valider" disabled>Envoyer mon regard · 0/12</button>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('.esp-rem-opt').forEach(function (b) {
      b.onclick = function () {
        const q = this.getAttribute('data-q');
        _mirRep[q] = parseInt(this.getAttribute('data-v'), 10);
        ov.querySelectorAll('.esp-rem-opt[data-q="' + q + '"]').forEach(function (x) { x.classList.remove('on'); });
        this.classList.add('on');
        majValiderMiroir();
      };
    });
    const val = document.getElementById('mir-valider');
    if (val) val.onclick = function () {
      val.disabled = true;
      val.textContent = 'Envoi...';
      fetch(PROGRESSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'miroir_repondre', jeton: jeton, reponses: Object.assign({}, _mirRep, { conseil: ((document.getElementById('mir-conseil') || {}).value || '').trim() || undefined, relation: (function(){ const b = document.querySelector('.mir-rel.on'); return b ? b.getAttribute('data-r') : undefined; })() }) }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          const carteMerci = d && d.ok
            ? '<div class="mir-merci-sym">✦</div><div class="esp-rem-titre" role="heading" aria-level="2">Merci, votre regard compte.</div><p class="esp-rem-txt">Votre perception est enregistrée, anonyme, agrégée à partir de trois regards. Elle aidera votre collègue à se voir plus juste.</p>'
            : (d && d.raison === 'complet'
              ? '<div class="esp-rem-titre" role="heading" aria-level="2">Ce miroir est complet</div><p class="esp-rem-txt">Cette personne a déjà reçu le nombre maximal de regards. Merci pour votre intention.</p>'
              : '<div class="esp-rem-titre" role="heading" aria-level="2">Lien inconnu</div><p class="esp-rem-txt">Ce lien d\'invitation ne correspond à aucun profil. Demandez un nouveau lien à la personne qui vous a invité.</p>');
          ov.innerHTML = '<div class="mir-card">' + carteMerci + '</div>';
        })
        .catch(function () {
          val.disabled = false;
          val.textContent = 'Envoyer mon regard';
        });
    };
  }

  (function initMiroirInvite() {
    const m = location.search.match(/[?&]miroir=([a-f0-9]{16,32})/);
    if (!m) return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { rendreFormMiroir(m[1]); });
    else rendreFormMiroir(m[1]);
  })();

  // Nombre de questions par module (pour le taux de complétion)
  const NB_QUESTIONS = { socle: 60, commercial: 36, manager: 36 };

  // Phrases d'accueil par archétype précis (ton inspirant + chaleureux, affirmatif)
  const ACCUEIL_ARCHETYPE = {
    "tisseuse": "Votre talent pour créer du lien et faire tenir les liens ensemble se lit déjà dans votre portrait.",
    "passeur": "Votre art de relier les personnes et de transmettre transparaît dans votre portrait.",
    "roc": "Votre présence solide, celle sur qui les autres s'appuient, éclaire votre portrait.",
    "diplomate": "Votre finesse pour accorder les points de vue donne sa couleur à votre portrait.",
    "ambassadeur": "Votre talent pour porter haut les idées et rassembler se révèle dans votre portrait.",
    "capitaine": "Votre capacité à mener et à donner le cap transparaît dans votre portrait.",
    "indomptable": "Votre énergie qui ouvre la voie et ose se lit déjà dans votre portrait.",
    "champion": "Votre élan, ce moteur qui entraîne les autres vers le résultat, éclaire votre portrait.",
    "pionnier": "Votre goût d'explorer et d'ouvrir des chemins neufs donne sa couleur à votre portrait.",
    "resilient": "Votre force tranquille, celle qui rebondit et tient dans la durée, se révèle dans votre portrait.",
    "architecte": "Votre sens de la structure et de la vision d'ensemble transparaît dans votre portrait.",
    "sentinelle": "Votre vigilance attentive, celle qui protège et anticipe, se lit dans votre portrait.",
    "gardien": "Votre sens de la justesse et de la solidité éclaire votre portrait.",
    "orfevre": "Votre exigence du détail juste et du travail bien fait donne sa couleur à votre portrait.",
    "stratege": "Votre capacité à lire loin et à poser les bons coups transparaît dans votre portrait.",
    "conteur": "Votre talent pour donner du sens et embarquer par le récit se révèle dans votre portrait.",
    "etincelle": "Votre énergie créative, celle qui allume les idées, se lit déjà dans votre portrait.",
    "veilleur": "Votre regard qui perçoit les signaux faibles avant les autres éclaire votre portrait.",
    "explorateur": "Votre curiosité qui repousse les horizons donne sa couleur à votre portrait.",
    "revelateur": "Votre don pour faire émerger le potentiel des autres se révèle dans votre portrait.",
  };

  // Phrases d'accueil adaptées à la famille de l'archétype (repli si l'archétype n'est pas listé)
  const ACCUEIL_FAMILLE = {
    RELATION: "Votre talent pour relier les autres se lit déjà dans votre portrait.",
    ACTION: "Votre énergie et votre élan transparaissent dans votre portrait.",
    STRUCTURE: "Votre sens de la justesse et de la solidité éclaire votre portrait.",
    VISION: "Votre regard tourné vers l'horizon donne sa couleur à votre portrait.",
  };
  // Sous-phrase selon l'avancement
  function deduireDroits(declares, analyses) {
    let txt = String(declares || '').toLowerCase();
    try {
      ['socle', 'commercial', 'manager'].forEach(function (m) {
        if (analyses && analyses[m] && txt.indexOf(m) < 0) txt += (txt ? ',' : '') + m;
      });
    } catch (e) {}
    return txt;
  }

  function phraseAvancement(analyses, droitsTxt) {
    const aModuleDispo = (droitsTxt.includes('commercial') && !analyses.commercial) || (droitsTxt.includes('manager') && !analyses.manager);
    const toutFait = analyses.socle && (!droitsTxt.includes('commercial') || analyses.commercial) && (!droitsTxt.includes('manager') || analyses.manager);
    if (toutFait) return "Votre parcours est complet. Explorez vos analyses quand vous le souhaitez.";
    if (analyses.socle && aModuleDispo) return "Une exploration de plus vous attend pour révéler comment votre nature s'exprime au travail.";
    if (!analyses.socle) return "Votre première exploration vous attend.";
    return "Continuez votre parcours à votre rythme.";
  }

  function renderEspace(data) {
    dataEspaceCourant = data;
    const prenom = data.prenom || identite.prenom || '';
    // Filet : si le serveur renvoie l'email, on le re-mémorise. Garantit que le plan
    // d'action et les autres actions de l'espace ont toujours un email valide à utiliser.
    if (data.email && !identite.email) identite.email = data.email;
    const analyses = data.analyses || {};
    // archétype : depuis le champ Airtable, ou à défaut depuis le profil de l'analyse socle
    let archetype = data.archetype || '';
    let famille = data.famille || '';
    if ((!archetype) && analyses.socle && analyses.socle.profil && analyses.socle.profil.dominante) {
      archetype = analyses.socle.profil.dominante.nom || '';
      famille = analyses.socle.profil.dominante.famille || '';
    }
    monArchetype = archetype; // retenu pour situer la personne dans le codex
    // Les droits déclarés peuvent manquer quand une sauvegarde s'est interrompue.
    // Une analyse présente en base prouve le droit mieux qu'un champ déclaratif :
    // on complète donc les droits par ce que la personne a réellement passé.
    const droitsTxt = deduireDroits(data.droits || droits || '', analyses);
    const progression = data.progression || {};

    document.getElementById('espace-name').textContent = 'Bonjour ' + prenom;

    // Phrase d'accueil adaptée à la famille + avancement
    const accueilEl = document.getElementById('espace-accueil');
    if (accueilEl) {
      const famKey = (famille || '').toUpperCase();
      // priorité à la phrase par archétype précis, repli sur la famille
      const phraseFam = ACCUEIL_ARCHETYPE[SINEA_DATA.slug(archetype)] || ACCUEIL_FAMILLE[famKey] || "Voici votre espace personnel, le reflet de votre singularité.";
      const phraseAv = phraseAvancement(analyses, droitsTxt);
      accueilEl.innerHTML = `<span class="espace-accueil-fam">${phraseFam}</span> <span class="espace-accueil-av">${phraseAv}</span>`;
      // v138 : le bandeau du plan se remplit à l'arrivée de la carte, voir poserBandeauJour.
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
      if (total <= 1){
        progGlobalEl.innerHTML = '';
        progGlobalEl.style.display = 'none';
      } else {
        const suite = faits >= total ? 'parcours complet' : 'la spécialisation métier vous attend';
        progGlobalEl.innerHTML = `
          <div class="espace-pg-head"><span>Votre parcours</span><span>${faits}/${total} · ${suite}</span></div>
          <div class="espace-pg-bar"><div class="espace-pg-fill" style="width:${pctGlobal}%"></div></div>`;
      }
    }

    // afficher le personnage de l'archétype dans l'en-tête
    const persoEl = document.getElementById('espace-hero-perso');
    if (persoEl) {
      const slugImg = archetype ? SINEA_DATA.image(archetype) : '';
      if (slugImg) {
        persoEl.innerHTML = `<img src="${srcPerso(slugImg)}" alt="${archetype}" onerror="${onerrPerso(slugImg)}" />`;
        persoEl.style.display = 'block';
      } else {
        persoEl.style.display = 'none';
      }
    }
    const heroFam = document.getElementById('espace-hero');
    if (heroFam) heroFam.style.setProperty('--fam', famille === 'RELATION' ? '#F98272' : famille === 'ACTION' ? '#F5A623' : famille === 'STRUCTURE' ? '#3EADFF' : '#5E59C7');
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
      resultatsHtml = '<div class="espace-label" role="heading" aria-level="2">Mes résultats</div>';
      faits.forEach(m => { resultatsHtml += carteResultat(m, (analyses[m] && analyses[m].date) || '', archetype); });
    }
    if (analyses.socle) {
      resultatsHtml += `<button class="espace-pdf-lien" id="espace-pdf-btn" onclick="App.telechargerPortraitEspace()">Télécharger mon portrait complet (PDF)</button>`;
    }
    // Fiche connue, aucune analyse retrouvée : le dire clairement plutôt que
    // de renvoyer la personne vers une passation qu'elle a peut-être déjà faite.
    if (!faits.length && data.found !== false && (data.prenom || data.archetype || (data.progression && Object.keys(data.progression).length))) {
      resultatsHtml = '<div class="esp-vide"><div class="esp-vide-k">Portrait introuvable</div>'
        + '<p>Votre compte existe bien, et nous ne retrouvons aucun portrait enregistré. Une passation interrompue en est la cause la plus fréquente.</p>'
        + '<p class="esp-vide-p">Avant de tout recommencer, écrivez-nous à <a href="mailto:contact@sineaformation.fr">contact@sineaformation.fr</a>, vos réponses sont souvent récupérables.</p></div>';
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
      parcoursHtml = '<div class="espace-label" role="heading" aria-level="2">Votre parcours</div>' + cards.join('');
    }
    const codexCta = '<div class="espace-label" role="heading" aria-level="2">Explorer</div>' +
      '<button class="espace-codex-btn" id="espace-codex-btn">' +
        '<span class="espace-codex-ic">✦</span>' +
        '<span class="espace-codex-txt"><span class="espace-codex-t">Le codex des personnages</span>' +
        '<span class="espace-codex-d">Découvrez les vingt archétypes, par famille.</span></span>' +
        '<span class="espace-codex-arr">→</span>' +
      '</button>';
    document.getElementById('espace-cards').innerHTML = parcoursHtml + codexCta;

    // Compatibilités d'équipe (si on connaît la famille de la personne)
    const compatEl = document.getElementById('espace-compat');
    const compatGridEl = document.getElementById('espace-compat-grid');
    if (compatEl && compatGridEl && famille && window.Result && Result.htmlCompatibilites) {
      const html = Result.htmlCompatibilites(famille);
      if (html) { compatGridEl.innerHTML = html; compatEl.style.display = 'block'; }
    }

    // câbler les boutons
    document.querySelectorAll('[data-revoir]').forEach(b => { b.onclick = () => revoirAnalyse(b.getAttribute('data-revoir')); });
    document.querySelectorAll('[data-plan]').forEach(b => { b.onclick = () => ouvrirPlanAction(b.getAttribute('data-plan')); });
    const codexBtn = document.getElementById('espace-codex-btn');
    if (codexBtn) codexBtn.onclick = () => ouvrirCodex();
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

  // ===== Le codex des personnages : encyclopédie des vingt archétypes =====
  function ouvrirCodex() {
    let scr = document.getElementById('screen-codex');
    if (!scr) { scr = document.createElement('section'); scr.id = 'screen-codex'; scr.className = 'screen'; (document.querySelector('.app') || document.body).appendChild(scr); }
    const persos = (SINEA_DATA && SINEA_DATA.personnages) || {};
    const contenu = (SINEA_DATA && SINEA_DATA.contenu) || {};
    const profils = (SINEA_DATA && SINEA_DATA.profils) || {};
    const couleurDe = (fam) => ({ RELATION: '#F98272', ACTION: '#F5A623', STRUCTURE: '#3EADFF', VISION: '#5E59C7' }[(fam || '').toUpperCase()] || '#5E59C7');
    const labelDe = (fam) => ({ RELATION: 'Relation', ACTION: 'Action', STRUCTURE: 'Structure', VISION: 'Vision' }[(fam || '').toUpperCase()] || '');

    // la famille de la personne passe en tête
    let maFamille = '';
    for (const k in persos) { if (persos[k].nom === monArchetype) { maFamille = (persos[k].famille || '').toUpperCase(); break; } }
    const famillesBase = [
      { id: 'RELATION', label: 'Relation', desc: 'Celles et ceux qui tissent le lien.' },
      { id: 'ACTION', label: 'Action', desc: 'Celles et ceux qui font avancer.' },
      { id: 'STRUCTURE', label: 'Structure', desc: 'Celles et ceux qui bâtissent et sécurisent.' },
      { id: 'VISION', label: 'Vision', desc: 'Celles et ceux qui éclairent le cap.' },
    ];
    const familles = famillesBase.slice().sort((a, b) => (b.id === maFamille ? 1 : 0) - (a.id === maFamille ? 1 : 0));

    // signature Big Five en mini-barres
    const dims = [['Extraversion', 'E'], ['Agréabilité', 'A'], ['Rigueur', 'C'], ['Stabilité', 'S'], ['Ouverture', 'O']];
    function signatureBars(nom) {
      const bf = profils[nom]; if (!bf) return '';
      const val = { E: bf.E, A: bf.A, C: bf.C, S: 100 - (bf.N || 50), O: bf.O };
      return '<div class="codex-sig">' + dims.map(d => {
        const v = Math.max(0, Math.min(100, val[d[1]] || 0));
        return '<div class="codex-sig-row"><span class="codex-sig-lab">' + d[0] + '</span><span class="codex-sig-bar"><span style="width:' + v + '%"></span></span></div>';
      }).join('') + '</div>';
    }

    // fiche détaillée d'un archétype
    function ficheHtml(slug) {
      const p = persos[slug]; if (!p) return '';
      const c = contenu[slug] || {};
      const coul = couleurDe(p.famille);
      const slugImg = SINEA_DATA.image(p.nom);
      const img = slugImg ? '<img src="' + srcPerso(slugImg) + '" alt="' + echapValeur(p.nom) + '" onerror="' + onerrPerso(slugImg) + '"/>' : '';
      const forces = (c.forces || []).slice(0, 3).map(f => '<li>' + echapValeur(f) + '</li>').join('');
      const cm = c.complementarites || {};
      const allies = (cm.matche || []).map(n => '<span class="codex-rel-chip">' + echapValeur(n) + '</span>').join('');
      const frics = (cm.friction || []).map(n => '<span class="codex-rel-chip">' + echapValeur(n) + '</span>').join('');
      const estMoi = (p.nom === monArchetype);
      const famLine = labelDe(p.famille) + (p.verbe ? ' · ' + echapValeur(p.verbe) : '');
      return '<div class="codex-fiche" style="--cf:' + coul + '">' +
        '<button class="codex-fiche-x" id="codex-fiche-x" aria-label="Fermer">×</button>' +
        '<div class="codex-fiche-top">' +
          '<div class="codex-fiche-img">' + img + '</div>' +
          (estMoi ? '<div class="codex-moi-badge codex-moi-badge-fiche">Le vôtre</div>' : '') +
          '<div class="codex-fiche-fam">' + famLine + '</div>' +
          '<h3 class="codex-fiche-nom">' + echapValeur(p.nom) + '</h3>' +
          (p.axe ? '<p class="codex-fiche-axe">' + echapValeur(p.axe) + '</p>' : '') +
        '</div>' +
        (c.essence ? '<p class="codex-fiche-essence">' + echapValeur(c.essence) + '</p>' : '') +
        (SINEA_DATA.embleme(p.nom) ? '<div class="codex-fiche-embleme"><span class="codex-emb-ic" style="color:' + ({RELATION:'#F98272',ACTION:'#F5A623',STRUCTURE:'#3EADFF',VISION:'#5E59C7'}[(p.famille||'').toUpperCase()]||'#5E59C7') + '">' + SINEA_DATA.embleme(p.nom).svg + '</span><div class="codex-emb-txt"><span class="codex-emb-objet">Emblème, ' + echapValeur(SINEA_DATA.embleme(p.nom).objet) + '</span><span class="codex-emb-phrase">' + echapValeur(SINEA_DATA.embleme(p.nom).phrase) + '</span></div></div>' : '') +
        (profils[p.nom] ? '<div class="codex-fiche-bloc"><div class="codex-fiche-lab">Sa signature</div>' + signatureBars(p.nom) + '</div>' : '') +
        (forces ? '<div class="codex-fiche-bloc"><div class="codex-fiche-lab">Ce qu\'il apporte</div><ul class="codex-fiche-ul">' + forces + '</ul></div>' : '') +
        ((allies || frics) ? '<div class="codex-fiche-rel">' +
          (allies ? '<div class="codex-rel-col codex-rel-allies"><div class="codex-fiche-lab">Alliés naturels</div><div class="codex-rel-chips">' + allies + '</div>' + (cm.pourquoi_matche ? '<p class="codex-rel-why">' + echapValeur(cm.pourquoi_matche) + '</p>' : '') + '</div>' : '') +
          (frics ? '<div class="codex-rel-col codex-rel-frics"><div class="codex-fiche-lab">Points de friction</div><div class="codex-rel-chips">' + frics + '</div>' + (cm.pourquoi_friction ? '<p class="codex-rel-why">' + echapValeur(cm.pourquoi_friction) + '</p>' : '') + '</div>' : '') +
        '</div>' : '') +
      '</div>';
    }

    let html = '<div class="codex-scroll">' +
      '<button class="plan-retour" id="codex-retour">← Mon espace</button>' +
      '<div class="codex-head"><div class="codex-kicker">Le codex</div>' +
      '<h1 class="codex-titre">Les vingt personnages</h1>' +
      '<p class="codex-sub">Quatre familles, vingt façons d\'incarner sa singularité au travail. Touchez un personnage pour le découvrir.</p></div>';
    familles.forEach(fam => {
      const coul = couleurDe(fam.id);
      const membres = Object.keys(persos).filter(k => (persos[k].famille || '').toUpperCase() === fam.id);
      if (!membres.length) return;
      const estMaFamille = (fam.id === maFamille);
      html += '<div class="codex-fam' + (estMaFamille ? ' codex-fam-moi' : '') + '" style="--cf:' + coul + ';">' +
        '<div class="codex-fam-head"><span class="codex-fam-dot"></span>' +
        '<div><div class="codex-fam-nom">' + fam.label + (estMaFamille ? ' <span class="codex-fam-tag">votre famille</span>' : '') + '</div>' +
        '<div class="codex-fam-desc">' + fam.desc + '</div></div></div>' +
        '<div class="codex-grid">';
      membres.forEach(k => {
        const p = persos[k];
        const slugImg = SINEA_DATA.image(p.nom);
        const imgTag = slugImg ? '<img src="' + srcPerso(slugImg) + '" alt="' + echapValeur(p.nom) + '" loading="lazy" onerror="' + onerrPerso(slugImg) + '"/>' : '';
        const estMoi = (p.nom === monArchetype);
        html += '<div class="codex-card' + (estMoi ? ' codex-card-moi' : '') + '" data-slug="' + k + '">' +
          (estMoi ? '<div class="codex-moi-badge">Le vôtre</div>' : '') +
          '<div class="codex-card-img">' + imgTag + '</div>' +
          '<div class="codex-card-nom">' + echapValeur(p.nom) + '</div>' +
          (p.verbe ? '<div class="codex-card-verbe">' + echapValeur(p.verbe) + '</div>' : '') +
          (p.axe ? '<p class="codex-card-axe">' + echapValeur(p.axe) + '</p>' : '') +
          '<span class="codex-card-plus">Découvrir</span>' +
        '</div>';
      });
      html += '</div></div>';
    });
    html += '<div class="codex-fiche-ov" id="codex-fiche-ov"></div>';
    html += '</div>';
    scr.innerHTML = html;
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    window.scrollTo(0, 0);

    const retour = document.getElementById('codex-retour');
    if (retour) retour.onclick = () => { scr.classList.remove('active'); goToEspace(); };

    // fiche au clic
    const ov = document.getElementById('codex-fiche-ov');
    const fermerFiche = () => { ov.classList.remove('on'); setTimeout(() => { ov.innerHTML = ''; }, 280); };
    const ouvrirFiche = (slug) => {
      ov.innerHTML = ficheHtml(slug);
      ov.scrollTop = 0;
      requestAnimationFrame(() => ov.classList.add('on'));
      const x = document.getElementById('codex-fiche-x');
      if (x) x.onclick = fermerFiche;
    };
    ov.addEventListener('click', (e) => { if (e.target === ov) fermerFiche(); });
    scr.querySelectorAll('.codex-card').forEach(b => b.onclick = () => ouvrirFiche(b.getAttribute('data-slug')));
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
    const slug = archetype ? SINEA_DATA.image(archetype) : '';
    const persoHtml = (mod === 'socle' && slug) ? `<div class="esp-res-perso"><img src="${srcPerso(slug)}" alt="${archetype}" loading="lazy" decoding="async" width="512" height="512" onerror="${onerrPerso(slug)}"/></div>` : '';
    return `<div class="esp-resultat">
      <div class="esp-res-glow"></div>
      <div class="esp-res-in">
        <div class="esp-res-texte">
          <div class="esp-res-badge">Complété · 100%</div>
          <div class="esp-res-title" role="heading" aria-level="3">${l.titre}</div>
          ${dateLigne}
          <div class="esp-res-actions">
            <button class="esp-res-btn" data-revoir="${mod}">Lire mon analyse</button>
            <button class="esp-res-btn esp-res-btn-plan esp-res-btn-sec" data-plan="${mod}">Mon plan d'action</button>
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
        <div class="esp-body"><span class="esp-status esp-st-go">À découvrir</span><div class="esp-title" role="heading" aria-level="3">${l.titre}</div><div class="esp-sub">${l.sub}</div></div>
        <button class="esp-btn esp-btn-purple" data-commencer="${mod}">Commencer</button>
      </div>`;
    }
    if (etat === 'encours') {
      return `<div class="esp-card">
        <div class="esp-icon esp-ic-go">▷</div>
        <div class="esp-body">
          <span class="esp-status esp-st-go">En cours · ${pct}%</span>
          <div class="esp-title" role="heading" aria-level="3">${l.titre}</div>
          <div class="esp-progress"><div class="esp-progress-fill" style="width:${pct}%"></div></div>
        </div>
        <button class="esp-btn esp-btn-purple" data-commencer="${mod}">Continuer</button>
      </div>`;
    }
    if (etat === 'attente') {
      return `<div class="esp-card esp-locked">
        <div class="esp-icon esp-ic-lock">◔</div>
        <div class="esp-body"><span class="esp-status esp-st-lock">Bientôt</span><div class="esp-title" role="heading" aria-level="3">${l.titre}</div><div class="esp-lock-note">Disponible après votre portrait de personnalité.</div></div>
      </div>`;
    }
    return `<div class="esp-card esp-locked">
      <div class="esp-icon esp-ic-lock">🔒</div>
      <div class="esp-body"><span class="esp-status esp-st-lock">Verrouillé</span><div class="esp-title" role="heading" aria-level="3">${l.titre}</div><div class="esp-lock-note">Ce module n'est pas inclus dans votre accès. Trente et une questions, un style dominant et trois dimensions métier.</div>
      <a class="esp-lock-btn" href="mailto:contact@sineaformation.fr?subject=${encodeURIComponent('Demande d\'accès au module ' + l.titre)}&body=${encodeURIComponent('Bonjour,\n\nJe souhaite activer le module « ' + l.titre + ' » sur mon espace Sinéa Profile.\n\nMerci de me dire comment procéder.\n')}">Demander cet accès</a></div>
    </div>`;
  }

  // ---- PLAN D'ACTION : page dédiée dans l'espace perso ----
  // Recharge le profil (pour personnaliser) + les interactions (ce que la personne a coché),
  // puis met en page une feuille de route motivante, du socle vers l'action.
  // La synthèse vivante du plan : l'avancement d'un regard, mis à jour à chaque clic
  function majPlanSynthese(scr){
    const zone = scr.querySelector('#plan-synth');
    if (!zone) return;
    const statuts = Array.from(scr.querySelectorAll('.plan-statut')).map(function (b) { return b.textContent.trim().toLowerCase(); });
    const total = statuts.length;
    if (!total) { zone.innerHTML = ''; return; }
    const acquis = statuts.filter(function (x) { return x.indexOf('fait') === 0; }).length;
    const cours = statuts.filter(function (x) { return x.indexOf('cours') >= 0; }).length;
    const faire = total - acquis - cours;
    const pct = Math.round((acquis / total) * 100);
    zone.innerHTML = '<div class="plan-synth-tete"><b>' + acquis + ' fait' + (acquis > 1 ? 's' : '') + '</b><span>' + cours + ' en cours · ' + faire + ' à venir</span><i>' + pct + '%</i></div>'
      + '<div class="plan-synth-bar"><i style="width:' + pct + '%"></i></div>';
  }
  function soignerPlan(scr){
    const hero = scr.querySelector('.plan-hero');
    if (hero && !scr.querySelector('#plan-synth')) hero.insertAdjacentHTML('afterend', '<div id="plan-synth" class="plan-synth"></div>');
    majPlanSynthese(scr);
    if (!scr.__synthEcoute) {
      scr.__synthEcoute = true;
      scr.addEventListener('click', function (e) {
        const bs = e.target.closest && e.target.closest('.plan-statut');
        if (bs) setTimeout(function () {
          majPlanSynthese(scr);
          if (bs.textContent.trim().indexOf('Fait') === 0) {
            const pcF = bs.closest('.planc');
            if (pcF) { pcF.classList.add('planc-fete'); setTimeout(function () { pcF.classList.remove('planc-fete'); }, 950); }
          }
        }, 30);
      });
    }
    if (!scr.__synthObs) {
      scr.__synthObs = new MutationObserver(function () {
        if (!scr.querySelector('#plan-synth')) {
          const h2 = scr.querySelector('.plan-hero');
          if (h2) { h2.insertAdjacentHTML('afterend', '<div id="plan-synth" class="plan-synth"></div>'); majPlanSynthese(scr); }
        }
      });
      scr.__synthObs.observe(scr, { childList: true, subtree: true });
    }
  }

  function ouvrirPlanAction(mod) {
    // On prépare tout de suite l'écran pour ne JAMAIS laisser un écran vide, même en cas de souci.
    let scr = document.getElementById('screen-plan');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-plan';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    // si on n'a pas d'email (session incomplète), on l'explique au lieu de ne rien afficher
    if (!identite.email) {
      scr.innerHTML = '<div class="plan-scroll">' +
        '<button class="plan-retour" id="plan-retour">← Mon espace</button>' +
        '<div class="plan-vide-card"><p>Pour préparer votre plan d\'action, reconnectez-vous à votre espace.</p>' +
        '<button class="btn-primary" id="plan-go-espace">Retour à mon espace</button></div></div>';
      activerScreenPlan(scr, mod);
      const b = document.getElementById('plan-go-espace');
      if (b) b.onclick = () => { scr.classList.remove('active'); goToEspace(); };
      return;
    }
    // écran de chargement immédiat (la personne voit qu'il se passe quelque chose)
    scr.innerHTML = '<div class="plan-scroll">' +
      '<button class="plan-retour" id="plan-retour">← Mon espace</button>' +
      '<div class="plan-loading" id="plan-loading"><div class="plan-loading-spin"></div>' +
      '<p>Nous rassemblons votre profil et vos choix...</p></div></div>';
    activerScreenPlan(scr, mod);
    // On force l'envoi immédiat des dernières cases cochées (le cochage a un délai de
    // sauvegarde de 1,5s ; sans ça, ouvrir le plan trop vite chargerait des données
    // incomplètes). Puis on laisse un court instant au serveur avant de relire.
    if (window.Result && Result.sauvegarderInteractionsImmediat) {
      try { Result.sauvegarderInteractionsImmediat(); } catch (e) { console.warn("[Sinéa]", e); }
    }
    setTimeout(() => chargerEtAfficherPlan(mod, scr), 700);
  }

  function chargerEtAfficherPlan(mod, scr) {
    // on charge en parallèle l'analyse (profil), les interactions (choix) et le suivi sauvegardé
    Promise.all([
      fetch(PROGRESSION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'load_analyse', email: identite.email }) }).then(r => r.json()).catch(() => ({})),
      fetch(PROGRESSION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'load_interactions', email: identite.email }) }).then(r => r.json()).catch(() => ({})),
      fetch(PROGRESSION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'load_plan_suivi', email: identite.email }) }).then(r => r.json()).catch(() => ({}))
    ]).then(function (res) {
      const analyses = (res[0] && res[0].analyses) || {};
      const interactionsTout = (res[1] && res[1].interactions) || {};
      const suiviTout = (res[2] && res[2].suivi_plan) || {};
      const profil = (analyses[mod] && analyses[mod].profil) || (analyses.socle && analyses.socle.profil) || {};
      const inter = interactionsTout[mod] || interactionsTout.socle || {};
      const suiviSauve = (suiviTout[mod] && suiviTout[mod].suivi) || [];
      const aCoches = (it) => { const x = it || {}; return ((x.forces_libelles || x.forces_validees || []).length + (x.vigilances_libelles || []).length + (x.leviers_libelles || []).length) > 0; };
      const modsDispo = ['socle', 'commercial', 'manager'].filter((m2) => aCoches(interactionsTout[m2]));
      afficherPagePlan(mod, profil, inter, suiviSauve, modsDispo);
      try { soignerPlan(scr); } catch (e) { console.warn('[Sinéa]', e); }
    }).catch(function () {
      // au lieu d'une alerte, message clair dans la page + bouton réessayer
      scr.innerHTML = '<div class="plan-scroll">' +
        '<button class="plan-retour" id="plan-retour">← Mon espace</button>' +
        '<div class="plan-vide-card"><p>Le chargement de votre plan d\'action a échoué. Vérifiez votre connexion et réessayez.</p>' +
        '<button class="btn-primary" id="plan-retry">Réessayer</button></div></div>';
      activerScreenPlan(scr, mod);
      const rt = document.getElementById('plan-retry');
      if (rt) rt.onclick = () => ouvrirPlanAction(mod);
    });
  }

  function afficherPagePlan(mod, profil, inter, suiviSauve, modsDispo) {
    let scr = document.getElementById('screen-plan');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-plan';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    const archetype = (profil.dominante && profil.dominante.nom) || '';
    const famille = (profil.dominante && profil.dominante.famille) || 'VISION';
    const slug = archetype ? SINEA_DATA.image(archetype) : '';

    // données issues des choix de la personne
    const forces = (inter.forces_libelles && inter.forces_libelles.length) ? inter.forces_libelles : (inter.forces_validees || []);
    const vigilances = (inter.vigilances_libelles && inter.vigilances_libelles.length) ? inter.vigilances_libelles : [];
    const objectifs = (inter.leviers_libelles && inter.leviers_libelles.length) ? inter.leviers_libelles : [];
    const ouvertes = inter.reponses_ouvertes || {};
    const projection = (ouvertes.q3 || '').trim();
    const defiPro = (ouvertes.qm1 || ouvertes.qc1 || '').trim();
    // les mots de la personne enrichissent l'IA en contexte, sans devenir des objectifs bruts
    const contexte = [projection, defiPro].filter(Boolean).join(' ');

    const couleurFam = (famille === 'RELATION' ? '#F98272' : famille === 'ACTION' ? '#F5A623' : famille === 'STRUCTURE' ? '#3EADFF' : '#5E59C7');

    // en-tête (toujours affiché)
    const heroHtml =
      '<button class="plan-retour" id="plan-retour">← Mon espace</button>' +
      '<div class="plan-hero" style="--pf1:' + couleurFam + ';">' +
        (slug ? '<div class="plan-hero-img"><img src="' + srcPerso(slug) + '" alt="' + echapValeur(archetype) + '" onerror="' + onerrPerso(slug) + '"/></div>' : '') +
        '<div class="plan-hero-kicker">Mon plan des 90 jours</div>' +
        '<h1 class="plan-hero-titre">Un seul plan, toutes vos analyses</h1>' +
        (archetype ? '<p class="plan-hero-sub">Taillé pour ' + echapValeur(archetype) + ' que vous êtes. Voici par où commencer.</p>' : '<p class="plan-hero-sub">Voici par où commencer.</p>') +
      '</div>' +
      ((modsDispo && modsDispo.length > 1) ? ('<div class="plan-src-tabs">' + modsDispo.map(function (m2) { return '<button type="button" class="plan-src-tab' + (m2 === mod ? ' actif' : '') + '" onclick="App.ouvrirPlanDepuisResto(\'' + m2 + '\')">' + m2.toUpperCase() + '</button>'; }).join('') + '</div>') : '');

    // si rien coché : message d'invitation, pas d'appel IA
    const rien = !forces.length && !vigilances.length && !objectifs.length;
    if (rien) {
      scr.innerHTML = '<div class="plan-scroll">' + heroHtml +
        '<div class="plan-vide-card"><p>Votre plan d\'action se construit au fil de votre lecture. Retournez à votre analyse, cochez les forces qui vous parlent, les points à travailler et les leviers à explorer : ils se rassembleront ici, prêts à vous accompagner.</p>' +
        '<button class="btn-primary" data-revoir="' + mod + '">Revenir à mon analyse</button></div></div>';
      activerScreenPlan(scr, mod);
      return;
    }

    // état de chargement pendant la génération IA
    scr.innerHTML = '<div class="plan-scroll">' + heroHtml +
      '<div class="plan-loading" id="plan-loading">' +
        '<div class="plan-loading-spin"></div>' +
        '<p>Votre coach prépare votre feuille de route, des objectifs concrets taillés pour vous...</p>' +
      '</div></div>';
    activerScreenPlan(scr, mod);

    // appel à l'IA pour générer les objectifs SMART
    const thematique = (window.SINEA_THEME || '');
    fetch(API_BASE + '/plan_action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profil: profil, forces: forces, vigilances: vigilances, objectifs: objectifs, thematique: thematique, contexte: contexte }),
    })
      .then(r => r.json())
      .then(data => {
        let actions = (data && data.actions) || [];
        const synthese = (data && data.synthese) || '';
        // si l'IA renvoie une liste vide ou une erreur, on affiche au moins
        // les elements coches, pour que le plan ne soit jamais vide
        if (!actions.length) {
          actions = construireReplisPlan(forces, vigilances, objectifs);
          signalerRepliPlan(mod);
        }
        rendrePlanActions(scr, mod, heroHtml, fusionnerSuivi(actions, suiviSauve), synthese);
      })
      .catch(() => {
        // repli : si l'IA échoue, on affiche au moins les éléments cochés
        const repli = construireReplisPlan(forces, vigilances, objectifs);
        rendrePlanActions(scr, mod, heroHtml, fusionnerSuivi(repli, suiviSauve), '');
        signalerRepliPlan(mod);
      });
  }

  // Réinjecte le statut et le ressenti déjà saisis (par objectif) dans les actions affichées.
  function fusionnerSuivi(actions, suiviSauve) {
    if (!suiviSauve || !suiviSauve.length) return actions;
    const parObjectif = {};
    suiviSauve.forEach(s => { if (s && s.objectif) parObjectif[s.objectif] = s; });
    actions.forEach(a => {
      const cle = a.objectif || a.objectif_smart;
      const s = parObjectif[cle];
      if (s) {
        if (s.statut) a.statut = s.statut;
        if (s.ressenti) a.ressenti = s.ressenti;
        if (s.horizon) a.horizon = s.horizon;
        else if (s.priorite) a.horizon = horizonDepuisPriorite(s.priorite);
      }
    });
    return actions;
  }

  // repli local si l'IA est indisponible : objectifs simples sans SMART généré
  function construireReplisPlan(forces, vigilances, objectifs) {
    const out = [];
    const pasF = [
      'Choisissez une situation de la semaine pour jouer cette force à dessein.',
      'Racontez à un collègue une situation récente où cette force a fait la différence.',
      'Notez deux occasions où cette force peut servir votre équipe cette semaine.',
    ];
    const indF = [
      "Vous l'avez activée consciemment au moins une fois.",
      "Quelqu'un vous en a fait la remarque, ou vous l'avez notée quelque part.",
      'Vous savez dire où elle a joué cette semaine.',
    ];
    const pasV = [
      'Choisissez une occasion proche, à faible enjeu, pour vous y exercer.',
      'Repérez le déclencheur habituel et préparez une réponse simple à l\'avance.',
      'Demandez à une personne de confiance de vous signaler la prochaine occasion.',
    ];
    const indV = [
      'Vous observez un premier ajustement concret.',
      'La situation type se passe un cran mieux que d\'habitude.',
      'Vous avez tenu votre réponse préparée au moins une fois.',
    ];
    const pasO = [
      'Réservez trente minutes pour vous documenter ou en parler.',
      'Identifiez une personne ressource et posez-lui une première question.',
      'Listez trois façons concrètes de commencer, puis choisissez-en une.',
    ];
    const indO = [
      'Vous franchissez une première étape visible.',
      'Vous avez une date posée pour la suite.',
      'Vous savez décrire votre prochain pas.',
    ];
    const qd = 'Cette semaine, dans une situation r\u00e9elle de votre agenda';
    forces.forEach((f, i) => out.push({ thematique: 'Force', type: 'Capitaliser', horizon: 'Bientôt', objectif: f, quand: qd, origine: f, premier_pas: pasF[i % 3], indicateur: indF[i % 3] }));
    vigilances.forEach((v, i) => out.push({ thematique: 'Progression', type: 'Progresser', horizon: 'Maintenant', objectif: v, quand: qd, origine: v, premier_pas: pasV[i % 3], indicateur: indV[i % 3] }));
    objectifs.forEach((o, i) => out.push({ thematique: 'Développement', type: 'Explorer', horizon: 'Plus tard', objectif: o, quand: qd, origine: o, premier_pas: pasO[i % 3], indicateur: indO[i % 3] }));
    return out;
  }
  function signalerRepliPlan(mod) {
    setTimeout(function () {
      const sc2 = document.querySelector('#screen-plan .plan-scroll');
      if (!sc2 || document.getElementById('plan-repli')) return;
      const d = document.createElement('div');
      d.id = 'plan-repli';
      d.className = 'plan-repli';
      d.innerHTML = 'Version express de votre feuille de route. <button type="button" class="plan-repli-btn" onclick="App.ouvrirPlanDepuisResto(\'' + mod + '\')">Générer la version personnalisée</button>';
      sc2.insertBefore(d, sc2.children[1] || null);
    }, 80);
  }

  // construit le tableau (desktop) + cartes (mobile) des actions, avec priorité modifiable
  // construit la feuille de route : un cap (synthese) + des objectifs en cartes,
  // chacun en trois couches (objectif, premier pas, indicateur) avec un horizon.
  function rendrePlanActions(scr, mod, heroHtml, actions, synthese) {
    const ordreHor = { 'Maintenant': 0, 'Bientôt': 1, 'Bientot': 1, 'Plus tard': 2 };
    actions.forEach(a => { if (!a.horizon) a.horizon = horizonDepuisPriorite(a.priorite); });
    actions.sort((x, y) => (ordreHor[x.horizon] ?? 1) - (ordreHor[y.horizon] ?? 1));

    function classeType(t) {
      const x = (t || '').toLowerCase();
      if (x.indexOf('capital') === 0) return 'pt-cap';
      if (x.indexOf('progress') === 0) return 'pt-pro';
      return 'pt-exp';
    }
    function classeHorizon(h) {
      const x = (h || '').toLowerCase();
      if (x.indexOf('maintenant') === 0) return 'ph-now';
      if (x.indexOf('plus tard') === 0) return 'ph-later';
      return 'ph-soon';
    }
    function classeStatut(s) {
      const x = (s || '').toLowerCase();
      if (x.indexOf('fait') === 0) return 'ps-fait';
      if (x.indexOf('cours') >= 0) return 'ps-cours';
      return 'ps-afaire';
    }
    function libStatut(s) {
      const x = (s || '').toLowerCase();
      if (x.indexOf('fait') === 0) return 'Fait';
      if (x.indexOf('cours') >= 0) return 'En cours';
      return 'À faire';
    }
    const objDe = (a) => a.objectif || a.objectif_smart || '';

    // une carte par objectif, en trois couches
    const cartes = actions.map((a, i) => {
      const statut = a.statut || 'À faire';
      const aRessenti = a.ressenti && a.ressenti.trim();
      const pas = (a.premier_pas || '').trim();
      const ind = (a.indicateur || '').trim();
      const quand = (a.quand || '').trim();
      const orig = (a.origine || '').trim();
      const srcMod = a.source || mod || 'socle';
      const SRC_C = { socle: '#3EADFF', commercial: '#E8951A', manager: '#5E59C7' };
      return '<div class="planc" data-i="' + i + '">' +
        '<div class="planc-head">' +
          '<span class="planc-src" style="background:' + (SRC_C[srcMod] || '#3EADFF') + '">' + echapValeur(String(srcMod).toUpperCase()) + '</span>' +
          '<span class="plan-them">' + echapValeur(a.thematique) + '</span>' +
          (orig ? '<span class="planc-nee" title="' + echapValeur(orig) + '">N\u00e9e de : ' + echapValeur(orig.length > 46 ? orig.slice(0, 44) + '\u2026' : orig) + '</span>' : '') +
          '<span class="plan-type ' + classeType(a.type) + '">' + echapValeur(a.type) + '</span>' +
          '<button class="planc-horizon ' + classeHorizon(a.horizon) + '" data-horizon="' + i + '" title="Ajuster l\'horizon">' + echapValeur(a.horizon) + '</button>' +
        '</div>' +
        (quand ? '<div class="planc-quand">' + echapValeur(quand) + '</div>' : '') +
        '<p class="planc-obj">' + echapValeur(objDe(a)) + '</p>' +
        (pas ? '<div class="planc-layer planc-pas"><span class="planc-ic">▸</span><div class="planc-layer-txt"><span class="planc-lab">Premier pas</span><p>' + echapValeur(pas) + '</p></div></div>' : '') +
        (ind ? '<div class="planc-layer planc-ind"><span class="planc-ic">◎</span><div class="planc-layer-txt"><span class="planc-lab">Votre preuve à ramener</span><p>' + echapValeur(ind) + '</p></div></div>' : '') +
        '<div class="planc-suivi">' +
          '<button class="plan-statut ' + classeStatut(statut) + '" data-statut="' + i + '">' + libStatut(statut) + '</button>' +
          '<button class="plan-ressenti-btn' + (aRessenti ? ' a-note' : '') + '" data-ressenti="' + i + '" title="Votre preuve, en une ligne">' + (aRessenti ? '✏️ Ma preuve' : '💬 Ma preuve, en une ligne') + '</button>' +
        '</div>' +
        (aRessenti ? '<div class="planc-note">« ' + echapValeur(a.ressenti.trim()) + ' »</div>' : '') +
      '</div>';
    });

    const capHtml = (synthese && synthese.trim())
      ? '<div class="plan-cap"><div class="plan-cap-lab">Votre cap</div><p class="plan-cap-txt">' + echapValeur(synthese.trim()) + '</p></div>'
      : '';

    const seedup =
      '<div class="plan-seedup">' +
        '<span class="plan-seedup-tag">Option</span>' +
        '<div class="plan-seedup-ic">⚡</div>' +
        '<div class="plan-seedup-txt"><div class="plan-seedup-t">Ancrez vos objectifs avec SeedUp</div>' +
        '<p>En complément, SeedUp transforme ces objectifs en défis courts. Quelques minutes par semaine pour ancrer durablement vos progrès.</p></div>' +
        '<button class="plan-seedup-btn" id="plan-go-seedup">Découvrir l\'option SeedUp</button>' +
      '</div>';

    scr.innerHTML = '<div class="plan-scroll">' + heroHtml +
      capHtml +
      '<p class="plan-intro-tab">Voici votre feuille de route. Chaque objectif tient en trois temps : le cap, le premier pas, et le signe que c\'est acquis. L\'horizon est proposé, ajustez-le en cliquant dessus.</p>' +
      '<div class="plan-cards">' + cartes.slice(0, 3).join('') + '</div>' +
      (cartes.length > 3 ? '<details class="plan-avenir"><summary>À venir · ' + (cartes.length - 3) + ' défis</summary><div class="plan-cards">' + cartes.slice(3).join('') + '</div></details>' : '') +
      seedup +
    '</div>';
    activerScreenPlan(scr, mod);

    // horizon ajustable : Maintenant -> Bientôt -> Plus tard
    const cycleHorizon = (i, btn) => {
      const cur = (actions[i].horizon || 'Bientôt').toLowerCase();
      let next, cls;
      if (cur.indexOf('maintenant') === 0) { next = 'Bientôt'; cls = 'ph-soon'; }
      else if (cur.indexOf('bient') === 0) { next = 'Plus tard'; cls = 'ph-later'; }
      else { next = 'Maintenant'; cls = 'ph-now'; }
      actions[i].horizon = next;
      btn.textContent = next;
      btn.className = 'planc-horizon ' + cls;
      sauverSuiviPlan(mod, actions);
    };
    scr.querySelectorAll('[data-horizon]').forEach(btn => {
      const i = parseInt(btn.getAttribute('data-horizon'), 10);
      btn.onclick = () => cycleHorizon(i, btn);
    });

    // statut cliquable : À faire -> En cours -> Fait
    const cycleStatut = (i) => {
      const cur = (actions[i].statut || 'À faire').toLowerCase();
      let next;
      if (cur.indexOf('faire') >= 0) next = 'En cours';
      else if (cur.indexOf('cours') >= 0) next = 'Fait';
      else next = 'À faire';
      actions[i].statut = next;
      scr.querySelectorAll('[data-statut="' + i + '"]').forEach(b => {
        b.textContent = next;
        b.className = 'plan-statut ' + classeStatut(next);
      });
      sauverSuiviPlan(mod, actions);
      if (next === 'Fait' && !(actions[i].ressenti && String(actions[i].ressenti).trim())) ouvrirRessenti(scr, mod, actions, i);
    };
    scr.querySelectorAll('[data-statut]').forEach(btn => {
      const i = parseInt(btn.getAttribute('data-statut'), 10);
      btn.onclick = () => cycleStatut(i);
    });

    // ressenti
    scr.querySelectorAll('[data-ressenti]').forEach(btn => {
      const i = parseInt(btn.getAttribute('data-ressenti'), 10);
      btn.onclick = () => ouvrirRessenti(scr, mod, actions, i);
    });

    planActionsCourant = actions;
    planModCourant = mod;
  }

  // horizon par défaut depuis l'ancienne priorité (compat si le back n'est pas redéployé)
  function horizonDepuisPriorite(p) {
    const x = (p || '').toLowerCase();
    if (x.indexOf('haut') === 0) return 'Maintenant';
    if (x.indexOf('bass') === 0) return 'Plus tard';
    return 'Bientôt';
  }
  // minuscule sur la première lettre (pour les objectifs de repli)
  function minuscule1(s) { s = String(s || ''); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  // état courant du plan affiché (pour sauvegarde du suivi)
  let planActionsCourant = [];
  let planModCourant = '';

  // Saisie du ressenti sur une action : panneau léger en bas d'écran
  function ouvrirRessenti(scr, mod, actions, i) {
    const a = actions[i];
    const ancien = a.ressenti || '';
    let panel = document.getElementById('plan-ressenti-panel');
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.id = 'plan-ressenti-panel';
    panel.className = 'plan-rp';
    panel.innerHTML =
      '<div class="plan-rp-card">' +
        '<div class="plan-rp-titre">Votre ressenti</div>' +
        '<p class="plan-rp-obj">' + echapValeur(a.objectif || a.objectif_smart) + '</p>' +
        '<textarea class="plan-rp-input" id="plan-rp-input" rows="4" placeholder="Où en êtes-vous ? Ce qui avance, ce qui bloque, ce que vous avez appris...">' + echapValeur(ancien) + '</textarea>' +
        '<div class="plan-rp-actions">' +
          '<button class="plan-rp-annuler" id="plan-rp-annuler">Annuler</button>' +
          '<button class="plan-rp-ok" id="plan-rp-ok">Enregistrer</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('on'));
    const fermer = () => { panel.classList.remove('on'); setTimeout(() => panel.remove(), 250); };
    document.getElementById('plan-rp-annuler').onclick = fermer;
    panel.onclick = (e) => { if (e.target === panel) fermer(); };
    document.getElementById('plan-rp-ok').onclick = () => {
      a.ressenti = (document.getElementById('plan-rp-input').value || '').trim();
      // refléter l'icône "ressenti rempli" sur les boutons de cette action
      scr.querySelectorAll('[data-ressenti="' + i + '"]').forEach(b => { b.classList.toggle('a-note', !!a.ressenti); b.textContent = a.ressenti ? '✏️' : '💬'; });
      scr.querySelectorAll('[data-ressenti-m="' + i + '"]').forEach(b => { b.classList.toggle('a-note', !!a.ressenti); b.textContent = a.ressenti ? '✏️ Modifier mon ressenti' : '💬 Laisser un ressenti'; });
      const bStat = scr.querySelector('[data-statut="' + i + '"]');
      const pcNote = bStat && bStat.closest('.planc');
      if (pcNote) {
        let note = pcNote.querySelector('.planc-note');
        if (a.ressenti) {
          if (!note) { pcNote.insertAdjacentHTML('beforeend', '<div class="planc-note"></div>'); note = pcNote.querySelector('.planc-note'); }
          note.textContent = '« ' + a.ressenti + ' »';
        } else if (note) note.remove();
      }
      sauverSuiviPlan(mod, actions);
      fermer();
    };
  }

  // Envoi du suivi (statuts + ressentis) au serveur, pour remontée dans le tableau de bord
  function sauverSuiviPlan(mod, actions) {
    if (!identite.email) return;
    const suivi = actions.map(a => ({
      thematique: a.thematique, objectif: a.objectif || a.objectif_smart || '',
      statut: a.statut || 'À faire', ressenti: a.ressenti || '', horizon: a.horizon || '',
      quand: a.quand || '', premier_pas: a.premier_pas || '', indicateur: a.indicateur || '', origine: a.origine || ''
    }));
    fetch(PROGRESSION_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_plan_suivi', email: identite.email, module: mod, suivi: suivi }),
    }).catch(() => { /* silencieux : le suivi local reste affiché */ });
  }

  // active l'écran plan et branche les boutons communs (retour, revoir, seedup)
  function activerScreenPlan(scr, mod) {
    const sb = document.getElementById('r-selbar');
    if (sb) sb.classList.remove('on');
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    // la barre de sélection appartient à la restitution : on la retire sur le plan
    const _selbar = document.getElementById('r-selbar');
    if (_selbar) _selbar.classList.remove('on');
    window.scrollTo(0, 0);
    const r = document.getElementById('plan-retour');
    if (r) r.onclick = () => { scr.classList.remove('active'); goToEspace(); };
    const btnRevoir = scr.querySelector('[data-revoir]');
    if (btnRevoir) btnRevoir.onclick = () => { scr.classList.remove('active'); revoirAnalyse(btnRevoir.getAttribute('data-revoir')); };
    const btnSeed = document.getElementById('plan-go-seedup');
    if (btnSeed) btnSeed.onclick = () => { scr.classList.remove('active'); revoirAnalyse(mod); };
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
        try { Result.render(res); } catch (e) { console.error('[Sinéa]', e); alert("Une partie de l'analyse n'a pas pu s'afficher. Rechargez la page, et contactez-nous si cela persiste."); }
        try { if (Result.apresRender) Result.apresRender(res, mod === 'socle' ? '' : 'spe'); } catch (e) { console.warn('[Sinéa]', e); }
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
    // questions de contexte du métier AVANT le module (elles nourrissent la restitution spécialisée),
    // puis l'intro de chapitre, puis le module.
    afficherContexteModule(mod, () => {
      showChapterIntro('spe', () => {
        document.getElementById('screen-question').classList.add('active');
        render();
      });
    });
  }

  // Écran de questions de contexte propre au module (manager / commercial), posé AVANT le module.
  function afficherContexteModule(mod, suite) {
    const cle = (mod === 'manager') ? 'avant_module_manager' : (mod === 'commercial') ? 'avant_module_commercial' : null;
    const ctx = cle && SINEA_DATA.questions_ouvertes && SINEA_DATA.questions_ouvertes[cle];
    if (!ctx || !ctx.questions || !ctx.questions.length) { suite(); return; }
    let scr = document.getElementById('screen-ctx-module');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-ctx-module';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    const champs = ctx.questions.map(function (q) {
      return '<div class="qo-field">' +
        '<label class="qo-q">' + q.question + '</label>' +
        '<textarea class="qo-input qo-ctxm" data-q="' + q.id + '" rows="3" placeholder="' + (q.placeholder || '') + '">' + echapValeur(openAnswers[q.id] || '') + '</textarea>' +
      '</div>';
    }).join('');
    scr.innerHTML =
      '<div class="qo-scroll">' +
        '<div class="qo-head">' +
          '<div class="qo-kicker">Avant ce module</div>' +
          '<h2 class="qo-title">Votre réalité de terrain</h2>' +
          '<p class="qo-sub">' + (ctx.intro || 'Vos réponses enrichissent votre portrait spécialisé.') + '</p>' +
        '</div>' +
        champs +
        '<button class="btn-primary qo-submit" id="ctxm-go">Commencer le module</button>' +
        '<button class="btn-ghost" id="ctxm-skip">Passer</button>' +
      '</div>';
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    window.scrollTo(0, 0);
    const valider = () => {
      scr.querySelectorAll('.qo-ctxm').forEach(function (t) {
        openAnswers[t.getAttribute('data-q')] = (t.value || '').trim();
      });
      saveProgress();
      scr.classList.remove('active');
      suite();
    };
    document.getElementById('ctxm-go').onclick = valider;
    document.getElementById('ctxm-skip').onclick = () => { scr.classList.remove('active'); suite(); };
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

    // Reprise : si un parcours est déjà entamé (sauvegardé), proposer de reprendre
    // au lieu de tout relancer (accueil + questions depuis le début).
    const saved = loadProgress();
    if (saved && saved.answers && Object.keys(saved.answers).length > 0) {
      showResumePrompt(saved);
      return;
    }

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
      + (s.bouton ? '<button class="coach-intro-go" id="accueil-go">' + s.bouton + '</button>'
                  : '<button class="coach-intro-go coach-intro-next">Continuer</button>')
      + '</div>'
    ).join('');
    ov.innerHTML = '<div class="coach-intro-card"><div class="coach-intro-nea"><img class="coach-intro-nea-vid" src="Nea_detoure_full.png.webp" alt="Néa, votre coach" /></div><div class="coach-intro-nea-label">Néa · votre coach</div>' + stepsHtml + '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('on'));

    const stepEls = ov.querySelectorAll('.coach-intro-step');
    let etape = 0;
    const montrer = (n) => stepEls.forEach((s, k) => s.classList.toggle('show', k === n));
    montrer(0);
    // La personne avance entièrement à son rythme : aucun défilement automatique.
    // Un clic, sur la carte ou sur Continuer, passe au message suivant.
    const avancer = () => { if (etape < steps.length - 1) { etape++; montrer(etape); } };
    let fini = false;
    const fermer = () => {
      if (fini) return; fini = true;
      ov.classList.remove('on');
      setTimeout(() => { ov.remove(); suite(); }, 500);
    };
    ov.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'accueil-go') { fermer(); return; }
      if (e.target && e.target.classList && e.target.classList.contains('coach-intro-skip')) { return; }
      // un clic sur le dernier message (déjà affiché) démarre le bilan
      if (stepEls[steps.length - 1] && stepEls[steps.length - 1].classList.contains('show')) { fermer(); return; }
      // sinon, on avance au message suivant
      avancer();
    });
    // filet : bouton "passer" discret pour les pressés, dès le départ
    const skip = document.createElement('button');
    skip.className = 'coach-intro-skip';
    skip.textContent = 'Passer l\'introduction';
    skip.onclick = fermer;
    ov.querySelector('.coach-intro-card').appendChild(skip);
  }

  // Écran d'intention : une seule question ouverte, légère, optionnelle.
  // échappe le texte inséré dans un textarea (évite toute casse si la réponse contient des caractères spéciaux)
  function echapValeur(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m];
    });
  }

  function afficherIntention(suite) {
    if (estAjoutModule) { suite(); return; } // un module spé ne redemande pas l'intention
    const qo = (SINEA_DATA.questions_ouvertes && SINEA_DATA.questions_ouvertes.intention) || null;
    const ctx = (SINEA_DATA.questions_ouvertes && SINEA_DATA.questions_ouvertes.avant_bilan) || null;
    if (!qo && !ctx) { suite(); return; }
    let scr = document.getElementById('screen-intention');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-intention';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    // questions de contexte (nourrissent la restitution) + intention
    let champsCtx = '';
    if (ctx && ctx.questions) {
      champsCtx = ctx.questions.map(function (q) {
        return '<div class="qo-field">' +
          '<label class="qo-q">' + q.question + '</label>' +
          '<textarea class="qo-input qo-ctx" data-q="' + q.id + '" rows="3" placeholder="' + (q.placeholder || '') + '">' + echapValeur(openAnswers[q.id] || '') + '</textarea>' +
        '</div>';
      }).join('');
    }
    const champIntention = qo ?
      '<div class="qo-field">' +
        '<label class="qo-q">' + qo.question + '</label>' +
        '<textarea class="qo-input" id="intention-input" rows="3" placeholder="' + (qo.placeholder || '') + '">' + echapValeur(openAnswers.intention || '') + '</textarea>' +
      '</div>' : '';

    scr.innerHTML =
      '<div class="qo-scroll">' +
        '<div class="qo-nea-head">' +
          '<div class="qo-nea-video">' +
            '<img class="qo-nea-vid" src="Nea_detoure_full.png.webp" alt="Néa, votre coach" />' +
          '</div>' +
          '<div class="qo-nea-label">Néa · votre coach</div>' +
          '<p class="qo-nea-msg">« Bonjour' + (identite.prenom ? ' ' + echapValeur(identite.prenom) : '') + ', je suis <span class="qo-nea-a">Néa</span>, je vais vous accompagner tout au long de ce bilan. Avant de commencer, j\'aimerais vous connaître un peu. »</p>' +
        '</div>' +
        champsCtx +
        champIntention +
        '<button class="btn-primary qo-submit" id="intention-go">Commencer mon bilan</button>' +
        '<button class="btn-ghost" id="intention-skip">Passer</button>' +
      '</div>';
    document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
    scr.classList.add('active');
    window.scrollTo(0, 0);
    const valider = () => {
      // sauvegarder les questions de contexte
      scr.querySelectorAll('.qo-ctx').forEach(function (t) {
        openAnswers[t.getAttribute('data-q')] = (t.value || '').trim();
      });
      const v = document.getElementById('intention-input');
      if (v) { openAnswers.intention = (v.value || '').trim(); }
      saveProgress();
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
      socle2: { bravo: 'Première partie terminée' },
      contexte: { bravo: 'Vous avancez bien' },
      spe: { bravo: 'Votre socle est complet' },
    };
    // Néa accompagne chaque transition : une phrase courte, et un fil rouge qui monte vers la révélation
    const neaLines = {
      socle: 'Bonjour, je suis Néa. Je vous accompagne dans cette exploration. Répondez avec spontanéité, je m\'occupe du reste.',
      socle2: 'Je vous regarde répondre, et déjà votre profil prend forme. Accordons-nous un instant, puis poursuivons.',
      contexte: 'Je vous cerne de mieux en mieux. Place à quelques situations concrètes, pour affiner le trait.',
      spe: 'Votre portrait est presque complet. Un dernier éclairage, et je vous connaîtrai vraiment.',
    };
    const enc = numero > 1 ? encouragements[chapId] : null;
    const neaLine = neaLines[chapId] || '';
    const celebration = enc ? `
        <div class="chap-bravo chap-a2"><span class="chap-bravo-check">✓</span>${enc.bravo}</div>
        <div class="chap-ring chap-a2">
          <svg viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" class="chap-ring-bg"/>
            <circle cx="40" cy="40" r="34" class="chap-ring-fill" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - pct / 100)}"/>
          </svg>
          <div class="chap-ring-pct">${pct}%</div>
        </div>` : '';
    scr.innerHTML = `
      <div class="chap-halo"></div>
      <div class="chap-in">
        <div class="chap-nea chap-a1"><img src="Nea_detoure_full.png.webp" alt="Néa, votre coach"/></div>
        <div class="chap-nea-label chap-a1">Néa · votre coach</div>
        <div class="chap-step chap-a1">Étape ${numero} sur ${totalChap}</div>
        ${celebration}
        ${neaLine ? `<div class="chap-nea-line chap-a2">${neaLine}</div>` : ''}
        <h2 class="chap-title chap-a3">${chap.titre}</h2>
        <div class="chap-sub chap-a3">${chap.sous}</div>
        <button class="chap-btn chap-a4" id="chap-go">${numero > 1 ? 'Continuer' : 'Commencer'}</button>
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

    // Progression GLOBALE (toutes étapes) : nourrit la métaphore de la graine qui pousse.
    const pctGlobal = ((idx + 1) / queue.length) * 100;
    majPousse(pctGlobal);

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
        socle2: "Continuez sur votre lancée. Ces questions affinent les nuances de votre style.",
        contexte: "Ces situations révèlent vos réflexes naturels face aux moments clés du quotidien.",
        spe: cur.chap === 'spe' && diagType === 'commercial'
          ? "Ces mises en situation éclairent votre façon de vendre et de convaincre."
          : "Ces mises en situation éclairent votre posture de manager au quotidien."
      };
      asideNote.textContent = notes[cur.chap] || notes.socle;
    }
  }

  // Métaphore vivante : une graine qui devient plante en fleur au fil du parcours.
  // 15 paliers pour une croissance très progressive et animée (la tige grandit en
  // continu, les feuilles puis la fleur éclosent à des paliers réguliers).
  function majPousse(pct) {
    const zone = document.getElementById('q-pousse');
    if (!zone) return;
    // palier de 0 à 14 (15 paliers) selon la progression globale
    const palier = Math.min(14, Math.floor((pct / 100) * 15));
    const ancien = parseInt(zone.getAttribute('data-stade') || '-1', 10);
    zone.setAttribute('data-stade', String(palier));
    // la plante réagit quand elle grandit, pour que la personne la remarque
    if (palier > ancien && ancien >= 0) {
      zone.classList.remove('pousse-grow');
      void zone.offsetWidth; // relance l'animation
      zone.classList.add('pousse-grow');
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
      // Délai confortable : on laisse le temps de voir sa réponse validée avant
      // d'enchaîner (300ms était trop rapide, retour terrain). Pas de bouton "continuer"
      // (choix de l'équipe), mais une transition douce et lisible.
      window._autoNext = setTimeout(() => next(), 650);
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
      window._autoNext = setTimeout(() => next(), 650);
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
      window._autoNext = setTimeout(() => next(), 650);
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
    // Tous les points placés : on enchaîne automatiquement (comme les autres questions),
    // avec un délai confortable pour voir le résultat. Plus besoin de bouton "continuer".
    if (used === total) {
      refreshNav(true);
      if (idx < queue.length - 1) {
        clearTimeout(window._autoNext);
        window._autoNext = setTimeout(() => next(), 750);
      }
    } else {
      clearTimeout(window._autoNext);
      refreshNav(false);
    }
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
    // Le bouton n'apparaît que là où il est UTILE pour ne JAMAIS bloquer :
    // - dernière question (devient "Voir mon profil")
    // - curseur (la personne ajuste librement : aucun moment "auto" évident)
    // - répartition de points (on garde un bouton de secours une fois les points placés,
    //   au cas où l'enchaînement auto n'a pas suffi ou si on a ajusté)
    // Pour swipe, choix forcé, qcm : enchaînement automatique, pas de bouton.
    const derniere = idx === queue.length - 1;
    const besoinBouton = derniere || cur.kind === 'curseur' || cur.kind === 'repart';
    if (besoinBouton) {
      btnNext.style.display = '';
      btnNext.textContent = derniere ? 'Voir mon profil →' : 'Continuer →';
    } else {
      btnNext.style.display = 'none';
    }
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
        // réponses ouvertes : celles du socle (fil rouge) + celles saisies AVANT ce module (contexte métier)
        const ouvertesSocle = (interactionsSocleSauve && interactionsSocleSauve.reponses_ouvertes) ? interactionsSocleSauve.reponses_ouvertes : {};
        result.reponsesOuvertes = Object.assign({}, ouvertesSocle, openAnswers);
        result.speDims = Engine.scorerSpeDims(repSpeDims, diagType, result.scoresBigFive);
        result.speStyle = Engine.scorerSpeStyle(repSpeQcm, diagType);
        result.speStyleScores = Engine.scorerSpeStyleScores(repSpeQcm, diagType);
        result.epithete = Engine.epitheteMetier(result.speStyle, result.diagType);
      } else {
        // MODE SOCLE (ou parcours complet)
        result = Engine.scorer(repMini, repSinea);
        result.contextuel = Engine.scorerContextuel(repCtx);
        result.contextuelPlus = Engine.scorerContextuelPlus(repCtxPlus);
        result.fiabilite = Engine.scorerFiabilite(repMini, answersTime);
        result.diagType = diagType;
        result.reponsesOuvertes = openAnswers;
        result.naturelAdapte = Engine.scorerNaturelAdapte(repMini, repAdapte);
        // Tensions intérieures (configurations de traits) et signaux saillants (réponses extrêmes) :
        // ils nourrissent la génération pour un portrait plus profond et plus concret.
        result.tensions = Engine.detecterTensions(result.scoresBigFive, result.naturelAdapte);
        result.signauxSaillants = Engine.signauxSaillants(repMini);
        if (diagType !== 'classic') {
          result.speDims = Engine.scorerSpeDims(repSpeDims, diagType, result.scoresBigFive);
          result.speStyle = Engine.scorerSpeStyle(repSpeQcm, diagType);
          result.speStyleScores = Engine.scorerSpeStyleScores(repSpeQcm, diagType);
          result.epithete = Engine.epitheteMetier(result.speStyle, result.diagType);
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
          tensions: result.tensions, signauxSaillants: result.signauxSaillants,
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
      } catch (e) { console.warn("[Sinéa]", e); }

      clearInterval(msgTimer);
      document.getElementById('screen-loader').classList.remove('active');
      // Préparer la restitution en arrière-plan, puis lancer la révélation animée
      result.modeCampagne = modeCampagne;

      // ---- Affinage si la fiabilité est basse (sous 75 %) ----
      // On affine UNE fois : questions ciblées sur le trait en tension, recalcul, puis restitution.
      // Quel que soit le résultat, la restitution s'affiche ensuite (on ne bloque jamais).
      function afficherRestitution(res) {
        Result.render(res);
        try { if (Result.apresRender) Result.apresRender(res, ''); } catch (e) { console.warn('[Sinéa]', e); }
        if (Result.setEmail) Result.setEmail(identite.email || '');
        lancerRevelation(res);
        window.scrollTo(0, 0);
      }

      if (typeof lancerAffinage === "function" && result.fiabilite && result.fiabilite.score < 75) {
        lancerAffinage(result, function (ajust) {
          if (ajust && ajust.dimension && typeof ajust.delta === "number") {
            // appliquer l'ajustement au trait visé, puis recalculer le profil
            try {
              const map = { extraversion:'E', agreabilite:'A', conscience:'C', neuroticisme:'N', ouverture:'O' };
              const k = map[ajust.dimension];
              if (k && result.scoresBigFive && typeof result.scoresBigFive[k] === 'number') {
                // delta -50..+50 : on déplace le trait dans le sens confirmé (pondéré pour rester mesuré)
                const nouvelle = Math.max(0, Math.min(100, result.scoresBigFive[k] + ajust.delta * 0.6));
                result.scoresBigFive[k] = Math.round(nouvelle);
                // recalcul du profil à partir des Big Five ajustés, si l'API le permet
                if (Engine.recalculerDepuisBigFive) {
                  const r2 = Engine.recalculerDepuisBigFive(result.scoresBigFive, result);
                  if (r2) { Object.assign(result, r2); }
                }
                // la fiabilité a été levée par la confirmation : on la remonte au-dessus du seuil
                if (result.fiabilite) {
                  result.fiabilite.score = Math.max(result.fiabilite.score, 76);
                  result.fiabilite.affine = true;
                  // le verdict reste honnête : la confirmation lève le doute sur LE trait
                  // testé, jamais sur un signal global de cohérence encore présent.
                  const fortsRestants = (result.fiabilite.signaux || []).filter(function (s) { return s && s.niveau === 'fort'; });
                  if (fortsRestants.length) {
                    result.fiabilite.niveau = 'correcte';
                    result.fiabilite.message = 'Vos précisions ont confirmé le trait en tension. Une variabilité de réponses reste visible, lisez les scores comme des tendances et confirmez-les par l\'échange.';
                  } else {
                    result.fiabilite.niveau = 'bonne';
                    result.fiabilite.message = 'Profil confirmé par vos précisions. Résultats fiables.';
                  }
                }
              }
            } catch (e) { console.warn("[Sinéa]", e); }
          }
          afficherRestitution(result);
        });
      } else {
        afficherRestitution(result);
      }
      document.getElementById('phone-scroll')?.scrollTo(0, 0);
    }, 2200);
  }

  // ============================================================
  // LA RÉVÉLATION ANIMÉE DU PORTRAIT
  // ============================================================
  // ---- Sons de la révélation (synthétisés, aucun fichier à héberger) ----
  // Sons doux et premium, générés par Web Audio. Silencieux si le navigateur le refuse.
  let _audioCtx = null;
  function _getAudio() {
    if (_audioCtx) return _audioCtx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _audioCtx = new AC();
      return _audioCtx;
    } catch (e) { return null; }
  }
  function _note(freq, debut, duree, volume) {
    const ac = _getAudio(); if (!ac) return;
    try {
      const t0 = ac.currentTime + debut;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(volume, t0 + 0.06);
      g.gain.linearRampToValueAtTime(0, t0 + duree);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t0); osc.stop(t0 + duree + 0.05);
    } catch (e) { console.warn("[Sinéa]", e); }
  }
  function sonSuspense() {
    const ac = _getAudio(); if (!ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { console.warn("[Sinéa]", e); } }
    _note(330, 0, 0.5, 0.05); _note(392, 0.35, 0.5, 0.05); _note(494, 0.7, 0.6, 0.05);
  }
  function sonReveal() {
    const ac = _getAudio(); if (!ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { console.warn("[Sinéa]", e); } }
    // montee scintillante facon poussiere d'etoile
    _note(523, 0,    0.55, 0.06);   // do5
    _note(659, 0.12, 0.55, 0.06);   // mi5
    _note(784, 0.24, 0.6,  0.06);   // sol5
    _note(1047,0.36, 0.7,  0.05);   // do6
    _note(1319,0.48, 0.8,  0.04);   // mi6
    // accord final qui resonne plus longtemps (tail premium)
    _note(523, 0.62, 2.6,  0.05);   // do5
    _note(784, 0.64, 2.6,  0.045);  // sol5
    _note(1047,0.66, 2.7,  0.04);   // do6
  }
  function sonLettre() { _note(880, 0, 0.04, 0.015); }

  function lancerRevelation(result) {
    const dom = result.dominante;
    if (!dom) { document.getElementById('screen-result').classList.add('active'); return; }
    const slug = SINEA_DATA.image(dom.nom);
    const familleLabel = { RELATION: 'Relation', ACTION: 'Action', STRUCTURE: 'Structure', VISION: 'Vision' }[(dom.famille || '').toUpperCase()] || '';

    const scr = document.getElementById('screen-reveal');
    const intro = document.getElementById('reveal-intro');
    const perso = document.getElementById('reveal-perso');
    const imgEl = document.getElementById('reveal-img');
    const nomEl = document.getElementById('reveal-nom');
    const famEl = document.getElementById('reveal-famille');
    const epEl = document.getElementById('reveal-epithete');
    const embEl = document.getElementById('reveal-embleme');
    const cta = document.getElementById('reveal-cta');
    if (!scr) { document.getElementById('screen-result').classList.add('active'); return; }

    // réinitialiser
    perso.classList.remove('reveal-show'); nomEl.textContent = ''; famEl.classList.remove('reveal-show'); cta.classList.remove('reveal-show'); intro.classList.remove('reveal-fade');
    if (epEl) { epEl.textContent = ''; epEl.classList.remove('reveal-show'); }
    if (embEl) { embEl.innerHTML = ''; embEl.classList.remove('reveal-show'); }
    if (slug) { imgEl.onerror = function(){ this.onerror=null; this.src = slug + '.webp'; }; imgEl.src = srcPerso(slug); }
    // option B : choix de la version du personnage, visible une fois les visuels h/f en ligne
    if (VARIANTES_PERSO_ACTIVES && slug && perso) {
      let tg = document.getElementById('reveal-variante');
      if (!tg) { tg = document.createElement('div'); tg.id = 'reveal-variante'; tg.className = 'reveal-variante'; perso.parentNode.insertBefore(tg, perso.nextSibling); }
      const vc = variantePerso() || 'f';
      tg.innerHTML = '<span class="rv-lab">Votre personnage</span>'
        + '<button class="rv-opt' + (vc === 'f' ? ' on' : '') + '" data-v="f">Féminin</button>'
        + '<button class="rv-opt' + (vc === 'h' ? ' on' : '') + '" data-v="h">Masculin</button>';
      tg.querySelectorAll('.rv-opt').forEach(b => b.onclick = () => {
        const nv = b.getAttribute('data-v');
        setVariantePerso(nv);
        tg.querySelectorAll('.rv-opt').forEach(x => x.classList.toggle('on', x === b));
        imgEl.onerror = function(){ this.onerror = null; this.src = slug + '.webp'; };
        imgEl.src = srcPerso(slug);
      });
    }
    scr.classList.add('active');

    // séquence d'animation
    setTimeout(() => { perso.classList.add('reveal-show'); lancerParticules(dom.famille); }, 700);  // le personnage apparaît + particules
    setTimeout(() => { intro.classList.add('reveal-fade'); sonSuspense(); }, 1400);      // l'intro s'efface + montée sonore (suspense)
    setTimeout(() => { ecrireNom(nomEl, dom.nom); }, 1600);              // le nom s'écrit lettre par lettre
    setTimeout(() => {
      if (epEl && result.epithete) { epEl.textContent = result.epithete; epEl.classList.add('reveal-show'); }
      famEl.textContent = 'Famille ' + familleLabel; famEl.classList.add('reveal-show');
    }, 1600 + dom.nom.length * 75 + 300);
    setTimeout(() => {
      const emb = SINEA_DATA.embleme(dom.nom);
      if (embEl && emb) {
        embEl.innerHTML = '<span class="reveal-emb-ic">' + emb.svg + '</span>'
          + '<div class="reveal-emb-txt"><span class="reveal-emb-objet">Votre emblème, ' + emb.objet + '</span>'
          + '<span class="reveal-emb-phrase">' + emb.phrase + '</span></div>';
        embEl.classList.add('reveal-show');
      }
    }, 1600 + dom.nom.length * 75 + 550);
    setTimeout(() => { cta.classList.add('reveal-show'); }, 1600 + dom.nom.length * 75 + 900);

    cta.onclick = () => {
      scr.classList.remove('active');
      arreterParticules();
      // Passage par Néa : elle accueille la personne par son prénom avant la restitution,
      // bouclant le fil rouge (elle était là au début, elle revient à la fin).
      const neaScr = document.getElementById('screen-nea');
      const neaMsg = document.getElementById('nea-msg');
      const neaCta = document.getElementById('nea-cta');
      if (neaScr && neaMsg) {
        const prenom = identite.prenom || '';
        neaMsg.innerHTML = '« Me revoici' + (prenom ? ' ' + echapValeur(prenom) : '') + '. J\'ai lu votre portrait en entier, et il dit de belles choses sur vous. Lisez-le attentivement : à la fin, je vous accorderai trois vœux, trois questions sur vous auxquelles je répondrai. Laissez-moi vous le présenter. »';
        neaScr.classList.add('active');
        window.scrollTo(0, 0);
        const vid = neaScr.querySelector('.nea-vid');
        if (vid && typeof vid.play === 'function') { try { vid.play(); } catch (e) { console.warn("[Sinéa]", e); } }
        if (neaCta) neaCta.onclick = () => {
          neaScr.classList.remove('active');
          document.getElementById('screen-result').classList.add('active');
          window.scrollTo(0, 0);
          document.getElementById('phone-scroll')?.scrollTo(0, 0);
        };
      } else {
        document.getElementById('screen-result').classList.add('active');
        window.scrollTo(0, 0);
        document.getElementById('phone-scroll')?.scrollTo(0, 0);
      }
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
      if (i >= nom.length) {
        clearInterval(timer);
        el.classList.remove('reveal-typing');
        el.classList.add('reveal-name-done'); // halo lumineux final
        sonReveal();                          // accord lumineux à la révélation complète
        return;
      }
      el.textContent += nom[i]; if (nom[i] !== ' ') sonLettre(); i++;
    }, 75);
  }

  // Pont pour ouvrir le plan d'action depuis la restitution (barre de sélection)
  function ouvrirPlanDepuisResto(mod){ ouvrirPlanAction(mod || 'socle'); }

  // La session survit au rechargement : l'identité se restaure sept jours,
  // sauf quand l'URL porte déjà une entrée par jeton (apprenant ou miroir).
  (function restaurerIdentite() {
    try {
      if (/[?&](token|miroir)=/.test(location.search)) return;
      const brut = localStorage.getItem('sinea_identite');
      if (!brut) return;
      const d = JSON.parse(brut);
      if (!d || !d.email || (Date.now() - (d.ts || 0)) > 7 * 24 * 3600 * 1000) return;
      identite.email = d.email;
      if (d.prenom) identite.prenom = d.prenom;
      const go = function () { try { goToEspace(); } catch (e) {} };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
      else go();
    } catch (e) {}
  })();

  // ============================================================
  // 360 Pro , palier 1 lot 2 : répondant, création, tableau de bord.
  // ============================================================
  const C360_URL = API_BASE + "/c360";
  const C360_MG = [
    ['mg_delegation', 'Délègue des sujets entiers, avec le pourquoi'],
    ['mg_dev', 'Fait grandir ses collègues par un feedback régulier'],
    ['mg_decision', 'Tranche dans un délai raisonnable, même sans consensus'],
  ];
  const c360Rep = { jeton: '', role: '', items: [], notes: {}, sur: {}, mg: {} };
  const c360Crea = { auto: {} };
  const C360_ITEMS = {
    ecoute_active: 'Reformule ce qu\'il entend avant de répondre, même sous pression',
    cooperation: 'Partage l\'information utile sans qu\'on la demande',
    communication_influence: 'Fait adhérer sans imposer, y compris face à des avis contraires',
    developpement_autres: 'Donne un feedback précis dans les jours qui suivent une situation, même délicat',
    orientation_resultats: 'Garde le cap sur le résultat quand les obstacles s\'accumulent',
    prise_decision: 'Tranche dans un délai raisonnable, même sans consensus complet',
    initiative: 'Se saisit des sujets sans attendre qu\'on les lui confie',
    resilience: 'Reste opérationnel et posé dans les périodes de forte pression',
    organisation: 'Découpe le travail et tient les priorités visibles pour l\'équipe',
    rigueur: 'Livre un travail vérifié, les détails qui comptent sont justes',
    fiabilite_suivi: 'Tient ses engagements de suivi sans qu\'on ait à relancer',
    analyse: 'Remonte aux causes avant de proposer une solution',
    vision_strategique: 'Relie les décisions du quotidien aux enjeux de long terme',
    creativite: 'Propose des angles neufs qui débloquent les situations',
    adaptabilite: 'Ajuste sa méthode rapidement quand le contexte change',
    apprentissage: 'Va chercher ce qui lui manque et l\'applique vite',
    gestion_conflits: 'Nomme le désaccord au lieu de le contourner, et cherche une issue tenable',
    orientation_client: 'Questionne le besoin réel du client avant de proposer une solution',
    recevoir_feedback: 'Écoute un retour critique sans se justifier, et en fait quelque chose',
  };
  function c360Email() {
    return (dataEspaceCourant && dataEspaceCourant.email) || window.prompt('Votre email de compte Sinéa') || '';
  }
  function c360Post(body) {
    return fetch(C360_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function c360EchHtml(cle, groupe) {
    const b = function (v, lab) { return '<button type="button" class="c360-n" data-g="' + groupe + '" data-k="' + cle + '" data-v="' + v + '" onclick="App.c360.note(this)">' + lab + '</button>'; };
    return '<div class="c360-ech">' + b(1, '1') + b(2, '2') + b(3, '3') + b(4, '4') + b(5, '5') + b(0, 'pas observé') + '</div>';
  }
  function rendreC360Repondant(jeton) {
    c360Rep.jeton = jeton;
    document.body.innerHTML = '<div class="c360-page"><div class="c360-tete"><div class="c360-k">FEEDBACK 360 · SINÉA</div><h1>Votre regard compte, six minutes</h1><p>Réponses agrégées, jamais individuelles. Notez ce que vous observez vraiment.</p></div><div id="c360-corps"><p class="c360-charge">Chargement…</p></div></div>';
    c360Post({ action: 'contexte', jeton: jeton }).then(function (ctx) {
      const corps = document.getElementById('c360-corps');
      if (!ctx || ctx.erreur) { corps.innerHTML = '<p class="c360-charge">' + echapValeur((ctx && ctx.erreur) || 'Lien invalide.') + '</p>'; return; }
      if (ctx.deja) { corps.innerHTML = '<div class="mir-merci-sym">✦</div><p class="c360-charge">Votre regard est déjà enregistré, merci.</p>'; return; }
      c360Rep.role = ctx.role; c360Rep.items = ctx.items || [];
      const ordre = ['RELATION', 'ACTION', 'STRUCTURE', 'VISION'];
      let h = '';
      ordre.forEach(function (f) {
        h += '<div class="c360-fam" style="--c:' + ((window.Competences.COULEURS_FAMILLES || {})[f] || '#8A879B') + '">' + f + '</div>';
        window.Competences.REFERENTIEL.filter(function (r2) { return r2.famille === f; }).forEach(function (r2) {
          h += '<div class="c360-item"><b>' + echapValeur(r2.nom) + '</b><span>' + echapValeur(C360_ITEMS[r2.id] || r2.def) + '</span>' + c360EchHtml(r2.id, 'notes') + '</div>';
        });
      });
      if (c360Rep.items.length) {
        h += '<div class="c360-fam" style="--c:#B3701A">◆ SON POSTE</div>';
        c360Rep.items.forEach(function (it, i) {
          h += '<div class="c360-item"><b>' + echapValeur(it.intitule) + '</b><span>' + echapValeur(it.item) + '</span>' + c360EchHtml('i' + i, 'sur') + '</div>';
        });
      }
      if (ctx.role === 'manager') {
        h += '<div class="c360-fam" style="--c:#221D45">VOTRE REGARD DE MANAGER</div>';
        C360_MG.forEach(function (m2) { h += '<div class="c360-item"><b>' + m2[1] + '</b>' + c360EchHtml(m2[0], 'mg') + '</div>'; });
      }
      h += '<div class="c360-fam" style="--c:#5E59C7">DEUX QUESTIONS OUVERTES</div>'
        + '<div class="c360-item"><b>Un geste à continuer</b><textarea id="c360-continuer" rows="2"></textarea></div>'
        + '<div class="c360-item"><b>Un geste à oser</b><textarea id="c360-oser" rows="2"></textarea></div>'
        + '<button type="button" class="c360-envoi" onclick="App.c360.envoyer()">Envoyer mon regard</button>';
      corps.innerHTML = h;
      const total = 16 + c360Rep.items.length + (ctx.role === 'manager' ? 3 : 0);
      const compte = document.getElementById('c360-compte');
      if (compte) compte.textContent = total + ' comportements à situer, six minutes environ.';
    });
  }
  function c360Envoyer() {
    const corps = document.getElementById('c360-corps');
    c360Post({
      action: 'repondre', jeton: c360Rep.jeton,
      notes: c360Rep.notes, surMesure: c360Rep.sur, managerExtra: c360Rep.mg,
      ouvertes: { continuer: (document.getElementById('c360-continuer') || {}).value || '', oser: (document.getElementById('c360-oser') || {}).value || '' },
    }).then(function (r2) {
      corps.innerHTML = r2 && r2.ok
        ? '<div class="mir-merci-sym">✦</div><div class="esp-rem-titre" role="heading" aria-level="2">Merci, votre regard compte.</div><p class="c360-charge">Anonyme, agrégé avec les autres regards de son rôle.</p>'
        : '<p class="c360-charge">' + echapValeur((r2 && r2.erreur) || 'Envoi impossible, réessayez.') + '</p>';
    });
  }
  function c360Note(btn) {
    const g = btn.getAttribute('data-g'), k = btn.getAttribute('data-k'), v = Number(btn.getAttribute('data-v'));
    const cible = g === 'notes' ? c360Rep.notes : g === 'sur' ? c360Rep.sur : c360Rep.mg;
    if (v === 0) delete cible[k]; else cible[k] = v;
    const freres = btn.parentElement.querySelectorAll('.c360-n');
    freres.forEach(function (b2) { b2.classList.remove('on'); });
    btn.classList.add('on');
    btn.closest('.c360-item').classList.add('fait');
  }
  function c360Html() {
    const c = ((((dataEspaceCourant || {}).interactions || {}).socle || {}).c360) || {};
    const camp = (c.campagnes || [])[0];
    if (!camp) {
      return '<div class="c360-carte"><div class="c360-k">360 PRO · OPTION</div><b>La campagne par rôles, socle + votre fiche de poste</b>'
        + '<p>Manager, pairs, équipe, externes, rapport séparé par regard, items sur mesure extraits de la fiche de poste.</p>'
        + '<button type="button" class="esp-rem-btn" onclick="App.c360.ouvrirCreation()">Créer une campagne</button></div>';
    }
    let h = '<div class="c360-carte"><div class="c360-k">360 PRO · CAMPAGNE EN COURS</div>';
    Object.keys(camp.roles || {}).forEach(function (r2) {
      const inv = camp.roles[r2] || []; if (!inv.length) return;
      const rep = (camp.reponses || []).filter(function (x) { return x.role === r2; }).length;
      h += '<div class="c360-prog"><span>' + r2 + '</span><i><em style="width:' + Math.round(100 * rep / inv.length) + '%"></em></i><small>' + rep + ' / ' + inv.length + '</small>'
        + inv.filter(function (i2) { return !i2.repondu; }).map(function (i2) { return '<button type="button" class="c360-rel" onclick="App.c360.relancer(\'' + i2.jeton + '\')">relancer</button>'; }).join('') + '</div>';
    });
    h += c360Pret(camp) ? '<button type="button" class="c360-envoi" style="margin-top:10px" onclick="App.c360.rapport()">Ouvrir le rapport</button>' : '<p class="c360-charge" style="text-align:left;padding:6px 0 0">Le rapport se débloque quand chaque rôle atteint son seuil.</p>';
    return h + '<div id="c360-rap"></div></div>';
  }
  function c360OuvrirCreation() {
    const slot = document.querySelector('.esp-mir') || document.body;
    slot.insertAdjacentHTML('beforeend', '<div class="c360-carte" id="c360-crea"><div class="c360-k">NOUVELLE CAMPAGNE 360 PRO</div>'
      + ['manager', 'pairs', 'equipe', 'externes'].map(function (r2) { return '<label class="c360-lab">' + r2 + ' · emails séparés par des virgules</label><input type="text" class="c360-in" id="c360-r-' + r2 + '">'; }).join('')
      + '<label class="c360-lab">La fiche de poste, collée</label><textarea class="c360-in" id="c360-fiche" rows="4"></textarea>'
      + '<button type="button" class="esp-rem-btn" onclick="App.c360.proposer()">Proposer les items du poste</button>'
      + '<div id="c360-items"></div>'
      + '<button type="button" class="c360-envoi" onclick="App.c360.lancer()">Lancer la campagne</button>'
      + '<div id="c360-liens"></div></div>');
  }
  function c360Proposer() {
    const zone = document.getElementById('c360-items');
    zone.innerHTML = '<p class="c360-charge">Extraction en cours…</p>';
    c360Post({ action: 'items_fiche', fiche: (document.getElementById('c360-fiche') || {}).value || '' }).then(function (r2) {
      if (!r2 || r2.erreur || !r2.items) { zone.innerHTML = '<p class="c360-charge">' + echapValeur((r2 && r2.erreur) || 'Extraction indisponible.') + '</p>'; return; }
      zone.innerHTML = r2.items.map(function (it, i) {
        return '<div class="c360-item-ed"><input type="text" class="c360-in" value="' + echapValeur(it.intitule) + '" data-ci="' + i + '"><textarea class="c360-in" rows="2" data-cx="' + i + '">' + echapValeur(it.item) + '</textarea><div class="c360-lab" style="margin:2px 0 3px">Votre auto-note</div><div class="c360-ech c360-mini">' + [1, 2, 3, 4, 5].map(function (v2) { return '<button type="button" class="c360-n" data-a="' + i + '" data-v="' + v2 + '" onclick="App.c360.autoNote(this)">' + v2 + '</button>'; }).join('') + '</div><button type="button" class="c360-rel" onclick="this.parentElement.remove()">retirer</button></div>';
      }).join('');
    });
  }
  function c360Lancer() {
    const roles = {};
    ['manager', 'pairs', 'equipe', 'externes'].forEach(function (r2) {
      roles[r2] = ((document.getElementById('c360-r-' + r2) || {}).value || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    });
    const items = Array.prototype.map.call(document.querySelectorAll('#c360-items .c360-item-ed'), function (ed) {
      return { intitule: ed.querySelector('[data-ci]').value, item: ed.querySelector('[data-cx]').value };
    });
    c360Post({ action: 'creer', email: c360Email(), roles: roles, items: items, autoEval: { surMesure: c360Crea.auto }, fiche: (document.getElementById('c360-fiche') || {}).value || '' }).then(function (r2) {
      const zone = document.getElementById('c360-liens');
      if (!r2 || r2.erreur) { zone.innerHTML = '<p class="c360-charge">' + echapValeur((r2 && r2.erreur) || 'Création impossible.') + '</p>'; return; }
      const base = location.origin + location.pathname;
      zone.innerHTML = (typeof r2.credits === 'number' ? '<p class="c360-charge" style="text-align:left;padding:6px 0">Crédit consommé, il vous en reste ' + r2.credits + '.</p>' : '') + '<div class="c360-k" style="margin-top:10px">LES LIENS À ENVOYER</div>' + r2.invites.map(function (i2) {
        return '<div class="c360-lien"><span>' + echapValeur(i2.role) + ' · ' + echapValeur(i2.email) + '</span><input type="text" class="c360-in" readonly value="' + base + '?c360=' + i2.jeton + '"></div>';
      }).join('');
    });
  }
  function c360Relancer(jeton) {
    c360Post({ action: 'relancer', email: c360Email(), jeton: jeton, lienBase: location.origin + location.pathname }).then(function (r2) {
      window.alert(r2 && r2.ok ? 'Relance envoyée, la ' + r2.relances + 'e.' : 'Relance impossible.');
    });
  }

  // ---- Lot 3 : le rapport par rôle, calculé sur place ----
  function c360Pret(camp) {
    return Object.keys(camp.roles || {}).every(function (r2) {
      const inv = camp.roles[r2] || []; if (!inv.length) return true;
      return (camp.reponses || []).filter(function (x) { return x.role === r2; }).length >= (r2 === 'manager' ? 1 : 2);
    });
  }
  function c360Moy(reps, cle, groupe) {
    const vals = reps.map(function (x) { return ((groupe === 'sur' ? x.surMesure : x.notes) || {})[cle]; }).filter(function (v) { return typeof v === 'number'; });
    if (!vals.length) return null;
    return Math.round(vals.reduce(function (a2, b2) { return a2 + b2; }, 0) / vals.length * 20);
  }
  function c360ColsRoles(camp) {
    // Anonymat : un rôle non manager sous deux réponses est fusionné dans "autres".
    const cols = []; const autres = [];
    ['manager', 'pairs', 'equipe', 'externes'].forEach(function (r2) {
      const reps = (camp.reponses || []).filter(function (x) { return x.role === r2; });
      if (!reps.length) return;
      if (r2 !== 'manager' && reps.length < 2) { autres.push.apply(autres, reps); return; }
      cols.push({ nom: r2, reps: reps });
    });
    if (autres.length) cols.push({ nom: 'autres', reps: autres });
    return cols;
  }
  function c360Rapport() {
    const camp = ((((((dataEspaceCourant || {}).interactions || {}).socle || {}).c360) || {}).campagnes || [])[0];
    if (!camp) return;
    const cols = c360ColsRoles(camp);
    const profil = (((dataEspaceCourant || {}).analyses || {}).socle || {}).profil || {};
    const comps = window.Competences.scorer(profil.bigFive || profil.big_five || {}, profil.ecarts || {}, profil.dims || {});
    const selfDe = {}; comps.forEach(function (c2) { selfDe[c2.id] = Math.round(c2.expression); });
    const lignes = window.Competences.REFERENTIEL.map(function (r2) {
      var fam2 = r2.famille;
      const parRole = cols.map(function (c2) { return { nom: c2.nom, v: c360Moy(c2.reps, r2.id, 'notes') }; }).filter(function (x) { return x.v !== null; });
      if (!parRole.length) return null;
      const eux = Math.round(parRole.reduce(function (a2, b2) { return a2 + b2.v; }, 0) / parRole.length);
      return { nom: r2.nom, fam: fam2, self: selfDe[r2.id], eux: eux, parRole: parRole, ecart: eux - (selfDe[r2.id] || 0) };
    }).filter(Boolean).sort(function (a2, b2) { return Math.abs(b2.ecart) - Math.abs(a2.ecart); });
    const ligneHtml = function (l) {
      const badge = l.ecart >= 10 ? '<u class="c360-b c360-b-vert">FORCE CACHÉE</u>' : l.ecart <= -10 ? '<u class="c360-b c360-b-amb">À RENDRE VISIBLE</u>' : '';
      return '<div class="c360-rl"><i class="c360-fdot" style="background:' + ((window.Competences.COULEURS_FAMILLES || {})[l.fam] || '#8A879B') + '"></i><b>' + echapValeur(l.nom) + '</b>' + badge
        + '<div class="c360-rd"><i style="width:' + l.eux + '%"></i>' + (typeof l.self === 'number' ? '<em style="left:' + l.self + '%"></em>' : '') + '</div>'
        + '<small>vous ' + (typeof l.self === 'number' ? l.self : '·') + ' · ' + l.parRole.map(function (x) { return x.nom + ' ' + x.v; }).join(' · ') + '</small></div>';
    };
    const poste = (camp.items || []).map(function (it, i) {
      const parRole = cols.map(function (c2) { return { nom: c2.nom, v: c360Moy(c2.reps, 'i' + i, 'sur') }; }).filter(function (x) { return x.v !== null; });
      if (!parRole.length) return '';
      const autoV = ((camp.autoEval || {}).surMesure || {})['i' + i];
      return '<div class="c360-rl"><b>' + echapValeur(it.intitule) + '</b><small>' + (typeof autoV === 'number' ? 'vous ' + autoV * 20 + ' · ' : '') + parRole.map(function (x) { return x.nom + ' ' + x.v; }).join(' · ') + '</small></div>';
    }).join('');
    const verbatims = (camp.reponses || []).map(function (x) { return x.ouvertes || {}; });
    const vHtml = function (cle, titre) {
      const l2 = verbatims.map(function (o2) { return (o2[cle] || '').trim(); }).filter(Boolean);
      return l2.length ? '<div class="c360-vt"><b>' + titre + '</b>' + l2.map(function (t2) { return '<p>« ' + echapValeur(t2) + ' »</p>'; }).join('') + '</div>' : '';
    };
    const defis = lignes.filter(function (l) { return l.ecart <= -10; }).slice(0, 3).map(function (l) {
      const ref = window.Competences.REFERENTIEL.filter(function (r2) { return r2.nom === l.nom; })[0] || {};
      return '<div class="c360-defi"><span class="planc-src" style="background:#B3701A">360 PRO</span><b>' + echapValeur(l.nom) + ', la rendre visible</b><p>' + echapValeur((ref.progresser || [])[0] || 'Un geste observable cette semaine, raconté au coach.') + '</p></div>';
    }).join('');
    const zone = document.getElementById('c360-rap') || (function () { const d = document.createElement('div'); d.id = 'c360-rap'; (document.querySelector('.c360-carte') || document.body).appendChild(d); return d; })();
    const compte = cols.map(function (c2) { return c2.nom + ' ' + c2.reps.length; }).join(' · ');
    const tete = '<div class="c360-rap-tete"><b>Rapport Feedback 360 · Sinéa</b><span>' + echapValeur((typeof identite === 'object' && identite.prenom) || '') + ' · ' + new Date().toLocaleDateString('fr-FR') + ' · regards : ' + compte + '</span></div>';
    const parFam = ['RELATION', 'ACTION', 'STRUCTURE', 'VISION'].map(function (f2) {
      const g2 = (SINEA_DATA.familles_cle || {})[f2] || {};
      return '<div class="c360-fam" style="--c:' + ((window.Competences.COULEURS_FAMILLES || {})[f2] || '#8A879B') + '">'
        + (g2.symbole ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + g2.symbole + '</svg> ' : '') + f2 + '</div>'
        + lignes.filter(function (l2) { return l2.fam === f2; }).map(ligneHtml).join('');
    }).join('');
    zone.innerHTML = tete
      + '<div class="c360-k" style="margin-top:12px">LE RAPPORT · VOUS, VU PAR EUX</div>'
      + lignes.slice(0, 6).map(ligneHtml).join('')
      + '<details class="c360-tout"><summary>Les ' + window.Competences.REFERENTIEL.length + ' compétences, par famille</summary>' + parFam + '</details>'
      + (poste ? '<div class="c360-k" style="margin-top:10px">◆ LE POSTE</div>' + poste : '')
      + vHtml('continuer', 'À continuer, selon eux') + vHtml('oser', 'À oser, selon eux')
      + (defis ? '<div class="c360-k" style="margin-top:10px">TROIS DÉFIS PROPOSÉS</div>' + defis : '')
      + '<button type="button" class="esp-rem-btn" onclick="window.print()">Imprimer le rapport</button>';
  }
  function c360AutoNote(btn) {
    c360Crea.auto['i' + btn.getAttribute('data-a')] = Number(btn.getAttribute('data-v'));
    btn.parentElement.querySelectorAll('.c360-n').forEach(function (b2) { b2.classList.remove('on'); });
    btn.classList.add('on');
  }
  const c360Api = { note: c360Note, envoyer: c360Envoyer, rapport: c360Rapport, autoNote: c360AutoNote, ouvrirCreation: c360OuvrirCreation, proposer: c360Proposer, lancer: c360Lancer, relancer: c360Relancer };

  (function initC360Invite() {
    const m = location.search.match(/[?&]c360=([a-f0-9]{24,64})/);
    if (!m) return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { rendreC360Repondant(m[1]); });
    else rendreC360Repondant(m[1]);
  })();

  return { c360: c360Api, seDeconnecter, planPourNea, pisteDepuis360, enregistrerResultat, start, telechargerPortraitEspace, showChapterIntro, goToIdentif, goToConnexion, goToCover, goToEspace, sauverAnalyse, envoyerInteractions, autoFill, next, prev, answer, answerSwipe, answerChoixForce, answerCurseur, repartChange, initCover, saveOpen, ouvrirPlanDepuisResto, toggleCompEspace, deplierCompetences, copierBanniere, sparDemarrer, sparChoisirFam, sparSituation, sparEnvoyer, sparDebrief, toggleMatriceEspace, copierMsgMiroir, allerFeedback, mirAller, choisirRelMiroir, ouvrirCompDepuisCarte, filtrerMiroir, envoyerPariMiroir, espTab, cockpitVers, revoirAnalyse, majChecklist, marquerFait, poserChecklist, ouvrirGlossaire, choisirGlossaire, srcPerso, variantePerso, setVariantePerso, ouvrirCodex, getResult: () => result, getPrenom: () => identite.prenom || '' };
})();

// Personnaliser l'accueil dès le chargement (questions, étapes, type)
// Exposer App globalement (pour que result.js puisse appeler App.sauverAnalyse, App.getPrenom, etc.)


window.App = App;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.initCover());
} else {
  App.initCover();
}
