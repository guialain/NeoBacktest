// ============================================================================================
// adx_grid_cont_exh.mjs — L'ADX DOIT-IL CONDITIONNER LE **CONT**, ET COMMENT ?
// --------------------------------------------------------------------------------------------
// CONSTAT owner (2026-07-20) : « il n'est pas correct de CONT SELL alors que l'ADX a tourné ».
//   Exemple : 16 SELL CONTINUATION en 38 min, tous SL, sur ADX 60 (EXTREME) + TURN_DOWN.
//
// ⚠️ L'AGRÉGAT SEUL DIT LE CONTRAIRE : en CONT, TURN_DOWN sort à avgR +0,125 — le MEILLEUR niveau.
//   L'hypothèse à tester n'est donc PAS « TURN_DOWN est mauvais » mais « TURN_DOWN est mauvais
//   QUAND LA DOMINANCE EST EXTRÊME » — un retournement de force ne veut pas dire la même chose à
//   ADX 20 (bruit) et à ADX 60 (une tendance installée qui lâche). C'est un effet d'INTERACTION,
//   invisible sur chaque marge prise séparément. ⭐ Piège du mirage d'agrégat (cf. tp/sl 17/07).
//
// GRILLE : dominance (NIVEAU) × dominanceTurn (INFLEXION), séparément pour CONT et EXH.
//   On imprime n ET avgR : une case à +0,30 sur 12 trades ne vaut pas une case à +0,05 sur 900.
//
// Usage : node --max-old-space-size=12288 stats/adx_grid_cont_exh.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const LVL = ["LOW", "MEDIUM", "HIGH", "EXTREME", "(null)"];
const TRN = ["TURN_DOWN", "FALLING", "FLAT", "RISING", "TURN_UP", "(null)"];
const mk = () => ({ n: 0, w: 0, l: 0, R: 0 });
const bump = (o, s) => { o.n++; o.R += s.R; if (s.outcome === "WIN") o.w++; else if (s.outcome === "LOSS") o.l++; };
const G = { CONT: {}, EXH: {} };
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (typeof s.R !== "number") continue;
    const fam = s.type === "EXHAUSTION" ? "EXH" : "CONT";
    const k = `${s.dominance ?? "(null)"}|${s.dominanceTurn ?? "(null)"}`;
    G[fam][k] = G[fam][k] || mk(); bump(G[fam][k], s);
  }
const f3 = (v) => (v >= 0 ? "+" : "") + v.toFixed(3);
for (const fam of ["CONT", "EXH"]) {
  const tot = Object.values(G[fam]).reduce((a, o) => a + o.n, 0);
  const totR = Object.values(G[fam]).reduce((a, o) => a + o.R, 0);
  console.log(`\n═══ ${fam} — n=${tot} · totalR ${totR >= 0 ? "+" : ""}${totR.toFixed(1)}`);
  console.log("  dominance ↓ / turn →" + TRN.map((t) => t.padStart(14)).join(""));
  for (const lv of LVL) {
    let line = "  " + lv.padEnd(20);
    let any = false;
    for (const t of TRN) {
      const o = G[fam][`${lv}|${t}`];
      if (!o) { line += "".padStart(14); continue; }
      any = true;
      line += `${f3(o.R / o.n)}/${o.n}`.padStart(14);
    }
    if (any) console.log(line);
  }
}
console.log("\nlecture : avgR/n par case. Case vide = combinaison jamais produite.");
