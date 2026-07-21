// ============================================================================================
// kd_gap_div_distribution.mjs — DISTRIBUTION de gap/div (spec KD 2026-07-21, phase MESURE §7-1).
// --------------------------------------------------------------------------------------------
// But : poser GAP_LOW (seuil « gap petit » pour le gate CONT) et Θk (validité s0) sur des
//   PERCENTILES RÉELS, pas devinés. gap/div = fonctions pures des colonnes stoch_k/d_h1_s0..s3,
//   donc pas besoin du moteur.
//
// ⚠️ ON SÉPARE DEUX POPULATIONS :
//   · CLOSES (s1,s2,s3) — stables, dédupliquées par heure H1. C'est le signal FIABLE.
//   · LIVE (s0) — sur TOUTES les lignes (ce que le gate voit en direct), inclut la compression
//     début-de-barre. Sert à calibrer Θk et à voir combien s0 est bruité.
//
// Usage : node --max-old-space-size=12288 stats/kd_gap_div_distribution.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
const P = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(p / 100 * (arr.length - 1)))] : null;

const closes = { g1: [], g2: [], g3: [], div1: [], div2: [] };   // dédupliqué par heure
const liveGap0 = [], liveDiv0 = [], dk01 = [];                     // toutes lignes
let nAll = 0, nDiv0neg = 0, nReg = 0;                              // div0<0 · div0<0 & div1<0

for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const L = fs.readFileSync(path.join(D, f), "utf8").trim().split(/\r?\n/);
  const H = L[0].split(";"); const ix = (n) => H.indexOf(n);
  const K = [0, 1, 2, 3].map((i) => ix(`stoch_k_h1_s${i}`));
  const Dd = [0, 1, 2, 3].map((i) => ix(`stoch_d_h1_s${i}`));
  const iTs = ix("timestamp") >= 0 ? ix("timestamp") : 0;
  const seen = new Set();
  for (const line of L.slice(1)) {
    const r = line.split(";");
    const k = K.map((j) => num(r[j])), d = Dd.map((j) => num(r[j]));
    if (k.some((x) => x == null) || d.some((x) => x == null)) continue;
    const gap = k.map((kk, i) => Math.abs(kk - d[i]));
    const div0 = gap[0] - gap[1], div1 = gap[1] - gap[2], div2 = gap[2] - gap[3];
    liveGap0.push(gap[0]); liveDiv0.push(div0); dk01.push(Math.abs(k[0] - k[1]));
    nAll++; if (div0 < 0) nDiv0neg++; if (div0 < 0 && div1 < 0) nReg++;
    const hk = String(r[iTs]).slice(0, 13);
    if (!seen.has(hk)) { seen.add(hk);
      closes.g1.push(gap[1]); closes.g2.push(gap[2]); closes.g3.push(gap[3]);
      closes.div1.push(div1); closes.div2.push(div2);
    }
  }
}
const sortNum = (a) => a.sort((x, y) => x - y);
const row = (name, arr, ps) => { sortNum(arr); console.log("  " + name.padEnd(10) + ps.map((p) => (P(arr, p) >= 0 ? "+" : "") + P(arr, p).toFixed(2)).map((s) => s.padStart(9)).join("")); };

const PS_POS = [5, 25, 50, 75, 90, 95, 99];
console.log(`GAP (|k−d|) — CLOSES dédupliquées par heure (n=${closes.g1.length})`);
console.log("  série     " + PS_POS.map((p) => ("P" + p).padStart(9)).join(""));
row("gap1", closes.g1, PS_POS); row("gap2", closes.g2, PS_POS); row("gap3", closes.g3, PS_POS);

const PS_SIGN = [5, 10, 25, 50, 75, 90, 95];
console.log(`\nDIV (gap_j − gap_{j+1}) — CLOSES (signé, n=${closes.div1.length})`);
console.log("  série     " + PS_SIGN.map((p) => ("P" + p).padStart(9)).join(""));
row("div1", closes.div1, PS_SIGN); row("div2", closes.div2, PS_SIGN);

console.log(`\nLIVE s0 — toutes lignes (n=${nAll}) — inclut compression début-de-barre`);
console.log("  série     " + PS_POS.map((p) => ("P" + p).padStart(9)).join(""));
row("gap0", liveGap0, PS_POS);
console.log("  série     " + PS_SIGN.map((p) => ("P" + p).padStart(9)).join(""));
row("div0", liveDiv0, PS_SIGN);
row("|k0-k1|", dk01, PS_POS);

console.log(`\nFRÉQUENCES (toutes lignes) :`);
console.log(`  div0 < 0 (convergence)          ${(nDiv0neg / nAll * 100).toFixed(1)} %`);
console.log(`  div0<0 ET div1<0 (régulière)    ${(nReg / nAll * 100).toFixed(1)} %`);
console.log(`\n→ GAP_LOW candidat = P10–P25 de gap (closes) · Θk candidat = P25–P50 de |k0-k1|`);
