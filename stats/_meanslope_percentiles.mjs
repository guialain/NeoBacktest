// _meanslope_percentiles.mjs — LES VRAIS PERCENTILES DE `|meanSlope|`, PAR ACTIF (owner 16/08).
//
// 🎯 PREREQUIS NOMME : `cont-mean-flat` coupe `FLAT = |meanSlope| < dMean[0]`, et `dMean[0]` est
//   annonce comme le **p30** de l'actif. L'owner veut essayer **p20 / p25** — retrecir la bande.
//   Avant de recalibrer quoi que ce soit, deux choses :
//     ① les p20 / p25 / p30 REELS, par actif ;
//     ② un CONTROLE : le p30 mesure coincide-t-il avec `DEVIATION_BANDS[sym].dMean[0]` stocke ?
//        Si non, la bande annoncee n'est pas celle qui tourne — et tout ce qu'on a lu de ce veto
//        depuis le 13/08 porte sur une population differente de celle qu'on croit.
//
// ⚠⚠ `meanSlope` SE MESURE DE CLOTURE A CLOTURE (`middle_h1_s1`), et le depot a une limite connue :
//   apres un week-end la barre precedente n'est PAS contigue et la valeur monte jusqu'a 36x le P99.
//   ⭐ Ces valeurs tombent en `EXPLOSIVE_*`, donc HORS de `FLAT` — elles ne polluent pas le veto,
//   mais elles POLLUENT UN PERCENTILE calcule sur toute la distribution. ⇒ on imprime les deux :
//   avec et sans ecretage, pour que le choix du barreau ne repose pas sur des artefacts de coupure.
// ⚠ Lignes MORTES exclues (panne broker). ⚠ Population = TOUTES les barres, pas le residu du ③ :
//   les bandes `dMean` sont une propriete de l'ACTIF, pas d'un rang.
//   usage : node stats/_meanslope_percentiles.mjs
import fs from "fs"; import path from "path";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, getDeviationBands } = await import(R);

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const MORT = 5;
const CH = ["timestamp", "symbol", "price", "zscore_h1_s0", "sigma_h1", "middle_h1_s1", "close_h1_s1"];
const q = (a, p) => { const i = Math.min(a.length - 1, Math.floor(p * a.length)); return a[i]; };
const lignes = [];
let nTot = 0, nMuet = 0;

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const ix = {}; for (const n of CH) ix[n] = head.indexOf(n);
  const manq = CH.filter((n) => ix[n] < 0); if (manq.length) throw new Error(`${a} : ${manq.join(", ")}`);
  const vals = [];
  let prevT = null, dernT = null;
  const nPar = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); nPar.set(c[ix.timestamp], (nPar.get(c[ix.timestamp]) ?? 0) + 1); }
  const gele = new Set([...nPar].filter(([, n]) => n >= MORT).map(([t]) => t));
  for (const l of L.slice(1)) {
    const c = l.split(";"); if (gele.has(c[ix.timestamp])) continue;
    const row = {}; for (const n of CH) row[n] = c[ix[n]];
    nTot++;
    const d = computeDeviation(row, a, "h1");
    if (!Number.isFinite(d?.meanSlope)) { nMuet++; continue; }
    vals.push(Math.abs(d.meanSlope));
  }
  vals.sort((x, y) => x - y);
  // ⭐ ECRETAGE au p99,5 : on retire la queue des barres MAL APPARIEES (week-end), pas des barres
  //   volatiles. Un percentile BAS (p20-p30) y est de toute facon insensible — l'impression des deux
  //   colonnes sert justement a le VERIFIER plutot qu'a le supposer.
  const clip = vals.slice(0, Math.floor(vals.length * 0.995));
  lignes.push({ a, n: vals.length, p20: q(vals, 0.20), p25: q(vals, 0.25), p30: q(vals, 0.30),
                c20: q(clip, 0.20), c25: q(clip, 0.25), c30: q(clip, 0.30),
                stock: getDeviationBands(a)?.dMean?.[0] ?? null });
}

console.log(`\n══ |meanSlope| — PERCENTILES RÉELS PAR ACTIF ══  ${nTot} lignes · ${nMuet} sans pente\n`);
console.log("  " + "actif".padEnd(12) + "n".padStart(7) + "p20".padStart(9) + "p25".padStart(9) + "p30".padStart(9)
  + "  │" + "dMean[0]".padStart(10) + "  écart p30/stocké".padStart(20));
console.log("  " + "─".repeat(80));
let som = 0, cnt = 0;
for (const r of lignes) {
  const ec = (r.stock && r.stock > 0) ? (100 * (r.p30 - r.stock) / r.stock) : null;
  if (ec !== null) { som += Math.abs(ec); cnt++; }
  console.log("  " + r.a.padEnd(12) + String(r.n).padStart(7)
    + r.p20.toFixed(4).padStart(9) + r.p25.toFixed(4).padStart(9) + r.p30.toFixed(4).padStart(9)
    + "  │" + (r.stock == null ? "—" : r.stock.toFixed(4)).padStart(10)
    + (ec === null ? "—" : ((ec >= 0 ? "+" : "") + ec.toFixed(1) + " %")).padStart(20)
    + (ec !== null && Math.abs(ec) > 15 ? "  🔴" : ""));
}
console.log("  " + "─".repeat(80));
console.log(`  ⭐ écart ABSOLU moyen p30 mesuré vs \`dMean[0]\` stocké : ${(som / cnt).toFixed(1)} %`);
console.log(`\n  ⚠ Le p30 STOCKÉ est ce qui TOURNE. S'il diverge du p30 mesuré, la bande \`FLAT\` ne`);
console.log(`     couvre pas 30 % mais autre chose — et c'est ce « autre chose » qu'on a mesuré depuis le 13/08.`);
console.log(`\n  ── RAPPORTS p20/p30 et p25/p30 (de combien la bande se resserre) ──`);
const r20 = lignes.map((r) => r.p20 / r.p30), r25 = lignes.map((r) => r.p25 / r.p30);
const moy = (x) => x.reduce((s, v) => s + v, 0) / x.length;
console.log(`     p20/p30 : min ${Math.min(...r20).toFixed(3)} · moy ${moy(r20).toFixed(3)} · max ${Math.max(...r20).toFixed(3)}`);
console.log(`     p25/p30 : min ${Math.min(...r25).toFixed(3)} · moy ${moy(r25).toFixed(3)} · max ${Math.max(...r25).toFixed(3)}\n`);
