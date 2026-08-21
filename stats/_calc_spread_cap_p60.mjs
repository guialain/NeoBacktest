// _calc_spread_cap_p60.mjs — RECALCULE LE SEUIL `spread / atr_h1` PAR ACTIF, AU PERCENTILE VOULU.
// ⚠ MÊME CALCUL QUE `spreadCapPct` dans `matrixBacktest.mjs` — recopié serait le motif
//   `derived_dataset_computed_3x` ; ici on le reproduit à l'identique et on le DIT, parce que la
//   sortie va être FIGÉE dans une config et cessera donc de suivre le dataset.
// 🔴 REGARD EN AVANT : le percentile est calculé sur TOUTE la fenêtre. C'est ce qui a produit les
//   valeurs P50 en place, donc la méthode est cohérente — mais une valeur figée ainsi se périme
//   avec le dataset ET avec le broker.
import fs from "fs";
import path from "path";

const PCT = Number(process.argv[2] ?? 60);
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort();

const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

console.log(`percentile P${PCT} de \`spread / atr_h1\`, par actif\n`);
const out = {};
for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  const txt = fs.readFileSync(path.join(MATRIX, f), "utf8").split(/\r?\n/);
  const head = txt[0].split(";");
  const iS = head.indexOf("spread"), iA = head.indexOf("atr_h1");
  if (iS < 0 || iA < 0) { console.log(`${asset.padEnd(12)} colonnes manquantes`); continue; }
  const v = [];
  for (let i = 1; i < txt.length; i++) {
    if (!txt[i]) continue;
    const c = txt[i].split(";");
    const s = num(c[iS]), a = num(c[iA]);
    if (s > 0 && a > 0) v.push(s / a);
  }
  if (!v.length) { console.log(`${asset.padEnd(12)} aucune barre exploitable`); continue; }
  v.sort((x, y) => x - y);
  const q = v[Math.min(v.length - 1, Math.floor(v.length * PCT / 100))];
  out[asset.toUpperCase()] = +q.toFixed(4);
  console.log(`${asset.padEnd(12)} n=${String(v.length).padStart(6)}   P${PCT} = ${q.toFixed(4)}`);
}
console.log("\n// ── table à coller dans SpreadCapConfig.js ──");
const w = Math.max(...Object.keys(out).map((k) => k.length)) + 2;
for (const [k, val] of Object.entries(out).sort()) console.log(`  ${(k + ":").padEnd(w)} ${val.toFixed(4)},`);
