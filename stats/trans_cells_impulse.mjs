// trans_cells_impulse.mjs — la table de transition ignore l'IMPULSE. Est-ce que ça coûte ?
//   « Exhaustion → Strong Bear » fire BUY que le prix monte encore OU qu'il tombe encore (owner 16/07).
import fs from 'fs'; import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest } from '../src/components/simulations/matrixBacktest.mjs';
const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const cell = {};
for (const f of fs.readdirSync(MATRIX).filter(x => x.toLowerCase().endsWith('.csv'))) {
  for (const s of (runMatrixBacktest(path.join(MATRIX, f)).signals || [])) {
    if (s.type !== 'TRANS' || typeof s.R !== 'number') continue;
    const k = `${s.trans?.from ?? '?'} → ${s.trans?.to ?? '?'}`;
    const imp = s.impulse ?? '?';
    ((cell[k] ??= {})[imp] ??= { n: 0, R: 0, w: 0, side: s.side });
    cell[k][imp].n++; cell[k][imp].R += s.R; if (s.outcome === 'WIN') cell[k][imp].w++;
  }
}
const ORDER = ['FAST_UP', 'UP', 'FLAT', 'DOWN', 'FAST_DOWN', '?'];
for (const k of Object.keys(cell)) {
  const tot = Object.values(cell[k]).reduce((a, v) => a + v.R, 0);
  const side = Object.values(cell[k])[0].side;
  console.log(`\n  ${k}   [${side}]   total ${tot.toFixed(1)} R`);
  console.log(`    ${'impulse'.padEnd(11)} ${'n'.padStart(6)} ${'totalR'.padStart(8)} ${'avgR'.padStart(7)} ${'WR'.padStart(6)}`);
  for (const imp of ORDER) {
    const v = cell[k][imp]; if (!v) continue;
    const flag = ((side === 'BUY' && imp.includes('DOWN')) || (side === 'SELL' && imp.includes('UP'))) ? '  ← À CONTRESENS' : '';
    console.log(`    ${imp.padEnd(11)} ${String(v.n).padStart(6)} ${v.R.toFixed(1).padStart(8)} ${(v.R / v.n).toFixed(3).padStart(7)} ${(100 * v.w / v.n).toFixed(1).padStart(5)}%${flag}`);
  }
}
