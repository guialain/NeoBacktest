// spike_body_atr_modes.mjs — RÈGLE FINALE candidate : corps M5 seul (ni ratio, ni theta).
// ============================================================================================
//   Règle : bougie M5 des COOLDOWN dernières minutes avec |corps| >= X × ATR_ref
//           ⇒ on ne trade pas CONTRE son sens pendant COOLDOWN min (ancré sur la bougie).
//
//   La question du jour (owner) : QUEL ATR de référence ? Trois normalisateurs, même règle :
//     · LIVE_INCL  — ATR(14) M5 glissant, barre courante INCLUSE.  ⚠ BIAISÉ : le True Range du spike entre
//                    dans son propre dénominateur (~ +spike/14) → le ratio est écrasé, d'autant plus que le
//                    spike est gros. Et l'ATR reste gonflé 14 barres → le spike suivant paraît plus petit.
//                    C'est ce que TOUS les chiffres précédents utilisaient.
//     · LIVE_EXCL  — ATR(14) M5 des 14 barres PRÉCÉDENTES (barre courante exclue). Enlève l'auto-inclusion,
//                    reste glissant (donc encore contaminé par un spike récent).
//     · STATIC     — ATRConfig[symbol].M5.p50, calibré HISTORIQUEMENT, converti en prix : (p50/1e5) × close.
//                    Ne bouge jamais. C'est le choix owner : aucun biais possible par l'ATR live.
//
//   ⚠ Les seuils ne sont PAS comparables d'un mode à l'autre (échelles différentes) → on balaie chacun.
//
// Usage : npx vite-node stats/spike_body_atr_modes.mjs [COOLDOWN]
// ============================================================================================
import fs from 'fs';
import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest } from '../src/components/simulations/matrixBacktest.mjs';
import { getATRConfig } from '../../Matrix-Revolution/src/components/robot/engines/config/ATRConfig.js';

const COOLDOWN = Number(process.argv[2] || 30);
const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const OHLC   = 'C:/Users/Public/Neo-Backtest/data/ohlc';
const ATR_P = 14;
const CUT = '2026.07.05';

const mtMin = (ts) => { const m = String(ts).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };
const files = fs.readdirSync(MATRIX).filter(f => f.toLowerCase().endsWith('.csv')).sort();
const assets = files.map(f => f.replace(/\.csv$/i, ''));

// Bougies M5 + les 3 ATR de référence
const M5 = {};
for (const a of assets) {
  const f = path.join(OHLC, `ohlc_${a}_M1.csv`);
  if (!fs.existsSync(f)) { M5[a] = []; continue; }
  const rows = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).slice(1).map(l => {
    const p = l.split(';'); const ep = mtMin(p[0]);
    return ep == null ? null : { ep, o: +p[1], h: +p[2], l: +p[3], c: +p[4] };
  }).filter(Boolean).sort((x, y) => x.ep - y.ep);
  const m5 = [];
  for (const r of rows) {
    const slot = Math.floor(r.ep / 5) * 5;
    const cur = m5[m5.length - 1];
    if (!cur || cur.ep !== slot) m5.push({ ep: slot, o: r.o, h: r.h, l: r.l, c: r.c });
    else { cur.h = Math.max(cur.h, r.h); cur.l = Math.min(cur.l, r.l); cur.c = r.c; }
  }
  const tr = m5.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - m5[i - 1].c), Math.abs(b.l - m5[i - 1].c)));
  const p50x = getATRConfig(a, 'M5')?.p50 ?? null;      // unité x1000 (atr/close x 1e5)
  let s = 0;
  for (let i = 0; i < m5.length; i++) {
    s += tr[i]; if (i >= ATR_P) s -= tr[i - ATR_P];
    m5[i].atrIncl = i >= ATR_P - 1 ? s / ATR_P : null;                       // barre i INCLUSE
    m5[i].atrExcl = i >= ATR_P ? (s - tr[i]) / ATR_P : null;                 // barre i EXCLUE (14 précédentes)
    m5[i].atrStat = p50x != null ? (p50x / 1e5) * m5[i].c : null;            // calibré historique, statique
    m5[i].body = Math.abs(m5[i].c - m5[i].o);
    m5[i].dir = (m5[i].c - m5[i].o) >= 0 ? 1 : -1;
  }
  M5[a] = m5;
}

function buildGate(asset, mode, thr) {
  const key = mode === 'INCL' ? 'atrIncl' : mode === 'EXCL' ? 'atrExcl' : 'atrStat';
  const spikes = M5[asset].filter(b => b[key] > 0 && b.body / b[key] >= thr).map(b => ({ ep: b.ep, dir: b.dir }));
  return (rows, i, sel) => {
    const ep = mtMin(rows[i]?.timestamp);
    if (ep == null) return false;
    const side = sel.side === "BUY" ? 1 : -1;
    for (let k = spikes.length - 1; k >= 0; k--) {
      const d = ep - spikes[k].ep;
      if (d > COOLDOWN) break;
      if (d >= 0 && spikes[k].dir === -side) return true;    // pas de trade CONTRE le spike
    }
    return false;
  };
}
function run(mode, thr) {
  let totR = 0, n = 0; const byHalf = { a: 0, b: 0 }, byAsset = {};
  for (const a of assets) {
    const opts = (mode === null) ? {} : { contGate: buildGate(a, mode, thr), exhGate: buildGate(a, mode, thr) };
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
console.log(`\n  BASELINE : trades=${base.n}  totalR=${base.totR.toFixed(1)}   [1ʳᵉ moitié ${base.byHalf.a.toFixed(1)} · 2ᵉ ${base.byHalf.b.toFixed(1)}]`);
console.log(`\n===== Δ R vs baseline — cooldown ${COOLDOWN} min, corps M5 seul =====`);
const THRS = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
console.log(`  ${'mode'.padEnd(11)}` + THRS.map(t => `${t}×`.padStart(9)).join(''));
const res = {};
for (const mode of ['INCL', 'EXCL', 'STATIC']) {
  const line = [];
  for (const t of THRS) { const r = run(mode, t); res[`${mode}|${t}`] = r; line.push(((r.totR - base.totR >= 0 ? '+' : '') + (r.totR - base.totR).toFixed(1)).padStart(9)); }
  console.log(`  ${mode.padEnd(11)}` + line.join(''));
}
console.log(`\n  ${'mode'.padEnd(11)}` + THRS.map(t => `${t}×`.padStart(9)).join('') + `   (Δ trades)`);
for (const mode of ['INCL', 'EXCL', 'STATIC'])
  console.log(`  ${mode.padEnd(11)}` + THRS.map(t => String(res[`${mode}|${t}`].n - base.n).padStart(9)).join(''));

// Robustesse de la meilleure
let best = null, bestK = null;
for (const k in res) if (!best || res[k].totR > best.totR) { best = res[k]; bestK = k; }
const [bm, bt] = bestK.split('|');
console.log(`\n===== ROBUSTESSE — meilleure : ${bm} @ ${bt}× =====`);
console.log(`  totalR ${best.totR.toFixed(1)} (Δ ${(best.totR - base.totR >= 0 ? '+' : '') + (best.totR - base.totR).toFixed(1)})  trades ${best.n} (Δ ${best.n - base.n})`);
console.log(`  1ʳᵉ moitié : ${base.byHalf.a.toFixed(1)} → ${best.byHalf.a.toFixed(1)}   Δ = ${(best.byHalf.a - base.byHalf.a >= 0 ? '+' : '') + (best.byHalf.a - base.byHalf.a).toFixed(1)}`);
console.log(`  2ᵉ  moitié : ${base.byHalf.b.toFixed(1)} → ${best.byHalf.b.toFixed(1)}   Δ = ${(best.byHalf.b - base.byHalf.b >= 0 ? '+' : '') + (best.byHalf.b - base.byHalf.b).toFixed(1)}`);
const contrib = assets.map(a => [a, (best.byAsset[a] ?? 0) - (base.byAsset[a] ?? 0)]).sort((x, y) => y[1] - x[1]);
const pos = contrib.filter(([, d]) => d > 0.05).length, neg = contrib.filter(([, d]) => d < -0.05).length;
console.log(`  actifs gagnants ${pos} / perdants ${neg}   ·   top ${contrib[0][0]} = ${(100 * contrib[0][1] / (best.totR - base.totR)).toFixed(0)} % du gain`);
