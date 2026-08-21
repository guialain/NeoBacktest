// dtheta_spike_replay.mjs — SPIKE via Δtheta(5min) au lieu de corps/ATR (owner 2026-07-16).
// ============================================================================================
// Motif : l'ATR(14) M5 est une moyenne GLISSANTE — elle avale le spike dès la barre suivante, donc le
//   dénominateur bouge avec le numérateur. theta, lui, se normalise par INTRADAY_CONFIG.p50 = constante
//   STATIQUE par actif → pas d'auto-référence.
//
// Δtheta(5min) = thetaDayDeg(t) − thetaDayDeg(t−5min), reconstruit depuis le CSV matrix (~1 row/min).
//   theta = atan((intraday_change / p50) / frac_jour) — SSOT ThetaConfig.computeThetaVector.
//   ⚠ null avant 1h30 de séance (THETA_EARLY_H) → aucune détection en début de journée.
//   ⚠ sensibilité ∝ 1/frac : le même mouvement pèse ~2× moins à 12h qu'à 6h (atan sature en plus).
//
// Règle testée = celle qui a gagné avec l'ATR : spike de sens D ⇒ on ne trade PAS CONTRE D pendant 30 min
//   (ancré sur l'horodatage du spike). Seuil = PERCENTILE de |Δtheta5| (calibré ici, pas codé en dur).
//
// Usage : npx vite-node stats/dtheta_spike_replay.mjs [COOLDOWN_min]
// ============================================================================================
import fs from 'fs';
import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest, loadCsvRows } from '../src/components/simulations/matrixBacktest.mjs';
import { computeThetaVector } from '../../Matrix-Revolution/src/components/robot/engines/config/ThetaConfig.js';

const COOLDOWN = Number(process.argv[2] || 30);
const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const LAG = 5;   // minutes

const mtMin = (ts) => { const m = String(ts).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };
const pct = (s, p) => { if (!s.length) return null; const r = (p / 100) * (s.length - 1), lo = Math.floor(r), hi = Math.ceil(r); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (r - lo); };

const files = fs.readdirSync(MATRIX).filter(f => f.toLowerCase().endsWith('.csv')).sort();
const assets = files.map(f => f.replace(/\.csv$/i, ''));

// ── Δtheta(5min) par actif ────────────────────────────────────────────────────────────────────
const SERIES = {};       // asset → [{ ep, dth }]  (dth = Δtheta 5 min, signé)
const allAbs = [];
for (const a of assets) {
  const rows = loadCsvRows(path.join(MATRIX, `${a}.csv`));
  const pts = [];
  for (const r of rows) {
    const ep = mtMin(r.timestamp);
    const tv = computeThetaVector(r, a);
    if (ep == null || tv.thetaDayDeg == null) continue;    // sessionEarly / ic absent → pas de theta
    pts.push({ ep, th: tv.thetaDayDeg });
  }
  pts.sort((x, y) => x.ep - y.ep);
  // Δ vs le point le plus proche de t−5min (tolérance ±1 min : le scan n'est pas parfaitement régulier).
  const out = [];
  let j = 0;
  for (let i = 0; i < pts.length; i++) {
    const target = pts[i].ep - LAG;
    while (j < i && pts[j].ep < target - 1) j++;
    const p = pts[j];
    if (!p || Math.abs(p.ep - target) > 1 || p.ep >= pts[i].ep) continue;
    const dth = pts[i].th - p.th;
    out.push({ ep: pts[i].ep, dth });
    allAbs.push(Math.abs(dth));
  }
  SERIES[a] = out;
}

// ── 1) CALIBRATION : percentiles de |Δtheta5| sur l'univers ───────────────────────────────────
const sorted = allAbs.slice().sort((x, y) => x - y);
console.log(`\n===== |Δtheta(${LAG}min)| — distribution univers (${sorted.length} points, ${assets.length} actifs) =====`);
const PS = [50, 75, 90, 95, 97, 98, 99, 99.5, 99.9];
console.log(`  ` + PS.map(p => `P${p}`.padStart(8)).join('') );
console.log(`  ` + PS.map(p => pct(sorted, p).toFixed(3).padStart(8)).join(''));

// ── 2) REJEU : |Δtheta5| >= seuil ⇒ spike de sens signe(Δtheta) ⇒ pas de trade CONTRE, 30 min ──
function buildGate(asset, thr) {
  const spikes = SERIES[asset].filter(x => Math.abs(x.dth) >= thr).map(x => ({ ep: x.ep, dir: x.dth >= 0 ? 1 : -1 }));
  return (rows, i, sel) => {
    const ep = mtMin(rows[i]?.timestamp);
    if (ep == null) return false;
    const side = sel.side === "BUY" ? 1 : -1;
    for (let k = spikes.length - 1; k >= 0; k--) {
      const d = ep - spikes[k].ep;
      if (d > COOLDOWN) break;
      if (d >= 0 && spikes[k].dir === -side) return true;   // FADE : on ne trade pas CONTRE le spike
    }
    return false;
  };
}
function run(tag, thr) {
  let totR = 0, wins = 0, losses = 0;
  for (const a of assets) {
    const opts = (thr === null) ? {} : { contGate: buildGate(a, thr), exhGate: buildGate(a, thr) };
    const r = runMatrixBacktest(path.join(MATRIX, `${a}.csv`), opts);
    totR += r.summary.totalR || 0; wins += r.summary.wins || 0; losses += r.summary.losses || 0;
  }
  const n = wins + losses;
  console.log(`  ${tag.padEnd(28)} trades=${String(n).padStart(6)}  totalR=${totR.toFixed(1).padStart(7)}  WR=${(100 * wins / n).toFixed(1)}%  avgR=${(totR / n).toFixed(3)}`);
  return { n, totR };
}

console.log(`\n===== REJEU — spike Δtheta ⇒ pas de trade CONTRE pendant ${COOLDOWN} min =====`);
const base = run('BASELINE', null);
for (const p of [90, 95, 97, 98, 99, 99.5]) {
  const thr = pct(sorted, p);
  const r = run(`P${p} (|Δθ|>=${thr.toFixed(2)}°)`, thr);
  const dn = r.n - base.n, dr = r.totR - base.totR;
  console.log(`  ${''.padEnd(28)} Δ trades=${dn.toString().padStart(6)}  Δ R=${(dr >= 0 ? '+' : '') + dr.toFixed(1)}`
    + `   avgR des coupés=${dn === 0 ? '—' : (dr / dn).toFixed(3)}  (baseline ${(base.totR / base.n).toFixed(3)})`);
}
console.log(`\n  [repère] corps/ATR >= 2.0 (même règle, même cooldown) : totalR 1636.3  Δ R=+80.7  Δ trades=-346`);
