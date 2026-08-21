// profile_kd_dynamics.mjs — dynamique du gap k-d (contact StochDyn).
// H1, heures actives (barres consecutives actives), agregat 19 actifs (stats/data).
// (1) rappel vers 0 : E[Δ(k-d) | niveau k-d]  (2) autocorr/half-life  (3) amplitude des swings
// (4) duree entre cross (dwell)  (5) trajectoire |k-d| autour d'un cross significatif.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/Public/Neo-Backtest/stats/data';
const MIN_STEP = 3;
const files = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f));

function pctl(s,p){if(!s.length)return null;const r=p/100*(s.length-1),lo=Math.floor(r),hi=Math.ceil(r);return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(r-lo);}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;

// bins de niveau k-d pour le rappel
const BINS=[[-99,-15],[-15,-10],[-10,-5],[-5,-2],[-2,2],[2,5],[5,10],[10,15],[15,99]];
const binLbl=['<-15','-15..-10','-10..-5','-5..-2','-2..2','2..5','5..10','10..15','>15'];
const binDelta=BINS.map(()=>[]);
// autocorr niveau
let acN=0,acD=0,acM=0,acC=0;
// amplitude swings + dwell (segments entre changements de signe)
const amps=[], dwells=[];
// trajectoire autour cross significatif : offsets -3..+3
const OFF=3; const traj=Array.from({length:2*OFF+1},()=>[]);

for(const f of files){
  const L=fs.readFileSync(path.join(DIR,f),'utf8').split(/\r?\n/); const h=L[0].split(';');
  const iK=h.indexOf('stoch_k'),iD=h.indexOf('stoch_d'),iAc=h.indexOf('is_active');
  const rows=[]; for(let i=1;i<L.length;i++){const c=L[i].split(';');if(c.length<h.length)continue;const k=+c[iK],d=+c[iD];if(!Number.isFinite(k)||!Number.isFinite(d))continue;rows.push({kd:k-d,active:c[iAc]==='1'});}
  rows.reverse();
  // sequences actives contigues
  // (1) rappel + (2) autocorr
  const kdAll=rows.filter(r=>r.active).map(r=>r.kd);
  const mA=mean(kdAll); for(let i=0;i<kdAll.length;i++){acD+=(kdAll[i]-mA)**2;if(i>0)acN+=(kdAll[i]-mA)*(kdAll[i-1]-mA);}
  for(let i=1;i<rows.length;i++){
    if(!rows[i].active||!rows[i-1].active)continue;
    const lvl=rows[i-1].kd, dd=rows[i].kd-rows[i-1].kd;
    let bi=BINS.findIndex(([lo,hi])=>lvl>=lo&&lvl<hi); if(bi<0)bi=BINS.length-1;
    binDelta[bi].push(dd);
  }
  // (3)(4) segments entre cross (meme signe), amplitude=max|kd|, dwell=nb barres
  let seg=[], sign=0;
  const act=rows.filter(r=>r.active); // approx: on segmente sur actives contigues
  for(let i=0;i<act.length;i++){
    const s=Math.sign(act[i].kd);
    if(s===0){continue;}
    if(s===sign){seg.push(act[i].kd);}
    else { if(seg.length){amps.push(Math.max(...seg.map(Math.abs)));dwells.push(seg.length);} seg=[act[i].kd]; sign=s; }
  }
  if(seg.length){amps.push(Math.max(...seg.map(Math.abs)));dwells.push(seg.length);}
  // (5) trajectoire autour cross significatif (prev|kd|>MIN_STEP, flip)
  for(let i=1;i<act.length-OFF;i++){
    if(i<OFF)continue;
    const p=act[i-1],c=act[i];
    if(p.kd===0||Math.sign(c.kd)===Math.sign(p.kd))continue;
    if(Math.abs(p.kd)<=MIN_STEP)continue;
    for(let o=-OFF;o<=OFF;o++) traj[o+OFF].push(Math.abs(act[i+o].kd));
  }
}

const sAmp=[...amps].sort((a,b)=>a-b), sDw=[...dwells].sort((a,b)=>a-b);
console.log(`=== Dynamique du gap k-d (H1, heures actives, 19 actifs) ===\n`);

console.log(`(1) Force de rappel : E[Δ(k-d)] selon le niveau de k-d`);
console.log(`  niveau        n    mean Δ  (>0 pousse en haut, <0 tire vers 0)`);
BINS.forEach((_,i)=>{ if(binDelta[i].length<50)return; const m=mean(binDelta[i]); const bar=(m>=0?'+':'')+m.toFixed(2);
  console.log(`  ${binLbl[i].padEnd(10)} ${String(binDelta[i].length).padStart(6)}   ${bar.padStart(7)}`); });

console.log(`\n(2) Persistance du niveau k-d`);
console.log(`  autocorr lag-1 : ${(acN/acD).toFixed(3)}  (proche 0 = sans memoire / mean-reverting rapide)`);

console.log(`\n(3) Amplitude des swings (pic |k-d| entre 2 cross)`);
console.log(`  median ${pctl(sAmp,50).toFixed(1)}  P75 ${pctl(sAmp,75).toFixed(1)}  P90 ${pctl(sAmp,90).toFixed(1)}  max ${sAmp[sAmp.length-1].toFixed(1)}  (n=${amps.length} swings)`);

console.log(`\n(4) Duree entre cross (dwell, barres meme signe)`);
console.log(`  median ${pctl(sDw,50)}  P75 ${pctl(sDw,75)}  P90 ${pctl(sDw,90)}  max ${sDw[sDw.length-1]}  moyen ${mean(dwells).toFixed(1)}`);

console.log(`\n(5) Trajectoire |k-d| autour d'un cross significatif (offset 0 = barre du cross)`);
for(let o=-OFF;o<=OFF;o++){ const m=mean(traj[o+OFF]); const bar='#'.repeat(Math.round(m)); const tag=o===0?' <-CROSS':(o<0?' (avant)':' (apres)');
  console.log(`  t${o>=0?'+':''}${o}  |k-d|=${m.toFixed(1).padStart(5)}  ${bar}${tag}`); }
