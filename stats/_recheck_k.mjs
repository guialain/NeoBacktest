import fs from 'fs';
const KP=5, SLOW=3;
const mtMin=s=>{const m=String(s).match(/(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})/);return m?Math.floor(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])/60000):null;};
const lines=fs.readFileSync('./data/ohlc/ohlc_COCOA_M1.csv','utf8').split(/\r?\n/).filter(Boolean);
const m1=[],byMin=new Map();
for(let i=1;i<lines.length;i++){const p=lines[i].split(';');const ep=mtMin(p[0]);if(ep==null)continue;const b={ep,o:+p[1],h:+p[2],l:+p[3],c:+p[4]};m1.push(b);byMin.set(ep,b);}
m1.sort((a,b)=>a.ep-b.ep);
// H1 bars closes
const map=new Map();
for(const b of m1){const st=Math.floor(b.ep/60)*60;let bar=map.get(st);if(!bar){bar={start:st,h:b.h,l:b.l,c:b.c};map.set(st,bar);}else{bar.h=Math.max(bar.h,b.h);bar.l=Math.min(bar.l,b.l);bar.c=b.c;}}
const bars=[...map.values()].sort((a,b)=>a.start-b.start);
const rawKAt=i=>{if(i<KP-1)return null;let hh=-1e9,ll=1e9;for(let j=i-KP+1;j<=i;j++){hh=Math.max(hh,bars[j].h);ll=Math.min(ll,bars[j].l);}const r=hh-ll;return r>0?100*(bars[i].c-ll)/r:0;};
const raw=bars.map((_,i)=>rawKAt(i));
const idxByStart=new Map(bars.map((b,i)=>[b.start,i]));
// forming %K à t = 13:24
const t=mtMin('2026.07.07 13:24');
const start=Math.floor(t/60)*60;
const iClosedLast=idxByStart.get(start)-1;
let hh=-1e9,ll=1e9,cc=null;
for(let ep=start;ep<=t;ep++){const b=byMin.get(ep);if(b){hh=Math.max(hh,b.h);ll=Math.min(ll,b.l);cc=b.c;}}
let H=hh,L=ll;for(let j=iClosedLast;j>iClosedLast-(KP-1);j--){H=Math.max(H,bars[j].h);L=Math.min(L,bars[j].l);}
const rawKpartial=(H-L)>0?100*(cc-L)/(H-L):0;
const k0=(rawKpartial+raw[iClosedLast]+raw[iClosedLast-1])/3;
console.log('bougie 13h en formation @13:24 : close(running)=',cc,' H5=',H,' L5=',L);
console.log('rawK partiel =', rawKpartial.toFixed(2), ' | rawK[12h]=',raw[iClosedLast]?.toFixed(2),' rawK[11h]=',raw[iClosedLast-1]?.toFixed(2));
console.log('→ %K s0 (SMA3) RECOMPUTÉ =', k0.toFixed(2), '  vs STOCKÉ 4.82');
// closes des dernières H1 pour recouper
console.log('\ncloses H1 rawK (dérnières):', bars.slice(iClosedLast-3,iClosedLast+1).map((b,ix)=>`${new Date(b.start*60000).toISOString().slice(11,16)}=${rawKAt(iClosedLast-3+ix)?.toFixed(1)}`).join(' '));
