// sweep_h4_impulse.mjs — le poids H4 dans l'IMPULSE (VECTOR_TFW_DIR) biaise-t-il le signal ?
//   Constat owner 16/07 : (k−d) h4 bouge de 0.95 en 10 min quand m15 bouge de 3.85 → H4 injecte un
//   quasi-CONSTANT (+20 × 0.10 = +2 sur un score de +7.7 = 26 % du signal) sans information fraîche.
//   ⚠ Le calibrage {h1:.50,h4:.10,m15:.40} date du 14/07 — AVANT l'antispike, le veto impulse et la
//   transition portée. À refaire sur le moteur d'aujourd'hui.
import { execSync } from 'child_process';
const COMBOS = [
  { h1: 0.50, h4: 0.10, m15: 0.40 },  // ACTUEL
  { h1: 0.55, h4: 0.00, m15: 0.45 },  // H4 retiré, ratio h1/m15 conservé
  { h1: 0.50, h4: 0.00, m15: 0.50 },
  { h1: 0.60, h4: 0.00, m15: 0.40 },
  { h1: 0.65, h4: 0.00, m15: 0.35 },
  { h1: 0.50, h4: 0.05, m15: 0.45 },
  { h1: 0.50, h4: 0.20, m15: 0.30 },  // contre-épreuve : PLUS de H4
  { h1: 0.40, h4: 0.30, m15: 0.30 },  // contre-épreuve : beaucoup plus
];
const out = [];
for (const c of COMBOS) {
  let o = '';
  try { o = execSync('npx vite-node stats/run_universe.mjs H4SWEEP', { cwd: 'C:/Users/Public/Neo-Backtest', env: { ...process.env, TFW_DIR: JSON.stringify(c), NO_TRIGGER: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { o = e.stdout || ''; }
  const m = /SUMMARY\w*\ttrades=(\d+)\ttotalR=([-\d.]+)\tWR=([\d.]+)\tavgR=([-\d.]+)/.exec(o);
  const r = m ? { trades: +m[1], totalR: +m[2], WR: +m[3], avgR: +m[4] } : { totalR: NaN };
  out.push({ c, ...r });
  console.log(`  h1=${c.h1.toFixed(2)} h4=${c.h4.toFixed(2)} m15=${c.m15.toFixed(2)}  →  totalR=${String(r.totalR).padStart(7)}  WR=${r.WR}%  avgR=${r.avgR}  trades=${r.trades}${c.h4 === 0.10 && c.h1 === 0.50 ? '  ← ACTUEL' : ''}`);
}
console.log('\n=== CLASSEMENT ===');
for (const r of [...out].sort((a, b) => (b.totalR || -1e9) - (a.totalR || -1e9)))
  console.log(`  ${String(r.totalR).padStart(7)}  WR ${r.WR}%  avgR ${r.avgR}   h1=${r.c.h1} h4=${r.c.h4} m15=${r.c.m15}${r.c.h4 === 0.10 && r.c.h1 === 0.50 ? '  ← ACTUEL' : ''}`);
