// test_k_perasset_stability.mjs
// La disparite inter-actifs de la distribution K est-elle une propriete STABLE de l'actif,
// ou un artefact du regime (trend) de la periode ? -> decoupe 6 mois en 2 moities chrono,
// compare P10/P50/P90 de K moitie1 vs moitie2 par actif. Si drift temporel ~ spread inter-actifs
// => pas une signature d'actif => config par actif = overfit periode.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const TF = 'M15'; // max de barres pour percentiles stables par moitie
function pctl(s,p){const r=p/100*(s.length-1),lo=Math.floor(r),hi=Math.ceil(r);return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(r-lo);}
const assets = fs.readdirSync(DIR).filter(f=>new RegExp(`^hist_.+_${TF}\\.csv$`).test(f))
  .map(f=>f.replace(/^hist_/,'').replace(new RegExp(`_${TF}\\.csv$`),'')).sort();

const rowsOut = [];
for (const a of assets) {
  const fp = path.join(DIR, `hist_${a}_${TF}.csv`);
  if (!fs.existsSync(fp)) continue;
  const L = fs.readFileSync(fp,'utf8').split(/\r?\n/); const h=L[0].split(';'); const ik=h.indexOf('stoch_k');
  const K=[]; // ordre DESC (recent en haut)
  for(let i=1;i<L.length;i++){const c=L[i].split(';');if(c.length<h.length)continue;const k=+c[ik];if(Number.isFinite(k))K.push(k);}
  K.reverse(); // chronologique
  const mid = Math.floor(K.length/2);
  const h1 = K.slice(0,mid).sort((x,y)=>x-y);   // 1ere moitie (ancienne)
  const h2 = K.slice(mid).sort((x,y)=>x-y);      // 2eme moitie (recente)
  const p = arr => [pctl(arr,10),pctl(arr,50),pctl(arr,90)];
  const [a10,a50,a90]=p(h1),[b10,b50,b90]=p(h2);
  rowsOut.push({a,med1:a50,med2:b50,dMed:b50-a50,p90_1:a90,p90_2:b90,dP90:b90-a90,p10_1:a10,p10_2:b10,dP10:b10-a10});
}

console.log(`Stabilite temporelle de stoch_K (${TF}, 6 mois coupes en 2 moities) :\n`);
console.log(['asset'.padEnd(12),'med_H1','med_H2','dMed','|','P90_H1','P90_H2','dP90','|','P10_H1','P10_H2','dP10'].map(s=>s.padStart(7)).join(''));
for(const r of rowsOut){
  console.log([r.a.padEnd(12),
    r.med1.toFixed(1),r.med2.toFixed(1),(r.dMed>=0?'+':'')+r.dMed.toFixed(1),'|',
    r.p90_1.toFixed(1),r.p90_2.toFixed(1),(r.dP90>=0?'+':'')+r.dP90.toFixed(1),'|',
    r.p10_1.toFixed(1),r.p10_2.toFixed(1),(r.dP10>=0?'+':'')+r.dP10.toFixed(1)
  ].map(s=>String(s).padStart(7)).join(''));
}
// agregats
const stat=(arr)=>{const mean=arr.reduce((a,b)=>a+b,0)/arr.length;const std=Math.sqrt(arr.reduce((a,b)=>a+(b-mean)**2,0)/arr.length);return{mean,std,absMean:arr.reduce((a,b)=>a+Math.abs(b),0)/arr.length,max:Math.max(...arr.map(Math.abs))};};
const dMed=stat(rowsOut.map(r=>r.dMed));
// spread inter-actifs (sur la periode entiere = moyenne des 2 moities)
const medAll=rowsOut.map(r=>(r.med1+r.med2)/2);
const crossSpread={min:Math.min(...medAll),max:Math.max(...medAll),std:stat(medAll).std};
console.log('\n--- SYNTHESE (mediane K) ---');
console.log(`  Drift temporel intra-actif |dMed| : moyen=${dMed.absMean.toFixed(1)}  max=${dMed.max.toFixed(1)}  (std des drifts=${dMed.std.toFixed(1)})`);
console.log(`  Spread inter-actifs (mediane)     : min=${crossSpread.min.toFixed(1)} max=${crossSpread.max.toFixed(1)} std=${crossSpread.std.toFixed(1)}`);
console.log(`  Ratio drift/spread                : ${(dMed.absMean/crossSpread.std).toFixed(2)}  (>~1 => la disparite n'est PAS une signature stable d'actif)`);
