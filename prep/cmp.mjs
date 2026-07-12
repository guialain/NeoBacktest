import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
for (const a of ["AUDUSD","COCOA","GOLD","ETHUSD","BTCUSD","US_TECH100"]) {
  const s = runMatrixBacktest(`./data/matrix/${a}.csv`, {}).summary;
  console.log(`  ${a.padEnd(11)} opened ${String(s.opened).padStart(4)}  WR ${String(s.winRate).padStart(5)}  totalR ${String(s.totalR).padStart(7)}  W/L/TO ${s.wins}/${s.losses}/${s.timeouts}`);
}
