// ============================================================
// api/dashboard.js — Lit les données pour le dashboard admin
// Endpoint : GET /api/dashboard?campagne=CODE  (résultats d'une campagne)
//            GET /api/dashboard?liste=campagnes (toutes les campagnes)
// Protégé par un mot de passe simple (?cle=...).
// ============================================================

const { appliquerCors } = require("./_cors");
const AIRTABLE_BASE = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const DASHBOARD_KEY = process.env.DASHBOARD_KEY || "";
// Clés RH par entreprise : JSON {"cle_rh_1": "Nom entreprise", ...} dans l'env.
// La clé DASHBOARD_KEY reste la clé super admin : elle voit tout.
let CLES_RH = {};
try { CLES_RH = JSON.parse(process.env.DASHBOARD_CLES_RH || "{}"); } catch (e) { CLES_RH = {}; }
function normEnt(v) { return String(v || "").trim().toLowerCase(); }
// Prénom NOM, la forme d'affichage demandée : le prénom tel quel, le nom en capitales.
function nomComplet(f) {
  const p = String((f && f["Prénom"]) || "").trim();
  const n = String((f && f["Nom"]) || "").trim();
  return p ? (p + " " + n.toUpperCase()).trim() : n;
}

async function airtableGet(table, params = "") {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable ${res.status}: ${err.slice(0, 200)}`);
  }
  return await res.json();
}

// Récupère tous les enregistrements (gère la pagination)
async function airtableAll(table, params = "") {
  let records = [];
  let offset = null;
  do {
    const sep = params.includes("?") ? "&" : "?";
    const p = params + (offset ? `${sep}offset=${offset}` : "");
    const data = await airtableGet(table, p);
    records = records.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return records;
}

// ===== Résolution des entreprises liées =====
// Si le champ "Entreprise" d'une campagne est un champ lié Airtable, l'API renvoie
// des identifiants techniques (["recXXXX"]). On résout les vrais noms depuis la
// table Entreprises. Si la table est absente ou le champ est un simple texte,
// on renvoie la valeur telle quelle (aucune régression).
let _nomsEntreprises = null;
async function chargerNomsEntreprises() {
  if (_nomsEntreprises) return _nomsEntreprises;
  const map = {};
  // la table des entreprises peut s'appeler "Entreprises" ou "Entreprise" selon la base
  for (const nomTable of ["Entreprises", "Entreprise"]) {
    try {
      const recs = await airtableAll(nomTable, "");
      recs.forEach((r) => {
        const f = r.fields || {};
        const nom = f["Nom"] || f["Name"] || f["Nom entreprise"] || f["Entreprise"]
          || Object.values(f).find((v) => typeof v === "string" && v.length < 80);
        if (nom) map[r.id] = nom;
      });
      if (recs.length) break; // table trouvée et lue : on s'arrête là
    } catch (e) { /* ce nom de table n'existe pas : on tente le suivant */ }
  }
  _nomsEntreprises = map;
  return map;
}
function estListeDIds(v) {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x.startsWith("rec"));
}
function nomEntreprise(valeur, map) {
  if (!valeur) return "Sans entreprise";
  if (typeof valeur === "string") return valeur;
  if (estListeDIds(valeur)) {
    return valeur.map((id) => (map && map[id]) || id).join(", ");
  }
  if (Array.isArray(valeur)) return valeur.join(", ");
  return String(valeur);
}

// On prend le profil le plus complet : celui d'un module spé s'il existe (contient speStyle), sinon le socle.
function extraireProfilRiche(jsonBrut) {
  if (!jsonBrut) return null;
  let data;
  try { data = typeof jsonBrut === "string" ? JSON.parse(jsonBrut) : jsonBrut; } catch (e) { return null; }
  // ancien format : le JSON est directement le profil
  if (data && data.scoresBigFive) return data;
  // nouveau format : un objet par module
  const modules = Object.values(data || {}).filter((m) => m && m.profil);
  if (!modules.length) return null;
  // priorité au module avec speStyle (le plus complet), sinon le plus récent
  const avecSpe = modules.filter((m) => m.profil.speStyle);
  const choisi = (avecSpe.length ? avecSpe : modules).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];
  return choisi.profil;
}

module.exports = async (req, res) => {
  appliquerCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!AIRTABLE_BASE || !AIRTABLE_TOKEN) {
    return res.status(500).json({ error: "Configuration Airtable manquante" });
  }

  const { cle, liste, campagne, recherche, export: exportQuoi } = req.query || {};
  const cleRecue = ((req.headers || {})["x-dashboard-key"]) || cle;

  // Protection par clé (header de préférence, query acceptée en compatibilité).
  // Deux niveaux : la clé DASHBOARD_KEY est super admin et voit tout ;
  // une clé RH (DASHBOARD_CLES_RH) ne voit que son entreprise.
  const estSuper = !!DASHBOARD_KEY && cleRecue === DASHBOARD_KEY;
  const entrepriseRH = (!estSuper && cleRecue && CLES_RH[cleRecue]) ? CLES_RH[cleRecue] : null;
  if (!estSuper && !entrepriseRH) {
    return res.status(401).json({ error: "Accès non autorisé" });
  }

  try {
    // Export CSV des participants (super admin uniquement) : la matière
    // première du pilotage et de l'analyse psychométrique, réponses brutes
    // et temps de réponse embarqués en colonnes JSON.
    if (exportQuoi === "participants") {
      if (!estSuper) return res.status(403).json({ error: "Réservé au super admin" });
      // filtre optionnel : ?campagne=CODE limite l'export à cette campagne
      let nomCible = null;
      if (campagne) {
        const fC = encodeURIComponent(`{Code campagne} = "${champFormule(campagne)}"`);
        const rC = await airtableGet("Campagnes", `?filterByFormula=${fC}&maxRecords=1`);
        const recC = (rC.records && rC.records[0]) || null;
        if (!recC) return res.status(404).json({ error: "Campagne introuvable" });
        nomCible = recC.fields["Nom campagne"] || "";
      }
      const campagnes = await airtableAll("Campagnes");
      const mapEnt = campagnes.some((c) => estListeDIds(c.fields["Entreprise"])) ? await chargerNomsEntreprises() : {};
      const mapIdNom = {}; const entParNom = {};
      campagnes.forEach((c) => {
        const n = c.fields["Nom campagne"] || "";
        mapIdNom[c.id] = n;
        entParNom[n] = nomEntreprise(c.fields["Entreprise"], mapEnt);
      });
      const reps = await airtableAll("Répondants");
      const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      const lignes = ["prenom;nom;email;entreprise;campagne;statut;date;archetype;famille;O;C;E;A;N;fiabilite;note_avis;nb_defis_seedup;cout_usd;reponses_brutes;temps_reponses"];
      reps.forEach((r) => {
        const f = r.fields || {};
        let nc = f["Campagne"] || "";
        if (Array.isArray(nc)) nc = nc[0] || "";
        if (typeof nc === "string" && nc.startsWith("rec") && mapIdNom[nc]) nc = mapIdNom[nc];
        if (nomCible && nc !== nomCible) return;
        const riche = extraireProfilRiche(f["Résultat complet (JSON)"] || f["Analyses (JSON)"]) || {};
        const bf = riche.bigFive || {};
        let note = "", nbSd = "", cout = "";
        try {
          const toutes = JSON.parse(f["Interactions (JSON)"] || "{}");
          Object.entries(toutes).forEach(([type, it]) => {
            if (!it || typeof it !== "object") return;
            if (type === "seedup") { nbSd = (it.liste || []).length; return; }
            const n = Number((it.avis || {}).AVIS_RESSEMBLANCE);
            if (n >= 1 && note === "") note = n;
            if (it.cout_portrait && typeof it.cout_portrait.cout_usd === "number") cout = (Number(cout) || 0) + it.cout_portrait.cout_usd;
          });
        } catch (e) {}
        let rb = "", tr = "";
        try {
          const complet = JSON.parse(f["Résultat complet (JSON)"] || "{}");
          if (complet.reponsesBrutes) rb = JSON.stringify(complet.reponsesBrutes).slice(0, 28000);
          if (complet.tempsReponses) tr = JSON.stringify(complet.tempsReponses).slice(0, 28000);
        } catch (e) {}
        lignes.push([
          q(f["Prénom"] || ""), q(f["Nom"] || ""), q(f["Email"] || ""), q(entParNom[nc] || ""), q(nc), q(f["Statut"] || ""),
          q(r.createdTime ? String(r.createdTime).slice(0, 10) : ""),
          q(riche.dominante || f["Archétype dominant"] || ""), q(riche.famille || f["Famille dominante"] || ""),
          q(bf.O != null ? bf.O : ""), q(bf.C != null ? bf.C : ""), q(bf.E != null ? bf.E : ""), q(bf.A != null ? bf.A : ""), q(bf.N != null ? bf.N : ""),
          q(riche.fiabilite && typeof riche.fiabilite.score === "number" ? riche.fiabilite.score : ""),
          q(note), q(nbSd), q(cout), q(rb), q(tr),
        ].join(";"));
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="participants_sinea' + (nomCible ? "_" + String(nomCible).replace(/[^a-z0-9]/gi, "_").slice(0, 40) : "") + '.csv"');
      return res.status(200).send("\uFEFF" + lignes.join("\n"));
    }

    // Recherche participant transverse (super admin uniquement)
    if (recherche) {
      if (!estSuper) return res.status(403).json({ error: "Réservé au super admin" });
      const q = String(recherche).trim();
      if (q.length < 2) return res.status(200).json({ resultats: [] });
      const ql = champFormule(q.toLowerCase());
      const formula = encodeURIComponent(`OR(FIND("${ql}", LOWER({Nom})), FIND("${ql}", LOWER({Prénom})), FIND("${ql}", LOWER(CONCATENATE({Prénom}, " ", {Nom}))), FIND("${ql}", LOWER({Email})))`);
      const data = await airtableGet("Répondants", `?filterByFormula=${formula}&maxRecords=12`);
      const campagnes = await airtableAll("Campagnes");
      const mapEnt = campagnes.some((c) => estListeDIds(c.fields["Entreprise"])) ? await chargerNomsEntreprises() : {};
      const mapIdNom = {}; const entParNom = {};
      campagnes.forEach((c) => {
        const n = c.fields["Nom campagne"] || "";
        mapIdNom[c.id] = n;
        entParNom[n] = nomEntreprise(c.fields["Entreprise"], mapEnt);
      });
      const resultats = (data.records || []).map((r) => {
        const f = r.fields || {};
        let nc = f["Campagne"] || "";
        if (Array.isArray(nc)) nc = nc[0] || "";
        if (typeof nc === "string" && nc.startsWith("rec") && mapIdNom[nc]) nc = mapIdNom[nc];
        return {
          nom: nomComplet(f), email: f["Email"] || "", statut: f["Statut"] || "",
          dominante: f["Archétype dominant"] || "", famille: f["Famille dominante"] || "",
          campagne: nc, entreprise: entParNom[nc] || "",
        };
      });
      return res.status(200).json({ resultats });
    }

    // Cas 0 : vue d'ensemble (toutes les campagnes groupées par entreprise + stats)
    if (liste === "ensemble") {
      const campagnes = await airtableAll("Campagnes");
      const tousRepondants = await airtableAll("Répondants");

      // indexer les répondants par campagne (nom)
      const parCampagne = {};
      // si la colonne Campagne des Répondants est un champ lié, l'API renvoie des recIDs : on résout via la liste des campagnes
      const mapIdNomCamp = {};
      campagnes.forEach((c) => { mapIdNomCamp[c.id] = c.fields["Nom campagne"] || ""; });
      tousRepondants.forEach((r) => {
        const camp = r.fields["Campagne"] || "";
        let nomCamp = Array.isArray(camp) ? (camp[0] || "") : camp;
        if (typeof nomCamp === "string" && nomCamp.startsWith("rec") && mapIdNomCamp[nomCamp]) nomCamp = mapIdNomCamp[nomCamp];
        if (!parCampagne[nomCamp]) parCampagne[nomCamp] = [];
        parCampagne[nomCamp].push(r);
      });

      // construire les campagnes enrichies
      // résoudre les noms d'entreprises liées (une seule requête, seulement si nécessaire)
      const mapEnt = campagnes.some((c) => estListeDIds(c.fields["Entreprise"])) ? await chargerNomsEntreprises() : {};
      const campagnesEnrichies = campagnes.map((c) => {
        const nom = c.fields["Nom campagne"] || "";
        const reps = parCampagne[nom] || [];
        const termines = reps.filter((r) => {
          const s = (r.fields["Statut"] || "").toLowerCase();
          return s === "terminé" || s === "termine";
        });
        // répartition des familles parmi les terminés
        const familles = { RELATION: 0, ACTION: 0, STRUCTURE: 0, VISION: 0 };
        termines.forEach((r) => {
          let f = (r.fields["Famille dominante"] || "").toUpperCase();
          if (!f) {
            // colonne plate vide (anciens enregistrements) : on lit la famille dans le JSON
            const riche = extraireProfilRiche(r.fields["Résultat complet (JSON)"] || r.fields["Analyses (JSON)"]);
            f = (riche && riche.dominante && riche.dominante.famille ? riche.dominante.famille : "").toUpperCase();
          }
          if (familles[f] !== undefined) familles[f]++;
        });
        return {
          id: c.id,
          nom,
          code: c.fields["Code campagne"] || "",
          type: c.fields["Type de test"] || "",
          statut: c.fields["Statut"] || "",
          entreprise: nomEntreprise(c.fields["Entreprise"], mapEnt),
          quota: Number(c.fields["Quota"] || 0),
          utilisations: termines.length, // quota réel = nombre de répondants terminés
          nbRepondants: reps.length,
          nbTermines: termines.length,
          familles,
        };
      });

      // grouper par entreprise
      const parEntreprise = {};
      campagnesEnrichies.forEach((c) => {
        const ent = c.entreprise || "Sans entreprise";
        if (!parEntreprise[ent]) parEntreprise[ent] = { entreprise: ent, campagnes: [], totalTermines: 0, totalQuota: 0 };
        parEntreprise[ent].campagnes.push(c);
        parEntreprise[ent].totalTermines += c.nbTermines;
        parEntreprise[ent].totalQuota += c.quota;
      });

      // Panneau super admin : qualité produit, pouls d'activité, alertes.
      // Tout se calcule sur les données déjà en mémoire, zéro requête de plus.
      let qualite = null, activite = null, alertes = [];
      if (estSuper) {
        const entParCamp = {};
        campagnesEnrichies.forEach((c) => { entParCamp[c.nom] = c.entreprise; });
        const notes = []; const utilites = []; const clartes = []; const verbatims = []; const fiab = [];
        let nbPlan = 0, nbRem = 0, nbMir = 0, nbSd = 0, nbTermTot = 0, pariAccord = 0, pariTotal = 0;
        let portraitsErr = 0, sectionsErr = 0; const santeDetails = [];
        let coutPortraits = 0, coutTotal = 0, coutSansCache = 0;
        const parCamp = {};
        const parSemaine = {}; const parMois = {}; const dernieres = []; const dernierParCamp = {};
        const maintenant = Date.now();
        tousRepondants.forEach((r) => {
          const f = r.fields || {};
          let nomCamp = f["Campagne"] || "";
          if (Array.isArray(nomCamp)) nomCamp = nomCamp[0] || "";
          if (typeof nomCamp === "string" && nomCamp.startsWith("rec") && mapIdNomCamp[nomCamp]) nomCamp = mapIdNomCamp[nomCamp];
          const ent = entParCamp[nomCamp] || "";
          const t = r.createdTime ? new Date(r.createdTime).getTime() : null;
          if (t && (!dernierParCamp[nomCamp] || t > dernierParCamp[nomCamp])) dernierParCamp[nomCamp] = t;
          const statut = String(f["Statut"] || "").toLowerCase();
          if (!statut.startsWith("termin")) return;
          nbTermTot++;
          if (t) {
            const d = new Date(t); const lundi = new Date(d);
            lundi.setDate(d.getDate() - ((d.getDay() + 6) % 7));
            const cleSem = lundi.toISOString().slice(0, 10);
            parSemaine[cleSem] = (parSemaine[cleSem] || 0) + 1;
            const cleMois = new Date(t).toISOString().slice(0, 7);
            parMois[cleMois] = (parMois[cleMois] || 0) + 1;
            dernieres.push({ nom: nomComplet(f), email: f["Email"] || "", entreprise: ent, campagne: nomCamp, dominante: f["Archétype dominant"] || "", date: r.createdTime });
          }
          const riche = extraireProfilRiche(f["Résultat complet (JSON)"] || f["Analyses (JSON)"]);
          if (riche && riche.fiabilite && typeof riche.fiabilite.score === "number") fiab.push(riche.fiabilite.score);
          // Santé technique : sections tombées en erreur dans le contenu sauvegardé
          let errsIci = 0; const sectionsIci = [];
          try {
            const analysesTous = JSON.parse(f["Analyses (JSON)"] || "{}");
            Object.values(analysesTous).forEach((an) => {
              const ct = an && an.contenu;
              if (!ct || typeof ct !== "object") return;
              Object.entries(ct).forEach(([cle, v]) => {
                if (v && typeof v === "object" && v._erreur) { errsIci++; sectionsIci.push(cle); }
                if (Array.isArray(v)) v.forEach((x) => { if (x && x._erreur) { errsIci++; sectionsIci.push(cle); } });
              });
            });
          } catch (e) {}
          if (errsIci) {
            portraitsErr++; sectionsErr += errsIci;
            if (santeDetails.length < 8) santeDetails.push({ nom: nomComplet(f), entreprise: ent, campagne: nomCamp, sections: sectionsIci.slice(0, 6) });
          }
          // Agrégat par campagne
          if (!nomCamp) nomCamp = "(sans campagne)";
          const camp = parCamp[nomCamp] || (parCamp[nomCamp] = { campagne: nomCamp, entreprise: ent, termines: 0, notes: [], pariOk: 0, pariTot: 0, fiab: [], plan: 0, seedup: 0, err: 0, cout: 0, coutN: 0 });
          camp.termines++;
          camp.err += errsIci;
          if (riche && riche.fiabilite && typeof riche.fiabilite.score === "number") camp.fiab.push(riche.fiabilite.score);
          let toutes = {};
          try { toutes = JSON.parse(f["Interactions (JSON)"] || "{}"); } catch (e) {}
          let aPlan = false;
          Object.entries(toutes).forEach(([type, it]) => {
            if (!it || typeof it !== "object") return;
            if (type === "remesure") { if ((it.liste || []).length) nbRem++; return; }
            if (type === "miroir") { if (it.jeton) nbMir++; return; }
            if (type === "seedup") { if ((it.liste || []).length) { nbSd++; camp.seedup++; } return; }
            // Coût mesuré du portrait, persisté par le front avec la génération
            if (it.cout_portrait && typeof it.cout_portrait.cout_usd === "number") {
              coutPortraits++; coutTotal += it.cout_portrait.cout_usd;
              if (typeof it.cout_portrait.sans_cache_usd === "number") coutSansCache += it.cout_portrait.sans_cache_usd;
              camp.cout += it.cout_portrait.cout_usd; camp.coutN++;
            }
            if ((it.pistes_choisies || []).length) aPlan = true;
            (it.auto_perception || []).forEach((p) => { pariTotal++; camp.pariTot++; if (p && p.accord) { pariAccord++; camp.pariOk++; } });
            const av = it.avis || {};
            const n = Number(av.AVIS_RESSEMBLANCE);
            const nu = Number(av.AVIS_UTILITE); if (nu >= 1) utilites.push(nu);
            const ncl = Number(av.AVIS_CLARTE); if (ncl >= 1) clartes.push(ncl);
            if (n >= 1) {
              notes.push(n); camp.notes.push(n);
              const verb = Object.entries(av).find(([k, v]) => k !== "AVIS_RESSEMBLANCE" && typeof v === "string" && v.trim().length > 3);
              verbatims.push({ note: n, texte: verb ? String(verb[1]).slice(0, 240) : "", entreprise: ent, campagne: nomCamp, date: r.createdTime || "" });
            }
          });
          if (aPlan) { nbPlan++; camp.plan++; }
        });
        const semaines = [];
        { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
          for (let i = 7; i >= 0; i--) { const sd = new Date(d); sd.setDate(d.getDate() - 7 * i); const cleSem = sd.toISOString().slice(0, 10); semaines.push({ semaine: cleSem, n: parSemaine[cleSem] || 0 }); } }
        const mois = [];
        { const d = new Date();
          for (let i = 5; i >= 0; i--) { const md = new Date(d.getFullYear(), d.getMonth() - i, 15); const cleMois = md.toISOString().slice(0, 7); mois.push({ mois: cleMois, n: parMois[cleMois] || 0 }); } }
        dernieres.sort((a, b) => new Date(b.date) - new Date(a.date));
        verbatims.sort((a, b) => new Date(b.date) - new Date(a.date));
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        notes.forEach((n) => { const k = Math.max(1, Math.min(5, Math.round(n))); distribution[k]++; });
        const moy = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
        qualite = {
          nbNotes: notes.length, noteMoyenne: moy(notes), distribution,
          indicateurs: {
            ressemblance: { moy: moy(notes), n: notes.length },
            utilite: { moy: moy(utilites), n: utilites.length },
            clarte: { moy: moy(clartes), n: clartes.length },
          },
          derniersAvis: verbatims.filter((v) => v.texte).slice(0, 5),
          avisAExaminer: verbatims.filter((v) => v.texte && v.note <= 3).slice(0, 5),
          adoption: { base: nbTermTot, plan: nbPlan, remesure: nbRem, miroir: nbMir, seedup: nbSd },
          fiabilite: { moyenne: moy(fiab), nb: fiab.length, faible: fiab.filter((x) => x < 75).length },
          paris: { accord: pariAccord, total: pariTotal },
          sante: { base: nbTermTot, portraitsErr, sectionsErr, completude: nbTermTot ? Math.round(100 * (nbTermTot - portraitsErr) / nbTermTot) : null, details: santeDetails },
          cout: {
            portraits: coutPortraits,
            totalUsd: Math.round(coutTotal * 100) / 100,
            moyenUsd: coutPortraits ? Math.round(coutTotal / coutPortraits * 1000) / 1000 : null,
            economieUsd: Math.round((coutSansCache - coutTotal) * 100) / 100,
          },
        };
        // Qualité par campagne, les plus fragiles en tête
        const qualiteParCampagne = Object.values(parCamp).filter((c) => c.termines > 0).map((c) => ({
          campagne: c.campagne, entreprise: c.entreprise, termines: c.termines,
          note: moy(c.notes), nbNotes: c.notes.length,
          paris: c.pariTot ? Math.round(100 * c.pariOk / c.pariTot) : null,
          fiab: moy(c.fiab),
          plan: Math.round(100 * c.plan / c.termines),
          seedup: c.seedup,
          err: c.err,
          coutMoyen: c.coutN ? Math.round(c.cout / c.coutN * 1000) / 1000 : null,
        }));
        qualiteParCampagne.sort((a, b) => {
          const na = a.note === null ? 9 : a.note, nb2 = b.note === null ? 9 : b.note;
          if (na !== nb2) return na - nb2;
          return b.err - a.err;
        });
        qualite.parCampagne = qualiteParCampagne;
        activite = { semaines, mois, dernieres: dernieres.slice(0, 8) };
        campagnesEnrichies.forEach((c) => {
          const st = String(c.statut || "").toLowerCase();
          if (st.startsWith("termin") || st.startsWith("archiv")) return;
          if (c.quota > 0 && c.nbTermines >= c.quota * 0.8) alertes.push({ type: "quota", campagne: c.nom, entreprise: c.entreprise, detail: c.nbTermines + " / " + c.quota + " passations utilisées" });
          const dern = dernierParCamp[c.nom] || null;
          if (!dern || (maintenant - dern) > 15 * 24 * 3600 * 1000) alertes.push({ type: "dormante", campagne: c.nom, entreprise: c.entreprise, detail: dern ? "aucune passation depuis " + Math.round((maintenant - dern) / (24 * 3600 * 1000)) + " jours" : "aucune passation" });
        });
      }

      let listeEntreprises = Object.values(parEntreprise);
      if (entrepriseRH) listeEntreprises = listeEntreprises.filter((e) => normEnt(e.entreprise) === normEnt(entrepriseRH));
      return res.status(200).json({
        entreprises: listeEntreprises,
        totalCampagnes: listeEntreprises.reduce((s, e) => s + e.campagnes.length, 0),
        totalTermines: listeEntreprises.reduce((s, e) => s + e.totalTermines, 0),
        superAdmin: estSuper,
        portee: entrepriseRH || "toutes",
        qualite,
        activite,
        alertes,
      });
    }

    // Cas 1 : liste de toutes les campagnes
    if (liste === "campagnes") {
      if (entrepriseRH) return res.status(403).json({ error: "Réservé au super admin" });
      const campagnes = await airtableAll("Campagnes");
      const result = campagnes.map((c) => ({
        id: c.id,
        nom: c.fields["Nom campagne"] || "",
        code: c.fields["Code campagne"] || "",
        type: c.fields["Type de test"] || "",
        statut: c.fields["Statut"] || "",
      }));
      return res.status(200).json({ campagnes: result });
    }

    // Cas 2 : résultats d'une campagne précise (par code)
    if (campagne) {
      // trouver la campagne par code
      const formula = encodeURIComponent(`{Code campagne} = "${champFormule(campagne)}"`);
      const camp = await airtableGet("Campagnes", `?filterByFormula=${formula}&maxRecords=1`);
      const campRecord = (camp.records && camp.records[0]) || null;
      if (!campRecord) return res.status(404).json({ error: "Campagne introuvable" });
      // Portée RH : une clé entreprise n'accède qu'aux campagnes de son entreprise
      if (entrepriseRH) {
        const mapEntPortee = estListeDIds(campRecord.fields["Entreprise"]) ? await chargerNomsEntreprises() : {};
        const entCamp = nomEntreprise(campRecord.fields["Entreprise"], mapEntPortee);
        if (normEnt(entCamp) !== normEnt(entrepriseRH)) return res.status(403).json({ error: "Campagne hors de votre périmètre" });
      }

      // récupérer tous les répondants de cette campagne
      const repFormula = encodeURIComponent(`{Campagne} = "${champFormule(campRecord.fields["Nom campagne"])}"`);
      const reps = await airtableAll("Répondants", `?filterByFormula=${repFormula}`);

      

// Extrait le profil riche (contextuel, naturelAdapte, speStyle...) du JSON complet.
      // Le JSON a la forme { socle: {profil, date}, manager: {...}, commercial: {...} }.

      const repondants = reps.map((r) => {
        const riche = extraireProfilRiche(r.fields["Résultat complet (JSON)"] || r.fields["Analyses (JSON)"]);
        return {
          nom: nomComplet(r.fields),
          email: r.fields["Email"] || "",
          statut: r.fields["Statut"] || "invité",
          dominante: r.fields["Archétype dominant"] || (riche && riche.dominante && riche.dominante.nom) || "",
          secondaires: r.fields["Archétypes secondaires"] || (riche && riche.secondaires ? riche.secondaires.map((s) => s.nom).join(", ") : ""),
          famille: r.fields["Famille dominante"] || (riche && riche.dominante && riche.dominante.famille) || "",
          bigFive: {
            E: r.fields["Big Five (E)"] ?? (riche && riche.scoresBigFive ? riche.scoresBigFive.E : null),
            A: r.fields["Big Five (A)"] ?? (riche && riche.scoresBigFive ? riche.scoresBigFive.A : null),
            C: r.fields["Big Five (C)"] ?? (riche && riche.scoresBigFive ? riche.scoresBigFive.C : null),
            N: r.fields["Big Five (N)"] ?? (riche && riche.scoresBigFive ? riche.scoresBigFive.N : null),
            O: r.fields["Big Five (O)"] ?? (riche && riche.scoresBigFive ? riche.scoresBigFive.O : null),
          },
          // Données riches issues du JSON complet (null si absentes)
          contextuel: riche && riche.contextuel ? riche.contextuel : null,
          naturelAdapte: riche && riche.naturelAdapte ? {
            cout: riche.naturelAdapte.cout || null,
            moyenneEcart: riche.naturelAdapte.moyenneEcart ?? null,
            ecarts: riche.naturelAdapte.ecarts || null,
          } : null,
          speStyle: riche && riche.speStyle ? riche.speStyle : null,
          speStyleScores: riche && riche.speStyleScores ? riche.speStyleScores : null,
          speDims: riche && riche.speDims ? riche.speDims : null,
          ...((() => {
            try {
              const toutes = JSON.parse(r.fields["Interactions (JSON)"] || "{}");
              const l = ((toutes.seedup || {}).liste || []);
              const rm = ((toutes.remesure || {}).liste || []);
              const dern = rm.length ? rm[rm.length - 1] : null;
              return {
                nbSeedup: l.length,
                seedupTitres: l.slice(-4).map((x) => x.t).filter(Boolean),
                // liste légère pour le débrief coach hebdomadaire (date, titre, réussite)
                seedupListe: l.slice(-60).map((x) => ({ d: x.d || "", t: x.t || "", r: (typeof x.r === "number" ? x.r : null) })),
                // la dernière re-mesure : la preuve d'évolution du brief
                remesure: dern ? { moyenneEcart: (typeof dern.moyenneEcart === "number" ? dern.moyenneEcart : null), cout: dern.cout || null, date: dern.date || "", ecarts: dern.ecarts || null } : null,
                // qualité individuelle (tableau de bord de campagne)
                ...((() => {
                  let nr = null, nu = null, ncl = null, pOk = 0, pTot = 0, cUsd = 0;
                  Object.entries(toutes).forEach(([ty, it]) => {
                    if (!it || typeof it !== "object" || ty === "seedup" || ty === "remesure" || ty === "miroir" || ty === "brief_dev") return;
                    const av = it.avis || {};
                    if (nr === null && Number(av.AVIS_RESSEMBLANCE) >= 1) nr = Number(av.AVIS_RESSEMBLANCE);
                    if (nu === null && Number(av.AVIS_UTILITE) >= 1) nu = Number(av.AVIS_UTILITE);
                    if (ncl === null && Number(av.AVIS_CLARTE) >= 1) ncl = Number(av.AVIS_CLARTE);
                    (it.auto_perception || []).forEach((p) => { pTot++; if (p && p.accord) pOk++; });
                    if (it.cout_portrait && typeof it.cout_portrait.cout_usd === "number") cUsd += it.cout_portrait.cout_usd;
                  });
                  const pl = [];
                  Object.values(toutes).forEach((it) => {
                    if (it && Array.isArray(it.pistes_libelles)) it.pistes_libelles.forEach((x) => { if (x && pl.indexOf(x) < 0) pl.push(x); });
                  });
                  // le regard agrégé des pairs (miroir 360), dès deux réponses
                  let miroirAgg = null;
                  try {
                    const rs = ((toutes.miroir || {}).reponses) || [];
                    if (rs.length >= 2) {
                      const CONV = { 1: 0, 2: 33.333, 3: 66.667, 4: 100 };
                      const somme = {}; const compte = {};
                      rs.forEach((rep) => {
                        Object.entries(rep.r || {}).forEach(([k, v]) => {
                          const c = CONV[v];
                          if (c === undefined) return;
                          somme[k] = (somme[k] || 0) + c;
                          compte[k] = (compte[k] || 0) + 1;
                        });
                      });
                      const cles = {};
                      Object.keys(somme).forEach((k) => { cles[k] = Math.round(somme[k] / compte[k] * 10) / 10; });
                      miroirAgg = { n: rs.length, cles };
                    }
                  } catch (e) {}
                  return { noteR: nr, noteU: nu, noteC: ncl, pariOk: pOk, pariTot: pTot, coutUsd: cUsd ? Math.round(cUsd * 1000) / 1000 : null, pistesLibelles: pl.slice(0, 6), miroir: miroirAgg };
                })()),
              };
            } catch (e) { return { nbSeedup: 0, seedupTitres: [], seedupListe: [], remesure: null }; }
          })()),
          speDims: riche && riche.speDims ? riche.speDims : null,
          blend: riche && riche.blend ? riche.blend : null,
          // Dimensions de pilotage (énergie, collaboration, autorité, reconnaissance)
          energie: riche && riche.contextuelPlus && riche.contextuelPlus.energie ? { profil: riche.contextuelPlus.energie } : null,
          collaboration: riche && riche.contextuelPlus && riche.contextuelPlus.collaboration ? { profil: riche.contextuelPlus.collaboration } : null,
          autorite: riche && riche.contextuelPlus && riche.contextuelPlus.autorite ? { profil: riche.contextuelPlus.autorite } : null,
          reconnaissance: riche && riche.contextuelPlus && riche.contextuelPlus.reconnaissance ? { profil: riche.contextuelPlus.reconnaissance } : null,
          // Score de fiabilité du profil
          fiabilite: riche && riche.fiabilite ? { score: riche.fiabilite.score, niveau: riche.fiabilite.niveau, message: riche.fiabilite.message } : null,
          // Réponses de la personne dans sa restitution (forces validées, réponses ouvertes, pistes choisies)
          interactions: (() => { try { return JSON.parse(r.fields["Interactions (JSON)"] || "null"); } catch (e) { return null; } })(),
        };
      });

      // statistiques d'équipe (sur les répondants terminés)
      const termines = repondants.filter((r) => {
        const s = (r.statut || "").toLowerCase();
        return s === "terminé" || s === "termine";
      });
      const statsFamilles = { RELATION: 0, ACTION: 0, STRUCTURE: 0, VISION: 0 };
      const archetypes = {};
      let sommeBF = { E: 0, A: 0, C: 0, N: 0, O: 0 };
      let nbBF = 0;
      termines.forEach((r) => {
        const f = (r.famille || "").toUpperCase();
        if (statsFamilles[f] !== undefined) statsFamilles[f]++;
        if (r.dominante) archetypes[r.dominante] = (archetypes[r.dominante] || 0) + 1;
        if (r.bigFive && r.bigFive.E !== null) {
          sommeBF.E += Number(r.bigFive.E) || 0; sommeBF.A += Number(r.bigFive.A) || 0;
          sommeBF.C += Number(r.bigFive.C) || 0; sommeBF.N += Number(r.bigFive.N) || 0;
          sommeBF.O += Number(r.bigFive.O) || 0; nbBF++;
        }
      });
      const moyenneBF = nbBF > 0 ? {
        E: Math.round(sommeBF.E / nbBF), A: Math.round(sommeBF.A / nbBF),
        C: Math.round(sommeBF.C / nbBF), N: Math.round(sommeBF.N / nbBF), O: Math.round(sommeBF.O / nbBF),
      } : null;

      const mapEnt2 = estListeDIds(campRecord.fields["Entreprise"]) ? await chargerNomsEntreprises() : {};
      return res.status(200).json({
        campagne: {
          nom: campRecord.fields["Nom campagne"] || "",
          type: campRecord.fields["Type de test"] || "",
          entreprise: nomEntreprise(campRecord.fields["Entreprise"], mapEnt2),
          superAdmin: estSuper,
          coach: (() => { try { return JSON.parse(campRecord.fields["Coach (JSON)"] || "null"); } catch (e) { return null; } })(),
          quota: Number(campRecord.fields["Quota"] || 0),
          utilisations: termines.length, // quota réel = nombre de répondants terminés
          mode: (campRecord.fields["Mode"] || "").toLowerCase(),
          profilCible: (() => { try { return JSON.parse(campRecord.fields["Profil cible (JSON)"] || "null"); } catch (e) { return null; } })(),
        },
        repondants,
        stats: {
          total: repondants.length,
          termines: termines.length,
          familles: statsFamilles,
          archetypes,
          moyenneBigFive: moyenneBF,
        },
      });
    }

    return res.status(400).json({ error: "Paramètre manquant (liste ou campagne)" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};


// ---- sécurité : neutralise guillemets et antislashs avant interpolation dans une formule Airtable ----
function champFormule(v) {
  return String(v == null ? "" : v).replace(/[\\"]/g, "");
}
