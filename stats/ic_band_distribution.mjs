// ============================================================================================
// ic_band_distribution.mjs — QUELLE PART DES BARRES TOMBE DANS CHAQUE BANDE `dailyForce` ?
// --------------------------------------------------------------------------------------------
// ⚠️ LE PIÈGE QU'ON MESURE ICI : les seuils d'IntradayConfig sont calibrés sur des EXCURSIONS
//   JOURNALIÈRES (24 mois, jusqu'où le jour est allé) mais appliqués à un `intraday_change` LIVE,
//   à n'importe quel moment de la séance. En cours de journée le cumul n'a PAS encore atteint son
//   excursion finale ⇒ la distribution live est mécaniquement TASSÉE VERS LE BAS.
//   Un seuil « P92 des journées » n'est donc PAS atteint par 8 % des barres, mais par bien moins.
//
// ⭐ ENJEU : `dailyForce` a DROIT DE VETO (REGIME_DEFINERS). Une bande trop rare rend des profils
//   entiers inatteignables ; une bande trop large les rend inévitables. Il faut voir les EFFECTIFS
//   avant de fixer 3 seuils au lieu de 4.
//
// Usage : node --max-old-space-size=12288 stats/ic_band_distribution.mjs
// ============================================================================================
import fs from "fs";
import path from "path";
const { INTRADAY_CONFIG } = await import("../../Matrix-Revolution/src/components/robot/engines/config/IntradayConfig.js");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
const tot = { NEUTRE: 0, SOFT: 0, STRONG: 0, EXPLOSIVE: 0, SPIKE: 0 };
const perAsset = {};
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const c = INTRADAY_CONFIG[asset]; if (!c) { console.log(`  ⚠ ${asset} : pas de config`); continue; }
  const L = fs.readFileSync(path.join(D, f), "utf8").trim().split(/\r?\n/);
  const H = L[0].split(";"); const ix = H.indexOf("intraday_change");
  const b = { NEUTRE: 0, SOFT: 0, STRONG: 0, EXPLOSIVE: 0, SPIKE: 0 };
  for (const line of L.slice(1)) {
    const v = num(line.split(";")[ix]); if (v === null) continue;
    const a = Math.abs(v);
    const k = a >= Math.abs(c.spikeUp) ? "SPIKE" : a >= Math.abs(c.explosiveUp) ? "EXPLOSIVE"
      : a >= Math.abs(c.strongUp) ? "STRONG" : a >= Math.abs(c.softUp) ? "SOFT" : "NEUTRE";
    b[k]++; tot[k]++;
  }
  perAsset[asset] = b;
}
const N = Object.values(tot).reduce((a, x) => a + x, 0);
console.log(`DISTRIBUTION LIVE des bandes (${N} barres, 19 actifs)\n`);
console.log("  bande         part      → dailyForce   force");
const MAP = { NEUTRE: ["LOW", 0], SOFT: ["MEDIUM", 25], STRONG: ["HIGH", 50], EXPLOSIVE: ["EXTREME", 75], SPIKE: ["EXTREME", 100] };
for (const [k, v] of Object.entries(tot))
  console.log(`  ${k.padEnd(12)}${(v / N * 100).toFixed(1).padStart(6)} %   ${MAP[k][0].padEnd(10)} ${String(MAP[k][1]).padStart(4)}`);
console.log(`\n  ⇒ EXTREME actuel = EXPLOSIVE + SPIKE = ${((tot.EXPLOSIVE + tot.SPIKE) / N * 100).toFixed(1)} % des barres`);
console.log(`  ⇒ si EXTREME ne gardait QUE l'ex-SPIKE (P99) : ${(tot.SPIKE / N * 100).toFixed(1)} % — cellules INDISPENSABLE quasi inatteignables`);
console.log(`\npar actif (part NEUTRE / SOFT / STRONG / EXPLO+SPIKE) :`);
for (const [a, b] of Object.entries(perAsset)) {
  const n = Object.values(b).reduce((x, y) => x + y, 0);
  const p = (v) => (v / n * 100).toFixed(0).padStart(3);
  console.log(`   ${a.padEnd(12)} ${p(b.NEUTRE)}% ${p(b.SOFT)}% ${p(b.STRONG)}% ${p(b.EXPLOSIVE + b.SPIKE)}%`);
}
