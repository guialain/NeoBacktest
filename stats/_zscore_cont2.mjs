import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const all=[];
for (const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D,f)).signals||[])) if (typeof s.R==="number") all.push(s);
const cont=all.filter(s=>s.type==="CONTINUATION");
const agg=r=>{const w=r.filter(s=>s.outcome==="WIN").length,l=r.filter(s=>s.outcome==="LOSS").length,R=r.reduce((x,s)=>x+s.R,0);return{n:r.length,wr:(w+l)?w/(w+l)*100:0,R,avg:r.length?R/r.length:0};};
const fmt=a=>`n ${String(a.n).padStart(4)} · WR ${a.wr.toFixed(1).padStart(5)}% · avgR ${(a.avg>=0?"+":"")+a.avg.toFixed(3)} · R ${(a.R>=0?"+":"")+a.R.toFixed(1)}`;
const P=(l,r)=>r.length?console.log(`  ${l.padEnd(30)} ${fmt(agg(r))}`):null;
// contre-cross = cross CONTRE le sens du trade
const counter=s=>(s.side==="BUY"&&s.crossState==="CROSS_DOWN")||(s.side==="SELL"&&s.crossState==="CROSS_UP");
const contact=s=>s.obs?.contact==="CONTACT";
const imminent=s=>s.div0!=null&&s.div0<0;   // lignes qui convergent
const turning=s=>counter(s)||contact(s)||imminent(s);
console.log("### le K/D amorce un RETOURNEMENT ? (contre-cross OU contact OU imminent div0<0)");
P("ne tourne pas → on suit", cont.filter(s=>!turning(s)));
P("tourne → on stoppe", cont.filter(turning));
console.log("\n### décomposition des 3 signaux de stop");
P("contre-cross", cont.filter(counter));
P("contact", cont.filter(contact));
P("imminent (div0<0) seul", cont.filter(s=>imminent(s)&&!counter(s)&&!contact(s)));
console.log("\n### zscore agree × ne tourne pas (design owner complet)");
const zAgree=s=>(s.side==="BUY"&&s.zscoreH1>0)||(s.side==="SELL"&&s.zscoreH1<0);
P("z AGREE + ne tourne pas", cont.filter(s=>zAgree(s)&&!turning(s)));
P("z AGREE + tourne", cont.filter(s=>zAgree(s)&&turning(s)));
P("z CONTRE + ne tourne pas", cont.filter(s=>!zAgree(s)&&!turning(s)));
P("z CONTRE + tourne", cont.filter(s=>!zAgree(s)&&turning(s)));
