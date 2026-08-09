// probe — QU'EST-CE QUE `rsi_h1_s1` ? Il est rempli à 100 % mais diffère de la forme nue `rsi_h1`
//   sur 55,7 % des barres, écart max 85,85 sur une échelle 0-100. Un tel écart ne peut pas être un
//   décalage d'un shift : ce sont deux grandeurs différentes, et il faut savoir laquelle avant de
//   poser un seuil dessus. ⚠ La note de juillet (« rempli sur 21,4 % ») est PÉRIMÉE — la colonne a
//   changé avec l'EA v8.41.
import fs from "fs";
const L = fs.readFileSync("C:/Users/Public/Neo-Backtest/data/matrix/US_30.csv", "utf8").split(/\r?\n/);
const h = L[0].split(";");
const idx = Object.fromEntries(["ts_mt", "rsi_h1", "rsi_h1_s0", "rsi_h1_s1", "rsi_h1_s2", "rsi_h1_s3",
                                "rsi_h4", "rsi_m15", "rsi_m5", "drsi_h1", "drsi_h1_s0"]
  .map((k) => [k, h.indexOf(k)]));
console.log("colonnes trouvées :", JSON.stringify(idx), "\n");
console.log("ts                    rsi_h1   _s0     _s1     _s2     _s3    | h4     m15    m5     | drsi_h1");
for (let i = 1; i < Math.min(L.length, 4000); i += 400) {
  const c = L[i].split(";"); if (c.length < h.length) continue;
  const g = (k) => (idx[k] >= 0 ? String(c[idx[k]]).padStart(7) : "   n/a");
  console.log(`${String(c[idx.ts_mt]).slice(0, 19).padEnd(20)} ${g("rsi_h1")} ${g("rsi_h1_s0")} ` +
    `${g("rsi_h1_s1")} ${g("rsi_h1_s2")} ${g("rsi_h1_s3")} |${g("rsi_h4")} ${g("rsi_m15")} ${g("rsi_m5")} |${g("drsi_h1")}`);
}
// Corrélations grossières : `rsi_h1_s1` ressemble-t-il à un AUTRE champ du même scan ?
const col = (k) => { const j = idx[k]; const out = [];
  for (let i = 1; i < L.length; i++) { const c = L[i].split(";"); if (c.length < h.length) continue;
    out.push(Number(c[j])); } return out; };
const A = col("rsi_h1_s1");
for (const k of ["rsi_h1", "rsi_h1_s0", "rsi_h1_s2", "rsi_h4", "rsi_m15", "rsi_m5"]) {
  if (idx[k] < 0) continue;
  const B = col(k);
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, egaux = 0;
  for (let i = 0; i < A.length; i++) {
    if (!Number.isFinite(A[i]) || !Number.isFinite(B[i])) continue;
    n++; sa += A[i]; sb += B[i]; saa += A[i] * A[i]; sbb += B[i] * B[i]; sab += A[i] * B[i];
    if (Math.abs(A[i] - B[i]) <= 0.011) egaux++;
  }
  const r = (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb));
  console.log(`  corr(rsi_h1_s1, ${k.padEnd(10)}) = ${r.toFixed(4)}   ·  identiques ${(100 * egaux / n).toFixed(1)} %`);
}
