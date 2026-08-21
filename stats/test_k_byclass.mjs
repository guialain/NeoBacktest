// test_k_byclass.mjs — distribution stoch_K par CLASSE d'actif + stabilite temporelle + accord intra-classe.
// Classes = resolveMarket (memoire). Repond a: (1) distrib K par classe, (2) drift 2 moities, (3) dispersion intra-classe.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const TF = 'M15';
const CLASSES = {
  FX:     ['AUDUSD','EURUSD','GBPUSD','USDCAD','USDCHF','USDJPY'],
  INDEX:  ['GERMANY_40','UK_100','US_30','US_500','US_TECH100'],
  CRYPTO: ['BTCUSD','ETHUSD'],
  METAL:  ['GOLD','SILVER'],
  ENERGY: ['BRENT_OIL','CrudeOIL','GASOLINE'],
  AGRI:   ['COCOA'],
};
function pctl(s,p){if(!s.length)return null;const r=p/100*(s.length-1),lo=Math.floor(r),hi=Math.ceil(r);return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(r-lo);}

function loadK(a){
  const fp=path.join(DIR,`hist_${a}_${TF}.csv`); if(!fs.existsSync(fp))return null;
  const L=fs.readFileSync(fp,'utf8').split(/\r?\n/);const h=L[0].split(';');const ik=h.indexOf('stoch_k');
  const K=[];for(let i=1;i<L.length;i++){const c=L[i].split(';');if(c.length<h.length)continue;const k=+c[ik];if(Number.isFinite(k))K.push(k);}
  K.reverse(); return K; // chronologique
}
const std=arr=>{const m=arr.reduce((a,b)=>a+b,0)/arr.length;return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length);};

console.log(`Distribution stoch_K par CLASSE (${TF}) :\n`);
console.log(['classe'.padEnd(9),'P5','P10','P20','P50','P80','P90','P95','|','medH1','medH2','dMed','|','med_min','med_max','intraStd'].map(s=>s.padStart(7)).join(''));

const summary=[];
for(const [cls,members] of Object.entries(CLASSES)){
  const pooled=[]; const perAssetMed=[]; const h1med=[],h2med=[];
  for(const a of members){
    const K=loadK(a); if(!K)continue;
    pooled.push(...K);
    const s=[...K].sort((x,y)=>x-y); perAssetMed.push(pctl(s,50));
    const mid=Math.floor(K.length/2);
    h1med.push(pctl([...K.slice(0,mid)].sort((x,y)=>x-y),50));
    h2med.push(pctl([...K.slice(mid)].sort((x,y)=>x-y),50));
  }
  const ps=[...pooled].sort((x,y)=>x-y);
  const P=q=>pctl(ps,q);
  const medH1=h1med.reduce((a,b)=>a+b,0)/h1med.length, medH2=h2med.reduce((a,b)=>a+b,0)/h2med.length;
  const intraStd = perAssetMed.length>1 ? std(perAssetMed) : 0;
  summary.push({cls,p50:P(50),p90:P(90),p10:P(10),dMed:medH2-medH1,intraStd,medMin:Math.min(...perAssetMed),medMax:Math.max(...perAssetMed)});
  console.log([cls.padEnd(9),
    P(5).toFixed(1),P(10).toFixed(1),P(20).toFixed(1),P(50).toFixed(1),P(80).toFixed(1),P(90).toFixed(1),P(95).toFixed(1),'|',
    medH1.toFixed(1),medH2.toFixed(1),(medH2-medH1>=0?'+':'')+(medH2-medH1).toFixed(1),'|',
    Math.min(...perAssetMed).toFixed(1),Math.max(...perAssetMed).toFixed(1),intraStd.toFixed(1)
  ].map(s=>String(s).padStart(7)).join(''));
}

console.log('\n--- LECTURE ---');
const crossClassStd = std(summary.map(s=>s.p50));
console.log(`  Spread INTER-classes (mediane K)   : ${Math.min(...summary.map(s=>s.p50)).toFixed(1)}..${Math.max(...summary.map(s=>s.p50)).toFixed(1)}  std=${crossClassStd.toFixed(1)}`);
console.log(`  Drift temporel |dMed| par classe   : moyen=${(summary.reduce((a,s)=>a+Math.abs(s.dMed),0)/summary.length).toFixed(1)}  max=${Math.max(...summary.map(s=>Math.abs(s.dMed))).toFixed(1)}`);
console.log(`  Dispersion INTRA-classe (std med)  : moyen=${(summary.reduce((a,s)=>a+s.intraStd,0)/summary.length).toFixed(1)}  max=${Math.max(...summary.map(s=>s.intraStd)).toFixed(1)}`);
console.log(`  => si drift >~ spread inter-classes : config par classe = aussi overfit regime`);
