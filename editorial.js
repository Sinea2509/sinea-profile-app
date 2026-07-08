function corrigerTirets(texte) {
  let t = texte.replace(/\s[—–]\s/g, " · ");
  t = t.replace(/^[—–]\s*/gm, "");
  t = t.replace(/[—–]/g, "·");
  return t;
}

function retirerMarkdown(texte) {
  let t = texte;
  // Retirer UNIQUEMENT les titres markdown de type ## ou ### en debut de ligne
  // (ce sont les titres de section que la mise en page pose deja, donc redondants)
  t = t.replace(/^#{1,6}\s+.*\n?/gm, "");
  // Nettoyer les lignes vides multiples laissees par les titres retires
  t = t.replace(/\n{3,}/g, "\n\n");
  // NOTE : on GARDE les **sous-titres** car ils structurent utilement certaines sections
  // (ex: les 4 moments cles). Ils seront stylises proprement dans le PDF.
  return t;
}

function detecterNegations(texte) {
  const patterns = [
    /ce n'est pas\s+\w+[^.]*\bc'est\b/i,
    /\bpas\s+pour\s+\w+\s+mais\s+pour\b/i
  ];
  const trouvees = [];
  for (const p of patterns) if (p.test(texte)) trouvees.push(p.source);
  return trouvees;
}

function nettoyer(texte) {
  if (!texte) return texte;
  let t = corrigerTirets(texte);
  t = retirerMarkdown(t);
  t = t.replace(/[ \t]{2,}/g, " ");
  return t.trim();
}

module.exports = { nettoyer, corrigerTirets, retirerMarkdown, detecterNegations };
