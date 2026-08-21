import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const TPS=[0.6,0.9,1.2], SLS=[2.0,3.0,4.0];
const contStats=(sigs)=>{const s=sigs.filter(x=>typeof x.R==="number"&&x.type==="CONTINUATION");const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);return{n:s.length,wr:(w+l)?w/(w+l)*100:0,R};};
const files=fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort();
let totBest=0, totDef=0;
console.log("actif".padEnd(12)+"défaut R".padStart(10)+"→ meilleur (tp/sl · WR · R)".padStart(30));
for(const f of files){const a=f.replace(/\.csv$/i,"");
  const def=contStats(runMatrixBacktest(path.join(D,f)).signals||[]);
  let best=null;
  for(const tp of TPS)for(const sl of SLS){const st=contStats(runMatrixBacktest(path.join(D,f),{tpAtr:tp,slAtr:sl}).signals||[]); if(!best||st.R>best.R)best={...st,tp,sl};}
  totBest+=best.R; totDef+=def.R;
  console.log(a.padEnd(12)+((def.R>=0?"+":"")+def.R.toFixed(0)).padStart(10)+`  ${best.tp}/${best.sl} · ${best.wr.toFixed(0)}% · ${(best.R>=0?"+":"")+best.R.toFixed(0)}`.padStart(30));
}
console.log("─".repeat(52));
console.log(`CONT-only : défaut +${totDef.toFixed(0)} → optimisé par actif +${totBest.toFixed(0)} (+${(totBest-totDef).toFixed(0)})`);
console.log(`(rappel commité impulse défaut = +744)`);
