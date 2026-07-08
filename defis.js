const { nettoyer } = require("./editorial.js");
const { verifierCadence, identifiantAppelant } = require("./_ratelimit");

const MODEL = "claude-opus-4-8";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 3000;

function bfStr(bf) {
  return "Extraversion " + bf.E + ", Agreabilite " + bf.A + ", Conscience " + bf.C + ", Stabilite emotionnelle " + (100 - bf.N) + ", Ouverture " + bf.O + " (tous sur 100)";
}

function promptDefis(d) {
  var av = d.avis || {};
  return "Tu es le coach SeedUp. Tu generes 3 defis comportementaux personnalises, en avant-gout d'un parcours SeedUp, a la suite du portrait psychometrique d'une personne.\n\n"
    + "PROFIL DE LA PERSONNE\n"
    + "Archetype dominant : " + d.profil.dominante + " (famille " + d.profil.famille + ").\n"
    + "Forces secondaires : " + (d.profil.secondaires || []).join(", ") + ".\n"
    + "Big Five : " + bfStr(d.profil.bigFive) + ".\n\n"
    + "CE QUE LA PERSONNE A EXPRIME APRES SA RESTITUTION\n"
    + "Ce qui resonne le plus chez elle : " + (av.resonance || "") + "\n"
    + "Le point sur lequel elle veut progresser en priorite : " + (av.priorite || "") + "\n"
    + "Son principal defi professionnel en ce moment : " + (av.defi_pro || "") + "\n"
    + ((d.forces_validees && d.forces_validees.length) ? "Les forces qu'elle a elle-meme validees comme la decrivant le mieux : " + d.forces_validees.join(" ; ") + ". Appuie les defis sur ces forces validees : elles sont son levier de passage a l'action.\n" : "")
    + ((d.plan_progression && d.plan_progression.length) ? "Son plan de progression metier, issu de son module specialise : " + d.plan_progression.join(" ; ") + ". Ancre au moins un defi directement dans l'un de ces axes : c'est la continuite entre son diagnostic et son passage a l'action.\n\n" : "\n")
    + (d.thematique ? "LE CAP DE LA FORMATION\nL'entreprise a fixe un theme commun a toute l'equipe : " + d.thematique + ". C'est la direction collective. Les 3 defis doivent faire progresser la personne sur ce theme precis, MAIS chacun a sa facon, en epousant son profil : le meme cap pour tous, un chemin propre a chacun. Relie explicitement chaque defi a ce theme.\n\n" : "")
    + "TA MISSION\n"
    + "Genere exactement 3 defis qui prolongent ce portrait vers l'action, calibres sur ce profil ET sur ce que la personne a exprime. Les defis ciblent en priorite ce qu'elle a dit vouloir travailler. Offre une progression : un defi accessible, un defi d'action concrete, un defi qui fait sortir de la zone de confort.\n\n"
    + "CALIBRAGE DU RISQUE\n"
    + "Un profil ambitieux et a l'aise (extraversion et stabilite elevees) s'ennuie avec le confort : charge-le en niveau 2 et 3 (action concrete, exposition, desaccord nomme, demande directe, conversation difficile). Un profil plus prudent commence par du niveau 1 (observation) avant le niveau 3.\n\n"
    + "FORMAT DE CHAQUE DEFI (5 blocs obligatoires)\n"
    + "titre : formule courte de 3 a 8 mots qui intrigue. "
    + "defi : l'action concrete, a l'imperatif et au tutoiement, 30 a 80 mots, avec un declencheur contextuel precis (ou, quand, avec qui). "
    + "reussite : critere mesurable par la personne elle-meme, 10 a 30 mots. "
    + "pourquoi : la voix du coach, 60 a 120 mots, surprend sans sermonner, relie au profil. "
    + "exemples : cas pratiques concrets, 30 a 80 mots, plusieurs situations. "
    + "duree : strictement 5, 10 ou 15. niveau : 1, 2 ou 3.\n\n"
    + "REGLES D'ECRITURE STRICTES\n"
    + "Phrases courtes, 20 mots maximum. Tutoiement chaleureux, jamais de vouvoiement. Formulation positive directe, aucune negation rhetorique du type ce n'est pas X mais Y. Aucun tiret cadratin, remplace par deux-points, virgule ou point. Pas de jargon RH ni coaching a vide, prefere le concret. Le defi se realise en 15 minutes maximum. Formule la reussite en comportement observable.\n\n"
    + "REPONDS STRICTEMENT EN JSON VALIDE, sans aucun texte autour, format :\n"
    + '[{"titre":"...","defi":"...","reussite":"...","pourquoi":"...","exemples":"...","duree":10,"niveau":2},{...},{...}]';
}

async function genererDefis(apiKey, data) {
  const res = await fetchAvecDelai(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: promptDefis(data) }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("API " + res.status + ": " + err.slice(0, 300));
  }
  const d = await res.json();
  const texte = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  const clean = texte.replace(/```json\s*|\s*```/g, "").trim();
  try {
    const defis = JSON.parse(clean);
    // nettoyage editorial de chaque champ texte
    return defis.map(function(df) {
      return {
        titre: nettoyer(df.titre),
        defi: nettoyer(df.defi),
        reussite: nettoyer(df.reussite),
        pourquoi: nettoyer(df.pourquoi),
        exemples: nettoyer(df.exemples),
        duree: df.duree,
        niveau: df.niveau,
      };
    });
  } catch (e) {
    return { _erreur: true, _brut: nettoyer(texte) };
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ erreur: "Methode non autorisee" });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ erreur: "Cle API non configuree" });

    let data = req.body;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) { return res.status(400).json({ erreur: "Corps JSON invalide" }); }
    }
    if (!data || !data.profil || !data.profil.bigFive) {
      return res.status(400).json({ erreur: "Donnees de profil manquantes" });
    }

    // garde-fou anti-rafale : on limite la cadence d'un même appelant
    const okCadence = await verifierCadence(identifiantAppelant(req, data), 6);
    if (!okCadence) return res.status(429).json({ erreur: "Trop de requêtes rapprochées. Patientez quelques secondes." });


    const defis = await genererDefis(apiKey, data);
    return res.status(200).json({ ok: true, defis: defis });
  } catch (e) {
    return res.status(500).json({ erreur: "Exception: " + (e && e.message ? e.message : String(e)) });
  }
};


// ---- robustesse : fetch avec délai maximal (coupe proprement avant le timeout plateforme) ----
async function fetchAvecDelai(url, options, ms) {
  const delai = ms || 55000;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delai);
  try {
    return await fetch(url, Object.assign({}, options || {}, { signal: controleur.signal }));
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("Service externe trop lent (délai dépassé), merci de réessayer.");
    throw e;
  } finally {
    clearTimeout(minuteur);
  }
}
