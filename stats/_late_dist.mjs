// Distribution des scores dans la bande LATE (full H1) + croisement avec le SIGNE (%D) et le mouvement réel.
import fs from 'fs';
import { detectOpportunity } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
const dir = 'C:/Users/Public/Neo-Backtest/data/matrix';
const LATE = 43, EXH = 73;
const late = [];   // {score, dLevel, k, z}
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.csv'))) {
  const raw = fs.readFileSync(`${dir}/${f}`, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const H = raw[0].split(';').map(h => h.trim());
  const seen = new Set();
  for (let i = 1; i < raw.length; i++) {
    const v = raw[i].split(';');
    const hourKey = f + '|' + String(v[1] ?? '').slice(0, 13);
    if (seen.has(hourKey)) continue; seen.add(hourKey);   // 1 barre H1
    const o = {}; H.forEach((h, j) => { const s = v[j]?.trim(); const n = Number(s); o[h] = (s !== '' && Number.isFinite(n)) ? n : s; });
    const r = detectOpportunity(o, f.replace('.csv', ''));
    const sc = r.maturity.score;
    if (sc == null || sc < LATE || sc >= EXH) continue;   // bande LATE seulement
    const h1 = r.stoch?.perTf?.h1 || {};
    late.push({ score: sc, dLevel: r.stoch?.dLevel ?? null, k: h1.k ?? null, z: Number(o['zscore_h1_s0']) });
  }
}
const n = late.length;
console.log(`Bande LATE [${LATE},${EXH}) — n=${n} barres H1 (dédup, 19 actifs)\n`);
// histogramme des scores /5
const hist = {}; late.forEach(x => { const b = Math.floor(x.score / 5) * 5; hist[b] = (hist[b] || 0) + 1; });
console.log('Score /5 :', Object.entries(hist).sort((a, b) => a[0] - b[0]).map(([b, c]) => `${b}:${c}(${(100*c/n).toFixed(0)}%)`).join('  '));

const buy = late.filter(x => x.dLevel >= 50), sell = late.filter(x => x.dLevel < 50);
console.log(`\nSIGNE (%D H1) :  LATE_BUY ${buy.length} (${(100*buy.length/n).toFixed(0)}%)  ·  LATE_SELL ${sell.length} (${(100*sell.length/n).toFixed(0)}%)`);

// INCOHÉRENCE : le signe (%D) dit BUY mais le mouvement réel (%K, zscore) dit le contraire, et vice-versa.
const kd = (arr) => arr.filter(x => x.k != null && x.dLevel != null);
const buyKlow = kd(buy).filter(x => x.k < 50).length, buyZneg = buy.filter(x => x.z < 0).length;
const sellKhigh = kd(sell).filter(x => x.k >= 50).length, sellZpos = sell.filter(x => x.z > 0).length;
console.log(`\nINCOHÉRENCE signe vs mouvement :`);
console.log(`  LATE_BUY (%D≥50) dont %K<50   : ${buyKlow}/${buy.length} (${(100*buyKlow/buy.length).toFixed(0)}%)   ← signe BUY, %K déjà en bas`);
console.log(`  LATE_BUY (%D≥50) dont zscore<0 : ${buyZneg}/${buy.length} (${(100*buyZneg/buy.length).toFixed(0)}%)   ← signe BUY, prix étiré EN BAS`);
console.log(`  LATE_SELL(%D<50) dont %K≥50   : ${sellKhigh}/${sell.length} (${(100*sellKhigh/sell.length).toFixed(0)}%)   ← signe SELL, %K déjà en haut`);
console.log(`  LATE_SELL(%D<50) dont zscore>0 : ${sellZpos}/${sell.length} (${(100*sellZpos/sell.length).toFixed(0)}%)`);
// distribution de l'écart K-D dans la bande LATE
const gaps = kd(late).map(x => x.k - x.dLevel).sort((a,b)=>a-b);
const q = p => gaps[Math.min(gaps.length-1, Math.floor(p*gaps.length))].toFixed(1);
console.log(`\nÉcart %K−%D (LATE) : p10 ${q(.1)}  p25 ${q(.25)}  médiane ${q(.5)}  p75 ${q(.75)}  p90 ${q(.9)}   (négatif = %K sous %D = rollover en cours)`);
