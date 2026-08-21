import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const p = path.resolve("data/matrix/GOLD.csv");
const s = (runMatrixBacktest(p,{maxOpen:"30",cadenceMin:"2"}).signals||[]).filter(x=>typeof x.R==="number");
const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length;
const off = new Date("2026-06-25T14:00:00").getTimezoneOffset();
console.log(`TZ=${process.env.TZ||"(none)"} offset=${off} → GOLD n=${s.length} WR=${(w/(w+l)*100).toFixed(1)}%`);
