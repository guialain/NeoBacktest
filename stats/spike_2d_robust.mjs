// spike_2d_robust.mjs — règle 2 étages : BALAYAGE 2D + ROBUSTESSE.
// ============================================================================================
//   Règle : bougie M5 avec |corps| >= BODY_MIN × ATR M5  ET  |Δtheta sur ses 5 min| >= DTH °
//           ⇒ on ne trade pas CONTRE son sens pendant COOLDOWN min.
//
//   1) Grille 2D (BODY_MIN × DTH en degrés ABSOLUS — un percentile conditionnel changerait de sens
//      quand BODY_MIN bouge). On cherche un PLATEAU, pas un pic : un pic isolé = surajustement.
//   2) Robustesse : ΔR par MOITIÉ de période + contribution par ACTIF (le gain tient-il partout ?).
//
// Usage : npx vite-node stats/spike_2d_robust.mjs [COOLDOWN]
// ============================================================================================
import fs from 'fs';
import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest, loadCsvRows } from '../src/components/simulations/matrixBacktest.mjs';
import { computeThetaVector } from '../../Matrix-Revolution/src/components/robot/engines/config/ThetaConfig.js';

const COOLDOWN = Number(process.argv[2] || 30);
const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const OHLC   = 'C:/Users/Public/Neo-Backtest/data/ohlc';
const ATR_P = 14;
const CUT = '2026.07.05';   // frontière des 2 moitiés (données 06-26 → 07-13)

const mtMin = (ts) => { const m = String(ts).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };
const files = fs.readdirSync(MATRIX).filter(f => f.toLowerCase().endsWith('.csv')).sort();
const assets = files.map(f => f.replace(/\.csv$/i, ''));

function thetaByMin(asset) {
  const map = new Map();
  for (const r of loadCsvRows(path.join(MATRIX, `${asset}.csv`))) {
    const ep = mtMin(r.timestamp);
    const tv = computeThetaVector(r, asset);
    if (ep != null && tv.thetaDayDeg != null && !map.has(ep)) map.set(ep, tv.thetaDayDeg);
  }
  return map;
}
function m5Series(asset) {
  const f = path.join(OHLC, `ohlc_${asset}_M1.csv`);
  if (!fs.existsSync(f)) return [];
  const rows = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).slice(1).map(l => {
    const p = l.split(';'); const ep = mtMin(p[0]);
    return ep == null ? null : { ep, o: +p[1], h: +p[2], l: +p[3], c: +p[4] };
  }).filter(Boolean).sort((a, b) => a.ep - b.ep);
  const m5 = [];
  for (const r of rows) {
    const slot = Math.floor(r.ep / 5) * 5;
    const cur = m5[m5.length - 1];
    if (!cur || cur.ep !== slot) m5.push({ ep: slot, o: r.o, h: r.h, l: r.l, c: r.c });
    else { cur.h = Math.max(cur.h, r.h); cur.l = Math.min(cur.l, r.l); cur.c = r.c; }
  }
  const tr = m5.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - m5[i - 1].c), Math.abs(b.l - m5[i - 1].c)));
  let s = 0;
  for (let i = 0; i < m5.length; i++) { s += tr[i]; if (i >= ATR_P) s -= tr[i - ATR_P]; m5[i].atr = i >= ATR_P - 1 ? s / ATR_P : null; }
  return m5;
}

// Candidats bruts (toutes tailles) — on filtrera BODY_MIN à la volée dans la grille.
const CAND = {};
for (const a of assets) {
  const th = thetaByMin(a), m5 = m5Series(a), out = [];
  for (const b of m5) {
    if (!(b.atr > 0)) continue;
    const bodyX = Math.abs(b.c - b.o) / b.atr;
    if (bodyX < 0.5) continue;                       // pré-élagage large (aucune config ne descend sous 0.75)
    let t1 = null, t0 = null;
    for (let d = 0; d <= 1 && t1 === null; d++) t1 = th.get(b.ep + 5 + d) ?? th.get(b.ep + 5 - d) ?? null;
    for (let d = 0; d <= 1 && t0 === null; d++) t0 = th.get(b.ep + d) ?? th.get(b.ep - d) ?? null;
    if (t1 === null || t0 === null) continue;
    out.push({ ep: b.ep, bodyX, dth: Math.abs(t1 - t0), dir: (b.c - b.o) >= 0 ? 1 : -1 });
  }
  CAND[a] = out;
}

function buildGate(asset, bodyMin, dthMin) {
  const spikes = CAND[asset].filter(x => x.bodyX >= bodyMin && x.dth >= dthMin).map(x => ({ ep: x.ep, dir: x.dir }));
  return (rows, i, sel) => {
    const ep = mtMin(rows[i]?.timestamp);
    if (ep == null) return false;
    const side = sel.side === "BUY" ? 1 : -1;
    for (let k = spikes.length - 1; k >= 0; k--) {
      const d = ep - spikes[k].ep;
      if (d > COOLDOWN) break;
      if (d >= 0 && spikes[k].dir === -side) return true;
    }
    return false;
  };
}
// Retourne { totR, n, byHalf:{a,b}, byAsset:{} } — signals portent tsMT + R.
function run(bodyMin, dthMin) {
  let totR = 0, n = 0; const byHalf = { a: 0, b: 0 }, byAsset = {};
  for (const a of assets) {
    const opts = (bodyMin === null) ? {} : { contGate: buildGate(a, bodyMin, dthMin), exhGate: buildGate(a, bodyMin, dthMin) };
    const r = runMatrixBacktest(path.join(MATRIX, `${a}.csv`), opts);
    totR += r.summary.totalR || 0; n += (r.summary.wins || 0) + (r.summary.losses || 0);
    byAsset[a] = r.summary.totalR || 0;
    for (const s of (r.signals || [])) {
      if (typeof s.R !== 'number') continue;
      if (String(s.tsMT).slice(0, 10) < CUT) byHalf.a += s.R; else byHalf.b += s.R;
    }
  }
  return { totR, n, byHalf, byAsset };
}

const base = run(null, null);
console.log(`\n  BASELINE : trades=${base.n}  totalR=${base.totR.toFixed(1)}   [1ʳᵉ moitié ${base.byHalf.a.toFixed(1)} · 2ᵉ moitié ${base.byHalf.b.toFixed(1)}]`);

// ── 1) GRILLE 2D : Δ R (cherche un PLATEAU) ───────────────────────────────────────────────────
//    Δθ=0 = ABLATION (theta désactivé) : contrôle indispensable — le gain vient-il de theta ou du seul
//    filtre de taille ? Sans cette colonne, on créditerait theta d'un effet qui pourrait être celui du corps.
const BODYS = [0.75, 1.0, 1.5, 2.0], DTHS = [0, 2, 3.5, 5, 7, 10];
console.log(`\n===== GRILLE 2D — Δ R vs baseline (cooldown ${COOLDOWN} min) =====`);
console.log(`  ${'body\\Δθ'.padEnd(9)}` + DTHS.map(d => `${d}°`.padStart(9)).join(''));
const grid = {};
for (const bm of BODYS) {
  const line = [];
  for (const dt of DTHS) {
    const r = run(bm, dt);
    grid[`${bm}|${dt}`] = r;
    line.push(((r.totR - base.totR >= 0 ? '+' : '') + (r.totR - base.totR).toFixed(1)).padStart(9));
  }
  console.log(`  ${String(bm).padEnd(9)}` + line.join(''));
}
console.log(`\n  ${'body\\Δθ'.padEnd(9)}` + DTHS.map(d => `${d}°`.padStart(9)).join('') + `   (Δ trades)`);
for (const bm of BODYS)
  console.log(`  ${String(bm).padEnd(9)}` + DTHS.map(dt => String(grid[`${bm}|${dt}`].n - base.n).padStart(9)).join(''));

// ── 2) ROBUSTESSE de la meilleure config ──────────────────────────────────────────────────────
let best = null, bestK = null;
for (const k in grid) if (!best || grid[k].totR > best.totR) { best = grid[k]; bestK = k; }
const [bm, dt] = bestK.split('|');
console.log(`\n===== ROBUSTESSE — meilleure config : body>=${bm}×ATR · |Δθ|>=${dt}° =====`);
console.log(`  totalR ${best.totR.toFixed(1)} (Δ ${(best.totR - base.totR >= 0 ? '+' : '') + (best.totR - base.totR).toFixed(1)})  trades ${best.n} (Δ ${best.n - base.n})`);
console.log(`\n  DÉCOUPAGE PÉRIODE (frontière ${CUT}) :`);
console.log(`    1ʳᵉ moitié : baseline ${base.byHalf.a.toFixed(1)}  →  règle ${best.byHalf.a.toFixed(1)}   Δ = ${(best.byHalf.a - base.byHalf.a >= 0 ? '+' : '') + (best.byHalf.a - base.byHalf.a).toFixed(1)}`);
console.log(`    2ᵉ  moitié : baseline ${base.byHalf.b.toFixed(1)}  →  règle ${best.byHalf.b.toFixed(1)}   Δ = ${(best.byHalf.b - base.byHalf.b >= 0 ? '+' : '') + (best.byHalf.b - base.byHalf.b).toFixed(1)}`);
console.log(`\n  CONTRIBUTION PAR ACTIF (Δ R, trié) — le gain est-il porté par un seul actif ?`);
const contrib = assets.map(a => [a, (best.byAsset[a] ?? 0) - (base.byAsset[a] ?? 0)]).sort((x, y) => y[1] - x[1]);
for (const [a, d] of contrib) if (Math.abs(d) > 0.05) console.log(`    ${a.padEnd(12)} ${(d >= 0 ? '+' : '') + d.toFixed(1)}`);
const pos = contrib.filter(([, d]) => d > 0).length, neg = contrib.filter(([, d]) => d < 0).length;
const top = contrib[0];
console.log(`\n    actifs gagnants ${pos} / perdants ${neg}   ·   top contributeur ${top[0]} = ${(100 * top[1] / (best.totR - base.totR)).toFixed(0)} % du gain`);
