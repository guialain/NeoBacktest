import fs from 'fs';
const KP=5;
const mtMin=s=>{const m=String(s).match(/(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})/);return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])/60000):null;};
const lines=fs.readFileSync('./data/ohlc/ohlc_COCOA_M1.csv','utf8').split(/\r?\n/).filter(Boolean);
const byMin=new Map(),m1=[];
for(let i=1;i<lines.length;i++){const p=lines[i].split(';');const ep=mtMin(p[0]);if(ep==null)continue;const b={ep,o:+p[1],h:+p[2],l:+p[3],c:+p[4]};byMin.set(ep,b);m1.push(b);}
m1.sort((a,b)=>a.ep-b.ep);
const map=new Map();
for(const b of m1){const st=Math.floor(b.ep/60)*60;let bar=map.get(st);if(!bar){bar={start:st,h:b.h,l:b.l,c:b.c};map.set(st,bar);}else{bar.h=Math.max(bar.h,b.h);bar.l=Math.min(bar.l,b.l);bar.c=b.c;}}
const bars=[...map.values()].sort((a,b)=>a.start-b.start);
const rawKAt=i=>{if(i<KP-1)return null;let hh=-1e9,ll=1e9;for(let j=i-KP+1;j<=i;j++){hh=Math.max(hh,bars[j].h);ll=Math.min(ll,bars[j].l);}const r=hh-ll;return r>0?100*(bars[i].c-ll)/r:0;};
const raw=bars.map((_,i)=>rawKAt(i));
const idx=new Map(bars.map((b,i)=>[b.start,i]));
function formingK(t){const start=Math.floor(t/60)*60;const iL=idx.get(start)-1;let hh=-1e9,ll=1e9,cc=null;for(let ep=start;ep<=t;ep++){const b=byMin.get(ep);if(b){hh=Math.max(hh,b.h);ll=Math.min(ll,b.l);cc=b.c;}}let H=hh,L=ll;for(let j=iL;j>iL-(KP-1);j--){H=Math.max(H,bars[j].h);L=Math.min(L,bars[j].l);}const rp=(H-L)>0?100*(cc-L)/(H-L):0;return {k:(rp+raw[iL]+raw[iL-1])/3, cc, rp};}
console.log('reconstruit — %K forming DANS la bougie 13h (close price · rawK partiel · %K lissé) :');
for(const hm of ['13:00','13:12','13:24','13:36','13:48','13:59']){const t=mtMin('2026.07.07 '+hm);const r=formingK(t);console.log(`  ${hm}  prix=${r.cc}  rawK=${r.rp.toFixed(1).padStart(5)}  %K=${r.k.toFixed(2)}`);}
// close 13h (= barre close, slowed K)
const i13=idx.get(mtMin('2026.07.07 13:00'));
const K13=(raw[i13]+raw[i13-1]+raw[i13-2])/3, K14=(raw[i13+1]+raw[i13]+raw[i13-1])/3;
console.log(`\ncloses lissées : 13h = ${K13.toFixed(2)} (stocké 21.06)  ·  14h = ${K14.toFixed(2)} (stocké ~33?)`);
console.log(`rawK closes : 12h=${raw[i13-1].toFixed(1)} 13h=${raw[i13].toFixed(1)} 14h=${raw[i13+1].toFixed(1)}`);
