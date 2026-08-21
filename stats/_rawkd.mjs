import fs from "fs";
const lines = fs.readFileSync("data/matrix/US_30.csv","utf8").split("\n");
const hdr = lines[0].split(";");
const idx = (name) => hdr.indexOf(name);
const cols = {};
for (const t of ["s0","s1","s2","s3"]) { cols["k_"+t]=idx("stoch_k_h1_"+t); cols["d_"+t]=idx("stoch_d_h1_"+t); }
const row = lines.find(l => l.startsWith("2026.07.02 12:05"));
if (!row) { console.log("row introuvable"); process.exit(); }
const c = row.split(";");
console.log("US_30 @ 2026.07.02 12:05 — stoch H1 (K, D, K−D) :");
for (const t of ["s0","s1","s2","s3"]) {
  const k=parseFloat(c[cols["k_"+t]]), d=parseFloat(c[cols["d_"+t]]);
  const kd=k-d;
  console.log(`  ${t} (${t==="s0"?"live":"close-"+t.slice(1)}) : K=${k.toFixed(2)} D=${d.toFixed(2)} → K−D=${kd.toFixed(2)} ${kd>0?"(K AU-DESSUS)":"(K sous D)"}`);
}
