// _pb_cellules.mjs — LA NOTE DU BAREME EN FACE DU WR MESURE, cellule par cellule.
// ⚠ Population ENTIERE de la boite (aucun seuil) : au-dessus d'un seuil les termes sont
//   anti-correles et une case parait bonne parce qu'une autre l'a compensee.
// ⚠ Une voix par grappe. Les cases sous 40 grappes sont marquees — sur peu d'episodes, decouper
//   fin FABRIQUE des sigma.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1"; process.env.PB_ISOLE = "1"; process.env.MIN_PB = "-31";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
const { pbScoreV1, PB_GAP_GRID, PB_GAP_ROWS, PB_K_GRID, PB_DZ_COLS, PB_FAM_COLS } = await import(M + "pbScoringV1.js");
// 🔄 11/08 SOIR — l'entree ⑴ est passee de `z` a `gapAtr`. ⚠ La sonde ne RECALCULE PAS le triplet :
//   elle appelle `computeDeviation`/`gapInstalled`/`gapDeltaCol` aux memes domiciles que le moteur.
//   Recopier la derivation ici en ferait une TROISIEME, et c'est exactement la faute que le depot
//   documente (`derived_dataset_computed_3x`).
const C = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/";
const { computeDeviation, gapInstalled, gapDeltaCol } = await import(C + "DeviationConfig.js");
// ⚠ 11/08 — `readTfs` a déménagé de `vetoGate` vers `scoringInputs` (l'ancien nom `readVetoTfs`
//   décrivait UN consommateur ; les BARÈMES en sont devenus le principal). La sonde pointait encore
//   l'ancien domicile et levait `readTfs is not a function` à la première barre.
const { readTfs } = await import(M + "scoringInputs.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const tirs = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const actif = path.basename(f, ".csv"), CSV = path.join(DIR, f);
  const L = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/), head = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"), o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = c[i]; rows.set(o.timestamp, o); }
  for (const s of (runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals ?? [])) {
    if (s.strategy !== "PB" || (s.outcome !== "WIN" && s.outcome !== "LOSS")) continue;
    const row = rows.get(s.tsMT); if (!row) continue;
    const v = readTfs(row);
    // ⚠ CLOTURE pour le niveau ET l'installation, LIVE pour la vitesse — la convention du rang ②.
    //   Lire `level`/`gapAtr` (live) a la place donnerait une autre ligne de bareme, en silence.
    const d = computeDeviation(row, actif, "h1"), lvl = d?.levelClose ?? null;
    const r = pbScoreV1({
      gapLevelH1Closed: lvl,
      gapInstalledH1Closed: gapInstalled(lvl, d?.gapAtrClose, d?.meanSlope),
      gapColH1Live: (lvl && Number.isFinite(d?.gapSlope)) ? gapDeltaCol(d.gapSlope, lvl, actif) : null,
      kH1Closed: v.h1?.kClosed ?? null, dKBandH1Live: v.h1?.dKBand ?? null,
      diGapBandH1Live: v.h1?.gapBand ?? null, highD1Live: num(row.high_d1_s0),
      lowD1Live: num(row.low_d1_s0), prixLive: num(row.price), side: s.side });
    tirs.push({ ...s, actif, p: r.parts });
  }
}
const jour = (s) => String(s.tsMT).slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const R = t.reduce((a, b) => a + (b.R || 0), 0), g = new Map();
  for (const x of t) { const k = x.actif + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length, R }; };
const box = (t, note) => { const s = st(t);
  if (!s) return "     ·      ";
  const flag = s.gr < 40 ? "~" : " ";
  return `${String(note).padStart(3)}${flag}${s.wrg.toFixed(0).padStart(3)}%${(s.R >= 0 ? "+" : "") + s.R.toFixed(0).padStart(5)}`; };

console.log(`\n═══ PB · LA NOTE EN FACE DU WR ═══  ${tirs.length} tirs · point mort 75 % · ~ = moins de 40 grappes`);
console.log("\n  ── ⑴ gapAtr : ligne (installation × tension, CLOTURE) × colonne (vitesse, LIVE) ──   [note | WR/grappe | R]");
// ⚠ ON GROUPE PAR `ligneGap`, LA TRACE QUE LE MOTEUR A ECRITE — jamais par une ligne recomposee ici.
//   La ligne depend du COTE (`BEHIND` pour un BUY n'est pas la meme installation que pour un SELL) :
//   la recomposer dans la sonde ferait diverger l'affichage du bareme sans que rien ne le dise.
// ⚠ Les notes affichees viennent de `PB_GAP_GRID` (repere BUY). Cote SELL la COLONNE est miroitee
//   avant lecture — donc la note en tete de case vaut pour la ligne, pas terme a terme pour un SELL.
const cz = ["EXPLOSIVE_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "EXPLOSIVE_UP"];
console.log("  ligne gap             " + cz.map((c) => c.replace("EXPLOSIVE", "EXPL").replace("_DOWN", "-DN").replace("_UP", "-UP").padStart(13)).join(""));
for (const ligne of PB_GAP_ROWS) {
  const cells = PB_GAP_GRID[ligne];
  const sel = tirs.filter((x) => x.p.ligneGap === ligne);
  console.log("  " + ligne.padEnd(20) + cz.map((c) => box(sel.filter((x) => x.p.colGap === c), cells[c])).join(""));
}
{ // ⭐ LE MUTISME EST UNE MESURE, PAS UN DETAIL : une entree muette AMPLIFIE l'autre.
  const muet = tirs.filter((x) => x.p.gap == null).length;
  console.log(`  ⑴ MUETTE sur ${(100 * muet / (tirs.length || 1)).toFixed(1)} % des tirs (${muet}/${tirs.length})`);
}
console.log("\n  ── ⑵ %K : ligne (clôture, orientée) × colonne ──");
console.log("  ligne kOr    " + PB_FAM_COLS.map((c) => c.padStart(13)).join(""));
for (const [lo, hi, cells] of PB_K_GRID) {
  const sel = tirs.filter((x) => x.p.kOr != null && x.p.kOr >= lo && x.p.kOr < hi);
  console.log("  [" + String(lo).padStart(3) + " " + String(hi).padStart(3) + "]     "
    + PB_FAM_COLS.map((c) => box(sel.filter((x) => x.p.colK === c), cells[c])).join(""));
}
