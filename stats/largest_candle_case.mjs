// largest_candle_case.mjs — le concept LARGEST CANDLE sur un cas réel daté.
//   Usage : npx vite-node stats/largest_candle_case.mjs [ASSET] [YYYY.MM.DD HH:MM] [minAvant] [minApres]
//   Défaut : AUDUSD 2026.07.02 08:45 (trade BUY CONTINUATION du 08:46:32, owner).
import fs from 'fs';

const ASSET = process.argv[2] || 'AUDUSD';
const AT    = process.argv[3] || '2026.07.02 08:45';
const BEFORE = Number(process.argv[4] || 60);
const AFTER  = Number(process.argv[5] || 60);

const mtMin = (ts) => { const m = String(ts).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };
const fmt = (ep) => { const d = new Date(ep * 60000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

const rows = fs.readFileSync(`C:/Users/Public/Neo-Backtest/data/ohlc/ohlc_${ASSET}_M1.csv`, 'utf8').trim().split(/\r?\n/).slice(1)
  .map(l => { const p = l.split(';'); return { ep: mtMin(p[0]), open: +p[1], high: +p[2], low: +p[3], close: +p[4] }; })
  .filter(r => r.ep != null).sort((a, b) => a.ep - b.ep);

// M1 → M5
const m5 = [];
for (const r of rows) {
  const slot = Math.floor(r.ep / 5) * 5;
  const c = m5[m5.length - 1];
  if (!c || c.ep !== slot) m5.push({ ep: slot, open: r.open, high: r.high, low: r.low, close: r.close });
  else { c.high = Math.max(c.high, r.high); c.low = Math.min(c.low, r.low); c.close = r.close; }
}
// ATR(14) M5
const atr = (() => {
  const tr = m5.map((b, i) => i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - m5[i - 1].close), Math.abs(b.low - m5[i - 1].close)));
  const o = new Array(m5.length).fill(null); let s = 0;
  for (let i = 0; i < tr.length; i++) { s += tr[i]; if (i >= 14) s -= tr[i - 14]; if (i >= 13) o[i] = s / 14; }
  return o;
})();

const target = mtMin(AT);
const iAt = m5.findIndex(b => b.ep === Math.floor(target / 5) * 5);
if (iAt < 0) { console.log('bougie introuvable'); process.exit(1); }

console.log(`\n===== ${ASSET} — bougies M5 autour de ${AT} (s0 = la bougie du signal) =====`);
console.log(`  ${'heure'.padStart(6)} ${'open'.padStart(9)} ${'close'.padStart(9)} ${'body'.padStart(10)} ${'body/ATR'.padStart(9)}  dir`);
for (let i = iAt - Math.floor(BEFORE / 5); i <= iAt + Math.floor(AFTER / 5); i++) {
  if (i < 0 || i >= m5.length) continue;
  const b = m5[i], body = b.close - b.open;
  const mark = i === iAt ? '  <<< SIGNAL' : '';
  console.log(`  ${fmt(b.ep).padStart(6)} ${b.open.toFixed(5).padStart(9)} ${b.close.toFixed(5).padStart(9)} ${body.toFixed(5).padStart(10)} `
    + `${(atr[i] > 0 ? Math.abs(body) / atr[i] : 0).toFixed(2).padStart(9)}  ${body >= 0 ? 'UP' : 'DOWN'}${mark}`);
}

console.log(`\n===== Ce que dit le concept À L'INSTANT DU SIGNAL (${AT}) =====`);
console.log(`  ${'N'.padStart(2)} ${'largestBody'.padStart(12)} ${'totalBody'.padStart(11)} ${'ratio'.padStart(6)} ${'dir'.padStart(5)} ${'age'.padStart(4)} ${'body/ATR'.padStart(9)}`);
for (let N = 2; N <= 8; N++) {
  let largest = 0, total = 0, lIdx = -1;
  for (let k = iAt - N + 1; k <= iAt; k++) {
    const a = Math.abs(m5[k].close - m5[k].open);
    total += a; if (a > largest) { largest = a; lIdx = k; }
  }
  const dir = (m5[lIdx].close - m5[lIdx].open) >= 0 ? 'UP' : 'DOWN';
  console.log(`  ${String(N).padStart(2)} ${largest.toFixed(5).padStart(12)} ${total.toFixed(5).padStart(11)} ${(largest / total).toFixed(3).padStart(6)} ${dir.padStart(5)} ${String(iAt - lIdx).padStart(4)} ${(largest / atr[iAt]).toFixed(2).padStart(9)}`);
}

// Ce qu'a fait le prix APRÈS le signal (un BUY sur spike doit se payer)
const entry = m5[iAt].close;
console.log(`\n===== Ce que le prix a fait APRÈS (entrée ~${entry.toFixed(5)}, en ATR M5 = ${atr[iAt].toFixed(5)}) =====`);
for (const mins of [5, 10, 15, 30, 60, 120]) {
  const j = iAt + mins / 5;
  if (j >= m5.length) continue;
  const d = m5[j].close - entry;
  console.log(`  +${String(mins).padStart(3)} min : ${m5[j].close.toFixed(5)}   ${(d >= 0 ? '+' : '') + d.toFixed(5)}   ${((d / atr[iAt]) >= 0 ? '+' : '') + (d / atr[iAt]).toFixed(2)} ATR`);
}
