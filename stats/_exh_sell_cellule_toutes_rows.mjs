// _exh_sell_cellule_toutes_rows.mjs — LA CELLULE SUR **TOUTES LES LIGNES**, sans aucun filtre moteur.
// ============================================================================================
// 🎯 LA DEMANDE (owner, 20/08) : mesurer la cellule sur TOUTES les rows, pas seulement celles que
//   `MIN_EXH` et les vetos ont laissees passer.
//
// 🔴 CE QUE `ghostAllExh` NE POUVAIT PAS FAIRE : il exige `exh !== 0`, donc « la these de fade a un
//   avis ». C'est deja un filtre du bareme. `ghostAllRows` ne conditionne sur RIEN.
//
// ⚠⚠ CE QUE LA MESURE EST, ET CE QU'ELLE N'EST PAS :
//   · Le cote n'existe pas sur une barre non selectionnee ⇒ on IMPOSE SELL et on simule une entree.
//     Ce n'est PAS ce que le moteur ferait ; c'est la valeur INFORMATIVE des capteurs.
//   · Aucune capacite, aucun spacing, aucun veto, aucun seuil ⇒ les tirs ne se concurrencent pas.
//   · Le TP/SL et le spread restent ceux de l'actif (`walk`), donc le point mort reste 75 %.
// ⚠⚠ SANS DEDUPLICATION, une condition vraie 30 minutes de suite compte 30 fois. On rend donc les
//   DEUX : brut ET dedupe par episode (`_episodes.mjs`), plus le nombre de grappes actif|jour.
//   Si les deux lectures divergent, le resultat EST la rafale.
// ⚙ Usage : `node stats/_exh_sell_cellule_toutes_rows.mjs`  ·  `K_MIN=50 Z_MAX=2.0 KD_H4_MIN=5`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes } from "./_episodes.mjs";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring";
const { rsiDeltaCol } = await import(`${M}/experts/rsiExpert.js`);
const { zDeltaCol, zLevel } = await import(`${M}/experts/zscoreExpert.js`);
const { contDzCol } = await import(`${M}/contScoringV1.js`);
const { MIN_EXH } = await import(`${M}/scoringDecision.js`);

const _num = (k, def) => { const r = process.env[k]; if (r === undefined || String(r).trim() === "") return def;
  const v = Number(r); return Number.isFinite(v) ? v : def; };
const K_MIN = _num("K_MIN", 50), Z_MAX = _num("Z_MAX", 2.0), KD_H4_MIN = _num("KD_H4_MIN", 5);
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

const dz = (x) => (Number.isFinite(x.zscoreH1S0) && Number.isFinite(x.zscoreH1) ? x.zscoreH1S0 - x.zscoreH1 : null);
const PAS_DOWN = (c) => c !== null && !String(c).includes("DOWN");
const CELL = (x, fc) => Number.isFinite(x.kH1) && x.kH1 > K_MIN
  && Number.isFinite(x.zscoreH1S0) && x.zscoreH1S0 < Z_MAX
  && Number.isFinite(x.kdGapH4) && x.kdGapH4 > KD_H4_MIN
  && Number.isFinite(dz(x)) && Number.isFinite(x.dRsiH1Live)
  && PAS_DOWN(rsiDeltaCol(x.dRsiH1Live)) && PAS_DOWN(fc(x));

const CLASS = { "contDzCol (±0,20)": (x) => contDzCol(dz(x)),
                "zDeltaCol (par niveau)": (x) => zDeltaCol(dz(x), zLevel(x.zscoreH1S0)) };

let rows = 0;
const RET = { "contDzCol (±0,20)": [], "zDeltaCol (par niveau)": [] };
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  const g = (p.ghosts ?? []).filter((c) => c.ghost === "all-rows");
  rows += g.length;
  for (const [nom, fc] of Object.entries(CLASS)) {
    // ⚠ ON NE `walk` QUE LES LIGNES RETENUES — simuler les 434 644 barres couterait sans rien apprendre.
    for (const c of g.filter((x) => CELL(x, fc))) {
      const r = p.walk({ ...c, side: "SELL" });
      if (r && typeof r.R === "number") RET[nom].push({ ...c, asset, side: "SELL", R: r.R, outcome: r.outcome });
    }
  }
}

const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => (v.n ? 100 * v.g / v.n : NaN);
const jour = (x) => `${x.asset}|${String(x.tsMT ?? "").slice(0, 10)}`;

console.log(`\n══ LA CELLULE SUR TOUTES LES LIGNES — aucun filtre moteur ══`);
console.log(`   %K H1 live > ${K_MIN} · dRSI \`drsi_h1_s0\` up/flat · dz = z_s0 − z_close up/flat · z H1 live < ${Z_MAX} · K−D H4 > ${KD_H4_MIN}`);
console.log(`   cote SELL IMPOSE · aucune capacite, aucun spacing, aucun veto, aucun seuil (MIN_EXH ${MIN_EXH} ignore)`);
console.log(`   lignes balayees : ${rows}`);

for (const [nom, arr] of Object.entries(RET)) {
  const v = agg(arr);
  const ep = dedupeEpisodes(arr.map((x) => ({ ...x })));
  const ve = agg(ep);
  const gr = new Map();
  for (const x of arr) { const k = jour(x); const o = gr.get(k) ?? { n: 0, w: 0 }; o.n++; if ((x.R ?? 0) > 0) o.w++; gr.set(k, o); }
  const wrGr = [...gr.values()].reduce((s, o) => s + o.w / o.n, 0) / Math.max(1, gr.size);
  console.log(`\n   ${"═".repeat(92)}`);
  console.log(`   ${nom}`);
  console.log(`      BRUT     ${String(v.n).padStart(5)} lignes  ${wr(v).toFixed(2).padStart(6)} %  ${v.R.toFixed(1).padStart(7)} R  ${(v.R / v.n).toFixed(4).padStart(8)} R/ligne  ${v.g}G/${v.n - v.g}P`);
  console.log(`      EPISODES ${String(ve.n).padStart(5)} ep.     ${wr(ve).toFixed(2).padStart(6)} %  ${ve.R.toFixed(1).padStart(7)} R  ${(ve.R / ve.n).toFixed(4).padStart(8)} R/ep.    ${ve.g}G/${ve.n - ve.g}P`);
  console.log(`      GRAPPES  ${String(gr.size).padStart(5)} actif|jour  WR/grappe ${(100 * wrGr).toFixed(2)} %`);
  // ⭐ CE QUE LE MOTEUR EN A FAIT — la seule facon de relier « toutes les lignes » aux « tirs ».
  const tire = arr.filter((x) => x.aTire), veto = arr.filter((x) => !x.aTire && (x.vetoed ?? []).length);
  const sousSeuil = arr.filter((x) => !x.aTire && !(x.vetoed ?? []).length && Number.isFinite(x.exhScore) && Math.abs(x.exhScore) < MIN_EXH);
  const muet = arr.filter((x) => !x.aTire && !(x.vetoed ?? []).length && (!Number.isFinite(x.exhScore) || x.exhScore === 0));
  const l = (lbl, a) => console.log(`      ${lbl.padEnd(30)}${String(a.length).padStart(5)} lignes  ${a.length ? wr(agg(a)).toFixed(2).padStart(6) : "     —"} %  ${a.length ? agg(a).R.toFixed(1).padStart(7) : "      —"} R`);
  console.log(`      ── ce que le moteur en a fait ──`);
  l("A TIRE (EXH)", tire);
  l("refuse par un VETO", veto);
  l("sous MIN_EXH", sousSeuil);
  l("score nul / absent", muet);
  l("n'a PAS tire (total)", arr.filter((x) => !x.aTire));
  const pires = [...gr.entries()].filter(([, o]) => o.n - o.w >= 2).sort((a, b) => (b[1].n - b[1].w) - (a[1].n - a[1].w)).slice(0, 10);
  console.log(`      pires grappes (≥2 pertes) : ${pires.map(([k, o]) => `${k} ${o.w}/${o.n}`).join(" · ") || "(aucune)"}`);
}
console.log("");
