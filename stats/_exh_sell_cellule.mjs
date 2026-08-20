// _exh_sell_cellule.mjs — UNE CELLULE, UN CHIFFRE. Aucune inference, aucun rapprochement.
// ============================================================================================
// CELLULE DEMANDEE (owner, 20/08) — rang ①, cote SELL uniquement :
//     %K H1 LIVE   > 70
//     dRSI H1      up/flat   (≥ 0)
//     dz H1        flat/up   (≥ 0)
//     z H1 LIVE    < 2,2
//     H4           DIVERGING
//
// CHAMPS EXACTS UTILISES (pour que la lecture soit verifiable) :
//   `kH1`        = `stoch_k_h1_s0`  — LIVE (perTf.h1.k, `dynamicsGate` l.1620)
//   `dRsiH1`     = `drsi_h1`        — colonne EA        [bras LIVE : `dRsiH1Live` = `drsi_h1_s0`]
//   `dzH1Col`    = `dz_h1`          — colonne EA
//   `zscoreH1S0` = `zscore_h1_s0`   — LIVE
//   `kdCycleH4`  = `kdCycleState` du moteur (bande morte 2,1, non signee)
// ⚠ Cote SELL impose ⇒ valeurs lues BRUTES, sans orientation miroir.
// ⚙ Usage : `node stats/_exh_sell_cellule.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2,
  chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });

const SELL = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && t.side === "SELL" && typeof t.R === "number");
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const ligne = (lbl, a) => {
  if (!a.length) { console.log(`   ${lbl.padEnd(44)}      0 tir`); return; }
  const v = agg(a);
  console.log(`   ${lbl.padEnd(44)}${String(v.n).padStart(5)} tirs   ${(100 * v.g / v.n).toFixed(2).padStart(6)} %   ${v.R.toFixed(1).padStart(7)} R   ${(v.R / v.n).toFixed(4).padStart(8)} R/tir   ${v.g}G/${v.n - v.g}P`);
};

// ⚠ UN CAPTEUR ABSENT N'EST PAS UN « NON » : les tirs ou un champ manque sont COMPTES A PART,
//   jamais ranges dans le complement.
const lisible = SELL.filter((t) => [t.kH1, t.dRsiH1, t.dzH1Col, t.zscoreH1S0].every(Number.isFinite)
  && typeof t.kdCycleH4 === "string");

console.log(`\n══ RANG ① · SELL — %K H1 live > 70 · dRSI H1 ≥ 0 · dz H1 ≥ 0 · z H1 live < 2,2 · H4 DIVERGING ══`);
console.log(`   NO_TRIGGER=1 · capacite 100/100 · MIN_EXH par defaut`);
console.log(`   tirs EXH SELL ${SELL.length} · lisibles ${lisible.length}` + (SELL.length !== lisible.length ? `  ⚠ ${SELL.length - lisible.length} exclus (capteur absent)` : ""));

const CELL = (t) => t.kH1 > 70 && t.dRsiH1 >= 0 && t.dzH1Col >= 0 && t.zscoreH1S0 < 2.2 && t.kdCycleH4 === "DIVERGING";
console.log(`\n   ${"".padEnd(44)}${"tirs".padStart(5)}         WR          R        R/tir`);
ligne(`⭐ LA CELLULE`, lisible.filter(CELL));
ligne(`   son complement`, lisible.filter((t) => !CELL(t)));
ligne(`   TOUT LE RANG ① SELL`, lisible);

// BRAS LIVE DU dRSI — le seul champ dont l'horloge n'etait pas precisee dans la demande.
const CELL_L = (t) => t.kH1 > 70 && t.dRsiH1Live >= 0 && t.dzH1Col >= 0 && t.zscoreH1S0 < 2.2 && t.kdCycleH4 === "DIVERGING";
const lisibleL = SELL.filter((t) => [t.kH1, t.dRsiH1Live, t.dzH1Col, t.zscoreH1S0].every(Number.isFinite) && typeof t.kdCycleH4 === "string");
console.log(`\n   ── meme cellule avec dRSI H1 LIVE (\`drsi_h1_s0\`) au lieu de la colonne \`drsi_h1\` ──`);
ligne(`   LA CELLULE (dRSI live)`, lisibleL.filter(CELL_L));

// L'EMPILEMENT, terme par terme — chiffres bruts, dans l'ordre ou ils ont ete dictes.
console.log(`\n   ── empilement, terme par terme ──`);
let cur = lisible;
for (const [lbl, f] of [["%K H1 live > 70", (t) => t.kH1 > 70],
                        ["+ dRSI H1 up/flat (≥ 0)", (t) => t.dRsiH1 >= 0],
                        ["+ dz H1 flat/up (≥ 0)", (t) => t.dzH1Col >= 0],
                        ["+ z H1 live < 2,2", (t) => t.zscoreH1S0 < 2.2],
                        ["+ H4 DIVERGING", (t) => t.kdCycleH4 === "DIVERGING"]]) {
  cur = cur.filter(f);
  ligne(`   ${lbl}`, cur);
}

// LE DETAIL DE LA CELLULE, TIR PAR TIR.
const c = lisible.filter(CELL);
if (c.length) {
  console.log(`\n   ── la cellule, tir par tir ──`);
  console.log(`   ${"actif".padEnd(13)}${"date/heure".padEnd(21)}${"kH1".padStart(7)}${"dRSI".padStart(7)}${"dz".padStart(7)}${"zLive".padStart(7)}${"R".padStart(7)}`);
  for (const t of c.sort((a, b) => (a.ep ?? 0) - (b.ep ?? 0)))
    console.log(`   ${String(t.asset ?? t.symbol).padEnd(13)}${String(t.tsMT).padEnd(21)}${t.kH1.toFixed(1).padStart(7)}${t.dRsiH1.toFixed(2).padStart(7)}${t.dzH1Col.toFixed(2).padStart(7)}${t.zscoreH1S0.toFixed(2).padStart(7)}${(t.R ?? 0).toFixed(2).padStart(7)}`);
  const g = new Set(c.map((t) => `${t.asset ?? t.symbol}|${String(t.tsMT ?? "").slice(0, 10)}`));
  console.log(`   ⇒ ${c.length} tirs sur ${g.size} couples actif|jour`);
}
console.log("");
