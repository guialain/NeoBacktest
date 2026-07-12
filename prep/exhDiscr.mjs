import fs from "fs";
import { detectOpportunity } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { observeProfile } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js";
import { admissionBlock } from "../src/components/simulations/matrixBacktest.mjs";
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const TP=0.65,SL=1.95,CAD=2;
const assets=fs.readdirSync("./data/matrix").filter(f=>f.endsWith(".csv")).map(f=>f.replace(".csv",""));
function outcome(series,i,side,atr){const p0=series[i].price,day=series[i].day,sgn=side==="BUY"?1:-1;if(p0==null||!(atr>0))return null;const tp=p0+sgn*TP*atr,sl=p0-sgn*SL*atr;for(let j=i+1;j<series.length&&series[j].day===day;j++){const px=series[j].price;if(px==null)continue;if(sgn>0?px>=tp:px<=tp)return"WIN";if(sgn>0?px<=sl:px>=sl)return"LOSS";}const last=series.filter((s,k)=>k>i&&s.day===day).pop();return last&&((last.price-p0)*sgn>0)?"WIN":"LOSS";}
const add=(o,k,out)=>{(o[k]??={WIN:0,LOSS:0});o[k][out]++;};
const byZone={SELL:{},BUY:{}}, byRot={SELL:{},BUY:{}}, byZoneRot={SELL:{},BUY:{}};
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
    const sel=det.selection;if(sel?.strategy!=="EXH")continue;const side=sel.side;if(side!=="BUY"&&side!=="SELL")continue;
    const obs=observeProfile(det);const out=outcome(series,i,side,series[i].atr);if(!out)continue;
    add(byZone[side],obs.zone,out);
    add(byRot[side],obs.thetaRotation,out);
    add(byZoneRot[side],`${obs.zone} · rot=${obs.thetaRotation}`,out);
  }
}
const wr=b=>{const n=b.WIN+b.LOSS;return n?`${(100*b.WIN/n).toFixed(0).padStart(3)}% (${b.WIN}W/${b.LOSS}L, n=${n})`:"—";};
for(const side of["SELL","BUY"]){
  console.log(`\n===== EXH ${side} — par ZONE =====`);
  for(const [k,b] of Object.entries(byZone[side]).sort()) console.log(`  ${k.padEnd(15)} ${wr(b)}`);
  console.log(`  -- par thetaRotation --`);
  for(const [k,b] of Object.entries(byRot[side]).sort()) console.log(`  ${k.padEnd(15)} ${wr(b)}`);
}
console.log(`\n===== EXH SELL — zone × thetaRot (le cas : HAUTE · ROT_UP/ROT_DOWN) =====`);
for(const [k,b] of Object.entries(byZoneRot.SELL).sort((a,b)=>(b[1].WIN+b[1].LOSS)-(a[1].WIN+a[1].LOSS)).slice(0,8)) console.log(`  ${k.padEnd(26)} ${wr(b)}`);
