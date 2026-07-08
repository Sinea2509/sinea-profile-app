// ============================================================
// prompts_spe_enrichi.js · Nouvelles sections enrichies des spés
// 4 sections manager + 4 sections commercial.
// ============================================================

const REGLES = "Regles d'ecriture strictes : vouvoiement systematique ; aucun tiret cadratin (utilisez un point median ou reformulez) ; formulations affirmatives uniquement, aucune negation tournee comme ce n'est pas X mais Y ; n'utilisez jamais la structure Ce qui me frappe ce n'est pas X c'est Y ni aucune variante ; sentence case dans les titres ; ton premium chaleureux et precis ; commencez directement sans preambule. Profondeur attendue : appuyez chaque affirmation sur un exemple concret ou une mise en situation professionnelle reelle ; nuancez en montrant quand la force est un atout et quand elle demande de la vigilance ; donnez a la personne le sentiment d'etre finement comprise. FIL ROUGE OBLIGATOIRE : reliez systematiquement votre propos a la personnalite de fond de la personne (son archetype et ses traits), en montrant comment qui elle est se traduit dans ce domaine precis ; ne traitez jamais le sujet de maniere generique, ancrez-le toujours dans son profil unique. ANTI-CARICATURE : le nom de l'archetype est une etiquette de depart, jamais une caricature a derouler ; bannissez les raccourcis du type vous etes un battant qui aime gagner ou vous detestez les details ; partez des valeurs chiffrees nuancees, un trait autour de 50-65 se decrit avec mesure et jamais en version extreme ; ne pretez jamais a la personne un trait fort que ses scores ne montrent pas ; cherchez sa singularite issue du croisement de ses cinq dimensions. MISE EN FORME : structurez votre reponse en 2 ou 3 paragraphes separes par une ligne vide, chacun portant une idee distincte ; jamais un seul bloc compact.";

function niveauTrait(v, bas, haut) {
  if (v >= 80) return "tres " + haut + " (" + v + ")";
  if (v >= 66) return "plutot " + haut + " (" + v + ")";
  if (v >= 45) return "equilibre, a nuancer sans exces (" + v + ")";
  if (v >= 30) return "plutot " + bas + " (" + v + ")";
  return "tres " + bas + " (" + v + ")";
}
// Lecture nuancee : partez de ces niveaux, jamais du seul nom de l'archetype.
function bfStr(bf) {
  return "Extraversion : " + niveauTrait(bf.E, "reserve", "expansif")
    + " ; Agreabilite : " + niveauTrait(bf.A, "franc et direct", "conciliant")
    + " ; Conscience : " + niveauTrait(bf.C, "souple et spontane", "organise et fiable")
    + " ; Stabilite emotionnelle : " + niveauTrait(100 - bf.N, "sensible", "imperturbable")
    + " ; Ouverture : " + niveauTrait(bf.O, "ancre dans le concret", "curieux du neuf");
}

// Défi métier confié par la personne avant le module (manager : qm1, commercial : qc1).
// Permet d'ancrer la restitution spécialisée dans sa réalité de terrain.
function defiMetier(d) {
  const o = (d && d.reponses_ouvertes) || {};
  const txt = (o.qm1 && String(o.qm1).trim()) || (o.qc1 && String(o.qc1).trim()) || "";
  if (!txt) return "";
  return " Défi concret confié par la personne (ancre ton analyse dans cette réalité, avec finesse, sans le citer mot pour mot) : \"" + txt + "\". ";
}

const PROMPTS_SPE = {
  // ===== MANAGER : 4 nouvelles sections =====
  mgmt_moments_cles: function(d) {
    return "Tu rediges la section 'votre posture dans les moments cles du management' d'un diagnostic manager premium. "
      + "Profil : " + d.profil.dominante + ", style dominant : " + (d.style_dominant||"") + ". Big Five : " + bfStr(d.profil.bigFive) + ". "
      + "Redige 4 volets decrivant comment cette personne se comporte concretement : en conduite de reunion, en prise de decision d'equipe, dans la gestion d'un desaccord, dans la conduite du changement. Pour chaque volet, commence par un sous-titre court en gras markdown sur sa propre ligne (par exemple **En conduite de reunion**), puis le paragraphe en dessous. Separe chaque volet par un saut de ligne. Environ 260 mots au total. " + REGLES;
  },
  mgmt_motivation_equipe: function(d) {
    return "Tu rediges la section 'vos leviers de motivation d'equipe' d'un diagnostic manager premium. "
      + "Profil : " + d.profil.dominante + ", style : " + (d.style_dominant||"") + ". "
      + "Redige un seul paragraphe d'environ 190 mots sur la maniere dont ce manager motive naturellement son equipe, les leviers qu'il actionne spontanement, et l'angle mort a surveiller (un type de motivation qu'il pourrait negliger). " + REGLES;
  },
  mgmt_contextes_reussite: function(d) {
    return "Tu rediges la section 'votre role ideal et vos contextes de reussite' d'un diagnostic manager premium. "
      + "Profil : " + d.profil.dominante + ", style : " + (d.style_dominant||"") + ". Big Five : " + bfStr(d.profil.bigFive) + ". "
      + "Redige un seul paragraphe d'environ 190 mots decrivant les contextes manageriaux ou ce profil excelle (type d'equipe, phase, enjeu) et ceux ou il rencontre plus de difficultes, avec un conseil pour s'y adapter. " + REGLES;
  },
  mgmt_synthese_leadership: function(d) {
    return "Tu rediges une synthese inspirante 'le manager que vous etes' pour clore la partie management d'un diagnostic premium. "
      + "Profil : " + d.profil.dominante + ", style : " + (d.style_dominant||"") + ". " + defiMetier(d)
      + "Redige environ 170 mots en 2 paragraphes separes par une ligne vide qui dresse un portrait synthetique et valorisant de ce manager, sa signature de leadership, et l'horizon de developpement qui le rendrait encore plus fort. " + REGLES;
  },

  // ===== COMMERCIAL : 4 nouvelles sections =====
  com_moments_cles: function(d) {
    return "Tu rediges la section 'votre posture dans les moments cles de la vente' d'un diagnostic commercial premium. "
      + "Profil : " + d.profil.dominante + ", profil commercial : " + (d.style_dominant||"") + ". Big Five : " + bfStr(d.profil.bigFive) + ". "
      + "Redige 4 volets decrivant comment cette personne se comporte concretement : en prospection, en phase de decouverte du besoin, en negociation, au closing. Pour chaque volet, commence par un sous-titre court en gras markdown sur sa propre ligne (par exemple **En prospection**), puis le paragraphe en dessous. Separe chaque volet par un saut de ligne. Environ 260 mots au total. " + REGLES;
  },
  com_relation_client: function(d) {
    return "Tu rediges la section 'votre style de relation client' d'un diagnostic commercial premium. "
      + "Profil : " + d.profil.dominante + ", profil commercial : " + (d.style_dominant||"") + ". "
      + "Redige un seul paragraphe d'environ 190 mots sur la maniere dont ce commercial construit et entretient la relation avec ses clients, sa force relationnelle, et le point a renforcer. " + REGLES;
  },
  com_contextes_reussite: function(d) {
    return "Tu rediges la section 'vos contextes de reussite commerciale' d'un diagnostic commercial premium. "
      + "Profil : " + d.profil.dominante + ", profil commercial : " + (d.style_dominant||"") + ". Big Five : " + bfStr(d.profil.bigFive) + ". "
      + "Redige un seul paragraphe d'environ 190 mots decrivant les contextes de vente ou ce profil excelle (cycle court ou long, type de vente, type de client) et ceux ou il peine, avec un conseil. " + REGLES;
  },
  com_synthese_vendeur: function(d) {
    return "Tu rediges une synthese inspirante 'le commercial que vous etes' pour clore la partie commerciale d'un diagnostic premium. "
      + "Profil : " + d.profil.dominante + ", profil commercial : " + (d.style_dominant||"") + ". " + defiMetier(d)
      + "Redige environ 170 mots en 2 paragraphes separes par une ligne vide qui dresse un portrait synthetique et valorisant de ce vendeur, sa signature commerciale, et l'horizon de progression qui le rendrait encore plus performant. " + REGLES;
  },

  mgmt_formulations: function(d) {
    return "Tu rediges la section 'vos formulations en situation' d'un diagnostic manager premium : trois situations critiques de management, et pour chacune la facon dont CE profil precis la joue au mieux. "
      + "Profil : " + d.profil.dominante + ", style de management : " + (d.style_dominant||"") + ", Big Five : " + bfStr(d.profil.bigFive) + ". "
      + "Traite exactement ces trois situations dans cet ordre, chacune introduite par son titre seul sur une ligne en gras : **Le feedback difficile**, **La delegation d'une mission sensible**, **Le recadrage d'un comportement**. "
      + "Pour chaque situation : 2 phrases sur la maniere dont son profil l'aborde naturellement, puis une formulation prete a l'emploi entre guillemets adaptee a son style (une phrase qu'il pourrait dire telle quelle a son collaborateur), puis une phrase commencant par 'Votre piege :' qui nomme le risque typique de son profil dans cette situation. Environ 75 mots par situation, chaque situation formant son propre bloc separe par une ligne vide. "
      + "La formulation doit sonner ORALE et naturelle : une phrase qu'on prononce les yeux dans les yeux, jamais une phrase d'email ou de manuel. Exemple du niveau attendu, redige pour un AUTRE profil que le sien (un Stratege coaching, a ne surtout pas recopier) : **Le feedback difficile** suivi de : Votre patience naturelle vous fait attendre le bon moment, parfois trop longtemps. Vous preparez le terrain avec soin et la personne se sent respectee. Votre formulation : \"J'ai quelque chose d'important a vous dire, et je prefere qu'on le regarde ensemble maintenant plutot que d'attendre.\" Votre piege : tellement adoucir le message que le probleme reste flou. " + REGLES;
  },

  com_formulations: function(d) {
    return "Tu rediges la section 'vos formulations en situation' d'un diagnostic commercial premium : trois situations critiques de vente, et pour chacune la facon dont CE profil precis la joue au mieux. "
      + "Profil : " + d.profil.dominante + ", profil commercial : " + (d.style_dominant||"") + ", Big Five : " + bfStr(d.profil.bigFive) + ". "
      + "Traite exactement ces trois situations dans cet ordre, chacune introduite par son titre seul sur une ligne en gras : **L'objection prix**, **La relance d'un prospect silencieux**, **L'ouverture d'un premier rendez-vous**. "
      + "Pour chaque situation : 2 phrases sur la maniere dont son profil l'aborde naturellement, puis une formulation prete a l'emploi entre guillemets adaptee a son style (une phrase qu'il pourrait dire telle quelle au client), puis une phrase commencant par 'Votre piege :' qui nomme le risque typique de son profil dans cette situation. Environ 75 mots par situation, chaque situation formant son propre bloc separe par une ligne vide. "
      + "La formulation doit sonner ORALE et naturelle : une phrase qu'on prononce face au client, jamais une phrase d'email ou de plaquette. Exemple du niveau attendu, redige pour un AUTRE profil que le sien (un Diplomate relationnel, a ne surtout pas recopier) : **L'objection prix** suivi de : Votre ecoute naturelle vous fait accueillir l'objection sans vous crisper, et le client le sent. Vous prenez le temps de comprendre ce que le prix represente pour lui. Votre formulation : \"D'accord, le budget compte. Dites-moi ce qui vous ferait dire que ca les vaut.\" Votre piege : tellement comprendre l'objection que vous oubliez d'y repondre. " + REGLES;
  },
};

const SECTIONS_SPE_MANAGER = ["mgmt_moments_cles", "mgmt_motivation_equipe", "mgmt_contextes_reussite", "mgmt_synthese_leadership", "mgmt_formulations"];
const SECTIONS_SPE_COMMERCIAL = ["com_moments_cles", "com_relation_client", "com_contextes_reussite", "com_synthese_vendeur", "com_formulations"];

module.exports = { PROMPTS_SPE, SECTIONS_SPE_MANAGER, SECTIONS_SPE_COMMERCIAL };
