// largest_candle_probe.mjs — lecture du dump largest_candle_m5_N8.csv :
//   1) à quoi ressemblent les plus gros largestRatio (validation qualitative) ;
//   2) les 2 axes (concentration = ratio · magnitude = largestBody/ATR) sont-ils indépendants ?
import fs from 'fs';

const rows = fs.readFileSync('C:/Users/Public/Neo-Backtest/stats/data/largest_candle_m5_N8.csv', 'utf8')
  .trim().split(/\r?\n/).slice(1).map(l => {
    const p = l.split(';');
    return { asset: p[0], ts: p[1], ratio: +p[5], dir: +p[6], age: +p[7], lts: p[8], atr: p[9] === '' ? null : +p[9] };
  }).filter(r => r.atr !== null);

// 1) Top 12 ratio — les « spikes » que le concept désigne, à N=8
console.log(`\n=== TOP 12 largestRatio (N=8) — le concept désigne-t-il de VRAIS spikes ? ===`);
console.log(`  ${'asset'.padEnd(11)} ${'bougie s0'.padEnd(17)} ${'ratio'.padStart(6)} ${'dir'.padStart(4)} ${'age'.padStart(4)} ${'body/ATR'.padStart(9)}`);
for (const r of rows.slice().sort((a, b) => b.ratio - a.ratio).slice(0, 12))
  console.log(`  ${r.asset.padEnd(11)} ${r.ts.padEnd(17)} ${r.ratio.toFixed(3).padStart(6)} ${(r.dir > 0 ? 'UP' : 'DOWN').padStart(4)} ${String(r.age).padStart(4)} ${r.atr.toFixed(2).padStart(9)}`);

// 2) Indépendance des 2 axes : magnitude MOYENNE par tranche de ratio.
//    Si le ratio portait déjà la magnitude, body/ATR croîtrait mécaniquement avec lui.
console.log(`\n=== CONCENTRATION vs MAGNITUDE — indépendants ? (N=8) ===`);
console.log(`  tranche ratio   n        body/ATR médian   part body/ATR>2`);
const buckets = [[0, .2], [.2, .3], [.3, .4], [.4, .5], [.5, .6], [.6, .7], [.7, .8], [.8, 1.01]];
for (const [lo, hi] of buckets) {
  const g = rows.filter(r => r.ratio >= lo && r.ratio < hi);
  if (!g.length) continue;
  const s = g.map(r => r.atr).sort((a, b) => a - b);
  const med = s[Math.floor(s.length / 2)];
  const big = g.filter(r => r.atr > 2).length / g.length;
  console.log(`  [${lo.toFixed(2)},${hi.toFixed(2)})  ${String(g.length).padStart(7)}   ${med.toFixed(3).padStart(13)}   ${(100 * big).toFixed(1).padStart(13)}%`);
}

// 3) Corrélation de rang (Spearman) ratio × magnitude
const rank = (arr) => { const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(arr.length); idx.forEach(([, i], k) => (r[i] = k)); return r; };
const rr = rank(rows.map(r => r.ratio)), ra = rank(rows.map(r => r.atr));
const n = rows.length;
const mean = (n - 1) / 2;
let num = 0, d1 = 0, d2 = 0;
for (let i = 0; i < n; i++) { const a = rr[i] - mean, b = ra[i] - mean; num += a * b; d1 += a * a; d2 += b * b; }
console.log(`\n  Spearman(ratio, body/ATR) = ${(num / Math.sqrt(d1 * d2)).toFixed(3)}   (n=${n})`);

// 4) Répartition UP/DOWN dans la queue haute — la règle est directionnelle
const tail = rows.filter(r => r.ratio >= 0.5);
console.log(`\n  queue ratio>=0.50 : n=${tail.length}  UP=${(100 * tail.filter(r => r.dir > 0).length / tail.length).toFixed(1)}%  DOWN=${(100 * tail.filter(r => r.dir < 0).length / tail.length).toFixed(1)}%`);
// 5) Où est la largest dans la fenêtre ? age=0 => spike EN COURS (s0) = le cas qui doit bloquer vite.
const ages = {};
for (const r of tail) ages[r.age] = (ages[r.age] ?? 0) + 1;
console.log(`  age de la largest dans la queue : ` + Object.keys(ages).sort((a, b) => a - b).map(k => `${k}:${(100 * ages[k] / tail.length).toFixed(0)}%`).join('  '));
