import fs from "fs";
const { detectOpportunity } = await import("../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js");
const L = fs.readFileSync("data/matrix/US_30.csv", "utf8").trim().split(/\r?\n/);
const H = L[0].split(";"); const ix = (n) => H.indexOf(n);
// une lecture toutes les ~20 min autour du sommet 16/07 06h → bascule 16h
let last = "";
for (const line of L.slice(1)) {
  const r = line.split(";"); const ts = String(r[ix("timestamp")] ?? r[0]);
  if (!/^2026\.07\.16 (0[6-9]|1[0-6]):/.test(ts)) continue;
  const hm = ts.slice(0, 15); if (hm === last) continue; last = hm;   // ~1 / 10 min
  const row = {}; H.forEach((h, i) => { row[h] = r[i]; }); row.symbol = "US_30";
  const det = detectOpportunity(row, "US_30", { spike: null });
  const h1 = det.stoch?.perTf?.h1 ?? {}; const sel = det.selection ?? {};
  const kd = h1.kd ?? {};
  console.log(ts.slice(5, 16) + " → " + String(sel.side + " " + sel.strategy).padEnd(11) + " | cross " + String(kd.crossoverState).padEnd(10) + " age " + kd.crossAge + " " + String(kd.crossoverMaturity).padEnd(9) + " zone " + String(h1.zone).padEnd(13) + " k " + h1.k?.toFixed(0) + " d " + h1.d?.toFixed(0) + " ADX " + (h1.adx?.value ?? h1.adx?.adx)?.toFixed(0) + " Δ " + h1.adx?.delta1);
}
