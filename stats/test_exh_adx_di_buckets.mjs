// test_exh_adx_di_buckets.mjs
// Sous-buckets du cross d'exhaustion par ADX(14) x (fade AVEC vs CONTRE le DI dominant).
// Event = extreme %K (>=80 / <=20) + flip de signe k-d EN SENS.
// Metrique = rendement fade forward en ATR (H barres). >0 = le fade a marche (prix s'est retourne).
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const TFS = ['M15', 'H1', 'H4'];
const HORIZON = 4;
const EXT_HI = 80, EXT_LO = 20;
const ATR_N = 14;
const MIN_STEP = 3;   // filtre significativite: |k-d| barre AVANT flip >= 3 (pas un micro-flip)
// buckets recalibres sur les percentiles reels de ADX (median ~28, P75~37, P90~47) — cf Resultat #7
const ADX_BUCKETS = [[0,28],[28,37],[37,47],[47,999]];

const assets = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f))
  .map(f => f.replace(/^hist_/, '').replace(/_H1\.csv$/, '')).sort();

function loadChrono(fp) {
  const L = fs.readFileSync(fp, 'utf8').split(/\r?\n/);
  const h = L[0].split(';');
  const I = n => h.indexOf(n);
  const iH=I('high'),iL=I('low'),iC=I('close'),iK=I('stoch_k'),iD=I('stoch_d'),iA=I('adx14'),iP=I('plus_di'),iM=I('minus_di');
  const r = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(';'); if (c.length < h.length) continue;
    const o={high:+c[iH],low:+c[iL],close:+c[iC],k:+c[iK],d:+c[iD],adx:+c[iA],pdi:+c[iP],mdi:+c[iM]};
    o.kd=o.k-o.d;
    if ([o.high,o.low,o.close,o.k,o.d,o.adx,o.pdi,o.mdi].every(Number.isFinite)) r.push(o);
  }
  r.reverse();
  for (let i=0;i<r.length;i++){
    const tr=i===0?r[i].high-r[i].low:Math.max(r[i].high-r[i].low,Math.abs(r[i].high-r[i-1].close),Math.abs(r[i].low-r[i-1].close));
    r[i].tr=tr;
  }
  for (let i=0;i<r.length;i++){ if(i<ATR_N){r[i].atr=null;continue;} let s=0;for(let j=i-ATR_N+1;j<=i;j++)s+=r[j].tr; r[i].atr=s/ATR_N; }
  return r;
}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const hit=a=>a.length?100*a.filter(x=>x>0).length/a.length:null;
function stat(a){return a.length?`n=${String(a.length).padStart(5)}  mean=${(mean(a)>=0?'+':'')+mean(a).toFixed(3)}  hit=${hit(a).toFixed(1)}%`:`n=    0`;}

for (const tf of TFS) {
  // buckets[with/against][adxIdx] = []
  const B={with:ADX_BUCKETS.map(()=>[]),against:ADX_BUCKETS.map(()=>[])};
  let nEvt=0;
  for (const a of assets) {
    const fp=path.join(DIR,`hist_${a}_${tf}.csv`); if(!fs.existsSync(fp))continue;
    const r=loadChrono(fp);
    for(let i=1;i<r.length-HORIZON;i++){
      const p=r[i-1],c=r[i];
      if(p.kd===0)continue;
      const sellExh = p.kd>0 && c.kd<0 && p.k>=EXT_HI;
      const buyExh  = p.kd<0 && c.kd>0 && p.k<=EXT_LO;
      if(!sellExh && !buyExh)continue;
      if(Math.abs(p.kd)<MIN_STEP)continue;         // filtre pas minimal
      if(c.atr==null||c.atr<=0)continue;
      nEvt++;
      const domUp = c.pdi>c.mdi;                    // DI dominant
      // fade AVEC le DI dominant ?
      const withDI = sellExh ? !domUp : domUp;      // sell-fade(down) AVEC si downtrend ; buy-fade(up) AVEC si uptrend
      const fwd=r[i+HORIZON].close-c.close;
      const fadeRet=(sellExh?-fwd:fwd)/c.atr;
      let ai=ADX_BUCKETS.findIndex(([lo,hi])=>c.adx>=lo&&c.adx<hi); if(ai<0)ai=ADX_BUCKETS.length-1;
      B[withDI?'with':'against'][ai].push(fadeRet);
    }
  }
  console.log(`\n================= ${tf}  (events=${nEvt}, horizon ${HORIZON}, min-pas ${MIN_STEP}) =================`);
  console.log(`ADX bucket        FADE AVEC DI dominant            FADE CONTRE DI dominant`);
  ADX_BUCKETS.forEach(([lo,hi],ai)=>{
    const lbl=(hi===999?`>=${lo}`:`${lo}-${hi}`).padEnd(8);
    console.log(`  ADX ${lbl}    ${stat(B.with[ai]).padEnd(34)} ${stat(B.against[ai])}`);
  });
  // agregats colonne
  const flat=k=>B[k].flat();
  console.log(`  ------------------------------------------------------------------`);
  console.log(`  TOUS ADX      ${stat(flat('with')).padEnd(34)} ${stat(flat('against'))}`);
}
