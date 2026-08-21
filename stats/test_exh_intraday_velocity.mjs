// test_exh_intraday_velocity.mjs
// Bucket du cross d'exhaustion par VITESSE/TENSION intraday (intraday_change), en z-score par actif.
// stretch = tension dans le sens qu'on fade : sell-exh -> +intraday_change ; buy-exh -> -intraday_change.
// z = stretch / std(intraday_change) de l'actif. Metrique = rendement fade forward en ATR.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const TFS = ['M15', 'H1', 'H4'];
const HORIZON = 4;
const EXT_HI = 80, EXT_LO = 20;
const ATR_N = 14;
const MIN_STEP = 3;
// buckets de stretch_z (sigmas journaliers dans le sens fade)
const ZB = [[-99,0],[0,1],[1,2],[2,99]];
const ZLBL = ['z<=0 (contre)','z 0-1','z 1-2','z>=2 (tres etire)'];

const assets = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f))
  .map(f => f.replace(/^hist_/, '').replace(/_H1\.csv$/, '')).sort();

function loadChrono(fp) {
  const L = fs.readFileSync(fp,'utf8').split(/\r?\n/); const h=L[0].split(';');
  const I=n=>h.indexOf(n);
  const iH=I('high'),iL=I('low'),iC=I('close'),iK=I('stoch_k'),iD=I('stoch_d'),iIC=I('intraday_change');
  const r=[];
  for(let i=1;i<L.length;i++){const c=L[i].split(';');if(c.length<h.length)continue;
    const o={high:+c[iH],low:+c[iL],close:+c[iC],k:+c[iK],d:+c[iD],ic:+c[iIC]}; o.kd=o.k-o.d;
    if([o.high,o.low,o.close,o.k,o.d,o.ic].every(Number.isFinite))r.push(o);}
  r.reverse();
  for(let i=0;i<r.length;i++){const tr=i===0?r[i].high-r[i].low:Math.max(r[i].high-r[i].low,Math.abs(r[i].high-r[i-1].close),Math.abs(r[i].low-r[i-1].close));r[i].tr=tr;}
  for(let i=0;i<r.length;i++){if(i<ATR_N){r[i].atr=null;continue;}let s=0;for(let j=i-ATR_N+1;j<=i;j++)s+=r[j].tr;r[i].atr=s/ATR_N;}
  // std de intraday_change de l'actif
  const ics=r.map(x=>x.ic); const m=ics.reduce((a,b)=>a+b,0)/ics.length;
  const sd=Math.sqrt(ics.reduce((a,b)=>a+(b-m)**2,0)/ics.length);
  return {r, sd};
}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const hit=a=>a.length?100*a.filter(x=>x>0).length/a.length:null;
const stat=a=>a.length?`n=${String(a.length).padStart(5)}  mean=${(mean(a)>=0?'+':'')+mean(a).toFixed(3)}  hit=${hit(a).toFixed(1)}%`:`n=    0`;

for (const tf of TFS) {
  const B = ZB.map(()=>[]);
  for (const a of assets) {
    const fp=path.join(DIR,`hist_${a}_${tf}.csv`); if(!fs.existsSync(fp))continue;
    const {r,sd}=loadChrono(fp); if(!(sd>0))continue;
    for(let i=1;i<r.length-HORIZON;i++){
      const p=r[i-1],c=r[i]; if(p.kd===0)continue;
      const sellExh=p.kd>0&&c.kd<0&&p.k>=EXT_HI;
      const buyExh =p.kd<0&&c.kd>0&&p.k<=EXT_LO;
      if(!sellExh&&!buyExh)continue;
      if(Math.abs(p.kd)<MIN_STEP)continue;
      if(c.atr==null||c.atr<=0)continue;
      const stretch=sellExh? c.ic : -c.ic;   // tension dans le sens fade
      const z=stretch/sd;
      const fwd=r[i+HORIZON].close-c.close;
      const fadeRet=(sellExh?-fwd:fwd)/c.atr;
      let bi=ZB.findIndex(([lo,hi])=>z>=lo&&z<hi); if(bi<0)bi=ZB.length-1;
      B[bi].push(fadeRet);
    }
  }
  console.log(`\n================= ${tf}  (horizon ${HORIZON}, extreme ${EXT_HI}/${EXT_LO}, min-pas ${MIN_STEP}) =================`);
  ZB.forEach((_,bi)=>console.log(`  ${ZLBL[bi].padEnd(20)} ${stat(B[bi])}`));
  console.log(`  ${'TOUS'.padEnd(20)} ${stat(B.flat())}`);
}
