// _spread_cap.mjs — CAP D'ADMISSION SUR LE SPREAD : on n'admet pas une barre dont le péage est cher.
//   Usage: npx vite-node stats/_spread_cap.mjs
//
// Seuil sur `spread / atr_h1`, percentile PAR ACTIF. Toutes les mesures sont faites SPREAD FACTURÉ
//   (`chargeSpread`) — juger un cap de spread sur un moteur qui ne paie pas le spread n'aurait
//   aucun sens : le cap ne pourrait que retirer des trades, jamais en économiser.
//
// ⭐ DEUX LECTURES, ET LA SECONDE EST CELLE QUI DÉCIDE :
//   1. LE NET — ce que le moteur devient. ⚠ Une admission refusée LIBÈRE une place au carnet, donc
//      un autre trade la prend : le delta est un REMPLACEMENT, pas une soustraction.
//   2. LA COHORTE RETIRÉE — ce que valaient VRAIMENT les barres coupées, mesuré sur le run SANS cap.
//      C'est la seule lecture qui réponde à « le seuil retire-t-il du déchet ? », et le repère est le
//      POINT MORT, pas zéro. Cf. `backtest_whitelist_and_slope_2026_08_02`.
// ⚠ Il n'y a PAS d'optimum à trouver ici : c'est un arbitrage de risque. Le tableau sert à choisir,
//   pas à désigner un gagnant.
import fs from "fs";
import path from "path";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
const PCTS = [null, 90, 80, 70, 60, 50];

const st = (t) => {
  const w = t.filter((x) => x.outcome === "WIN").length, l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + b.R, 0);
  const o = [...t].sort((a, b) => String(a.exit).localeCompare(String(b.exit))); let e = 0, p = 0, d = 0;
  for (const x of o) { e += x.R; p = Math.max(p, e); d = Math.max(d, p - e); }
  // Point mort du run : il BOUGE avec la composition (R moyen d'un TP), donc la marge est la seule
  //   quantité comparable d'une ligne à l'autre. Même règle que TpSlConfig n°2.
  const tp = t.filter((x) => x.reason === "TP");
  const rtp = tp.length ? tp.reduce((s, x) => s + x.R, 0) / tp.length : NaN;
  const be = Number.isFinite(rtp) ? 100 / (1 + rtp) : NaN;
  const wr = (w + l) ? 100 * w / (w + l) : NaN;
  return { n: t.length, wr, rt: t.length ? R / t.length : NaN, R, dd: d, be, marge: wr - be };
};

// ⚠⚠ PROJECTION IMMÉDIATE, PAS `{...s}` : chaque signal porte une COPIE PLATE de sa ligne
//   (`fireSnapshot`, ~292 colonnes). Six runs d'univers gardés entiers font sauter le tas à 4 Go —
//   le fichier moteur le documente déjà pour `rows`, et c'est arrivé ici au premier essai. On ne
//   retient que les six champs dont les deux lectures ont besoin.
const collect = (opts) => {
  const all = [];
  for (const f of files) {
    const r = runMatrixBacktest(path.join(MATRIX, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, spreadCap: false, ...opts });
    for (const s of (r.signals || [])) if (typeof s.R === "number")
      all.push({ R: s.R, outcome: s.outcome, reason: s.reason, exit: s.exitTs || s.tsMT || "",
                 asset: r.asset, ratio: (s.spreadRaw > 0 && s.atr > 0) ? s.spreadRaw / s.atr : null });
  }
  return all;
};

// ── 1 · LE NET — imprimé AU FIL DE L'EAU, un seul run vivant à la fois. ──
console.log("\n" + "=".repeat(104));
console.log("CAP D'ADMISSION SUR `spread / atr_h1` — spread FACTURÉ dans tous les runs");
console.log("=".repeat(104));
console.log(`  ${"cap".padEnd(8)} ${"trades".padStart(7)} ${"WR".padStart(8)} ${"pt mort".padStart(8)} ${"MARGE".padStart(7)} ${"R/tr".padStart(9)} ${"R".padStart(8)} ${"maxDD".padStart(7)}`);
console.log("  " + "-".repeat(100));
let base = null;
for (const pct of PCTS) {
  const t = collect(pct == null ? {} : { spreadCapPct: pct });
  if (pct == null) base = t;                       // seul run conservé : il sert à la cohorte
  const s = st(t);
  console.log(`  ${(pct == null ? "aucun" : "P" + pct).padEnd(8)} ${String(s.n).padStart(7)} ${(s.wr.toFixed(2) + "%").padStart(8)} ${(s.be.toFixed(2) + "%").padStart(8)} ${s.marge.toFixed(2).padStart(7)} ${s.rt.toFixed(4).padStart(9)} ${s.R.toFixed(1).padStart(8)} ${s.dd.toFixed(1).padStart(7)}`);
}

// ── 2 · LA COHORTE RETIRÉE, mesurée sur le run SANS cap ──
// Seuils par actif, recalculés exactement comme le moteur.
const thr = {};
for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  const raw = fs.readFileSync(path.join(MATRIX, f), "utf8").trim().split(/\r?\n/);
  const h = raw[0].split(";"); const iS = h.indexOf("spread"), iA = h.indexOf("atr_h1");
  const v = [];
  for (const l of raw.slice(1)) { const c = l.split(";"); const s = +c[iS], a = +c[iA]; if (s > 0 && a > 0) v.push(s / a); }
  v.sort((x, y) => x - y);
  thr[asset] = {};
  for (const p of PCTS) if (p != null) thr[asset][p] = v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p / 100))] : Infinity;
}

console.log("\n  CE QUE CHAQUE CRAN RETIRE (cohorte, mesurée sans cap) — repère = le POINT MORT du run :");
console.log("  " + "-".repeat(100));
console.log(`  ${"cap".padEnd(8)} ${"retirés".padStart(8)} ${"% du livre".padStart(11)} ${"WR retiré".padStart(10)} ${"R/tr retiré".padStart(12)} ${"R retiré".padStart(9)}`);
console.log("  " + "-".repeat(100));
for (const p of PCTS) {
  if (p == null) continue;
  const cut = base.filter((x) => x.ratio != null && x.ratio > (thr[x.asset]?.[p] ?? Infinity));
  const s = st(cut);
  console.log(`  ${("P" + p).padEnd(8)} ${String(s.n).padStart(8)} ${((100 * s.n / base.length).toFixed(1) + "%").padStart(11)} ${(Number.isFinite(s.wr) ? s.wr.toFixed(2) + "%" : "—").padStart(10)} ${(Number.isFinite(s.rt) ? s.rt.toFixed(4) : "—").padStart(12)} ${s.R.toFixed(1).padStart(9)}`);
}
console.log("  " + "-".repeat(100));
console.log("  Un lot retiré AU-DESSUS du point mort (~75 %) est de la qualité qu'on jette.");
console.log("  Un lot SOUS le point mort est du déchet — c'est ce qu'on cherche.");

// ── 3 · LE CAP EST-IL UNE PORTE DE COÛT, OU UNE PORTE DE RÉGIME ? ────────────────────────────────
// ⭐⭐ LA QUESTION QUI DÉCIDE DE L'INTERPRÉTATION. Un `spread/atr` élevé, c'est un ATR BAS : marché
//   calme. Le cap pourrait donc retirer deux choses très différentes, et il faut savoir laquelle :
//     · si la cohorte est SAINE hors spread et nulle spread facturé ⇒ porte de COÛT pure. Le cap ne
//       corrige pas le moteur, il paie moins cher les mêmes trades.
//     · si elle est DÉJÀ mauvaise hors spread ⇒ le cap est AUSSI un filtre de RÉGIME, et il aurait
//       dû être trouvé depuis longtemps sans jamais parler de spread.
//   ⚠ Sans ce contrôle, on attribuerait au spread un effet qui appartient à la volatilité.
const bare = collect({ chargeSpread: false });
console.log("\n  MÊME COHORTE, SPREAD NON FACTURÉ — porte de coût ou porte de régime ?");
console.log("  " + "-".repeat(100));
console.log(`  ${"cap".padEnd(8)} ${"retirés".padStart(8)} ${"WR hors spread".padStart(15)} ${"R/tr hors spread".padStart(17)}   (rappel : point mort 75,02 %)`);
console.log("  " + "-".repeat(100));
for (const p of PCTS) {
  if (p == null) continue;
  const cut = bare.filter((x) => x.ratio != null && x.ratio > (thr[x.asset]?.[p] ?? Infinity));
  const s = st(cut);
  console.log(`  ${("P" + p).padEnd(8)} ${String(s.n).padStart(8)} ${(Number.isFinite(s.wr) ? s.wr.toFixed(2) + "%" : "—").padStart(15)} ${(Number.isFinite(s.rt) ? s.rt.toFixed(4) : "—").padStart(17)}`);
}
