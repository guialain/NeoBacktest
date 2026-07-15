// run_universe.mjs — backtest full-univers headless, agrège total R / WR / volume / DD.
// Usage: npx vite-node stats/run_universe.mjs [tag]
import fs from 'fs';
import path from 'path';
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";   // MODE DEV MOTEUR PUR (owner 2026-07-15) : trio OFF par défaut. Mettre NO_TRIO=0 pour trio ON.
import { runMatrixBacktest } from '../src/components/simulations/matrixBacktest.mjs';

const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const tag = process.argv[2] || '';
const files = fs.readdirSync(MATRIX).filter(f => f.toLowerCase().endsWith('.csv')).sort();

let totR = 0, wins = 0, losses = 0, opened = 0, fires = 0;
const perAsset = [];
for (const f of files) {
  const r = runMatrixBacktest(path.join(MATRIX, f), { trans: process.env.NO_TRANS === "1" ? false : undefined });
  const s = r.summary;
  totR += s.totalR || 0; wins += s.wins || 0; losses += s.losses || 0; opened += s.opened || 0; fires += s.fires || 0;
  perAsset.push({ a: r.asset, R: s.totalR, wr: s.winRate, n: s.opened, dd: s.maxDrawdownPct, pf: s.profitFactor });
}
const wr = wins + losses ? (100 * wins / (wins + losses)) : 0;
const avgR = (wins + losses) ? totR / (wins + losses) : 0;

console.log(`\n===================== UNIVERS ${tag} =====================`);
console.log(`  trades: ${wins + losses}  (opened ${opened}, fires ${fires})`);
console.log(`  totalR: ${totR.toFixed(1)}   WR: ${wr.toFixed(1)}%   avgR: ${avgR.toFixed(3)}`);
console.log(`  ------------------------------------------------`);
perAsset.sort((x, y) => (y.R || 0) - (x.R || 0));
console.log(`  ${'asset'.padEnd(12)} ${'R'.padStart(8)} ${'WR%'.padStart(6)} ${'n'.padStart(6)} ${'DD%'.padStart(6)}`);
for (const p of perAsset) console.log(`  ${p.a.padEnd(12)} ${String(p.R).padStart(8)} ${String(p.wr ?? '-').padStart(6)} ${String(p.n).padStart(6)} ${String(p.dd ?? '-').padStart(6)}`);
// ligne machine-lisible pour comparaison
console.log(`\nSUMMARY${tag}\ttrades=${wins + losses}\ttotalR=${totR.toFixed(1)}\tWR=${wr.toFixed(1)}\tavgR=${avgR.toFixed(3)}`);
