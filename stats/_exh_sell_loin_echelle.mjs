// _exh_sell_loin_echelle.mjs — COMBIEN LA 3e BARRE APPORTE-T-ELLE VRAIMENT ?
// ============================================================================================
// 🎯 LE BLOCAGE (20/08) : le terme dicte « le prix est loin depuis ≥ 3 barres H1 » N'EST PAS
//   CALCULABLE dans le moteur. Une ligne du dataset donne EXACTEMENT DEUX points de z :
//        `zscore_h1_s0` = (close_h1_s0 − middle_h1)    / sigma_h1        ← barre LIVE
//        `zscore_h1`    = (close_h1_s1 − middle_h1_s1) / sigma_h1_s1     ← derniere H1 CLOTUREE
//   (verifie empiriquement sur 4 barres). Pour une 3e il faudrait `middle_h1_s2`/`sigma_h1_s2` —
//   ELLES N'EXISTENT PAS. `close_h1_s2` non plus (le CSV saute de `s1` a `s3`).
//
// ⇒ ON MESURE L'ECHELLE, pour chiffrer ce que coute le repli :
//     L1  |z cloture| ≥ s                                      1 lecture   · IMPLEMENTABLE
//     A   |z LIVE| ≥ s ET |z cloture| ≥ s                       2 lectures  · IMPLEMENTABLE ⭐
//     L2  les 2 dernieres HEURES consecutives (cloture h, h−1)  2 clotures  · backtest seulement
//     L3  les 3 dernieres HEURES consecutives                   3 clotures  · backtest seulement · DICTE
//
// ⚠ `A` n'est PAS `L2` : `A` melange une lecture INTRA-BARRE et une cloture ; `L2` compare deux
//   clotures. Les confondre ferait croire qu'on peut implementer `L2`. On les rend separement.
// ⚠ Le reste de la cellule est fige : %K H1 live > K_MIN · dRSI `drsi_h1_s0` up/flat · dz =
//   z_s0 − z_close up/flat (`contDzCol` ±0,20) · z H1 live < Z_MAX · K−D H4 > KD_H4_MIN.
//   ⚠⚠ `z live < Z_MAX` ET `|z live| ≥ s` se combinent : la bande live devient [s · Z_MAX[.
// ⚙ Usage : `node stats/_exh_sell_loin_echelle.mjs`  ·  `K_MIN=50 Z_MAX=2.0 KD_H4_MIN=5`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes } from "./_episodes.mjs";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring";
const { rsiDeltaCol } = await import(`${M}/experts/rsiExpert.js`);
const { contDzCol } = await import(`${M}/contScoringV1.js`);
const { MIN_EXH } = await import(`${M}/scoringDecision.js`);

const _num = (k, def) => { const r = process.env[k]; if (r === undefined || String(r).trim() === "") return def;
  const v = Number(r); return Number.isFinite(v) ? v : def; };
const K_MIN = _num("K_MIN", 50), Z_MAX = _num("Z_MAX", 2.0), KD_H4_MIN = _num("KD_H4_MIN", 5);
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const PLANCHERS = [["TENSE 1,55", 1.55], ["SLACK 1,05", 1.05]];

const dz = (x) => (Number.isFinite(x.zscoreH1S0) && Number.isFinite(x.zscoreH1) ? x.zscoreH1S0 - x.zscoreH1 : null);
const PAS_DOWN = (c) => c !== null && !String(c).includes("DOWN");
const CELL = (x) => Number.isFinite(x.kH1) && x.kH1 > K_MIN
  && Number.isFinite(x.zscoreH1S0) && x.zscoreH1S0 < Z_MAX
  && Number.isFinite(x.kdGapH4) && x.kdGapH4 > KD_H4_MIN
  && Number.isFinite(dz(x)) && Number.isFinite(x.dRsiH1Live)
  && PAS_DOWN(rsiDeltaCol(x.dRsiH1Live)) && PAS_DOWN(contDzCol(dz(x)));

const VARIANTES = ["(cellule seule)", "L1 · 1 cloture", "A · live + cloture", "L2 · 2 clotures", "L3 · 3 clotures"];
const RET = {};
for (const [pl] of PLANCHERS) { RET[pl] = {}; for (const v of VARIANTES) RET[pl][v] = []; }
let rows = 0;

for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  const g = (p.ghosts ?? []).filter((c) => c.ghost === "all-rows");
  rows += g.length;
  const parHeure = new Map();
  for (const x of g) { const h = Math.floor(x.ep / 60); if (!parHeure.has(h) && Number.isFinite(x.zscoreH1)) parHeure.set(h, x.zscoreH1); }
  // ⚠ HEURES CONSECUTIVES EXIGEES : le dataset ne couvre que 13,7 h/jour ⇒ sans ca, « 3 barres »
  //   enjamberait une nuit. Un trou rend `null` = INDECIDABLE, jamais « non ».
  const loinN = (x, s, n) => {
    const h = Math.floor(x.ep / 60);
    for (let k = 0; k < n; k++) { const v = parHeure.get(h - k); if (!Number.isFinite(v)) return null; if (Math.abs(v) < s) return false; }
    return true;
  };
  for (const x of g.filter(CELL)) {
    const r = p.walk({ ...x, side: "SELL" });
    if (!r || typeof r.R !== "number") continue;
    const t = { ...x, asset, side: "SELL", R: r.R, outcome: r.outcome };
    for (const [pl, s] of PLANCHERS) {
      RET[pl]["(cellule seule)"].push(t);
      if (Math.abs(x.zscoreH1) >= s) RET[pl]["L1 · 1 cloture"].push(t);
      if (Math.abs(x.zscoreH1) >= s && Math.abs(x.zscoreH1S0) >= s) RET[pl]["A · live + cloture"].push(t);
      if (loinN(x, s, 2) === true) RET[pl]["L2 · 2 clotures"].push(t);
      if (loinN(x, s, 3) === true) RET[pl]["L3 · 3 clotures"].push(t);
    }
  }
}

const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => (v.n ? 100 * v.g / v.n : NaN);
const jour = (x) => `${x.asset}|${String(x.tsMT ?? "").slice(0, 10)}`;
console.log(`\n══ CE QUE CHAQUE LECTURE DE « LOIN » APPORTE ══`);
console.log(`   cellule : %K H1 live > ${K_MIN} · dRSI \`drsi_h1_s0\` up/flat · dz up/flat (contDzCol ±0,20) · z H1 live < ${Z_MAX} · K−D H4 > ${KD_H4_MIN}`);
console.log(`   SELL impose · toutes les lignes (${rows}) · aucun veto · MIN_EXH ${MIN_EXH} ignore · point mort 75,00 %`);
console.log(`   ⚠ L1 et A sont IMPLEMENTABLES dans le moteur · L2 et L3 ne le sont PAS (il manque middle_h1_s2 / sigma_h1_s2)`);

for (const [pl] of PLANCHERS) {
  console.log(`\n   ${"═".repeat(104)}`);
  console.log(`   PLANCHER ${pl}`);
  console.log(`   ${"variante".padEnd(22)}${"lignes".padStart(7)}${"WR".padStart(9)}${"R".padStart(9)}${"R/ligne".padStart(9)}   ${"episodes".padStart(22)}${"grappes".padStart(16)}`);
  for (const v of VARIANTES) {
    const a = RET[pl][v];
    if (!a.length) { console.log(`   ${v.padEnd(22)}      0`); continue; }
    const s = agg(a), e = agg(dedupeEpisodes(a.map((x) => ({ ...x }))));
    const gr = new Map();
    for (const x of a) { const k = jour(x); const o = gr.get(k) ?? { n: 0, w: 0 }; o.n++; if ((x.R ?? 0) > 0) o.w++; gr.set(k, o); }
    const wg = 100 * [...gr.values()].reduce((t, o) => t + o.w / o.n, 0) / gr.size;
    console.log(`   ${v.padEnd(22)}${String(s.n).padStart(7)}${wr(s).toFixed(2).padStart(8)} %${s.R.toFixed(1).padStart(9)}${(s.R / s.n).toFixed(4).padStart(9)}   ${`${e.n} ep · ${wr(e).toFixed(2)} % · ${e.R.toFixed(1)} R`.padStart(22)}${`${gr.size} gr · ${wg.toFixed(2)} %`.padStart(16)}`);
    // ⭐⭐⭐ CES LIGNES SONT **AVANT** LE SCORING (population `ghostAllRows`, cote SELL IMPOSE par la
    //   sonde). Elles melangent donc TROIS choses que rien ne distingue dans le WR global :
    //   ce que le moteur a REELLEMENT tire · ce qu'un VETO a bloque · ce sur quoi le bareme n'a AUCUN
    //   avis (`exh = 0`) et qu'il n'aurait donc jamais pris. Sans cette ventilation, on lit un WR qui
    //   decrit surtout des barres que le moteur ne prendrait JAMAIS.
    const tire = a.filter((x) => x.aTire);
    const veto = a.filter((x) => !x.aTire && (x.vetoed ?? []).length);
    const sous = a.filter((x) => !x.aTire && !(x.vetoed ?? []).length && Number.isFinite(x.exhScore) && x.exhScore !== 0 && Math.abs(x.exhScore) < MIN_EXH);
    const nul  = a.filter((x) => !x.aTire && !(x.vetoed ?? []).length && (!Number.isFinite(x.exhScore) || x.exhScore === 0));
    const c = (lbl, b) => `${lbl} ${String(b.length).padStart(4)} (${(100 * b.length / a.length).toFixed(1).padStart(4)} %) ${b.length ? wr(agg(b)).toFixed(2).padStart(6) : "     —"} % ${b.length ? agg(b).R.toFixed(1).padStart(7) : "      —"} R`;
    console.log(`      └─ ${c("A TIRE", tire)}  ·  ${c("VETO", veto)}`);
    console.log(`         ${c("sous seuil", sous)}  ·  ${c("score nul", nul)}`);
  }
  // ⭐ CE QUE COUTE LE REPLI : A contre L3, en points de WR et en R/ligne.
  const A = agg(RET[pl]["A · live + cloture"]), L2 = agg(RET[pl]["L2 · 2 clotures"]), L3 = agg(RET[pl]["L3 · 3 clotures"]);
  if (A.n && L3.n) console.log(`   ⇒ le repli A vs L3 : ${(wr(A) - wr(L3) >= 0 ? "+" : "") + (wr(A) - wr(L3)).toFixed(2)} pt de WR · ${A.n - L3.n >= 0 ? "+" : ""}${A.n - L3.n} lignes · R/ligne ${(A.R / A.n).toFixed(4)} contre ${(L3.R / L3.n).toFixed(4)}`);
  if (L2.n && L3.n) console.log(`   ⇒ la 3e cloture (L2→L3) : ${(wr(L3) - wr(L2) >= 0 ? "+" : "") + (wr(L3) - wr(L2)).toFixed(2)} pt de WR · ${L3.n - L2.n} lignes`);
}
console.log("");
