// ============================================================
// affinage.js — Questions d'affinage quand la fiabilité est basse
//
// Quand le score de fiabilité passe SOUS 75 %, on propose à la personne
// une courte série de questions ciblées sur le trait le plus en tension,
// AVANT d'afficher la restitution. Ses réponses réajustent ce trait, on
// recalcule, puis on affiche le portrait affiné.
//
// Principe (option 1) : on affine UNE seule fois. Quel que soit le
// résultat, la restitution s'affiche ensuite (on ne bloque jamais).
//
// INTÉGRATION dans controller.js, juste après le calcul du résultat
// (result.fiabilite = Engine.scorerFiabilite(...)) et AVANT l'affichage
// de la restitution :
//
//   if (typeof lancerAffinage === "function" &&
//       result.fiabilite && result.fiabilite.score < 75) {
//     lancerAffinage(result, function (ajustements) {
//       appliquerAjustementsEtAfficher(result, ajustements); // voir plus bas
//     });
//     return; // l'affinage prend la main, la restitution suivra
//   }
//   // sinon : afficher la restitution normalement
//
// La fonction de rappel reçoit { dimension, delta } : un ajustement en
// points (-100..+100) à appliquer au trait visé avant de recalculer.
// ============================================================

(function () {
  // Questions de confirmation par dimension : des affirmations CLAIRES, faciles à
  // trancher, pensées pour lever le doute (pas pour rejouer tout le bilan).
  var QUESTIONS = {
    extraversion: {
      label: "votre énergie sociale",
      items: [
        "Je vais facilement vers les autres, même des personnes que je connais peu.",
        "Prendre la parole en groupe me dynamise plutôt que cela ne me coûte.",
        "Je préfère l'animation et les échanges au calme et à la solitude."
      ]
    },
    agreabilite: {
      label: "votre rapport aux autres",
      items: [
        "Je cherche naturellement l'harmonie, quitte à mettre mes envies de côté.",
        "Je fais facilement confiance et je pars du bon côté des gens.",
        "Rendre service me vient spontanément, même sans qu'on me le demande."
      ]
    },
    conscience: {
      label: "votre rapport à l'organisation",
      items: [
        "Je termine ce que je commence, même quand la motivation baisse.",
        "Je planifie et je m'organise plutôt que d'avancer au feeling.",
        "La rigueur et le suivi me viennent naturellement."
      ]
    },
    neuroticisme: {
      label: "votre rapport aux émotions",
      items: [
        "Même quand la pression monte, je reste posé.",
        "Après une contrariété, je retrouve vite mon équilibre.",
        "Les imprévus m'inquiètent rarement durablement."
      ]
    },
    ouverture: {
      label: "votre rapport aux idées",
      items: [
        "Les idées nouvelles me stimulent, même quand elles bousculent l'habitude.",
        "J'aime explorer, imaginer, sortir des sentiers battus.",
        "Je préfère la nouveauté à la routine, même incertaine."
      ]
    }
  };

  // libellé lisible du trait
  var NOM_TRAIT = {
    extraversion: "Extraversion", agreabilite: "Agréabilité",
    conscience: "Conscience", neuroticisme: "Stabilité émotionnelle",
    ouverture: "Ouverture"
  };

  function injecterStyles() {
    if (document.getElementById("aff-styles")) return;
    var st = document.createElement("style");
    st.id = "aff-styles";
    st.textContent = [
      "#aff-overlay{position:fixed;inset:0;z-index:9998;font-family:'Manrope',system-ui,sans-serif;background:#F5F4F0;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;}",
      "#aff-overlay .aff-card{max-width:620px;width:100%;margin:auto;}",
      "#aff-overlay .aff-tag{font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#5E59C7;margin-bottom:14px;text-align:center;}",
      "#aff-overlay .aff-h{font-size:25px;font-weight:800;line-height:1.3;text-align:center;margin-bottom:14px;color:#151416;letter-spacing:-0.01em;}",
      "#aff-overlay .aff-intro{font-size:14.5px;color:#747474;line-height:1.6;text-align:center;margin-bottom:32px;}",
      "#aff-overlay .aff-q{background:#fff;border:1px solid #EAE7E0;border-radius:16px;padding:20px 22px;margin-bottom:14px;}",
      "#aff-overlay .aff-q-txt{font-size:15px;font-weight:600;color:#2D2D2D;line-height:1.45;margin-bottom:16px;}",
      "#aff-overlay .aff-scale{display:flex;gap:8px;}",
      "#aff-overlay .aff-opt{flex:1;border:1.5px solid #E6E3DC;border-radius:11px;padding:12px 6px;text-align:center;font-size:12px;font-weight:700;color:#747474;cursor:pointer;transition:all 0.15s;line-height:1.3;}",
      "#aff-overlay .aff-opt:hover{border-color:#B7B3E8;}",
      "#aff-overlay .aff-opt.sel{border-color:#5E59C7;background:linear-gradient(135deg,rgba(136,132,240,0.12),rgba(226,144,236,0.06));color:#5E59C7;}",
      "#aff-overlay .aff-go{width:100%;background:#151416;color:#fff;border:none;border-radius:13px;padding:16px;font-size:15px;font-weight:800;font-family:inherit;cursor:pointer;margin-top:18px;opacity:0.5;pointer-events:none;transition:opacity 0.2s;}",
      "#aff-overlay .aff-go.ready{opacity:1;pointer-events:auto;}",
      "#aff-overlay .aff-go:hover{transform:translateY(-1px);}"
    ].join("");
    document.head.appendChild(st);
  }

  function lancerAffinage(result, onFini) {
    var trait = (result && result.fiabilite && result.fiabilite.traitTension) || null;
    var def = trait && QUESTIONS[trait];
    // si on ne sait pas quel trait affiner, on n'affine pas : on affiche direct
    if (!def) { if (typeof onFini === "function") onFini(null); return; }

    injecterStyles();
    var ov = document.createElement("div");
    ov.id = "aff-overlay";

    var qsHtml = def.items.map(function (txt, i) {
      return (
        '<div class="aff-q" data-i="' + i + '">' +
          '<div class="aff-q-txt">' + escapeHtml(txt) + '</div>' +
          '<div class="aff-scale">' +
            '<div class="aff-opt" data-v="0">Pas du tout</div>' +
            '<div class="aff-opt" data-v="33">Un peu</div>' +
            '<div class="aff-opt" data-v="67">Plutôt oui</div>' +
            '<div class="aff-opt" data-v="100">Tout à fait</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    ov.innerHTML =
      '<div class="aff-card">' +
        '<div class="aff-tag">Affinons votre portrait</div>' +
        '<div class="aff-h">Quelques précisions pour un portrait au plus juste</div>' +
        '<div class="aff-intro">Vos réponses étaient nuancées sur un point, et c\'est très bien. Pour que votre portrait vous ressemble vraiment, confirmez simplement ce qui vous correspond le mieux sur ' + escapeHtml(def.label) + '.</div>' +
        qsHtml +
        '<button class="aff-go" id="aff-go">Voir mon portrait</button>' +
      '</div>';

    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";

    var reponses = {};
    ov.addEventListener("click", function (e) {
      var opt = e.target.closest && e.target.closest(".aff-opt");
      if (opt) {
        var q = opt.closest(".aff-q");
        var i = q.getAttribute("data-i");
        q.querySelectorAll(".aff-opt").forEach(function (o) { o.classList.remove("sel"); });
        opt.classList.add("sel");
        reponses[i] = Number(opt.getAttribute("data-v"));
        // activer le bouton quand toutes les questions sont répondues
        if (Object.keys(reponses).length >= def.items.length) {
          ov.querySelector("#aff-go").classList.add("ready");
        }
        return;
      }
      if (e.target && e.target.id === "aff-go") {
        // moyenne des réponses (0..100) → écart par rapport au point neutre (50)
        var vals = Object.keys(reponses).map(function (k) { return reponses[k]; });
        var moy = vals.reduce(function (a, b) { return a + b; }, 0) / (vals.length || 1);
        var delta = moy - 50; // -50..+50 : dans quel sens corriger le trait
        fermer({ dimension: trait, delta: delta, moyenne: moy });
      }
    });

    function fermer(ajustements) {
      document.body.style.overflow = "";
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (typeof onFini === "function") onFini(ajustements);
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  window.lancerAffinage = lancerAffinage;
})();
