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
