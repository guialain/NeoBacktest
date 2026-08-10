// _tpsl_portfolio_grid.mjs — LA GRILLE TP × SL EN PORTEFEUILLE, GRILLE ÉLARGIE, SPREAD FACTURÉ.
//   Usage: npx vite-node stats/_tpsl_portfolio_grid.mjs
//
// ⭐🔥 POURQUOI LE PORTEFEUILLE EST LE SEUL RÉGIME QUI PUISSE TRANCHER. En mono-actif la capacité est
//   INFINIE : libérer une place ne sert à rien, donc `R/h` récompense un hold court sans que le
//   bénéfice de la rotation existe nulle part dans la mesure. On optimisait une contrainte que le
//   harnais n'appliquait pas. Ici les 30 places sont PARTAGÉES : un couple qui sort plus vite rend
//   une place que quelqu'un d'autre prend, et le gain de rotation devient VISIBLE — dans le VOLUME
//   et dans le R total, pas seulement dans un ratio.
//   ⇒ Corollaire à ne pas manquer : en portefeuille, `R/h` cesse d'être la métrique-clé. Le volume
//   supplémentaire EST le bénéfice, et il est déjà compté dans le R total. On lit la MARGE (qualité)
//   et le maxDD (risque), avec le R total comme contrôle d'extensivité.
//
// ⚠⚠ UN COUPLE PASSÉ EN OPTION ÉCRASE `TpSlConfig` POUR TOUS LES ACTIFS. Cette grille explore donc
//   une ÉCHELLE UNIVERSELLE, pas une table par actif. La cellule `config` (sans override) est le
//   STATU QUO — la table par actif du 01/08 — et c'est la seule ligne à laquelle comparer.
//
// ⚠ GRILLE ÉLARGIE des deux côtés : la grille précédente était TRONQUÉE, `R/h` s'échappait par
//   `sl = 1,20` (borne basse) sur 8/17 actifs et `R/tr` par `tp = 1,00` (borne haute) sur 13/17.
//   On descend jusqu'à `sl = 0,75` et on monte jusqu'à `tp = 1,25`.
// ⚠ Seule contrainte de modèle : `tp < sl` (owner) — jamais un TP long tenu par un SL court.
// ⚠ Le point mort BOUGE avec chaque cellule (`be = sl/(sl+tp)`) ⇒ lire la MARGE, jamais le WR nu.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixPortfolio } from "../src/components/simulations/matrixBacktest.mjs";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort()
  .map((f) => path.join(MATRIX, f));

const TPS = [0.35, 0.45, 0.55, 0.65, 0.80, 1.00, 1.25];
const SLS = [0.75, 0.90, 1.05, 1.20, 1.50, 1.80, 2.25, 3.00];

const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

function run(tp, sl) {
  const o = { maxOpen: 30, cadenceMin: 2, chargeSpread: true };
  if (tp != null) { o.tpAtr = tp; o.slAtr = sl; }
  const r = runMatrixPortfolio(files, o);
  const t = (r.signals || []).filter((s) => typeof s.R === "number");
  const w = t.filter((x) => x.outcome === "WIN").length, l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + b.R, 0);
  const wr = (w + l) ? 100 * w / (w + l) : NaN;
  // Point mort ANALYTIQUE. ⚠ Sur la cellule `config` les couples diffèrent par actif : il n'y a PAS
  //   de point mort unique, on le laisse à null plutôt que d'en inventer un qui n'existe pas.
  const be = tp == null ? NaN : 100 * sl / (sl + tp);
  const hold = med(t.map((x) => x.barsHeld).filter(Number.isFinite));
  const rt = t.length ? R / t.length : NaN;
  const dd = r.summary?.maxDrawdown ?? NaN;
  return { tp, sl, n: t.length, wr, be, marge: wr - be, rt, R, hold, dd,
           rh: (hold > 0 ? rt / (hold / 60) : NaN) };
}

const rows = [];
const REF = run(null, null);                      // STATU QUO : table par actif du 01/08
rows.push({ ...REF, label: "config (par actif)" });
console.log(`\nRéférence portefeuille — table par actif : ${REF.n} tr · WR ${REF.wr.toFixed(2)} % · R/tr ${REF.rt.toFixed(4)} · R ${REF.R.toFixed(1)} · hold ${REF.hold} · maxDD ${REF.dd}\n`);

for (const tp of TPS) for (const sl of SLS) {
  if (!(tp < sl)) continue;
  const c = { ...run(tp, sl), label: `${tp}/${sl}` };
  rows.push(c);
  console.log(`  ${c.label.padEnd(11)} ${String(c.n).padStart(5)} tr · WR ${c.wr.toFixed(2).padStart(6)} · be ${c.be.toFixed(2).padStart(6)} · MARGE ${c.marge.toFixed(2).padStart(7)} · R/tr ${c.rt.toFixed(4).padStart(8)} · R ${c.R.toFixed(1).padStart(7)} · hold ${String(c.hold).padStart(4)} · DD ${String(c.dd).padStart(7)}`);
}

// ── CLASSEMENTS — trois objectifs, et ils ne désignent pas la même cellule. ──
const grid = rows.filter((r) => r.tp != null && r.n >= 500);
const top = (key, dir = -1) => [...grid].sort((a, b) => dir * (a[key] - b[key])).slice(0, 5);
const show = (t) => t.map((c) => `${c.label} (n=${c.n} marge ${Number.isFinite(c.marge) ? c.marge.toFixed(2) : "—"} R ${c.R.toFixed(0)} hold ${c.hold} DD ${c.dd})`).join("\n      ");

console.log("\n" + "=".repeat(104));
console.log(`STATU QUO (table par actif) : ${REF.n} tr · R ${REF.R.toFixed(1)} · hold ${REF.hold} · maxDD ${REF.dd}`);
console.log("=".repeat(104));
console.log(`  meilleure MARGE (qualité) :\n      ${show(top("marge"))}`);
console.log(`\n  meilleur R TOTAL (ce que le compte gagne) :\n      ${show(top("R"))}`);
console.log(`\n  plus petit maxDD (risque) :\n      ${show(top("dd", +1))}`);
console.log("\n" + "-".repeat(104));
console.log("  ⚠ En portefeuille le VOLUME est un résultat, pas un paramètre : un couple plus court rend");
console.log("    ses places et le carnet en réouvre d'autres. Le gain de rotation est DANS le R total.");
console.log("  ⚠ Cellules < 500 trades masquées. Optima IN-SAMPLE sur une fenêtre — aucun couple n'entre");
console.log("    dans TpSlConfig sans split temporel (cf. la note du 17/07 : +656 R = surtout du surajustement).");
