// _carnet_exh.mjs — SNAPSHOT STANDARD DU CARNET EXH. Sert d'AVANT et d'APRÈS pour n'importe quel
//   changement moteur : on le lance, on stash/applique, on le relance, on compare deux blocs
//   IDENTIQUES EN FORME. ⭐ C'est ce qui évite de bricoler une sonde par mesure — et deux sondes
//   écrites séparément ne comptent jamais tout à fait pareil (motif `derived_dataset_computed_3x`).
// `LABEL=... node stats/_carnet_exh.mjs` pour nommer la colonne.
//
// ⚠ `NO_TRIO=1` = MOTEUR PUR (DealTrigger bypassé), comme `server.js` et les ~30 autres scripts
//   `stats/`. Ce n'est PAS la prod ; c'est la référence à laquelle toutes nos mesures se comparent.
//   L'oublier retire un tiers du carnet sans qu'aucun `params` ne bouge.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const LABEL = process.env.LABEL ?? "carnet";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const EXH = all.filter((s) => s.strategy === "EXH");
const tirs = EXH.filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");
const ep = dedupeEpisodes(EXH).filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) {
    const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++;
  }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN };
}
const BE = 75;
function line(lbl, t) {
  if (!t.length) { console.log("  " + lbl.padEnd(16) + "—"); return; }
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, sig = (wr - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  const gr = grappes(t);
  console.log("  " + lbl.padEnd(16) +
    `n=${String(t.length).padStart(4)}  WR ${wr.toFixed(1).padStart(5)} %  ` +
    `${(sig >= 0 ? "+" : "") + sig.toFixed(2)} σ  R ${(R >= 0 ? "+" : "") + R.toFixed(1).padStart(6)}  ` +
    `R/u ${(R / t.length).toFixed(3).padStart(6)}  | ${String(gr.g).padStart(3)} gr. ${gr.wr.toFixed(1)} %`);
}

console.log(`\n════ ${LABEL} ════  [maxOpen=30 · cadence 2 min · spread FACTURÉ · NO_TRIO]`);
console.log("── ÉPISODES (dédup 15 min) ──");
line("TOUS", ep); line("BUY", ep.filter((s) => s.side === "BUY")); line("SELL", ep.filter((s) => s.side === "SELL"));
console.log("── TIRS ⚠ biaisé ──");
line("TOUS", tirs); line("BUY", tirs.filter((s) => s.side === "BUY")); line("SELL", tirs.filter((s) => s.side === "SELL"));

// ⭐ VOLUME PAR ACTIF×JOUR — la cible owner est 5-10, et c'est une QUEUE (p90), pas une moyenne.
const parJour = new Map();
for (const s of EXH) {
  const k = `${s.asset}|${jour(s)}`;
  parJour.set(k, (parJour.get(k) ?? 0) + 1);
}
const v = [...parJour.values()].sort((a, b) => a - b);
const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
console.log(`── volume : ${(EXH.length / v.length).toFixed(1)} tirs/actif/jour ` +
  `· médiane ${q(0.5)} · p90 ${q(0.9)} · max ${v[v.length - 1]}   (cible owner 5-10)`);

// ⭐⭐ LE SILENCE DE LA 7ᵉ ENTRÉE — un muet SORT du dénominateur et AMPLIFIE les six autres. Une
//   entrée neuve qui se tait souvent ne fait pas « rien » : elle repondère tout le reste.
// ⛔ NE PAS LE CHERCHER DANS `s.sc.parts` : la fiche de trade ne porte PAS le détail du barème
//   (`sc` expose `exh`, `exhRaw`, `exp`…). Une sonde écrite là rend `100 % de muet` sur les SEPT
//   entrées et se lit comme un branchement cassé — sonde à la mauvaise ADRESSE, vécu ici même le
//   09/08. ⇒ On lit la SOURCE, `dRsiH1Live`, qui est dans la fiche.
const sansD = tirs.filter((s) => !Number.isFinite(s.dRsiH1Live)).length;
console.log(`── ⑦ Δ RSI H1 live : MUET sur ${(100 * sansD / (tirs.length || 1)).toFixed(1)} % des tirs ` +
  `(${sansD}/${tirs.length})`);
