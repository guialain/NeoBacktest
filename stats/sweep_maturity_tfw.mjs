// sweep_maturity_tfw.mjs — sweep des poids MATURITY_TFW (expert Cycle).
//   MATURITY_TFW est le SEUL TFW du moteur jamais recalibré, et il porte le H4 le plus lourd (0.35),
//   alors que VECTOR_TFW_DIR est passé à 0.10 (14/07, +118 R, « H4 doit être BAS ») et CONTACT_TFW à 0.20.
//   Même protocole que sweep_tfw.mjs : env → run_universe → parse SUMMARY. Le moteur renormalise
//   (score = Σw·frac / Σw), donc seuls les RATIOS comptent.
import { execSync } from 'child_process';

const COMBOS = [
  { h1: 0.45, h4: 0.35, m15: 0.20 },  // ACTUEL (repère)
  { h1: 0.50, h4: 0.30, m15: 0.20 },  // = ZONE_TFW
  { h1: 0.50, h4: 0.20, m15: 0.30 },
  { h1: 0.45, h4: 0.20, m15: 0.35 },  // = CONTACT_TFW
  { h1: 0.50, h4: 0.10, m15: 0.40 },  // = VECTOR_TFW_DIR (le recalibré gagnant)
  { h1: 0.55, h4: 0.10, m15: 0.35 },
  { h1: 0.60, h4: 0.10, m15: 0.30 },
  { h1: 0.60, h4: 0.00, m15: 0.40 },  // H4 RETIRÉ
  { h1: 0.50, h4: 0.00, m15: 0.50 },
  { h1: 0.70, h4: 0.00, m15: 0.30 },
  { h1: 0.30, h4: 0.50, m15: 0.20 },  // contre-épreuve : H4-lourd (doit être MAUVAIS si la thèse tient)
];

const results = [];
for (const c of COMBOS) {
  const env = { ...process.env, MATURITY_TFW: JSON.stringify(c), NO_TRIGGER: '1' };
  let out = '';
  try { out = execSync('npx vite-node stats/run_universe.mjs MATSWEEP', { cwd: 'C:/Users/Public/Neo-Backtest', env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { out = e.stdout || ''; }
  const m = /SUMMARY\w*\ttrades=(\d+)\ttotalR=([-\d.]+)\tWR=([\d.]+)\tavgR=([-\d.]+)/.exec(out);
  const r = m ? { trades: +m[1], totalR: +m[2], WR: +m[3], avgR: +m[4] } : { trades: '?', totalR: NaN, WR: NaN, avgR: NaN };
  results.push({ c, ...r });
  const cur = (c.h1 === 0.45 && c.h4 === 0.35) ? '  ← ACTUEL' : '';
  console.log(`  h1=${c.h1.toFixed(2)} h4=${c.h4.toFixed(2)} m15=${c.m15.toFixed(2)}  →  totalR=${String(r.totalR).padStart(7)}  WR=${r.WR}%  trades=${r.trades}  avgR=${r.avgR}${cur}`);
}
console.log('\n=== CLASSEMENT (totalR) ===');
for (const r of [...results].sort((a, b) => (b.totalR || -1e9) - (a.totalR || -1e9)))
  console.log(`  ${String(r.totalR).padStart(7)}  WR ${r.WR}%  avgR ${r.avgR}  trades ${r.trades}   h1=${r.c.h1} h4=${r.c.h4} m15=${r.c.m15}${r.c.h1 === 0.45 && r.c.h4 === 0.35 ? '  ← ACTUEL' : ''}`);
console.log('\n=== effet du POIDS H4 seul (h1/m15 au ratio courant) ===');
for (const r of [...results].sort((a, b) => a.c.h4 - b.c.h4)) console.log(`  h4=${r.c.h4.toFixed(2)}  totalR=${String(r.totalR).padStart(7)}  avgR=${r.avgR}  (h1=${r.c.h1} m15=${r.c.m15})`);
