// ============================================================
// api/prompts.js · Prompts de génération Sinéa Profile (Vercel)
// ============================================================

const REGLES = `Règles d'écriture strictes et impératives :

TON (très important) :
- Adoptez un ton à la fois direct et chaleureux, à la manière des marques modernes comme Alan : des phrases claires, vivantes, qui vont droit au but. Vous êtes un coach qui connaît bien la personne, qui la valorise et lui donne envie d'agir.
- Variez la longueur des phrases. Osez des phrases courtes qui marquent. Une idée forte mérite parfois une phrase de cinq mots.
- Parlez à la personne avec proximité et respect. Vouvoiement systématique.
- Bannissez le jargon psychologique et les formules creuses. Préférez des mots simples et justes.
- Donnez du rythme et de la personnalité, sans jamais tomber dans le corporate ennuyeux ni dans la flatterie vide.
- Adaptez votre style à la personnalité décrite : plus direct et énergique pour les profils tournés vers l'action, plus posé et nuancé pour les profils réfléchis, plus chaleureux pour les profils relationnels.

MISE EN FORME (à respecter) :
- Aérez le texte en plusieurs paragraphes courts séparés par un saut de ligne. Jamais un seul bloc compact.
- Mettez en gras, avec la syntaxe **texte**, les deux ou trois idées les plus importantes du passage (une force clé, un déclic, un conseil central). Le gras guide la lecture, utilisez-le avec parcimonie et justesse.

FOND :
- Appuyez chaque affirmation sur un exemple concret ou une mise en situation professionnelle réelle (réunion, décision, relation, projet). Évitez les généralités vagues.
- Nuancez : montrez quand une force devient un atout, et quand elle demande de la vigilance, sans jamais juger.
- Le texte doit donner à la personne le sentiment d'être finement comprise, avec des observations qu'elle ne lirait pas dans un test générique.

ANTI-CARICATURE (déterminant pour la qualité) :
- Le nom de l'archétype est une étiquette de départ, jamais une caricature à dérouler. Ne réduisez JAMAIS la personne à son archétype. Bannissez les raccourcis d'étiquette du type "vous êtes un battant qui aime gagner", "vous détestez les détails", "vous fuyez le conflit", "vous adorez être le centre de l'attention", "vous êtes un control freak". Ces phrases sont paresseuses et fausses.
- Partez TOUJOURS des valeurs chiffrées, pas du nom de l'archétype. Une dimension autour de 50-65 est NUANCÉE, jamais extrême : une extraversion à 60 se décrit "à l'aise en groupe quand le sujet l'intéresse", pas "ultra sociable". Réservez les formulations marquées (très, extrêmement, toujours) aux scores réellement extrêmes (sous 25 ou au-dessus de 80).
- Ne prêtez jamais à la personne un trait fort que ses scores ne montrent pas. Si l'agréabilité est moyenne, ne la décrivez ni comme un diplomate-né ni comme un dur : décrivez la nuance réelle.
- Cherchez la singularité, pas le cliché. Deux personnes du même archétype avec des Big Five différents doivent obtenir des portraits différents. Ce qui rend cette personne unique vient du CROISEMENT de ses cinq dimensions, jamais de son seul archétype.

INTERDICTIONS ABSOLUES :
- Aucun tiret cadratin (le caractère long). Utilisez un point médian ou reformulez.
- Formulations affirmatives uniquement. Aucune négation tournée comme "ce n'est pas X mais Y".
- N'utilisez jamais la structure "Ce qui me frappe, ce n'est pas X. C'est Y." ni aucune variante.
- Sentence case dans les titres, jamais de majuscules à chaque mot.`;

// Lecture nuancée : traduit chaque score en niveau qualifié, pour que l'IA nuance
// au lieu de broder sur l'étiquette. Un score moyen est explicitement signalé "nuancé".
function niveauTrait(v, basLabel, hautLabel) {
  if (v >= 80) return `très ${hautLabel} (${v})`;
  if (v >= 66) return `plutôt ${hautLabel} (${v})`;
  if (v >= 45) return `équilibré, à nuancer sans excès (${v})`;
  if (v >= 30) return `plutôt ${basLabel} (${v})`;
  return `très ${basLabel} (${v})`;
}
function bfNuance(bf) {
  const stab = 100 - bf.N;
  return [
    `Extraversion : ${niveauTrait(bf.E, "réservé et porté sur la profondeur", "expansif et stimulé par les autres")}`,
    `Agréabilité : ${niveauTrait(bf.A, "franc et porté à défendre sa position", "conciliant et porté à l'harmonie")}`,
    `Conscience : ${niveauTrait(bf.C, "souple et spontané", "organisé et fiable")}`,
    `Stabilité émotionnelle : ${niveauTrait(stab, "sensible, avec un radar émotionnel fin", "imperturbable sous pression")}`,
    `Ouverture : ${niveauTrait(bf.O, "ancré dans le concret et l'éprouvé", "curieux et attiré par le neuf")}`,
  ].join(" ; ");
}
function blendStr(blend) {
  return Object.entries(blend).map(([n, p]) => `${n} ${p}%`).join(", ");
}

// Formate les réponses ouvertes de CONTEXTE (saisies avant le bilan) pour les injecter
// dans les prompts. Elles permettent à l'IA d'ancrer le portrait dans la réalité de la personne.
function contexteOuvert(d) {
  const o = (d && d.reponses_ouvertes) || {};
  const lignes = [];
  if (o.q1 && String(o.q1).trim()) lignes.push(`- Situation où la personne se sent le plus à l'aise : "${String(o.q1).trim()}"`);
  if (o.q2 && String(o.q2).trim()) lignes.push(`- Ce qui la met le plus en difficulté : "${String(o.q2).trim()}"`);
  if (o.intention && String(o.intention).trim()) lignes.push(`- Ce qu'elle attend de ce bilan : "${String(o.intention).trim()}"`);
  if (o.qm1 && String(o.qm1).trim()) lignes.push(`- Son plus grand défi de manager : "${String(o.qm1).trim()}"`);
  if (o.qc1 && String(o.qc1).trim()) lignes.push(`- L'aspect le plus difficile de son métier commercial : "${String(o.qc1).trim()}"`);
  if (!lignes.length) return "";
  return `\nCe que la personne a confié sur elle (utilise ces éléments avec finesse pour ancrer le portrait dans sa réalité, sans les citer mot pour mot ni en faire des listes) :\n${lignes.join("\n")}\n`;
}

// ------------------------------------------------------------
// Fiche de référence du profil : bloc commun à toutes les sections
// d'un même portrait. Placée dans le champ "system" avec mise en
// cache, elle est payée une seule fois puis relue à coût réduit
// par les ~40 appels de la génération.
// IMPORTANT : sa construction doit être déterministe (même entrée,
// même texte au caractère près), sinon le cache ne s'applique pas.
// ------------------------------------------------------------
function valTxt(v) {
  if (v == null) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}
const SITUATIONS_STYLE_MANAGER = {
  visionnaire: "donner un cap et lancer un changement",
  coaching: "faire monter quelqu'un en compétence",
  affiliatif: "souder l'équipe et apaiser les tensions",
  democratique: "construire l'adhésion sur une décision",
  chef_de_file: "obtenir vite des résultats d'une équipe autonome",
  directif: "gérer une crise et trancher dans l'urgence",
};
const SITUATIONS_STYLE_COMMERCIAL = {
  challenger: "ouvrir les yeux du client et créer le besoin",
  relationnel: "installer une relation de confiance durable",
  battant: "pousser vers la décision et conclure",
  solitaire: "mener une vente complexe en autonomie",
  resolveur: "démêler un problème client épineux",
};
function ficheProfil(d) {
  const p = (d && d.profil) || {};
  const l = [];
  l.push("FICHE DE RÉFÉRENCE DU PROFIL (contexte commun à toutes les sections de ce portrait)");
  l.push(`Archétype dominant : ${p.dominante || "non déterminé"}${p.famille ? ` (famille ${p.famille})` : ""}.`);
  if (p.secondaires && p.secondaires.length) l.push(`Archétypes secondaires : ${[].concat(p.secondaires).map(valTxt).join(", ")}.`);
  if (p.blend) l.push(`Répartition des archétypes : ${blendStr(p.blend)}.`);
  // Lecture de stabilité du résultat, calibrée par simulation sur le moteur :
  // sous 3 points d'écart entre les deux premiers archétypes, le résultat est
  // sensible au bruit de mesure, le portrait doit donc assumer le mélange.
  if (typeof d.ecart_dominant === "number") {
    const g = d.ecart_dominant;
    if (g < 3) l.push(`Lecture du résultat : écart très serré entre les deux premiers archétypes (${g} points). La personne est un mélange réel des deux : assume ce mélange dans tout le portrait, mobilise les deux archétypes, au lieu de tout ramener au premier.`);
    else if (g < 6) l.push(`Lecture du résultat : dominante nette (${g} points d'écart), avec une seconde couleur bien présente à mobiliser dans les nuances.`);
    else l.push(`Lecture du résultat : dominante très marquée (${g} points d'écart). Le portrait peut s'appuyer franchement sur l'archétype dominant.`);
  }
  // Fiabilité du protocole de réponse : module la certitude du ton.
  if (d.fiabilite && typeof d.fiabilite.score === "number") {
    const f = d.fiabilite;
    l.push(`Fiabilité du protocole de réponse : ${f.score}/100${f.niveau ? ` (${f.niveau})` : ""}.`);
    l.push(f.score >= 75
      ? "Consigne de ton liée à la fiabilité : protocole fiable, tu peux affirmer avec assurance."
      : "Consigne de ton liée à la fiabilité : fiabilité moyenne, module la certitude avec des formulations qui invitent la personne à valider (par exemple : vous vous reconnaîtrez sans doute, à vérifier dans votre quotidien).");
  }
  if (p.bigFive) l.push(`Big Five nuancé : ${bfNuance(p.bigFive)}.`);
  if (d.contextuel && Object.keys(d.contextuel).length) l.push(`Dimensions contextuelles mesurées : ${Object.entries(d.contextuel).map(([k, v]) => `${k} ${valTxt(v)}`).join(" ; ")}.`);
  if (d.contextuel_plus && Object.keys(d.contextuel_plus).length) l.push(`Dimensions de pilotage mesurées : ${Object.entries(d.contextuel_plus).map(([k, v]) => `${k} ${valTxt(v)}`).join(" ; ")}.`);
  if (d.spe) l.push(`Module métier : ${d.spe}${d.style_dominant ? `, style dominant ${valTxt(d.style_dominant)}` : ""}.`);
  // Distribution complète des styles : l'analyse raisonne en répertoire, cœur
  // des modèles Goleman (management) et Challenger (vente).
  if (d.spe_style_scores && Object.keys(d.spe_style_scores).length) {
    const tri = Object.entries(d.spe_style_scores).sort((a, b) => b[1] - a[1]);
    l.push(`Distribution complète des styles : ${tri.map(([k, v]) => `${k} ${Math.round(v)}`).join(" ; ")}.`);
    const max = tri[0][1];
    const proches = tri.filter(([, v]) => max - v <= 15).length;
    l.push(proches >= 3
      ? `Lecture du répertoire : répertoire large, ${proches} styles à moins de 15 points du dominant. La personne alterne naturellement plusieurs registres : valorise cette souplesse.`
      : "Lecture du répertoire : répertoire concentré sur le style dominant. Nomme les registres en réserve comme axes de développement.");
    const bas = tri[tri.length - 1][0];
    const situations = d.spe === "manager" ? SITUATIONS_STYLE_MANAGER : SITUATIONS_STYLE_COMMERCIAL;
    l.push(`Style angle mort du répertoire : ${bas}${situations[bas] ? ` (situation critique associée : ${situations[bas]})` : ""}. Traite-le en constructif, comme le geste à greffer dans le plan et la synthèse.`);
  }
  if (d.spe === "manager") l.push("Cadre du modèle : les meilleurs managers alternent quatre styles et plus selon la situation. Lis le profil en répertoire de styles, jamais en étiquette figée.");
  if (d.spe === "commercial") l.push("Cadre du modèle : en vente complexe, les gestes challenger font la surperformance (enseigner un angle nouveau, personnaliser le message, garder la main sur le processus). Pars du socle de la personne et nomme les gestes challenger à greffer, en affirmatif et en constructif.");
  if (d.spe_dims && Object.keys(d.spe_dims).length) l.push(`Dimensions métier mesurées : ${Object.entries(d.spe_dims).map(([k, v]) => `${k} ${valTxt(v)}`).join(" ; ")}.`);
  if (d.cout_adaptation) l.push(`Coût d'adaptation naturel/adapté : ${valTxt(d.cout_adaptation)}.`);
  if (d.naturel_adapte) l.push(`Naturel et adapté : ${valTxt(d.naturel_adapte)}.`);
  if (d.signaux_saillants && d.signaux_saillants.length) {
    l.push("Réponses marquantes déclarées par la personne (à mobiliser pour ancrer le portrait dans du vécu concret, sans les réciter mot pour mot) :");
    d.signaux_saillants.slice(0, 3).forEach((sg) => l.push(`- ${valTxt(sg)}`));
  }
  const ctx = contexteOuvert(d);
  if (ctx) l.push(ctx.trim());
  l.push("Cette fiche donne le fond commun. Chaque consigne précise la section exacte à rédiger : suis la consigne, appuie-toi sur la fiche.");
  return l.join("\n");
}

const PROMPTS = {
  ouverture: (d) => `Tu rédiges l'ouverture d'un portrait de personnalité premium.
Profil dominant : ${d.profil.dominante} (famille ${d.profil.famille}).
Profil Big Five nuancé (partez de ces niveaux, pas du nom de l'archétype) : ${bfNuance(d.profil.bigFive)}.${contexteOuvert(d)}
Rédige en deux ou trois paragraphes courts séparés par un saut de ligne, environ 160 mots au total, qui capte l'essence de qui est cette personne au travail, en valorisant ses forces.
`,

  alchimie: (d) => `Tu rédiges la section "alchimie des forces" d'un portrait premium.
Profil : ${d.profil.dominante}, nuancé de ${d.profil.secondaires.join(" et ")}.
Proportions : ${blendStr(d.profil.blend)}.
Rédige en deux ou trois paragraphes courts séparés par un saut de ligne, environ 220 mots au total, sur la façon dont ces trois forces se combinent, ce que cette combinaison rend possible, et une tension intérieure à équilibrer.
`,

  combinaison: (d) => `Tu rédiges le chapitre central d'un portrait premium : ce que génère la combinaison de trois archétypes.
Trio : ${blendStr(d.profil.blend)}. Famille de la dominante : ${d.profil.famille}.
Profil Big Five nuancé (partez de ces niveaux, pas du nom de l'archétype) : ${bfNuance(d.profil.bigFive)}.
Rédige exactement 4 paragraphes :
1. Le portrait global de ce que ce trio produit ensemble (une image forte et juste).
2. Le rôle de la force dominante, équilibrée par la deuxième.
3. Le rôle de la troisième force, plus discrète.
4. Ce que l'ensemble produit de rare et de précieux.
Sépare les paragraphes par un saut de ligne. Environ 480 mots au total.
`,

  takeovers: (d) => `Tu rédiges la section "quand chacun prend le dessus" d'un portrait premium.
Les trois archétypes : ${d.profil.dominante}, ${d.profil.secondaires.join(", ")}.
Pour CHACUN des trois, rédige : ce qui se passe quand cette force domine au détriment des autres, trois signes observables, et ce qu'il faut faire pour rééquilibrer.
Réponds STRICTEMENT en JSON valide, sans texte autour, format :
[{"nom":"...","quand":"...","signes":["...","...","..."],"faire":"..."}]
Chaque "quand" fait environ 70 mots, chaque "faire" environ 80 mots.
`,

  tension: (d, tension) => `Tu rédiges l'analyse d'une tension intérieure dans un portrait premium.
Tension : "${tension.titre}", entre les pôles ${tension.axe}.
Profil : ${d.profil.dominante}, Profil Big Five nuancé (partez de ces niveaux, pas du nom de l'archétype) : ${bfNuance(d.profil.bigFive)}.
Rédige en deux ou trois paragraphes courts séparés par un saut de ligne, environ 160 mots au total, qui analyse finement cette tension, en la présentant comme une richesse à comprendre plutôt qu'un défaut.
`,

  temperament: (d) => `Tu rédiges l'interprétation du tempérament dans un portrait premium.
Profil Big Five nuancé (partez de ces niveaux, pas du nom de l'archétype) : ${bfNuance(d.profil.bigFive)}.
Rédige en deux ou trois paragraphes courts séparés par un saut de ligne, environ 256 mots au total, qui interprète le croisement de ces cinq dimensions et ce qu'il dit du tempérament au travail.
`,

  situation: (d) => `Tu rédiges la section "en situation" d'un portrait premium.
Profil : ${d.profil.dominante} (famille ${d.profil.famille}), Profil Big Five nuancé (partez de ces niveaux, pas du nom de l'archétype) : ${bfNuance(d.profil.bigFive)}.
Rédige 4 volets décrivant le comportement de cette personne : en réunion, face au conflit, sous pression, devant une décision difficile.
Pour chaque volet, commence par un sous-titre court en gras markdown sur sa propre ligne, par exemple **En réunion**, puis le paragraphe en dessous.
Sépare chaque volet par un saut de ligne. Environ 332 mots au total.
`,

  rebond_q1: (d) => `Tu analyses une réponse libre dans un portrait premium.
Question posée : "Si vous deviez retenir une seule phrase de ce portrait, laquelle garderiez-vous, et pourquoi celle-là maintenant ?"
Réponse de la personne : "${d.reponses_ouvertes?.q1 || ''}"
Profil : ${d.profil.dominante}.
Rédige en deux ou trois paragraphes courts séparés par un saut de ligne, environ 256 mots au total, qui analyse avec finesse et bienveillance ce que cette réponse révèle de la personne. Appuie-toi sur ses mots exacts.
Si la réponse est vide, très courte (moins de quinze caractères) ou sans matière réelle ("rien", "je ne sais pas", un seul mot), écris UNE seule phrase chaleureuse du type "Vous êtes resté bref ici, et c'est très bien : ce point s'explorera à voix haute avec votre formateur." Interdits absolus dans ce cas : tout reproche, toute remarque sur le manque de matière, toute formule du type "je vais être direct".
`,

  rebond_q2: (d) => `Tu analyses une réponse libre dans un portrait premium.
Question posée : "Imaginez votre version la plus accomplie au travail. Que fait-elle naturellement que vous aimeriez faire avec plus d'aisance ?"
Réponse de la personne : "${d.reponses_ouvertes?.q2 || ''}"
Profil : ${d.profil.dominante}.
Rédige en deux ou trois paragraphes courts séparés par un saut de ligne, environ 256 mots au total, qui analyse cette projection et la relie à son développement. Appuie-toi sur ses mots exacts.
Si la réponse est vide, très courte (moins de quinze caractères) ou sans matière réelle ("rien", "je ne sais pas", un seul mot), écris UNE seule phrase chaleureuse du type "Vous êtes resté bref ici, et c'est très bien : ce point s'explorera à voix haute avec votre formateur." Interdits absolus dans ce cas : tout reproche, toute remarque sur le manque de matière, toute formule du type "je vais être direct".
`,

  nat_adapte: (d) => `Tu rédiges la synthèse "naturel vs adapté" d'un portrait premium.
Écarts mesurés (naturel puis adapté, sur 100) : ${JSON.stringify(d.naturel_adapte || {})}.
Coût d'adaptation global : ${d.cout_adaptation || 'modéré'}.
Rédige en deux ou trois paragraphes courts séparés par un saut de ligne, environ 307 mots au total, qui explique, dimension par dimension, où la personne force sa nature, où elle la bride, et où elle est alignée. Termine sur ce que cela implique pour son énergie.
`,

  angles_relationnels: (d) => `Tu rédiges la section "angles morts relationnels" d'un portrait premium.
Profil : ${d.profil.dominante}, agréabilité ${d.profil.bigFive.A} sur 100.
Rédige en deux ou trois paragraphes courts séparés par un saut de ligne, environ 256 mots au total,, avec tact, sur ce que cette personne peut ne pas percevoir dans ses relations de travail.
`,

  angles_coaching: (d) => `Tu rédiges la partie "coaching" de la section angles morts d'un portrait premium, en prolongement de l'analyse des angles morts relationnels.
Profil : ${d.profil.dominante}, agréabilité ${d.profil.bigFive.A} sur 100, famille ${d.profil.famille}.
Tu produis deux listes courtes, concrètes et propres à ce profil.
EXACTEMENT trois conseils de coach : chacun une phrase actionnable, formulée comme un repère bienveillant qui aide la personne à rester vigilante sur son angle mort et à progresser, ancré dans une situation de travail réelle.
Registre impératif : cette personne peut ne manager personne. Ancre chaque conseil dans une situation professionnelle universelle, un échange avec un collègue, une décision à prendre, sa propre organisation, un désaccord à gérer. Interdits : toute référence à une équipe à diriger, à des collaborateurs, à un objectif à donner aux autres ou à une réunion qu'elle anime.
EXACTEMENT trois questions à se poser soi-même : chacune une vraie question introspective courte, que la personne peut se poser pour prendre du recul sur cet angle mort.
Réponds STRICTEMENT en JSON valide, sans aucun texte autour, au format exact :
{"conseils":["conseil 1","conseil 2","conseil 3"],"questions":["question 1","question 2","question 3"]}
`,

  mode_emploi: (d) => `Tu rédiges "le mode d'emploi de moi-même", une fiche que la personne pourra PARTAGER avec ses collègues et son manager. Imagine la notice d'un objet rare et précieux, écrite avec esprit : chaque ligne donne envie de mieux travailler avec moi, et arrache un sourire au passage. Tu écris à la première personne (je, moi, mon) et tu TUTOIES le lecteur (le collègue ou le manager qui me lit).

RÈGLES DE STYLE PROPRES À CETTE FICHE, impératives :
- Ouvre par "Bonjour" ou entre directement dans le vif. JAMAIS "Salut", jamais "Hello", jamais "Coucou".
- Bannis les deux-points (:) à l'intérieur des phrases. Écris des phrases pleines, fluides, avec verbe. Remplace "Mon truc : la clarté" par "J'ai besoin de clarté avant tout".
- Chaque point est une vraie phrase vivante, pas une étiquette suivie d'une explication. Évite la structure "Concept, puis définition".
- Trouve l'image juste et inattendue plutôt que la formule attendue. Une comparaison concrète vaut mieux qu'un adjectif.
- Varie les débuts de phrase. Ne commence pas trois points de suite par "Donne-moi" ou "Laisse-moi".
- Humour fin et complice bienvenu, jamais moqueur, jamais lourd. Le sourire naît de la justesse, pas de la blague forcée.

Tu produis DEUX variantes : une adressée à mes collègues (relation entre pairs), une adressée à mon manager (ce dont j'ai besoin de sa part pour donner le meilleur).
Profil : ${d.profil.dominante} (famille ${d.profil.famille}). Profil Big Five nuancé (partez de ces niveaux, pas du nom de l'archétype) : ${bfNuance(d.profil.bigFive)}.
Réponds STRICTEMENT en JSON valide, sans aucun texte autour, au format exact :
{"intro":"une phrase d'introduction chaleureuse à la première personne, environ 25 mots","avec_collegues":{"pour_bien_travailler":["3 points concrets sur comment bien collaborer avec moi entre collègues, chacun environ 20 mots, à la première personne"],"ce_qui_me_motive":["2 points sur ce qui me donne de l'énergie au travail, chacun environ 15 mots"],"ma_communication":"une phrase sur mon canal et mon style de communication préférés avec mes pairs, environ 25 mots"},"avec_manager":{"ce_dont_jai_besoin":["3 points sur ce dont j'ai besoin de la part de mon manager pour donner le meilleur, chacun environ 20 mots, à la première personne"],"comment_me_motiver":["2 points sur la façon dont mon manager peut me motiver et me faire progresser, chacun environ 15 mots"],"comment_me_faire_un_retour":"une phrase sur la meilleure façon pour mon manager de me donner du feedback, environ 25 mots"},"en_un_mot":"une phrase de conclusion mémorable qui résume comment m'aborder, environ 20 mots"}
Adapte chaque élément finement à l'archétype ${d.profil.dominante} et aux traits Big Five. Sois concret et actionnable, jamais générique. Rappel : aucun deux-points dans les phrases, jamais \"Salut\", des phrases pleines et vivantes.
`,

  combo_dynamiques: (d) => `Tu rédiges la section "les dynamiques entre les forces" d'un portrait premium.
Les trois archétypes : ${d.profil.dominante}, puis ${d.profil.secondaires.join(", ")}.
Ces trois forces ne coexistent pas, elles interagissent deux à deux. Pour CHACUNE des trois paires possibles, décris ce que produit leur interaction : ce que la rencontre de ces deux forces crée de précieux, et la tension qu'elle peut générer.
Réponds STRICTEMENT en JSON valide, sans texte autour, format :
[{"paire":"Nom1 et Nom2","titre":"un titre court et évocateur de cette dynamique","desc":"environ 90 mots décrivant l'interaction, ce qu'elle produit et sa tension"}]
Exactement 3 objets (les 3 paires).
`,

  mgmt_croisement: (d) => `Tu rédiges la section "comment votre personnalité nourrit votre management" d'un diagnostic manager premium. C'est LE pont entre la personnalité de la personne et sa façon de manager.
Archétype de personnalité : ${d.profil.dominante}. Style de leadership dominant : ${d.style_dominant}.
Profil Big Five nuancé (partez de ces niveaux, pas du nom de l'archétype) : ${bfNuance(d.profil.bigFive)}.
Pars explicitement de son archétype ${d.profil.dominante} et montre, trait par trait, comment sa personnalité se traduit dans sa manière de manager. Établis un fil rouge clair entre qui elle est et comment elle dirige.
Structure en trois volets, chacun introduit par un sous-titre court en gras markdown sur sa propre ligne, avec un saut de ligne entre les volets :
**Ce que votre nature apporte au management** (comment l'archétype ${d.profil.dominante} devient une force managériale concrète, avec un exemple de situation d'équipe)
**Votre signature de manager** (ce qui rend votre leadership reconnaissable, en reliant un ou deux traits Big Five à des comportements managériaux précis)
**Votre levier de progression** (le revers de votre nature en situation de management, et comment le travailler)
Environ 340 mots au total.
Structure ta réponse en 2 ou 3 paragraphes séparés par une ligne vide, chacun avec sa propre idée.
`,

  mgmt_angles_plan: (d) => `Tu rédiges les angles morts et le plan d'un diagnostic manager premium. Les angles morts doivent être CROISÉS : montrer comment la personnalité (archétype ${d.profil.dominante}) crée des angles morts spécifiques dans le management.
Profil : ${d.profil.dominante}, style : ${d.style_dominant}.
Réponds STRICTEMENT en JSON valide, sans texte autour, format :
{"angles":"un paragraphe de 160 mots sur les angles morts de manager qui découlent directement de la personnalité ${d.profil.dominante}, avec un exemple concret","plan":[{"titre":"...","desc":"environ 128 mots, une action concrète qui s'appuie sur une force de l'archétype"},{"titre":"...","desc":"..."},{"titre":"...","desc":"..."}]}
Les trois actions du plan couvrent impérativement trois domaines distincts : 1 votre relation à l'équipe (motivation, feedback), 2 votre délégation et votre cadre, 3 votre organisation personnelle de manager. Chaque titre nomme clairement son domaine.
`,

  mgmt_reflexes: (d) => `Tu rédiges les trois lignes réflexe d'une fiche manager à garder sous les yeux. Profil : ${d.profil.dominante}, style ${d.style_dominant}, axes : délégation ${(d.spe_dims||{}).delegation||""}, feedback ${(d.spe_dims||{}).feedback||""}, exigence ${(d.spe_dims||{}).exigence_bienveillance||""}.
Réponds STRICTEMENT en JSON valide, sans texte autour, format :
{"reflexes":{"delegation":"...","feedback":"...","exigence_bienveillance":"..."}}
Chaque ligne : à la première personne, au présent, 18 mots maximum, une action concrète et répétable qui colle à SA position sur l'axe ET à son archétype. Une consigne à soi, prononçable en se levant le matin, jamais une généralité.
`,

  com_reflexes: (d) => `Tu rédiges les trois lignes réflexe d'une fiche commerciale à garder sous les yeux. Profil : ${d.profil.dominante}, style ${d.style_dominant}, axes : closing ${(d.spe_dims||{}).closing||""}, objection ${(d.spe_dims||{}).objection||""}, chasseur/éleveur ${(d.spe_dims||{}).chasseur_eleveur||""}.
Réponds STRICTEMENT en JSON valide, sans texte autour, format :
{"reflexes":{"closing":"...","objection":"...","chasseur_eleveur":"..."}}
Chaque ligne : à la première personne, au présent, 18 mots maximum, une action concrète et répétable qui colle à SA position sur l'axe ET à son archétype. Une consigne à soi, prononçable avant un rendez-vous, jamais une généralité.
`,

  com_croisement: (d) => `Tu rédiges la section "comment votre personnalité nourrit votre vente" d'un diagnostic commercial premium. C'est LE pont entre la personnalité de la personne et sa façon de vendre.
Archétype de personnalité : ${d.profil.dominante}. Profil commercial dominant : ${d.style_dominant}.
Profil Big Five nuancé (partez de ces niveaux, pas du nom de l'archétype) : ${bfNuance(d.profil.bigFive)}.
Pars explicitement de son archétype ${d.profil.dominante} et montre, trait par trait, comment sa personnalité se traduit dans sa manière de vendre. Établis un fil rouge clair entre qui elle est et comment elle vend.
Structure en trois volets, chacun introduit par un sous-titre court en gras markdown sur sa propre ligne, avec un saut de ligne entre les volets :
**Ce que votre nature apporte à la vente** (comment l'archétype ${d.profil.dominante} devient une force commerciale concrète, avec un exemple de situation de vente)
**Votre signature commerciale** (ce qui rend votre approche reconnaissable, en reliant un ou deux traits Big Five à des comportements de vente précis)
**Votre levier de progression** (le revers de votre nature en contexte commercial, et comment le travailler)
Environ 340 mots au total.
Structure ta réponse en 2 ou 3 paragraphes séparés par une ligne vide, chacun avec sa propre idée.
`,

  com_angles_plan: (d) => `Tu rédiges les angles morts et le plan d'un diagnostic commercial premium. Les angles morts doivent être CROISÉS : montrer comment la personnalité (archétype ${d.profil.dominante}) crée des angles morts spécifiques dans la vente.
Profil commercial : ${d.style_dominant}, personnalité : ${d.profil.dominante}.
Réponds STRICTEMENT en JSON valide, sans texte autour, format :
{"angles":"un paragraphe de 160 mots sur les angles morts commerciaux qui découlent directement de la personnalité ${d.profil.dominante}, avec un exemple concret","plan":[{"titre":"...","desc":"environ 128 mots, une action concrète qui s'appuie sur une force de l'archétype"},{"titre":"...","desc":"..."},{"titre":"...","desc":"..."}]}
Les trois actions du plan couvrent impérativement trois domaines distincts : 1 votre relation client (fidélisation, écoute, suivi), 2 votre prospection (conquête, rythme, ciblage), 3 votre organisation commerciale (pipeline, préparation, gestion du temps). Chaque titre nomme clairement son domaine.
`,

  pepites: (d) => `Tu rédiges trois "pépites" pour un portrait de personnalité premium. Une pépite est un fait surprenant, VÉRIFIABLE et exact, que la personne aura envie de répéter le soir même tellement il est savoureux à connaître. Pense aux faits du type "le saviez-vous" qui circulent dans les bons dîners.

Profil : ${d.profil.dominante} (famille ${d.profil.famille}), nuancé de ${d.profil.secondaires.join(" et ")}. Profil Big Five nuancé (partez de ces niveaux, pas du nom de l'archétype) : ${bfNuance(d.profil.bigFive)}.

Tu produis EXACTEMENT trois pépites, chacune reliée subtilement à une facette du profil ci-dessus, sans jamais forcer le lien :
1. Une pépite sur la RARETÉ : compare la rareté de ce profil à une rareté HUMAINE vérifiable du même ordre de grandeur, exprimée en proportion de personnes (par exemple les gauchers, les yeux verts, l'oreille absolue, les ambidextres). Formule impérativement la comparaison en "environ 1 personne sur N". Le lien doit être limpide : sa combinaison de traits est rare, et voici une rareté humaine comparable pour la situer. INTERDICTION ABSOLUE des faits sans proportion de personnes comparable : cosmos, distances, vitesse de la lumière, physique, géologie. Si le fait ne se formule pas en "1 personne sur N", il est hors sujet.
2. Une pépite sur le TRAIT le plus marquant de la personne (science du cerveau, psychologie, biologie, histoire d'une grande figure connue qui partageait ce trait).
3. Une pépite sur l'ÉNERGIE, l'effort ou la façon de fonctionner (neurosciences, physiologie, une citation authentique et vérifiable d'une personnalité célèbre).

RÈGLES IMPÉRATIVES sur la véracité :
- Chaque fait doit être RÉEL et vérifiable. Aucune invention, aucun chiffre approximatif sorti de nulle part.
- Si tu cites une personne célèbre, la citation doit être authentique et correctement attribuée. Dans le doute, choisis un fait plutôt qu'une citation.
- Donne un ordre de grandeur honnête (environ, à peu près) plutôt qu'un faux chiffre précis.
- Privilégie ce qui est insolite ET noble à connaître, jamais anecdotique au point d'être creux.

RÈGLES DE STYLE :
- Chaque pépite fait une à deux phrases, vivante, qui se retient.
- Termine chaque pépite par un lien léger avec la personne (une demi-phrase), sans flatterie lourde.
- Aucun deux-points décoratif au milieu des phrases. Pas de tiret cadratin.

Réponds STRICTEMENT en JSON valide, sans texte autour, format exact :
{"rarete":"la première pépite","trait":"la deuxième pépite","energie":"la troisième pépite"}`,
};

const SECTIONS_SOCLE = [
  "ouverture", "alchimie", "combinaison", "combo_dynamiques", "takeovers",
  "temperament", "situation", "rebond_q1", "rebond_q2",
  "nat_adapte", "angles_relationnels", "angles_coaching", "mode_emploi", "pepites",
];

module.exports = { PROMPTS, SECTIONS_SOCLE, REGLES, ficheProfil };
