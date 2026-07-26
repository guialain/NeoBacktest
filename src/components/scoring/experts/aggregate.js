// aggregate.js — agrégation multi-TF partagée par les experts de scoring (owner 2026-07-26).
// --------------------------------------------------------------------------------------------
// Deux experts (Pressure, Cycle) pondèrent leurs TF de la même façon ; un 3e arrive. La règle vit
//   donc ICI, une seule fois — deux copies d'une même agrégation finissent par diverger.
//
// ⚠ RENORMALISATION SUR LES TF PRÉSENTS. Si un TF n'a pas d'avis (`null`), on le retire ET on
//   redivise par la somme des poids restants. Sinon un TF absent pèserait comme un TF à 0, ce qui
//   est une OPINION qu'on n'a pas — même piège que `num("")=0`.
//   Conséquence assumée : avec le seul H1 présent, le global VAUT H1, il n'est pas amputé de 60 %.
//
// Rend `{ score, parts, missing, weight }` — `missing` et `weight` existent pour que l'UI puisse
//   DIRE ce qui manque au lieu de le cacher.
export function weightedGlobal(perTf, weights) {
  const parts = [];
  const missing = [];
  for (const [tf, w] of Object.entries(weights)) {
    const v = perTf?.[tf];
    if (v == null) { missing.push(tf); continue; }
    parts.push({ tf, v, w });
  }
  if (!parts.length) return { score: null, parts, missing, weight: 0 };
  const weight = parts.reduce((a, p) => a + p.w, 0);
  const score = parts.reduce((a, p) => a + p.v * p.w, 0) / weight;
  return { score: +score.toFixed(2), parts, missing, weight: +weight.toFixed(2) };
}

// Miroir d'une échelle de VITESSE signée : UP ↔ DOWN, FLAT invariant.
export const MIRROR_SPEED = {
  EXPLOSIVE_UP: "EXPLOSIVE_DOWN", FAST_UP: "FAST_DOWN", SOFT_UP: "SOFT_DOWN",
  FLAT: "FLAT",
  SOFT_DOWN: "SOFT_UP", FAST_DOWN: "FAST_UP", EXPLOSIVE_DOWN: "EXPLOSIVE_UP",
};

// Vérifie qu'une ligne `b` est le miroir exact d'une ligne `a` : b[x] === −a[miroir(x)].
//   Rend la liste des violations (vide = miroir parfait).
//   ⭐ POURQUOI CE CONTRÔLE EXISTE : l'historique du Cycle Expert porte le bug « v2 : EXTREME_HIGH
//   était une COPIE d'EXTREME_LOW au lieu de son miroir ». Deux tables jumelles écrites à la main
//   divergent ; on garde les tables lisibles (1:1 avec le document owner) et on VÉRIFIE l'invariant.
export function mirrorViolations(a, b, mirror = MIRROR_SPEED) {
  const bad = [];
  for (const k of Object.keys(a)) {
    const want = a[mirror[k]] == null ? null : -a[mirror[k]];
    if (b[k] !== want) bad.push({ key: k, got: b[k], want });
  }
  return bad;
}
