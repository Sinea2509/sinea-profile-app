// ============================================================
// visuels.js — Les visuels signatures de Sinéa Profile
// Trois composants déterministes, partagés par la restitution,
// l'espace apprenant et le portail RH :
//   quadrantSvg(comps, opts)      La carte des 16 compétences
//   doubleProfilSvg(naturelAdapte) Naturel contre adapté, trait par trait
//   forcesVigilancesHtml(comps, pri) La page scannable en dix secondes
// Zéro dépendance. Couleurs de familles depuis Competences quand présent.
// ============================================================

(function () {
  'use strict';

  const FAMS = () => (window.Competences && window.Competences.COULEURS_FAMILLES)
    || { RELATION: '#F98272', ACTION: '#E8951A', STRUCTURE: '#2C97E0', VISION: '#5E59C7' };

  function ech(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------------------------------------------------------
  // 1. LE QUADRANT DES 16
  // Abscisse : le potentiel (la nature). Ordonnée : l'expression (le travail).
  // Quatre zones teintées, points aux couleurs des familles, étiquettes
  // anti-collision sur les compétences qui comptent, flèches d'évolution
  // quand une re-mesure existe.
  // opts : { deltas: {id:{avant,apres}}, taille: {id:nombre}, labels: [ids],
  //          titreX, titreY, compact }
  // ---------------------------------------------------------
  function quadrantSvg(comps, opts) {
    opts = opts || {};
    if (!Array.isArray(comps) || !comps.length) return '';
    const fams = FAMS();
    const W = 640, H = opts.compact ? 470 : 540;
    const x0 = 64, x1 = 616, y0 = 40, y1 = H - 96;
    const seuilX = 62, seuilY = 55;
    const px = (v) => Math.round(x0 + (x1 - x0) * Math.max(0, Math.min(100, v)) / 100);
    const py = (v) => Math.round(y1 - (y1 - y0) * Math.max(0, Math.min(100, v)) / 100);
    const sx = px(seuilX), sy = py(seuilY);

    // Le fond : quatre zones aux teintes maison, coins doux
    let s = '<svg class="q16" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="La carte des ' + comps.length + ' compétences : potentiel contre expression, quatre zones">';
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (sx - x0) + '" height="' + (sy - y0) + '" rx="14" fill="#5E59C7" opacity="0.07"/>';
    s += '<rect x="' + sx + '" y="' + y0 + '" width="' + (x1 - sx) + '" height="' + (sy - y0) + '" rx="14" fill="#5B9E6B" opacity="0.11"/>';
    s += '<rect x="' + x0 + '" y="' + sy + '" width="' + (sx - x0) + '" height="' + (y1 - sy) + '" rx="14" fill="#8A879B" opacity="0.07"/>';
    s += '<rect x="' + sx + '" y="' + sy + '" width="' + (x1 - sx) + '" height="' + (y1 - sy) + '" rx="14" fill="#E8951A" opacity="0.10"/>';
    // Les noms de zones, discrets, aux angles
    const zone = (x, y, ancre, titre, coul, sousTitre) =>
      '<text x="' + x + '" y="' + y + '" text-anchor="' + ancre + '" font-size="12.5" font-weight="800" letter-spacing="0.06em" fill="' + coul + '">' + titre + '</text>'
      + (sousTitre ? '<text x="' + x + '" y="' + (y + 15) + '" text-anchor="' + ancre + '" font-size="10.5" fill="#8A879B">' + sousTitre + '</text>' : '');
    s += zone(x1 - 10, y0 + 20, 'end', 'APPUIS', '#3E7C4F', 'à faire rayonner');
    s += zone(x1 - 10, y1 - 22, 'end', 'OPPORTUNITÉS', '#8A5A00', 'le moteur est là, la pratique paie');
    s += zone(x0 + 10, y0 + 20, 'start', 'SUR-RÉGIME', '#4A45A0', "exprimé au-delà de la nature");
    s += zone(x0 + 10, y1 - 10, 'start', 'EN VEILLE', '#8A879B', '');
    // Les lignes de seuil, en pointillé doux
    s += '<line x1="' + sx + '" y1="' + y0 + '" x2="' + sx + '" y2="' + y1 + '" stroke="#C9C6BB" stroke-width="1" stroke-dasharray="3 5"/>';
    s += '<line x1="' + x0 + '" y1="' + sy + '" x2="' + x1 + '" y2="' + sy + '" stroke="#C9C6BB" stroke-width="1" stroke-dasharray="3 5"/>';
    // Les axes, avec graduations fines
    s += '<line x1="' + x0 + '" y1="' + y1 + '" x2="' + x1 + '" y2="' + y1 + '" stroke="#B0AEB8" stroke-width="1.2"/>';
    s += '<line x1="' + x0 + '" y1="' + y1 + '" x2="' + x0 + '" y2="' + y0 + '" stroke="#B0AEB8" stroke-width="1.2"/>';
    [0, 25, 50, 75, 100].forEach((g) => {
      s += '<line x1="' + px(g) + '" y1="' + y1 + '" x2="' + px(g) + '" y2="' + (y1 + 5) + '" stroke="#B0AEB8" stroke-width="1"/>'
        + '<text x="' + px(g) + '" y="' + (y1 + 18) + '" text-anchor="middle" font-size="10" fill="#8A879B">' + g + '</text>'
        + '<line x1="' + (x0 - 5) + '" y1="' + py(g) + '" x2="' + x0 + '" y2="' + py(g) + '" stroke="#B0AEB8" stroke-width="1"/>';
    });
    s += '<text x="' + Math.round((x0 + x1) / 2) + '" y="' + (y1 + 40) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#4A4A52">' + ech(opts.titreX || 'Potentiel · votre nature profonde') + '</text>';
    s += '<text x="20" y="' + Math.round((y0 + y1) / 2) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#4A4A52" transform="rotate(-90 20 ' + Math.round((y0 + y1) / 2) + ')">' + ech(opts.titreY || 'Expression · au travail') + '</text>';

    // Le choix des étiquettes : celles qui comptent, sans collision
    const parZone = { appui: [], opportunite: [], economie: [], neutre: [] };
    comps.forEach((c) => { (parZone[c.zone] || parZone.neutre).push(c); });
    const tri = (arr) => arr.slice().sort((a, b) => b.score - a.score || b.potentiel - a.potentiel);
    let idsLabels = opts.labels;
    if (!idsLabels) {
      idsLabels = tri(parZone.appui).slice(0, 3).concat(tri(parZone.opportunite).slice(0, 3), tri(parZone.economie).slice(0, 2)).map((c) => c.id);
    }
    const setLabels = new Set(idsLabels);

    // Les flèches d'évolution (re-mesure) sous les points
    const deltas = opts.deltas || null;
    let fleches = '';
    if (deltas) {
      s += '<defs><marker id="q16f" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1 L7 4 L1 7 Z" fill="#3E7C4F"/></marker></defs>';
      comps.forEach((c) => {
        const d = deltas[c.id];
        if (!d || typeof d.avant !== 'number' || typeof d.apres !== 'number' || Math.abs(d.apres - d.avant) < 3) return;
        fleches += '<line x1="' + px(c.potentiel) + '" y1="' + py(d.avant) + '" x2="' + px(c.potentiel) + '" y2="' + (py(d.apres) + (d.apres > d.avant ? 9 : -9)) + '" stroke="#3E7C4F" stroke-width="2" opacity="0.7" marker-end="url(#q16f)"/>';
      });
    }
    s += fleches;

    // Les points, famille au cœur, anneau crème, apparition en douceur
    const taille = opts.taille || null;
    let pts = '', labels = [];
    comps.forEach((c, i) => {
      const cx = px(c.potentiel), cy = py(deltas && deltas[c.id] && typeof deltas[c.id].apres === 'number' ? deltas[c.id].apres : c.expression);
      const r = taille && taille[c.id] ? Math.min(13, 6 + taille[c.id] * 1.6) : 7;
      const coul = fams[c.famille] || '#8A879B';
      pts += '<g class="q16-pt" style="animation-delay:' + (0.05 * i).toFixed(2) + 's">'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r + 2.5) + '" fill="#FDFCF8" opacity="0.95"/>'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + coul + '"/>'
        + '<title>' + ech(c.nom) + ' · potentiel ' + Math.round(c.potentiel) + ' · expression ' + Math.round(c.expression) + '</title></g>';
      if (setLabels.has(c.id)) labels.push({ c: c, cx: cx, cy: cy, r: r });
    });

    // Anti-collision : côté selon la moitié, empilement vertical minimal
    labels.sort((a, b) => a.cy - b.cy);
    let dernierGauche = -99, dernierDroit = -99;
    let lab = '';
    labels.forEach((l) => {
      const aGauche = l.cx > (x0 + x1) / 2;
      let ty = l.cy + 4;
      if (aGauche) { if (ty - dernierGauche < 16) ty = dernierGauche + 16; dernierGauche = ty; }
      else { if (ty - dernierDroit < 16) ty = dernierDroit + 16; dernierDroit = ty; }
      const tx = aGauche ? l.cx - l.r - 8 : l.cx + l.r + 8;
      if (Math.abs(ty - (l.cy + 4)) > 7) {
        lab += '<line x1="' + (aGauche ? l.cx - l.r - 3 : l.cx + l.r + 3) + '" y1="' + l.cy + '" x2="' + (aGauche ? tx + 3 : tx - 3) + '" y2="' + (ty - 4) + '" stroke="#C9C6BB" stroke-width="0.8"/>';
      }
      lab += '<text x="' + tx + '" y="' + ty + '" text-anchor="' + (aGauche ? 'end' : 'start') + '" font-size="11.5" font-weight="600" fill="#1A1A2E" stroke="#FDFCF8" stroke-width="3" paint-order="stroke">' + ech(l.c.nom) + '</text>';
    });
    s += pts + lab;

    // La légende des familles
    const ly = H - 26;
    let lx = x0;
    Object.entries(fams).forEach(([nomF, coul]) => {
      s += '<circle cx="' + (lx + 5) + '" cy="' + (ly - 4) + '" r="5" fill="' + coul + '"/>'
        + '<text x="' + (lx + 15) + '" y="' + ly + '" font-size="10.5" font-weight="700" letter-spacing="0.04em" fill="#6B6B72">' + nomF + '</text>';
      lx += 15 + nomF.length * 7 + 26;
    });
    if (deltas) s += '<text x="' + x1 + '" y="' + ly + '" text-anchor="end" font-size="10.5" fill="#3E7C4F" font-weight="700">↑ évolution depuis la re-mesure</text>';
    s += '</svg>';
    return s;
  }

  // ---------------------------------------------------------
  // 2. NATUREL CONTRE ADAPTÉ, TRAIT PAR TRAIT
  // Cinq rails. Un disque violet pour la nature, un losange corail pour
  // le travail, reliés par un pont teinté selon le sens de l'effort.
  // ---------------------------------------------------------
  function doubleProfilSvg(na) {
    if (!na || !na.naturel || !na.adapte) return '';
    const TRAITS = [
      ['O', 'Ouverture'], ['C', 'Conscience'], ['E', 'Extraversion'], ['A', 'Agréabilité'], ['S', 'Stabilité émotionnelle'],
    ];
    const val = (src, t) => {
      const brut = t === 'S' ? (typeof src.N === 'number' ? 100 - src.N : src.S) : src[t];
      return Math.max(0, Math.min(100, Number(brut) || 0));
    };
    const W = 640, ligneH = 52, y0 = 46;
    const H = y0 + TRAITS.length * ligneH + 46;
    const x0 = 168, x1 = 560;
    const px = (v) => Math.round(x0 + (x1 - x0) * v / 100);
    let s = '<svg class="dp2" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Votre profil naturel contre votre profil au travail, trait par trait">';
    // La légende, en tête
    s += '<circle cx="' + x0 + '" cy="18" r="6" fill="#5E59C7"/><text x="' + (x0 + 12) + '" y="22" font-size="11.5" font-weight="700" fill="#4A4A52">Votre nature</text>';
    s += '<rect x="' + (x0 + 118) + '" y="12" width="12" height="12" rx="2.5" transform="rotate(45 ' + (x0 + 124) + ' 18)" fill="#F98272"/><text x="' + (x0 + 136) + '" y="22" font-size="11.5" font-weight="700" fill="#4A4A52">Au travail</text>';
    TRAITS.forEach(([t, nomT], i) => {
      const y = y0 + i * ligneH + 26;
      const vN = val(na.naturel, t), vA = val(na.adapte, t);
      const xN = px(vN), xA = px(vA);
      const ecart = Math.round(vA - vN);
      // Le rail et sa zone médiane
      s += '<text x="' + (x0 - 14) + '" y="' + (y + 4) + '" text-anchor="end" font-size="12.5" font-weight="700" fill="#1A1A2E">' + nomT + '</text>';
      s += '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="#ECEAE3" stroke-width="7" stroke-linecap="round"/>';
      // Le pont de l'effort : teinté selon le sens, épaisseur constante
      if (Math.abs(ecart) >= 4) {
        s += '<line class="dp2-pont" x1="' + xN + '" y1="' + y + '" x2="' + xA + '" y2="' + y + '" stroke="' + (ecart > 0 ? '#F98272' : '#5E59C7') + '" stroke-width="7" stroke-linecap="round" opacity="0.4"/>';
      }
      // Les deux marqueurs
      s += '<circle class="dp2-nat" cx="' + xN + '" cy="' + y + '" r="8" fill="#5E59C7" stroke="#FDFCF8" stroke-width="2.5"/>';
      s += '<rect class="dp2-adp" x="' + (xA - 6.5) + '" y="' + (y - 6.5) + '" width="13" height="13" rx="3" transform="rotate(45 ' + xA + ' ' + y + ')" fill="#F98272" stroke="#FDFCF8" stroke-width="2.5"/>';
      // Les valeurs et l'écart
      s += '<text x="' + (x1 + 14) + '" y="' + (y + 4) + '" font-size="11.5" font-weight="700" fill="#6B6B72">' + Math.round(vN) + ' › ' + Math.round(vA) + '</text>';
      if (Math.abs(ecart) >= 12) {
        const mx = Math.round((xN + xA) / 2);
        s += '<rect x="' + (mx - 19) + '" y="' + (y - 26) + '" width="38" height="17" rx="8.5" fill="' + (ecart > 0 ? 'rgba(249,130,114,0.16)' : 'rgba(94,89,199,0.14)') + '"/>'
          + '<text x="' + mx + '" y="' + (y - 14) + '" text-anchor="middle" font-size="10.5" font-weight="800" fill="' + (ecart > 0 ? '#B0442F' : '#4A45A0') + '">' + (ecart > 0 ? '+' : '') + ecart + '</text>';
      }
    });
    s += '<text x="' + x0 + '" y="' + (H - 14) + '" font-size="10.5" fill="#8A879B">Le pont coloré matérialise votre effort d\'adaptation quotidien.</text>';
    s += '</svg>';
    return s;
  }

  // ---------------------------------------------------------
  // 3. FORCES ET VIGILANCES
  // La page qui se lit en dix secondes : cinq forces en barres pleines,
  // jusqu'à trois vigilances en barres creuses hachurées.
  // ---------------------------------------------------------
  function forcesVigilancesHtml(comps, pri) {
    if (!Array.isArray(comps) || !comps.length) return '';
    const fams = FAMS();
    const triPot = comps.slice().sort((a, b) => b.potentiel - a.potentiel);
    const forces = triPot.slice(0, 5);
    const idsF = new Set(forces.map((c) => c.id));
    const vig = [];
    ((pri && pri.vigilances) || []).forEach((v) => {
      const c = comps.find((x) => x.nom === v.competence || x.id === v.id);
      if (c && !idsF.has(c.id)) vig.push(c);
    });
    triPot.slice().reverse().forEach((c) => {
      if (vig.length < 3 && !idsF.has(c.id) && !vig.find((x) => x.id === c.id)) vig.push(c);
    });
    const barre = (c, creuse) => {
      const coul = fams[c.famille] || '#8A879B';
      const v = Math.round(creuse ? c.potentiel : c.potentiel);
      return '<div class="fv-ligne"><span class="fv-nom">' + ech(c.nom) + '</span>'
        + '<span class="fv-rail"><i class="fv-barre' + (creuse ? ' fv-creuse' : '') + '" style="width:' + v + '%;' + (creuse ? 'border-color:' + coul + ';color:' + coul : 'background:linear-gradient(90deg,' + coul + 'CC,' + coul + ')') + '"></i></span>'
        + '<span class="fv-val">' + v + '</span></div>';
    };
    return '<div class="fv">'
      + '<div class="fv-col"><div class="fv-titre fv-titre-f">Vos cinq forces</div>' + forces.map((c) => barre(c, false)).join('') + '</div>'
      + '<div class="fv-col"><div class="fv-titre fv-titre-v">Vos points de vigilance</div>' + vig.slice(0, 3).map((c) => barre(c, true)).join('')
      + '<p class="fv-note">Une vigilance est une compétence moins naturelle chez vous : la connaître suffit souvent à la piloter.</p></div>'
      + '</div>';
  }

  window.Visuels = { quadrantSvg, doubleProfilSvg, forcesVigilancesHtml };
})();
