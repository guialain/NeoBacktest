// _spread_ab.mjs — A/B DE LA FACTURATION DU SPREAD.
//   Usage: npx vite-node stats/_spread_ab.mjs
//
// ⚠⚠ LE PREMIER RÉSULTAT N'EST PAS LE B, C'EST LE A. Le run sans facturation DOIT reproduire la
//   référence AU BIT PRÈS. Sinon l'écart mesuré ensuite n'est pas attribuable au spread — il contient
//   le bruit d'un changement de configuration. Le contrôle passe AVANT la mesure.
// ⚠ CONFIGURATION = CELLE DE `_seuil_sweep.mjs` : mono-actif par actif, PUIS agrégé. Ce n'est PAS
//   `runMatrixPortfolio` — en portefeuille les 30 places sont partagées et le volume tombe à ~3 900.
//   Les deux modes sont légitimes mais ne sont pas comparables, et la référence 9 058 est le premier.
//
// Modèle facturé : celui de `Neo_TradeExecutor.mq5` — BUY rempli à l'ASK, SELL au BID, SL/TP
//   recalculés depuis ce prix. Le R de chaque issue reste NOMINAL ; c'est le WR qui bouge.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort();

const collect = (chargeSpread) => {
  const all = [];
  for (const f of files) {
    const r = runMatrixBacktest(path.join(MATRIX, f), { maxOpen: 30, cadenceMin: 2, chargeSpread });
    for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ R: s.R, out: s.outcome, type: s.type, side: s.side, exit: s.exitTs || s.tsMT || "", asset: r.asset });
  }
  return all;
};

const wr = (t) => { const w = t.filter((x) => x.out === "WIN").length, l = t.filter((x) => x.out === "LOSS").length; return (w + l) ? w / (w + l) * 100 : NaN; };
const sumR = (t) => t.reduce((a, b) => a + b.R, 0);
// maxDD en R, sur la courbe d'équité ordonnée par SORTIE — comme `_seuil_sweep.mjs`.
const mdd = (t) => { const o = [...t].sort((a, b) => a.exit.localeCompare(b.exit)); let e = 0, p = 0, d = 0; for (const x of o) { e += x.R; p = Math.max(p, e); d = Math.max(d, p - e); } return d; };
const stat = (t) => ({ n: t.length, wr: wr(t), rt: t.length ? sumR(t) / t.length : NaN, R: sumR(t), dd: mdd(t) });

const A = collect(false), B = collect(true);

// ⚠⚠ GARDE-FOU — UN ACTIF QUI NE BOUGE PAS DE ZÉRO EXACTEMENT N'EST PAS UN RÉSULTAT, C'EST UNE PANNE.
//   C'est comme ça que le bug de `fireSnapshot` (clé `spread` arrondie à 2 décimales, donc nulle sur
//   tout le FX) a été trouvé : six actifs affichaient « aucun changement » sans une seule erreur.
//   Le contrôle reste EN PLACE — un `r2` réintroduit ailleurs redonnerait exactement le même silence.
{
  const dead = [];
  for (const s of [...new Set(A.map((x) => x.asset))]) {
    const ra = A.filter((x) => x.asset === s), rb = B.filter((x) => x.asset === s);
    if (!ra.length) continue;
    const same = ra.length === rb.length
      && ra.reduce((a, b) => a + b.R, 0).toFixed(6) === rb.reduce((a, b) => a + b.R, 0).toFixed(6);
    if (same) dead.push(s);
  }
  if (dead.length) {
    console.error(`\n🔴 SPREAD NON FACTURÉ sur ${dead.length} actif(s) : ${dead.join(", ")}`);
    console.error("   Le R total est IDENTIQUE au centième près. Vérifier `spreadRaw` dans le candidat");
    console.error("   (collision de clé avec `fireSnapshot`) et la colonne `spread` du dataset.\n");
  }
}
const a = stat(A), b = stat(B);
const fmt = (r) => `${String(r.n).padStart(5)} tr · WR ${r.wr.toFixed(2).padStart(6)} % · R/tr ${r.rt.toFixed(4).padStart(8)} · R ${r.R.toFixed(1).padStart(7)} · maxDD ${r.dd.toFixed(1).padStart(6)}`;

console.log("\n" + "=".repeat(96));
console.log("A/B FACTURATION DU SPREAD — mono-actif agrégé, maxOpen 30, cadence 2 min");
console.log("=".repeat(96));
console.log(`  A · SANS spread (référence)  ${fmt(a)}`);
console.log(`  B · AVEC spread facturé      ${fmt(b)}`);
console.log("-".repeat(96));
console.log(`  Δ                            ${String(b.n - a.n).padStart(5)} tr · WR ${(b.wr - a.wr).toFixed(2).padStart(6)} pt · R/tr ${(b.rt - a.rt).toFixed(4).padStart(8)} · R ${(b.R - a.R).toFixed(1).padStart(7)} · maxDD ${(b.dd - a.dd).toFixed(1).padStart(6)}`);
console.log("=".repeat(96));
console.log("  Attendu en A : 9 058 tr · 81,1 % · R/tr 0,0832 · maxDD 39,4   ⚠ si A dévie, NE PAS LIRE B.");

// ── PAR CÔTÉ — le spread mord-il symétriquement ? BUY paie à l'entrée, SELL à la sortie. ──
console.log("\n  par CÔTÉ :");
for (const side of ["BUY", "SELL"]) {
  const sa = stat(A.filter((x) => x.side === side)), sb = stat(B.filter((x) => x.side === side));
  console.log(`    ${side.padEnd(5)} A ${sa.wr.toFixed(2)} % → B ${sb.wr.toFixed(2)} %  (${(sb.wr - sa.wr).toFixed(2)} pt)   R/tr ${sa.rt.toFixed(4)} → ${sb.rt.toFixed(4)}`);
}

// ── PAR ACTIF — qui devient négatif une fois le spread payé ? ──
console.log("\n  par ACTIF (R/tr) — ⬅ = passe sous zéro :");
const assets = [...new Set(A.map((x) => x.asset))].sort();
for (const s of assets) {
  const sa = stat(A.filter((x) => x.asset === s)), sb = stat(B.filter((x) => x.asset === s));
  if (!sa.n) continue;
  const flip = sa.rt > 0 && sb.rt <= 0 ? "   ⬅ PASSE NÉGATIF" : "";
  console.log(`    ${s.padEnd(12)} ${sa.rt.toFixed(4).padStart(8)} → ${sb.rt.toFixed(4).padStart(8)}   (WR ${sa.wr.toFixed(1)} → ${sb.wr.toFixed(1)})${flip}`);
}
