// _rowdump_check.mjs — LE DUMP ROW (`ghostBoxes`) EST-IL NEUTRE ET COMPLET ?
//
// Trois questions, dans cet ordre — la troisième ne veut rien dire si les deux premières échouent :
//   ① NEUTRALITÉ  : avec l'option ÉTEINTE, le carnet doit rendre 926 tirs / R +168,6.
//   ② NEUTRALITÉ² : avec l'option ALLUMÉE aussi. Un collecteur qui déplace un chiffre n'observe plus
//                   ce qu'il prétend observer.
//   ③ COUVERTURE  : combien de barres évaluées portent un verdict de boîte, et surtout — combien
//                   n'ont PAS tiré. C'est cette population-là qui débloque les mesures 3 et 4, et
//                   elle est par définition absente du carnet.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const OPTS = { maxOpen: 30, cadenceMin: 2, chargeSpread: true };

function run(extra) {
  let sig = [], gh = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
    const a = path.basename(f, ".csv");
    const r = runMatrixBacktest(path.join(DIR, f), { ...OPTS, ...extra });
    for (const s of (r.signals || [])) if (typeof s.R === "number") sig.push({ ...s, asset: a });
    for (const g of (r.ghosts || [])) if (g.ghost === "boxes") gh.push({ ...g, asset: a });
  }
  const t = sig.filter((s) => s.strategy === "EXH" && (s.outcome === "WIN" || s.outcome === "LOSS"));
  return { n: t.length, R: t.reduce((a, b) => a + (b.R || 0), 0), gh };
}

const off = run({});
const on  = run({ ghostBoxes: true });
const ok = (o) => o.n === 926 && Math.abs(o.R - 168.6) < 0.05;
console.log(`\n═══ NEUTRALITÉ ═══`);
console.log(`  option OFF : ${off.n} tirs · R ${off.R.toFixed(1)}   ${ok(off) ? "✅" : "🔴"}`);
console.log(`  option ON  : ${on.n} tirs · R ${on.R.toFixed(1)}   ${ok(on) ? "✅" : "🔴"}` +
  `   ${off.n === on.n && Math.abs(off.R - on.R) < 1e-9 ? "· identique à OFF ✅" : "· 🔴 LE COLLECTEUR MODIFIE LE MOTEUR"}`);

console.log(`\n═══ COUVERTURE ═══`);
const G = on.gh;
console.log(`  ${G.length} barres avec un verdict de boîte` +
  (G.length ? "" : "   🔴 AUCUNE — l'option ne collecte rien, ou `boxes` n'est pas sur `rawSelection`"));
if (!G.length) process.exit(1);
const nonTire = G.filter((g) => g.firedStrategy == null);
console.log(`  dont N'ONT PAS TIRÉ : ${nonTire.length} (${(100 * nonTire.length / G.length).toFixed(1)} %)` +
  `   ⭐ la population que le carnet ne contient pas`);
const parFire = new Map();
for (const g of G) parFire.set(g.firedStrategy ?? "—", (parFire.get(g.firedStrategy ?? "—") ?? 0) + 1);
console.log(`  par devenir réel : ` + [...parFire.entries()].map(([k, v]) => `${k} ${v}`).join(" · "));
const vd = (k) => { const m = new Map(); for (const g of G) m.set(g[k] ?? "null", (m.get(g[k] ?? "null") ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([x, n]) => `${x} ${(100 * n / G.length).toFixed(1)}%`).join(" · "); };
console.log(`  verdict EXH  : ${vd("eVerd")}`);
console.log(`  verdict PB   : ${vd("pVerd")}   (⚠ MIN_PB=1000 ⇒ toujours "cede", lire \`pConv\`)`);

console.log(`\n═══ APERÇU MESURE 4 — LE ROBINET \`ScoreMinDrop_EXH\` ═══`);
console.log(`  aujourd'hui MIN_PRES = 0 ⇒ tout score EXH positif sous 10 part en Drop TERMINAL.`);
console.log(`  ce que chaque valeur candidate RENDRAIT au PLB (barres qui cèderaient au lieu de Drop) :\n`);
console.log(`  ScoreMinDrop_EXH   barres qui CÈDENT   dont PB conviction > 10`);
for (const smd of [0, 2, 4, 6, 8, 10]) {
  const cede = G.filter((g) => !Number.isFinite(g.eConv) || g.eConv <= smd);
  const utiles = cede.filter((g) => Number.isFinite(g.pConv) && g.pConv > 10);
  console.log(`  ${String(smd).padEnd(18)} ${String(cede.length).padStart(17)} ${String(utiles.length).padStart(24)}`);
}
