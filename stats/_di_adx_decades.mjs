// _di_adx_decades.mjs — LE DECOUPAGE PAR DECADES (0-10 … 50+) SUR `DI` ET SUR `ADX`.
//
// 🎯 DICTEE owner 22/08 : « adx va regulierement a 40 donc faut refaire le decoupage :
//   0-10 · 10-20 · 20-30 · 30-40 · 40-50 · 50+ ».
// ⚠⚠ LEVEE D'AMBIGUITE AVANT DE DECOUPER : `DI_LEVEL_BANDS` bande le **DI** (DI+ ou DI−), PAS
//   l'**ADX**. Ce sont deux grandeurs differentes — l'ADX est la force de tendance (|DI+−DI−| lisse),
//   le DI la force d'UN camp. Un decoupage juste pour l'une peut etre vide pour l'autre.
//   ⇒ on imprime les DEUX sur les memes decades, et on tranche sur le chiffre.
// ⚠ Lecture LIVE (`_s0`) : c'est l'instant pour lequel `DI_LEVEL_BANDS` a ete calibre.
// ⚠ Lignes MORTES exclues. Population = toutes les barres.
//   usage : node stats/_di_adx_decades.mjs
import fs from "fs"; import path from "path";
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const SER = { "DI+ H1": "plus_di_h1_s0", "DI− H1": "minus_di_h1_s0",
              "DI+ M15": "plus_di_m15_s0", "DI− M15": "minus_di_m15_s0",
              "ADX H1": "adx14_h1_s0", "ADX M15": "adx14_m15_s0" };
const acc = {}; for (const k of Object.keys(SER)) acc[k] = [];
const MORT = 5;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";"); const iT = h.indexOf("timestamp");
  const ix = {}; for (const [k, c] of Object.entries(SER)) ix[k] = h.indexOf(c);
  const nPar = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); nPar.set(c[iT], (nPar.get(c[iT]) ?? 0) + 1); }
  const gele = new Set([...nPar].filter(([, n]) => n >= MORT).map(([t]) => t));
  for (const l of L.slice(1)) {
    const c = l.split(";"); if (gele.has(c[iT])) continue;
    for (const k of Object.keys(SER)) { if (ix[k] < 0) continue;
      const v = c[ix[k]]; const n = Number(v);
      if (v !== "" && Number.isFinite(n) && n > 0) acc[k].push(n); }
  }
}
const DEC = [[0,10],[10,20],[20,30],[30,40],[40,50],[50,Infinity]];
const lbl = ([lo,hi]) => hi === Infinity ? "50+" : `${lo}-${hi}`;
console.log(`\n═══ DECOUPAGE PAR DECADES — DI CONTRE ADX ═══  (lecture LIVE, toutes barres)`);
console.log("  " + "serie".padEnd(10) + "n".padStart(9) + DEC.map((d) => lbl(d).padStart(10)).join("") + "     p95     max");
console.log("  " + "─".repeat(10 + 9 + 10 * DEC.length + 16));
for (const k of Object.keys(SER)) {
  const a = acc[k]; if (!a.length) { console.log("  " + k.padEnd(10) + "   (absent)"); continue; }
  a.sort((x, y) => x - y);
  const parts = DEC.map(([lo, hi]) => 100 * a.filter((v) => v >= lo && v < hi).length / a.length);
  console.log("  " + k.padEnd(10) + String(a.length).padStart(9)
    + parts.map((p) => (p.toFixed(1) + " %").padStart(10)).join("")
    + a[Math.floor(0.95 * a.length)].toFixed(1).padStart(8) + a[a.length - 1].toFixed(1).padStart(8));
}
console.log("\n  ⚠ Une bande sous ~2 % de la population est une case que le bareme ne notera",
            "quasi jamais.\n     C'est ce qui a rendu decoratives les bornes hautes de `rsi`, `kH4` et `di`.\n");
