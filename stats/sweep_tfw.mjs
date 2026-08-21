// sweep_tfw.mjs — sweep des poids VECTOR_TFW_DIR (direction/impulse) sous la logique COURANTE.
//   Pour chaque combo, lance run_universe avec TFW_DIR en env, parse la ligne SUMMARY.
import { execSync } from 'child_process';

// combos (h1, h4, m15) — le moteur renormalise (score = Σw·kd/Σw), seuls les ratios comptent.
const COMBOS = [
  { h1: 0.70, h4: 0.00, m15: 0.30 },
  { h1: 0.65, h4: 0.00, m15: 0.35 },
  { h1: 0.60, h4: 0.00, m15: 0.40 },
  { h1: 0.55, h4: 0.00, m15: 0.45 },
  { h1: 0.50, h4: 0.00, m15: 0.50 },
  { h1: 0.50, h4: 0.10, m15: 0.40 },  // ACTUEL (repère)
];

const results = [];
for (const c of COMBOS) {
  const env = { ...process.env, TFW_DIR: JSON.stringify(c) };
  let out = '';
  try { out = execSync('npx vite-node stats/run_universe.mjs SWEEP', { cwd: 'C:/Users/Public/Neo-Backtest', env, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }); }
  catch (e) { out = e.stdout || ''; }
  const m = /SUMMARY\w*\ttrades=(\d+)\ttotalR=([-\d.]+)\tWR=([\d.]+)\tavgR=([-\d.]+)/.exec(out);
  const r = m ? { trades:+m[1], totalR:+m[2], WR:+m[3], avgR:+m[4] } : { trades:'?', totalR:NaN };
  results.push({ c, ...r });
  console.log(`h1=${c.h1} h4=${c.h4} m15=${c.m15}  →  totalR=${r.totalR}  WR=${r.WR}%  trades=${r.trades}  avgR=${r.avgR}`);
}
results.sort((a,b)=>(b.totalR||-1e9)-(a.totalR||-1e9));
console.log('\n=== CLASSEMENT (totalR) ===');
for (const r of results) console.log(`  ${r.totalR}\tWR ${r.WR}%\th1=${r.c.h1} h4=${r.c.h4} m15=${r.c.m15}${r.c.h1===0.50&&r.c.h4===0.10&&r.c.m15===0.40?'  ← ACTUEL':''}`);
