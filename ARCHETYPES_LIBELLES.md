# Changer le libellé d'un archétype

## Le principe

Chaque archétype possède une clé technique stable, `pionnier`, `champion`, `roc` et les
dix-sept autres. Cette clé indexe `personnages`, `contenu` et `rarete`. Elle reste identique
pour toujours.

Le libellé affiché reste libre. La table `variantes` de `sinea_data.js` mémorise chaque
libellé successif d'un même archétype. La résolution centrale ramène ensuite n'importe quel
libellé, actuel comme historique, vers sa clé technique.

Ce mécanisme protège les portraits déjà enregistrés dans Airtable, qui figent le libellé en
vigueur au jour de leur génération.

## La procédure, six gestes

Exemple, passer `Le Pionnier` à `La Pionnière`.

1. Dans `sinea_data.js`, table `personnages`, modifier `personnages.pionnier.nom`.
2. Dans la même table `variantes`, ajouter le groupe `["Le Pionnier", "La Pionnière"]`.
   Un groupe existe déjà pour les six archétypes déjà passés au féminin.
3. Reporter le nouveau libellé dans les quatre tables indexées par libellé, `images`,
   `slugs`, `profils` et `familles`.
4. Reporter dans `window.SINEA_EMBLEMES` si le libellé y sert de clé. Depuis le socle,
   cette table s'indexe par clé technique et demande donc zéro geste.
5. Lancer `node verifs.js` puis `node verifs_visuels.js` à la racine du front.
   Les deux harnais listent précisément toute table oubliée.
6. Reporter les mêmes gestes 1 à 3 dans `sinea-profile-ia/api/sinea_data.js`, puis lancer
   `node verifs_back.js` à la racine du back. Placer les deux dépôts côte à côte permet à
   `verifs_visuels.js` de comparer les deux référentiels automatiquement.

## Ce que le code fait désormais tout seul

`controller.js`, `result.js`, `revelation.js` et `pdf_portrait.js` s'indexent sur les clés
techniques et passent par la résolution centrale. Un changement de libellé les laisse intacts.

## Le point d'entrée unique

```js
SINEA_DATA.slug(x)        // clé technique
SINEA_DATA.nom(x)         // libellé affiché actuel
SINEA_DATA.image(x)       // base du fichier .webp
SINEA_DATA.fiche(x)       // entrée de contenu
SINEA_DATA.raretePour(x)  // entrée de rareté
SINEA_DATA.perso(x)       // entrée de personnages
SINEA_DATA.famille(x)     // RELATION, ACTION, STRUCTURE, VISION
SINEA_DATA.profil(x)      // profil Big Five de référence
SINEA_DATA.embleme(x)     // emblème symbolique
```

`x` accepte un libellé actuel, un libellé historique ou une clé technique. La casse et
l'apostrophe typographique restent sans effet.

## L'arbitrage du genre, tranché par les visuels

Les libellés restent au féminin pour les six archétypes concernés. Les illustrations le
commandent, chacune représente une figure féminine, la championne au trophée, la pionnière
au drapeau, la résiliente, l'exploratrice à la longue-vue, la stratège, l'ambassadrice à
l'enveloppe. Un libellé masculin sur une illustration féminine crée un décalage que le
lecteur remarque immédiatement, et le portrait perd en crédibilité au premier écran.

`Le Révélateur` et `L'Indomptable` gardent leur libellé masculin, leurs illustrations
représentant des figures masculines.

La répartition finale compte huit libellés masculins et douze libellés féminins ou neutres,
ce qui donne au référentiel un équilibre lisible.

## Les deux libellés en attente d'arbitrage

Aucun. Les vingt libellés sont arrêtés. Un changement ultérieur demande les six gestes
ci-dessus, sans risque pour les portraits déjà enregistrés.
