// _cont_di_grille.mjs — QUELLE CASE DE LA TABLE `di` PORTE LES PERTES DU RANG ③ ?
//
// 🎯 PREREQUIS NOMME : mesure du 12/08 — la famille `di` est ANTI-CORRELEE cote BUY (pente −0,878).
//   Sa bande la plus BASSE rend 80,1 % / +60,1 R sur 493 tirs ; la plus HAUTE rend 65,2 % / −23,0 R
//   sur 1 473 tirs, soit 56 % du volume. Le decoupage par NOTE dit QUE le signe est inverse ; il ne
//   dit pas si c'est une COLONNE entiere (`WIDENING`) ou une LIGNE (`EXTREME_HIGH`) qui le porte.
//
// ⭐⭐ ON LIT LA CASE, PAS LA NOTE. Deux cases differentes peuvent rendre la meme note (`+10` sort de
//   `HIGH x WIDENING` ET d'`EXTREME_HIGH x STABLE`) : regrouper par note melange des barres qui
//   n'ont rien a voir. `parts.diNiveau` / `parts.diDyn` portent la case exacte depuis le 12/08.
// ⚠ `diNiveau` est le niveau du camp PORTEUR, deja oriente par le cote — pas `DI+` brut.
//
// ⚠⚠ L'INSTANT EST `gapDyn` = LIVE avec repli close (`p0 ?? p1`), et ce n'est PAS neutre : le depot
//   a mesure que les deux lectures concluent l'INVERSE sur `NARROWING` (l'entree ③ du rang ① la
//   traite comme encourageant le fade en live ; close a close elle est deficitaire des DEUX cotes,
//   −3 / −2 pt). Le rang ① lit `gapDynClose` pour son `di` et `gapDyn` pour son `adx`. Le choix fait
//   ici n'a PAS ete dicte. ⇒ cette grille dit ou sont les pertes DANS CETTE LECTURE ; elle ne dit
//   pas si l'autre lecture les deplacerait.
//
// ⚠ WR PAR GRAPPE (sigma x9) · point mort 75,0 % · capacite SATUREE a `MIN_CONT=-11` : les cases peu
//   peuplees sont des SURVIVANTES. ⛔ ON N'EN JETTE AUCUNE — filtrer par effectif retire les queues,
//   qui sont rares PAR CONSTRUCTION. Les effectifs sont affiches partout, le lecteur juge.
//   usage : node stats/_cont_di_grille.mjs   [COTE=BUY|SELL]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "-11";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js";
const { CONT_DI_GRID, CONT_DI_NIVEAUX, CONT_DI_DYN } = await import(M);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const COTE = process.env.COTE ?? "BUY";

let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const T = all.filter((s) => s.strategy === "CONT" && fini(s) && s.side === COTE && s.sc?.boxes?.cont?.parts);
const P = (s) => s.sc.boxes.cont.parts;

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };

console.log(`\n═══ RANG ③ · LA TABLE \`di\` CASE PAR CASE · COTE ${COTE} ═══`);
console.log(`  [MIN_CONT=${process.env.MIN_CONT} · ① et ② a leurs seuils REELS · spread FACTURE · point mort 75,0 %]`);
console.log(`  ${T.length} tirs · lecture \`gapDyn\` = LIVE (repli close) — voir l'en-tete\n`);
if (!T.length) { console.log("  🔴 AUCUN TIR."); process.exit(0); }

const cel = (s) => s ? String(s.n).padStart(6) + s.wrg.toFixed(1).padStart(7) + "%" + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8) : "     —      —       —";
console.log("  niveau (camp porteur) │        NARROWING        │         STABLE          │        WIDENING");
console.log("                        │  tirs   WR/gr       R   │  tirs   WR/gr       R   │  tirs   WR/gr       R");
console.log("  " + "─".repeat(22) + "┼" + "─".repeat(25) + "┼" + "─".repeat(25) + "┼" + "─".repeat(25));
const tot = { NARROWING: [], STABLE: [], WIDENING: [] };
for (const n of CONT_DI_NIVEAUX) {
  const l = CONT_DI_DYN.map((d) => {
    const g = T.filter((s) => P(s).diNiveau === n && P(s).diDyn === d);
    tot[d].push(...g);
    return cel(st(g)) + `  (${String(CONT_DI_GRID[n][d]).padStart(3)})`;
  });
  console.log("  " + n.padEnd(21) + " │" + l.join(" │"));
}
console.log("  " + "─".repeat(22) + "┼" + "─".repeat(25) + "┼" + "─".repeat(25) + "┼" + "─".repeat(25));
console.log("  " + "TOTAL colonne".padEnd(21) + " │" + CONT_DI_DYN.map((d) => cel(st(tot[d])) + "       ").join(" │"));
// ⭐ Et la meme chose par LIGNE : une anti-correlation portee par une LIGNE (le niveau) et une portee
//   par une COLONNE (la dynamique) ne se corrigent pas au meme endroit.
console.log("\n  ── TOTAL par LIGNE ──");
for (const n of CONT_DI_NIVEAUX) {
  const s = st(T.filter((x) => P(x).diNiveau === n));
  console.log("  " + n.padEnd(16) + (s ? String(s.n).padStart(6) + " tirs " + String(s.gr).padStart(4) + " grap " + s.wrg.toFixed(1).padStart(7) + "%   R " + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8) : "     — "));
}
const muet = T.filter((x) => P(x).diNiveau == null || P(x).diDyn == null).length;
console.log(`\n  cases muettes (niveau ou dynamique absent) : ${muet} (${(100 * muet / T.length).toFixed(2)} %)`);
console.log("  ⚠ Aucune case n'est ecartee pour faible effectif — les queues sont rares PAR CONSTRUCTION.");
console.log("  ⚠ La note dictee est entre parentheses apres chaque case.\n");
