// spike_engine_calib.mjs — recalibration de SPIKE_K / SPIKE_COOLDOWN sur le MOTEUR RÉEL.
// ============================================================================================
//   ⚠ POURQUOI : K=1.75 avait été calibré sur l'étude, qui reconstruisait le M5 depuis data/ohlc M1 avec
//   un ATR = MOYENNE SIMPLE des 14 TR. Le moteur, lui, lit `atr_m5_s2` = **iATR Wilder** (lissage
//   exponentiel, pas une moyenne). Dénominateur différent ⇒ échelle différente ⇒ le coefficient n'est plus
//   au centre de son plateau. On rebalaie sur le vrai capteur, celui que la prod utilisera.
//
// Usage : npx vite-node stats/spike_engine_calib.mjs
// ============================================================================================
import fs from 'fs';
import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest } from '../src/components/simulations/matrixBacktest.mjs';

const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const files = fs.readdirSync(MATRIX).filter(f => f.toLowerCase().endsWith('.csv')).sort();

function run(opts) {
  let totR = 0, n = 0, wins = 0;
  for (const f of files) {
    const r = runMatrixBacktest(path.join(MATRIX, f), opts);
    totR += r.summary.totalR || 0; wins += r.summary.wins || 0;
    n += (r.summary.wins || 0) + (r.summary.losses || 0);
  }
  return { totR, n, wr: 100 * wins / n };
}
const show = (tag, r, base) => console.log(`  ${tag.padEnd(24)} trades=${String(r.n).padStart(6)}  totalR=${r.totR.toFixed(1).padStart(7)}  WR=${r.wr.toFixed(1)}%  avgR=${(r.totR / r.n).toFixed(3)}`
  + (base ? `   Δ R=${(r.totR - base.totR >= 0 ? '+' : '') + (r.totR - base.totR).toFixed(1)}  Δ tr=${r.n - base.n}` : ''));

const base = run({ spike: false });
console.log(`\n===== CALIBRATION sur le MOTEUR (atr_m5_s2 = iATR Wilder) =====`);
show('BASELINE (spike OFF)', base, null);

console.log(`\n  — coefficient K (cooldown 45) —`);
for (const k of [1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 3.0])
  show(`K=${k}`, run({ spikeK: k, spikeCooldown: 45 }), base);

console.log(`\n  — cooldown (au meilleur K trouvé ci-dessus, à ajuster si besoin) —`);
for (const cd of [15, 30, 45, 60, 90])
  show(`cooldown=${cd}min`, run({ spikeK: 1.75, spikeCooldown: cd }), base);
