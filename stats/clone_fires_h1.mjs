// ============================================================================================
// clone_fires_h1.mjs — LE MOTEUR DÉCIDE SUR H1 MAIS TIRE TOUTES LES 2 MINUTES.
// --------------------------------------------------------------------------------------------
// LE CONSTAT (owner 2026-07-20, 16 SELL CONTINUATION en 38 min, tous SL, −16 R) : les observables
//   sont IDENTIQUES d'une ligne à l'autre — dominance, dominanceTurn, ΔADX, thetaDay ne bougent pas.
//   C'est normal : ils sont H1. Tant que la barre H1 n'a pas clôturé, le moteur revoit LA MÊME
//   PHOTO et retire dessus. Une barre H1 = jusqu'à 30 décisions identiques.
//   ⇒ Une seule lecture H1 erronée ne coûte pas 1 R, elle coûte N R.
//
// CE QUE MESURE CE SCRIPT : le nombre de tirs par (actif × barre H1 × side), et ce que pèsent les
//   CLONES (tous les tirs sauf le premier) en volume ET en R.
//
// ⚠️⚠️ PARITÉ BACKTEST/LIVE — LE POINT LE PLUS IMPORTANT :
//   Le harness n'a NI espacement prix NI plafond par actif. Il a `maxOpen=30` PAR ACTIF, point.
//   Le LIVE a les deux (PositionSpacing.js) : MAX_POSITIONS_PER_SYMBOL = 8 toutes directions,
//   plus un espacement prix minimal entre positions du MÊME SENS.
//   ⇒ Les grappes de 29 ou 47 tirs mesurées ici SONT IMPOSSIBLES EN PROD. Le backtest surestime
//   à la fois les gains des clones ET la casse des cascades. Son total R n'est PAS atteignable.
//
// Usage : node --max-old-space-size=12288 stats/clone_fires_h1.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const hourKey = (ts) => String(ts).slice(0, 13);

let tot = 0, totR = 0, firstR = 0, firstW = 0, firstL = 0, restR = 0, restN = 0, worst = null;
const sizes = {};
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const sig = (runMatrixBacktest(path.join(D, f)).signals || []).filter((s) => typeof s.R === "number");
  const g = new Map();
  for (const s of sig) { const k = `${hourKey(s.tsMT)}|${s.side}`; if (!g.has(k)) g.set(k, []); g.get(k).push(s); }
  for (const [k, arr] of g) {
    arr.sort((a, b) => String(a.tsMT).localeCompare(String(b.tsMT)));
    tot += arr.length; const R = arr.reduce((a, x) => a + x.R, 0); totR += R;
    sizes[arr.length] = (sizes[arr.length] || 0) + 1;
    firstR += arr[0].R; if (arr[0].outcome === "WIN") firstW++; else if (arr[0].outcome === "LOSS") firstL++;
    for (const s of arr.slice(1)) { restR += s.R; restN++; }
    if (!worst || R < worst.R) worst = { asset, k, n: arr.length, R };
  }
}
const groups = Object.values(sizes).reduce((a, b) => a + b, 0);
console.log(`signaux ${tot} · groupes (actif × barre H1 × side) ${groups} · totalR ${totR.toFixed(1)}\n`);
console.log("tirs par barre H1 :");
for (const [size, count] of Object.entries(sizes).map(([k, v]) => [+k, v]).sort((a, b) => a[0] - b[0]))
  console.log(`  ${String(size).padStart(3)} tir(s) ×${String(count).padStart(5)} groupes = ${String(size * count).padStart(5)} signaux (${(count / groups * 100).toFixed(1)}%)`);
console.log(`\npire grappe : ${worst.asset} ${worst.k} — ${worst.n} tirs pour ${worst.R.toFixed(1)} R`);
// ⭐ CONTRE-INTUITIF : les clones ne sont PAS le déchet. Ils portent l'essentiel du R.
console.log(`\n1er tir seul : ${firstW + firstL} trades · WR ${(firstW / (firstW + firstL) * 100).toFixed(1)} % · totalR ${firstR.toFixed(1)} · avgR ${(firstR / (firstW + firstL)).toFixed(3)}`);
console.log(`les CLONES   : ${restN} trades · totalR ${restR.toFixed(1)} · avgR ${(restR / restN).toFixed(3)}`);
console.log(`\n⇒ dédupliquer par barre H1 ferait tomber le total de ${totR.toFixed(1)} à ${firstR.toFixed(1)} R.`);
console.log(`  Les clones ne sont donc PAS du bruit à jeter — mais ils sont plafonnés en prod (8/actif).`);
