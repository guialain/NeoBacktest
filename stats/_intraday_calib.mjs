// _intraday_calib.mjs — CALIBRER « JOURNEE FORTEMENT HAUSSIERE » SUR DISTRIBUTION, PAS AU DOIGT.
// 🔴 `intraday_change` est en POURCENT DE PRIX. Une journee a +1 % est extreme sur EURUSD et banale
//   sur BTCUSD : un seuil universel en % ne decrirait pas « fortement haussiere », il decrirait
//   « actif volatil ». C'est le meme piege que les bornes de pente, resolu la par une normalisation
//   par la PORTEE de l'actif — pas par une logique par actif.
import fs from "fs";
const DIR = "data/matrix";
const num = (v) => (v === "" || v == null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
const q = (t, p) => t.length ? t[Math.min(t.length - 1, Math.floor(t.length * p))] : null;

const assets = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

const glob = [];
const rows = [];
for (const sym of assets) {
  const L = fs.readFileSync(`${DIR}/${sym}.csv`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  if (I["intraday_change"] == null) { console.log(`${sym} : colonne absente`); continue; }
  const v = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const x = num(c[I["intraday_change"]]);
    if (x !== null) { v.push(x); glob.push(x); }
  }
  const abs = v.map(Math.abs).sort((a, b) => a - b);
  rows.push({ sym, n: v.length, p50: q(abs, 0.50), p75: q(abs, 0.75), p90: q(abs, 0.90), p95: q(abs, 0.95) });
}

const A = glob.map(Math.abs).sort((a, b) => a - b);
const S = [...glob].sort((a, b) => a - b);
console.log(`GLOBAL n=${glob.length}`);
console.log("  |intraday_change|  p50 %s  p75 %s  p90 %s  p95 %s  p99 %s",
  q(A, .50).toFixed(2), q(A, .75).toFixed(2), q(A, .90).toFixed(2), q(A, .95).toFixed(2), q(A, .99).toFixed(2));
console.log("  signé             p05 %s  p25 %s  p50 %s  p75 %s  p95 %s",
  q(S, .05).toFixed(2), q(S, .25).toFixed(2), q(S, .50).toFixed(2), q(S, .75).toFixed(2), q(S, .95).toFixed(2));
console.log(`  part > +1,0 % : ${(100 * glob.filter((x) => x > 1).length / glob.length).toFixed(1)} %` +
            `   > +2,0 % : ${(100 * glob.filter((x) => x > 2).length / glob.length).toFixed(1)} %`);

console.log("\nPAR ACTIF — |intraday_change|, pour voir si un seuil UNIQUE en % est tenable");
console.log("actif            n      p50    p75    p90    p95");
for (const r of rows.sort((a, b) => b.p90 - a.p90)) {
  console.log(r.sym.padEnd(14) + String(r.n).padStart(7) + "  " +
    [r.p50, r.p75, r.p90, r.p95].map((x) => (x == null ? "—" : x.toFixed(2)).padStart(6)).join(" "));
}
console.log("\n⇒ Si p90 varie d'un facteur > 3 entre actifs, un seuil unique en % est un seuil PAR ACTIF déguisé.");
