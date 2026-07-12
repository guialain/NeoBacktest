import fs from "fs";
import { detectOpportunity } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { admissionBlock } from "../src/components/simulations/matrixBacktest.mjs";
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const TP=0.65,SL=1.95,CAD=2;
const assets=fs.readdirSync("./data/matrix").filter(f=>f.endsWith(".csv")).map(f=>f.replace(".csv",""));
function outcome(series,i,side,atr){const p0=series[i].price,day=series[i].day,sgn=side==="BUY"?1:-1;if(p0==null||!(atr>0))return null;const tp=p0+sgn*TP*atr,sl=p0-sgn*SL*atr;for(let j=i+1;j<series.length&&series[j].day===day;j++){const px=series[j].price;if(px==null)continue;if(sgn>0?px>=tp:px<=tp)return"WIN";if(sgn>0?px<=sl:px>=sl)return"LOSS";}const last=series.filter((s,k)=>k>i&&s.day===day).pop();return last&&((last.price-p0)*sgn>0)?"WIN":"LOSS";}
const DB=2;   // deadband |K−D|_h1 pour "neutre"
const B={confirm:{WIN:0,LOSS:0},neutre:{WIN:0,LOSS:0},oppose:{WIN:0,LOSS:0}};
// aussi split par côté pour l'oppose
const BS={BUY:{confirm:{WIN:0,LOSS:0},neutre:{WIN:0,LOSS:0},oppose:{WIN:0,LOSS:0}},SELL:{confirm:{WIN:0,LOSS:0},neutre:{WIN:0,LOSS:0},oppose:{WIN:0,LOSS:0}}};
for(const a of assets){
  const L=fs.readFileSync(`./data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(Boolean);
  const h=L[0].split(";");const rows=L.slice(1).map(l=>{const v=l.split(";");const o={};h.forEach((k,i)=>o[k]=v[i]);return o;});
  const sym=String(rows[0].symbol||a).toUpperCase();
  const series=rows.map(r=>({price:num(r.price),atr:num(r.atr_h1),day:String(r.ts_utc??r.timestamp).slice(0,10)}));
  let lastEp=-1e9;
  for(let i=0;i<rows.length;i++){
    const ep=Math.round(Date.parse(rows[i].ts_utc??rows[i].timestamp)/60000);
    if(!Number.isFinite(ep)||ep<lastEp+CAD)continue;lastEp=ep;
    if(admissionBlock(rows[i],sym))continue;
    let det;try{det=detectOpportunity(rows[i],sym);}catch{continue;}
    const sel=det.selection;if(sel?.strategy!=="RANGE")continue;const side=sel.side;if(side!=="BUY"&&side!=="SELL")continue;
    const h1kd=det.vector?.perTf?.h1?.kd;if(h1kd==null)continue;
    const out=outcome(series,i,side,series[i].atr);if(!out)continue;
    const want=side==="BUY"?1:-1;
    let cat;
    if(Math.abs(h1kd)<=DB)cat="neutre";
    else if(Math.sign(h1kd)===want)cat="confirm";
    else cat="oppose";
    B[cat][out]++;BS[side][cat][out]++;
  }
}
const wr=b=>{const n=b.WIN+b.LOSS;return n?`${(100*b.WIN/n).toFixed(0)}% (${b.WIN}W/${b.LOSS}L, n=${n})`:"—";};
console.log(`=== Range fires — H1 vs impulse (deadband |K−D|_h1 ≤ ${DB} = neutre) ===`);
console.log(`  confirme : ${wr(B.confirm)}`);
console.log(`  neutre   : ${wr(B.neutre)}`);
console.log(`  OPPOSE   : ${wr(B.oppose)}   ← le cas 17:54`);
for(const s of["SELL","BUY"]){
  console.log(`\n  ${s}: confirme ${wr(BS[s].confirm)} · neutre ${wr(BS[s].neutre)} · oppose ${wr(BS[s].oppose)}`);
}
