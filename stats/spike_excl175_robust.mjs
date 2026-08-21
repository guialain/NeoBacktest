// spike_excl175_robust.mjs — RÈGLE VERROUILLÉE + robustesse complète (owner 2026-07-16).
// ============================================================================================
//   RÈGLE : une bougie M5 dont |corps| >= K × ATR(14) M5 des 14 barres PRÉCÉDENTES (barre courante
//           EXCLUE → le spike n'entre pas dans son propre dénominateur) ⇒ on ne trade PAS CONTRE son
//           sens pendant COOLDOWN min (ancré sur la bougie).
//   K = 1.75 · COOLDOWN = 30 min. Universel : aucun config par actif.
//
//   Historique des rejets (tout mesuré, cf session) :
//     · « pas de BUY après spike UP » (polarité owner initiale) : −44 R — le momentum PERSISTE.
//     · « ni BUY ni SELL » : −22 R — coupe au hasard (avgR des coupés ≈ baseline).
//     · largestRatio (concentration) : l'ablation est meilleure → n'apporte rien.
//     · Δtheta : atan saturant, 0.06 % = 24° à ic≈0 → aucun pouvoir discriminant.
//     · ATR statique calibré par actif : +69.9 seulement (décalage config/régime ×2.3 selon l'actif).
//   Ce qui reste : le CORPS, et rien d'autre.
//
// Usage : npx vite-node stats/spike_excl175_robust.mjs
// ============================================================================================
import fs from 'fs';
import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest } from '../src/components/simulations/matrixBacktest.mjs';

//   COOLDOWN = 45 min (owner 2026-07-16, après mesure) : 30 → +150.5 ; 45 → +184.3 ; 60 → +211.5 mais
//   90 → +62.9. 60 est AU BORD d'une falaise (−148 R en 30 min de plus) ; 45 prend l'essentiel du gain
//   en restant à distance du décrochage.
const K = 1.75, COOLDOWN = 45, ATR_P = 14;
const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const OHLC   = 'C:/Users/Public/Neo-Backtest/data/ohlc';
const CUT = '2026.07.05';

const mtMin = (ts) => { const m = String(ts).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };
const files = fs.readdirSync(MATRIX).filter(f => f.toLowerCase().endsWith('.csv')).sort();
const assets = files.map(f => f.replace(/\.csv$/i, ''));

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
    const slot = Math.floor(r.ep / 5) * 5; const cur = m5[m5.length - 1];
    if (!cur || cur.ep !== slot) m5.push({ ep: slot, o: r.o, h: r.h, l: r.l, c: r.c });
    else { cur.h = Math.max(cur.h, r.h); cur.l = Math.min(cur.l, r.l); cur.c = r.c; }
  }
  const tr = m5.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - m5[i - 1].c), Math.abs(b.l - m5[i - 1].c)));
  let s = 0;
  for (let i = 0; i < m5.length; i++) {
    s += tr[i]; if (i >= ATR_P) s -= tr[i - ATR_P];
    m5[i].atr = i >= ATR_P ? (s - tr[i]) / ATR_P : null;      // 14 barres PRÉCÉDENTES
    m5[i].body = Math.abs(m5[i].c - m5[i].o);
    m5[i].dir = (m5[i].c - m5[i].o) >= 0 ? 1 : -1;
  }
  M5[a] = m5;
}
// LAG = délai de DÉTECTION. Le corps d'une bougie M5 n'est connu qu'à sa CLÔTURE : une bougie qui
//   OUVRE à 12:30 n'est jugeable qu'à 12:35. Le live lit `close_m5_s1` → il ne peut RIEN savoir avant.
//   LAG=5 reproduit ça ; LAG=0 = ma mesure initiale, qui utilisait le corps 5 min AVANT de le connaître
//   (look-ahead). Écart LAG 0 vs 5 = le biais exact.
const LAG = Number(process.env.SPIKE_LAG ?? 5);
const gate = (asset, k, cd) => {
  const spikes = M5[asset].filter(b => b.atr > 0 && b.body / b.atr >= k)
    .map(b => ({ ep: b.ep + LAG, dir: b.dir }));   // ep = instant où le spike devient CONNAISSABLE
  return (rows, i, sel) => {
    const ep = mtMin(rows[i]?.timestamp);
    if (ep == null) return false;
    const side = sel.side === "BUY" ? 1 : -1;
    for (let j = spikes.length - 1; j >= 0; j--) {
      const d = ep - spikes[j].ep;
      if (d > cd) break;
      if (d >= 0 && spikes[j].dir === -side) return true;
    }
    return false;
  };
};
function run(k, cd) {
  let totR = 0, n = 0, wins = 0; const byHalf = { a: 0, b: 0 }, byAsset = {}, byDay = {};
  for (const a of assets) {
    const opts = (k === null) ? {} : { contGate: gate(a, k, cd), exhGate: gate(a, k, cd) };
    const r = runMatrixBacktest(path.join(MATRIX, `${a}.csv`), opts);
    totR += r.summary.totalR || 0; wins += r.summary.wins || 0;
    n += (r.summary.wins || 0) + (r.summary.losses || 0);
    byAsset[a] = r.summary.totalR || 0;
    for (const s of (r.signals || [])) {
      if (typeof s.R !== 'number') continue;
      const d = String(s.tsMT).slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + s.R;
      if (d < CUT) byHalf.a += s.R; else byHalf.b += s.R;
    }
  }
  return { totR, n, wr: 100 * wins / n, byHalf, byAsset, byDay };
}

const base = run(null, null);
const best = run(K, COOLDOWN);
console.log(`\n================ RÈGLE VERROUILLÉE : |corps M5| >= ${K} × ATR_excl(14) · cooldown ${COOLDOWN} min ================`);
console.log(`  baseline : trades=${base.n}  totalR=${base.totR.toFixed(1)}  WR=${base.wr.toFixed(1)}%  avgR=${(base.totR / base.n).toFixed(3)}`);
console.log(`  règle    : trades=${best.n}  totalR=${best.totR.toFixed(1)}  WR=${best.wr.toFixed(1)}%  avgR=${(best.totR / best.n).toFixed(3)}`);
const dn = best.n - base.n, dr = best.totR - base.totR;
console.log(`  Δ        : trades ${dn} (${(100 * dn / base.n).toFixed(1)}%)  ·  R ${(dr >= 0 ? '+' : '') + dr.toFixed(1)}  ·  avgR des coupés = ${(dr / dn).toFixed(3)}`);

console.log(`\n===== 1) PLATEAU — sensibilité au coefficient K (cooldown ${COOLDOWN}) =====`);
console.log(`  ${'K'.padEnd(7)}${'Δ R'.padStart(9)}${'Δ trades'.padStart(10)}${'totalR'.padStart(9)}`);
for (const k of [1.5, 1.6, 1.7, 1.75, 1.8, 1.9, 2.0, 2.25]) {
  const r = run(k, COOLDOWN);
  console.log(`  ${String(k).padEnd(7)}${((r.totR - base.totR >= 0 ? '+' : '') + (r.totR - base.totR).toFixed(1)).padStart(9)}${String(r.n - base.n).padStart(10)}${r.totR.toFixed(1).padStart(9)}`);
}
console.log(`\n===== 2) COOLDOWN — jamais mesuré (30 min = hypothèse owner), K=${K} =====`);
console.log(`  ${'min'.padEnd(7)}${'Δ R'.padStart(9)}${'Δ trades'.padStart(10)}${'totalR'.padStart(9)}`);
for (const cd of [10, 15, 30, 45, 60, 90]) {
  const r = run(K, cd);
  console.log(`  ${String(cd).padEnd(7)}${((r.totR - base.totR >= 0 ? '+' : '') + (r.totR - base.totR).toFixed(1)).padStart(9)}${String(r.n - base.n).padStart(10)}${r.totR.toFixed(1).padStart(9)}`);
}
console.log(`\n===== 3) PÉRIODE (frontière ${CUT}) =====`);
console.log(`  1ʳᵉ moitié : ${base.byHalf.a.toFixed(1)} → ${best.byHalf.a.toFixed(1)}   Δ = ${(best.byHalf.a - base.byHalf.a >= 0 ? '+' : '') + (best.byHalf.a - base.byHalf.a).toFixed(1)}`);
console.log(`  2ᵉ  moitié : ${base.byHalf.b.toFixed(1)} → ${best.byHalf.b.toFixed(1)}   Δ = ${(best.byHalf.b - base.byHalf.b >= 0 ? '+' : '') + (best.byHalf.b - base.byHalf.b).toFixed(1)}`);
const days = [...new Set([...Object.keys(base.byDay), ...Object.keys(best.byDay)])].sort();
const dPos = days.filter(d => (best.byDay[d] ?? 0) - (base.byDay[d] ?? 0) > 0.05).length;
const dNeg = days.filter(d => (best.byDay[d] ?? 0) - (base.byDay[d] ?? 0) < -0.05).length;
console.log(`  jours : ${dPos} améliorés / ${dNeg} dégradés / ${days.length} au total`);
const dayContrib = days.map(d => [d, (best.byDay[d] ?? 0) - (base.byDay[d] ?? 0)]).sort((x, y) => y[1] - x[1]);
console.log(`  meilleur jour ${dayContrib[0][0]} ${dayContrib[0][1] >= 0 ? '+' : ''}${dayContrib[0][1].toFixed(1)}  (= ${(100 * dayContrib[0][1] / dr).toFixed(0)} % du gain)  ·  pire ${dayContrib[dayContrib.length - 1][0]} ${dayContrib[dayContrib.length - 1][1].toFixed(1)}`);

console.log(`\n===== 4) PAR ACTIF =====`);
const contrib = assets.map(a => [a, (best.byAsset[a] ?? 0) - (base.byAsset[a] ?? 0)]).sort((x, y) => y[1] - x[1]);
for (const [a, d] of contrib) if (Math.abs(d) > 0.05) console.log(`  ${a.padEnd(12)} ${(d >= 0 ? '+' : '') + d.toFixed(1)}`);
const pos = contrib.filter(([, d]) => d > 0.05).length, neg = contrib.filter(([, d]) => d < -0.05).length;
console.log(`\n  gagnants ${pos} / perdants ${neg}  ·  top ${contrib[0][0]} = ${(100 * contrib[0][1] / dr).toFixed(0)} % du gain  ·  sans lui : ${(dr - contrib[0][1]).toFixed(1)} R`);
