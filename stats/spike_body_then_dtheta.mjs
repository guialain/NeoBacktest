// spike_body_then_dtheta.mjs — SPIKE en 2 ÉTAGES (owner 2026-07-16).
// ============================================================================================
//   Étage 1 — TAILLE : on ne cherche un spike QUE sur des bougies M5 significatives (|corps| >= BODY_MIN × ATR M5).
//              Écarte le bruit des micro-bougies, où theta est hypersensible (ic≈0 → 0,06 % = 24°).
//   Étage 2 — BRUTALITÉ : sur ces bougies-là seulement, |Δtheta| sur les 5 min de la bougie.
//              Seuil = PERCENTILE calibré SUR CE SOUS-ENSEMBLE (pas sur tout l'univers).
//
//   Règle : spike de sens D ⇒ on ne trade PAS CONTRE D pendant COOLDOWN min (ancré sur la bougie).
//           C'est la polarité qui gagne (mesuré : « pas de BUY après spike UP » = −44 R ; l'inverse = +80 R).
//
//   Repère à battre : |corps| >= 2×ATR seul (sans theta) = +80.7 R → 1636.3.
//
// Usage : npx vite-node stats/spike_body_then_dtheta.mjs [BODY_MIN] [COOLDOWN]
// ============================================================================================
import fs from 'fs';
import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest, loadCsvRows } from '../src/components/simulations/matrixBacktest.mjs';
import { computeThetaVector } from '../../Matrix-Revolution/src/components/robot/engines/config/ThetaConfig.js';

const BODY_MIN = Number(process.argv[2] || 1.0);
const COOLDOWN = Number(process.argv[3] || 30);
const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const OHLC   = 'C:/Users/Public/Neo-Backtest/data/ohlc';
const ATR_P = 14;

const mtMin = (ts) => { const m = String(ts).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };
const pct = (s, p) => { if (!s.length) return null; const r = (p / 100) * (s.length - 1), lo = Math.floor(r), hi = Math.ceil(r); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (r - lo); };

const files = fs.readdirSync(MATRIX).filter(f => f.toLowerCase().endsWith('.csv')).sort();
const assets = files.map(f => f.replace(/\.csv$/i, ''));

// theta par minute (depuis le scan) — SSOT computeThetaVector
function thetaByMin(asset) {
  const map = new Map();
  for (const r of loadCsvRows(path.join(MATRIX, `${asset}.csv`))) {
    const ep = mtMin(r.timestamp);
    const tv = computeThetaVector(r, asset);
    if (ep != null && tv.thetaDayDeg != null && !map.has(ep)) map.set(ep, tv.thetaDayDeg);
  }
  return map;
}
// bougies M5 + ATR (depuis l'OHLC M1)
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

// ── ÉTAGE 1 : candidats = bougies M5 significatives ; ÉTAGE 2 : leur Δtheta sur les 5 min ──
const CAND = {};      // asset → [{ ep(fin de bougie), bodyX, dth, dirBody }]
const absD = [];      // |Δtheta| des candidats → calibration
let nBars = 0, nBig = 0, nWithTheta = 0;
for (const a of assets) {
  const th = thetaByMin(a);
  const m5 = m5Series(a);
  const out = [];
  for (const b of m5) {
    if (!(b.atr > 0)) continue;
    nBars++;
    const bodyX = Math.abs(b.c - b.o) / b.atr;
    if (bodyX < BODY_MIN) continue;                   // ÉTAGE 1 : trop petite → pas un candidat
    nBig++;
    const tEnd = b.ep + 5, tStart = b.ep;             // Δtheta SUR la bougie (ses 5 minutes)
    let t1 = null, t0 = null;
    for (let d = 0; d <= 1 && t1 === null; d++) t1 = th.get(tEnd + d) ?? th.get(tEnd - d) ?? null;
    for (let d = 0; d <= 1 && t0 === null; d++) t0 = th.get(tStart + d) ?? th.get(tStart - d) ?? null;
    if (t1 === null || t0 === null) continue;         // theta indispo (sessionEarly / hors scan)
    nWithTheta++;
    const dth = t1 - t0;
    out.push({ ep: b.ep, bodyX, dth, dirBody: (b.c - b.o) >= 0 ? 1 : -1 });
    absD.push(Math.abs(dth));
  }
  CAND[a] = out;
}
const sorted = absD.slice().sort((x, y) => x - y);
console.log(`\n===== ÉTAGE 1 — bougies M5 significatives (|corps| >= ${BODY_MIN}×ATR) =====`);
console.log(`  bougies M5 totales : ${nBars}   dont significatives : ${nBig} (${(100 * nBig / nBars).toFixed(1)}%)   avec theta dispo : ${nWithTheta}`);
console.log(`\n===== ÉTAGE 2 — |Δtheta| SUR CES BOUGIES (calibration conditionnelle) =====`);
const PS = [10, 25, 50, 75, 90, 95, 99];
console.log(`  ` + PS.map(p => `P${p}`.padStart(8)).join(''));
console.log(`  ` + PS.map(p => pct(sorted, p).toFixed(2).padStart(8)).join(''));

// ── REJEU ─────────────────────────────────────────────────────────────────────────────────────
function buildGate(asset, thrTheta) {
  const spikes = CAND[asset]
    .filter(x => thrTheta === null || Math.abs(x.dth) >= thrTheta)
    .map(x => ({ ep: x.ep, dir: x.dirBody }));       // direction = celle de la BOUGIE (non saturée)
  return (rows, i, sel) => {
    const ep = mtMin(rows[i]?.timestamp);
    if (ep == null) return false;
    const side = sel.side === "BUY" ? 1 : -1;
    for (let k = spikes.length - 1; k >= 0; k--) {
      const d = ep - spikes[k].ep;
      if (d > COOLDOWN) break;
      if (d >= 0 && spikes[k].dir === -side) return true;   // pas de trade CONTRE le spike
    }
    return false;
  };
}
function run(tag, thr) {
  let totR = 0, wins = 0, losses = 0;
  for (const a of assets) {
    const opts = (thr === undefined) ? {} : { contGate: buildGate(a, thr), exhGate: buildGate(a, thr) };
    const r = runMatrixBacktest(path.join(MATRIX, `${a}.csv`), opts);
    totR += r.summary.totalR || 0; wins += r.summary.wins || 0; losses += r.summary.losses || 0;
  }
  const n = wins + losses;
  console.log(`  ${tag.padEnd(30)} trades=${String(n).padStart(6)}  totalR=${totR.toFixed(1).padStart(7)}  WR=${(100 * wins / n).toFixed(1)}%  avgR=${(totR / n).toFixed(3)}`);
  return { n, totR };
}

console.log(`\n===== REJEU — étage 1 (>=${BODY_MIN}×ATR) puis étage 2 (Δtheta), cooldown ${COOLDOWN} min =====`);
const base = run('BASELINE', undefined);
const rep = (r) => { const dn = r.n - base.n, dr = r.totR - base.totR;
  console.log(`  ${''.padEnd(30)} Δ trades=${dn.toString().padStart(6)}  Δ R=${(dr >= 0 ? '+' : '') + dr.toFixed(1)}   avgR des coupés=${dn === 0 ? '—' : (dr / dn).toFixed(3)}  (baseline ${(base.totR / base.n).toFixed(3)})`); };
rep(run(`étage 1 SEUL (theta OFF)`, null));          // témoin : que vaut le filtre taille sans theta ?
for (const p of [25, 50, 75, 90, 95])
  rep(run(`+ |Δθ| >= P${p} (${pct(sorted, p).toFixed(2)}°)`, pct(sorted, p)));
console.log(`\n  [repère] |corps| >= 2×ATR seul, sans theta : totalR 1636.3  Δ R=+80.7  Δ trades=-346`);
