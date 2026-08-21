// Ajoute rsi_h1_s1/s2/s3 aux CSV data/matrix (série RSI H1 reconstruite par heure) — pour que le
//   moteur exerce la porte EXH « trend RSI 4 barres ». Reproduit ce que l'EA émet désormais en live.
//   s1/s2/s3 = rsi_h1_s0 des heures H−1/−2/−3 (close ≈ dernier s0 de l'heure). ⚠ modifie les CSV en place.
import fs from "fs"; import path from "path";
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
const hourIdx = (ts) => { const t = Date.parse(String(ts).slice(0, 13).replace(/\./g, "-") + ":00:00"); return Number.isFinite(t) ? Math.floor(t / 3600000) : null; };
let done = 0;
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const p = path.join(D, f);
  const L = fs.readFileSync(p, "utf8").replace(/\r/g, "").split("\n");
  const H = L[0].split(";");
  if (H.includes("rsi_h1_s1")) { continue; }   // déjà fait
  const iR = H.indexOf("rsi_h1_s0"), iTs = H.indexOf("timestamp") >= 0 ? H.indexOf("timestamp") : 0;
  if (iR < 0) continue;
  // série close par heure = dernier rsi_h1_s0 de chaque heure
  const rsiByHour = new Map();
  for (let k = 1; k < L.length; k++) { if (!L[k]) continue; const r = L[k].split(";"); const rv = num(r[iR]); if (rv == null) continue; const h = hourIdx(r[iTs]); if (h != null) rsiByHour.set(h, rv); }
  const out = [H.concat(["rsi_h1_s1", "rsi_h1_s2", "rsi_h1_s3"]).join(";")];
  for (let k = 1; k < L.length; k++) {
    if (!L[k]) continue; const r = L[k].split(";"); const h = hourIdx(r[iTs]);
    const g = (o) => { const v = rsiByHour.get(h - o); return v == null ? "" : v.toFixed(2); };
    out.push(r.concat([g(1), g(2), g(3)]).join(";"));
  }
  fs.writeFileSync(p, out.join("\n") + "\n");
  done++;
}
console.log(`rsi_h1_s1/s2/s3 ajoutés à ${done} CSV data/matrix`);
