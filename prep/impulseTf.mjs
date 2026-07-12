import fs from "fs";
import { detectOpportunity } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { observeProfile } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js";
import { admissionBlock } from "../src/components/simulations/matrixBacktest.mjs";
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const TP=0.65,SL=1.95,CAD=2;
// --- 1. confirmer le bar 17:54 ---
{
  const L=fs.readFileSync("./data/matrix/US_TECH100.csv","utf8").split(/\r?\n/).filter(Boolean);
  const h=L[0].split(";");const rows=L.slice(1).map(l=>{const v=l.split(";");const o={};h.forEach((k,i)=>o[k]=v[i]);return o;});
  const r=rows.find(x=>String(x.timestamp).startsWith("2026.07.08 17:54"));
  const det=detectOpportunity(r,"US_TECH100");const v=det.vector;
  console.log("=== US_TECH100 17:54:04 — décomposition impulse ===");
  console.log(`H1  : K−D = ${v.perTf?.h1?.kd}  (poids 0.60)`);
  console.log(`M15 : K−D = ${v.perTf?.m15?.kd}  (poids 0.40)`);
  console.log(`score impulse = ${v.score}  → bande ${det.marketProfile? observeProfile(det).impulse : "?"}`);
  console.log(`brut stoch: kH1=${r.stoch_k_h1_s0} dH1=${r.stoch_d_h1_s0} | kM15=${r.stoch_k_m15_s0} dM15=${r.stoch_d_m15_s0}`);
}
// --- 2. mesure : Range fires, H1 confirme impulse ? ---
const assets=fs.readdirSync("./data/matrix").filter(f=>f.endsWith(".csv")).map(f=>f.replace(".csv",""));
function outcome(series,i,side,atr){const p0=series[i].price,day=series[i].day,sgn=side==="BUY"?1:-1;if(p0==null||!(atr>0))return null;const tp=p0+sgn*TP*atr,sl=p0-sgn*SL*atr;for(let j=i+1;j<series.length&&series[j].day===day;j++){const px=series[j].price;if(px==null)continue;if(sgn>0?px>=tp:px<=tp)return"WIN";if(sgn>0?px<=sl:px>=sl)return"LOSS";}const last=series.filter((s,k)=>k>i&&s.day===day).pop();return last&&((last.price-p0)*sgn>0)?"WIN":"LOSS";}
// bucket par (confirme H1 dans le sens ? avec deadband) — balaye plusieurs deadbands
const DB=[0,1,2,3];
const buckets={};DB.forEach(d=>buckets[d]={confirm:{WIN:0,LOSS:0},neutralOpp:{WIN:0,LOSS:0}});
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
    for(const d of DB){
      const confirms = want>0 ? h1kd>d : h1kd<-d;   // H1 dans le sens au-delà du deadband
      buckets[d][confirms?"confirm":"neutralOpp"][out]++;
    }
  }
}
console.log("\n=== Range fires : H1 confirme-t-il l'impulse ? (par deadband |K−D|_h1) ===");
const wr=b=>{const n=b.WIN+b.LOSS;return n?`${(100*b.WIN/n).toFixed(0)}% (${b.WIN}W/${b.LOSS}L, n=${n})`:"—";};
for(const d of DB){
  console.log(`deadband ${d}:  H1 CONFIRME → ${wr(buckets[d].confirm)}   |   H1 neutre/opposé → ${wr(buckets[d].neutralOpp)}`);
}
