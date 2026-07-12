import fs from "fs";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
const assets = fs.readdirSync("./data/matrix").filter(f=>f.endsWith(".csv")).map(f=>f.replace(".csv",""));
let A={fires:0,opened:0,w:0,l:0,R:0}, B={fires:0,opened:0,w:0,l:0,R:0}, hh=0,tt=0;
console.log("asset        OFF fires/open W-L totalR  |  ON fires/open W-L totalR (admH/admT)");
for(const a of assets){
  const off=runMatrixBacktest(`./data/matrix/${a}.csv`,{admission:false}).summary;
  const on =runMatrixBacktest(`./data/matrix/${a}.csv`,{admission:true }).summary;
  A.fires+=off.fires;A.opened+=off.opened;A.w+=off.wins;A.l+=off.losses;A.R+=off.totalR;
  B.fires+=on.fires;B.opened+=on.opened;B.w+=on.wins;B.l+=on.losses;B.R+=on.totalR;hh+=on.admHours;tt+=on.admTick;
  const f=(x)=>String(x).padStart(3);
  console.log(`${a.padEnd(12)} ${f(off.fires)}/${f(off.opened)} ${f(off.wins)}-${f(off.losses)} ${String(off.totalR).padStart(7)} | ${f(on.fires)}/${f(on.opened)} ${f(on.wins)}-${f(on.losses)} ${String(on.totalR).padStart(7)} (${on.admHours}/${on.admTick})`);
}
const wr=(w,l)=>w+l?(100*w/(w+l)).toFixed(1):"—";
console.log(`\nAGG OFF: fires ${A.fires} open ${A.opened} WR ${wr(A.w,A.l)}% totalR ${A.R.toFixed(1)}`);
console.log(`    ON : fires ${B.fires} open ${B.opened} WR ${wr(B.w,B.l)}% totalR ${B.R.toFixed(1)}  (bloqués heures ${hh} · tick ${tt})`);
