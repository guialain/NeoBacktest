import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const all=[];
for (const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D,f)).signals||[])) if (typeof s.R==="number" && s.diDelta!=null && s.dSpread!=null) all.push(s);
const agg=r=>{const w=r.filter(s=>s.outcome==="WIN").length,l=r.filter(s=>s.outcome==="LOSS").length,R=r.reduce((x,s)=>x+s.R,0);return{n:r.length,wr:(w+l)?w/(w+l)*100:0,R,avg:r.length?R/r.length:0};};
const fmt=a=>`n ${String(a.n).padStart(4)} · WR ${a.wr.toFixed(1).padStart(5)}% · avgR ${(a.avg>=0?"+":"")+a.avg.toFixed(3)} · R ${(a.R>=0?"+":"")+a.R.toFixed(1)}`;
const P=(l,r)=>r.length?console.log(`  ${l.padEnd(30)} ${fmt(agg(r))}`):null;
// dominance signée : diDelta>0 = buyers ; agree = trade dans le sens de la dominance DI
const agree=s=>(s.side==="BUY"&&s.diDelta>0)||(s.side==="SELL"&&s.diDelta<0);
// handover : le DI vient de traverser zéro (signe de diDelta != signe de diDelta précédent = diDelta - dSpread)
const prev=s=>s.diDelta - s.dSpread;
const crossed=s=>Math.sign(s.diDelta)!==Math.sign(prev(s)) && Math.abs(s.diDelta)>1;
for (const [fam,pred] of [["EXH (fade)",s=>s.type==="EXHAUSTION"],["CONT",s=>s.type==="CONTINUATION"]]) {
  const pool=all.filter(pred);
  console.log(`\n======== ${fam} · n=${pool.length} ========`);
  console.log("### trade vs dominance DI (diDelta signé)");
  P("AVEC la dominance (agree)", pool.filter(agree));
  P("CONTRE la dominance", pool.filter(s=>!agree(s)));
  console.log("### handover DI (le spread vient de traverser 0)");
  P("cross DI récent", pool.filter(crossed));
  P("pas de cross récent", pool.filter(s=>!crossed(s)));
  console.log("### croisé : agree × handover");
  P("AVEC + cross frais", pool.filter(s=>agree(s)&&crossed(s)));
  P("AVEC + pas de cross", pool.filter(s=>agree(s)&&!crossed(s)));
  P("CONTRE + cross frais", pool.filter(s=>!agree(s)&&crossed(s)));
  P("CONTRE + pas de cross", pool.filter(s=>!agree(s)&&!crossed(s)));
}
