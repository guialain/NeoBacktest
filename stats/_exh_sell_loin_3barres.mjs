// _exh_sell_loin_3barres.mjs — LA CELLULE + « LE PRIX EST LOIN DEPUIS ≥ 3 BARRES H1 » (owner 20/08).
// ============================================================================================
// 🎯 CE QUE L'OWNER A NOMME, ET QUE JE NE POUVAIS PAS DEVINER : ce n'est pas un NIVEAU de z, c'est
//   une DUREE. « Le prix reste loin de la moyenne » = il l'est DEPUIS AU MOINS 3 BARRES H1.
//   ⇒ Une figure qui exige une PERSISTANCE est rare par construction — c'est exactement ce qui
//     manquait aux versions precedentes, qui tiraient sur 11 % de toutes les barres.
//
// 🔴 LE CSV N'A PAS `zscore_h1_s1/s2/s3`. Mais `zscore_h1` EST le z de la derniere H1 CLOTUREE :
//   il est constant a l'interieur d'une heure et change a chaque cloture. On reconstruit donc
//   l'historique en groupant les lignes par HEURE (`floor(ep/60)`), par actif.
// ⚠⚠ LE DATASET A DES TROUS (13,7 h/jour, week-ends). On EXIGE que les 3 heures soient
//   CONSECUTIVES dans les donnees — sinon « 3 barres » enjamberait une nuit ou un week-end et ne
//   voudrait plus rien dire. Les lignes sans historique complet sont COMPTEES A PART, jamais
//   rangees dans « le prix n'est pas loin ».
// ⚠ « LOIN » N'EST PAS UN NOMBRE QUE J'INVENTE : on prend les bandes du moteur
//   (`Z_LEVEL_BANDS = [0,30 · 1,05 · 1,55 · 2,15 · 2,60]`) et on rend les DEUX planchers naturels,
//   `TENSE` (≥ 1,55) et `SLACK` (≥ 1,05).
// ⚙ Usage : `node stats/_exh_sell_loin_3barres.mjs`  ·  `NBARRES=3 K_MIN=50 Z_MAX=2.0 KD_H4_MIN=5`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes } from "./_episodes.mjs";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring";
const { rsiDeltaCol } = await import(`${M}/experts/rsiExpert.js`);
const { zDeltaCol, zLevel, Z_LEVEL_BANDS } = await import(`${M}/experts/zscoreExpert.js`);
const { contDzCol } = await import(`${M}/contScoringV1.js`);
const { MIN_EXH } = await import(`${M}/scoringDecision.js`);

const _num = (k, def) => { const r = process.env[k]; if (r === undefined || String(r).trim() === "") return def;
  const v = Number(r); return Number.isFinite(v) ? v : def; };
const K_MIN = _num("K_MIN", 50), Z_MAX = _num("Z_MAX", 2.0), KD_H4_MIN = _num("KD_H4_MIN", 5);
const NB = _num("NBARRES", 3);
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const PLANCHERS = [["TENSE  (z ≥ 1,55)", 1.55], ["SLACK  (z ≥ 1,05)", 1.05]];

const dz = (x) => (Number.isFinite(x.zscoreH1S0) && Number.isFinite(x.zscoreH1) ? x.zscoreH1S0 - x.zscoreH1 : null);
const PAS_DOWN = (c) => c !== null && !String(c).includes("DOWN");
const CLASS = { "contDzCol (±0,20)": (x) => contDzCol(dz(x)),
                "zDeltaCol (par niveau)": (x) => zDeltaCol(dz(x), zLevel(x.zscoreH1S0)) };
const CELL = (x, fc) => Number.isFinite(x.kH1) && x.kH1 > K_MIN
  && Number.isFinite(x.zscoreH1S0) && x.zscoreH1S0 < Z_MAX
  && Number.isFinite(x.kdGapH4) && x.kdGapH4 > KD_H4_MIN
  && Number.isFinite(dz(x)) && Number.isFinite(x.dRsiH1Live)
  && PAS_DOWN(rsiDeltaCol(x.dRsiH1Live)) && PAS_DOWN(fc(x));

let rows = 0, sansHisto = 0;
const RET = {};
for (const nc of Object.keys(CLASS)) { RET[nc] = { base: [], loin: {} }; for (const [pl] of PLANCHERS) RET[nc].loin[pl] = []; }

for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  const g = (p.ghosts ?? []).filter((c) => c.ghost === "all-rows");
  rows += g.length;
  // ── L'HISTORIQUE H1 : une valeur de `zscore_h1` par HEURE. ───────────────────────────────────
  // ⚠ On garde la PREMIERE valeur vue dans l'heure : toutes les lignes d'une meme heure portent le
  //   meme `zscore_h1` (c'est la derniere H1 CLOTUREE), donc n'importe laquelle ferait — mais fixer
  //   la regle evite qu'un jour un capteur intra-heure la fasse varier en silence.
  const parHeure = new Map();
  for (const x of g) {
    const h = Math.floor(x.ep / 60);
    if (!parHeure.has(h) && Number.isFinite(x.zscoreH1)) parHeure.set(h, x.zscoreH1);
  }
  // `loinDepuis(x, seuil)` — les NB dernieres heures CONSECUTIVES ont toutes `|z closed| ≥ seuil`.
  const loinDepuis = (x, seuil) => {
    const h = Math.floor(x.ep / 60);
    for (let k = 0; k < NB; k++) {
      const v = parHeure.get(h - k);
      if (!Number.isFinite(v)) return null;          // trou ⇒ INDECIDABLE, pas « non »
      if (Math.abs(v) < seuil) return false;
    }
    return true;
  };
  for (const [nc, fc] of Object.entries(CLASS)) {
    for (const x of g.filter((y) => CELL(y, fc))) {
      const r = p.walk({ ...x, side: "SELL" });
      if (!r || typeof r.R !== "number") continue;
      const t = { ...x, asset, side: "SELL", R: r.R, outcome: r.outcome };
      RET[nc].base.push(t);
      for (const [pl, seuil] of PLANCHERS) {
        const v = loinDepuis(x, seuil);
        if (v === null) { if (nc === "contDzCol (±0,20)" && pl === PLANCHERS[0][0]) sansHisto++; continue; }
        if (v) RET[nc].loin[pl].push(t);
      }
    }
  }
}

const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => (v.n ? 100 * v.g / v.n : NaN);
const jour = (x) => `${x.asset}|${String(x.tsMT ?? "").slice(0, 10)}`;
const bloc = (lbl, a) => {
  if (!a.length) { console.log(`      ${lbl.padEnd(26)}   — (vide)`); return; }
  const v = agg(a), ep = agg(dedupeEpisodes(a.map((x) => ({ ...x }))));
  const gr = new Map();
  for (const x of a) { const k = jour(x); const o = gr.get(k) ?? { n: 0, w: 0 }; o.n++; if ((x.R ?? 0) > 0) o.w++; gr.set(k, o); }
  const wrGr = 100 * [...gr.values()].reduce((s, o) => s + o.w / o.n, 0) / gr.size;
  console.log(`      ${lbl.padEnd(26)}${String(v.n).padStart(6)} lignes ${wr(v).toFixed(2).padStart(6)} %  ${v.R.toFixed(1).padStart(7)} R   |   ` +
    `${String(ep.n).padStart(4)} ep. ${wr(ep).toFixed(2).padStart(6)} %  ${ep.R.toFixed(1).padStart(6)} R   |   ${String(gr.size).padStart(3)} gr. ${wrGr.toFixed(2).padStart(6)} %`);
  const pires = [...gr.entries()].filter(([, o]) => o.n - o.w >= 2).sort((a2, b2) => (b2[1].n - b2[1].w) - (a2[1].n - a2[1].w)).slice(0, 6);
  if (pires.length) console.log(`         pires grappes : ${pires.map(([k, o]) => `${k} ${o.w}/${o.n}`).join(" · ")}`);
  // ⭐⭐⭐ CE QUE LE MOTEUR FAIT DEJA DE CES LIGNES (owner, 20/08). Sans cette ventilation on ne peut
  //   pas savoir si une regle NEUVE apporterait quoi que ce soit : une zone deja bloquee a 95 % par
  //   les vetos existants n'a plus de marge, quel que soit son WR brut.
  // ⚠ « bloque » = `vetoed` NON VIDE sur la barre. Une barre peut etre a la fois vetoee ET sans
  //   score — on classe dans l'ordre : A TIRE > VETO > sous MIN_EXH > score nul/absent.
  const tire = a.filter((x) => x.aTire);
  const veto = a.filter((x) => !x.aTire && (x.vetoed ?? []).length);
  const sous = a.filter((x) => !x.aTire && !(x.vetoed ?? []).length && Number.isFinite(x.exhScore) && x.exhScore !== 0 && Math.abs(x.exhScore) < MIN_EXH);
  const nul  = a.filter((x) => !x.aTire && !(x.vetoed ?? []).length && (!Number.isFinite(x.exhScore) || x.exhScore === 0));
  const pc = (b) => `${String(b.length).padStart(5)} (${(100 * b.length / a.length).toFixed(1).padStart(4)} %)`;
  const wrr = (b) => (b.length ? `${wr(agg(b)).toFixed(2).padStart(6)} % ${agg(b).R.toFixed(1).padStart(7)} R` : `     — %       — R`);
  console.log(`         ce que le moteur en fait :  A TIRE ${pc(tire)} ${wrr(tire)}  ·  VETO ${pc(veto)} ${wrr(veto)}`);
  console.log(`                                    sous MIN_EXH ${pc(sous)} ${wrr(sous)}  ·  score nul ${pc(nul)} ${wrr(nul)}`);
  const ids = new Map();
  for (const x of veto) for (const v of (x.vetoed ?? [])) ids.set(v, (ids.get(v) ?? 0) + 1);
  // ⭐ VENTILATION PAR IDENTIFIANT + LE WR DE CE QUE CHACUN BLOQUE. Le compte seul ne dit pas si un
  //   veto attrape la mauvaise partie de la zone ou s'il coupe au hasard dedans.
  if (ids.size) {
    console.log(`         vetos qui bloquent (${ids.size} distincts, une ligne peut en toucher plusieurs) :`);
    for (const [id, n] of [...ids.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12)) {
      const sub = veto.filter((x) => (x.vetoed ?? []).includes(id));
      console.log(`            ${String(id).padEnd(34)}${String(n).padStart(5)} lignes (${(100 * n / a.length).toFixed(1).padStart(4)} % de la case)  ${wr(agg(sub)).toFixed(2).padStart(6)} %  ${agg(sub).R.toFixed(1).padStart(7)} R`);
    }
  }
};

console.log(`\n══ CELLULE + « LE PRIX EST LOIN DEPUIS ≥ ${NB} BARRES H1 » — TOUTES LES LIGNES ══`);
console.log(`   %K H1 live > ${K_MIN} · dRSI \`drsi_h1_s0\` up/flat · dz = z_s0 − z_close up/flat · z H1 live < ${Z_MAX} · K−D H4 > ${KD_H4_MIN}`);
console.log(`   « loin » = |z H1 CLOTURE| ≥ plancher sur les ${NB} dernieres heures CONSECUTIVES · bandes moteur ${JSON.stringify(Z_LEVEL_BANDS)}`);
console.log(`   cote SELL impose · aucun veto, aucune capacite, MIN_EXH ${MIN_EXH} ignore · ${rows} lignes balayees`);
console.log(`   ⚠ ${sansHisto} lignes de la cellule n'ont pas ${NB} heures consecutives d'historique — EXCLUES, pas comptees « pas loin »`);
console.log(`   ⚠ point mort 75,00 %`);

for (const [nc, o] of Object.entries(RET)) {
  console.log(`\n   ${"═".repeat(108)}`);
  console.log(`   ${nc}`);
  console.log(`      ${"".padEnd(26)}${"BRUT".padStart(21)}${"".padEnd(12)}${"EPISODES".padStart(14)}${"".padEnd(12)}${"GRAPPES".padStart(12)}`);
  bloc("sans la duree", o.base);
  for (const [pl] of PLANCHERS) bloc(`+ loin ≥${NB}h · ${pl}`, o.loin[pl]);
}
console.log("");
