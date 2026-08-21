import fs from 'fs';
import { maturityGate } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
const dir = 'C:/Users/Public/Neo-Backtest/data/matrix';
const arr = [];
for (const f of fs.readdirSync(dir).filter(x=>x.endsWith('.csv'))) {
  const raw = fs.readFileSync(`${dir}/${f}`,'utf8').split(/\r?\n/).filter(l=>l.trim());
  const H = raw[0].split(';').map(h=>h.trim()); const seen=new Set();
  for (let i=1;i<raw.length;i++){ const v=raw[i].split(';'); const k=f+'|'+String(v[1]??'').slice(0,13); if(seen.has(k))continue; seen.add(k);
    const o={}; H.forEach((h,j)=>{const s=v[j]?.trim();const n=Number(s);o[h]=(s!==''&&Number.isFinite(n))?n:s;});
    const m=maturityGate(o); if(m.score!=null) arr.push(m.score); }
}
arr.sort((a,b)=>a-b); const n=arr.length;
const P=p=>arr[Math.min(n-1,Math.floor(p*n))];
console.log(`n=${n} barres H1 (dédup)\n`);
console.log('percentile → score :');
for(const p of [50,55,60,65,70,75,80,85,87,90,93,95,97]) console.log(`  p${p} → ${P(p/100)}`);
console.log('\nsi (late,exhausted) = (X,Y), part des barres par bande :');
for(const [L,E] of [[43,73],[43,80],[38,73],[48,78],[43,85],[50,80]]){
  const mid=100*arr.filter(s=>s<L).length/n, lt=100*arr.filter(s=>s>=L&&s<E).length/n, ex=100*arr.filter(s=>s>=E).length/n;
  console.log(`  late=${L} exh=${E} :  MID ${mid.toFixed(0)}%  LATE ${lt.toFixed(0)}%  EXHAUSTED ${ex.toFixed(0)}%`);
}
