// ============================================================
// verifs_visuels.js , Gardes des archétypes Sinéa Profile
// Usage : node verifs_visuels.js   (depuis le dossier du front)
// Zéro dépendance. Sort en erreur (code 1) si une garde échoue.
//
// Ce harnais protège trois invariants.
//   1. Chaque archétype pointe vers un visuel présent à la racine.
//   2. Chaque libellé, actuel ou historique, se résout vers sa clé technique.
//   3. Le code applicatif s'indexe sur les clés techniques, jamais sur les libellés.
// ============================================================

const fs = require('fs');
const path = require('path');

let nbOk = 0, nbEchec = 0;
function verifie(nom, condition, detail) {
  if (condition) { nbOk++; console.log('  ✓ ' + nom); }
  else { nbEchec++; console.error('  ✗ ECHEC : ' + nom + (detail ? '\n      ' + detail : '')); }
}

const window = {};
global.window = window;
eval(fs.readFileSync('sinea_data.js', 'utf8').replace(/const SINEA_DATA = /, 'global.SINEA_DATA = '));
const D = global.SINEA_DATA;
const EMB = window.SINEA_EMBLEMES || {};

const ids = Object.keys(D.personnages);
const noms = ids.map(function (id) { return D.personnages[id].nom; });

// ------------------------------------------------------------
console.log('\n== 1. La résolution centrale est disponible ==');
['slug', 'nom', 'image', 'fiche', 'raretePour', 'perso', 'famille', 'profil', 'embleme']
  .forEach(function (f) { verifie('SINEA_DATA.' + f + '() est exposée', typeof D[f] === 'function'); });
verifie('la table variantes est présente', Array.isArray(D.variantes));

// ------------------------------------------------------------
console.log('\n== 2. Chaque archétype porte un visuel présent ==');
const racine = fs.readdirSync('.').filter(function (f) { return f.endsWith('.webp'); });
ids.forEach(function (id) {
  const base = D.image(id);
  verifie(D.personnages[id].nom + ' pointe vers ' + (base || 'RIEN') + '.webp',
    Boolean(base) && racine.indexOf(base + '.webp') >= 0);
});

console.log('\n== 3. Aucun visuel orphelin à la racine ==');
const utilises = ids.map(function (id) { return D.image(id) + '.webp'; });
const toleres = ['pattern.webp', 'Nea_detoure_full.png.webp'];
racine.forEach(function (f) {
  if (f.charAt(0) === '_') return;               // mis de côté volontairement
  if (toleres.indexOf(f) >= 0) return;
  verifie(f + ' est référencé par un archétype', utilises.indexOf(f) >= 0,
    'aucun archétype ne pointe vers ce fichier, préfixez-le par _ pour le mettre de côté');
});

// ------------------------------------------------------------
console.log('\n== 4. Les clés techniques résolvent vers toutes les tables ==');
ids.forEach(function (id) {
  const ok = Object.keys(D.fiche(id)).length > 0
    && Boolean(D.raretePour(id).niveau)
    && Boolean(D.perso(id))
    && Boolean(D.famille(id))
    && Boolean(D.profil(id))
    && Boolean(D.embleme(id));
  verifie(id + ' résout vers contenu, rarete, personnages, familles, profils, emblemes', ok);
});

// ------------------------------------------------------------
console.log('\n== 5. Les tables indexées par libellé restent alignées ==');
const refNoms = noms.slice().sort().join('|');
['images', 'slugs', 'profils', 'familles'].forEach(function (t) {
  const cles = Object.keys(D[t]).sort().join('|');
  verifie('les clés de ' + t + ' sont exactement les libellés de personnages', cles === refNoms,
    'un libellé a changé dans personnages sans être reporté dans ' + t);
});

// ------------------------------------------------------------
console.log('\n== 6. Tout libellé historique reste résolvable ==');
// Cette garde protège les portraits déjà enregistrés dans Airtable, qui ont figé
// le libellé en vigueur au moment de leur génération.
const historiques = [];
(D.variantes || []).forEach(function (g) { g.forEach(function (v) { historiques.push(v); }); });
historiques.forEach(function (libelle) {
  const ok = Boolean(D.slug(libelle)) && Boolean(D.image(libelle))
    && Object.keys(D.fiche(libelle)).length > 0 && Boolean(D.perso(libelle));
  verifie('« ' + libelle +' » retrouve son archétype', ok,
    'un portrait enregistré sous ce libellé afficherait une pastille vide');
});
verifie("l'apostrophe typographique se résout comme l'apostrophe droite",
  D.slug("L\u2019Ambassadrice") === D.slug("L'Ambassadrice"));
verifie('la casse est indifférente', D.slug('le roc') === D.slug('Le Roc'));

// ------------------------------------------------------------
console.log('\n== 7. Le code applicatif s\'indexe sur les clés techniques ==');
const ctrl = fs.readFileSync('controller.js', 'utf8');
const res = fs.readFileSync('result.js', 'utf8');
const rev = fs.readFileSync('revelation.js', 'utf8');

verifie('controller.js passe par SINEA_DATA.image()',
  ctrl.indexOf('SINEA_DATA.images[') < 0,
  'un accès direct à images[libellé] casse dès qu\'un libellé change');
verifie('result.js passe par SINEA_DATA.image() et .slug()',
  res.indexOf('SINEA_DATA.images[') < 0 && res.indexOf('SINEA_DATA.slugs[') < 0);
verifie('revelation.js passe par SINEA_DATA.image()',
  rev.indexOf('SINEA_DATA.images[') < 0);
verifie('les emblèmes passent par SINEA_DATA.embleme()',
  ctrl.indexOf('SINEA_EMBLEMES[') < 0 && res.indexOf('SINEA_EMBLEMES[') < 0);

// Les tables locales de libellés doivent être indexées par clé technique.
function clesLocales(src, ouvrant, etiquette) {
  const i = src.indexOf(ouvrant);
  if (i < 0) return null;
  const j = src.indexOf('\n  };', i);
  const bloc = src.slice(i, j);
  const cles = [];
  bloc.replace(/^\s*"([^"]+)":/gm, function (t, c) { if (c !== etiquette) cles.push(c); return t; });
  return cles;
}
[['controller.js', ctrl, '  const ACCUEIL_ARCHETYPE = {', 'ACCUEIL_ARCHETYPE'],
 ['result.js', res, '  const PHRASES_CARTE = {', 'PHRASES_CARTE']].forEach(function (t) {
  const cles = clesLocales(t[1], t[2], t[3]);
  const inconnues = (cles || []).filter(function (c) { return ids.indexOf(c) < 0; });
  verifie(t[3] + ' de ' + t[0] + ' est indexée par clé technique',
    cles !== null && cles.length === ids.length && inconnues.length === 0,
    inconnues.length ? 'clés hors référentiel, ' + inconnues.join(', ') : '');
});

// ------------------------------------------------------------
console.log('\n== 8. Cohérence avec le back, si le dépôt est présent ==');
const cheminBack = path.join('..', 'sinea-profile-ia', 'api', 'sinea_data.js');
if (fs.existsSync(cheminBack)) {
  const B = require(path.resolve(cheminBack));
  verifie('les libellés de personnages sont identiques au back',
    ids.every(function (id) { return B.personnages[id] && B.personnages[id].nom === D.personnages[id].nom; }));
  verifie('la table images est identique au back',
    JSON.stringify(B.images) === JSON.stringify(D.images));
  verifie('la table slugs est identique au back',
    JSON.stringify(B.slugs) === JSON.stringify(D.slugs));
  verifie('la table variantes est identique au back',
    JSON.stringify(B.variantes) === JSON.stringify(D.variantes));
  verifie('la table familles est identique au back',
    JSON.stringify(B.familles) === JSON.stringify(D.familles));
  verifie('la table profils est identique au back',
    JSON.stringify(B.profils) === JSON.stringify(D.profils));
  verifie('la table familles_cle est identique au back',
    JSON.stringify(B.familles_cle) === JSON.stringify(D.familles_cle));
  verifie('le back résout la famille depuis une clé technique',
    B.famille('pionnier') === 'ACTION' && B.famille('roc') === 'RELATION');
} else {
  console.log('  · dépôt back absent à côté du front, contrôle croisé sauté');
}

// ------------------------------------------------------------
console.log('\n===============================');
if (nbEchec > 0) {
  console.error(nbEchec + ' ECHEC(S) sur ' + (nbOk + nbEchec) + ' vérifications.');
  process.exit(1);
}
console.log('TOUT PASSE : ' + nbOk + ' vérifications vertes.');
