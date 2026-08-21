// trans_cells.mjs — R par CELLULE de la table de transition (S1 → S0).
import fs from 'fs'; import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest } from '../src/components/simulations/matrixBacktest.mjs';
const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const cell = {};
for (const f of fs.readdirSync(MATRIX).filter(x => x.toLowerCase().endsWith('.csv'))) {
  for (const s of (runMatrixBacktest(path.join(MATRIX, f)).signals || [])) {
    if (s.type !== 'TRANS' || typeof s.R !== 'number') continue;
    const k = `${s.trans?.from ?? '?'} → ${s.trans?.to ?? '?'}`;
    (cell[k] ??= { n: 0, R: 0, w: 0, side: s.side });
    cell[k].n++; cell[k].R += s.R; if (s.outcome === 'WIN') cell[k].w++;
  }
}
const rows = Object.entries(cell).sort((a, b) => b[1].R - a[1].R);
console.log(`\n  ${'cellule S1 → S0'.padEnd(34)} ${'côté'.padEnd(5)} ${'n'.padStart(6)} ${'totalR'.padStart(9)} ${'avgR'.padStart(7)} ${'WR'.padStart(6)}`);
let tn = 0, tr = 0;
for (const [k, v] of rows) {
  tn += v.n; tr += v.R;
  console.log(`  ${k.padEnd(34)} ${v.side.padEnd(5)} ${String(v.n).padStart(6)} ${v.R.toFixed(1).padStart(9)} ${(v.R / v.n).toFixed(3).padStart(7)} ${(100 * v.w / v.n).toFixed(1).padStart(5)}%`);
}
console.log(`  ${''.padEnd(34)} ${''.padEnd(5)} ${String(tn).padStart(6)} ${tr.toFixed(1).padStart(9)} ${(tr / tn).toFixed(3).padStart(7)}   ← TOTAL transition`);
