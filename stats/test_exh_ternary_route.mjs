// test_exh_ternary_route.mjs
// Recadrage: a un cross d'exhaustion, la bonne action est EXH (reverse) / CONT (continue) / WAIT (chop).
// Un mean-fade ~0 peut etre un MELANGE reverse(+)/continue(-). On classe l'issue forward en 3
// et on regarde quel CONTEXTE deplace le melange (=> routeur).
// REVERSAL = fade gagne (prix va contre le mouvement anterieur) ; CONTINUATION = prix reprend ; CHOP = |move|<thr.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const TFS = ['M15', 'H1'];
const HORIZON = 4;
const THR = 0.5;          // seuil ATR pour trancher reverse/continue vs chop
const EXT_HI = 80, EXT_LO = 20;
const ATR_N = 14, MIN_STEP = 3;
const ADXB = [[0,28],[28,37],[37,47],[47,999]];
const ADXL = ['ADX<28','ADX28-37','ADX37-47','ADX>=47'];
const ZB = [[-99,0],[0,1],[1,2],[2,99]];
const ZL = ['z<=0','z0-1','z1-2','z>=2'];
const DEPTHB = [[80,90],[90,101]];      // sell: prev.k ; profondeur extreme
const DEPTHL = ['extreme modere','extreme profond'];

const assets = fs.readdirSync(DIR).filter(f=>/^hist_.+_H1\.csv$/.test(f)).map(f=>f.replace(/^hist_/,'').replace(/_H1\.csv$/,'')).sort();

function load(fp){
  const L=fs.readFileSync(fp,'utf8').split(/\r?\n/);const h=L[0].split(';');const I=n=>h.indexOf(n);
  const iH=I('high'),iL=I('low'),iC=I('close'),iK=I('stoch_k'),iD=I('stoch_d'),iIC=I('intraday_change');
  const r=[];
  for(let i=1;i<L.length;i++){const c=L[i].split(';');if(c.length<h.length)continue;
    const o={high:+c[iH],low:+c[iL],close:+c[iC],k:+c[iK],d:+c[iD],ic:+c[iIC],adx:+c[I('adx14')],pdi:+c[I('plus_di')],mdi:+c[I('minus_di')]};o.kd=o.k-o.d;
    if([o.high,o.low,o.close,o.k,o.d,o.ic,o.adx].every(Number.isFinite))r.push(o);}
  r.reverse();
  for(let i=0;i<r.length;i++){const tr=i===0?r[i].high-r[i].low:Math.max(r[i].high-r[i].low,Math.abs(r[i].high-r[i-1].close),Math.abs(r[i].low-r[i-1].close));r[i].tr=tr;}
  for(let i=0;i<r.length;i++){if(i<ATR_N){r[i].atr=null;continue;}let s=0;for(let j=i-ATR_N+1;j<=i;j++)s+=r[j].tr;r[i].atr=s/ATR_N;}
  const ics=r.map(x=>x.ic);const m=ics.reduce((a,b)=>a+b,0)/ics.length;const sd=Math.sqrt(ics.reduce((a,b)=>a+(b-m)**2,0)/ics.length);
  return {r,sd};
}
// accumulateur 3-way
function mk(){return {rev:0,cont:0,chop:0,n:0};}
function add(acc,fadeRet){acc.n++; if(fadeRet>THR)acc.rev++; else if(fadeRet<-THR)acc.cont++; else acc.chop++;}
function show(label,acc){
  if(!acc.n){console.log(`    ${label.padEnd(16)} n=0`);return;}
  const pr=x=>((100*x/acc.n).toFixed(0)+'%').padStart(5);
  const edge=(acc.rev-acc.cont)/acc.n*100;
  console.log(`    ${label.padEnd(16)} n=${String(acc.n).padStart(5)}  REV${pr(acc.rev)}  CONT${pr(acc.cont)}  CHOP${pr(acc.chop)}   rev-cont=${(edge>=0?'+':'')+edge.toFixed(0)}pt`);
}

for(const tf of TFS){
  const all=mk();
  const byAdx=ADXB.map(mk), byZ=ZB.map(mk), byDepth=DEPTHB.map(mk);
  for(const a of assets){
    const fp=path.join(DIR,`hist_${a}_${tf}.csv`);if(!fs.existsSync(fp))continue;
    const {r,sd}=load(fp);if(!(sd>0))continue;
    for(let i=1;i<r.length-HORIZON;i++){
      const p=r[i-1],c=r[i];if(p.kd===0)continue;
      const sell=p.kd>0&&c.kd<0&&p.k>=EXT_HI, buy=p.kd<0&&c.kd>0&&p.k<=EXT_LO;
      if(!sell&&!buy)continue; if(Math.abs(p.kd)<MIN_STEP)continue; if(c.atr==null||c.atr<=0)continue;
      const fwd=r[i+HORIZON].close-c.close; const fadeRet=(sell?-fwd:fwd)/c.atr;
      add(all,fadeRet);
      let ai=ADXB.findIndex(([lo,hi])=>c.adx>=lo&&c.adx<hi);if(ai<0)ai=ADXB.length-1;add(byAdx[ai],fadeRet);
      const stretch=sell?c.ic:-c.ic;const z=stretch/sd;let zi=ZB.findIndex(([lo,hi])=>z>=lo&&z<hi);if(zi<0)zi=ZB.length-1;add(byZ[zi],fadeRet);
      const depth=sell?p.k:(100-p.k);let di=DEPTHB.findIndex(([lo,hi])=>depth>=lo&&depth<hi);if(di<0)di=DEPTHB.length-1;add(byDepth[di],fadeRet);
    }
  }
  console.log(`\n================= ${tf}  (horizon ${HORIZON}, seuil ${THR} ATR, extreme ${EXT_HI}/${EXT_LO}) =================`);
  show('TOUS',all);
  console.log('  -- par ADX --'); byAdx.forEach((acc,i)=>show(ADXL[i],acc));
  console.log('  -- par vitesse intraday (z) --'); byZ.forEach((acc,i)=>show(ZL[i],acc));
  console.log('  -- par profondeur extreme --'); byDepth.forEach((acc,i)=>show(DEPTHL[i],acc));
}
