# Déploiement · Sinéa Profile refondu

Tout est prêt et testé. Voici la marche à suivre, dans l'ordre. Comptez 15 minutes.

## Ce que contient cette livraison

**Test refondu** : Big Five v2 (14 questions swipe + 5 choix forcés), 4 nouvelles dimensions de pilotage (énergie, collaboration, autorité, reconnaissance, ancrées Self-Determination Theory et modèle SMART), score de fiabilité du profil, moteur de scoring corrigé (équité 3.8x → 2.1x, dosage explicite 60% Big Five / 40% questions Sinéa).

**Restitution enrichie** : badge de fiabilité, section « Vos dimensions de pilotage » avec 4 analyses IA, coach conversationnel qui connaît les 9 dimensions. Tout l'existant est conservé : les 32 sections IA, le coach, les animations, la carte, les compatibilités.

**Dashboard enrichi** : fiche apprenant avec fiabilité et dimensions de pilotage, section « Pilotage humain » avec 4 analyses d'équipe.

## Étape 1 · Backend (en premier)

Repo GitHub : `Sinea2509/sinea-profile-ia`, dossier `api/`

Remplacez ces 5 fichiers par ceux du dossier `api/` de cette livraison :
- `generer.js` (génère les 4 nouvelles sections quand le profil les contient)
- `prompts_dimensions.js` (les 4 nouveaux prompts, avec vos règles éditoriales)
- `chat.js` (le coach connaît désormais les 9 dimensions)
- `dashboard.js` (remonte fiabilité et dimensions de pilotage au dashboard)
- `analyse_equipe.js` (l'analyse stratégique IA d'équipe exploite désormais les rythmes d'énergie, les besoins de cadre, les leviers de reconnaissance, la fiabilité des profils et les coûts d'adaptation ; les analyses en cache des campagnes existantes se régénèrent automatiquement dès que leurs membres ont les nouvelles données)

Commit → Vercel redéploie automatiquement. Attendez que le déploiement soit vert.

## Étape 2 · App

Repo GitHub : `Sinea2509/sinea-profile-app`, à la racine

Remplacez ces 6 fichiers par ceux du dossier `app/` de cette livraison :
- `sinea_data.js` (Big Five v2 + 8 questions des nouvelles dimensions)
- `engine.js` (moteur corrigé + scoring fiabilité + scoring nouvelles dimensions)
- `controller.js` (formats swipe et choix forcé, parcours à 67 questions)
- `result.js` (restitution enrichie, rien retiré)
- `style.css` (styles des nouveaux formats et du badge)
- `dashboard.html` (dashboard enrichi)

Commit → Vercel redéploie.

## Étape 3 · Vérification (5 minutes)

1. Ouvrez le test et vérifiez que la première question est une carte à glisser
2. Passez le test en entier (ou utilisez votre lien de test habituel)
3. Sur la restitution : le badge de fiabilité s'affiche en haut, la section « Vos dimensions de pilotage » apparaît après les registres
4. Posez au coach une question du type « comment organiser mes journées ? » : il doit mobiliser votre profil d'énergie
5. Ouvrez le dashboard : la fiche d'un nouveau répondant affiche fiabilité et dimensions
6. Sur une campagne avec 2 répondants ou plus, générez l'analyse stratégique : le SWOT, les risques RH et le focus individuel doivent mobiliser les rythmes, les besoins de cadre et les leviers de reconnaissance

## Points d'attention

**Crédits Anthropic** : ils sont épuisés sur le profil de test. Tant qu'ils ne sont pas rechargés, les sections IA s'affichent en version de repli (textes personnalisés par règles, déjà propres). Tout le reste fonctionne. Dès que les crédits sont rechargés, l'IA reprend automatiquement.

**Anciens profils** : totale compatibilité. Un profil passé avant la refonte s'affiche comme avant, sans badge ni dimensions de pilotage (il ne les a pas mesurées). Aucune erreur.

**Volume** : le test passe à 67 questions + 2 ouvertes. Le temps ressenti reste inférieur à l'ancien grâce au swipe (les 19 premières questions se font en 90 secondes).

## Prochaine étape (session suivante)

Connexion SeedUp : prescription automatique de micro-défis à partir du profil (workflow n8n + API SeedUp). Préparez la documentation API de SeedUp pour cette session.
