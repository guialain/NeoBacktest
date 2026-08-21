// test_contact_event_vs_21.mjs
// Compare deux definitions de "contact" a un cross K/D :
//   - contact-2.1  : |k-d| <= 2.1 sur la barre du flip  (bande statique)
//   - contact-event: le flip lui-meme (sign(k-d) change)  = capte 100% des cross
// Volet 1 : taux de capture des cross par contact-2.1.
// Volet 2 : a l'exhaustion (extreme %K + cross en sens), rendement forward en ATR
//           dans le sens du fade, SLOW (|k-d|<=2.1, capte par 2.1) vs FAST (>2.1, rate par 2.1).
//           Question: les FAST crosses (rates par 2.1) sont-ils d'aussi bons fades ?
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const TFS = ['M15', 'H1', 'H4'];
const HORIZON = 4;        // barres forward
const EXT_HI = 80, EXT_LO = 20; // seuils extreme %K
const CONTACT_21 = 2.1;
const ATR_N = 14;

const assets = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f))
  .map(f => f.replace(/^hist_/, '').replace(/_H1\.csv$/, '')).sort();

function loadChrono(fp) {
  const L = fs.readFileSync(fp, 'utf8').split(/\r?\n/);
  const h = L[0].split(';');
  const idx = n => h.indexOf(n);
  const iH = idx('high'), iL = idx('low'), iC = idx('close'), iK = idx('stoch_k'), iD = idx('stoch_d');
  const rows = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(';');
    if (c.length < h.length) continue;
    const high = +c[iH], low = +c[iL], close = +c[iC], k = +c[iK], d = +c[iD];
    if ([high, low, close, k, d].every(Number.isFinite)) rows.push({ high, low, close, k, d, kd: k - d });
  }
  rows.reverse(); // fichier DESC -> chronologique
  // ATR(14) glissant
  for (let i = 0; i < rows.length; i++) {
    const tr = i === 0 ? rows[i].high - rows[i].low
      : Math.max(rows[i].high - rows[i].low, Math.abs(rows[i].high - rows[i - 1].close), Math.abs(rows[i].low - rows[i - 1].close));
    rows[i].tr = tr;
  }
  for (let i = 0; i < rows.length; i++) {
    if (i < ATR_N) { rows[i].atr = null; continue; }
    let s = 0; for (let j = i - ATR_N + 1; j <= i; j++) s += rows[j].tr;
    rows[i].atr = s / ATR_N;
  }
  return rows;
}

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const hit = a => a.length ? 100 * a.filter(x => x > 0).length / a.length : null;

for (const tf of TFS) {
  let crossTot = 0, caught21 = 0;
  const slow = [], fast = []; // fade returns (ATR) a l'exhaustion
  let nSlow = 0, nFast = 0;

  for (const a of assets) {
    const fp = path.join(DIR, `hist_${a}_${tf}.csv`);
    if (!fs.existsSync(fp)) continue;
    const r = loadChrono(fp);
    for (let i = 1; i < r.length - HORIZON; i++) {
      const prev = r[i - 1], cur = r[i];
      if (prev.kd === 0) continue;
      const flip = Math.sign(cur.kd) !== Math.sign(prev.kd);
      if (!flip) continue;
      crossTot++;
      const inBand = Math.abs(cur.kd) <= CONTACT_21;
      if (inBand) caught21++;

      // Exhaustion : le cross vient d'un extreme %K, en sens
      // sell-exh : kd + -> -  (K repasse sous D) depuis le haut (prev.k >= 80) -> fade = prix baisse
      // buy-exh  : kd - -> +  depuis le bas (prev.k <= 20) -> fade = prix monte
      const sellExh = prev.kd > 0 && cur.kd < 0 && prev.k >= EXT_HI;
      const buyExh = prev.kd < 0 && cur.kd > 0 && prev.k <= EXT_LO;
      if (!sellExh && !buyExh) continue;
      if (cur.atr == null || cur.atr <= 0) continue;
      const fwd = r[i + HORIZON].close - cur.close;
      const fadeRet = (sellExh ? -fwd : fwd) / cur.atr; // >0 = le fade a marche
      if (inBand) { slow.push(fadeRet); nSlow++; } else { fast.push(fadeRet); nFast++; }
    }
  }

  console.log(`\n===== ${tf} =====`);
  console.log(`  Cross K/D totaux        : ${crossTot}`);
  console.log(`  Captes par contact-2.1  : ${caught21} (${(100*caught21/crossTot).toFixed(1)}%)  -> RATES : ${(100*(1-caught21/crossTot)).toFixed(1)}%`);
  console.log(`  Exhaustion (extreme+sens, horizon ${HORIZON} barres, rendement fade en ATR) :`);
  console.log(`    SLOW  (|k-d|<=2.1, capte par 2.1)  n=${nSlow}  mean=${mean(slow)?.toFixed(3)}  hit=${hit(slow)?.toFixed(1)}%`);
  console.log(`    FAST  (|k-d|>2.1,  RATE par 2.1)   n=${nFast}  mean=${mean(fast)?.toFixed(3)}  hit=${hit(fast)?.toFixed(1)}%`);
  const all = slow.concat(fast);
  console.log(`    TOUS (contact-event)               n=${all.length}  mean=${mean(all)?.toFixed(3)}  hit=${hit(all)?.toFixed(1)}%`);
}
