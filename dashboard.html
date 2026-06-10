<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Sinéa Profile · Pilotage</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --c-purple:#8884F0; --c-purple-text:#5E59C7; --c-corail:#F98272; --c-orange:#F9A876;
    --c-bleu:#5474F5; --c-violet:#8884F0;
    --c-dark:#1A1A1A; --c-grey:#747474; --c-light:#F5F4F0; --c-border:#ECE6F5;
    --fam-relation:#F98272; --fam-action:#F9A876; --fam-structure:#5474F5; --fam-vision:#8884F0;
    --font:'Poppins',-apple-system,sans-serif;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:var(--font);background:#FAF9F6;color:var(--c-dark);line-height:1.5;}

  /* écran de connexion */
  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 30% 20%, #F98272 0%, #6E3D82 55%, #0F1232 100%);}
  .login-card{background:#fff;border-radius:24px;padding:40px 34px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);}
  .login-logo{font-size:22px;font-weight:800;color:var(--c-purple-text);margin-bottom:6px;}
  .login-sub{font-size:14.5px;color:var(--c-grey);margin-bottom:24px;}
  .login-input{width:100%;border:1.5px solid var(--c-border);border-radius:14px;padding:14px 16px;font-family:var(--font);font-size:15px;outline:none;margin-bottom:12px;}
  .login-input:focus{border-color:var(--c-purple);}
  .login-btn{width:100%;background:var(--c-purple-text);color:#fff;border:none;border-radius:14px;padding:15px;font-family:var(--font);font-size:15px;font-weight:700;cursor:pointer;}
  .login-err{color:var(--c-corail);font-size:13.5px;margin-bottom:12px;min-height:18px;}

  /* dashboard */
  .dash{display:none;max-width:1100px;margin:0 auto;padding:28px 22px 80px;}
  .dash.active{display:block;}
  .dash-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;}
  .dash-title{font-size:26px;font-weight:800;}
  .dash-title span{color:var(--c-purple-text);}
  .dash-logout{background:none;border:1.5px solid var(--c-border);border-radius:10px;padding:9px 16px;font-family:var(--font);font-size:13.5px;font-weight:600;color:var(--c-grey);cursor:pointer;}

  /* cartes de stats globales */
  .stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:30px;}
  .stat-card{background:#fff;border:1px solid var(--c-border);border-radius:16px;padding:20px;}
  .stat-num{font-size:34px;font-weight:800;color:var(--c-purple-text);line-height:1;}
  .stat-label{font-size:13px;color:var(--c-grey);margin-top:6px;}

  /* entreprises */
  .ent-block{background:#fff;border:1px solid var(--c-border);border-radius:18px;padding:22px;margin-bottom:18px;}
  .ent-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;}
  .ent-nom{font-size:19px;font-weight:800;}
  .ent-meta{font-size:13.5px;color:var(--c-grey);}
  .camp-row{display:flex;align-items:center;gap:14px;padding:14px;border:1px solid var(--c-border);border-radius:12px;margin-bottom:10px;cursor:pointer;transition:border-color 0.15s, transform 0.15s;}
  .camp-row:hover{border-color:var(--c-purple);transform:translateX(2px);}
  .camp-info{flex:1;min-width:0;}
  .camp-nom{font-size:15.5px;font-weight:700;}
  .camp-code{font-size:12.5px;color:var(--c-grey);font-family:monospace;margin-top:2px;}
  .camp-type{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;padding:3px 9px;border-radius:20px;margin-left:8px;background:rgba(94,89,199,0.12);color:var(--c-purple-text);}
  .camp-quota{text-align:right;font-size:13px;color:var(--c-grey);white-space:nowrap;}
  .camp-quota b{color:var(--c-dark);font-size:16px;}
  .camp-jauge{width:120px;height:8px;background:var(--c-light);border-radius:10px;overflow:hidden;margin-top:6px;}
  .camp-jauge-fill{height:100%;background:linear-gradient(90deg,var(--c-purple),var(--c-purple-text));border-radius:10px;}
  .fam-mini{display:flex;gap:4px;margin-top:8px;}
  .fam-dot{width:18px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;}

  /* vue détail campagne */
  .detail-back{background:none;border:none;color:var(--c-purple-text);font-family:var(--font);font-size:14px;font-weight:600;cursor:pointer;margin-bottom:18px;}
  .detail-head{margin-bottom:24px;}
  .detail-nom{font-size:24px;font-weight:800;}
  .detail-meta{font-size:14px;color:var(--c-grey);margin-top:4px;}
  .repartition{background:#fff;border:1px solid var(--c-border);border-radius:18px;padding:22px;margin-bottom:20px;}
  .repartition h3{font-size:16px;font-weight:800;margin-bottom:16px;}
  .fam-bars{display:flex;flex-direction:column;gap:12px;}
  .fam-bar-row{display:flex;align-items:center;gap:12px;}
  .fam-bar-label{width:90px;font-size:13.5px;font-weight:600;}
  .fam-bar-track{flex:1;height:26px;background:var(--c-light);border-radius:8px;overflow:hidden;}
  .fam-bar-fill{height:100%;border-radius:8px;display:flex;align-items:center;padding:0 10px;color:#fff;font-size:12.5px;font-weight:700;min-width:28px;transition:width 0.5s;}
  .membres{background:#fff;border:1px solid var(--c-border);border-radius:18px;padding:22px;}
  .membres h3{font-size:16px;font-weight:800;margin-bottom:16px;}
  .membre-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--c-light);}
  .membre-row:last-child{border-bottom:none;}
  .membre-pastille{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;}
  .membre-info{flex:1;min-width:0;}
  .membre-nom{font-size:14.5px;font-weight:600;}
  .membre-arch{font-size:12.5px;color:var(--c-grey);}
  .membre-statut{font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:3px 10px;border-radius:20px;}
  .statut-termine{background:rgba(63,174,110,0.14);color:#2E9359;}
  .statut-attente{background:rgba(249,168,118,0.16);color:#C77A35;}
  .loading{text-align:center;padding:50px;color:var(--c-grey);}
  .empty{text-align:center;padding:40px;color:var(--c-grey);font-size:14.5px;}

  /* analyse stratégique */
  .analyse-cta-block{display:flex;align-items:center;justify-content:space-between;gap:16px;background:linear-gradient(135deg,#6E3D82,#2A1B4A);border-radius:18px;padding:22px;margin-bottom:20px;flex-wrap:wrap;}
  .analyse-cta-titre{font-size:17px;font-weight:800;color:#fff;}
  .analyse-cta-sub{font-size:13.5px;color:rgba(255,255,255,0.8);margin-top:4px;max-width:520px;}
  .analyse-cta-btn{background:#fff;color:var(--c-purple-text);border:none;border-radius:12px;padding:13px 22px;font-family:var(--font);font-size:14.5px;font-weight:700;cursor:pointer;white-space:nowrap;}
  .analyse-cta-btn:disabled{opacity:0.6;cursor:default;}
  .analyse-result{background:#fff;border:1px solid var(--c-border);border-radius:18px;padding:24px;margin-bottom:20px;}
  .analyse-badge{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;background:rgba(94,89,199,0.12);color:var(--c-purple-text);padding:4px 11px;border-radius:20px;margin-bottom:14px;}
  .analyse-synthese{font-size:15.5px;line-height:1.6;color:var(--c-dark);margin-bottom:22px;font-weight:500;}
  .swot-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px;}
  .swot-card{border-radius:14px;padding:16px 18px;}
  .swot-titre{font-size:13px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:10px;}
  .swot-card ul{list-style:none;display:flex;flex-direction:column;gap:8px;}
  .swot-card li{font-size:13.5px;line-height:1.45;padding-left:16px;position:relative;}
  .swot-card li::before{content:"";position:absolute;left:2px;top:7px;width:6px;height:6px;border-radius:50%;}
  .swot-forces{background:rgba(63,174,110,0.09);} .swot-forces .swot-titre{color:#2E9359;} .swot-forces li::before{background:#3Fae6e;}
  .swot-faiblesses{background:rgba(249,168,118,0.1);} .swot-faiblesses .swot-titre{color:#C77A35;} .swot-faiblesses li::before{background:#F9A876;}
  .swot-opportunites{background:rgba(84,116,245,0.08);} .swot-opportunites .swot-titre{color:#3A57C7;} .swot-opportunites li::before{background:#5474F5;}
  .swot-risques{background:rgba(249,130,114,0.09);} .swot-risques .swot-titre{color:#C8503F;} .swot-risques li::before{background:#F98272;}
  .analyse-section{margin-bottom:22px;}
  .analyse-section h4{font-size:15px;font-weight:800;margin-bottom:10px;}
  .analyse-section p{font-size:14px;line-height:1.6;color:var(--c-dark);}
  .liste-rh{list-style:none;display:flex;flex-direction:column;gap:9px;}
  .liste-rh li{font-size:14px;line-height:1.45;padding-left:18px;position:relative;}
  .liste-rh li::before{content:"";position:absolute;left:3px;top:7px;width:7px;height:7px;border-radius:50%;background:var(--c-purple);}
  .plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .plan-item{background:var(--c-light);border-radius:12px;padding:14px 16px;}
  .plan-titre{font-size:14px;font-weight:700;color:var(--c-purple-text);margin-bottom:5px;}
  .plan-desc{font-size:13px;line-height:1.45;color:var(--c-dark);}
  .focus-grid{display:flex;flex-direction:column;gap:10px;}
  .focus-item{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--c-border);border-radius:12px;padding:13px 16px;}
  .focus-nom{font-size:13.5px;font-weight:700;color:var(--c-dark);min-width:120px;flex-shrink:0;}
  .focus-conseil{font-size:13px;line-height:1.45;color:var(--c-grey);}
  @media (max-width:680px){ .swot-grid{grid-template-columns:1fr;} .plan-grid{grid-template-columns:1fr;} .focus-item{flex-direction:column;gap:4px;} .focus-nom{min-width:0;} }
  @media (max-width:680px){ .stats-row{grid-template-columns:1fr;} .camp-row{flex-wrap:wrap;} }
</style>
</head>
<body>

<div class="login-wrap" id="login">
  <div class="login-card">
    <div class="login-logo">Sinéa Profile</div>
    <div class="login-sub">Espace de pilotage. Entrez votre clé d'accès.</div>
    <div class="login-err" id="login-err"></div>
    <input class="login-input" id="login-key" type="password" placeholder="Clé d'accès" />
    <button class="login-btn" id="login-btn">Accéder au tableau de bord</button>
  </div>
</div>

<div class="dash" id="dash">
  <div class="dash-head">
    <div class="dash-title">Pilotage <span>Sinéa Profile</span></div>
    <button class="dash-logout" id="logout">Se déconnecter</button>
  </div>
  <div id="dash-content"><div class="loading">Chargement...</div></div>
</div>

<script>
  const BACKEND = "https://sinea-profile-ia.vercel.app/api/dashboard";
  let cleAcces = "";
  const FAM_COULEURS = { RELATION:'#F98272', ACTION:'#F9A876', STRUCTURE:'#5474F5', VISION:'#8884F0' };
  const FAM_LABELS = { RELATION:'Relation', ACTION:'Action', STRUCTURE:'Structure', VISION:'Vision' };

  // connexion
  document.getElementById('login-btn').onclick = tenterConnexion;
  document.getElementById('login-key').onkeydown = (e) => { if (e.key === 'Enter') tenterConnexion(); };

  function tenterConnexion() {
    const key = document.getElementById('login-key').value.trim();
    const err = document.getElementById('login-err');
    if (!key) { err.textContent = 'Entrez votre clé d\'accès.'; return; }
    err.textContent = 'Vérification...';
    fetch(BACKEND + '?cle=' + encodeURIComponent(key) + '&liste=ensemble')
      .then(r => { if (r.status === 401) throw new Error('cle'); return r.json(); })
      .then(data => {
        cleAcces = key;
        document.getElementById('login').style.display = 'none';
        document.getElementById('dash').classList.add('active');
        afficherEnsemble(data);
      })
      .catch(e => {
        err.textContent = (e.message === 'cle') ? 'Clé d\'accès incorrecte.' : 'Connexion impossible. Réessayez.';
      });
  }

  document.getElementById('logout').onclick = () => {
    cleAcces = "";
    document.getElementById('dash').classList.remove('active');
    document.getElementById('login').style.display = 'flex';
    document.getElementById('login-key').value = '';
    document.getElementById('login-err').textContent = '';
  };

  // vue d'ensemble (entreprises + campagnes)
  function afficherEnsemble(data) {
    const content = document.getElementById('dash-content');
    const entreprises = data.entreprises || [];
    let html = `
      <div class="stats-row">
        <div class="stat-card"><div class="stat-num">${entreprises.length}</div><div class="stat-label">Entreprises</div></div>
        <div class="stat-card"><div class="stat-num">${data.totalCampagnes || 0}</div><div class="stat-label">Campagnes</div></div>
        <div class="stat-card"><div class="stat-num">${data.totalTermines || 0}</div><div class="stat-label">Analyses réalisées</div></div>
      </div>`;
    if (!entreprises.length) {
      html += `<div class="empty">Aucune campagne pour le moment. Créez-en une dans Airtable.</div>`;
      content.innerHTML = html;
      return;
    }
    entreprises.forEach(ent => {
      html += `<div class="ent-block">
        <div class="ent-head">
          <div class="ent-nom">${ent.entreprise}</div>
          <div class="ent-meta">${ent.totalTermines} analyse${ent.totalTermines > 1 ? 's' : ''} · ${ent.campagnes.length} campagne${ent.campagnes.length > 1 ? 's' : ''}</div>
        </div>`;
      ent.campagnes.forEach(c => {
        const pct = c.quota > 0 ? Math.round((c.utilisations / c.quota) * 100) : 0;
        const famDots = Object.entries(c.familles).filter(([k,v]) => v > 0).map(([k,v]) =>
          `<div class="fam-dot" style="background:${FAM_COULEURS[k]}" title="${FAM_LABELS[k]}">${v}</div>`).join('');
        html += `<div class="camp-row" onclick="ouvrirCampagne('${(c.code || '').replace(/'/g, "")}')">
          <div class="camp-info">
            <div class="camp-nom">${c.nom}<span class="camp-type">${c.type || 'classic'}</span></div>
            <div class="camp-code">${c.code || ''}</div>
            ${famDots ? `<div class="fam-mini">${famDots}</div>` : ''}
          </div>
          <div class="camp-quota">
            <b>${c.utilisations}</b> / ${c.quota || '∞'}
            ${c.quota > 0 ? `<div class="camp-jauge"><div class="camp-jauge-fill" style="width:${pct}%"></div></div>` : ''}
          </div>
        </div>`;
      });
      html += `</div>`;
    });
    content.innerHTML = html;
  }

  // génération de l'analyse stratégique d'équipe
  const ANALYSE_URL = "https://sinea-profile-ia.vercel.app/api/analyse_equipe";
  let dernierCodeCampagne = "";

  function genererAnalyse(code, force) {
    dernierCodeCampagne = code;
    const btn = document.getElementById('btn-analyse');
    const zone = document.getElementById('analyse-zone');
    if (btn) { btn.disabled = true; btn.textContent = 'Génération en cours...'; }
    if (zone) zone.innerHTML = `<div class="loading">Analyse de l'équipe par l'IA, cela peut prendre une minute...</div>`;
    fetch(ANALYSE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cle: cleAcces, code, force: !!force }),
    })
      .then(r => r.json())
      .then(data => {
        if (btn) { btn.disabled = false; btn.textContent = 'Régénérer l\'analyse'; }
        if (data && data.ok && data.analyse) {
          afficherAnalyse(data.analyse, data.cache);
        } else if (data && data.raison === 'pas_assez') {
          if (zone) zone.innerHTML = `<div class="empty">${data.message}</div>`;
        } else {
          if (zone) zone.innerHTML = `<div class="empty">L'analyse n'a pas pu être générée. Réessayez.</div>`;
        }
      })
      .catch(() => {
        if (btn) { btn.disabled = false; btn.textContent = 'Générer l\'analyse'; }
        if (zone) zone.innerHTML = `<div class="empty">Erreur de génération. Réessayez dans un instant.</div>`;
      });
  }

  function afficherAnalyse(a, estCache) {
    const zone = document.getElementById('analyse-zone');
    if (!zone) return;
    const swot = a.swot || {};
    const liste = (arr) => Array.isArray(arr) ? arr.map(x => `<li>${x}</li>`).join('') : '';
    const planItems = Array.isArray(a.plan_action) ? a.plan_action.map(p =>
      `<div class="plan-item"><div class="plan-titre">${p.titre || ''}</div><p class="plan-desc">${p.desc || ''}</p></div>`).join('') : '';
    const focusItems = Array.isArray(a.focus_individuel) ? a.focus_individuel.map(f =>
      `<div class="focus-item"><div class="focus-nom">${f.nom || ''}</div><p class="focus-conseil">${f.conseil || ''}</p></div>`).join('') : '';

    zone.innerHTML = `
      <div class="analyse-result">
        <div class="analyse-badge">Analyse stratégique${estCache ? ' · enregistrée' : ' · nouvelle'}</div>
        ${a.synthese ? `<p class="analyse-synthese">${a.synthese}</p>` : ''}

        <div class="swot-grid">
          <div class="swot-card swot-forces"><div class="swot-titre">Forces</div><ul>${liste(swot.forces)}</ul></div>
          <div class="swot-card swot-faiblesses"><div class="swot-titre">Points de vigilance</div><ul>${liste(swot.faiblesses)}</ul></div>
          <div class="swot-card swot-opportunites"><div class="swot-titre">Opportunités</div><ul>${liste(swot.opportunites)}</ul></div>
          <div class="swot-card swot-risques"><div class="swot-titre">Risques</div><ul>${liste(swot.risques)}</ul></div>
        </div>

        ${a.dynamiques ? `<div class="analyse-section"><h4>Dynamiques d'équipe</h4><p>${a.dynamiques}</p></div>` : ''}

        ${Array.isArray(a.risques_rh) ? `<div class="analyse-section"><h4>Points d'attention RH</h4><ul class="liste-rh">${liste(a.risques_rh)}</ul></div>` : ''}

        ${planItems ? `<div class="analyse-section"><h4>Plan d'action de pilotage</h4><div class="plan-grid">${planItems}</div></div>` : ''}

        ${focusItems ? `<div class="analyse-section"><h4>Focus individuel</h4><div class="focus-grid">${focusItems}</div></div>` : ''}
      </div>
    `;
  }

  // détail d'une campagne
  function ouvrirCampagne(code) {
    const content = document.getElementById('dash-content');
    content.innerHTML = `<div class="loading">Chargement de la campagne...</div>`;
    fetch(BACKEND + '?cle=' + encodeURIComponent(cleAcces) + '&campagne=' + encodeURIComponent(code))
      .then(r => r.json())
      .then(data => afficherDetail(data))
      .catch(() => { content.innerHTML = `<div class="empty">Erreur de chargement. <button class="detail-back" onclick="recharger()">Retour</button></div>`; });
  }

  function recharger() {
    const content = document.getElementById('dash-content');
    content.innerHTML = `<div class="loading">Chargement...</div>`;
    fetch(BACKEND + '?cle=' + encodeURIComponent(cleAcces) + '&liste=ensemble')
      .then(r => r.json()).then(data => afficherEnsemble(data));
  }

  function afficherDetail(data) {
    const content = document.getElementById('dash-content');
    const camp = data.campagne || {};
    const stats = data.stats || {};
    const reps = data.repondants || [];
    const familles = stats.familles || {};
    const totalTermines = stats.termines || 0;

    // barres de répartition des familles
    const maxFam = Math.max(1, ...Object.values(familles));
    const famBars = Object.entries(familles).map(([k, v]) => {
      const pct = totalTermines > 0 ? Math.round((v / totalTermines) * 100) : 0;
      const largeur = (v / maxFam) * 100;
      return `<div class="fam-bar-row">
        <div class="fam-bar-label">${FAM_LABELS[k]}</div>
        <div class="fam-bar-track"><div class="fam-bar-fill" style="width:${Math.max(largeur, v > 0 ? 12 : 0)}%;background:${FAM_COULEURS[k]}">${v > 0 ? v + ' · ' + pct + '%' : ''}</div></div>
      </div>`;
    }).join('');

    // liste des membres
    const membres = reps.map(r => {
      const fam = (r.famille || '').toUpperCase();
      const couleur = FAM_COULEURS[fam] || '#C9C9C9';
      const init = (r.dominante || '?').replace(/^(Le |La |L'|Les )/, '').charAt(0);
      const estTermine = (r.statut || '').toLowerCase().startsWith('termin');
      return `<div class="membre-row">
        <div class="membre-pastille" style="background:${couleur}">${init}</div>
        <div class="membre-info">
          <div class="membre-nom">${r.nom || r.email || 'Anonyme'}</div>
          <div class="membre-arch">${r.dominante ? r.dominante + (r.famille ? ' · ' + FAM_LABELS[fam] : '') : 'En attente de réponse'}</div>
        </div>
        <div class="membre-statut ${estTermine ? 'statut-termine' : 'statut-attente'}">${estTermine ? 'Terminé' : 'En attente'}</div>
      </div>`;
    }).join('');

    content.innerHTML = `
      <button class="detail-back" onclick="recharger()">← Retour aux campagnes</button>
      <div class="detail-head">
        <div class="detail-nom">${camp.nom || ''}</div>
        <div class="detail-meta">${camp.entreprise ? camp.entreprise + ' · ' : ''}${stats.termines || 0} analyse${(stats.termines||0) > 1 ? 's' : ''} réalisée${(stats.termines||0) > 1 ? 's' : ''} sur ${stats.total || 0} inscrit${(stats.total||0) > 1 ? 's' : ''}</div>
      </div>
      ${totalTermines > 0 ? `<div class="repartition">
        <h3>Répartition des familles dans l'équipe</h3>
        <div class="fam-bars">${famBars}</div>
      </div>` : ''}
      ${totalTermines >= 2 ? `<div class="analyse-cta-block">
        <div class="analyse-cta-txt">
          <div class="analyse-cta-titre">Analyse stratégique de l'équipe</div>
          <div class="analyse-cta-sub">SWOT, dynamiques, risques RH et plan d'action, généré pour piloter cette équipe.</div>
        </div>
        <button class="analyse-cta-btn" id="btn-analyse" onclick="genererAnalyse('${(camp.code||'').replace(/'/g,'')}')">Générer l'analyse</button>
      </div>
      <div id="analyse-zone"></div>` : ''}
      <div class="membres">
        <h3>Les membres (${reps.length})</h3>
        ${membres || '<div class="empty">Personne n\'a encore répondu.</div>'}
      </div>
    `;
  }
</script>
</body>
</html>
