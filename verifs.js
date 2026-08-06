// ============================================================
// verifs.js , Harnais de non-régression Sinéa Profile
// Usage : node verifs.js   (depuis le dossier du front)
// Zéro dépendance. Sort en erreur (code 1) au premier échec.
// Règle d'or : chaque bug corrigé ajoute son test ici.
// ============================================================

const fs = require('fs');
let nbOk = 0, nbEchec = 0;
function verifie(nom, condition) {
  if (condition) { nbOk++; console.log('  ✓ ' + nom); }
  else { nbEchec++; console.error('  ✗ ECHEC : ' + nom); }
}

// ---- Chargement des modules front dans un contexte simulé ----
const window = {};
global.window = window;
eval(fs.readFileSync('competences.js', 'utf8'));
const C = window.Competences;
eval(fs.readFileSync('sinea_data.js', 'utf8').replace(/const SINEA_DATA = /, 'global.SINEA_DATA = '));
let srcEngine = fs.readFileSync('engine.js', 'utf8')
  .replace(/const Engine = \{/, 'global.Engine = {')
  .replace(/window\.Engine = /, 'global.Engine = ');
eval(srcEngine);
const srcControleur = fs.readFileSync('controller.js', 'utf8');
function srcEng(){ return fs.readFileSync('engine.js', 'utf8'); }

console.log('\n== 0. Intégrité des pages ==');
verifie('index.html commence par le DOCTYPE', fs.readFileSync('index.html', 'utf8').startsWith('<!DOCTYPE html>'));
verifie('dashboard.html commence par le DOCTYPE', fs.readFileSync('dashboard.html', 'utf8').startsWith('<!DOCTYPE html>'));
verifie("l'Essentiel s'ancre sur r-body", fs.readFileSync('result.js', 'utf8').includes("getElementById('r-body')"));

console.log('\n== 0bis. Câblage des interfaces (la classe de bugs vécue) ==');
// Chaque App.xxx appelé dans les gabarits du controller doit être exporté
const srcCtrl = fs.readFileSync('controller.js', 'utf8');
const appelsApp = [...new Set([...srcCtrl.matchAll(/App\.([a-zA-Z_]+)\(/g)].map(m => m[1]))];
const iSrc = srcCtrl.lastIndexOf(', srcPerso');
const iRet = srcCtrl.lastIndexOf('return {', iSrc);
const iFin = srcCtrl.indexOf('};', iSrc);
const exportApp = (iRet >= 0 && iFin > iRet) ? srcCtrl.slice(iRet, iFin) : '';
appelsApp.forEach(fn => verifie("App." + fn + " est exporté", exportApp.includes(fn)));
// Chaque onclick du dashboard doit correspondre à une fonction définie
const srcDash = fs.readFileSync('dashboard.js', 'utf8') + fs.readFileSync('dashboard.html', 'utf8');
const onclicks = [...new Set([...srcDash.matchAll(/onclick=\\?"([a-zA-Z_]+)\(/g)].map(m => m[1]))]
  .filter(fn => !['if', 'event', 'App'].includes(fn));
onclicks.forEach(fn => {
  verifie('onclick ' + fn + ' a sa fonction', new RegExp('function ' + fn + '\\(').test(srcDash) || new RegExp('(let|const|var) ' + fn + '\\b').test(srcDash));
});
// Le miroir : 13 items dont la question ouverte, et le formulaire la gère
const mQ = srcCtrl.match(/MIROIR_QUESTIONS = \[([\s\S]*?)\];/);
verifie('miroir : 13 items', mQ && (mQ[1].match(/\{ d:/g) || []).length === 13);
verifie('miroir : question ouverte typée texte', mQ && mQ[1].includes("type: 'texte'"));
verifie('miroir : le formulaire gère le texte', srcCtrl.includes("q.type === 'texte'"));
verifie("miroir : l'envoi embarque le conseil", srcCtrl.includes('conseil: ((document.getElementById'));

console.log('\n== 0ter. Passe une de la restitution ==');
const srcRes = fs.readFileSync('result.js', 'utf8');
verifie('section Votre combinaison supprimée', srcRes.indexOf('>Votre combinaison<') < 0);
verifie('section dynamiques fusionnée', srcRes.indexOf('>Les dynamiques entre vos forces<') < 0);
verifie('affinité 20 retirée', srcRes.indexOf('affinité avec les 20') < 0);
verifie('forces retitrées', srcRes.indexOf('Comment vos forces jouent ensemble') >= 0);
verifie('compétences avant les pistes', srcRes.indexOf('competencesRestitutionHtml(res)') >= 0 && srcRes.indexOf('competencesRestitutionHtml(res)') < srcRes.indexOf("Vos pistes d"));
verifie("teaser miroir dans l'Essentiel", srcRes.indexOf('ess-mir') >= 0);

console.log('\n== 0quater. Les visuels signatures ==');
eval(fs.readFileSync('visuels.js', 'utf8'));
const V = window.Visuels;
const compsV = C.scorer({ O: 58, C: 38, E: 72, A: 78, N: 45 }, { C: 18 });
const qv = V.quadrantSvg(compsV, { deltas: { developpement_autres: { avant: 41, apres: 58 } } });
verifie('quadrant : un point par compétence', (qv.match(/q16-pt/g) || []).length === C.REFERENTIEL.length);
verifie('quadrant : les zones du moteur nommées avec leur compte', (qv.match(/VOS FORCES · |EN RETRAIT · /g) || []).length >= 2 && qv.indexOf('data-case=') > 0 && qv.indexOf('SUR-RÉGIME') < 0);
verifie('quadrant : flèche d\'évolution', (qv.match(/url\(#q16f\)/g) || []).length === 1);
verifie('quadrant : groupes équilibrés', (qv.match(/<g /g) || []).length === (qv.match(/<\/g>/g) || []).length);
const dpv = V.doubleProfilSvg({ naturel: { O: 76, C: 7, E: 64, A: 70, N: 55 }, adapte: { O: 34, C: 97, E: 60, A: 66, N: 40 } });
verifie('double profil : 5 natures et 5 travail', (dpv.match(/dp2-nat/g) || []).length === 5 && (dpv.match(/dp2-adp/g) || []).length === 5);
verifie('double profil : chips d\'écart', (dpv.match(/rx="8.5"/g) || []).length >= 2);
const fvv = V.forcesVigilancesHtml(compsV, C.prioriser(compsV, 'manager'));
verifie('forces : 5 pleines, 3 creuses max', ((fvv.match(/fv-barre/g) || []).length - (fvv.match(/fv-creuse/g) || []).length) === 5 && (fvv.match(/fv-creuse/g) || []).length <= 3);
const idxH = fs.readFileSync('index.html', 'utf8');
verifie('visuels.js chargé avant result.js', idxH.indexOf('visuels.js') > 0 && idxH.indexOf('visuels.js') < idxH.indexOf('result.js'));
const dashH = fs.readFileSync('dashboard.html', 'utf8');
verifie('visuels.js chargé avant dashboard.js', dashH.indexOf('visuels.js') > 0 && dashH.indexOf('visuels.js') < dashH.indexOf('"dashboard.js"'));
verifie('restitution : forces et vigilances posées', srcRes.indexOf('forcesVigilancesHtml') >= 0);
verifie('restitution : le naturel et l\'adaptation vivent en une seule carte', srcRes2().indexOf('carteNaturelAdapte(') > 0 && srcRes2().indexOf('r-dp2-card') < 0);
verifie('restitution : quadrant posé', srcRes.indexOf('Visuels.quadrantSvg(comps)') >= 0);
verifie('espace : quadrant avec deltas', srcCtrl.indexOf('quadrantSvg(comps, { deltas: deltasQ') >= 0);
verifie('portail : quadrant fiche et équipe', (srcDash.match(/Visuels\.quadrantSvg/g) || []).length >= 2);
verifie('portail : le quadrant sort bien de matriceHtml', srcDash.indexOf('return enTete + comps.map') >= 0);

console.log('\n== 0quinquies. Sprint 2 : fit au poste et carte de chaleur ==');
const fitSrc = srcDash;
verifie('fit : délégué au moteur central', fitSrc.indexOf('window.Competences.fitPoste') >= 0 && fitSrc.indexOf('window.Competences.cibleDe') >= 0);
verifie('fit réel : borné, déterministe, gaps limités', (() => {
  const f1 = C.fitPoste(compsV, C.POSTES.manager.coefs);
  const f2 = C.fitPoste(compsV, C.POSTES.manager.coefs);
  return f1 && f1.score === f2.score && f1.score >= 0 && f1.score <= 100 && f1.gaps.length <= 3;
})());
verifie('fit réel : moteur présent signalé sur potentiel dormant', (() => {
  const cc = compsV.map(c => Object.assign({}, c));
  const cible = cc.find(x => x.id === 'communication_influence');
  cible.potentiel = 90; cible.expression = 40;
  const f = C.fitPoste(cc, C.POSTES.manager.coefs);
  return f.gaps.some(g => g.moteur === true);
})());
verifie('fit réel : les coefficients déplacent le score', (() => {
  const bas = {}; C.REFERENTIEL.forEach(r => { bas[r.id] = 0.7; });
  const haut = {}; C.REFERENTIEL.forEach(r => { haut[r.id] = 1.35; });
  return C.fitPoste(compsV, bas).score !== C.fitPoste(compsV, haut).score;
})());
verifie('zoneDe : canonique, économie égale potentiel bas', C.zoneDe(30, 80) === 'economie' && C.zoneDe(70, 60) === 'appui' && C.zoneDe(65, 50) === 'opportunite' && C.zoneDe(55, 50) === 'neutre');
verifie('scorer et zoneDe : zéro dérive possible', compsV.every(c => c.zone === C.zoneDe(c.potentiel, c.expression)));
verifie('quadrant : seuils lus depuis le moteur', fs.readFileSync('visuels.js', 'utf8').indexOf('Competences.SEUILS') > 0);
verifie('heatmap : dormant aligné sur les seuils', srcDash.indexOf('SEU.exprAppui') > 0);
verifie('portail : compsDe mémoïsé par campagne', srcDash.indexOf('compsCache = new WeakMap()') >= 0);
verifie('code mort : classementComplet purgé', srcRes.indexOf('classementComplet') < 0);
verifie('abréviations : 16 uniques', (() => {
  const m = fitSrc.match(/ABREV_COMP = \{([^}]+)\}/);
  if (!m) return false;
  const vals = m[1].match(/'[^']+'/g);
  return vals.length === 16 && new Set(vals).size === 16;
})());
verifie('heatmap : rendu, tri et dormant', fitSrc.indexOf('renderHeatmapEquipe') >= 0 && fitSrc.indexOf('function triHeat(') >= 0 && fitSrc.indexOf('heat-dot') >= 0);
verifie('adéquation : panneau, chips et liste', fitSrc.indexOf('renderFitPoste') >= 0 && fitSrc.indexOf('choisirFitPoste') >= 0 && fitSrc.indexOf('renderFitListe') >= 0);
verifie('fiche : zone fit posée et recalcul au clic', fitSrc.indexOf('id="bd-fit"') >= 0 && fitSrc.indexOf('membreFicheCourant = m;') >= 0 && fitSrc.split('majFitFiche()').length >= 3);
verifie('assemblage : heatmap et fit dans la vue campagne', fitSrc.indexOf('renderHeatmapEquipe();') >= 0 && fitSrc.indexOf('renderFitPoste();') >= 0);

console.log('\n== 0sexies. Raccordements réclamés ==');
const idxH2 = fs.readFileSync('index.html', 'utf8');
verifie('espace : trois onglets, accueil en premier', (idxH2.match(/esp-nav-b/g) || []).length === 3 && idxH2.indexOf("data-t=\"accueil\" aria-pressed=\"true\"") > 0);
verifie('espace : le développement attend son onglet', idxH2.indexOf('id="espace-cockpit" class="esp-hide"') > 0 && idxH2.indexOf('id="espace-seedup" class="esp-hide"') > 0);
verifie('espace : trois groupes câblés', srcCtrl.indexOf('const groupes = {') > 0 && srcCtrl.indexOf("miroir: ['espace-miroir']") > 0);
verifie('espace : miroir masqué par défaut', idxH2.indexOf('id="espace-miroir" class="esp-hide"') > 0);
verifie('espace : espTab exporté', exportApp.includes('espTab'));
verifie('notation : l\'overlay survit au départ du bouton', srcRes.indexOf('noter-ov') > 0 && srcRes.indexOf('Result.noterEtoile') > 0);
verifie('notation : fonction exportée', srcRes.indexOf('Result.noterPortrait = function') > 0);
const cssTxt = fs.readFileSync('style.css', 'utf8');
verifie('mobile : hero en colonne sous 700px', cssTxt.indexOf('.espace-hero{flex-direction:column') > 0);
verifie('mobile : colonne texte protégée (min-width 0)', cssTxt.indexOf('.espace-hero-txt{min-width:0') > 0);

console.log('\n== 0septies. Sprint 3 : le cockpit participant ==');
const rad = V.radarMiroirSvg({ E: 72, A: 78, C: 38, S: 55, O: 58 }, { E: 60, A: 70, C: 52, S: 48, O: 66 });
verifie('radar : deux polygones superposés', (rad.match(/<polygon class/g) || []).length === 2);
verifie('radar : cinq axes étiquetés', ['Aisance sociale', 'Chaleur', 'Rigueur', 'Solidité', 'Curiosité'].every(l => rad.indexOf(l) > 0));
verifie('radar : trait manquant, rendu vide', V.radarMiroirSvg({ E: 50 }, { E: 50 }) === '');
const fr = V.frise90Svg([{ label: 'Portrait', pos: 0, fait: true }, { label: 'Re-mesure', pos: 100, fait: false }], 45);
verifie('frise : jalon fait coché, jalon à venir creux', fr.indexOf('#5B9E6B') > 0 && fr.indexOf('stroke="#C9C6BB"') > 0);
verifie('frise : curseur au bon jour', fr.indexOf('Jour 45') > 0);
verifie('frise : sans date, sans curseur', V.frise90Svg([{ label: 'Portrait', pos: 0, fait: true }], null).indexOf('Jour') < 0);
verifie('cockpit : posé et appelé', srcCtrl.indexOf('function poserCockpit(') > 0 && srcCtrl.indexOf('poserCockpit(dataEspaceCourant, carte)') > 0);
verifie('cockpit : dans l\'onglet développement, Néa en dernier', srcCtrl.indexOf("dev: ['espace-accueil-resume', 'espace-cockpit', 'espace-checklist', 'espace-seedup', 'espace-sparring', 'espace-nea']") > 0);
verifie('cockpit : slot présent dans la page', idxH2.indexOf('id="espace-cockpit"') > 0);
verifie('miroir : le radar entre dans l\'analyse', srcCtrl.indexOf('${radarHtml}') > 0 && srcCtrl.indexOf('radarMiroirSvg(vous, percu') > 0);
verifie('engagements : état relié aux défis', srcCtrl.indexOf('compsDefis.has(mm.id)') > 0);

console.log('\n== 0octies. Retours terrain v72 ==');
const qz = V.quadrantSvg(compsV);
verifie('quadrant : échelle zoomée sur la plage réelle', qz.indexOf('>0</text>') < 0 && qz.indexOf('>100</text>') < 0);
verifie('quadrant : tous les points cliquables sur option', (V.quadrantSvg(compsV, { clic: 'X' }).match(/X\(&quot;/g) || []).length === C.REFERENTIEL.length);
const fvv2 = V.forcesVigilancesHtml(compsV, C.prioriser(compsV, 'manager'));
verifie('forces : intro pédagogique, définitions, familles', fvv2.indexOf('fv-intro') > 0 && (fvv2.match(/fv-def/g) || []).length >= 6 && (fvv2.match(/fv-dot/g) || []).length === 8);
verifie('largeurs fluides : restitution et espace à 94vw', (cssTxt2().match(/min\(1680px, 94vw\)/g) || []).length >= 6);
verifie('largeur fluide : portail à 96vw', fs.readFileSync('dashboard.html', 'utf8').indexOf('min(1720px, 96vw)') > 0);
verifie('noter : overlay autonome, token, action avis_direct', srcRes2().indexOf('noter-ov') > 0 && srcRes2().indexOf("action: 'avis_direct'") > 0 && srcRes2().indexOf("get('token')") > 0);
verifie('noter : étoiles en gestionnaires inline', srcRes2().indexOf('Result.noterEtoile(this)') > 0 && srcRes2().indexOf('Result.noterEtoile = function') > 0);
verifie('restitution : l\'envoi d\'avis vit hors capsule avec son URL', srcRes2().indexOf("fetch('https://sinea-profile-ia.vercel.app/api/progression'") > 0);
verifie('lecture : le large rééquilibré, prose 1280, visuels 1520', cssTxt2().indexOf('.r-body > *{max-width:min(1280px, 92vw)') > 0 && cssTxt2().indexOf('.r-q16-card{max-width:min(1520px, 94vw)') > 0);
verifie('espace : la carte Néa est lisible', cssTxt2().indexOf('.esp-nea{background:#FDFCF8') > 0);
verifie('portail : le codex existe et la matrice y mène', srcDash.indexOf('function ouvrirCodex(') > 0 && srcDash.indexOf('bd-mat-cx') > 0);
verifie('moteur : le mapping dimensions est exporté', !!C.DIMS_VERS_COMPETENCES && Object.keys(C.DIMS_VERS_COMPETENCES).length >= 4);
verifie('miroir : la relation est demandée et envoyée', srcCtrl2().indexOf('relationHtml') > 0 && srcCtrl2().indexOf('relation: (function') > 0);
verifie('miroir : l\'envoi se libère sur notes et relation, conseil optionnel', srcCtrl2().indexOf("type !== 'texte'") > 0 && srcCtrl2().indexOf('k >= nb && rel') > 0);
verifie('miroir : répartition et impact affichés', srcCtrl2().indexOf('${repartition}') > 0 && srcCtrl2().indexOf('esp-mir-impact') > 0);
verifie('carte espace : le clic ouvre le détail', srcCtrl2().indexOf("clic: 'App.ouvrirCompDepuisCarte'") > 0 && srcCtrl2().indexOf('esp-cp-focus') > 0);
verifie('cockpit : la frise a cédé la place au jardin', srcCtrl2().indexOf('frise90Svg') < 0 && srcCtrl2().indexOf('class="ck-note"') < 0 && srcCtrl2().indexOf('let frise') < 0);
function cssTxt2(){ return fs.readFileSync('style.css', 'utf8'); }
function srcRes2(){ return fs.readFileSync('result.js', 'utf8'); }
function srcCtrl2(){ return fs.readFileSync('controller.js', 'utf8'); }

console.log('\n== 0nonies. Sprint A : les quatre armes déterministes ==');
const rad3 = V.radarMiroirSvg({ E: 72, A: 78, C: 38, S: 55, O: 58 }, { E: 60, A: 70, C: 52, S: 48, O: 66 }, { E: 65, A: 80, C: 45, S: 50, O: 60 });
verifie('radar : le pari fait un troisième polygone', (rad3.match(/<polygon class/g) || []).length === 3 && rad3.indexOf('Votre pari') > 0);
const qmv = V.quadrantSvg(compsV, { deltas: { developpement_autres: { avant: 41, apres: 58 } } });
verifie('quadrant : positions J0 et J90 embarquées', (qmv.match(/q16-mv/g) || []).length === 1 && qmv.indexOf('data-cy0') > 0);
verifie('curseur : le brancheur est exporté', typeof V.brancherCurseur === 'function');
verifie('espace : le pari est construit et scellé au back', srcCtrl2().indexOf('pariMiroirHtml') > 0 && srcCtrl2().indexOf("action: 'miroir_prediction'") > 0 && srcCtrl2().indexOf('Sceller mon pari') > 0);
verifie('espace : la lucidité est calculée et affichée', srcCtrl2().indexOf('mir-luc-score') > 0 && srcCtrl2().indexOf('100 - moyEcart') > 0);
verifie('espace : le radar reçoit le pari', srcCtrl2().indexOf('radarMiroirSvg(vous, percu, pariM)') > 0);
verifie('espace : les regards se filtrent par relation', srcCtrl2().indexOf('filtrerMiroir') > 0 && srcCtrl2().indexOf('reponsesTous.filter') > 0);
verifie('espace : le curseur des 90 jours est branché', srcCtrl2().indexOf('esp-q16-t') > 0 && srcCtrl2().indexOf('brancherCurseur(document.getElementById') > 0);
verifie('portail : le fit projeté double la barre', srcDash.indexOf('fit-proj') > 0 && srcDash.indexOf('% à 90 j') > 0 && srcDash.indexOf('Competences.projeterComps') > 0);
verifie('portail : la fiche projette et rejoue', srcDash.indexOf('bd-fit-proj') > 0 && srcDash.indexOf('function rejouerQ16(') > 0 && srcDash.indexOf('bd-q16-t') > 0);

console.log('\n== 0decies. Sprint B : le codex vivant ==');
verifie('codex : 16 trajectoires complètes, 4 paliers pleins', C.REFERENTIEL.every(r => { const cx = C.CODEX[r.id]; return cx && cx.paliers.length === 4 && cx.paliers.every(p => p[0].length >= 25 && p[1].length >= 25); }));
verifie('codex : 2 questions d\'entretien par compétence', C.REFERENTIEL.every(r => C.CODEX[r.id].entretien.length === 2 && C.CODEX[r.id].entretien.every(q => q.length >= 30)));
verifie('codex : palierDe borné 1 à 4', C.palierDe(10) === 1 && C.palierDe(50) === 2 && C.palierDe(65) === 3 && C.palierDe(90) === 4 && C.PALIERS_NOMS.length === 4);
verifie('fit : les gaps portent leur identifiant', (() => { const f = C.fitPoste(compsV, C.POSTES.manager.coefs); return f.gaps.length > 0 && f.gaps.every(g => !!g.id); })());
verifie('portail : trajectoire, entretien, incarné dans la modal', srcDash.indexOf('cx-pal') > 0 && srcDash.indexOf('chargerIncarne') > 0 && srcDash.indexOf('CODEX_URL') > 0 && srcDash.indexOf('cle: cleAcces') > 0);
verifie('portail : questions d\'entretien contre les gaps de la fiche', srcDash.indexOf('bd-fit-qs') > 0 && srcDash.indexOf('cx2.entretien[0]') > 0);
verifie('espace : la trajectoire vit dans la fiche focus', srcCtrl2().indexOf('fcx-pal') > 0 && srcCtrl2().indexOf('palierDe(c2.expression)') > 0);

console.log('\n== 0undecies. Portail : les onglets narratifs ==');
verifie('organiseur : cinq onglets et bascule', srcDash.indexOf('function organiserOnglets(') > 0 && srcDash.indexOf('function ptTab(') > 0 && (srcDash.match(/\['(pilotage|equipe|dynamiques|competences|coach)'/g) || []).length === 5);
verifie('organiseur : appelé après le rendu de la campagne', srcDash.indexOf("organiserOnglets(document.getElementById('content'))") > 0);
verifie('bandeau essentiel : quatre faits calculés', srcDash.indexOf('stripEssentielHtml') > 0 && srcDash.indexOf('potentiels dormants') > 0 && srcDash.indexOf('Meilleur fit') > 0);
verifie('codex : la grille des seize est visible', srcDash.indexOf('renderCodexGrid') > 0 && srcDash.indexOf('cxg-c') > 0 && srcDash.indexOf('La bibliothèque vivante') > 0);
verifie('organiseur : idempotent au re-rendu', srcDash.indexOf("cont.querySelector('.pt-nav')") > 0);

console.log('\n== 0duodecies. Retouches de pertinence ==');
verifie('projection : centralisée et bornée par le potentiel', (() => {
  const eng = new Set(['communication_influence']);
  const avant = compsV.find(c => c.id === 'communication_influence');
  const ap = C.projeterComps(compsV, eng).find(c => c.id === 'communication_influence');
  return typeof C.BOOST_PROJECTION === 'number' && ap.expression <= Math.max(avant.expression, avant.potentiel) && ap.expression >= avant.expression;
})());
verifie('portail : la projection délègue au moteur', (srcDash.match(/Competences\.projeterComps/g) || []).length === 2);
verifie('projection : étiquetée hypothèse aux deux endroits', srcDash.indexOf('Hypothèse : engagements tenus') > 0 && srcDash.indexOf("hypothèse d\\'ancrage") > 0);
verifie('bandeau : fit conditionné au poste sur mesure', srcDash.indexOf('posteCustomCourant ? coefsPoste') > 0 && srcDash.indexOf('Fit manager moyen') < 0);
verifie('bandeau : la qualité vécue entre en scène', srcDash.indexOf('Qualité vécue') > 0);
verifie('cockpit : le pronostic a sa place dans les priorités', srcCtrl2().indexOf('pronostic Feedback 360') > 0);
verifie('miroir : le pari est replié par défaut', srcCtrl2().indexOf('pari-open') > 0 && srcCtrl2().indexOf('pari-corps esp-hide') > 0);
verifie('accueil : le résumé est posé et rangé', idxH2.indexOf('id="espace-accueil-resume"') > 0 && srcCtrl2().indexOf('acc-resume') > 0 && srcCtrl2().indexOf("dev: ['espace-accueil-resume'") > 0);

console.log('\n== 0terdecies. Les facettes et la défithèque ==');
verifie('facettes : deux par compétence, ids uniques', (() => {
  let n = 0; const ids = [];
  const ok = C.REFERENTIEL.every(r => { const f = C.FACETTES[r.id]; if (!f || f.length !== 2) return false; f.forEach(x => { n++; ids.push(x.id); }); return true; });
  return ok && n === C.REFERENTIEL.length * 2 && new Set(ids).size === n;
})());
verifie('défithèque : quatre paliers et trois défis par facette, sans trou', (() => {
  let n = C.REFERENTIEL.length * 4;
  Object.values(C.FACETTES).forEach(f => f.forEach(x => { n += x.defis.length; }));
  return n === C.REFERENTIEL.length * 10 && Object.values(C.FACETTES).every(f => f.every(x => x.defis.length === 3 && x.defis.every(d2 => d2.length >= 25) && x.def.length >= 30));
})());
verifie('portail : les facettes entrent dans la modal', srcDash.indexOf('cx-fac') > 0 && srcDash.indexOf('facettesHtml') > 0);
verifie('espace : les facettes entrent dans la fiche focus', srcCtrl2().indexOf('fcx-fac') > 0 && srcCtrl2().indexOf('FACETTES[id]') > 0);

console.log('\n== 0quaterdecies. Les prochaines étapes du parcours ==');
verifie('étapes : le slot vit dans Mon développement', require('fs').readFileSync('index.html', 'utf8').indexOf('id="espace-remesure"') > 0 && require('fs').readFileSync('controller.js', 'utf8').indexOf("'espace-remesure'") > 0);
verifie('étapes : posées au chargement et rafraîchissables', srcCtrl2().indexOf('function poserChecklist(') > 0 && srcCtrl2().indexOf('checklistCtx = { data: dataEspaceCourant') > 0 && srcCtrl2().indexOf('function majChecklist()') > 0);
verifie('étapes : neuf jalons détectés', (srcCtrl2().match(/id: '/g) || []).length >= 9 && srcCtrl2().indexOf("id: 'remesure'") > 0);
verifie('étapes : les détections lisent les vraies sources', srcCtrl2().indexOf('const jal = carte.jalons || {}') > 0 && srcCtrl2().indexOf('Number(carte.voeux)') > 0 && srcCtrl2().indexOf('mir.prediction') > 0 && srcCtrl2().indexOf('pistes_libelles') > 0);
verifie('étapes : la notation s\'ouvre depuis l\'étape', srcCtrl2().indexOf('Result.noterPortrait()') > 0);
verifie('étapes : trois prochaines et rattrapage', srcCtrl2().indexOf('aFaire.slice(0, 3)') > 0 && srcCtrl2().indexOf('Déjà fait ?') > 0 && srcCtrl2().indexOf('function marquerFait(') > 0);
verifie('étapes : les jalons manuels comptent partout', (srcCtrl2().match(/!!jal\./g) || []).length === 9);
verifie('feedback 360 : le nom est partout à l\'écran', idxH2.indexOf('Mon regard 360') > 0 && (srcCtrl2().match(/Mon regard 360/g) || []).length >= 3 && srcCtrl2().indexOf('pronostic Feedback 360') > 0);
verifie('feedback 360 : chaque porte dépose au geste précis', srcCtrl2().indexOf('function allerFeedback(') > 0 && (srcCtrl2().match(/allerFeedback/g) || []).length >= 8 && srcCtrl2().indexOf("App.espTab('miroir')") < 0 && srcCtrl2().indexOf('espTab(&quot;miroir&quot;)') < 0);
verifie('feedback 360 : le fil des quatre étapes guide et téléporte', srcCtrl2().indexOf('function mirEtapesHtml(') > 0 && srcCtrl2().indexOf("insertAdjacentHTML('afterbegin', mirEtapesHtml") > 0 && srcCtrl2().indexOf('function mirAller(') > 0 && cssTxt2().indexOf('.mir-etapes{display:flex') > 0);
verifie('feedback 360 : cibles au standard, filtre actif lisible', cssTxt2().indexOf('.esp-mir-msg-btn{min-height:40px;}') > 0 && cssTxt2().indexOf('.mir-rel.on{background:#5E59C7;color:#fff') > 0 && cssTxt2().indexOf('.mir-et{min-height:44px;}') > 0);
verifie('feedback 360 : les étapes ordonnent la section, inviter puis pronostic',
  srcCtrl2().indexOf('ÉTAPE 1 · INVITER') > 0 && srcCtrl2().indexOf('ÉTAPE 2 · VOTRE PRONOSTIC') > 0
  && srcCtrl2().indexOf('ÉTAPE 1 · INVITER') < srcCtrl2().indexOf('ÉTAPE 2 · VOTRE PRONOSTIC'));
verifie('pronostic : le pourquoi vit au point d\'action', srcCtrl2().indexOf('pari-why') > 0 && srcCtrl2().indexOf('score de lucidité') > 0 && srcCtrl2().indexOf('Sceller mon pronostic · 30 s') > 0 && srcCtrl2().indexOf('Faire mon pari') < 0);
verifie('répondant : relation exigée, compteur vivant, nom unifié', srcCtrl2().indexOf('function majValiderMiroir(') > 0 && (srcCtrl2().match(/majValiderMiroir\(\)/g) || []).length >= 2 && srcCtrl2().indexOf('Choisissez votre relation ci-dessus') > 0 && srcCtrl2().indexOf('Feedback 360 · Sinéa') > 0 && srcCtrl2().indexOf('Miroir Sinéa') < 0);
verifie('répondant : options au standard tactile', cssTxt2().indexOf('.esp-rem-opt{min-height:40px;}') > 0 && cssTxt2().indexOf('.esp-rem-opt{min-height:44px;}') > 0);
verifie('plan : cibles, contrastes et hero blindé', cssTxt2().indexOf('.plan-hero{background:linear-gradient(135deg,#221D45') > 0 && cssTxt2().indexOf('.plan-statut{min-height:40px;color:#4A4757;}') > 0 && cssTxt2().indexOf('.plan-statut{min-height:44px;}') > 0 && cssTxt2().indexOf('.planc-lab{font-size:11px;}') > 0);
verifie('plan : la synthèse vit et écoute les statuts', srcCtrl2().indexOf('function majPlanSynthese(') > 0 && srcCtrl2().indexOf('function soignerPlan(') > 0 && srcCtrl2().indexOf('soignerPlan(scr)') > 0 && cssTxt2().indexOf('.plan-synth-bar') > 0 && srcCtrl2().indexOf("' fait' + (acquis > 1") > 0 && srcCtrl2().indexOf('__synthObs') > 0 && srcCtrl2().indexOf('MutationObserver') > 0);
verifie('plan : le ressenti se lit sur la carte, en direct', (srcCtrl2().match(/planc-note/g) || []).length >= 3 && cssTxt2().indexOf('.planc-note{') > 0);
verifie('restitution : les cartes annexes survivent aux analyses partielles', srcRes2().indexOf("if (!na.naturel) return '';") > 0 && srcRes2().indexOf('radar = radar || {};') > 0);
verifie('restitution : le rendu encapsulé garde un message honnête', srcCtrl2().indexOf("try { Result.render(res); } catch (e)") > 0);
verifie('restitution : les chargements orphelins se replient en mode figé', srcRes2().indexOf('r-ia-fige') > 0 && srcRes2().indexOf('res.contenuFige) setTimeout') > 0);
verifie('restitution : la barre de lecture accompagne le défilement', srcRes2().indexOf('function installerBarreLecture(') > 0 && srcRes2().indexOf('installerBarreLecture,') > 0 && cssTxt2().indexOf('#r-lecture-bar') > 0);
verifie('restitution : cibles et encres au standard', cssTxt2().indexOf('.r-topbar-espace{min-height:40px;}') > 0 && cssTxt2().indexOf('.r-ia-tag{font-size:11px;color:#4B47A0;}') > 0 && cssTxt2().indexOf('.r-rare{background-color:#221D45;}') > 0 && cssTxt2().indexOf('.r-chat-sugg{min-height:44px;}') > 0);
verifie('restitution : le sommaire flotte, liste et téléporte', srcRes2().indexOf('function installerSommaireFlottant(') > 0 && srcRes2().indexOf('installerBarreLecture(); installerSommaireFlottant();') > 0 && srcRes2().indexOf('installerBarreLecture, installerSommaireFlottant,') > 0 && cssTxt2().indexOf('#r-toc-flot{position:fixed') > 0 && cssTxt2().indexOf('#r-toc-panel.ouvert{display:block;}') > 0);
verifie('restitution terrain : bouton autonome, largeurs unies, radar ample, doublon retiré', require('fs').readFileSync('style.css', 'utf8').indexOf('.r-topbar-espace{background:#221D45') > 0 && require('fs').readFileSync('style.css', 'utf8').indexOf('#screen-result .r-bloc{padding-left:23px') > 0 && require('fs').readFileSync('style.css', 'utf8').indexOf('.r-radar-svg{width:100%') > 0 && require('fs').readFileSync('result.js', 'utf8').indexOf('r-dp2-card') < 0 && require('fs').readFileSync('result.js', 'utf8').indexOf('class="r-radar-svg"') > 0);
verifie('restitution : les devises parlent en tendances, à l\'infinitif', srcRes2().indexOf('"Relier les personnes et faire tenir les liens."') > 0 && srcRes2().indexOf('Je relie les personnes') < 0 && srcRes2().indexOf('Je suis le moteur') < 0);
verifie('compétences : le zoom respire et les points sont fins', require('fs').readFileSync('visuels.js', 'utf8').indexOf('min-max par côté') > 0 && require('fs').readFileSync('visuels.js', 'utf8').indexOf('r * 0.72') > 0);
verifie('espace : la constellation et les défis expliquent leur intention', srcCtrl2().indexOf('Vers la droite grandit votre potentiel naturel') > 0 && srcCtrl2().indexOf('jr-pourquoi') > 0 && cssTxt2().indexOf('.jr-pourquoi{') > 0);
verifie('fiabilité : le verdict post-affinage reste honnête face aux signaux forts', srcCtrl2().indexOf('fortsRestants') > 0 && srcCtrl2().indexOf('Une variabilité de réponses reste visible') > 0);
verifie('restitution : la notation du portrait est accessible en relecture', srcRes2().indexOf('ouvrirNotation: showMoment3') > 0 && srcRes2().indexOf('Je donne mon avis') > 0 && cssTxt2().indexOf('.r-noter-btn{') > 0);
verifie('matrices : tooltip riche, lecture carto et données portées par les points', require('fs').readFileSync('visuels.js', 'utf8').indexOf('data-pot=') > 0 && require('fs').readFileSync('visuels.js', 'utf8').indexOf('function brancherTooltip(') > 0 && cssTxt2().indexOf('.qt-tip{') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('carto-lecture') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('orientation relation') > 0);
(function () {
  if (!window.Visuels) { eval(fs.readFileSync('visuels.js', 'utf8')); }
  const VZ = window.Visuels, CZ = window.Competences;
  const SX = CZ.SEUILS.potAppui, SYv = CZ.SEUILS.exprAppui;
  const mk = (id, p, e) => ({ id: id, nom: id.toUpperCase(), famille: 'RELATION', potentiel: p, expression: e, zone: CZ.zoneDe(p, e) });
  const comps = [mk('qa', 80, 75), mk('qb', 22, 26), mk('qc', 76, 32), mk('qd', 45, 72), mk('qe', 55, 50), mk('qf', 90, 88)];
  const svg = VZ.quadrantSvg(comps);
  const rects = Array.from(svg.matchAll(/<rect x="(\d+)" y="(\d+)"/g)).map(m => ({ x: +m[1], y: +m[2] }));
  const sx = rects[1].x, sy = rects[2].y;
  let geoOk = true, mono = true, dernierCx = -1;
  comps.slice().sort((a, b) => a.potentiel - b.potentiel).forEach(c => {
    const m = svg.match(new RegExp('data-comp="' + c.id + '"[\\s\\S]*?<circle cx="(\\d+)" cy="(\\d+)"'));
    if (!m) { geoOk = false; return; }
    const cx = +m[1], cy = +m[2];
    if (Math.abs(c.potentiel - SX) > 2 && ((cx >= sx) !== (c.potentiel >= SX))) geoOk = false;
    if (Math.abs(c.expression - SYv) > 2 && ((cy <= sy) !== (c.expression >= SYv))) geoOk = false;
    if (cx < dernierCx) mono = false;
    dernierCx = cx;
  });
  verifie('matrices : chaque point tombe dans le quadrant de sa zone', geoOk);
  verifie('matrices : le potentiel ordonne les points de gauche à droite', mono);
  const haut = CZ.scorer({ O: 100, C: 100, E: 100, A: 100, N: 0 }, null, null);
  const basx = CZ.scorer({ O: 0, C: 0, E: 0, A: 0, N: 100 }, null, null);
  const bornes = haut.concat(basx).every(c => c.potentiel >= 0 && c.potentiel <= 100 && c.expression >= 0 && c.expression <= 100);
  const pot = (bf) => CZ.scorer(bf, null, null).find(c => c.id === 'communication_influence').potentiel;
  const monotone = pot({ O: 50, C: 50, E: 90, A: 50, N: 50 }) > pot({ O: 50, C: 50, E: 20, A: 50, N: 50 });
  const avant = CZ.scorer({ O: 60, C: 40, E: 55, A: 65, N: 45 }, { E: -20, C: 10 }, null);
  const apres = CZ.projeterComps(avant, new Set(avant.map(c => c.id)));
  const projSaine = apres.every((c, i) => c.expression >= avant[i].expression && c.expression <= Math.max(avant[i].potentiel, avant[i].expression));
  verifie('matrices : les scores restent bornés aux extrêmes', bornes);
  verifie('matrices : le potentiel suit le trait qui le porte', monotone);
  verifie('matrices : la projection élève sans jamais dépasser le potentiel', projSaine);
verifie('résilience : les envois échoués se retiennent et se renvoient au retour du réseau', srcCtrl2().indexOf('interEnAttente') > 0 && srcCtrl2().indexOf('function bandeauHorsLigne(') > 0 && srcCtrl2().indexOf('Rechargez la page dans un instant') > 0 && srcCtrl2().indexOf('gardez cet onglet ouvert') > 0 && srcCtrl2().indexOf('tentative < 4') > 0 && srcCtrl2().indexOf('sync-bandeau') > 0 && srcCtrl2().indexOf("addEventListener('online'") > 0 && cssTxt2().indexOf('#sync-bandeau{') > 0);
verifie('identité web : description, aperçu de partage, couleur et favicon sur les deux pages', ['index.html', 'dashboard.html'].every(function (f) { const t = require('fs').readFileSync(f, 'utf8'); return t.indexOf('og:title') > 0 && t.indexOf('name="description"') > 0 && t.indexOf('theme-color') > 0 && t.indexOf('rel="icon"') > 0; }));
verifie('terrain : la barre de sélection meurt en quittant la restitution', srcCtrl2().indexOf("sb.classList.remove('on')") > 0 && srcRes2().indexOf("sb0.classList.remove('on')") > 0 && srcRes2().indexOf("pour votre plan d\\'action") > 0 && srcRes2().indexOf("retenus pour votre plan") < 0);
verifie('terrain : le repli du plan varie ses pas et propose la relance', srcCtrl2().indexOf('à dessein') > 0 && srcCtrl2().indexOf('pasF[i % 3]') > 0 && srcCtrl2().indexOf('function signalerRepliPlan(') > 0 && cssTxt2().indexOf('.plan-repli{') > 0);
verifie('terrain : le plan tient un seul gabarit et le parcours suit la charte', cssTxt2().indexOf('.plan-hero{max-width:100%') > 0 && cssTxt2().indexOf('linear-gradient(90deg,#5E59C7,#8884F0)') > 0);
verifie('terrain : le halo de la carte des résultats reste décoratif, hors du flux', cssTxt2().indexOf('.esp-resultat .esp-res-glow{position:absolute;z-index:1;}') > 0 && cssTxt2().indexOf('linear-gradient(90deg,#F98272,#E8951A 40%') < 0);
verifie('direction artistique : le personnage règne sur les deux heros et la famille teinte l\'espace', cssTxt2().indexOf('.espace-hero-perso{position:absolute;right:34px;bottom:-46px;top:auto;left:auto;width:min(280px,23vw)') > 0 && cssTxt2().indexOf('var(--fam,#5E59C7) 155%') > 0 && srcRes2().indexOf("carteP.id = 'r-hero-carte'") > 0 && srcCtrl2().indexOf("heroFam.style.setProperty('--fam'") > 0);
verifie('direction artistique : chapitres numérotés, chapô et souffle éditorial', cssTxt2().indexOf('counter-reset:chapitre') > 0 && cssTxt2().indexOf('counter(chapitre,decimal-leading-zero)') > 0 && cssTxt2().indexOf('.r-ia > p:first-of-type{font-size:19px') > 0 && cssTxt2().indexOf('#screen-result .r-section-tag::before') > 0);
verifie('architecture : la navigation vit hors du hero, claire et collante', require('fs').readFileSync('index.html', 'utf8').indexOf('espace-hero-perso') < require('fs').readFileSync('index.html', 'utf8').indexOf('esp-nav') && cssTxt2().indexOf('.esp-nav{position:sticky;top:10px') > 0 && cssTxt2().indexOf('.esp-nav-b.on{background:#221D45') > 0);
verifie('signature : le portrait habite aussi la carte des résultats et la rareté prend la scène', cssTxt2().indexOf('.esp-res-perso{flex-shrink:0;width:150px;margin:-30px') > 0 && cssTxt2().indexOf('.r-rare-num{font-size:64px') > 0);
verifie('voix typographique : la display se charge et signe les titres majeurs', require('fs').readFileSync('index.html', 'utf8').indexOf('Bricolage+Grotesque') > 0 && cssTxt2().indexOf("--font-display:'Bricolage Grotesque'") > 0 && cssTxt2().indexOf('.espace-name{font-family:var(--font-display)') > 0 && cssTxt2().indexOf('.r-rare-num{font-family:var(--font-display)') > 0);
verifie('clôture : la fin de lecture devient un moment, teinté famille', srcRes2().indexOf('r-cloture-titre">Ce portrait est le vôtre.') > 0 && cssTxt2().indexOf('.r-cloture{background:linear-gradient(140deg,#221D45 0%, var(--fam-color') > 0 && srcRes2().indexOf("getElementById('screen-result').style.setProperty('--fam-color'") > 0);
verifie('tunnel : la première impression porte la voix et la barre suit la charte', cssTxt2().indexOf('.cover-inner h1{font-family:var(--font-display)') > 0 && cssTxt2().indexOf('linear-gradient(90deg,#5E59C7,#8884F0,#B9B6F5)') > 0 && cssTxt2().indexOf('#F98272,#8884F0,#E290EC') < 0);
verifie('session : l\'identité survit sept jours et se restaure hors entrée par jeton', srcCtrl2().indexOf("localStorage.setItem('sinea_identite'") > 0 && srcCtrl2().indexOf('function restaurerIdentite()') > 0 && srcCtrl2().indexOf('(token|miroir)=') > 0);
verifie('lecture : les trois modes et le CTA du portrait complet', srcRes2().indexOf("classList.toggle('mode-spe'") > 0 && cssTxt2().indexOf('#screen-result.mode-spe .r-bloc:not(#b-spe){display:none;}') > 0 && srcRes2().indexOf('Lire mon portrait complet') > 0);
verifie('lecture : la couche essentielle se construit en local', srcRes2().indexOf('function construireEssentiel(') > 0 && srcRes2().indexOf('Vos trois appuis') > 0 && cssTxt2().indexOf('.r-essentiel{') > 0);
verifie('lecture : le sommaire vit en latéral et en barre mobile, suivi au défilement', srcRes2().indexOf('function construireSommaire(') > 0 && srcRes2().indexOf('IntersectionObserver') > 0 && cssTxt2().indexOf('#r-sommaire-mob{position:sticky') > 0 && cssTxt2().indexOf('@media (min-width:1700px)') > 0);
(function () {
  const CZ = window.Competences;
  const bas = CZ.scorer({ O: 30, C: 30, E: 30, A: 30, N: 70 }, null, null);
  const appuisBas = bas.filter(c => c.zone === 'appui');
  const coherent = appuisBas.every(c => c.potentiel >= bas.seuils.pot && c.expression >= bas.seuils.expr);
  const haut = CZ.scorer({ O: 80, C: 80, E: 80, A: 80, N: 20 }, null, null);
  verifie('compétences : trois appuis garantis même sur un profil en retrait', appuisBas.length >= 3 && bas.seuils.pot < CZ.SEUILS.potAppui && coherent);
  verifie('compétences : les seuils restent absolus sur un profil fort', haut.seuils.pot === CZ.SEUILS.potAppui && haut.seuils.expr === CZ.SEUILS.exprAppui);
})();
verifie('compétences : le récit précède la carte, pliée en exploration', srcRes2().indexOf('function recitQ16(') > 0 && srcRes2().indexOf('vous vient facilement') > 0 && srcRes2().indexOf('Explorer la carte complète') > 0 && cssTxt2().indexOf('.q16-details summary{') > 0);
verifie('compétences : le vocabulaire parle au premier contact', srcRes2().indexOf('À libérer') > 0 && srcRes2().indexOf('En retrait') > 0 && srcRes2().indexOf('facilité naturelle') > 0 && require('fs').readFileSync('visuels.js', 'utf8').indexOf('Vos appuis') > 0);
verifie('espace : trois objets nommés, le plan rassemble l\'action', require('fs').readFileSync('index.html', 'utf8').indexOf('>Mon portrait<') > 0 && require('fs').readFileSync('index.html', 'utf8').indexOf('>Mon plan<') > 0 && require('fs').readFileSync('index.html', 'utf8').indexOf('>Mon regard 360<') > 0 && srcCtrl2().indexOf("dev: ['espace-accueil-resume', 'espace-cockpit'") > 0 && srcCtrl2().indexOf("accueil: ['espace-banniere', 'espace-resultats'") > 0);
verifie('défis : le pont vers le plan lit les pistes réelles', srcCtrl2().indexOf('function comptePlan(') > 0 && srcCtrl2().indexOf('jr-plan-note') > 0);
verifie('néa : la relance ouvre sur l\'objectif engagé', srcCtrl2().indexOf('function relanceNea(') > 0 && srcCtrl2().indexOf('Où en êtes-vous cette semaine') > 0 && cssTxt2().indexOf('.nea-relance{') > 0);
verifie('version : controller et dashboard parlent d\'une seule voix', (function () { const mc = (srcCtrl2().match(/Sinea Profile (v\d+) servie/) || [])[1]; const md = (require('fs').readFileSync('dashboard.js', 'utf8').match(/Sinea Dashboard (v\d+)/) || [])[1]; return !!mc && mc === md; })());
verifie('360 croisé : quatre territoires calculés sur les compétences observées', srcCtrl2().indexOf('function croiserRegards(') > 0 && srcCtrl2().indexOf('delta >= 15') > 0 && srcCtrl2().indexOf("out.angles.push") > 0 && srcCtrl2().indexOf('COMPS_360') > 0);
verifie('360 croisé : la lecture croisée se rend dès trois regards', srcCtrl2().indexOf('function mirCroiseHtml(') > 0 && srcCtrl2().indexOf('reponsesTous.length < 3') > 0 && srcCtrl2().indexOf('Vos forces cachées') > 0 && srcCtrl2().indexOf('mirCroiseHtml(reponsesTous)') > 0 && cssTxt2().indexOf('.mir-croise{') > 0);
verifie('360 croisé : chaque angle mort devient une piste du plan', srcCtrl2().indexOf('function pisteDepuis360(') > 0 && srcCtrl2().indexOf("action: 'save_plan_suivi'") > 0 && srcCtrl2().indexOf('pisteDepuis360, enregistrerResultat') > 0);
verifie('néa : le fil conversationnel connaît le plan', srcRes2().indexOf('App.planPourNea') > 0 && srcCtrl2().indexOf('function planPourNea(') > 0 && srcCtrl2().indexOf('planPourNea, pisteDepuis360') > 0);
verifie('mesure : le sondage couvre appris et longueur', srcRes2().indexOf("AVIS_APPRIS") > 0 && srcRes2().indexOf("AVIS_LONGUEUR") > 0 && srcRes2().indexOf("J'ai appris quelque chose sur moi") > 0);
verifie('mesure : la lecture se trace par chapitre et part au beacon', srcRes2().indexOf('function traceurLecture(') > 0 && srcRes2().indexOf('sendBeacon') > 0 && srcRes2().indexOf("action: 'lecture_chapitres'") > 0 && srcRes2().indexOf('pagehide') > 0);
verifie('session : la persistance arrive avec sa sortie', srcCtrl2().indexOf("localStorage.setItem('sinea_identite'") > 0 && srcCtrl2().indexOf("localStorage.removeItem('sinea_identite')") > 0 && srcCtrl2().indexOf('function seDeconnecter(') > 0 && srcCtrl2().indexOf('seDeconnecter, planPourNea') > 0);
verifie('droits : une analyse trouvée vaut preuve du droit', srcCtrl2().indexOf('function deduireDroits(') > 0 && srcCtrl2().indexOf('deduireDroits(data.droits || droits') > 0 && srcCtrl2().indexOf("['socle', 'commercial', 'manager'].forEach(function (m) {") > 0);
verifie('espace : une fiche connue sans portrait le dit clairement', srcCtrl2().indexOf('Portrait introuvable') > 0 && srcCtrl2().indexOf('vos réponses sont souvent récupérables') > 0 && cssTxt2().indexOf('.esp-vide{') > 0);
verifie('session : le bouton est à l\'écran et stylé', idxH2.indexOf('App.seDeconnecter()') > 0 && idxH2.indexOf('Me déconnecter') > 0 && cssTxt2().indexOf('.esp-quit{') > 0);
verifie('session : le bouton passe devant le personnage', (function () { const m = cssTxt2().match(/\.esp-quit\{[^}]*\}/); const p = cssTxt2().match(/\.espace-hero-perso\{[^}]*\}/); if (!m || !p) return false; const zq = parseInt((m[0].match(/z-index:(\d+)/) || [])[1] || '0', 10); const zp = parseInt((p[0].match(/z-index:(\d+)/) || [])[1] || '0', 10); return zq > zp; })());
verifie('souvenir : la carte à partager parle Bricolage', srcRes2().indexOf('px "Bricolage Grotesque", Poppins,') > 0);
})();
(function () {
  const inv = new Set(SINEA_DATA.mini_inverses);
  const tranche = {}, chaos = {};
  const cyc = [1, 4, 2, 3];
  SINEA_DATA.mini_items.forEach(function (it, i2) {
    const haut = (i2 % 4 === 0) ? 3 : 4;
    const bas = (i2 % 4 === 0) ? 2 : 1;
    tranche[it.id] = inv.has(it.id) ? bas : haut;
    chaos[it.id] = cyc[i2 % 4];
  });
  const fT = Engine.scorerFiabilite(tranche, {});
  const fC = Engine.scorerFiabilite(chaos, {});
  verifie('fiabilité : un répondant tranché obtient la confiance du moteur', fT.score >= 85 && fT.niveau === 'élevée');
  verifie('fiabilité : un remplissage cyclique déclenche le signal hasard', fC.score <= fT.score - 14 && fC.signaux.some(function (s2) { return s2.type === 'hasard'; }));
})();
verifie('compétences : zones expliquées, légende vivante, définitions au clic', srcRes2().indexOf('q16-zones') > 0 && srcRes2().indexOf('q16-legende') > 0 && srcRes2().indexOf('function brancherQ16(') > 0 && srcRes2().indexOf('installerSommaireFlottant(); brancherQ16();') > 0 && cssTxt2().indexOf('svg.q16.q16-focus g[data-comp]') > 0);
verifie('dashboard RH : le filtre des membres vit et agit', require('fs').readFileSync('dashboard.js', 'utf8').indexOf('function filtrerMembres(') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('id="membres-filtre"') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.membres-filtre input{') > 0);
verifie('dashboard RH : cibles et encres au standard', require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.pt-s-btn{min-height:40px;}') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('#content .stat-lab{color:#4A4757;}') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.pt-b,.pt-s-btn,.exp-btn,.bd-mat-btn,.bd-mat-nom{min-height:44px;}') > 0);
verifie('dashboard RH : les retardataires sont nommés et relançables', require('fs').readFileSync('dashboard.js', 'utf8').indexOf('function copierRelance(') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('FRONT_APP + \'/?token=\'') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('En attente (') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.attente-copier{') > 0);
verifie('dashboard RH : l\'export CSV vit pour le RH aussi', require('fs').readFileSync('dashboard.js', 'utf8').indexOf('id="btn-csv-camp"') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('SUPER ? \' <button class="exp-btn exp-mini" id="btn-csv-camp"') < 0);
verifie('dashboard RH : la liste se trie par nom et par famille', require('fs').readFileSync('dashboard.js', 'utf8').indexOf('function trierMembres(') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('data-fam=') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.tri-btn.on{') > 0);
verifie('super admin : onglets au standard, badge blindé', require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.sup-onglet{min-height:40px;}') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.sup-onglet{min-height:44px;}') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('background-color:#5E59C7;background-image:linear-gradient') > 0);
verifie('feedback 360 : partage natif et repli copie', srcCtrl2().indexOf('navigator.share({ text: txt })') > 0 && srcCtrl2().indexOf("fini('Partagé ✓')") > 0 && srcCtrl2().indexOf('Partager ce message') > 0);
verifie('feedback 360 : la relance connaît l\'âge du lien', srcCtrl2().indexOf('function ageLienMiroir(') > 0 && srcCtrl2().indexOf("cree: (new Date()).toISOString().slice(0, 10)") > 0 && srcCtrl2().indexOf('Lien créé il y a') > 0);
verifie('plan : la fête du Fait', srcCtrl2().indexOf('planc-fete') > 0 && cssTxt2().indexOf('@keyframes plancFete') > 0);
verifie('constellation : cadre premium et glossaire', srcCtrl2().indexOf('Ma Constellation') > 0 && srcCtrl2().indexOf('Découvrir ma Constellation') > 0 && srcCtrl2().indexOf('function ouvrirGlossaire(') > 0 && srcCtrl2().indexOf('glos-grid') > 0 && srcCtrl2().indexOf("getComputedStyle(mat).display === 'none'") > 0 && cssTxt2().indexOf('.cstl svg{display:block;max-width:620px') > 0 && cssTxt2().indexOf('.cstl svg{min-width:640px;}') > 0 && srcCtrl2().indexOf('cstl-hint') > 0);
verifie('glossaire : coupe au mot et pastille de zone personnelle', srcCtrl2().indexOf('function coupeMot(') > 0 && srcCtrl2().indexOf('ZONES_GLOS') > 0 && srcCtrl2().indexOf('chipDe(r.id)') > 0);
verifie('carte : les étiquettes vont à la valeur, la lecture accompagne', srcCtrl2().indexOf('function idsAValeur(') > 0 && srcCtrl2().indexOf('labels: idsAValeur(comps)') > 0 && srcCtrl2().indexOf('function lectureCarte(') > 0 && srcCtrl2().indexOf('La lecture de votre carte') > 0 && cssTxt2().indexOf('.cstl-grid{display:grid') > 0);
verifie('glossaire : les facettes se montrent', srcCtrl2().indexOf('glos-f') > 0 && srcCtrl2().indexOf('Competences.FACETTES[r.id]') > 0 && srcCtrl2().indexOf('Competences.FACETTES') > 0);
verifie('constellation : l\'étoile choisie s\'allume et la fiche défile', require("fs").readFileSync("visuels.js", "utf8").indexOf("data-comp=") > 0 && srcCtrl2().indexOf("g[data-comp=") > 0 && srcCtrl2().indexOf('q16-sel') > 0 && srcCtrl2().indexOf("behavior: 'smooth', block: 'center'") > 0);
verifie('personnage : la carte-portrait déborde du hero, en majesté', cssTxt2().indexOf('.espace-hero-perso{position:absolute;right:34px;bottom:-46px') > 0 && cssTxt2().indexOf('.espace-hero-perso::before{content:none;}') > 0);
verifie('restitution : le bouton de notation a quitté l\'Essentiel', srcRes2().indexOf('ess-avis') < 0 && srcRes2().indexOf('Result.noterPortrait = function') > 0);
verifie('restitution : le jalon de lecture est auto', srcRes2().indexOf("jalon: 'lecture'") > 0 && srcRes2().indexOf('fin-lecture') > 0 && srcRes2().indexOf('IntersectionObserver') > 0);
verifie('restitution : un avis rafraîchit les étapes', srcRes2().indexOf('__avisFait = true') > 0 && srcRes2().indexOf('App.majChecklist()') > 0);

console.log('\n== 0quindecies. La mission au coach ==');
verifie('coach : endpoint et modal câblés', srcDash.indexOf('COACH_ENVOI_URL') > 0 && srcDash.indexOf('function ouvrirEnvoiCoach(') > 0 && srcDash.indexOf('function envoyerCoach(') > 0);
verifie('coach : deux portes, la fiche et le bandeau', (srcDash.match(/ouvrirEnvoiCoach\(/g) || []).length >= 3 && srcDash.indexOf("ouvrirEnvoiCoach('apprenant'") > 0 && srcDash.indexOf('ouvrirEnvoiCoach(&quot;groupe&quot;)') > 0);
verifie('coach : le payload porte la clé et la campagne', srcDash.indexOf('cle: cleAcces') > 0 && srcDash.indexOf('campagne: entrepriseCourante') > 0);
verifie('incarnation : le bouton ouvre l\'espace de l\'apprenant', srcDash.indexOf('LIEN_URL') > 0 && srcDash.indexOf('function voirCommeApprenant(') > 0 && srcDash.indexOf('Voir comme lui') > 0 && srcDash.indexOf("window.open(dj.lien, '_blank')") > 0);
verifie('portrait PDF : le portail embarque compétences, familles et plan', srcDash.indexOf('function extraPortrait(') > 0 && srcDash.indexOf('extra: extraPortrait(m)') > 0 && srcDash.indexOf('quadrant: Visuels.quadrantSvg') > 0);
verifie('incarnation : le lien se copie aussi', srcDash.indexOf('function copierLienApprenant(') > 0 && srcDash.indexOf('Copier son lien') > 0 && srcDash.indexOf('navigator.clipboard') > 0);
verifie('mobile : l\'espace a son bloc au cordeau', cssTxt2().indexOf('@media (max-width: 640px)') > 0 && cssTxt2().indexOf('.esp-nav{overflow-x:auto') > 0);
verifie('mobile : la colonne résiste à la navigation', cssTxt2().indexOf('.espace-hero-txt{width:100%;min-width:0;}') > 0);
verifie('audit : navigation collante sur fond de verre', cssTxt2().indexOf('.esp-nav{position:sticky;top:10px') > 0 && cssTxt2().indexOf('backdrop-filter:blur(10px)') > 0);
verifie('audit : cibles tactiles remontées, 44 en mobile', cssTxt2().indexOf('.ckl-deja{font-size:11.5px;color:#6E6A85;padding:9px 10px;min-height:40px') > 0 && cssTxt2().indexOf('.ckl-cta{min-height:44px;}') > 0);
verifie('audit : contrastes et focus clavier', cssTxt2().indexOf('.ckl-next-t{font-size:11px;color:#6E6A85;}') > 0 && cssTxt2().indexOf(':focus-visible') > 0 && cssTxt2().indexOf('outline:2px solid #FFD34D') > 0);
verifie('audit : la porte des bancs est documentée', srcCtrl2().indexOf('window.__auditEmail') > 0);
verifie('diag : le vérificateur d\'envoi vit dans la modal coach', srcDash.indexOf('DIAG_URL') > 0 && srcDash.indexOf('function testerConfigEnvoi(') > 0 && srcDash.indexOf('ABSENTE sur ce back') > 0);

console.log('\n== 1. Moteur de compétences : déterminisme et bornes ==');
const bf = { O: 58, C: 38, E: 72, A: 78, N: 45 };
const c1 = C.scorer(bf, { C: 18 });
verifie('déterminisme du scorer', JSON.stringify(c1) === JSON.stringify(C.scorer(bf, { C: 18 })));
verifie('le scorer rend une ligne par compétence', c1.length === C.REFERENTIEL.length);
verifie('valeurs bornées 0-100', c1.every(x => x.potentiel >= 0 && x.potentiel <= 100 && x.expression >= 0 && x.expression <= 100));
verifie('zones valides', c1.every(x => ['appui', 'opportunite', 'neutre', 'economie'].includes(x.zone)));

console.log('\n== 2. Priorisation : comptes et profil sur mesure ==');
const pri = C.prioriser(c1, 'manager');
verifie('au plus 3 appuis', pri.appuis.length <= 3);
verifie('au plus 3 opportunités', pri.opportunites.length <= 3);
verifie('au plus 2 vigilances', pri.vigilances.length <= 2);
verifie('motif présent sur chaque opportunité', pri.opportunites.every(o => o.motif === 'sous_expression' || o.motif === 'levier_de_poste'));
const coefsCrea = {}; C.REFERENTIEL.forEach(r => coefsCrea[r.id] = r.id === 'creativite' ? 1.35 : 0.7);
const priCustom = C.prioriser(C.scorer({ O: 62, C: 55, E: 55, A: 55, N: 45 }, null), 'manager', coefsCrea);
verifie('le profil sur mesure change le libellé', priCustom.poste === 'Profil cible sur mesure');
verifie('les coefficients sur mesure pèsent', JSON.stringify(priCustom.opportunites.map(o => o.id)) !== JSON.stringify(C.prioriser(C.scorer({ O: 62, C: 55, E: 55, A: 55, N: 45 }, null), 'manager').opportunites.map(o => o.id)) || priCustom.opportunites.some(o => o.id === 'creativite'));

console.log('\n== 3. Dimensions métier : la fusion agit ==');
const sansDims = C.scorer(bf, null).find(x => x.id === 'orientation_resultats').expression;
const avecDims = C.scorer(bf, null, { closing: 92 }).find(x => x.id === 'orientation_resultats').expression;
verifie('closing 92 relève l\'expression orientation résultats', avecDims > sansDims + 5);
const autre = C.scorer(bf, null, { closing: 92 }).find(x => x.id === 'creativite').expression;
verifie('les compétences sans dimension liée restent intactes', autre === C.scorer(bf, null).find(x => x.id === 'creativite').expression);

console.log('\n== 4. Collectif : référents relatifs, orphelines, chantiers ==');
const equipeForte = [1, 2, 3, 4].map(i => ({ nom: 'M' + i, bigFive: { O: 70, C: 70, E: 70, A: 70, N: 30 }, ecarts: null }));
const collForte = C.collectif(equipeForte);
verifie('équipe uniformément forte : peu ou pas de référents (règle relative)', collForte.referents.length <= 3);
const equipeMixte = [
  { nom: 'Zohra', bigFive: { O: 58, C: 38, E: 72, A: 78, N: 45 }, ecarts: { C: 18 } },
  { nom: 'Marc', bigFive: { O: 35, C: 82, E: 42, A: 50, N: 38 }, ecarts: null },
  { nom: 'Léa', bigFive: { O: 66, C: 52, E: 70, A: 62, N: 42 }, ecarts: { E: -22, O: -14 } },
];
const collMixte = C.collectif(equipeMixte);
verifie('équipe contrastée : des référents émergent', collMixte.referents.length >= 3);
verifie('matrice complète exposée', (collMixte.matrice || []).length === C.REFERENTIEL.length);
verifie('chantiers au plus 3 avec motif', collMixte.chantiers.length <= 3 && collMixte.chantiers.every(x => x.motif));
const equipeBasse = [1, 2, 3].map(i => ({ nom: 'B' + i, bigFive: { O: 30, C: 30, E: 30, A: 30, N: 70 }, ecarts: null }));
verifie('équipe au potentiel bas : orphelines détectées', C.collectif(equipeBasse).orphelines.length > 0);

console.log('\n== 5. Matcheur défi vers compétence ==');
const attendus = [
  ['Le compliment à un concurrent', 'Communication d\'influence'],
  ['La revue du soir 5 minutes', 'Organisation et planification'],
  ['Le mail post-RDV en 3 lignes', 'Fiabilité de suivi'],
  ['La délégation d une tâche complète', 'Développement des autres'],
  ['Le feedback en 24 heures', 'Développement des autres'],
  ['La question ouverte du matin', 'Écoute active'],
];
attendus.forEach(([titre, comp]) => {
  const m = C.matcherCompetence(titre);
  verifie('« ' + titre + ' » -> ' + comp, m && m.nom === comp);
});
verifie('titre sans rapport -> aucun lien', C.matcherCompetence('Un truc sans rapport') === null);

console.log('\n== 6. Expression vue par les pairs ==');
const vueA = C.expressionDepuis({ E: 50, A: 40, C: 50, S: 50, O: 50 });
const vueB = C.expressionDepuis({ E: 50, A: 80, C: 50, S: 50, O: 50 });
verifie('agréabilité perçue en hausse : écoute active perçue en hausse', vueB.ecoute_active > vueA.ecoute_active);
verifie('bornes respectées', Object.values(vueB).every(v => v >= 0 && v <= 100));

console.log('\n== 7. Percentiles : branchement prêt ==');
// Contrat : 19 seuils, les valeurs des percentiles 5, 10, ..., 95
SINEA_DATA.normes = { E: Array.from({ length: 19 }, (_, i) => (i + 1) * 5) };
verifie('score 47 tombe autour de la médiane (rang 50)', Engine.percentileTrait('E', 47) === 50);
verifie('score plancher : rang 5', Engine.percentileTrait('E', 3) === 5);
verifie('trait sans normes : null', Engine.percentileTrait('A', 55) === null);
SINEA_DATA.normes = null;

console.log('\n== 8. Gamification retirée : décision produit du re-pilote ==');
// Quatre testeurs sur huit ont nommé l'abondance, Mathis a demandé de justifier
// le jardin. La règle retenue : tout visuel doit porter une information, la
// décoration seule disparaît. Ces gardes empêchent le jardin de revenir.
verifie('le jardin d\'ancrage a disparu du code', srcCtrl2().indexOf('jardinSvg') < 0 && srcCtrl2().indexOf('etapeJardin') < 0 && srcCtrl2().indexOf('exporterJardinImage') < 0);
verifie('la scène d\'aube et ses fleurs ont disparu', srcCtrl2().indexOf('jgd-ciel') < 0 && srcCtrl2().indexOf('ckl-bloom') < 0 && srcCtrl2().indexOf('fleurJ') < 0);
verifie('les points de la checklist ont disparu', srcCtrl2().indexOf('pts: 10') < 0 || srcCtrl2().indexOf(' pts</i>') < 0);
verifie('le CSS du jardin est parti avec lui', cssTxt2().indexOf('.jr-svg') < 0 && cssTxt2().indexOf('ckl-serre') < 0 && cssTxt2().indexOf('cklBloom') < 0);
verifie('la liste des défis SeedUp reste entière', srcCtrl2().indexOf('function poserSeedupEspace(') > 0 && srcCtrl2().indexOf('carteDefi') > 0 && srcCtrl2().indexOf('Vos défis, un à un') > 0);
verifie('le pont vers le plan reste', srcCtrl2().indexOf('jr-plan-note') > 0 && srcCtrl2().indexOf('function comptePlan(') > 0 && srcCtrl2().indexOf('ouvrirPlanDepuisResto') > 0);
verifie('la pousse du tunnel reste, elle porte la progression', fs.readFileSync('index.html', 'utf8').indexOf('id="q-pousse"') > 0 && srcCtrl2().indexOf('function majPousse(') > 0);

console.log('\n== 9. Identité des archétypes : résolution tolérante ==');
// Un portrait enregistré fige le libellé en vigueur au jour de sa génération.
// La résolution centrale doit retrouver l'archétype à partir de n'importe quel
// libellé connu, actuel comme historique, ainsi que de la clé technique.
verifie('SINEA_DATA expose la résolution centrale',
  typeof SINEA_DATA.slug === 'function' && typeof SINEA_DATA.image === 'function');
const idsArch = Object.keys(SINEA_DATA.personnages);
const libellesHisto = [];
(SINEA_DATA.variantes || []).forEach(function (g) { g.forEach(function (v) { libellesHisto.push(v); }); });
verifie('tout libellé historique retrouve son visuel et sa fiche',
  libellesHisto.length > 0 && libellesHisto.every(function (l) {
    return SINEA_DATA.slug(l) && SINEA_DATA.image(l)
      && Object.keys(SINEA_DATA.fiche(l)).length > 0 && SINEA_DATA.perso(l);
  }));
verifie('les tables indexées par libellé suivent personnages',
  ['images', 'slugs', 'profils', 'familles'].every(function (t) {
    return Object.keys(SINEA_DATA[t]).sort().join('|')
      === idsArch.map(function (i) { return SINEA_DATA.personnages[i].nom; }).sort().join('|');
  }));
verifie('controller.js et result.js passent par la résolution',
  srcCtrl2().indexOf('SINEA_DATA.images[') < 0
  && srcRes2().indexOf('SINEA_DATA.images[') < 0
  && srcRes2().indexOf('SINEA_DATA.slugs[') < 0);
verifie('verifs_visuels.js est présent au dépôt', fs.existsSync('verifs_visuels.js'));

console.log('\n== 10. Lecture des modules metier et sommaire ==');
// Le tunnel et l'espace ouvraient un module metier avec les blocs et le
// sommaire du socle. Le mode de lecture se deduit desormais du module lu.
verifie('le mode de lecture se deduit du module',
  srcRes2().includes('function modeLecturePour(res)')
  && srcRes2().includes("setModeLecture(mode === 'spe' ? 'spe' : modeLecturePour(res))"));
verifie('le sommaire de tete suit le module lu',
  srcRes2().includes('const lectureSpe = (dt === \'manager\' || dt === \'commercial\')')
  && srcRes2().includes("{ href: 'spe-ch2', label: 'Vous en situation' }"));
verifie('le sommaire flottant parcourt les chapitres du module en lecture metier',
  srcRes2().includes("scr.querySelectorAll(lectureSpe ? '.spe-chap' : '.r-bloc')")
  && srcRes2().includes(".spe-chap-head h3"));
verifie('le sommaire mobile s\'efface a la descente',
  srcRes2().includes("mob.classList.add('somm-cache')")
  && cssTxt2().includes('#r-sommaire-mob.somm-cache'));
verifie('les ancres reservent la hauteur du sommaire mobile',
  cssTxt2().includes('scroll-margin-top:74px'));

console.log('\n== 11. L\'espace hiérarchisé et le passage à l\'action ==');
// Chantier 2 du re-pilote : l'espace notait 2,9 sur 5 et une personne sur huit
// avait engagé son plan. Trois décisions : l'ordre du DOM suit la valeur, le
// plan s'ouvre en un geste, les défis générés survivent à la navigation.
const idx = fs.readFileSync('index.html', 'utf8');
verifie('espace : les résultats arrivent avant la carte des compétences',
  idx.indexOf('id="espace-resultats"') > 0
  && idx.indexOf('id="espace-resultats"') < idx.indexOf('id="espace-competences"'));
verifie('espace : Néa ferme la marche de l\'onglet Agir',
  idx.indexOf('id="espace-seedup"') < idx.indexOf('id="espace-nea"'));
verifie('espace : l\'onglet d\'accueil ouvre sur les résultats',
  srcCtrl2().indexOf("accueil: ['espace-banniere', 'espace-resultats'") > 0);
verifie('compétences : les appuis restent visibles, le détail se déplie',
  srcCtrl2().indexOf('esp-cp-deplier') > 0 && srcCtrl2().indexOf("id=\"esp-cp-suite\" style=\"display:none\"") > 0
  && srcCtrl2().indexOf('function deplierCompetences()') > 0
  && srcCtrl2().indexOf("Vos terrains d\\'appui") < srcCtrl2().indexOf('esp-cp-deplier'));
verifie('plan : l\'étape des 90 jours l\'ouvre directement quand il existe',
  srcCtrl2().indexOf("aPlan ? 'App.ouvrirPlanDepuisResto(") > 0);
verifie('plan : le cockpit porte le raccourci permanent',
  srcCtrl2().indexOf('ck-plan-btn') > 0 && cssTxt2().indexOf('.ck-plan-btn{') > 0
  && srcCtrl2().indexOf('planRapide + eng') > 0);
verifie('défis : les défis conservés se réaffichent avant tout appel réseau',
  srcRes2().indexOf('const conserves = lireDefisConserves();') > 0
  && srcRes2().indexOf('conserverDefis(defis);') > 0
  && srcRes2().indexOf("localStorage.setItem(cleDefis()") > 0);
verifie('défis : ils voyagent dans les deux payloads d\'interactions',
  (srcRes2().match(/defis_proposes:/g) || []).length === 2);
verifie('défis : l\'espace les retrouve, Airtable puis mémoire de l\'appareil',
  srcCtrl2().indexOf('it.defis_proposes') > 0
  && srcCtrl2().indexOf("localStorage.getItem('sinea_defis_'") > 0
  && srcCtrl2().indexOf('esp-sd-propose') > 0 && cssTxt2().indexOf('.esp-sd-propose{') > 0);
verifie('défis : le bloc apparaît dès que des défis proposés existent',
  srcCtrl2().indexOf('!liste.length && planInfo.total === 0 && !proposes.length') > 0);

console.log('\n== 12. La densité du portrait : chapitres et Essentiel unifié ==');
// Chantier 3 du re-pilote : trois lecteurs sur huit trouvaient le portrait
// trop long, deux avaient proposé la révélation par paliers. L'Essentiel
// notait 3,25 sur 5 avec deux blocs homonymes empilés en tête de portrait.
verifie('chapitres : les quatre chapitres profonds se plient au premier rendu',
  srcRes2().indexOf("const CHAPITRES_PLIABLES = ['b-dims', 'b2', 'b3', 'b-spe']") > 0
  && srcRes2().indexOf('function poserChapitres()') > 0
  && srcRes2().indexOf('poserChapitres();') > 0);
verifie('chapitres : accroche, temps de lecture et tout déplier',
  srcRes2().indexOf('tempsLectureMin') > 0 && srcRes2().indexOf('chap-accroche') > 0
  && srcRes2().indexOf('deplierTout') > 0 && cssTxt2().indexOf('.chap-ouvrir{') > 0);
verifie('chapitres : une ouverture se mémorise par module',
  srcRes2().indexOf("'sinea_chap_'") > 0 && srcRes2().indexOf('chapitresOuverts()') > 0);
verifie('chapitres : le sommaire ouvre un chapitre plié avant d\'y défiler',
  srcRes2().indexOf("contains('chap-plie')) ouvrirChapitre(id)") > 0);
verifie('chapitres : le mode candidat et la lecture métier restent entiers',
  srcRes2().indexOf("modeCampagne === 'recrutement') return") > 0
  && srcRes2().indexOf("contains('mode-spe')) return") > 0);
verifie('essentiel : un seul bloc porte ce nom',
  (srcRes2().match(/L\\'essentiel/g) || []).length === 1);
verifie('essentiel : la clé de lecture s\'annonce comme telle',
  srcRes2().indexOf('Avant de lire · la clé et la fiabilité') > 0
  && srcRes2().indexOf("indexOf('ess-cle') < 0 && h.indexOf('ess-fiab') < 0) return") > 0);
verifie('essentiel : le trio en pourcentages et les traces ont disparu',
  srcRes2().indexOf('ess-trio') < 0 && srcRes2().indexOf('ess-traces') < 0);
verifie('repères : les trois repères pour agir vivent au chapitre de l\'action',
  srcRes2().indexOf("id = 'reperes-agir'") > 0
  && srcRes2().indexOf("getElementById('b3')") > 0);

console.log('\n== 13. Les défauts nommés du re-pilote ==');
// Jade : scellement échoué, regards désalignés, aucune opportunité.
verifie('miroir : le pari envoie aussi l\'email quand la session le porte',
  srcCtrl2().indexOf("email: identite.email || undefined, prediction") > 0);
verifie('regards : trois colonnes fixes en chiffres tabulaires',
  srcCtrl2().indexOf('esp-mir-col') > 0
  && cssTxt2().indexOf('grid-template-columns:58px 62px 46px') > 0
  && cssTxt2().indexOf('tabular-nums') > 0);
(function () {
  global.window = {};
  const C = (function () {
    const fs2 = require('fs');
    eval(fs2.readFileSync('competences.js', 'utf8').replace(/window\.Competences\s*=/, 'global.__C ='));
    return global.__C;
  })();
  let sans = 0;
  for (let n = 0; n < 3000; n++) {
    const bf = { O: 20 + Math.random() * 75, C: 20 + Math.random() * 75, E: 20 + Math.random() * 75, A: 20 + Math.random() * 75, S: 20 + Math.random() * 75 };
    const comps = C.scorer(bf, null, null);
    ['manager', 'commercial'].forEach(function (poste) {
      const p2 = C.prioriser(comps, poste);
      if (!p2.appuis.length || !p2.opportunites.length) sans++;
    });
  }
  verifie('compétences : tout profil reçoit appuis et opportunités, six mille tirages', sans === 0);
  verifie('compétences : les planchers relatifs sont posés dans la priorisation',
    fs.readFileSync('competences.js', 'utf8').indexOf('marge_de_progression') > 0);
})();

console.log('\n== 14. L\'ADN du scoring : mesures rejouées à chaque lancement ==');
// Le cœur métrologique, audité puis figé. Générateur déterministe : les
// mêmes tirages à chaque lancement, un écart signale un vrai changement.
(function () {
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const alea = mulberry32(20260727);
  global.window = {};
  eval(fs.readFileSync('engine.js', 'utf8').replace(/const Engine = \{/, 'global.__E = {').replace(/window\.Engine = /, 'global.__E2 = '));
  const E = global.__E || global.__E2;
  const D = SINEA_DATA;
  const inv = new Set(D.mini_inverses);
  verifie('mesure : 25 items, cinq par trait, au moins deux inversés par trait',
    Object.values(D.mini_scoring).every(function (i) { return i.items.length === 5 && i.items.filter(function (id) { return inv.has(id); }).length >= 2; }));
  verifie('mesure : la triangulation par choix forcé est branchée au scoring',
    srcEng().indexOf('mini_choix_force') > 0 && srcEng().indexOf('0.7') > 0);
  verifie('scoring : l\'équité structurelle normalise les potentiels',
    srcEng().indexOf('calculerPotentielsSinea') > 0 && srcEng().indexOf('potMoyen / p') > 0);
  function personne() {
    const latent = {}; Object.keys(D.mini_scoring).forEach(function (d2) { latent[d2] = alea(); });
    const rep = {};
    Object.entries(D.mini_scoring).forEach(function (e2) {
      e2[1].items.forEach(function (id) {
        let p2 = latent[e2[0]] + (alea() - 0.5) * 0.5; p2 = Math.max(0, Math.min(1, p2));
        let r2 = 1 + Math.round(p2 * 3); if (inv.has(id)) r2 = 5 - r2; rep[id] = r2;
      });
    });
    return rep;
  }
  const ids = []; Object.values(D.mini_scoring).forEach(function (i) { i.items.forEach(function (id) { ids.push(id); }); });
  const compte = {}; let blendKo = 0; const N = 5000;
  for (let n = 0; n < N; n++) {
    const r = E.scorer(personne(), {}, {});
    const s2 = D.slug(r.dominante.nom); compte[s2] = (compte[s2] || 0) + 1;
    if (r.blend && Object.values(r.blend).reduce(function (a2, b2) { return a2 + b2; }, 0) !== 100) blendKo++;
  }
  verifie('scoring : les trois pourcentages totalisent 100 sur cinq mille passations', blendKo === 0);
  verifie('scoring : les vingt archétypes sont tous atteignables',
    Object.keys(D.rarete).every(function (s2) { return (compte[s2] || 0) > 0; }));
  verifie('scoring : aucun archétype ne dépasse le quart des verdicts',
    Object.values(compte).every(function (c2) { return c2 / N < 0.25; }));
  verifie('rareté : la distribution mesurée reste dans un facteur quatre de la table',
    Object.keys(D.rarete).every(function (s2) {
      const ann = parseFloat(D.rarete[s2].pct), mes = (compte[s2] || 0) / N * 100;
      return mes < Math.max(ann * 4, 3) && mes > ann / 4 - 0.5;
    }));
  let flip1 = 0, flip3 = 0; const M = 2500;
  for (let n = 0; n < M; n++) {
    const rep = personne(); const r0 = E.scorer(rep, {}, {});
    const rep1 = Object.assign({}, rep);
    const id1 = ids[Math.floor(alea() * ids.length)];
    rep1[id1] = Math.max(1, Math.min(4, rep1[id1] + (alea() < 0.5 ? -1 : 1)));
    if (E.scorer(rep1, {}, {}).dominante.nom !== r0.dominante.nom) flip1++;
    const rep3 = Object.assign({}, rep);
    for (let k = 0; k < 3; k++) { const j = ids[Math.floor(alea() * ids.length)]; rep3[j] = Math.max(1, Math.min(4, rep3[j] + (alea() < 0.5 ? -1 : 1))); }
    if (E.scorer(rep3, {}, {}).dominante.nom !== r0.dominante.nom) flip3++;
  }
  verifie('stabilité : une réponse déplacée d\'un cran change le verdict sous 15 %', flip1 / M < 0.15);
  verifie('stabilité : le bruit d\'une repasse, trois réponses, change le verdict sous 25 %', flip3 / M < 0.25);
  // Preuve constructive d'atteignabilité : un témoin par personnage, une
  // passation concrète qui le produit. Dix-neuf partent de leur vecteur de
  // référence ; le Conteur exige un vecteur décalé, son vecteur de référence
  // tombe dans le bassin de l'Architecte, décalage documenté à trancher.
  const lettre = { extraversion: 'E', agreabilite: 'A', conscience: 'C', neuroticisme: 'N', ouverture: 'O' };
  const toutesQ = [].concat.apply([], Object.values(D.sinea_famille)).concat(D.sinea_hybride, D.sinea_transversales);
  const TEMOINS = { conteur: { E: 60, A: 82, C: 67, N: 27, O: 84 } };
  function miniPour(cible) {
    const rep = {};
    Object.entries(D.mini_scoring).forEach(function (e2) {
      const v = cible[lettre[e2[0]]]; if (v === undefined) return;
      e2[1].items.forEach(function (id) {
        let r2 = 1 + Math.round(v / 100 * 3); if (inv.has(id)) r2 = 5 - r2;
        rep[id] = Math.max(1, Math.min(4, r2));
      });
    });
    return rep;
  }
  function sineaPour(slug) {
    const rep = {};
    toutesQ.forEach(function (q) {
      let mi = 0, pts = -1;
      (q.options || []).forEach(function (o, i) { const p2 = (o.ponderation || {})[slug] || 0; if (p2 > pts) { pts = p2; mi = i; } });
      rep[q.id] = mi;
    });
    return rep;
  }
  const rates = Object.keys(D.rarete).filter(function (slug) {
    const cible = TEMOINS[slug] || D.profils[D.nom(slug)];
    return D.slug(E.scorer(miniPour(cible), sineaPour(slug), {}).dominante.nom) !== slug;
  });
  verifie('atteignabilité : un témoin concret produit chacun des vingt personnages',
    rates.length === 0);
})();

console.log('\n== 15. Bannière, Sparring, Preuve Vivante ==');
// Trois chantiers d'écart concurrentiel. La famille comme langue, la
// conversation entraînée contre un archétype, l'instrument qui publie
// ses propres chiffres sur sa vraie population.
verifie('simplification : le test express est retiré du dépôt',
  fs.existsSync('famille.html') === false);
verifie('familles : la table familles_cle porte les quatre, complètes',
  ['RELATION', 'ACTION', 'STRUCTURE', 'VISION'].every(function (k) {
    const g = (SINEA_DATA.familles_cle || {})[k];
    return g && g.verbe && g.question && g.essence && g.union && g.parler && g.tension && g.repere;
  }));
verifie('familles : les quatre verbes sont UNIR, OSER, CADRER, IMAGINER',
  SINEA_DATA.familles_cle.RELATION.verbe === 'UNIR' && SINEA_DATA.familles_cle.ACTION.verbe === 'OSER'
  && SINEA_DATA.familles_cle.STRUCTURE.verbe === 'CADRER' && SINEA_DATA.familles_cle.VISION.verbe === 'IMAGINER');
verifie('portrait : le récit des familles, prologue, quatre voix, chute, poster',
  srcRes2().indexOf('function poserFamilleClef(') > 0 && srcRes2().indexOf('poserFamilleClef(res);') > 0
  && srcRes2().indexOf('fk-prologue') > 0 && srcRes2().indexOf('SINEA_DATA.familles_prologue') > 0
  && srcRes2().indexOf('fk-recit') > 0 && srcRes2().indexOf('fk-chute') > 0
  && srcRes2().indexOf('fk-cle-l') > 0 && srcRes2().indexOf('id="famille-clef"') > 0
  && cssTxt2().indexOf('.fk-prologue{') > 0 && cssTxt2().indexOf('.fk-voix{') > 0);
verifie('portrait : les voix portent les vrais personnages en vignettes',
  srcRes2().indexOf("SINEA_DATA.famille(id) === f2") > 0
  && srcRes2().indexOf('SINEA_DATA.image(x.id)') > 0
  && srcRes2().indexOf("recit") > 0);
verifie('symboles : les quatre familles portent leur tracé, tiré des récits',
  ['RELATION', 'ACTION', 'STRUCTURE', 'VISION'].every(function (k) {
    const g = SINEA_DATA.familles_cle[k];
    return g && g.symbole && g.symbole.indexOf('stroke-linecap') > 0;
  })
  && SINEA_DATA.familles_cle.STRUCTURE.symbole.indexOf('17.5v-2.4') > 0
  && SINEA_DATA.familles_cle.VISION.symbole.indexOf('rect') === 1);
verifie('symboles : branchés aux voix, à la bannière et au Sparring',
  srcRes2().indexOf('svgFam(g, 18)') > 0 && srcRes2().indexOf('fk-ic') > 0
  && srcCtrl2().indexOf('gFam.symbole') > 0
  && srcCtrl2().indexOf('spar-ic') > 0
  && cssTxt2().indexOf('.fk-ic{') > 0 && cssTxt2().indexOf('.spar-ic{') > 0);
verifie('familles : les quatre récits vivent dans le référentiel, prologue compris',
  ['RELATION', 'ACTION', 'STRUCTURE', 'VISION'].every(function (k) {
    const g = SINEA_DATA.familles_cle[k];
    return g && g.recit && g.recit.length > 100;
  }) && String(SINEA_DATA.familles_prologue || '').indexOf('quatre voix') > 0);
verifie('combinaison : trio proportionnel et signature en trois faits',
  srcRes2().indexOf('function poserCombinaison(') > 0
  && srcRes2().indexOf('combinaison-clef') > 0
  && srcRes2().indexOf('combinaisons possibles') > 0
  && srcRes2().indexOf('const tailles = [132, 92, 72]') > 0
  && srcRes2().indexOf('phraseSignature(res, rar)}') < 0
  && cssTxt2().indexOf('.cb-trio{') > 0);
verifie('fin de lecture : le geste principal est de donner son avis',
  srcRes2().indexOf('>Je donne mon avis</button>') > 0
  && srcRes2().indexOf('Result.ouvrirNotation()') > 0);
verifie('compétences du portrait : l\'ordre du lecteur, héros, carte, méthodo en dernier',
  (function () {
    const r = srcRes2();
    const iIntro = r.indexOf('cph-intro'), iHeros = r.indexOf('<div class="cph-liste">${heros}</div>'),
      iCarte = r.indexOf('<div id="cph-carte">'), iLeg = r.indexOf('cph-legende'),
      iMet = r.indexOf('${methodo}`;');
    return iIntro > 0 && iIntro < iHeros && iHeros < iCarte && iCarte < iLeg && iLeg < iMet
      && r.indexOf('cases hors diagonale') > 0
      && r.indexOf('la m\\u00e9thode, en chiffres</a>') > 0
      && cssTxt2().indexOf('.cph-legende{') > 0 && cssTxt2().indexOf('.cph-met-rh{') > 0;
  })());
verifie('constellation : les zones du moteur, seuil au centre, halo, sans invention',
  (function () {
    const v = fs.readFileSync('visuels.js', 'utf8');
    return v.indexOf('SUR-RÉGIME') < 0 && v.indexOf('EN VEILLE') < 0
      && v.indexOf('Quatre cases de même taille') > 0 && v.indexOf('nb.hd') > 0
      && v.indexOf('const mx = Math.round((x0 + x1) / 2)') > 0 && v.indexOf('le paysage') > 0
      && v.indexOf('stroke-opacity="0.4"') > 0;
  })());
verifie('constellation : les marges rendues à la donnée, les points occupent la place',
  (function () {
    const v = fs.readFileSync('visuels.js', 'utf8');
    return v.indexOf('min-max par c\u00f4t\u00e9') > 0 && v.indexOf('const PAD = 18') > 0 && v.indexOf('Espace de s\u00e9curit\u00e9') > 0
      && v.indexOf('Math.floor(lo / 5)') < 0;
  })());
verifie('scoring : les deux écritures du contrat, N portail et S direct, sont identiques',
  (function () {
    const a2 = window.Competences.scorer({ O: 48, C: 70, E: 44, A: 62, N: 15 }, {}, {});
    const b2 = window.Competences.scorer({ O: 48, C: 70, E: 44, A: 62, S: 85 }, {}, {});
    return a2.every(function (c, i) { return Math.abs(c.potentiel - b2[i].potentiel) < 0.01; });
  })());
verifie('cohérence : la stabilité haute porte la résilience en tête',
  (function () {
    const tri = window.Competences.scorer({ O: 48, C: 70, E: 44, A: 62, N: 15 }, {}, {}).slice().sort(function (a2, b2) { return b2.potentiel - a2.potentiel; });
    return tri.slice(0, 3).some(function (c) { return c.id === 'resilience'; });
  })());
verifie('cohérence : la conscience haute porte rigueur et organisation en tête',
  (function () {
    const tri = window.Competences.scorer({ O: 45, C: 88, E: 48, A: 58, N: 38 }, {}, {}).slice().sort(function (a2, b2) { return b2.potentiel - a2.potentiel; });
    const t3 = tri.slice(0, 3).map(function (c) { return c.id; });
    return t3.indexOf('rigueur') >= 0 && t3.indexOf('organisation') >= 0;
  })());
verifie('cohérence : le déclaré à 55 pour cent crée la divergence attendue',
  (function () {
    const comps = window.Competences.scorer({ O: 86, C: 40, E: 82, A: 50, N: 42 }, { C: 20 }, { cadrage: 75 });
    const org = comps.filter(function (c) { return c.id === 'organisation'; })[0];
    return org && org.expression - org.potentiel >= 8;
  })());
verifie('constellation : la garde d\'occupation, les points remplissent la carte',
  (function () {
    const serre = [];
    for (let i = 0; i < 16; i += 1) serre.push({ id: 'c' + i, nom: 'C' + i, famille: 'ACTION', potentiel: 58 + (i % 5) * 2, expression: 57 + ((i * 3) % 7), zone: 'neutre' });
    const svg = window.Visuels.quadrantSvg(serre, {});
    const pts = Array.from(svg.matchAll(/data-comp="c\d+"[^>]*>[^<]*<circle cx="(\d+)" cy="(\d+)"/g)).map(function (m2) { return [+m2[1], +m2[2]]; });
    if (pts.length !== 16) return false;
    const xs = pts.map(function (p2) { return p2[0]; }), ys = pts.map(function (p2) { return p2[1]; });
    const occX = (Math.max.apply(null, xs) - Math.min.apply(null, xs)) / (616 - 64);
    const occY = (Math.max.apply(null, ys) - Math.min.apply(null, ys)) / 380;
    return occX > 0.6 && occY > 0.6;
  })());
verifie('constellation : toutes les coordonnées restent dans le cadre, haut et bas',
  (function () {
    const bas = [
      { id: 'a', nom: 'A', famille: 'ACTION', potentiel: 44, expression: 41, zone: 'neutre' },
      { id: 'b', nom: 'B', famille: 'VISION', potentiel: 66, expression: 48, zone: 'opportunite' },
      { id: 'c', nom: 'C', famille: 'RELATION', potentiel: 70, expression: 64, zone: 'appui' },
      { id: 'd', nom: 'D', famille: 'STRUCTURE', potentiel: 52, expression: 71, zone: 'neutre' },
    ];
    bas.seuils = { pot: 62, expr: 58 };
    const svg = window.Visuels.quadrantSvg(bas, {});
    const cys = Array.from(svg.matchAll(/<g[^>]*data-comp="[^"]*"[^>]*>[\s\S]*?<circle cx="(\d+)" cy="(\d+)"/g)).map(function (m) { return [+m[1], +m[2]]; });
    return cys.length === 4 && cys.every(function (c) { return c[0] >= 60 && c[0] <= 620 && c[1] >= 36 && c[1] <= 460; });
  })());
verifie('matrice : la clé en quatre tuiles, un geste par case',
  (function () {
    const r = srcRes2();
    return r.indexOf('cph-cle4') > 0 && (r.match(/<em>/g) || []).length >= 4 && r.indexOf('Le geste') < 0
      && r.indexOf("Tenues par l'effort") > 0 && r.indexOf('c4-bd') > 0
      && fs.readFileSync('visuels.js', 'utf8').indexOf('PAR L\\u2019EFFORT · ') > 0
      && fs.readFileSync('visuels.js', 'utf8').indexOf('const CASES = {') > 0
      && cssTxt2().indexOf('.cph-cle4{') > 0;
  })());
verifie('constellation : la matrice compte juste, case par case',
  (function () {
    const fake = [
      { id: 'a', nom: 'A', famille: 'ACTION', potentiel: 70, expression: 66, zone: 'appui' },
      { id: 'b', nom: 'B', famille: 'VISION', potentiel: 66, expression: 50, zone: 'opportunite' },
      { id: 'c', nom: 'C', famille: 'RELATION', potentiel: 50, expression: 66, zone: 'neutre' },
    ];
    fake.seuils = { pot: 62, expr: 58 };
    const svg = window.Visuels.quadrantSvg(fake, {});
    return svg.indexOf('VOS FORCES · 1') > 0 && svg.indexOf('EN RETRAIT · ') > 0
      && svg.indexOf('stroke-opacity="0.4"') > 0;
  })());
verifie('fiche espace : lecture, prochain pas, le reste replié',
  srcCtrl2().indexOf('esp-cp-lecture') > 0 && srcCtrl2().indexOf('VOTRE PROCHAIN PAS') > 0
  && srcCtrl2().indexOf('<details class="esp-cp-plus">') > 0
  && srcCtrl2().indexOf('Aller plus loin') > 0
  && cssTxt2().indexOf('.esp-cp-pas{') > 0);
verifie('portail : la carte du plan lisible, le compteur à trois, le pari en pastilles',
  srcCtrl2().indexOf('ouvre à la troisième') > 0 && srcCtrl2().indexOf('pari-val') > 0
  && cssTxt2().indexOf('.acc-resume{background:radial-gradient') > 0
  && cssTxt2().indexOf('.pari-val{') > 0);
verifie('déploiement : seuil trois partout, trois défis en cours, suivi riche',
  srcCtrl2().indexOf("' / 3'") > 0 && srcCtrl2().indexOf('dès trois regards reçus') > 0
  && srcCtrl2().indexOf('Recevoir trois regards') > 0
  && srcCtrl2().indexOf('cartes.slice(0, 3)') > 0 && srcCtrl2().indexOf('plan-avenir') > 0
  && srcCtrl2().indexOf("premier_pas: a.premier_pas") > 0
  && cssTxt2().indexOf('.plan-avenir{') > 0);
verifie('architecture : le bloc c360 vit dans la fermeture, plus rien après',
  (function () {
    const src = srcCtrl2();
    const fin = src.indexOf('\n})();');
    return src.indexOf('const C360_URL') > 0 && src.indexOf('const C360_URL') < fin
      && src.indexOf('return { c360: c360Api,') > 0
      && src.slice(fin).indexOf('API_BASE') < 0;
  })());
verifie('audit : scroll rendu, Néa protégée, familles en .webp, code libre',
  (function () {
    const css = cssTxt2();
    const res = require('fs').readFileSync('result.js', 'utf8');
    const idx = require('fs').readFileSync('index.html', 'utf8');
    return css.indexOf('height:auto') > 0 && css.indexOf('#screen-result,#screen-question,#screen-chapter') > 0
      && css.indexOf('.chap-nea{flex-shrink:0') > 0
      && res.split(".webp").length >= 4 && res.indexOf("slugC + '.webp'") > 0
      && srcCtrl2().indexOf("typeof vid.play === 'function'") > 0
      && srcCtrl2().indexOf("sinea_chap_classic'); } catch") > 0
      && idx.indexOf('maxlength="12"') > 0;
  })());
verifie('design : plus aucune rayure blanche, familles et héros en dégradés pleins',
  (function () {
    const css = cssTxt2();
    const i = css.indexOf('.cph:before{');
    return css.indexOf('repeating-linear-gradient(-58deg') < 0
      && i > 0 && css.slice(i, i + 220).indexOf('repeating') < 0
      && css.indexOf('.fk-vt{') > 0;
  })());
verifie('dashboard : aucun appel ne peut figer la page, boutons repliables',
  (function () {
    const js = require('fs').readFileSync('dashboard.js', 'utf8');
    const html = require('fs').readFileSync('dashboard.html', 'utf8');
    return js.indexOf('function postJson(') > 0 && js.indexOf('AbortController') > 0
      && js.indexOf('ne répond pas, réessayez') > 0
      && js.indexOf('postJson(LIEN_URL') > 0
      && html.indexOf('.fm-head{flex-wrap:wrap') > 0
      && html.indexOf('flex:1 1 calc(50% - 8px)') > 0;
  })());
verifie('référentiel 1.1 : dix-neuf compétences, aucune mention chiffrée en dur',
  (function () {
    const R = window.Competences.REFERENTIEL;
    const ids = R.map(function (r) { return r.id; });
    const neuves = ['gestion_conflits', 'orientation_client', 'recevoir_feedback'];
    const poidsOk = R.every(function (r) {
      var t = 0; Object.keys(r.poids).forEach(function (k) { t += r.poids[k]; });
      return Math.abs(t - 1) < 0.001;
    });
    return R.length === 19 && neuves.every(function (n) { return ids.indexOf(n) >= 0; })
      && new Set(ids).size === R.length && poidsOk
      && srcCtrl2().indexOf('seize étoiles') < 0 && srcCtrl2().indexOf('seize fronts') < 0
      && srcCtrl2().indexOf('16 compétences') < 0
      && require('fs').readFileSync('result.js', 'utf8').indexOf('seize comp') < 0;
  })());
verifie('qualité : seize items observables, un par compétence, sans trou',
  (function () {
    const src = srcCtrl2();
    const i = src.indexOf('const C360_ITEMS = {');
    if (i < 0) return false;
    const table = new Function(src.slice(i, src.indexOf('};', i) + 2) + ' return C360_ITEMS;')();
    return window.Competences.REFERENTIEL.every(function (r2) { return typeof table[r2.id] === 'string' && table[r2.id].length > 20; })
      && src.indexOf('C360_ITEMS[r2.id] || r2.def') > 0;
  })());
verifie('qualité : le rapport habillé, en-tête, familles, seize repliées',
  srcCtrl2().indexOf('c360-rap-tete') > 0 && srcCtrl2().indexOf('Rapport Feedback 360 · Sinéa') > 0
  && srcCtrl2().indexOf("' compétences, par famille") > 0 && srcCtrl2().indexOf('c360-fdot') > 0
  && cssTxt2().indexOf('.c360-rap-tete{') > 0 && cssTxt2().indexOf('.c360-tout{') > 0);
verifie('vérification : les fenêtres fantômes bannies, le rapport protégé du vide',
  srcCtrl2().indexOf('window.dataEspaceCourant') < 0
  && srcCtrl2().indexOf('.campagnes || [])[0]') > 0);
verifie('finitions : auto-note du poste, clôture lisible, miroir refondé en étapes',
  srcCtrl2().indexOf('c360AutoNote') > 0 && srcCtrl2().indexOf('autoEval: { surMesure: c360Crea.auto }') > 0
  && srcCtrl2().indexOf("'vous ' + autoV * 20") > 0
  && srcCtrl2().indexOf('mirh-n') > 0 && srcCtrl2().indexOf('ÉTAPE 1 · INVITER') > 0
  && srcCtrl2().indexOf('mir-msgs') > 0 && srcCtrl2().indexOf('il vous en reste') > 0
  && cssTxt2().indexOf('.mirh{') > 0 && cssTxt2().indexOf('.mirh-p.ok{') > 0);
verifie('360 Pro : la couche UX, héros du répondant, compte annoncé, envoi collant',
  srcCtrl2().indexOf('c360-compte') > 0 && srcCtrl2().indexOf("classList.add('fait')") > 0
  && cssTxt2().indexOf('.c360-item.fait{') > 0 && cssTxt2().indexOf('position:sticky;bottom:12px') > 0
  && cssTxt2().indexOf('.c360-tete{background:radial-gradient') > 0);
verifie('360 Pro : fusion, seuils et moyennes joués avec de vraies données',
  (function () {
    const src = srcCtrl2();
    const morceau = src.slice(src.indexOf('function c360Pret'), src.indexOf('function c360Rapport'));
    const fabrique = new Function(morceau + '; return { pret: c360Pret, moy: c360Moy, cols: c360ColsRoles };');
    const f = fabrique();
    const camp = {
      roles: { manager: [{ jeton: 'a' }], pairs: [{ jeton: 'b' }, { jeton: 'c' }], equipe: [] },
      reponses: [
        { role: 'manager', notes: { ecoute: 5 } },
        { role: 'pairs', notes: { ecoute: 3 }, surMesure: { i0: 4 } },
      ],
    };
    const cols = f.cols(camp);
    const noms = cols.map(function (c2) { return c2.nom; }).join(',');
    return f.pret(camp) === false
      && noms === 'manager,autres'
      && f.moy(cols[0].reps, 'ecoute', 'notes') === 100
      && f.moy(cols[1].reps, 'ecoute', 'notes') === 60
      && f.moy(cols[1].reps, 'i0', 'sur') === 80;
  })());
verifie('360 Pro : le rapport par rôle, fusion anonyme, badges et défis',
  srcCtrl2().indexOf('c360Rapport') > 0 && srcCtrl2().indexOf("fusionné dans \"autres\"") > 0
  && srcCtrl2().indexOf('FORCE CACHÉE') > 0 && srcCtrl2().indexOf('À RENDRE VISIBLE') > 0
  && srcCtrl2().indexOf('TROIS DÉFIS PROPOSÉS') > 0 && srcCtrl2().indexOf('window.print()') > 0
  && cssTxt2().indexOf('.c360-rd{') > 0 && cssTxt2().indexOf('#c360-rap,#c360-rap *{visibility:visible}') > 0);
verifie('360 Pro : répondant par jeton, création avec fiche, tableau par rôle',
  srcCtrl2().indexOf('c360=([a-f0-9]') > 0 && srcCtrl2().indexOf('rendreC360Repondant') > 0
  && srcCtrl2().indexOf("action: 'contexte'") > 0 && srcCtrl2().indexOf('const c360Api = {') > 0
  && srcCtrl2().indexOf('c360Html()') > 0 && srcCtrl2().indexOf("action: 'items_fiche'") > 0
  && cssTxt2().indexOf('.c360-ech{') > 0 && cssTxt2().indexOf('.c360-prog{') > 0);
verifie('miroir 360 : la lucidité sur son ancre, les catégories positives, le répondant must-have',
  srcCtrl2().indexOf('mir-luc') > 0 && srcCtrl2().indexOf('LUCIDITÉ') > 0
  && srcCtrl2().indexOf('Vos forces cachées') > 0 && srcCtrl2().indexOf('À rendre visibles') > 0
  && srcCtrl2().indexOf('geste à oser') > 0 && srcCtrl2().indexOf('agrégée à partir de trois regards') > 0
  && cssTxt2().indexOf('.mir-luc{') > 0);
verifie('plan unique : un écran, les sources en onglets, la preuve au Fait',
  srcCtrl2().indexOf('plan-src-tab') > 0 && srcCtrl2().indexOf('Un seul plan, toutes vos analyses') > 0
  && srcCtrl2().indexOf("if (next === 'Fait'") > 0 && srcCtrl2().indexOf('Ma preuve, en une ligne') > 0
  && cssTxt2().indexOf('.plan-src-tab{') > 0);
verifie('plan : le déclencheur et la lignée vivent sur chaque carte',
  srcCtrl2().indexOf('planc-quand') > 0 && srcCtrl2().indexOf('N\\u00e9e de : ') > 0
  && srcCtrl2().indexOf('origine: f,') > 0
  && cssTxt2().indexOf('.planc-quand{') > 0 && cssTxt2().indexOf('.planc-nee{') > 0);
verifie('plan : pastille de source et preuve à ramener, au format défi',
  srcCtrl2().indexOf('planc-src') > 0 && srcCtrl2().indexOf('Votre preuve à ramener') > 0
  && cssTxt2().indexOf('.planc-src{') > 0);
verifie('forces : la vraie légende, couleur famille, rayé vigilance',
  fs.readFileSync('visuels.js', 'utf8').indexOf('fv-legende') > 0
  && fs.readFileSync('visuels.js', 'utf8').indexOf('barre ray\\u00e9e dit une vigilance') > 0
  && cssTxt2().indexOf('.fv-legende{') > 0);
verifie('question sur mesure : elle dit son but',
  srcRes2().indexOf('fk-but') > 0 && srcRes2().indexOf('Votre r\\u00e9ponse tranche') > 0);
verifie('matrice : les cellules respirent, plus de coupe',
  cssTxt2().indexOf('.swot-grid{overflow:visible') > 0);
verifie('sparring : quatre familles au lieu de vingt, situations prêtes',
  srcCtrl2().indexOf('spar-fam-b') > 0 && srcCtrl2().indexOf('SPAR_SITUATIONS') > 0
  && srcCtrl2().indexOf('SINEA_DATA.familles_cle') > 0
  && srcCtrl2().indexOf("id=\"spar-cible\"") < 0
  && cssTxt2().indexOf('.spar-fam-b{') > 0);
verifie('bannière : elle vit dans l\'espace et se copie en une ligne',
  srcCtrl2().indexOf('function poserBanniere(') > 0 && srcCtrl2().indexOf('copierBanniere') > 0
  && fs.readFileSync('index.html', 'utf8').indexOf('id="espace-banniere"') > 0
  && cssTxt2().indexOf('.esp-ban{') > 0);
verifie('sparring : l\'entraînement vit dans l\'onglet Agir avec sa ligne éthique',
  srcCtrl2().indexOf('function poserSparring(') > 0
  && srcCtrl2().indexOf('jamais contre une personne nommée') > 0
  && srcCtrl2().indexOf("'espace-sparring'") > 0
  && srcCtrl2().indexOf('sparDebrief') > 0);
verifie('preuve : les repères réels se posent au portrait via percentileTrait',
  srcRes2().indexOf('poserReperesReels') > 0 && srcRes2().indexOf('Engine.percentileTrait') > 0
  && srcRes2().indexOf("d.n < (d.min_requis || 10)") > 0);
verifie('preuve : la page Méthode publie population et stabilité',
  fs.existsSync('methode.html')
  && fs.readFileSync('methode.html', 'utf8').indexOf('/api/normes') > 0
  && fs.readFileSync('methode.html', 'utf8').indexOf('stabilite') > 0);

console.log('\n===============================');
console.log(nbEchec === 0 ? 'TOUT PASSE : ' + nbOk + ' vérifications vertes.' : nbEchec + ' ÉCHEC(S) sur ' + (nbOk + nbEchec) + '.');
process.exit(nbEchec === 0 ? 0 : 1);
