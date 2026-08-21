// profile_adx_delta.mjs — caracterise ΔADX (derivee) + grille 2D niveau ADX x pente ΔADX.
// H1, heures actives (is_active), agregat 19 actifs (dataset augmente stats/data).
// (1) distribution ΔADX (1 barre + 3 barres)  (2) grille 4 quadrants  (3) persistance de la pente.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/Public/Neo-Backtest/stats/data';
const files = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f));

function pctl(s,p){if(!s.length)return null;const r=p/100*(s.length-1),lo=Math.floor(r),hi=Math.ceil(r);return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(r-lo);}

const d1=[], d3=[];                 // deltas (barres actives consecutives)
const ADXB=[[0,20],[20,28],[28,37],[37,999]]; const ADXL=['ADX<20','ADX20-28','ADX28-37','ADX>=37'];
let FLAT; // deadzone pente, calibre apres
// on stocke les evenements pour 2e passe (grille) : {adx, d1}
const ev=[];
// persistance signe pente
let runsUp=[], runsDn=[];

for (const f of files) {
  const L=fs.readFileSync(path.join(DIR,f),'utf8').split(/\r?\n/); const h=L[0].split(';');
  const iA=h.indexOf('adx14'), iAc=h.indexOf('is_active');
  const rows=[]; for(let i=1;i<L.length;i++){const c=L[i].split(';');if(c.length<h.length)continue;const adx=+c[iA];if(!Number.isFinite(adx))continue;rows.push({adx,active:c[iAc]==='1'});}
  rows.reverse();
  for(let i=0;i<rows.length;i++){
    if(!rows[i].active)continue;
    if(i>=1&&rows[i-1].active){ const dd=rows[i].adx-rows[i-1].adx; d1.push(dd); ev.push({adx:rows[i].adx,d1:dd}); }
    if(i>=3&&rows[i-1].active&&rows[i-2].active&&rows[i-3].active) d3.push(rows[i].adx-rows[i-3].adx);
  }
}

const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const std=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);};
const s1=[...d1].sort((a,b)=>a-b), s3=[...d3].sort((a,b)=>a-b);

console.log(`=== ΔADX — profil (H1, heures actives, 19 actifs, n=${d1.length}) ===\n`);
console.log(`(1) Distribution ΔADX / barre`);
console.log(`  1 barre : mean ${mean(d1).toFixed(3)} std ${std(d1).toFixed(2)} | P5 ${pctl(s1,5).toFixed(2)} P25 ${pctl(s1,25).toFixed(2)} P50 ${pctl(s1,50).toFixed(2)} P75 ${pctl(s1,75).toFixed(2)} P95 ${pctl(s1,95).toFixed(2)}`);
console.log(`  3 barres: mean ${mean(d3).toFixed(3)} std ${std(d3).toFixed(2)} | P5 ${pctl(s3,5).toFixed(2)} P25 ${pctl(s3,25).toFixed(2)} P50 ${pctl(s3,50).toFixed(2)} P75 ${pctl(s3,75).toFixed(2)} P95 ${pctl(s3,95).toFixed(2)}`);

// deadzone "flat" = |ΔADX| < P60 de |ΔADX| (tiers central approx)
FLAT = pctl([...d1].map(Math.abs).sort((a,b)=>a-b), 50);
console.log(`  -> deadzone FLAT : |ΔADX| < ${FLAT.toFixed(2)} (median de |ΔADX|)`);

// (2) grille 2D niveau x pente
console.log(`\n(2) Grille niveau ADX x pente ΔADX (% des barres actives)`);
console.log(`  ${'niveau'.padEnd(10)} ${'MONTE'.padStart(8)} ${'FLAT'.padStart(8)} ${'DESCEND'.padStart(9)}   interpretation quadrant`);
const interp={ 'ADX<20':['(range->naissance)','(range)','(trend mort)'], 'ADX20-28':['renforce','','faiblit'], 'ADX28-37':['renforce','','s\'epuise'], 'ADX>=37':['accelere','pic','S\'EPUISE (avance)'] };
for(let bi=0;bi<ADXB.length;bi++){
  const [lo,hi]=ADXB[bi]; const cell=[0,0,0]; let tot=0;
  for(const e of ev){ if(e.adx>=lo&&e.adx<hi){ tot++; if(e.d1>FLAT)cell[0]++; else if(e.d1<-FLAT)cell[2]++; else cell[1]++; } }
  const pct=x=>((100*x/ev.length).toFixed(1)+'%').padStart(8);
  console.log(`  ${ADXL[bi].padEnd(10)} ${pct(cell[0])} ${pct(cell[1])} ${pct(cell[2]).padStart(9)}   ↑${interp[ADXL[bi]][0]} ↓${interp[ADXL[bi]][2]}`);
}

// (3) persistance du signe de pente (runs, barres actives consecutives)
let cur=0, sg=0;
for(const e of ev){ const s=e.d1>FLAT?1:(e.d1<-FLAT?-1:0);
  if(s!==0&&s===sg)cur++; else { if(cur>0){(sg>0?runsUp:runsDn).push(cur);} cur=(s!==0)?1:0; sg=s; } }
console.log(`\n(3) Persistance de la pente (runs meme sens, hors FLAT)`);
console.log(`  MONTE  : run moyen ${mean(runsUp).toFixed(1)} barres (max ${Math.max(...runsUp)})`);
console.log(`  DESCEND: run moyen ${mean(runsDn).toFixed(1)} barres (max ${Math.max(...runsDn)})`);
console.log(`  autocorr lag-1 de ΔADX : ${(()=>{const m=mean(d1);let n=0,dn=0;for(let i=0;i<d1.length;i++){dn+=(d1[i]-m)**2;if(i>0)n+=(d1[i]-m)*(d1[i-1]-m);}return (n/dn).toFixed(3);})()}`);
