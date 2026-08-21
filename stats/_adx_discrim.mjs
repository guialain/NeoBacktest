import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const all = [];
for (const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D,f)).signals||[])) if (typeof s.R==="number") all.push(s);
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const lvlBand=s=>{const a=num(s.adx);if(a==null)return "?";return a<21?"1·<21":a<27?"2·21-27":a<34?"3·27-34":a<45?"4·34-45":"5·≥45";};
const agg=r=>{const w=r.filter(s=>s.outcome==="WIN").length,l=r.filter(s=>s.outcome==="LOSS").length,R=r.reduce((x,s)=>x+s.R,0);return{n:r.length,wr:(w+l)?w/(w+l)*100:0,R,avg:r.length?R/r.length:0};};
const fmt=a=>`n ${String(a.n).padStart(4)} · WR ${a.wr.toFixed(1).padStart(5)}% · avgR ${(a.avg>=0?"+":"")+a.avg.toFixed(3)} · R ${(a.R>=0?"+":"")+a.R.toFixed(1)}`;
const P=(l,r)=>r.length?console.log(`  ${l.padEnd(18)} ${fmt(agg(r))}`):null;
for (const [fam,pred] of [["EXH (fade)",s=>s.type==="EXHAUSTION"],["CONT",s=>s.type==="CONTINUATION"]]) {
  const pool=all.filter(pred);
  console.log(`\n======== ${fam} · n=${pool.length} ========`);
  console.log("### par DIRECTION (dominanceTurn)");
  for(const d of ["RISING","FALLING","TURN_UP","TURN_DOWN","FLAT"]) P(d,pool.filter(s=>s.dominanceTurn===d));
  console.log("### par NIVEAU (ADX brut)");
  for(const b of ["1·<21","2·21-27","3·27-34","4·34-45","5·≥45"]) P(b,pool.filter(s=>lvlBand(s)===b));
}
console.log("\n======== EXH · CROISÉ niveau × FALLING vs RISING (le cœur du doute) ========");
const exh=all.filter(s=>s.type==="EXHAUSTION");
for(const b of ["1·<21","2·21-27","3·27-34","4·34-45","5·≥45"]){
  const r=exh.filter(s=>lvlBand(s)===b);
  const fall=r.filter(s=>s.dominanceTurn==="FALLING"),rise=r.filter(s=>s.dominanceTurn==="RISING");
  console.log(`  ${b.padEnd(9)} FALLING ${fmt(agg(fall))}`);
  if(rise.length) console.log(`  ${" ".repeat(9)} RISING  ${fmt(agg(rise))}`);
}
