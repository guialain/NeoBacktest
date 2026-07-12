import fs from "fs";
import { detectOpportunity } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { observeProfile } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js";
import { triggerGate } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/TriggerGate.js";
import { admissionBlock } from "../src/components/simulations/matrixBacktest.mjs";
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const TP=0.65,SL=1.95,CAD=2;
const assets=fs.readdirSync("./data/matrix").filter(f=>f.endsWith(".csv")).map(f=>f.replace(".csv",""));
function outcome(series,i,side,atr){const p0=series[i].price,day=series[i].day,sgn=side==="BUY"?1:-1;if(p0==null||!(atr>0))return null;const tp=p0+sgn*TP*atr,sl=p0-sgn*SL*atr;for(let j=i+1;j<series.length&&series[j].day===day;j++){const px=series[j].price;if(px==null)continue;if(sgn>0?px>=tp:px<=tp)return"WIN";if(sgn>0?px<=sl:px>=sl)return"LOSS";}const last=series.filter((s,k)=>k>i&&s.day===day).pop();return last&&((last.price-p0)*sgn>0)?"WIN":"LOSS";}
// buckets[side][thetaDay] = {WIN,LOSS}
const B={BUY:{},SELL:{}};
const add=(side,key,out)=>{(B[side][key]??={WIN:0,LOSS:0});B[side][key][out]++;};
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
    const obs=observeProfile(det);const out=outcome(series,i,side,series[i].atr);if(!out)continue;
    add(side,obs.thetaDay,out);
  }
}
const ORDER=["VERTICAL_UP","STEEP_UP","MILD_UP","FLAT","MILD_DOWN","STEEP_DOWN","VERTICAL_DOWN"];
for(const side of["SELL","BUY"]){
  console.log(`\n=== RANGE ${side} — WIN/LOSS par thetaDay ===`);
  let tw=0,tl=0;
  for(const k of ORDER){const b=B[side][k];if(!b)continue;const n=b.WIN+b.LOSS;tw+=b.WIN;tl+=b.LOSS;console.log(`  ${k.padEnd(14)} n=${String(n).padStart(3)}  WR=${(100*b.WIN/n).toFixed(0).padStart(3)}%  (${b.WIN}W/${b.LOSS}L)`);}
  console.log(`  ${"TOTAL".padEnd(14)} n=${String(tw+tl).padStart(3)}  WR=${(100*tw/(tw+tl)).toFixed(0).padStart(3)}%`);
}
