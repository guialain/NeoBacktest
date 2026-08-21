import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const all=[];
for (const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D,f)).signals||[])) if (typeof s.R==="number") all.push(s);
const cont=all.filter(s=>s.type==="CONTINUATION" && s.zscoreH1!=null);
console.log(`CONT avec zscoreH1 : ${cont.length}/${all.filter(s=>s.type==="CONTINUATION").length}`);
const agg=r=>{const w=r.filter(s=>s.outcome==="WIN").length,l=r.filter(s=>s.outcome==="LOSS").length,R=r.reduce((x,s)=>x+s.R,0);return{n:r.length,wr:(w+l)?w/(w+l)*100:0,R,avg:r.length?R/r.length:0};};
const fmt=a=>`n ${String(a.n).padStart(4)} · WR ${a.wr.toFixed(1).padStart(5)}% · avgR ${(a.avg>=0?"+":"")+a.avg.toFixed(3)} · R ${(a.R>=0?"+":"")+a.R.toFixed(1)}`;
const P=(l,r)=>r.length?console.log(`  ${l.padEnd(34)} ${fmt(agg(r))}`):null;
// zscore agree : prix du bon côté de la moyenne
const zAgree=s=>(s.side==="BUY"&&s.zscoreH1>0)||(s.side==="SELL"&&s.zscoreH1<0);
console.log("\n### zscore vs sens du trade");
P("z AGREE (prix bon côté moyenne)", cont.filter(zAgree));
P("z CONTRE (prix mauvais côté)", cont.filter(s=>!zAgree(s)));
console.log("\n### le K/D ne tourne pas (pas cross, SEPARATED, div0≥0=pas imminent)");
const notTurning=s=>(s.crossState==="NONE"||s.crossState==null)&&s.obs?.contact==="SEPARATED"&&(s.div0==null||s.div0>=0);
P("pas de retournement amorcé", cont.filter(notTurning));
P("un retournement s'amorce", cont.filter(s=>!notTurning(s)));
console.log("\n### DESIGN owner : z AGREE + K/D ne tourne pas");
P("z AGREE + ne tourne pas", cont.filter(s=>zAgree(s)&&notTurning(s)));
P("z AGREE + tourne", cont.filter(s=>zAgree(s)&&!notTurning(s)));
P("z CONTRE + ne tourne pas", cont.filter(s=>!zAgree(s)&&notTurning(s)));
console.log("\n### référence : impulse actuel (ce qu'on remplace)");
const iAgree=s=>{const i=s.obs?.instantImpulse;return s.side==="BUY"?(i==="UP"||i==="FAST_UP"):(i==="DOWN"||i==="FAST_DOWN");};
P("impulse AGREE", cont.filter(iAgree));
P("impulse CONTRE", cont.filter(s=>!iAgree(s)));
