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
verifie('espace : nav deux onglets posée', idxH2.indexOf('esp-nav') > 0 && idxH2.indexOf("App.espTab('miroir')") > 0);
verifie('espace : miroir masqué par défaut', idxH2.indexOf('id="espace-miroir" class="esp-hide"') > 0);
verifie('espace : espTab exporté', exportApp.includes('espTab'));
verifie('notation : bouton dans l\'Essentiel', srcRes.indexOf('Result.noterPortrait()') > 0);
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
verifie('cockpit : dans l\'onglet développement', srcCtrl.indexOf("'espace-cockpit', 'espace-nea'") > 0);
verifie('cockpit : slot présent dans la page', idxH2.indexOf('id="espace-cockpit"') > 0);
verifie('miroir : le radar entre dans l\'analyse', srcCtrl.indexOf('${radarHtml}') > 0 && srcCtrl.indexOf('radarMiroirSvg(vous, percu)') > 0);
verifie('engagements : état relié aux défis', srcCtrl.indexOf('compsDefis.has(mm.id)') > 0);

console.log('\n== 0octies. Retours terrain v72 ==');
const qz = V.quadrantSvg(compsV);
verifie('quadrant : échelle zoomée sur la plage réelle', qz.indexOf('>0</text>') < 0 && qz.indexOf('>100</text>') < 0);
verifie('quadrant : seize points cliquables sur option', (V.quadrantSvg(compsV, { clic: 'X' }).match(/X\(&quot;/g) || []).length === 16);
const fvv2 = V.forcesVigilancesHtml(compsV, C.prioriser(compsV, 'manager'));
verifie('forces : intro pédagogique, définitions, familles', fvv2.indexOf('fv-intro') > 0 && (fvv2.match(/fv-def/g) || []).length >= 6 && (fvv2.match(/fv-dot/g) || []).length === 8);
verifie('largeurs : restitution 1040, espace 1120', cssTxt2().indexOf('max-width:1040px') > 0 && cssTxt2().indexOf('.espace-wrap{max-width:1120px') > 0);
verifie('largeur : portail 1380', fs.readFileSync('dashboard.html', 'utf8').indexOf('max-width:1380px') > 0);
verifie('noter : bouton blindé avec repli', srcRes2().indexOf("classList.contains('active')") > 0);
verifie('miroir : la relation est demandée et envoyée', srcCtrl2().indexOf('relationHtml') > 0 && srcCtrl2().indexOf('relation: (function') > 0);
verifie('miroir : répartition et impact affichés', srcCtrl2().indexOf('${repartition}') > 0 && srcCtrl2().indexOf('esp-mir-impact') > 0);
verifie('carte espace : le clic ouvre le détail', srcCtrl2().indexOf("clic: 'App.ouvrirCompDepuisCarte'") > 0 && srcCtrl2().indexOf('esp-cp-focus') > 0);
verifie('frise : la note explique l\'avancée', srcCtrl2().indexOf('ck-note') > 0);
function cssTxt2(){ return fs.readFileSync('style.css', 'utf8'); }
function srcRes2(){ return fs.readFileSync('result.js', 'utf8'); }
function srcCtrl2(){ return fs.readFileSync('controller.js', 'utf8'); }

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
