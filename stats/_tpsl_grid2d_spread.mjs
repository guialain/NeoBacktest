// _tpsl_grid2d_spread.mjs — GRILLE TP × SL, SPREAD FACTURÉ, JUGÉE SUR LA ROTATION.
//   Usage: npx vite-node stats/_tpsl_grid2d_spread.mjs [ACTIF]
//
// ⭐ LE RATIO N'EST PAS UNE CONTRAINTE (owner 2026-08-03). La seule règle est `tp < sl` — on ne veut
//   jamais un TP long tenu par un SL court, parce que la stratégie est une ROTATION : on cherche à
//   maximiser la qualité EN MINIMISANT le temps de capital immobilisé.
//
// ⚠⚠ EN QUITTANT LE 1:3, LE POINT MORT BOUGE AVEC CHAQUE CELLULE : `be = sl/(sl+tp)`. Les WR ne sont
//   donc PLUS comparables d'une cellule à l'autre — c'est la règle 2 de `TpSlConfig`, suspendue tant
//   qu'on restait à ratio constant, et qui redevient active ici. On lit la MARGE (`WR − be`), jamais
//   le WR nu. Un tableau de WR sur cette grille serait un piège.
//
// ⭐🔥 LA MÉTRIQUE DE ROTATION : `R/h` = R par trade ÷ (hold en heures). C'est elle qui encode la
//   consigne — deux couples au même R/trade ne se valent pas si l'un immobilise le capital deux
//   fois plus longtemps. ⚠ Le R/trade seul favorise SYSTÉMATIQUEMENT les couples larges (plus de
//   temps pour atteindre le TP) : le juger seul, c'est répondre à une autre question que celle posée.
//
// ⚠ Spread FACTURÉ et cap P50 ACTIF : c'est le moteur courant. Mono-actif (capacité infinie), l'outil
//   des A/B — pas le portefeuille.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { getTpSl } from "../../Matrix-Revolution/src/config/TpSlConfig.js";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const only = process.argv[2] ? process.argv[2].toUpperCase() : null;
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv"))
  .filter((f) => !only || f.replace(/\.csv$/i, "").toUpperCase() === only).sort();

const TPS = [0.45, 0.55, 0.65, 0.80, 1.00];
const SLS = [1.20, 1.50, 1.80, 2.10, 2.50, 3.00];

const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

function cell(file, tp, sl) {
  const r = runMatrixBacktest(path.join(MATRIX, file), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, tpAtr: tp, slAtr: sl });
  const t = (r.signals || []).filter((s) => typeof s.R === "number");
  const w = t.filter((x) => x.outcome === "WIN").length, l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + b.R, 0);
  const wr = (w + l) ? 100 * w / (w + l) : NaN;
  const be = 100 * sl / (sl + tp);                       // point mort ANALYTIQUE du couple
  const hold = med(t.map((x) => x.barsHeld).filter(Number.isFinite));   // minutes
  const rt = t.length ? R / t.length : NaN;
  return { tp, sl, n: t.length, wr, be, marge: wr - be, rt, R, hold, rh: (hold > 0 ? rt / (hold / 60) : NaN) };
}

const summary = [];
for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  const cur = getTpSl(asset);
  // ⚠ LE COUPLE CONFIGURÉ EST AJOUTÉ À LA GRILLE, toujours. Sans ça le statu quo tombe « hors
  //   grille » sur tous les actifs dérogés (AUDUSD 0,48/1,44, EURUSD 0,45/1,35…) et on compare un
  //   optimum à RIEN. Une grille qui ne contient pas l'état actuel ne peut pas justifier d'en sortir.
  const pts = [];
  for (const tp of TPS) for (const sl of SLS) if (tp < sl) pts.push([tp, sl]);
  if (!pts.some(([t, s]) => Math.abs(t - cur.tp) < 1e-9 && Math.abs(s - cur.sl) < 1e-9)) pts.push([cur.tp, cur.sl]);
  const cells = pts.map(([tp, sl]) => cell(f, tp, sl));
  if (!cells.some((c) => c.n > 0)) { console.log(`${asset.padEnd(12)} aucun trade (hors whitelist)`); continue; }

  // ⚠ EFFECTIF MINIMUM : une cellule à 40 trades peut afficher n'importe quel R/h. On exige 150.
  const ok = cells.filter((c) => c.n >= 150 && Number.isFinite(c.rh));
  const byRh = [...ok].sort((a, b) => b.rh - a.rh)[0];
  const byRt = [...ok].sort((a, b) => b.rt - a.rt)[0];
  const curCell = cells.find((c) => Math.abs(c.tp - cur.tp) < 1e-9 && Math.abs(c.sl - cur.sl) < 1e-9);

  console.log(`\n${asset}  —  config ${cur.tp}/${cur.sl}${curCell ? "" : "  (hors grille)"}`);
  console.log(`  ${"tp/sl".padEnd(11)} ${"n".padStart(5)} ${"WR".padStart(7)} ${"pt mort".padStart(8)} ${"MARGE".padStart(7)} ${"R/tr".padStart(8)} ${"hold".padStart(6)} ${"R/h".padStart(8)}`);
  for (const c of cells) {
    if (!(c.n >= 150)) continue;
    const tag = (c === byRh ? " ⬅ meilleur R/h" : "") + (c === byRt && c !== byRh ? " ← meilleur R/tr" : "");
    console.log(`  ${`${c.tp}/${c.sl}`.padEnd(11)} ${String(c.n).padStart(5)} ${c.wr.toFixed(2).padStart(7)} ${c.be.toFixed(2).padStart(8)} ${c.marge.toFixed(2).padStart(7)} ${c.rt.toFixed(4).padStart(8)} ${String(c.hold).padStart(6)} ${c.rh.toFixed(4).padStart(8)}${tag}`);
  }
  summary.push({ asset, cur, curCell, byRh, byRt });
}

if (!only) {
  console.log("\n" + "=".repeat(112));
  console.log(`${"actif".padEnd(12)} ${"config".padStart(10)} ${"marge".padStart(7)} ${"hold".padStart(6)} ${"R/h".padStart(8)}  │ ${"meilleur R/h".padStart(12)} ${"marge".padStart(7)} ${"hold".padStart(6)} ${"R/h".padStart(8)}  │ meilleur R/tr`);
  console.log("-".repeat(112));
  for (const s of summary) {
    const c = s.curCell, b = s.byRh, t = s.byRt;
    const f = (x, k, d = 2) => (x && Number.isFinite(x[k]) ? x[k].toFixed(d) : "—");
    console.log(`${s.asset.padEnd(12)} ${`${s.cur.tp}/${s.cur.sl}`.padStart(10)} ${f(c, "marge").padStart(7)} ${(c ? String(c.hold) : "—").padStart(6)} ${f(c, "rh", 4).padStart(8)}  │ ${`${b.tp}/${b.sl}`.padStart(12)} ${f(b, "marge").padStart(7)} ${String(b.hold).padStart(6)} ${f(b, "rh", 4).padStart(8)}  │ ${t.tp}/${t.sl} (R/tr ${t.rt.toFixed(4)}, hold ${t.hold})`);
  }
  console.log("-".repeat(112));
  const wider = summary.filter((s) => s.byRh.sl > s.cur.sl).length;
  const tighter = summary.filter((s) => s.byRh.sl < s.cur.sl).length;
  const disagree = summary.filter((s) => s.byRh !== s.byRt).length;
  console.log(`  optimum ROTATION (R/h) : SL plus large sur ${wider}/${summary.length} · plus serré ${tighter} · inchangé ${summary.length - wider - tighter}`);
  console.log(`  ⚠ R/h et R/tr DÉSIGNENT DES COUPLES DIFFÉRENTS sur ${disagree}/${summary.length} actifs — c'est l'arbitrage qualité/temps, il ne se tranche pas tout seul.`);
  console.log(`  ⚠ Cellules < 150 trades masquées. Optima IN-SAMPLE sur une fenêtre : aucun couple n'entre dans TpSlConfig sans split temporel.`);
}
