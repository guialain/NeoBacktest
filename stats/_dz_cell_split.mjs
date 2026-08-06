// _dz_cell_split.mjs — LE PONT VERS LE P&L : chaque case de fade, coupée par le SIGNE du prix.
//
// Établi précédemment (`_dz_vs_prix`) : l'axe Δz ne mesure pas ce que ses colonnes annoncent.
// `SOFT_DOWN` à haute tension contient 37 % de barres où le PRIX MONTE contre le fade, et
// `FLAT` en contient 100 % à EXTREME/SNAPPED. Mais c'était du CONTEMPORAIN : une case peut être
// mal nommée et bien prédire.
//
// Ici on tranche : dans chaque case, les trades dont le prix allait DANS le sens du fade
// rendent-ils autre chose que ceux dont il allait CONTRE ? Si les deux sous-populations ont la
// même marge, la contamination est cosmétique. Si elles divergent, la case doit être SCINDÉE.
//
// ⭐ dP orienté = −signe(zClosed) × (entrée − close_h1_s1) / atr, MÊME fenêtre que le Δz.
// ⚠ Marge = WR − 75 (tables TP/SL toutes à 1:3). Effectif lu = ÉPISODES (4 h, même actif) et
//   JOURNÉES ; aucune case sous 20 épisodes n'est lue.
// ⚠ CONTRÔLE inclus : le champ `zscoreH1` du signal doit être la CLÔTURE (≡ colonne `zscore_h1`
//   de la matrice). Si ce n'est pas le cas, tout ce tableau porte sur le mauvais instant.
import fs from "fs";
import path from "path";
import { zLevel, zDeltaCol, Z_DELTA_COLS } from "../../Matrix-Revolution/src/components/robot/engines/scoring/experts/zscoreExpert.js";
import { GAP_EXH_TABLE } from "../../Matrix-Revolution/src/components/robot/engines/scoring/exhaustionScorer.js";

const API = "http://localhost:3001/api/matrix";
const DIR = "data/matrix";
const GAP = 240, BE = 75;

const assets = await (await fetch(`${API}/assets`)).json();
const all = [];
let ctrlOk = 0, ctrlKo = 0;
for (const a of assets) {
  // close_h1_s1 (départ de la fenêtre) et zscore_h1 (contrôle) depuis la matrice, indexés par ep
  const L = fs.readFileSync(path.join(DIR, `${a}.csv`), "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const ref = new Map();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const ep = Math.round(Date.parse(c[I.ts_utc]) / 60000); if (!Number.isFinite(ep)) continue;
    ref.set(ep, { p0: Number(c[I.close_h1_s1]), zc: Number(c[I.zscore_h1]), z0: Number(c[I.zscore_h1_s0]) });
  }
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || []).filter((s) => typeof s.R === "number").map((s) => {
    const ep = s.openEp ?? s.ep, r = ref.get(ep);
    // ⭐ On lit la MATRICE, pas le signal : `matrixBacktest` expose bien la clôture mais ARRONDIE à
    //   2 décimales (`r2`), ce qui déplacerait des barres de colonne près des coupures.
    const zC = r?.zc, z0 = r?.z0;
    // Contrôle : le champ du signal doit être la clôture, à l'arrondi près (tolérance 0,006).
    if (r && Number.isFinite(r.zc) && Number.isFinite(s.zscoreH1))
      (Math.abs(r.zc - s.zscoreH1) < 0.006 ? ctrlOk++ : ctrlKo++);
    let level = null, col = null, dP = null;
    if (Number.isFinite(zC) && Number.isFinite(z0) && zC !== 0 && r && Number.isFinite(r.p0) && s.atr > 0) {
      level = zLevel(zC);
      col = zDeltaCol((z0 - zC) * Math.sign(zC), level);
      dP = -Math.sign(zC) * (s.entry - r.p0) / s.atr;
    }
    return { R: s.R, out: s.outcome, asset: a, exh: s.type === "EXHAUSTION", ep,
             d: new Date(ep * 60000).toISOString().slice(0, 10), level, col, dP };
  }).sort((x, y) => x.ep - y.ep);
  let epi = 0, prev = -Infinity;
  for (const t of mine) { if (t.ep - prev > GAP) epi++; prev = t.ep; t.epi = `${a}|${epi}`; }
  all.push(...mine);
}
console.log(`Contrôle « zscoreH1 = clôture » : ${ctrlOk} concordants · ${ctrlKo} discordants`
  + (ctrlKo > ctrlOk * 0.01 ? "  🔴 LE CHAMP N'EST PAS LA CLÔTURE — table invalide" : "  ✅"));

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length, l = s.filter((x) => x.out === "LOSS").length;
  return { n: s.length, ep: new Set(s.map((x) => x.epi)).size, j: new Set(s.map((x) => x.d)).size,
           m: (w + l) ? w / (w + l) * 100 - BE : null };
};
const cell = (t) => t.n === 0 ? "        —       "
  : `${String(t.j).padStart(2)}j ${String(t.ep).padStart(3)}ép ${String(t.n).padStart(4)}tr ${((t.m >= 0 ? "+" : "") + t.m.toFixed(2)).padStart(6)}${t.ep < 20 ? "⚠" : " "}`;

const EXH = all.filter((x) => x.exh && x.level && x.col && x.dP != null);
const CONT = all.filter((x) => !x.exh && x.level && x.col && x.dP != null);
console.log(`\ncohorte : ${EXH.length} EXH · ${CONT.length} CONT avec case et prix`);

for (const [titre, U] of [["EXH — la thèse qui FADE", EXH], ["CONT — pour comparaison", CONT]]) {
  console.log(`\n${"=".repeat(104)}\n=== ${titre} · marge par case, coupée par le SENS DU PRIX pendant la fenêtre du Δz\n${"=".repeat(104)}`);
  console.log(`${"case".padEnd(24)}${"table".padStart(6)}   ${"prix AVEC le fade".padStart(17)}      ${"prix CONTRE".padStart(17)}      écart`);
  for (const lv of ["SLACK", "TENSE", "TENSE_HIGH", "EXTREME", "SNAPPED"]) {
    for (const co of Z_DELTA_COLS) {
      const g = U.filter((x) => x.level === lv && x.col === co);
      if (g.length < 30) continue;
      const av = stat(g.filter((x) => x.dP > 0)), ct = stat(g.filter((x) => x.dP <= 0));
      const sc = GAP_EXH_TABLE[lv]?.[co];
      const ec = (av.m != null && ct.m != null) ? ((av.m - ct.m >= 0 ? "+" : "") + (av.m - ct.m).toFixed(2)) : "—";
      console.log(`${(lv + " · " + co.replace("EXPLOSIVE", "EXPL")).padEnd(24)}${String(sc ?? "—").padStart(6)}   `
        + `${cell(av)}      ${cell(ct)}   ${ec.padStart(8)}`);
    }
  }
}

// Vue d'ensemble : et si on ne regardait QUE le signe du prix, toutes cases confondues ?
console.log(`\n=== TOUTES CASES CONFONDUES — le signe du prix suffit-il à lui seul ? ===`);
for (const [t, U] of [["EXH", EXH], ["CONT", CONT]]) {
  console.log(`${t.padEnd(6)} prix AVEC ${cell(stat(U.filter((x) => x.dP > 0)))}   `
    + `prix CONTRE ${cell(stat(U.filter((x) => x.dP <= 0)))}`);
}
