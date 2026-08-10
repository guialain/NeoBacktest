// _exh_di_grille.mjs — LA GRILLE DE L'ENTRÉE ② : NIVEAU DU CAMP **FADÉ** × Δ|écart| DI (c2 → c1).
//   Owner 09/08 : « corrige le barème alors ». Pour écrire une table il faut la GRILLE, pas une case.
//
// 🔴🔥 POURQUOI CETTE GRILLE PLUTÔT QUE L'ACTUELLE. L'entrée ② lit aujourd'hui `diGapBand` — la
//   bande SIGNÉE de l'écart. Mesuré le 09/08 : elle est quasi CONSTANTE sur la population EXH
//   (« le camp fadé mène fortement » = 87 % des SELL, 92 % des BUY) parce que **le routeur a déjà
//   sélectionné les barres où un camp domine**. Une entrée dont 90 % de la population tombe dans une
//   seule ligne ne trie rien : elle ajoute une constante au score.
//   ⇒ Ce qui reste à dire une fois le camp connu, c'est **jusqu'où** il domine (niveau) et **si sa
//   prise se creuse** (Δ|écart|). Deux axes qui se répartissent, là où la bande n'en avait qu'un.
//
// ⭐⭐ ORIENTATION — LE CAMP **FADÉ**, PAS UN CAMP FIXE. Un EXH SELL fade un sommet : le camp qui
//   pousse est celui des ACHETEURS (`DI+`). Un EXH BUY fade un creux : c'est `DI−`. Une fois orienté
//   ainsi, `niveauFadé` est LA MÊME grandeur des deux côtés — comme `kdDist` — et **une seule table
//   suffit**. Lire `DI+` en dur aurait décrit un seul côté, en silence.
// ⭐ `Δ|écart|` est une DISTANCE : elle n'a pas de côté non plus. Rien ne se réfléchit dans cette
//   grille, d'où une table unique et un miroir trivialement tenu.
//
// 🔴 `diGapDynCloseH1` ET NON `diGapDynH1` : ce dernier vaut `live ?? closes` et mélange deux
//   horloges. Les DI perdent 13,3 % à chaque ouverture de bougie ⇒ tout résultat lu sur `s0−c1` est
//   à refaire close à close (`delta_di_decroissance_inerte`). Ici : `c2 → c1`, la lecture du moteur.
//
// ⚠ SOCLE PAR DÉFAUT — **c'est la seule population qui juge un barème** : la prod ne contient que
//   les barres qui ont DÉJÀ passé le barème, donc y calibrer une entrée revient à mesurer ce que le
//   barème a laissé, pas ce que la figure vaut. (`v3_tout_admettre`, et l'inversion mesurée ce soir :
//   la même case vaut 69,1 %/gr en socle et 85,9 % en prod.)
// ⚠ ÉPISODES + une voix par grappe. Point mort 75,0 %.
//
//   usage : node stats/_exh_di_grille.mjs        ·   SOCLE=0 node … (pour voir la prod)
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const SOCLE = String(process.env.SOCLE ?? "1") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const OPTS = SOCLE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), OPTS).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const ep = dedupeEpisodes(all.filter((s) => s.strategy === "EXH"))
  .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
const grp = (t) => {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN;
};
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const somR = (t) => t.reduce((a, b) => a + (b.R || 0), 0);

// ⭐ LE NIVEAU DU CAMP FADÉ — SELL fade les acheteurs (`DI+`), BUY fade les vendeurs (`DI−`).
const nivFade = (s) => (s.side === "SELL" ? s.diPlusLevelH1 : s.diMinusLevelH1);
const dyn = (s) => s.diGapDynCloseH1;

const NIV = ["EXTREME_HIGH", "HIGH", "MEDIUM", "LOW", "EXTREME_LOW"];
const DYN = ["NARROWING", "STABLE", "WIDENING"];

const cell = (t, ref) => {
  if (!t.length) return "      —              ";
  const g = grp(t), d = g - ref;
  return `${String(t.length).padStart(3)}ép ${g.toFixed(0).padStart(3)}%g ${(d >= 0 ? "+" : "") + d.toFixed(0).padStart(3)} R${(somR(t) >= 0 ? "+" : "") + somR(t).toFixed(0).padStart(4)}`;
};

console.log(`\n═══ ENTRÉE ② — NIVEAU DU CAMP FADÉ × Δ|écart| (c2→c1) · ${SOCLE ? "SOCLE" : "PROD"} · point mort 75,0 % ═══`);
console.log(`    cases : n épisodes · WR/grappe · ÉCART à la réf du côté · R`);

for (const cote of ["SELL", "BUY", "LES DEUX"]) {
  const pop = cote === "LES DEUX" ? ep : ep.filter((s) => s.side === cote);
  const ref = grp(pop);
  console.log(`\n  ══ EXH ${cote} · ${pop.length} ép · ${wr(pop).toFixed(1)} % · réf ${ref.toFixed(1)} %/gr · R ${somR(pop).toFixed(1)}`);
  console.log("  camp fadé      │ " + DYN.map((d) => d.padEnd(21)).join("│ ") + "│ toute la ligne");
  for (const n of NIV) {
    const L = pop.filter((s) => nivFade(s) === n);
    if (!L.length) continue;
    console.log(`  ${n.padEnd(14)} │ ` + DYN.map((d) => cell(L.filter((s) => dyn(s) === d), ref)).join("│ ") + `│ ${cell(L, ref)}`);
  }
  console.log(`  ${"toute la col".padEnd(14)} │ ` + DYN.map((d) => cell(pop.filter((s) => dyn(s) === d), ref)).join("│ ") + `│ ${cell(pop, ref)}`);
  const muet = pop.filter((s) => nivFade(s) == null || dyn(s) == null);
  if (muet.length) console.log(`  ⚠ MUET (niveau ou dynamique absent) : ${muet.length} ép`);
}
