// Marqueur de version et garde d'erreurs globale (source unique)
console.log("Sinea Profile v71 servie");
window.addEventListener('error', function (e) { console.error('[Sinéa v71]', e.message, (e.filename || '') + ':' + (e.lineno || '')); });

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

    // ===== CHAPITRE 1 : SOCLE — qui vous êtes, spontanément (Big Five) =====
    // On entremêle les items du mini-test pour que deux questions de la même dimension
    // ne se suivent pas, ce qui varie le parcours et réduit les biais de réponse en série.
    const miniEntrelace = entrelacerParDimension(d.mini_items);
    miniEntrelace.forEach(it => q.push({ kind: 'swipe', id: it.id, item: it, chap: 'socle' }));
    // Choix forcé Big Five (anti-désirabilité, alimente aussi le score de fiabilité)
    (d.mini_choix_force || []).forEach(it => q.push({ kind: 'choixforce', id: it.id, item: it, chap: 'socle' }));
    const finBloc1 = q.length; // on coupe ici pour faire souffler (mi-parcours du socle)

    // ===== CHAPITRE 1bis : SOCLE 2 — votre style au travail =====
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
    if (!identite.email) return;
    fetch(PROGRESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load_analyse', email: identite.email }),
    })
      .then(r => r.json())
      .then(data => { renderEspace(data || {}); chargerSuiteEspace(data || {}); })
      .catch(() => renderEspace({}));
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
        const carte = (d && d.interactions) || {};
        poserRetourNea(carte);
        poserRemesure(data, carte);
        poserMiroir(data, carte);
        try { poserCockpit(dataEspaceCourant, carte); } catch (e) { console.warn("[Sinéa]", e); }
        try { poserCompetencesEspace(dataEspaceCourant, carte); } catch (e) { console.warn("[Sinéa]", e); }
        poserSeedupEspace(carte);
      })
      .catch(() => {});
  }

  // Le retour commenté : Néa lit les interactions enregistrées, tous parcours
  // confondus (socle, manager, commercial), et accueille la personne avec un
  // mot sur sa progression réelle.
  function poserRetourNea(carte) {
    const slot = document.getElementById('espace-nea');
    if (!slot) return;
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
    slot.innerHTML = '<div class="esp-nea">' +
      '<span class="esp-nea-img"><img src="Nea_detoure_full.png.webp" alt="Néa" onerror="this.style.display=\'none\'"/></span>' +
      '<div class="esp-nea-txt"><div class="esp-nea-label">Néa · votre coach</div><p>' + phrase + '</p></div>' +
      '</div>';
  }

  // ---- Vos compétences : la lecture Sinéa dans l'espace apprenant ----
  // Déterministe, calculé en local depuis le profil déjà chargé : la personne
  // voit ses appuis et ses opportunités, et ses défis SeedUp prennent sens.
  // L'espace en deux onglets : le développement d'un côté, le miroir à part
  function espTab(t){
    const dev = ['espace-cockpit', 'espace-nea', 'espace-remesure', 'espace-competences', 'espace-seedup', 'espace-prog-globale', 'espace-resultats', 'espace-cards', 'espace-compat'];
    const mir = ['espace-miroir'];
    const cache = function (id, visible) { const e = document.getElementById(id); if (e) e.classList.toggle('esp-hide', !visible); };
    dev.forEach(function (id) { cache(id, t === 'dev'); });
    mir.forEach(function (id) { cache(id, t === 'miroir'); });
    document.querySelectorAll('.esp-nav-b').forEach(function (b) {
      const on = b.getAttribute('data-t') === t;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // ===== Le cockpit : l'action du jour, la frise des 90 jours, les engagements =====
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
    let act = null;
    if (jour !== null && jour >= 83 && !remFaite) {
      act = { t: 'Votre re-mesure des 90 jours est ouverte', p: 'Dix minutes pour mesurer le chemin parcouru depuis votre portrait.', cta: 'Faire ma re-mesure', fn: "App.cockpitVers('espace-remesure')" };
    } else if (aJeton && nbRegards === 0) {
      act = { t: 'Votre miroir attend ses premiers regards', p: 'Trois messages prêts à copier vous attendent, trois minutes pour vos collègues.', cta: 'Ouvrir le miroir', fn: "App.espTab('miroir')" };
    } else if (!pistes.length) {
      act = { t: 'Choisissez vos premières actions', p: 'Vos opportunités sont identifiées : reliez-les à des actions concrètes pour lancer le programme.', cta: 'Voir mes compétences', fn: "App.cockpitVers('espace-competences')" };
    } else if (sd.length) {
      const dernier = joursAncres.length ? Math.round((Date.now() - new Date(joursAncres[0] + 'T12:00:00').getTime()) / 86400000) : 99;
      if (dernier >= 3) act = { t: 'Votre jardin attend sa prochaine pousse', p: 'Dernier défi ancré il y a ' + dernier + ' jours. Une petite action aujourd\'hui relance la dynamique.', cta: 'Voir mes défis', fn: "App.cockpitVers('espace-seedup')" };
      else act = { t: 'La dynamique est en route', p: 'Continuez sur votre lancée, chaque défi ancré fait grandir le jardin.', cta: 'Voir mon jardin', fn: "App.cockpitVers('espace-seedup')" };
    } else if (!aJeton && jour !== null && jour >= 7) {
      act = { t: 'Et si vous demandiez un regard extérieur ?', p: 'Le miroir 360 confronte votre lecture à celle de vos collègues, en trois minutes pour eux.', cta: 'Découvrir le miroir', fn: "App.espTab('miroir')" };
    }
    let frise = '';
    if (window.Visuels) {
      frise = Visuels.frise90Svg([
        { label: 'Portrait', pos: 0, fait: true },
        { label: 'Plan choisi', pos: 8, fait: pistes.length > 0 },
        { label: 'Miroir 360', pos: 34, fait: nbRegards >= 2 },
        { label: 'Re-mesure', pos: 100, fait: remFaite },
      ], jour !== null ? Math.min(jour, 90) : null);
    }
    let eng = '';
    if (pistes.length && window.Competences) {
      const compsDefis = new Set(sd.map(function (x) { const mm = Competences.matcherCompetence(x.t || ''); return mm && mm.id; }).filter(Boolean));
      eng = '<div class="esp-cp-titre" style="margin-top:14px">Vos engagements</div>' + pistes.slice(0, 3).map(function (l) {
        const mm = Competences.matcherCompetence(l);
        const enCours = mm && compsDefis.has(mm.id);
        return '<div class="ck-eng"><span class="ck-eng-etat' + (enCours ? ' on' : '') + '">' + (enCours ? '✓ en cours' : 'à lancer') + '</span><span class="ck-eng-txt">' + echapValeur(l) + (mm ? ' <i>· ' + echapValeur(mm.nom) + '</i>' : '') + '</span></div>';
      }).join('');
    }
    if (!act && !frise && !eng) { slot.innerHTML = ''; return; }
    const kick = 'Aujourd' + String.fromCharCode(39) + 'hui';
    slot.innerHTML = '<div class="esp-rem ck">'
      + (act
        ? '<div class="esp-rem-kicker">' + kick + (serie >= 2 ? ' · série de ' + serie + ' jours' : '') + '</div><div class="esp-rem-titre">' + act.t + '</div><p class="ck-p">' + act.p + '</p><button type="button" class="esp-rem-btn" onclick="' + act.fn + '">' + act.cta + '</button>'
        : '<div class="esp-rem-kicker">Votre programme des 90 jours</div>')
      + frise + eng + '</div>';
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
      + '<div class="esp-rem-titre">Là où votre nature vous porte</div>'
      + '<p class="esp-cp-intro">Le potentiel vient de votre nature profonde, l\'expression de votre comportement au travail. Touchez une compétence pour voir ce qu\'elle recouvre et comment la faire grandir.</p>';
    if (pri.appuis.length){
      h += '<div class="esp-cp-titre">Vos terrains d\'appui</div>' + pri.appuis.map(function (c) { return ligne(c, false); }).join('');
    }
    if (pri.opportunites.length){
      h += '<div class="esp-cp-titre">Vos opportunités à investir</div>' + pri.opportunites.map(function (c) { return ligne(c, true); }).join('')
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
    h += '<button type="button" class="esp-rem-btn esp-cp-mat-btn" onclick="App.toggleMatriceEspace()">Voir ma carte des 16</button>'
      + '<div id="esp-cp-matrice" style="display:none">'
      + (window.Visuels ? Visuels.quadrantSvg(comps, { deltas: deltasQ, compact: true }) : '')
      + '</div>';
    h += '</div>';
    slot.innerHTML = h;
  }

  function toggleCompEspace(id){
    const d = document.getElementById('esp-cp-det-' + id);
    const f = document.getElementById('esp-cp-fl-' + id);
    if (!d) return;
    const ouvert = d.style.display !== 'none';
    d.style.display = ouvert ? 'none' : 'block';
    if (f) f.textContent = ouvert ? '▸' : '▾';
  }
  function toggleMatriceEspace(){
    const d = document.getElementById('esp-cp-matrice');
    if (d) d.style.display = d.style.display === 'none' ? 'block' : 'none';
  }


  // ---- Le jardin d'ancrage : les défis de terrain dans l'espace ----
  // SeedUp sème des graines : chaque défi ancré devient une plante, et le
  // parcours devient un jardin. Le personnage de l'archétype y jardine.
  // Le bloc n'apparaît que si des données SeedUp existent pour la personne.
  // Le rythme du jardin : tous les cinq défis, les pousses se consolident
  // en un arbre, l'étape franchie devient un repère permanent du visuel.
  const NOMS_ETAPES_JARDIN = ['Premières pousses', 'Le premier arbre', 'Le bosquet', 'Le jardin s\'enracine', 'Le jardin s\'épanouit', 'Jardin luxuriant'];
  function etapeJardin(nb) {
    const arbres = Math.floor(nb / 5);
    const label = arbres >= NOMS_ETAPES_JARDIN.length ? 'La forêt d\'ancrage' : NOMS_ETAPES_JARDIN[arbres];
    const manque = 5 - (nb % 5 === 0 ? 0 : nb % 5);
    const numero = arbres + 1;
    return { arbres: arbres, label: label, manque: (nb % 5 === 0 ? 5 : manque), numero: numero };
  }
  function slugDeNom(nom) {
    const P = (window.SINEA_DATA && SINEA_DATA.personnages) || {};
    for (const k in P) { if (P[k] && P[k].nom === nom) return k; }
    return '';
  }

  // Jardin génératif déterministe, seconde génération : ciel et soleil,
  // relief en deux plans, ombres portées, herbes folles, cinq essences de
  // pousses, arbres à canopée nuancée et baies aux couleurs des familles,
  // lucioles et papillon. Les arbres restent les étapes franchies (une
  // tous les cinq défis, écriteau numéroté), les pousses le chemin en cours.
  function jardinSvg(nb, slugPerso, nouvelArbre) {
    const arbres = Math.min(Math.floor(nb / 5), 6);
    const plantes = nb % 5;
    const FAM = (window.Competences && window.Competences.COULEURS_FAMILLES_LISTE) || ['#F98272', '#E8951A', '#3EADFF', '#5E59C7'];
    const VERTS = ['#4C8F5D', '#5B9E6B'];
    const sol = 112;
    const x0 = slugPerso ? 94 : 26;
    const xMax = 322;
    const nTotal = arbres + (plantes || 0);
    const posX = function (i, n) { return Math.round(n <= 1 ? (x0 + xMax) / 2 : x0 + (xMax - x0) * (i / (n - 1))); };
    const ombre = function (x, larg) { return '<ellipse cx="' + x + '" cy="' + (sol + 3) + '" rx="' + larg + '" ry="3.2" fill="rgba(70,80,58,0.13)"/>'; };

    let fond = '<circle cx="296" cy="27" r="24" fill="#F6E7B8" opacity="0.28"/><circle cx="296" cy="27" r="14" fill="#F6E7B8" opacity="0.7"/>'
      + '<path d="M0 97 C 80 85, 180 101, 260 91 S 340 96, 340 93 L340 132 L0 132 Z" fill="#E2E7D2"/>'
      + '<path d="M0 112 C 70 104, 150 118, 220 110 S 320 115, 340 109 L340 132 L0 132 Z" fill="#EBE7D8"/>'
      + '<path d="M0 112 C 70 104, 150 118, 220 110 S 320 115, 340 109" stroke="#D9D5C4" stroke-width="1.3" fill="none"/>';
    for (let t = 0; t < 12; t++) {
      const hx = 16 + t * 27 + ((t * 13) % 9);
      const hy = sol + ((t * 7) % 4) - 1;
      fond += '<path d="M' + hx + ' ' + hy + ' q -2 -6 -4 -8 M' + hx + ' ' + hy + ' q 0 -7 1 -9 M' + hx + ' ' + hy + ' q 2 -6 4 -7" stroke="' + VERTS[t % 2] + '" stroke-width="1.3" fill="none" opacity="0.75" stroke-linecap="round"/>';
    }

    let elems = '';
    let idx = 0;

    for (let a = 0; a < arbres; a++) {
      const x = posX(idx, Math.max(nTotal, 2)); idx++;
      const dernier = (a === arbres - 1);
      const numEtape = (Math.floor(nb / 5) > 6 && dernier) ? Math.floor(nb / 5) * 5 : (a + 1) * 5;
      const tronc = '<path d="M' + (x - 3.2) + ' ' + sol + ' C ' + (x - 3.4) + ' ' + (sol - 18) + ', ' + (x - 1.5) + ' ' + (sol - 30) + ', ' + x + ' ' + (sol - 38) + ' C ' + (x + 1.5) + ' ' + (sol - 30) + ', ' + (x + 3.4) + ' ' + (sol - 18) + ', ' + (x + 3.2) + ' ' + sol + ' Z" fill="#8A6244"/>'
        + '<path d="M' + (x - 1.2) + ' ' + (sol - 6) + ' C ' + (x - 1.6) + ' ' + (sol - 16) + ', ' + (x - 0.6) + ' ' + (sol - 24) + ', ' + x + ' ' + (sol - 30) + '" stroke="#6E4C33" stroke-width="0.9" fill="none" opacity="0.6"/>';
      const cy1 = sol - 44;
      const feuillage = '<circle cx="' + (x - 10) + '" cy="' + (cy1 + 2) + '" r="12" fill="#3E7C4F"/>'
        + '<circle cx="' + (x + 10) + '" cy="' + cy1 + '" r="12.5" fill="#4C8F5D"/>'
        + '<circle cx="' + x + '" cy="' + (cy1 - 9) + '" r="11" fill="#5B9E6B"/>'
        + '<circle cx="' + (x - 5) + '" cy="' + (cy1 - 13) + '" r="6" fill="#7CBB8A"/>'
        + '<circle cx="' + (x - 12) + '" cy="' + (cy1 - 3) + '" r="2" fill="' + FAM[a % 4] + '"/>'
        + '<circle cx="' + (x + 9) + '" cy="' + (cy1 + 6) + '" r="2" fill="' + FAM[(a + 2) % 4] + '"/>';
      const montrerEcriteau = (arbres <= 4) || dernier;
      const ecriteau = montrerEcriteau
        ? '<rect x="' + (x + 7) + '" y="' + (sol - 14) + '" width="3" height="14" rx="1.5" fill="#B08D5F"/>'
          + '<rect x="' + (x - 1) + '" y="' + (sol - 23) + '" width="19" height="11.5" rx="3" fill="#E8D9BC" stroke="#C9A876" stroke-width="1"/>'
          + '<circle cx="' + (x + 1.6) + '" cy="' + (sol - 20.4) + '" r="0.9" fill="#A3814F"/>'
          + '<text x="' + (x + 8.5) + '" y="' + (sol - 14.4) + '" text-anchor="middle" font-size="7.5" font-weight="700" fill="#5C4630">' + numEtape + '</text>'
        : '';
      elems += ombre(x, 15) + '<g class="jr-pousse' + ((nouvelArbre && dernier) ? ' jr-arbre-fete' : '') + '" style="animation-delay:' + (0.12 * (idx - 1)).toFixed(2) + 's"><g class="jr-plante">' + tronc + feuillage + ecriteau + '</g></g>';
    }

    for (let i = 0; i < plantes; i++) {
      const x = posX(idx, Math.max(nTotal, 2)); idx++;
      const h = 24 + ((i * 7) % 16);
      const type = (arbres + i) % 5;
      const cFam = FAM[(arbres + i) % 4];
      const tige = '<path d="M' + x + ' ' + sol + ' C ' + (x - 2) + ' ' + (sol - h * 0.5) + ', ' + (x + 2) + ' ' + (sol - h * 0.7) + ', ' + x + ' ' + (sol - h) + '" stroke="#3E7C4F" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
      let corps = '';
      if (type === 0) {
        corps = tige
          + '<path d="M' + x + ' ' + (sol - h * 0.45) + ' q -9 -3 -11 -10 q 9 0 11 10 Z" fill="#5B9E6B"/>'
          + '<path d="M' + x + ' ' + (sol - h * 0.68) + ' q 9 -2 11 -9 q -9 -1 -11 9 Z" fill="#4C8F5D"/>'
          + '<path d="M' + x + ' ' + (sol - h * 0.9) + ' q -7 -3 -8 -9 q 7 0 8 9 Z" fill="#6FB07E"/>';
      } else if (type === 1) {
        const cy = sol - h;
        let petales = '';
        for (let p = 0; p < 6; p++) {
          petales += '<ellipse cx="' + x + '" cy="' + (cy - 5) + '" rx="2.6" ry="5.4" fill="' + cFam + '" transform="rotate(' + (60 * p) + ' ' + x + ' ' + cy + ')"/>';
        }
        corps = tige
          + '<path d="M' + x + ' ' + (sol - h * 0.4) + ' q -8 -2 -10 -8 q 8 0 10 8 Z" fill="#5B9E6B"/>'
          + petales + '<circle cx="' + x + '" cy="' + cy + '" r="3.4" fill="#F5E7C6"/><circle cx="' + x + '" cy="' + cy + '" r="1.4" fill="#E8951A"/>';
      } else if (type === 2) {
        corps = '<circle cx="' + (x - 5) + '" cy="' + (sol - 8) + '" r="8" fill="#4C8F5D"/><circle cx="' + (x + 5) + '" cy="' + (sol - 9) + '" r="9" fill="#5B9E6B"/><circle cx="' + x + '" cy="' + (sol - 15) + '" r="7" fill="#6FB07E"/>'
          + '<circle cx="' + (x - 6) + '" cy="' + (sol - 11) + '" r="2.1" fill="' + cFam + '"/><circle cx="' + (x + 5) + '" cy="' + (sol - 14) + '" r="2.1" fill="' + FAM[(arbres + i + 2) % 4] + '"/><circle cx="' + (x + 1) + '" cy="' + (sol - 6) + '" r="1.9" fill="' + FAM[(arbres + i + 1) % 4] + '"/>';
      } else if (type === 3) {
        corps = '<path d="M' + x + ' ' + sol + ' q -5 -' + (h * 0.7) + ' -9 -' + h + '" stroke="#5B9E6B" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
          + '<path d="M' + x + ' ' + sol + ' q 0 -' + (h * 0.8) + ' 1 -' + (h + 3) + '" stroke="#4C8F5D" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
          + '<path d="M' + x + ' ' + sol + ' q 5 -' + (h * 0.7) + ' 9 -' + (h - 2) + '" stroke="#6FB07E" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
          + '<ellipse cx="' + (x + 1) + '" cy="' + (sol - h - 4) + '" rx="1.6" ry="3.4" fill="#D9C98A"/>';
      } else {
        const cy = sol - h;
        corps = tige
          + '<path d="M' + (x - 4) + ' ' + cy + ' C ' + (x - 4.5) + ' ' + (cy - 8) + ', ' + (x - 1.5) + ' ' + (cy - 10) + ', ' + x + ' ' + (cy - 10) + ' C ' + (x + 1.5) + ' ' + (cy - 10) + ', ' + (x + 4.5) + ' ' + (cy - 8) + ', ' + (x + 4) + ' ' + cy + ' C ' + (x + 2) + ' ' + (cy + 2) + ', ' + (x - 2) + ' ' + (cy + 2) + ', ' + (x - 4) + ' ' + cy + ' Z" fill="' + cFam + '"/>'
          + '<path d="M' + x + ' ' + (cy - 10) + ' L ' + x + ' ' + (cy - 6) + '" stroke="#F5E7C6" stroke-width="1.6" stroke-linecap="round"/>'
          + '<path d="M' + x + ' ' + (sol - h * 0.4) + ' q 9 -2 11 -9 q -9 -1 -11 9 Z" fill="#5B9E6B"/>';
      }
      elems += ombre(x, 8) + '<g class="jr-pousse" style="animation-delay:' + (0.12 * (idx - 1)).toFixed(2) + 's"><g class="jr-plante">' + corps + '</g></g>';
    }

    let faune = '<circle class="jr-luciole" cx="' + (x0 + 26) + '" cy="52" r="1.9" fill="#F4D96B"/>'
      + '<circle class="jr-luciole" style="animation-delay:1.4s" cx="' + (xMax - 34) + '" cy="40" r="1.7" fill="#F4D96B"/>'
      + '<g class="jr-papillon"><path d="M' + (x0 + 74) + ' 46 q -7 -7 -2 -11 q 5 -1 4 9 Z" fill="' + FAM[nb % 4] + '" opacity="0.9"/>'
      + '<path d="M' + (x0 + 76) + ' 46 q 7 -7 2 -11 q -5 -1 -4 9 Z" fill="' + FAM[(nb + 1) % 4] + '" opacity="0.9"/>'
      + '<path d="M' + (x0 + 75) + ' 44 l 0 6" stroke="#5C4630" stroke-width="1.1" stroke-linecap="round"/></g>';

    const perso = slugPerso
      ? ombre(44, 20) + '<image class="jr-perso" href="' + srcPerso(slugPerso) + '" x="12" y="28" width="64" height="86" preserveAspectRatio="xMidYMax meet"/>'
      : '';
    return '<svg class="jr-svg" viewBox="0 0 340 132" role="img" aria-label="Votre jardin d\'ancrage : ' + Math.floor(nb / 5) + ' étape' + (Math.floor(nb / 5) > 1 ? 's' : '') + ' franchie' + (Math.floor(nb / 5) > 1 ? 's' : '') + ', ' + nb + ' défis ancrés">'
      + fond + perso + elems + faune + '</svg>';
  }

  // Le jardin en image partageable : rasterisation du SVG sur canvas,
  // avec le personnage embarqué en data-URL pour éviter tout blocage.
  function exporterJardinImage(nb, slugPerso, labelEtape){
    const suite = function(persoData){
      let svg = jardinSvg(nb, slugPerso);
      if (slugPerso && persoData) svg = svg.split(srcPerso(slugPerso)).join(persoData);
      else if (slugPerso && !persoData) svg = jardinSvg(nb, '');
      svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = function(){
        try {
          const cv = document.createElement('canvas');
          cv.width = 1080; cv.height = 596;
          const cx = cv.getContext('2d');
          const grad = cx.createLinearGradient(0, 0, 0, 596);
          grad.addColorStop(0, '#FDFCF8'); grad.addColorStop(1, '#F1EFE6');
          cx.fillStyle = grad; cx.fillRect(0, 0, 1080, 596);
          cx.fillStyle = '#5E59C7'; cx.font = '700 20px Georgia, serif';
          cx.fillText('MON JARDIN D\'ANCRAGE', 48, 64);
          cx.fillStyle = '#1A1A2E'; cx.font = '800 40px Georgia, serif';
          cx.fillText(labelEtape || '', 48, 116);
          cx.fillStyle = '#6B6B72'; cx.font = '600 22px Georgia, serif';
          cx.fillText(nb + ' défi' + (nb > 1 ? 's' : '') + ' de terrain ancré' + (nb > 1 ? 's' : ''), 48, 152);
          cx.drawImage(img, 40, 176, 1000, 388);
          cx.fillStyle = '#8A879B'; cx.font = '700 18px Georgia, serif';
          cx.fillText('Sinéa Profile · SeedUp', 48, 578);
          cv.toBlob(function(b){
            if (!b) return;
            const a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = 'mon-jardin-ancrage.png';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
          }, 'image/png');
        } catch (e) { console.warn("[Sinéa]", e); }
        URL.revokeObjectURL(url);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); };
      img.src = url;
    };
    if (slugPerso){
      fetch(srcPerso(slugPerso))
        .then(r => r.ok ? r.blob() : Promise.reject())
        .then(b => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(b); }))
        .then(suite)
        .catch(function(){ suite(''); });
    } else suite('');
  }

  function poserSeedupEspace(carte) {
    const slot = document.getElementById('espace-seedup');
    if (!slot) return;
    slot.innerHTML = '';
    const sd = carte.seedup || {};
    const liste = Array.isArray(sd.liste) ? sd.liste.slice() : [];
    if (!liste.length) return;
    liste.sort(function (a, b) { return String(b.d || '').localeCompare(String(a.d || '')); });
    const reussites = liste.map(function (x) { return x.r; }).filter(function (v) { return typeof v === 'number'; });
    const moyR = reussites.length ? Math.round(reussites.reduce(function (a, b) { return a + b; }, 0) / reussites.length * 10) / 10 : null;
    const dateMaj = sd.maj ? new Date(sd.maj).toLocaleDateString('fr-FR') : '';
    const etape = etapeJardin(liste.length);

    // Un arbre vient-il de pousser (étape des cinq défis franchie) ?
    // Grande animation, une seule fois : l'arbre surgit, le ruban, les pétales.
    let fete = false;
    try {
      const cleP = 'sinea_jardin_etape';
      const precedent = parseInt(localStorage.getItem(cleP) || '0', 10);
      if (etape.arbres > precedent) fete = true;
      localStorage.setItem(cleP, String(etape.arbres));
    } catch (e) { console.warn("[Sinéa]", e); }

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

    const slugP = slugDeNom(monArchetype);
    const fleursFete = (window.Competences && window.Competences.COULEURS_FAMILLES_LISTE) || ['#F98272', '#E8951A', '#3EADFF', '#5E59C7'];
    const confetti = fete
      ? '<div class="jr-confetti">' + [0, 1, 2, 3, 4, 5].map(function (i) {
          return '<i style="left:' + (12 + i * 14) + '%;animation-delay:' + (i * 0.12).toFixed(2) + 's;background:' + fleursFete[i % 4] + '"></i>';
        }).join('') + '</div>'
      : '';
    const ordinal = etape.numero === 1 ? 'premier' : etape.numero + 'e';
    const suivantTxt = 'encore ' + etape.manque + ' défi' + (etape.manque > 1 ? 's' : '') + ' avant votre ' + ordinal + ' arbre';

    slot.innerHTML = '<div class="esp-rem esp-sd">'
      + '<div class="esp-rem-kicker">SeedUp · Votre jardin d\'ancrage</div>'
      + '<div class="esp-rem-titre">' + etape.label + '</div>'
      + '<div class="jr-wrap">' + (fete ? '<div class="jr-etape">Étape franchie · ' + (etape.arbres * 5) + ' défis ancrés</div>' : '') + confetti + jardinSvg(liste.length, slugP, fete) + '</div>'
      + '<div class="esp-sd-stats">' + liste.length + ' défi' + (liste.length > 1 ? 's' : '') + ' planté' + (liste.length > 1 ? 's' : '')
      + (moyR !== null ? ' · réussite moyenne ' + moyR + '/10' : '')
      + ' · ' + suivantTxt
      + (dateMaj ? ' · mis à jour le ' + dateMaj : '') + '</div>'
      + '<button type="button" class="esp-rem-btn esp-sd-btn" id="jr-partage">Partager mon jardin (image)</button>'
      + '<div class="esp-sd-soustitre">Vos défis, un à un</div>'
      + liste.slice(0, 3).map(carteDefi).join('')
      + (liste.length > 3 ? '<div id="esp-sd-reste" style="display:none">' + liste.slice(3).map(carteDefi).join('') + '</div><button type="button" class="esp-rem-btn esp-sd-btn" id="esp-sd-plus">Voir mes ' + liste.length + ' défis</button>' : '')
      + '<p class="esp-sd-canal">Retrouvez l\'expérience complète dans votre application SeedUp.</p>'
      + '</div>';
    const partage = document.getElementById('jr-partage');
    if (partage) partage.onclick = function(){ exporterJardinImage(liste.length, slugP, etape.label); };
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
      <div class="esp-rem-titre">Votre adaptation a-t-elle évolué ?</div>
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
      <div class="esp-rem-titre">Votre comportement réel au travail, aujourd'hui</div>
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
      <div class="esp-rem-titre">Coût d'adaptation : ${avant !== null ? avant + ' <span class="esp-rem-fleche">›</span> ' : ''}${apres}</div>
      <div class="esp-rem-cout">Niveau ${mesure.cout}${dateTxt ? ' · re-mesuré le ' + dateTxt : ''}</div>
      <div class="esp-nea" style="margin-top:12px"><span class="esp-nea-img"><img src="Nea_detoure_full.png.webp" alt="Néa" onerror="this.style.display='none'"/></span><div class="esp-nea-txt"><div class="esp-nea-label">Néa · votre coach</div><p>${phrase}</p></div></div>
      ${proposerNouvelle ? '<button type="button" class="esp-rem-btn" id="esp-rem-encore">Re-mesurer à nouveau</button>' : ''}
    </div>`;
    const enc = document.getElementById('esp-rem-encore');
    if (enc) enc.onclick = function () { ouvrirFormRemesure(slot); };
  }

  // ---- Miroir 360 léger : le regard des collègues, comparé au profil ----
  // Deux collègues au moins répondent à cinq questions par un lien anonyme.
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
    { d: 'conseil', type: 'texte', label: 'Un conseil pour grandir', texte: 'Si vous aviez un conseil à lui donner pour progresser, ce serait…' },
  ];
  const MIROIR_ANCRES = { 1: 'Pas du tout', 2: 'Plutôt pas', 3: 'Plutôt oui', 4: 'Tout à fait' };
  const MIROIR_CONV = { 1: 0.0, 2: 33.333, 3: 66.667, 4: 100.0 };
  let _mirRep = {};

  // Perception agrégée par dimension, avec le même adoucissement doux que le profil adapté
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

  function guideMiroirHtml(){
    const msgs = [
      { cible: 'À un pair', txt: "Salut ! Je viens de faire mon profil Sinéa et il me propose un miroir 360 : ton regard extérieur en 3 minutes, anonyme et agrégé avec d'autres. Ça m'aiderait vraiment à progresser. Voici le lien : [LIEN]. Merci !" },
      { cible: 'À votre manager', txt: "Bonjour, dans le cadre de mon parcours Sinéa, je recueille quelques regards extérieurs sur mes compétences (3 minutes, réponses agrégées). Votre point de vue compterait beaucoup pour cibler mes axes de progression. Le lien : [LIEN]. Merci d'avance." },
      { cible: 'À un collaborateur ou client interne', txt: "Bonjour, je travaille sur mon développement et j'aimerais votre regard honnête sur ma façon de collaborer (3 minutes, anonyme dans l'agrégat). Votre avis m'est précieux : [LIEN]. Merci beaucoup !" },
    ];
    return '<div class="esp-mir-guide">'
      + '<p class="esp-mir-principe"><b>Le principe.</b> Vous vous êtes décrit ; le miroir recueille comment les autres vous vivent. L\'écart entre les deux est la matière la plus riche du développement : ce que vous sous-estimez, ce que vous surestimez, ce que tout le monde voit sauf vous.</p>'
      + '<p class="esp-mir-principe"><b>À qui demander.</b> Visez 3 à 5 personnes qui vous voient vraiment travailler, en mélangeant les angles : votre manager, un ou deux pairs, quelqu\'un que vous encadrez ou un client interne. Les réponses sont agrégées : personne n\'est identifiable.</p>'
      + '<div class="esp-mir-msgs">' + msgs.map(function (m) {
        return '<div class="esp-mir-msg"><div class="esp-mir-msg-cible">' + m.cible + '</div><p class="esp-mir-msg-txt">' + m.txt.replace('[LIEN]', '<i>[votre lien]</i>') + '</p><button type="button" class="esp-rem-btn esp-mir-msg-btn" data-msg="' + echapValeur(m.txt) + '" onclick="App.copierMsgMiroir(this)">Copier ce message</button></div>';
      }).join('') + '</div></div>';
  }

  function copierMsgMiroir(btn){
    const inp = document.getElementById('esp-mir-input');
    const lien = (inp && inp.value) || '';
    const txt = String(btn.getAttribute('data-msg') || '').replace('[LIEN]', lien || '[créez votre lien ci-dessous]');
    const fini = function(){ const av = btn.textContent; btn.textContent = 'Copié ✓'; setTimeout(function(){ btn.textContent = av; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(fini).catch(function(){});
    else {
      const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); fini(); } catch (e) {} ta.remove();
    }
  }

  function poserMiroir(data, carte) {
    const slot = document.getElementById('espace-miroir');
    if (!slot || !identite.email) return;
    slot.innerHTML = '';
    const socle = (data && data.analyses && data.analyses.socle) || null;
    const na = socle && socle.profil && socle.profil.naturelAdapte;
    if (!na || !na.adapte) return;
    const mir = carte.miroir || {};
    const jeton = mir.jeton || '';
    const reponses = mir.reponses || [];
    if (!jeton) {
      slot.innerHTML = `<div class="esp-rem esp-mir">
        <div class="esp-rem-kicker">Miroir 360</div>
        <div class="esp-rem-titre">Le regard de vos collègues</div>
        <p class="esp-rem-txt">Invitez deux collègues à répondre à cinq questions, une minute, réponses anonymes. Vous découvrez l'écart entre la perception des autres et votre propre lecture.</p>
        ${guideMiroirHtml()}<button type="button" class="esp-rem-btn" id="esp-mir-init">Créer mon lien d'invitation</button>
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
            if (d && d.ok && d.jeton) { carte.miroir = { jeton: d.jeton, reponses: [] }; poserMiroir(data, carte); }
            else b.disabled = false;
          })
          .catch(function () { b.disabled = false; });
      };
      return;
    }
    const lien = location.origin + location.pathname + '?miroir=' + jeton;
    const blocLien = guideMiroirHtml() + `<div class="esp-mir-lien"><input type="text" class="esp-mir-input" id="esp-mir-input" value="${lien}" readonly /><button type="button" class="esp-rem-btn esp-mir-copie" id="esp-mir-copie">Copier</button></div>`;
    if (reponses.length < 2) {
      const attente = reponses.length === 1
        ? '1 réponse reçue. L\'analyse s\'ouvre à la deuxième, pour préserver l\'anonymat.'
        : 'Aucune réponse pour l\'instant. Envoyez ce lien à deux collègues, leurs réponses restent anonymes.';
      slot.innerHTML = `<div class="esp-rem esp-mir">
        <div class="esp-rem-kicker">Miroir 360</div>
        <div class="esp-rem-titre">Le regard de vos collègues</div>
        <p class="esp-rem-txt">${attente}</p>
        ${blocLien}
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
      const lignes = '<div class="esp-cp-titre" style="margin-top:4px">Tous les regards, du plus grand écart au plus petit</div>'
        + tableau.map(function (t, i) {
          const delta = (t.g > 0 ? '+' : '') + Math.round(t.g);
          return `<div class="esp-mir-row${i < 2 && Math.abs(t.g) >= 10 ? ' esp-mir-gapmax' : ''}" data-d="${t.q.d}"><span class="esp-mir-lab">${t.q.label}</span><span class="esp-mir-vals">Eux ${Math.round(t.p)} · Vous ${Math.round(t.v)} <span class="esp-mir-delta${t.g >= 0 ? ' pos' : ' neg'}">${delta}</span></span></div>`;
        }).join('');
      const radarHtml = (window.Visuels && window.Visuels.radarMiroirSvg) ? Visuels.radarMiroirSvg(vous, percu) : '';
      const conseilsRecus = reponses.map(function (rep) { return String((rep.r || {}).conseil || '').trim(); }).filter(function (t) { return t.length > 2; }).slice(0, 6);
      const conseilsHtml = conseilsRecus.length
        ? '<div class="esp-cp-titre" style="margin-top:14px">Les conseils reçus</div>' + conseilsRecus.map(function (t) { return '<p class="esp-mir-conseil">« ' + echapValeur(t) + ' »</p>'; }).join('')
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
        <div class="esp-rem-kicker">Miroir 360 · ${reponses.length} regards</div>
        <div class="esp-rem-titre">Vu par vos collègues, comparé à vous au travail</div>
        ${radarHtml}
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
    ov.innerHTML = '<div class="mir-card">' +
      '<div class="mir-head"><span class="esp-nea-img"><img src="Nea_detoure_full.png.webp" alt="Néa" onerror="this.style.display=\'none\'"/></span>' +
      '<div><div class="esp-rem-kicker">Miroir Sinéa</div><div class="esp-rem-titre">Votre regard sur un collègue</div></div></div>' +
      '<p class="esp-rem-txt">Une personne de votre entourage professionnel vous invite à partager votre perception. Douze regards et un conseil, trois minutes. Vos réponses sont anonymes et agrégées avec celles d\'autres collègues.</p>' +
      lignes +
      '<button type="button" class="esp-rem-btn" id="mir-valider" disabled>Envoyer mon regard</button>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('.esp-rem-opt').forEach(function (b) {
      b.onclick = function () {
        const q = this.getAttribute('data-q');
        _mirRep[q] = parseInt(this.getAttribute('data-v'), 10);
        ov.querySelectorAll('.esp-rem-opt[data-q="' + q + '"]').forEach(function (x) { x.classList.remove('on'); });
        this.classList.add('on');
        const btn = document.getElementById('mir-valider');
        if (btn && Object.keys(_mirRep).length >= MIROIR_QUESTIONS.length) btn.disabled = false;
      };
    });
    const val = document.getElementById('mir-valider');
    if (val) val.onclick = function () {
      val.disabled = true;
      val.textContent = 'Envoi...';
      fetch(PROGRESSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'miroir_repondre', jeton: jeton, reponses: Object.assign({}, _mirRep, { conseil: ((document.getElementById('mir-conseil') || {}).value || '').trim() || undefined }) }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          const carteMerci = d && d.ok
            ? '<div class="esp-rem-titre">Merci pour votre regard</div><p class="esp-rem-txt">Votre perception est enregistrée, de façon anonyme. Elle aidera votre collègue à mieux se connaître.</p>'
            : (d && d.raison === 'complet'
              ? '<div class="esp-rem-titre">Ce miroir est complet</div><p class="esp-rem-txt">Cette personne a déjà reçu le nombre maximal de regards. Merci pour votre intention.</p>'
              : '<div class="esp-rem-titre">Lien inconnu</div><p class="esp-rem-txt">Ce lien d\'invitation ne correspond à aucun profil. Demandez un nouveau lien à la personne qui vous a invité.</p>');
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
    const droitsTxt = (data.droits || droits || '').toLowerCase();
    const progression = data.progression || {};

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
      const slugImg = archetype ? (SINEA_DATA.images && SINEA_DATA.images[archetype]) : '';
      if (slugImg) {
        persoEl.innerHTML = `<img src="${srcPerso(slugImg)}" alt="${archetype}" onerror="${onerrPerso(slugImg)}" />`;
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
    const codexCta = '<div class="espace-label">Explorer</div>' +
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
      const slugImg = (SINEA_DATA.images && SINEA_DATA.images[p.nom]) ? SINEA_DATA.images[p.nom] : '';
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
        ((window.SINEA_EMBLEMES && window.SINEA_EMBLEMES[p.nom]) ? '<div class="codex-fiche-embleme"><span class="codex-emb-ic" style="color:' + ({RELATION:'#F98272',ACTION:'#F5A623',STRUCTURE:'#3EADFF',VISION:'#5E59C7'}[(p.famille||'').toUpperCase()]||'#5E59C7') + '">' + window.SINEA_EMBLEMES[p.nom].svg + '</span><div class="codex-emb-txt"><span class="codex-emb-objet">Emblème, ' + echapValeur(window.SINEA_EMBLEMES[p.nom].objet) + '</span><span class="codex-emb-phrase">' + echapValeur(window.SINEA_EMBLEMES[p.nom].phrase) + '</span></div></div>' : '') +
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
        const slugImg = (SINEA_DATA.images && SINEA_DATA.images[p.nom]) ? SINEA_DATA.images[p.nom] : '';
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
    const slug = (archetype && SINEA_DATA.images && SINEA_DATA.images[archetype]) ? SINEA_DATA.images[archetype] : '';
    const persoHtml = (mod === 'socle' && slug) ? `<div class="esp-res-perso"><img src="${srcPerso(slug)}" alt="${archetype}" onerror="${onerrPerso(slug)}"/></div>` : '';
    return `<div class="esp-resultat">
      <div class="esp-res-glow"></div>
      <div class="esp-res-in">
        <div class="esp-res-texte">
          <div class="esp-res-badge">Complété · 100%</div>
          <div class="esp-res-title">${l.titre}</div>
          ${dateLigne}
          <div class="esp-res-actions">
            <button class="esp-res-btn" data-revoir="${mod}">Consulter mon analyse</button>
            <button class="esp-res-btn esp-res-btn-plan" data-plan="${mod}">Mon plan d'action</button>
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

  // ---- PLAN D'ACTION : page dédiée dans l'espace perso ----
  // Recharge le profil (pour personnaliser) + les interactions (ce que la personne a coché),
  // puis met en page une feuille de route motivante, du socle vers l'action.
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
      afficherPagePlan(mod, profil, inter, suiviSauve);
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

  function afficherPagePlan(mod, profil, inter, suiviSauve) {
    let scr = document.getElementById('screen-plan');
    if (!scr) {
      scr = document.createElement('section');
      scr.id = 'screen-plan';
      scr.className = 'screen';
      (document.querySelector('.app') || document.body).appendChild(scr);
    }
    const archetype = (profil.dominante && profil.dominante.nom) || '';
    const famille = (profil.dominante && profil.dominante.famille) || 'VISION';
    const slug = (archetype && SINEA_DATA.images && SINEA_DATA.images[archetype]) ? SINEA_DATA.images[archetype] : '';

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
        '<div class="plan-hero-kicker">Votre feuille de route</div>' +
        '<h1 class="plan-hero-titre">Votre plan d\'action</h1>' +
        (archetype ? '<p class="plan-hero-sub">Taillé pour ' + echapValeur(archetype) + ' que vous êtes. Voici par où commencer.</p>' : '<p class="plan-hero-sub">Voici par où commencer.</p>') +
      '</div>';

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
        }
        rendrePlanActions(scr, mod, heroHtml, fusionnerSuivi(actions, suiviSauve), synthese);
      })
      .catch(() => {
        // repli : si l'IA échoue, on affiche au moins les éléments cochés
        const repli = construireReplisPlan(forces, vigilances, objectifs);
        rendrePlanActions(scr, mod, heroHtml, fusionnerSuivi(repli, suiviSauve), '');
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
    forces.forEach(f => out.push({ thematique: 'Force', type: 'Capitaliser', horizon: 'Bientôt', objectif: f, premier_pas: 'Repérez cette semaine une situation où mobiliser ce point.', indicateur: 'Vous l\'activez consciemment au moins une fois.' }));
    vigilances.forEach(v => out.push({ thematique: 'Progression', type: 'Progresser', horizon: 'Maintenant', objectif: v, premier_pas: 'Choisissez une occasion proche pour vous y exercer.', indicateur: 'Vous observez un premier ajustement concret.' }));
    objectifs.forEach(o => out.push({ thematique: 'Développement', type: 'Explorer', horizon: 'Plus tard', objectif: o, premier_pas: 'Réservez un moment pour vous documenter ou en parler.', indicateur: 'Vous franchissez une première étape visible.' }));
    return out;
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
      return '<div class="planc" data-i="' + i + '">' +
        '<div class="planc-head">' +
          '<span class="plan-them">' + echapValeur(a.thematique) + '</span>' +
          '<span class="plan-type ' + classeType(a.type) + '">' + echapValeur(a.type) + '</span>' +
          '<button class="planc-horizon ' + classeHorizon(a.horizon) + '" data-horizon="' + i + '" title="Ajuster l\'horizon">' + echapValeur(a.horizon) + '</button>' +
        '</div>' +
        '<p class="planc-obj">' + echapValeur(objDe(a)) + '</p>' +
        (pas ? '<div class="planc-layer planc-pas"><span class="planc-ic">▸</span><div class="planc-layer-txt"><span class="planc-lab">Premier pas</span><p>' + echapValeur(pas) + '</p></div></div>' : '') +
        (ind ? '<div class="planc-layer planc-ind"><span class="planc-ic">◎</span><div class="planc-layer-txt"><span class="planc-lab">Vous saurez que c\'est acquis</span><p>' + echapValeur(ind) + '</p></div></div>' : '') +
        '<div class="planc-suivi">' +
          '<button class="plan-statut ' + classeStatut(statut) + '" data-statut="' + i + '">' + libStatut(statut) + '</button>' +
          '<button class="plan-ressenti-btn' + (aRessenti ? ' a-note' : '') + '" data-ressenti="' + i + '" title="Laisser un ressenti">' + (aRessenti ? '✏️ Mon ressenti' : '💬 Laisser un ressenti') + '</button>' +
        '</div>' +
      '</div>';
    }).join('');

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
      '<div class="plan-cards">' + cartes + '</div>' +
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
      sauverSuiviPlan(mod, actions);
      fermer();
    };
  }

  // Envoi du suivi (statuts + ressentis) au serveur, pour remontée dans le tableau de bord
  function sauverSuiviPlan(mod, actions) {
    if (!identite.email) return;
    const suivi = actions.map(a => ({
      thematique: a.thematique, objectif: a.objectif || a.objectif_smart || '',
      statut: a.statut || 'À faire', ressenti: a.ressenti || '', horizon: a.horizon || ''
    }));
    fetch(PROGRESSION_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_plan_suivi', email: identite.email, module: mod, suivi: suivi }),
    }).catch(() => { /* silencieux : le suivi local reste affiché */ });
  }

  // active l'écran plan et branche les boutons communs (retour, revoir, seedup)
  function activerScreenPlan(scr, mod) {
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
                  result.fiabilite.niveau = 'bonne';
                  result.fiabilite.message = 'Profil confirmé par vos précisions. Résultats fiables.';
                  result.fiabilite.affine = true;
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
    const slug = (SINEA_DATA.images && SINEA_DATA.images[dom.nom]) ? SINEA_DATA.images[dom.nom] : '';
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
      const emb = (window.SINEA_EMBLEMES || {})[dom.nom];
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
        if (vid) { try { vid.play(); } catch (e) { console.warn("[Sinéa]", e); } }
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

  return { start, telechargerPortraitEspace, showChapterIntro, goToIdentif, goToConnexion, goToCover, goToEspace, sauverAnalyse, envoyerInteractions, autoFill, next, prev, answer, answerSwipe, answerChoixForce, answerCurseur, repartChange, initCover, saveOpen, ouvrirPlanDepuisResto, toggleCompEspace, toggleMatriceEspace, copierMsgMiroir, espTab, cockpitVers, srcPerso, variantePerso, setVariantePerso, ouvrirCodex, getResult: () => result, getPrenom: () => identite.prenom || '' };
})();

// Personnaliser l'accueil dès le chargement (questions, étapes, type)
// Exposer App globalement (pour que result.js puisse appeler App.sauverAnalyse, App.getPrenom, etc.)
window.App = App;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.initCover());
} else {
  App.initCover();
}
