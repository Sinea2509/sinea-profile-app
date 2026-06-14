// ============================================================
// revelation.js — Séquence de révélation à la première découverte
//
// À COLLER dans result.js (ou à charger en <script> avant result.js).
// Puis, tout au DÉBUT de la fonction render(res), ajouter :
//
//     if (typeof lancerRevelation === "function") {
//       const reprise = lancerRevelation(res, () => rendreRestitution(res));
//       if (reprise === "differe") return;   // la séquence prend la main
//     }
//
// ... et renommer le corps actuel de render() en rendreRestitution(res),
// OU plus simple : garder render() tel quel et appeler lancerRevelation
// au tout début ; la séquence se superpose puis s'efface, le reste de
// render() ayant déjà peint la restitution dessous.
//
// COMPORTEMENT
// · Ne se joue qu'à la PREMIÈRE découverte (mémorisé en localStorage).
//   Les fois suivantes : aucune séquence, la restitution s'affiche direct.
// · Utilise les VRAIES données : archétype, famille, illustration, verbe.
// · 4 temps : suspense court · famille · personnage · transition.
// · La thématique de campagne est optionnelle (window.SINEA_THEME) :
//   si absente, l'écran de transition reste générique.
// ============================================================

(function () {
  // ---- Données de marque (alignées sur result.js) ----
  var FAM_COLOR = { RELATION: "#F98272", ACTION: "#F5A623", STRUCTURE: "#3EADFF", VISION: "#5E59C7" };
  var FAM_COLOR2 = { RELATION: "#F9A876", ACTION: "#FAC56E", STRUCTURE: "#7CC8FF", VISION: "#8E89E8" };
  var FAM_LABEL = { RELATION: "Relation", ACTION: "Action", STRUCTURE: "Structure", VISION: "Vision" };
  // Phrase courte par famille (reprise de l'esprit des descriptions de result.js)
  var FAM_DESC = {
    RELATION: "Vous êtes tourné vers le lien et l'harmonie. Vous sentez les autres et soudez les équipes.",
    ACTION: "Vous êtes tourné vers l'action et le résultat. Vous lancez le mouvement et débloquez les situations.",
    STRUCTURE: "Vous êtes tourné vers le cadre et la clarté. Vous transformez le flou en repères solides.",
    VISION: "Vous êtes tourné vers les idées et les horizons larges. Vous voyez loin et ouvrez des chemins."
  };

  // ---- Détection première découverte ----
  function cleVue(res) {
    // une clé par personne/campagne si dispo, sinon globale
    var id = (res && (res.email || res.code || res.id)) || "anon";
    return "sinea_reveal_vue_" + String(id).toLowerCase().replace(/[^a-z0-9_]/g, "");
  }
  function dejaVue(res) {
    try { return localStorage.getItem(cleVue(res)) === "1"; } catch (e) { return false; }
  }
  function marquerVue(res) {
    try { localStorage.setItem(cleVue(res), "1"); } catch (e) {}
  }

  // ---- Récupère illustration + verbe via les fonctions de result.js si dispo ----
  function illustration(nom) {
    try { if (typeof img === "function") return img(nom); } catch (e) {}
    try {
      var s = (window.SINEA_DATA && SINEA_DATA.images && SINEA_DATA.images[nom]);
      return s ? s + ".webp" : "";
    } catch (e) { return ""; }
  }
  function phraseVerbe(nom) {
    try { if (typeof verbe === "function") return verbe(nom); } catch (e) {}
    return "";
  }

  // ---- CSS injecté une seule fois ----
  function injecterStyles() {
    if (document.getElementById("rev-styles")) return;
    var st = document.createElement("style");
    st.id = "rev-styles";
    st.textContent = [
      "#rev-overlay{position:fixed;inset:0;z-index:9999;font-family:'Manrope',system-ui,sans-serif;color:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;}",
      "#rev-overlay .rev-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%, #FF7D64 0%, #6E3D82 48%, #0F1232 100%);z-index:0;}",
      "#rev-overlay .rev-bg::before{content:'';position:absolute;inset:0;background-image:var(--rev-pattern,none);background-size:520px;opacity:0.04;mix-blend-mode:screen;filter:invert(1);}",
      "#rev-overlay .rev-bg::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 40%, #FF9E7D 0%, transparent 55%);opacity:0;animation:revHalo 6s ease-in-out infinite;mix-blend-mode:screen;}",
      "@keyframes revHalo{0%,100%{opacity:0.16;transform:scale(1);}50%{opacity:0.4;transform:scale(1.1);}}",
      "#rev-overlay .rev-stage{position:relative;z-index:2;text-align:center;padding:0 24px;max-width:760px;width:100%;}",
      "#rev-overlay .rev-phase{display:none;}",
      "#rev-overlay .rev-phase.on{display:block;animation:revUp 0.9s cubic-bezier(0.22,1,0.36,1) both;}",
      "@keyframes revUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}",
      "@keyframes revPop{from{opacity:0;transform:scale(0.35);}to{opacity:1;transform:scale(1);}}",
      "@keyframes revRing{0%,100%{transform:scale(1);opacity:0.35;}50%{transform:scale(1.12);opacity:0.1;}}",
      // suspense
      "#rev-overlay .rev-pre{font-size:13px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:22px;}",
      "#rev-overlay .rev-pre-t{font-size:clamp(24px,5vw,40px);font-weight:800;line-height:1.2;}",
      "#rev-overlay .rev-pre-t .a{color:#FFC9A0;}",
      "#rev-overlay .rev-bar{width:210px;height:4px;background:rgba(255,255,255,0.12);border-radius:99px;margin:34px auto 0;overflow:hidden;}",
      "#rev-overlay .rev-bar-f{height:100%;width:0;background:linear-gradient(90deg,#F98272,#F9A876 35%,#E290EC 70%,#5474F5);border-radius:99px;transition:width 4.9s cubic-bezier(0.45,0.05,0.3,1);}",
      "#rev-overlay .rev-bar-t{font-size:11.5px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-top:14px;font-weight:700;}",
      // famille
      "#rev-overlay .rev-fam-k{font-size:12.5px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:18px;opacity:0;animation:revUp 0.7s 0.1s both;}",
      "#rev-overlay .rev-orb{width:140px;height:140px;margin:0 auto 24px;border-radius:50%;position:relative;opacity:0;animation:revPop 1.1s 0.2s cubic-bezier(0.34,1.56,0.64,1) both;}",
      "#rev-overlay .rev-orb::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(255,255,255,0.45);opacity:0.4;animation:revRing 2.6s ease-in-out infinite;}",
      "#rev-overlay .rev-fam-n{font-size:clamp(32px,7vw,54px);font-weight:800;line-height:1;letter-spacing:-0.02em;opacity:0;animation:revUp 0.9s 0.5s both;}",
      "#rev-overlay .rev-fam-d{font-size:15.5px;color:rgba(255,255,255,0.78);margin:16px auto 0;line-height:1.55;max-width:460px;opacity:0;animation:revUp 0.8s 0.8s both;}",
      // personnage
      "#rev-overlay .rev-pers-k{font-size:12.5px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:14px;opacity:0;animation:revUp 0.7s both;}",
      "#rev-overlay .rev-portrait{width:190px;height:190px;margin:0 auto 22px;border-radius:34px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;opacity:0;animation:revPop 1.1s 0.15s cubic-bezier(0.34,1.56,0.64,1) both;}",
      "#rev-overlay .rev-portrait img{width:100%;height:100%;object-fit:cover;object-position:center top;}",
      "#rev-overlay .rev-pers-kick{font-size:12.5px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:8px;opacity:0;animation:revUp 0.7s 0.45s both;}",
      "#rev-overlay .rev-pers-n{font-size:clamp(38px,9vw,66px);font-weight:800;line-height:1;letter-spacing:-0.02em;opacity:0;animation:revUp 1s 0.55s both;background:linear-gradient(90deg,#FFD9A0,#FFB0E8);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}",
      "#rev-overlay .rev-pers-v{font-size:17px;color:rgba(255,255,255,0.82);margin:18px auto 0;font-weight:500;line-height:1.5;max-width:500px;opacity:0;animation:revUp 0.8s 0.95s both;}",
      // transition
      "#rev-overlay .rev-coach{max-width:540px;margin:0 auto 32px;}",
      "#rev-overlay .rev-coach-orb{width:70px;height:70px;margin:0 auto 16px;border-radius:50%;background:radial-gradient(circle at 35% 30%, #FFE9C7, #FFA76E 40%, #FF7AD9 75%, #5474F5);position:relative;opacity:0;animation:revPop 0.9s 0.1s cubic-bezier(0.34,1.56,0.64,1) both;box-shadow:0 0 50px -10px #FFA76E;}",
      "#rev-overlay .rev-coach-orb::after{content:'';position:absolute;inset:-5px;border-radius:50%;border:2px solid rgba(255,255,255,0.4);animation:revRing 2.4s ease-in-out infinite;}",
      "#rev-overlay .rev-coach-video{width:120px;height:120px;margin:0 auto 18px;border-radius:50%;overflow:hidden;position:relative;opacity:0;animation:revPop 0.9s 0.1s cubic-bezier(0.34,1.56,0.64,1) both;box-shadow:0 0 60px -8px #FFA76E;}",
      "#rev-overlay .rev-coach-video::after{content:'';position:absolute;inset:-5px;border-radius:50%;border:2px solid rgba(255,255,255,0.4);animation:revRing 2.4s ease-in-out infinite;pointer-events:none;}",
      "#rev-overlay .rev-nea-vid{width:100%;height:100%;object-fit:cover;display:block;}",
      "#rev-overlay .rev-coach-m{font-size:clamp(18px,3.4vw,24px);font-weight:700;line-height:1.4;opacity:0;animation:revUp 0.9s 0.35s both;}",
      "#rev-overlay .rev-coach-m .a{color:#FFC9A0;}",
      "#rev-overlay .rev-coach-s{font-size:12px;color:rgba(255,255,255,0.5);margin-top:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;opacity:0;animation:revUp 0.8s 0.7s both;}",
      "#rev-overlay .rev-coach-label-na{font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#FFC9A0;margin-bottom:16px;opacity:0;animation:revUp 0.7s 0.3s both;}",
      "#rev-overlay .rev-flow{display:flex;align-items:stretch;justify-content:center;gap:13px;flex-wrap:wrap;max-width:600px;margin:0 auto;opacity:0;animation:revUp 0.8s 0.9s both;}",
      "#rev-overlay .rev-tf{flex:1;min-width:190px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:18px;padding:20px 18px;backdrop-filter:blur(10px);text-align:left;}",
      "#rev-overlay .rev-tf.hl{background:linear-gradient(135deg,rgba(249,130,114,0.2),rgba(84,116,245,0.14));border:1px solid rgba(255,158,125,0.35);}",
      "#rev-overlay .rev-tf-ic{width:42px;height:42px;border-radius:12px;background:linear-gradient(90deg,#F98272,#F9A876 35%,#E290EC 70%,#5474F5);display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:12px;}",
      "#rev-overlay .rev-tf-t{font-size:15.5px;font-weight:800;margin-bottom:7px;}",
      "#rev-overlay .rev-tf-d{font-size:12px;color:rgba(255,255,255,0.72);line-height:1.5;}",
      "#rev-overlay .rev-arrow{display:flex;align-items:center;color:#FFC9A0;font-size:21px;font-weight:800;}",
      // boutons
      "#rev-overlay .rev-btn{display:inline-block;margin-top:32px;background:#fff;color:#151416;font-weight:800;font-size:15px;padding:15px 38px;border-radius:99px;border:none;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;opacity:0;animation:revUp 0.8s 0.5s both;}",
      "#rev-overlay .rev-btn:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(255,255,255,0.2);}",
      "#rev-overlay .rev-skip{position:fixed;top:20px;right:22px;z-index:3;background:rgba(255,255,255,0.12);border:none;color:rgba(255,255,255,0.8);font-size:12.5px;font-weight:700;padding:8px 16px;border-radius:99px;cursor:pointer;font-family:inherit;}",
      "#rev-overlay .rev-skip:hover{background:rgba(255,255,255,0.22);}",
      "#rev-overlay.rev-out{animation:revFade 0.6s ease forwards;}",
      "@keyframes revFade{to{opacity:0;visibility:hidden;}}"
    ].join("");
    document.head.appendChild(st);
  }

  // ---- Construit le DOM de l'overlay avec les vraies données ----
  function construire(res) {
    var dom = res.dominante;
    var fam = dom.famille;
    var c1 = FAM_COLOR[fam] || "#8884F0";
    var c2 = FAM_COLOR2[fam] || "#8E89E8";
    var ill = illustration(dom.nom);
    var verbeTxt = phraseVerbe(dom.nom) || "Voici ce qui vous rend unique.";
    var theme = (window.SINEA_THEME || "").trim();

    var ov = document.createElement("div");
    ov.id = "rev-overlay";

    // pattern : si la page a déjà la variable --pattern, on la réutilise
    var patternVal = "";
    try {
      patternVal = getComputedStyle(document.documentElement).getPropertyValue("--pattern");
    } catch (e) {}
    if (patternVal && patternVal.trim()) ov.style.setProperty("--rev-pattern", patternVal.trim());

    // bloc transition : générique ou avec thématique
    var introTheme = theme
      ? "Votre équipe travaille <b>" + escapeHtml(theme) + "</b>. Vos défis vont épouser votre profil pour faire grandir cette compétence à votre façon."
      : "Vos défis vont épouser votre profil pour faire grandir, à votre façon, la compétence travaillée par votre équipe.";

    ov.innerHTML =
      '<div class="rev-bg"></div>' +
      '<button class="rev-skip" id="rev-skip">Passer</button>' +
      '<div class="rev-stage">' +
        // 1 suspense
        '<div class="rev-phase" data-p="1">' +
          '<div class="rev-pre">Votre portrait est prêt</div>' +
          '<div class="rev-pre-t">Vous avez répondu avec sincérité.<br><span class="a">Découvrons qui vous êtes.</span></div>' +
          '<div class="rev-bar"><div class="rev-bar-f" id="rev-bar-f"></div></div>' +
          '<div class="rev-bar-t" id="rev-bar-t">Analyse de vos réponses</div>' +
        '</div>' +
        // 2 famille
        '<div class="rev-phase" data-p="2">' +
          '<div class="rev-fam-k">Votre famille de personnalité</div>' +
          '<div class="rev-orb" style="background:radial-gradient(circle at 38% 32%,' + c2 + ',' + c1 + ' 70%);box-shadow:0 0 80px -10px ' + c1 + ';"></div>' +
          '<div class="rev-fam-n" style="background:linear-gradient(90deg,#fff,' + c2 + ');-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">' + escapeHtml(FAM_LABEL[fam] || fam) + '</div>' +
          '<div class="rev-fam-d">' + escapeHtml(FAM_DESC[fam] || "") + '</div>' +
          '<button class="rev-btn" data-go="3">Découvrir mon personnage →</button>' +
        '</div>' +
        // 3 personnage
        '<div class="rev-phase" data-p="3">' +
          '<div class="rev-pers-k" style="color:' + c2 + ';">Famille ' + escapeHtml(FAM_LABEL[fam] || fam) + '</div>' +
          '<div class="rev-portrait" style="background:linear-gradient(135deg,' + c1 + ',' + c2 + ');box-shadow:0 30px 80px -20px ' + c1 + ';">' + (ill ? '<img src="' + ill + '" alt="">' : '<span style="font-size:84px;">✦</span>') + '</div>' +
          '<div class="rev-pers-kick">Votre archétype</div>' +
          '<div class="rev-pers-n">' + escapeHtml(dom.nom) + '</div>' +
          '<div class="rev-pers-v">' + escapeHtml(verbeTxt) + '</div>' +
          '<button class="rev-btn" data-go="4">Découvrir mon archétype →</button>' +
        '</div>' +
        // 4 · Néa prend la parole (écran à lui seul)
        '<div class="rev-phase" data-p="4">' +
          '<div class="rev-coach">' +
            '<div class="rev-coach-video">' +
              '<video class="rev-nea-vid" autoplay loop muted playsinline poster="Nea_detoure_full.png">' +
                '<source src="nea.mp4" type="video/mp4">' +
              '</video>' +
            '</div>' +
            '<div class="rev-coach-label-na">Néa · votre coach</div>' +
            '<div class="rev-coach-m">« Bonjour, je suis <span class="a">Néa</span>. J\'ai lu votre portrait en entier, et il dit de belles choses sur vous. Laissez-moi vous le présenter. »</div>' +
          '</div>' +
          '<button class="rev-btn" data-go="5">Continuer →</button>' +
        '</div>' +
        // 5 · la suite : portrait + SeedUp
        '<div class="rev-phase" data-p="5">' +
          '<div class="rev-flow">' +
            '<div class="rev-tf"><div class="rev-tf-ic">◈</div><div class="rev-tf-t">Votre portrait</div><div class="rev-tf-d">Vos forces, vos moteurs, votre façon d\'agir.</div></div>' +
            '<div class="rev-arrow">→</div>' +
            '<div class="rev-tf hl"><div class="rev-tf-ic">⚡</div><div class="rev-tf-t">Votre pratique SeedUp</div><div class="rev-tf-d">' + introTheme + '</div></div>' +
          '</div>' +
          '<button class="rev-btn" data-go="fin">Découvrir mon portrait →</button>' +
        '</div>' +
      '</div>';

    return ov;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  // ---- Orchestration des phases ----
  function lancerRevelation(res, onFini) {
    if (!res || !res.dominante) return "skip";
    // déjà vue : on ne joue pas, restitution directe
    if (dejaVue(res)) return "skip";

    injecterStyles();
    var ov = construire(res);
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";

    var timer = null;
    function montrer(n) {
      var phases = ov.querySelectorAll(".rev-phase");
      phases.forEach(function (p) { p.classList.remove("on"); });
      var el = ov.querySelector('.rev-phase[data-p="' + n + '"]');
      if (!el) return;
      // re-trigger animation
      void el.offsetWidth;
      el.classList.add("on");
      if (n === 1) {
        var fill = ov.querySelector("#rev-bar-f");
        var txt = ov.querySelector("#rev-bar-t");
        // barre de chargement ~5s : donne l'impression que le système analyse en profondeur
        if (fill) { fill.style.width = "0"; setTimeout(function () { fill.style.width = "100%"; }, 100); }
        var et = [
          "Analyse de vos réponses",
          "Lecture de vos cinq dimensions",
          "Croisement de vos traits",
          "Identification de votre famille",
          "Révélation de votre archétype"
        ];
        var i = 0;
        // 5 messages sur ~5s => un message toutes les 1000ms
        var it = setInterval(function () { i++; if (txt && i < et.length) txt.textContent = et[i]; }, 1000);
        // bascule vers la découverte de la famille au bout de 5s, puis chaque écran attend le clic
        timer = setTimeout(function () { clearInterval(it); montrer(2); }, 5000);
      }
    }

    function fermer() {
      if (timer) clearTimeout(timer);
      marquerVue(res);
      ov.classList.add("rev-out");
      document.body.style.overflow = "";
      setTimeout(function () {
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        if (typeof onFini === "function") onFini();
      }, 600);
    }

    // clics : navigation entre phases + fin
    ov.addEventListener("click", function (e) {
      var go = e.target && e.target.getAttribute && e.target.getAttribute("data-go");
      if (go === "fin") { fermer(); return; }
      if (go) { if (timer) clearTimeout(timer); montrer(parseInt(go, 10)); }
      if (e.target && e.target.id === "rev-skip") { fermer(); }
    });

    montrer(1);
    return "differe";
  }

  // exposer globalement
  window.lancerRevelation = lancerRevelation;
})();
