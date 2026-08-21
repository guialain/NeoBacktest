// body_atr_scales.mjs — quelle est l'ÉCHELLE de |corps M5| selon l'ATR de référence ?
//   Sert à balayer chaque mode sur SA plage (une grille commune 1..3 n'a aucune raison de convenir aux deux).
//   ATR_stat = ATRConfig[asset].M5.p50 (calibré historique, x1000) → prix = (p50/1e5) × close.
import fs from 'fs';
import path from 'path';
import { getATRConfig } from '../../Matrix-Revolution/src/components/robot/engines/config/ATRConfig.js';

const OHLC = 'C:/Users/Public/Neo-Backtest/data/ohlc';
const ATR_P = 14;
const mtMin = (ts) => { const m = String(ts).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };
const pct = (s, p) => { if (!s.length) return null; const r = (p / 100) * (s.length - 1), lo = Math.floor(r), hi = Math.ceil(r); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (r - lo); };

const files = fs.readdirSync(OHLC).filter(f => /^ohlc_.+_M1\.csv$/.test(f)).sort();
const excl = [], stat = [], ratioAtr = [];
const perAsset = [];
for (const f of files) {
  const a = f.match(/^ohlc_(.+)_M1\.csv$/)[1];
  const rows = fs.readFileSync(path.join(OHLC, f), 'utf8').trim().split(/\r?\n/).slice(1).map(l => {
    const p = l.split(';'); const ep = mtMin(p[0]);
    return ep == null ? null : { ep, o: +p[1], h: +p[2], l: +p[3], c: +p[4] };
  }).filter(Boolean).sort((x, y) => x.ep - y.ep);
  const m5 = [];
  for (const r of rows) {
    const slot = Math.floor(r.ep / 5) * 5; const cur = m5[m5.length - 1];
    if (!cur || cur.ep !== slot) m5.push({ ep: slot, o: r.o, h: r.h, l: r.l, c: r.c });
    else { cur.h = Math.max(cur.h, r.h); cur.l = Math.min(cur.l, r.l); cur.c = r.c; }
  }
  const tr = m5.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - m5[i - 1].c), Math.abs(b.l - m5[i - 1].c)));
  const p50x = getATRConfig(a, 'M5')?.p50 ?? null;
  let s = 0; const eA = [], sA = [], rA = [];
  for (let i = 0; i < m5.length; i++) {
    s += tr[i]; if (i >= ATR_P) s -= tr[i - ATR_P];
    if (i < ATR_P) continue;
    const aE = (s - tr[i]) / ATR_P;                  // ATR 14 barres PRÉCÉDENTES
    const aS = p50x != null ? (p50x / 1e5) * m5[i].c : null;
    const body = Math.abs(m5[i].c - m5[i].o);
    if (aE > 0) { eA.push(body / aE); excl.push(body / aE); }
    if (aS > 0) { sA.push(body / aS); stat.push(body / aS); }
    if (aE > 0 && aS > 0) { rA.push(aE / aS); ratioAtr.push(aE / aS); }
  }
  perAsset.push({ a, p50x, medRatio: pct(rA.slice().sort((x, y) => x - y), 50), n: eA.length });
}
const PS = [50, 75, 90, 95, 99, 99.9];
const show = (name, arr) => { const s = arr.slice().sort((x, y) => x - y);
  console.log(`  ${name.padEnd(22)}` + PS.map(p => pct(s, p).toFixed(2).padStart(9)).join('') + `   n=${s.length}`); };
console.log(`\n===== ÉCHELLE de |corps M5| selon le dénominateur =====`);
console.log(`  ${''.padEnd(22)}` + PS.map(p => `P${p}`.padStart(9)).join(''));
show('corps / ATR_excl', excl);
show('corps / ATR_static', stat);
console.log(`\n===== Pourquoi elles diffèrent : ATR_glissant / ATR_static =====`);
show('ATR_excl / ATR_static', ratioAtr);
console.log(`\n  → l'ATR glissant vaut en médiane ${pct(ratioAtr.slice().sort((x, y) => x - y), 50).toFixed(2)}× la médiane historique calibrée.`);
console.log(`\n===== par actif : p50 config (x1000) et ATR_glissant/ATR_static médian =====`);
console.log(`  ${'asset'.padEnd(12)} ${'p50_cfg'.padStart(8)} ${'ATRgliss/ATRstat'.padStart(17)}`);
for (const r of perAsset.sort((x, y) => (y.medRatio ?? 0) - (x.medRatio ?? 0)))
  console.log(`  ${r.a.padEnd(12)} ${String(r.p50x ?? '—').padStart(8)} ${(r.medRatio ?? 0).toFixed(2).padStart(17)}`);
