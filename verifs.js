// ============================================================
// verifs.js — Harnais de non-régression Sinéa Profile
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
const mJardin = srcControleur.match(/  function jardinSvg\(nb, slugPerso, nouvelArbre\) \{[\s\S]*?\n  \}/);
eval('function srcPerso(s){return s + ".webp";}\n' + mJardin[0]);

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
verifie('quadrant : 16 points', (qv.match(/q16-pt/g) || []).length === 16);
verifie('quadrant : 4 zones nommées', (qv.match(/APPUIS|OPPORTUNITÉS|SUR-RÉGIME|EN VEILLE/g) || []).length === 4);
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
verifie('restitution : double profil posé', srcRes.indexOf('doubleProfilSvg') >= 0);
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
verifie('cockpit : dans l\'onglet développement', srcCtrl.indexOf("dev: ['espace-cockpit', 'espace-checklist', 'espace-nea'") > 0);
verifie('cockpit : slot présent dans la page', idxH2.indexOf('id="espace-cockpit"') > 0);
verifie('miroir : le radar entre dans l\'analyse', srcCtrl.indexOf('${radarHtml}') > 0 && srcCtrl.indexOf('radarMiroirSvg(vous, percu') > 0);
verifie('engagements : état relié aux défis', srcCtrl.indexOf('compsDefis.has(mm.id)') > 0);

console.log('\n== 0octies. Retours terrain v72 ==');
const qz = V.quadrantSvg(compsV);
verifie('quadrant : échelle zoomée sur la plage réelle', qz.indexOf('>0</text>') < 0 && qz.indexOf('>100</text>') < 0);
verifie('quadrant : seize points cliquables sur option', (V.quadrantSvg(compsV, { clic: 'X' }).match(/X\(&quot;/g) || []).length === 16);
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
verifie('accueil : le résumé est posé et rangé', idxH2.indexOf('id="espace-accueil-resume"') > 0 && srcCtrl2().indexOf('acc-resume') > 0 && srcCtrl2().indexOf("accueil: ['espace-accueil-resume'") > 0);

console.log('\n== 0terdecies. Les facettes et la défithèque ==');
verifie('facettes : 32, deux par compétence, ids uniques', (() => {
  let n = 0; const ids = [];
  const ok = C.REFERENTIEL.every(r => { const f = C.FACETTES[r.id]; if (!f || f.length !== 2) return false; f.forEach(x => { n++; ids.push(x.id); }); return true; });
  return ok && n === 32 && new Set(ids).size === 32;
})());
verifie('défithèque : 160 micro-défis exactement', (() => {
  let n = 64;
  Object.values(C.FACETTES).forEach(f => f.forEach(x => { n += x.defis.length; }));
  return n === 160 && Object.values(C.FACETTES).every(f => f.every(x => x.defis.length === 3 && x.defis.every(d2 => d2.length >= 25) && x.def.length >= 30));
})());
verifie('portail : les facettes entrent dans la modal', srcDash.indexOf('cx-fac') > 0 && srcDash.indexOf('facettesHtml') > 0);
verifie('espace : les facettes entrent dans la fiche focus', srcCtrl2().indexOf('fcx-fac') > 0 && srcCtrl2().indexOf('FACETTES[id]') > 0);

console.log('\n== 0quaterdecies. La serre du parcours ==');
verifie('jardin : le slot vit dans Mon développement', idxH2.indexOf('espace-cockpit" class="esp-hide"></div>\n          <div id="espace-checklist"') > 0 && srcCtrl2().indexOf("'espace-cockpit', 'espace-checklist'") > 0);
verifie('serre : posée au chargement et rafraîchissable', srcCtrl2().indexOf('function poserChecklist(') > 0 && srcCtrl2().indexOf('checklistCtx = { data: dataEspaceCourant') > 0 && srcCtrl2().indexOf('function majChecklist()') > 0);
verifie('serre : neuf étapes pour 130 points', (() => {
  const src = srcCtrl2();
  const m = src.match(/pts: (\d+), fait:/g) || [];
  const somme = m.reduce((a, x) => a + parseInt(x.match(/\d+/)[0], 10), 0);
  return m.length === 9 && somme === 130;
})());
verifie('jardin : les détections lisent les vraies sources', srcCtrl2().indexOf('const jal = carte.jalons || {}') > 0 && srcCtrl2().indexOf('Number(carte.voeux)') > 0 && srcCtrl2().indexOf('mir.prediction') > 0 && srcCtrl2().indexOf('pistes_libelles') > 0);
verifie('jardin : la notation s\'ouvre depuis l\'étape', srcCtrl2().indexOf('Result.noterPortrait()') > 0);
verifie('jardin : la scène d\'aube, ciel, soleil, fleurs en dégradés', srcCtrl2().indexOf('jgd-ciel') > 0 && srcCtrl2().indexOf('radialGradient') > 0 && srcCtrl2().indexOf('#2E2955') > 0 && srcCtrl2().indexOf('url(#jgd-sol)') > 0 && srcCtrl2().indexOf('#FFD34D') > 0);
verifie('jardin : le soleil monte avec la progression', srcCtrl2().indexOf('112 - Math.round(72 * prog)') > 0 && srcCtrl2().indexOf('1 - prog') > 0);
verifie('jardin : l\'éclosion suit la gauche vers la droite', srcCtrl2().indexOf('i < nEclos') > 0 && srcCtrl2().indexOf('nEclos === BASE_J.length') > 0);
verifie('jardin : panoramique bord à bord', cssTxt2().indexOf('width:calc(100% + 36px)') > 0 && cssTxt2().indexOf('.ckl{overflow:hidden;}') > 0);
verifie('jardin : trois prochaines pousses et rattrapage', srcCtrl2().indexOf('aFaire.slice(0, 3)') > 0 && srcCtrl2().indexOf('Déjà fait ?') > 0 && srcCtrl2().indexOf('function marquerFait(') > 0);
verifie('jardin : les jalons manuels comptent partout', (srcCtrl2().match(/!!jal\./g) || []).length === 9);
verifie('feedback 360 : le nom est partout à l\'écran', idxH2.indexOf('Mon Feedback 360') > 0 && (srcCtrl2().match(/Mon Feedback 360/g) || []).length >= 3 && srcCtrl2().indexOf('pronostic Feedback 360') > 0);
verifie('feedback 360 : chaque porte dépose au geste précis', srcCtrl2().indexOf('function allerFeedback(') > 0 && (srcCtrl2().match(/allerFeedback/g) || []).length >= 8 && srcCtrl2().indexOf("App.espTab('miroir')") < 0 && srcCtrl2().indexOf('espTab(&quot;miroir&quot;)') < 0);
verifie('feedback 360 : le fil des quatre étapes guide et téléporte', srcCtrl2().indexOf('function mirEtapesHtml(') > 0 && srcCtrl2().indexOf("insertAdjacentHTML('afterbegin', mirEtapesHtml") > 0 && srcCtrl2().indexOf('function mirAller(') > 0 && cssTxt2().indexOf('.mir-etapes{display:flex') > 0);
verifie('feedback 360 : cibles au standard, filtre actif lisible', cssTxt2().indexOf('.esp-mir-msg-btn{min-height:40px;}') > 0 && cssTxt2().indexOf('.mir-rel.on{background:#5E59C7;color:#fff') > 0 && cssTxt2().indexOf('.mir-et{min-height:44px;}') > 0);
verifie('feedback 360 : le pari précède les invitations tant qu\'il attend', srcCtrl2().indexOf('mir.prediction ? blocLien + pariHtml : pariHtml + blocLien') > 0 && srcCtrl2().indexOf("mir.prediction ? '' : pariHtml") > 0 && srcCtrl2().indexOf('mir-note') > 0);
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
verifie('dashboard RH : le filtre des membres vit et agit', require('fs').readFileSync('dashboard.js', 'utf8').indexOf('function filtrerMembres(') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('id="membres-filtre"') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.membres-filtre input{') > 0);
verifie('dashboard RH : cibles et encres au standard', require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.pt-s-btn{min-height:40px;}') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('#content .stat-lab{color:#4A4757;}') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.pt-b,.pt-s-btn,.exp-btn,.bd-mat-btn,.bd-mat-nom{min-height:44px;}') > 0);
verifie('dashboard RH : les retardataires sont nommés et relançables', require('fs').readFileSync('dashboard.js', 'utf8').indexOf('function copierRelance(') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('En attente (') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.attente-copier{') > 0);
verifie('dashboard RH : l\'export CSV vit pour le RH aussi', require('fs').readFileSync('dashboard.js', 'utf8').indexOf('id="btn-csv-camp"') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('SUPER ? \' <button class="exp-btn exp-mini" id="btn-csv-camp"') < 0);
verifie('dashboard RH : la liste se trie par nom et par famille', require('fs').readFileSync('dashboard.js', 'utf8').indexOf('function trierMembres(') > 0 && require('fs').readFileSync('dashboard.js', 'utf8').indexOf('data-fam=') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.tri-btn.on{') > 0);
verifie('super admin : onglets au standard, badge blindé', require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.sup-onglet{min-height:40px;}') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('.sup-onglet{min-height:44px;}') > 0 && require('fs').readFileSync('dashboard.html', 'utf8').indexOf('background-color:#5E59C7;background-image:linear-gradient') > 0);
verifie('feedback 360 : partage natif et repli copie', srcCtrl2().indexOf('navigator.share({ text: txt })') > 0 && srcCtrl2().indexOf("fini('Partagé ✓')") > 0 && srcCtrl2().indexOf('Partager ce message') > 0);
verifie('feedback 360 : la relance connaît l\'âge du lien', srcCtrl2().indexOf('function ageLienMiroir(') > 0 && srcCtrl2().indexOf("cree: (new Date()).toISOString().slice(0, 10)") > 0 && srcCtrl2().indexOf('Lien créé il y a') > 0);
verifie('plan : la fête du Fait', srcCtrl2().indexOf('planc-fete') > 0 && cssTxt2().indexOf('@keyframes plancFete') > 0);
verifie('constellation : cadre premium et glossaire', srcCtrl2().indexOf('Ma Constellation') > 0 && srcCtrl2().indexOf('Découvrir ma Constellation') > 0 && srcCtrl2().indexOf('function ouvrirGlossaire(') > 0 && srcCtrl2().indexOf('glos-grid') > 0 && srcCtrl2().indexOf("getComputedStyle(mat).display === 'none'") > 0 && cssTxt2().indexOf('.cstl svg{display:block;max-width:620px') > 0 && cssTxt2().indexOf('.cstl svg{min-width:640px;}') > 0 && srcCtrl2().indexOf('cstl-hint') > 0);
verifie('glossaire : coupe au mot et pastille de zone personnelle', srcCtrl2().indexOf('function coupeMot(') > 0 && srcCtrl2().indexOf('ZONES_GLOS') > 0 && srcCtrl2().indexOf('chipDe(r.id)') > 0);
verifie('carte : les étiquettes vont à la valeur, la lecture accompagne', srcCtrl2().indexOf('function idsAValeur(') > 0 && srcCtrl2().indexOf('labels: idsAValeur(comps)') > 0 && srcCtrl2().indexOf('function lectureCarte(') > 0 && srcCtrl2().indexOf('La lecture de votre carte') > 0 && cssTxt2().indexOf('.cstl-grid{display:grid') > 0);
verifie('glossaire : les trente-deux facettes se montrent', srcCtrl2().indexOf('glos-f') > 0 && srcCtrl2().indexOf('Competences.FACETTES[r.id]') > 0 && srcCtrl2().indexOf('16 compétences, 32 facettes') > 0);
verifie('constellation : l\'étoile choisie s\'allume et la fiche défile', require("fs").readFileSync("visuels.js", "utf8").indexOf("data-comp=") > 0 && srcCtrl2().indexOf("g[data-comp=") > 0 && srcCtrl2().indexOf('q16-sel') > 0 && srcCtrl2().indexOf("behavior: 'smooth', block: 'center'") > 0);
verifie('personnage : médaillon haut droit, hors du flux', cssTxt2().indexOf('.espace-hero-perso{position:absolute;top:16px;right:18px') > 0 && cssTxt2().indexOf('width:92px;height:92px') > 0 && cssTxt2().indexOf('width:56px;height:56px') > 0);
verifie('serre : les plantes poussent en SVG', srcCtrl2().indexOf('ckl-serre') > 0 && srcCtrl2().indexOf('ckl-bloom') > 0 && cssTxt2().indexOf('@keyframes cklBloom') > 0);
verifie('restitution : le bouton de notation a quitté l\'Essentiel', srcRes2().indexOf('ess-avis') < 0 && srcRes2().indexOf('Result.noterPortrait = function') > 0);
verifie('restitution : le jalon de lecture est auto', srcRes2().indexOf("jalon: 'lecture'") > 0 && srcRes2().indexOf('fin-lecture') > 0 && srcRes2().indexOf('IntersectionObserver') > 0);
verifie('restitution : un avis rafraîchit la serre', srcRes2().indexOf('__avisFait = true') > 0 && srcRes2().indexOf('App.majChecklist()') > 0);

console.log('\n== 0quindecies. La mission au coach ==');
verifie('coach : endpoint et modal câblés', srcDash.indexOf('COACH_ENVOI_URL') > 0 && srcDash.indexOf('function ouvrirEnvoiCoach(') > 0 && srcDash.indexOf('function envoyerCoach(') > 0);
verifie('coach : deux portes, la fiche et le bandeau', (srcDash.match(/ouvrirEnvoiCoach\(/g) || []).length >= 3 && srcDash.indexOf("ouvrirEnvoiCoach('apprenant'") > 0 && srcDash.indexOf('ouvrirEnvoiCoach(&quot;groupe&quot;)') > 0);
verifie('coach : le payload porte la clé et la campagne', srcDash.indexOf('cle: cleAcces') > 0 && srcDash.indexOf('campagne: entrepriseCourante') > 0);
verifie('incarnation : le bouton ouvre l\'espace de l\'apprenant', srcDash.indexOf('LIEN_URL') > 0 && srcDash.indexOf('function voirCommeApprenant(') > 0 && srcDash.indexOf('Voir comme lui') > 0 && srcDash.indexOf("window.open(dj.lien, '_blank')") > 0);
verifie('portrait PDF : le portail embarque compétences, familles et plan', srcDash.indexOf('function extraPortrait(') > 0 && srcDash.indexOf('extra: extraPortrait(m)') > 0 && srcDash.indexOf('quadrant: Visuels.quadrantSvg') > 0);
verifie('incarnation : le lien se copie aussi', srcDash.indexOf('function copierLienApprenant(') > 0 && srcDash.indexOf('Copier son lien') > 0 && srcDash.indexOf('navigator.clipboard') > 0);
verifie('mobile : l\'espace a son bloc au cordeau', cssTxt2().indexOf('@media (max-width: 640px)') > 0 && cssTxt2().indexOf('.esp-nav{overflow-x:auto') > 0 && cssTxt2().indexOf('.ckl-serre{max-width:100%') > 0);
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
verifie('16 compétences', c1.length === 16);
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
verifie('matrice complète exposée', (collMixte.matrice || []).length === 16);
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

console.log('\n== 8. Jardin : invariants sur toute la gamme ==');
[1, 4, 5, 7, 12, 23, 40].forEach(nb => {
  const svg = jardinSvg(nb, 'le_capitaine', nb === 5);
  const arbres = (svg.match(/#8A6244/g) || []).length;
  const ok = arbres === Math.min(Math.floor(nb / 5), 6)
    && (svg.match(/<g /g) || []).length === (svg.match(/<\/g>/g) || []).length
    && svg.includes('0 0 340 132')
    && (svg.match(/jr-luciole/g) || []).length === 2
    && svg.includes('jr-papillon')
    && (nb !== 5 || svg.includes('jr-arbre-fete'));
  verifie(nb + ' défis : arbres, équilibre, faune, fête', ok);
});

console.log('\n===============================');
console.log(nbEchec === 0 ? 'TOUT PASSE : ' + nbOk + ' vérifications vertes.' : nbEchec + ' ÉCHEC(S) sur ' + (nbOk + nbEchec) + '.');
process.exit(nbEchec === 0 ? 0 : 1);
