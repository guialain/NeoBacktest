// profile_adx_low_zone.mjs — comportement de l'ADX autour de la zone basse (<20).
// Question: ADX<20 = epuisement de tendance (trend qui meurt) ou range (jamais de trend) ?
// H1, heures actives (is_active), agregat 19 actifs (dataset augmente stats/data).
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/Public/Neo-Backtest/stats/data';
const LOOKBACK = 24; // barres pour juger "y avait-il un trend recent" (~1-2 jours H1)

const files = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f));

// accumulateurs
let nAct = 0;
const adxBuckets = [[0,20],[20,25],[25,37],[37,999]];
const bkLbl = ['ADX<20','ADX20-25','ADX25-37','ADX>=37'];
const crossInBk = adxBuckets.map(()=>({cross:0, bars:0})); // taux de cross k-d par bucket
let low_fromTrend = 0, low_total = 0, low_neverTrend = 0; // ADX<20 : venait d'un trend ?
let adxSeries = []; // pour autocorr global (concat par actif, reset entre actifs via calcul separe)
let acNum=0, acDen=0, acMean=0, acCount=0;
const dwell = []; // longueurs d'episodes ADX<20 consecutifs (barres actives)
let risingLow=0, fallingLow=0; // a ADX<20, l'ADX monte ou descend ?

for (const f of files) {
  const L = fs.readFileSync(path.join(DIR, f), 'utf8').split(/\r?\n/); const h = L[0].split(';');
  const iA = h.indexOf('adx14'), iK = h.indexOf('stoch_k'), iD = h.indexOf('stoch_d'), iAc = h.indexOf('is_active');
  const rows = [];
  for (let i = 1; i < L.length; i++) { const c = L[i].split(';'); if (c.length < h.length) continue;
    const adx=+c[iA], k=+c[iK], d=+c[iD]; if(![adx,k,d].every(Number.isFinite))continue;
    rows.push({ adx, kd:k-d, active:c[iAc]==='1' }); }
  rows.reverse(); // chrono

  // moyenne ADX de l'actif pour autocorr centree
  const adxAll = rows.map(r=>r.adx); const mA = adxAll.reduce((a,b)=>a+b,0)/adxAll.length;
  for (let i=0;i<rows.length;i++){ acDen+=(rows[i].adx-mA)**2; if(i>0)acNum+=(rows[i].adx-mA)*(rows[i-1].adx-mA); }

  let runLow = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.active) { if(runLow>0){dwell.push(runLow);runLow=0;} continue; }
    nAct++;
    // cross rate par bucket ADX
    let bi = adxBuckets.findIndex(([lo,hi])=>r.adx>=lo&&r.adx<hi); if(bi<0)bi=adxBuckets.length-1;
    crossInBk[bi].bars++;
    if (i>0 && rows[i-1].kd!==0 && Math.sign(r.kd)!==Math.sign(rows[i-1].kd) && Math.abs(rows[i-1].kd)>3) crossInBk[bi].cross++;
    // zone basse
    if (r.adx < 20) {
      low_total++; runLow++;
      // y avait-il un trend (ADX>25) dans les LOOKBACK barres precedentes ?
      let hadTrend = false;
      for (let j=Math.max(0,i-LOOKBACK); j<i; j++) if (rows[j].adx>25){hadTrend=true;break;}
      if (hadTrend) low_fromTrend++; else low_neverTrend++;
      // ADX monte ou descend ?
      if (i>0){ if(r.adx>rows[i-1].adx) risingLow++; else fallingLow++; }
    } else if (runLow>0) { dwell.push(runLow); runLow=0; }
  }
  if(runLow>0)dwell.push(runLow);
}

console.log(`=== Comportement ADX zone basse (H1, heures actives, 19 actifs) ===`);
console.log(`barres actives ${nAct}\n`);

console.log(`(1) Persistance ADX`);
console.log(`  autocorr lag-1 : ${(acNum/acDen).toFixed(3)}  (tres lisse/lent si proche de 1)`);
const md = [...dwell].sort((a,b)=>a-b);
console.log(`  episodes ADX<20 consecutifs : moyen ${(dwell.reduce((a,b)=>a+b,0)/dwell.length).toFixed(1)} barres, median ${md[Math.floor(md.length/2)]}, max ${md[md.length-1]}, n=${dwell.length} episodes`);

console.log(`\n(2) Taux de cross k-d significatif PAR bucket ADX (cross/barre)`);
crossInBk.forEach((b,i)=>console.log(`  ${bkLbl[i].padEnd(10)} ${(b.cross/b.bars).toFixed(3)}/barre   (${(100*b.bars/nAct).toFixed(0)}% des barres)`));

console.log(`\n(3) ADX<20 : epuisement (trend recent mort) vs range (jamais de trend) ?`);
console.log(`  vient d'un trend (ADX>25 dans les ${LOOKBACK} barres) : ${(100*low_fromTrend/low_total).toFixed(0)}%  = EPUISEMENT`);
console.log(`  pas de trend recent                                : ${(100*low_neverTrend/low_total).toFixed(0)}%  = RANGE`);

console.log(`\n(4) A ADX<20, l'ADX est en train de...`);
console.log(`  descendre (trend qui meurt encore) : ${(100*fallingLow/(risingLow+fallingLow)).toFixed(0)}%`);
console.log(`  remonter (trend qui renait)        : ${(100*risingLow/(risingLow+fallingLow)).toFixed(0)}%`);
