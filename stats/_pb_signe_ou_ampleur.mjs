// _pb_signe_ou_ampleur.mjs — LE SCORE PB TRIE-T-IL PAR LE SIGNE, OU PAR L'AMPLEUR ?
//
// ⭐⭐⭐ NE PART PAS D'UNE INTUITION : `_pb_wr_par_score` a rendu un Spearman de −0,015 entre la note
//   ORIENTEE et le WR/grappe. « Ne trie pas » serait la conclusion PARESSEUSE — une correlation nulle
//   est aussi ce que rend une courbe en U parfaite. On teste donc les DEUX lectures sur la MEME
//   population, dans le MEME run.
// ⚠ `conviction` est ORIENTEE (`orient(v, side)` rend `−v` pour un SELL) ⇒ positif = « bon PB de son
//   cote ». Si le bareme dit vrai, seule la queue POSITIVE doit payer. Si c'est |note| qui trie, les
//   DEUX queues paient — et le bareme mesurerait une INTENSITE en croyant mesurer un SENS.
// ⚠ Une voix par grappe actif×jour, toujours — les tirs ne sont pas independants (sigma gonfle x9).
// ⚠ `PB_ISOLE=1` ⇒ la regle `exh-present-empeche` est INERTE ici (elle porte `&& !_PB_ISOLE`). C'est
//   voulu : on mesure le BAREME seul, pas le routage.
// ⚠ Point mort 75,0 % (spread facture) — un WR sous cette barre est une PERTE, pas une petite marge.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.PB_ISOLE = "1";
process.env.MIN_PB = process.env.MIN_PB ?? "-21";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = s => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = s => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const conv = s => s.sc?.boxes?.pb?.conviction;
const PB = all.filter(s => s.strategy === "PB" && fini(s) && Number.isFinite(conv(s)));
const BE = 75;

// ⭐ WR/grappe = moyenne des WR par grappe, PAS le WR global : une grappe = une voix.
const st = t => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           bas: v.filter(o => o.w / o.n < BE / 100).length, R }; };
const ligne = (lbl, t) => { const s = st(t);
  if (!s) { console.log("  " + lbl.padEnd(22) + "      —"); return; }
  console.log("  " + lbl.padEnd(22) + String(s.n).padStart(6) + String(s.gr).padStart(6)
    + s.wrg.toFixed(1).padStart(9) + "%" + String(s.bas).padStart(6)
    + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) + (s.R / s.n).toFixed(3).padStart(8)); };

console.log(`\n═══ PB · LE SIGNE OU L'AMPLEUR ? ═══  [PB_ISOLE=1 · MIN_PB=${process.env.MIN_PB} · spread FACTURE]`);
console.log(`  ${PB.length} tirs PB · point mort 75,0 %\n`);
const H = "  " + "bande".padEnd(22) + "  tirs".padStart(4) + "  grap".padStart(6) + "  WR/grap".padStart(10) + "   <BE" + "        R" + "   R/tir";
console.log("  ── ① LECTURE ORIENTEE (ce que le bareme PRETEND mesurer : positif = bon) ──");
console.log(H);
const B1 = [["note <= −14", s => conv(s) <= -14], ["note −13..−8", s => conv(s) <= -8 && conv(s) > -14],
            ["note −7..+2",  s => conv(s) >= -7 && conv(s) <= 2], ["note +3..+10", s => conv(s) >= 3 && conv(s) <= 10],
            ["note >= +11", s => conv(s) >= 11]];
for (const [l, f] of B1) ligne(l, PB.filter(f));

console.log("\n  ── ② LECTURE PAR AMPLEUR |note| (le bareme mesure-t-il une INTENSITE ?) ──");
console.log(H);
for (const [lo, hi] of [[0, 2], [3, 7], [8, 12], [13, 20]])
  ligne(`|note| ${lo}-${hi}`, PB.filter(s => Math.abs(conv(s)) >= lo && Math.abs(conv(s)) <= hi));

console.log("\n  ── ③ LA MEME AMPLEUR, LES DEUX SIGNES (le signe ajoute-t-il QUELQUE CHOSE ?) ──");
console.log(H);
for (const [lo, hi] of [[3, 7], [8, 12], [13, 20]]) {
  ligne(`|note| ${lo}-${hi} · NEG`, PB.filter(s => conv(s) <= -lo && conv(s) >= -hi));
  ligne(`|note| ${lo}-${hi} · POS`, PB.filter(s => conv(s) >= lo && conv(s) <= hi));
}
console.log("\n  ⭐ Si ② trie et que les deux lignes de ③ se ressemblent a chaque ampleur, le bareme");
console.log("     mesure une INTENSITE et le SIGNE qu'il porte est du bruit — donc `MIN_PB` sur la");
console.log("     note orientee couperait la MAUVAISE moitie.\n");
