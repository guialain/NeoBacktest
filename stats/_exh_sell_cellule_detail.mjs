// _exh_sell_cellule_detail.mjs — LE DETAIL TIR PAR TIR DE LA CELLULE, `dz = z_s0 − z_close`.
// ============================================================================================
// CELLULE (owner, 20/08) — rang ①, SELL uniquement :
//   %K H1 live > 70 · dRSI H1 up/flat · dz up/flat · z H1 live < ${Z_MAX} · H4 DIVERGING
// ⭐ `dz` TRANCHE PAR L'OWNER : `z_s0 − z_close` (le `dZ` du moteur), PAS la colonne EA `dz_h1`.
// ⭐ `up/flat` = la colonne calibree n'est pas une colonne DOWN :
//      dRSI : `rsiDeltaCol`, FLAT = ]−0,95 · 0,95[
//      dz   : `contDzCol` (±0,20) OU `zDeltaCol` (calibre par niveau de tension)
// ⚠ L'HORLOGE DU dRSI N'A PAS ETE TRANCHEE ⇒ les deux bras sont rendus, jamais fondus.
// ⚙ Usage : `node stats/_exh_sell_cellule_detail.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { rsiDeltaCol } = await import(`${M}/experts/rsiExpert.js`);
const { zDeltaCol, zLevel } = await import(`${M}/experts/zscoreExpert.js`);
const { contDzCol } = await import(`${M}/contScoringV1.js`);
// ⚠ `Number("")` vaut 0 et il est FINI : une variable POSEE MAIS VIDE servirait un bras extreme en
//   silence. On n'accepte la surcharge que si elle est posee ET finie.
const _num = (k, def) => { const r = process.env[k]; if (r === undefined || String(r).trim() === "") return def;
  const v = Number(r); return Number.isFinite(v) ? v : def; };
const KD_H4_MIN = _num("KD_H4_MIN", 5);
const Z_MAX = _num("Z_MAX", 2.0);
const K_MIN = _num("K_MIN", 60);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2,
  chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const SELL = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && t.side === "SELL" && typeof t.R === "number");

const dz = (t) => (Number.isFinite(t.zscoreH1S0) && Number.isFinite(t.zscoreH1) ? t.zscoreH1S0 - t.zscoreH1 : null);
const PAS_DOWN = (c) => c !== null && !String(c).includes("DOWN");
const base = (t) => Number.isFinite(t.kH1) && t.kH1 > K_MIN && Number.isFinite(t.zscoreH1S0) && t.zscoreH1S0 < Z_MAX
  // ⭐ H4 : `K−D > KD_H4_MIN` (owner, 20/08) EN REMPLACEMENT de `kdCycleH4 === "DIVERGING"`.
  //   ⚠ CE N'EST PAS LA MEME QUESTION : `DIVERGING` est une VARIATION (l'ecart s'elargit d'au moins
  //   2,1 depuis la cloture precedente, sans regarder son AMPLITUDE) ; `K−D > 5` est un NIVEAU
  //   (l'ecart est large MAINTENANT, sans regarder s'il grandit). Une barre peut etre `DIVERGING`
  //   avec `K−D = 1`, et avoir `K−D = 19` en se REFERMANT.
  // ⚠ SELL uniquement, pas de miroir (owner) ⇒ `kdGapH4` lu BRUT, sans orientation.
  && Number.isFinite(t.kdGapH4) && t.kdGapH4 > KD_H4_MIN && Number.isFinite(dz(t));
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };

console.log(`\n══ RANG ① · SELL — CELLULE, dz = z_s0 − z_close ══`);
console.log(`   %K H1 live > ${K_MIN} · dRSI up/flat · dz up/flat · z H1 live < ${Z_MAX} · H4 K−D > ${KD_H4_MIN}`);
console.log(`   rang ① SELL : ${SELL.length} tirs · ${agg(SELL).R.toFixed(1)} R · ${(100 * agg(SELL).g / SELL.length).toFixed(2)} %`);

for (const [nr, fr] of [["dRSI CLOTURE `drsi_h1`", (t) => t.dRsiH1], ["dRSI LIVE `drsi_h1_s0`", (t) => t.dRsiH1Live]])
  for (const [nc, fc] of [["contDzCol (±0,20)", (t) => contDzCol(dz(t))], ["zDeltaCol (par niveau)", (t) => zDeltaCol(dz(t), zLevel(t.zscoreH1S0))]]) {
    const cell = SELL.filter((t) => base(t) && Number.isFinite(fr(t)) && PAS_DOWN(rsiDeltaCol(fr(t))) && PAS_DOWN(fc(t)))
      .sort((a, b) => (a.ep ?? 0) - (b.ep ?? 0));
    const v = agg(cell);
    console.log(`\n   ${"═".repeat(94)}`);
    console.log(`   ${nr}  ·  ${nc}   ⇒   ${v.n} tirs · ${v.n ? (100 * v.g / v.n).toFixed(2) : "—"} % · ${v.R.toFixed(1)} R · ${v.g}G/${v.n - v.g}P`);
    if (!v.n) continue;
    console.log(`   ${"actif".padEnd(13)}${"date/heure".padEnd(21)}${"kH1".padStart(6)}${"zLive".padStart(7)}${"zClos".padStart(7)}${"dz".padStart(7)}${"K-D H4".padStart(8)}${"colDz".padStart(9)}${"dRSI".padStart(7)}${"colRSI".padStart(13)}${"R".padStart(7)}`);
    for (const t of cell)
      console.log(`   ${String(t.asset ?? t.symbol).padEnd(13)}${String(t.tsMT).padEnd(21)}${t.kH1.toFixed(1).padStart(6)}` +
        `${t.zscoreH1S0.toFixed(2).padStart(7)}${t.zscoreH1.toFixed(2).padStart(7)}${dz(t).toFixed(2).padStart(7)}${t.kdGapH4.toFixed(1).padStart(8)}${String(fc(t)).padStart(9)}` +
        `${fr(t).toFixed(2).padStart(7)}${String(rsiDeltaCol(fr(t))).padStart(13)}${(t.R ?? 0).toFixed(2).padStart(7)}`);
    const g = new Set(cell.map((t) => `${t.asset ?? t.symbol}|${String(t.tsMT ?? "").slice(0, 10)}`));
    console.log(`   ⇒ ${cell.length} tirs sur ${g.size} couples actif|jour : ${[...g].join(" · ")}`);
  }
console.log("");
