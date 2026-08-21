import fs from 'fs';
import { detectOpportunity } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
const dir='C:/Users/Public/Neo-Backtest/data/matrix';
let bars=0, seqOk=0, pinchLow=0, sellCandidate=0;
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.csv'))){
  const raw=fs.readFileSync(`${dir}/${f}`,'utf8').split(/\r?\n/).filter(l=>l.trim());
  const H=raw[0].split(';').map(h=>h.trim());const seen=new Set();
  for(let i=1;i<raw.length;i++){const v=raw[i].split(';');const hk=String(v[1]??'').slice(0,13);if(seen.has(hk))continue;seen.add(hk);
    const o={};H.forEach((h,j)=>{const s=v[j]?.trim();const n=Number(s);o[h]=(s!==''&&Number.isFinite(n))?n:s;});
    const kd=['s0','s1','s2'].map(s=>{const k=Number(o['stoch_k_h1_'+s]),d=Number(o['stoch_d_h1_'+s]);return (Number.isFinite(k)&&Number.isFinite(d))?k-d:null;});
    if(kd.some(x=>x==null))continue; bars++; seqOk++;
    const k0=Number(o['stoch_k_h1_s0']);
    const pinch=Math.abs(kd[0])<Math.abs(kd[1])&&Math.abs(kd[1])<Math.abs(kd[2]);
    if(k0<20&&pinch){pinchLow++;
      // ce bar serait-il un CONT SELL candidate ? (Soft Bear SELL exige %K>45 → non ; donc jamais)
    }
  }
}
console.log(`barres dédup ${bars} · h1KdSeq OK ${seqOk}`);
console.log(`signature SELL pinch (%K<20 & K−D resserre) : ${pinchLow} barres (${(100*pinchLow/bars).toFixed(1)}%)`);
console.log(`\n⚠ MAIS Soft Bear SELL tire à %K>45 (soft-entry miroir) → ces barres %K<20 ne sont JAMAIS des CONT SELL fires.`);
