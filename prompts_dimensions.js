// ============================================================
// prompts_dimensions.js — Prompts des 11 nouvelles dimensions
// Sections de profondeur exploitant les questions contextuelles.
// ============================================================

const REGLES = "Regles d'ecriture strictes et impératives. TON : adoptez un ton direct et chaleureux a la maniere de marques modernes comme Alan, des phrases claires et vivantes qui vont droit au but ; vous etes un coach qui connait bien la personne, la valorise et lui donne envie d'agir ; variez la longueur des phrases, osez des phrases courtes qui marquent ; bannissez le jargon et les formules creuses ; adaptez votre style a la personnalite decrite (plus direct et energique pour les profils d'action, plus pose et nuance pour les profils reflechis, plus chaleureux pour les profils relationnels). MISE EN FORME : aerez en paragraphes courts separes par un saut de ligne ; mettez en gras avec la syntaxe **texte** les deux ou trois idees les plus importantes du passage, avec parcimonie. FOND : appuyez chaque affirmation sur un exemple concret ou une mise en situation professionnelle reelle ; nuancez en montrant quand la force est un atout et quand elle demande de la vigilance, sans juger ; donnez a la personne le sentiment d'etre finement comprise. INTERDICTIONS : aucun tiret cadratin (utilisez un point median ou reformulez) ; formulations affirmatives uniquement, aucune negation tournee comme ce n'est pas X mais Y ; n'utilisez jamais la structure Ce qui me frappe ce n'est pas X c'est Y ni aucune variante ; sentence case dans les titres ; commencez directement sans preambule.";

// d.profil = profil archetypal ; d.contextuel = { stress, motivation, risque, changement, conflit } (profils dominants)
// d.spe_dims = { delegation, feedback, exigence_bienveillance } ou { closing, objection, chasseur_eleveur }

const PROMPTS_DIM = {
  // ===== SOCLE : 5 dimensions contextuelles =====
  dim_stress: function(d) {
    var c = d.contextuel || {};
    return "Tu rediges la section 'votre rapport au stress' d'un portrait premium. "
      + "Profil : " + d.profil.dominante + ". Sous pression, cette personne est de type : " + (c.stress || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit avec finesse comment cette personne fonctionne sous forte pression, ce que cela revele de ses ressources, et un point d'attention pour preserver son energie. " + REGLES;
  },
  dim_motivation: function(d) {
    var c = d.contextuel || {};
    return "Tu rediges la section 'vos moteurs profonds' d'un portrait premium. "
      + "Profil : " + d.profil.dominante + ". Son moteur de motivation dominant est : " + (c.motivation || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui explore ce qui met profondement cette personne en mouvement, comment nourrir ce moteur au quotidien, et ce qui l'epuise quand ce moteur n'est pas alimente. " + REGLES;
  },
  dim_risque: function(d) {
    var c = d.contextuel || {};
    return "Tu rediges la section 'votre rapport au risque' d'un portrait premium. "
      + "Profil : " + d.profil.dominante + ". Son rapport au risque est de type : " + (c.risque || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit comment cette personne se positionne face a l'incertitude et a la prise de risque, la force que cela lui donne, et la vigilance associee. " + REGLES;
  },
  dim_changement: function(d) {
    var c = d.contextuel || {};
    return "Tu rediges la section 'votre rapport au changement' d'un portrait premium. "
      + "Profil : " + d.profil.dominante + ". Face au changement, cette personne est de type : " + (c.changement || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit comment cette personne accueille la nouveaute et l'imprevu, ce que cela apporte a son entourage, et un point d'attention. " + REGLES;
  },
  dim_conflit: function(d) {
    var c = d.contextuel || {};
    return "Tu rediges la section 'votre posture face au conflit' d'un portrait premium. "
      + "Profil : " + d.profil.dominante + ". Face au conflit, sa posture dominante est : " + (c.conflit || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit la maniere dont cette personne aborde le desaccord et la tension, la valeur de cette posture, et la situation ou elle gagnerait a l'ajuster. " + REGLES;
  },


  dim_synthese: function(d) {
    var c = d.contextuel || {};
    return "Tu rediges la SYNTHESE des dimensions profondes d'un portrait premium. "
      + "Profil : " + d.profil.dominante + ". Les cinq registres mesures : sous le stress = " + (c.stress || "non determine") + " ; moteur de motivation = " + (c.motivation || "non determine") + " ; rapport au risque = " + (c.risque || "non determine") + " ; face au changement = " + (c.changement || "non determine") + " ; posture en conflit = " + (c.conflit || "non determine") + ". "
      + "Ne reprends pas chaque dimension une par une, elles ont deja ete traitees juste avant. Degage le FIL CONDUCTEUR : ce que la COMBINAISON de ces cinq registres revele sur la maniere dont cette personne fonctionne globalement face aux situations cles du quotidien professionnel. Montre la coherence d'ensemble, ou la tension interessante entre deux registres, et ce que cela donne comme signature de fonctionnement reconnaissable. "
      + "Redige en deux paragraphes courts separes par un saut de ligne, environ 150 mots au total. Mets en gras avec **texte** les deux idees les plus fortes. Ouvre directement sur l'essentiel. " + REGLES;
  },

  // ===== PILOTAGE : 4 dimensions (SDT / modèle SMART) =====
  dim_energie: function(d) {
    var cp = d.contextuel_plus || {};
    return "Tu rediges la section 'votre energie et votre rythme' d'un portrait premium. Cette dimension s'appuie sur le modele SMART (Parker et Knight), qui relie les caracteristiques du travail a la performance durable. "
      + "Profil : " + d.profil.dominante + ". Son rythme de production d'energie est de type : " + (cp.energie || "non determine") + " (sprinteur = pics courts et intenses, endurant = effort regulier et constant, cyclique = alternance de phases hautes et de recuperation, deepworker = concentration longue ininterrompue). "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique. Mets en gras avec **texte** les deux ou trois idees cles. Environ 180 mots au total qui decrivent comment cette personne produit son energie dans le temps, comment organiser son travail pour qu'elle donne le meilleur, et le risque a surveiller (epuisement, morcellement, incomprehension de son rythme par les autres). " + REGLES;
  },
  dim_collaboration: function(d) {
    var cp = d.contextuel_plus || {};
    return "Tu rediges la section 'votre mode de collaboration' d'un portrait premium. Cette dimension s'appuie sur la caracteristique relationnelle du modele SMART (Parker et Knight). "
      + "Profil : " + d.profil.dominante + ". Son mode de collaboration est de type : " + (cp.collaboration || "non determine") + " (autonome = pilote son perimetre seul, cooperatif = avance dans l'echange, interdependant = articule son travail avec celui des autres, federateur = anime et tire le collectif). "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure. Mets en gras avec **texte** les deux ou trois idees cles. Environ 180 mots au total qui decrivent comment cette personne travaille avec les autres, dans quel contexte elle donne le meilleur, et le point de vigilance pour le collectif. " + REGLES;
  },
  dim_autorite: function(d) {
    var cp = d.contextuel_plus || {};
    return "Tu rediges la section 'votre rapport au cadre' d'un portrait premium. Cette dimension s'appuie sur le besoin d'autonomie de la Self-Determination Theory (Deci et Ryan), valide internationalement. "
      + "Profil : " + d.profil.dominante + ". Son rapport au cadre et a la hierarchie est de type : " + (cp.autorite || "non determine") + " (cadre = avance mieux avec des attentes claires, sens = adhere si la direction est justifiee, liberte = donne le meilleur avec une large marge de manoeuvre, contributeur = cherche a influencer les decisions). "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure. Mets en gras avec **texte** les deux ou trois idees cles. Environ 180 mots au total qui decrivent ce dont cette personne a besoin de la part de son manager pour s'engager pleinement, ce qui la demotive, et comment elle peut exprimer ce besoin de facon constructive. " + REGLES;
  },
  dim_reconnaissance: function(d) {
    var cp = d.contextuel_plus || {};
    return "Tu rediges la section 'ce qui nourrit votre engagement' d'un portrait premium. Cette dimension s'appuie sur les besoins de competence et d'appartenance de la Self-Determination Theory (Deci et Ryan). "
      + "Profil : " + d.profil.dominante + ". Son levier de reconnaissance dominant est de type : " + (cp.reconnaissance || "non determine") + " (resultats = a besoin que ses resultats soient vus et nommes, effort = a besoin que l'investissement soit reconnu, relation = se nourrit de la consideration et du lien, autonomie = la confiance accordee vaut toute recompense). "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure. Mets en gras avec **texte** les deux ou trois idees cles. Environ 180 mots au total qui decrivent ce qui nourrit profondement l'engagement de cette personne, ce qui l'use en silence quand ce besoin est ignore, et un conseil pour qu'elle obtienne la reconnaissance qui lui correspond. " + REGLES;
  },

  pilotage_synthese: function(d) {
    var cp = d.contextuel_plus || {};
    return "Tu rediges la SYNTHESE des dimensions de pilotage d'un portrait premium. "
      + "Profil : " + d.profil.dominante + ". Les quatre dimensions mesurees : energie et rythme = " + (cp.energie || "non determine") + " ; mode de collaboration = " + (cp.collaboration || "non determine") + " ; rapport au cadre = " + (cp.autorite || "non determine") + " ; levier de reconnaissance = " + (cp.reconnaissance || "non determine") + ". "
      + "Ne reprends pas chaque dimension une par une. Degage le mode d'emploi global : ce que la COMBINAISON de ces quatre dimensions dit de la maniere ideale de travailler avec cette personne et de la piloter au quotidien pour qu'elle donne le meilleur. Formule cela comme un conseil clair et directement actionnable a destination d'un manager. "
      + "Redige en deux paragraphes courts separes par un saut de ligne, environ 150 mots au total. Mets en gras avec **texte** les deux idees les plus fortes. Ouvre directement sur l'essentiel. " + REGLES;
  },

  // ===== MANAGER : 3 dimensions =====
  dim_delegation: function(d) {
    var s = d.spe_dims || {};
    return "Tu rediges la section 'votre rapport a la delegation' d'un diagnostic manager premium. "
      + "Profil : " + d.profil.dominante + ". Son rapport a la delegation est de type : " + (s.delegation || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit comment cette personne delegue, l'impact sur l'autonomie de son equipe, et un levier de progression concret. " + REGLES;
  },
  dim_feedback: function(d) {
    var s = d.spe_dims || {};
    return "Tu rediges la section 'votre style de feedback' d'un diagnostic manager premium. "
      + "Profil : " + d.profil.dominante + ". Son style de feedback dominant est : " + (s.feedback || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit la maniere dont cette personne donne du feedback, ce que ses collaborateurs en percoivent, et comment gagner en impact. " + REGLES;
  },
  dim_exigence: function(d) {
    var s = d.spe_dims || {};
    return "Tu rediges la section 'votre equilibre exigence et bienveillance' d'un diagnostic manager premium. "
      + "Profil : " + d.profil.dominante + ". Son equilibre dominant est : " + (s.exigence_bienveillance || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit comment cette personne combine exigence et attention aux personnes, l'effet sur son equipe, et le point d'equilibre a surveiller. " + REGLES;
  },

  // ===== COMMERCIAL : 3 dimensions =====
  dim_closing: function(d) {
    var s = d.spe_dims || {};
    return "Tu rediges la section 'votre rapport au closing' d'un diagnostic commercial premium. "
      + "Profil : " + d.profil.dominante + ". Son rapport au closing est de type : " + (s.closing || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit comment cette personne mene la conclusion d'une vente, sa force dans ce moment, et un levier d'amelioration. " + REGLES;
  },
  dim_objection: function(d) {
    var s = d.spe_dims || {};
    return "Tu rediges la section 'votre posture face a l'objection' d'un diagnostic commercial premium. "
      + "Profil : " + d.profil.dominante + ". Sa posture face a l'objection est de type : " + (s.objection || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit comment cette personne traite les objections clients, ce que cela produit, et comment affiner cette competence. " + REGLES;
  },
  dim_chasseur: function(d) {
    var s = d.spe_dims || {};
    return "Tu rediges la section 'votre temperament commercial' d'un diagnostic commercial premium. "
      + "Profil : " + d.profil.dominante + ". Son temperament est de type : " + (s.chasseur_eleveur || "non determine") + ". "
      + "Redige en deux ou trois paragraphes courts separes par un saut de ligne, sans imposer de sous-titres systematiques. Varie ta structure d'une section a l'autre pour eviter toute repetition mecanique : tu peux ouvrir par une observation forte, une mise en situation, une question, ou une image juste. Mets en gras avec **texte** les deux ou trois idees cles. Aborde naturellement a la fois ce que cette personne reussit et le point de vigilance, sans les etiqueter avec des titres figes. Environ 180 mots au total qui decrit si cette personne est plutot dans la conquete ou la fidelisation, la force que cela represente, et comment tirer parti de ce temperament. " + REGLES;
  },
};

const SECTIONS_DIM_SOCLE = ["dim_stress", "dim_motivation", "dim_risque", "dim_changement", "dim_conflit", "dim_synthese"];
const SECTIONS_DIM_PILOTAGE = ["dim_energie", "dim_collaboration", "dim_autorite", "dim_reconnaissance", "pilotage_synthese"];
const SECTIONS_DIM_MANAGER = ["dim_delegation", "dim_feedback", "dim_exigence"];
const SECTIONS_DIM_COMMERCIAL = ["dim_closing", "dim_objection", "dim_chasseur"];

module.exports = { PROMPTS_DIM, SECTIONS_DIM_SOCLE, SECTIONS_DIM_PILOTAGE, SECTIONS_DIM_MANAGER, SECTIONS_DIM_COMMERCIAL };
