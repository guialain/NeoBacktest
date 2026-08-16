// _cont_redondance_stoch4.mjs — LES QUATRE LECTEURS DU STOCHASTIQUE AU RANG ③ SE RECOUVRENT-ILS ?
//
// 🎯 PREREQUIS NOMME : depuis la refonte du 16/08 le rang ③ lit la dynamique stochastique par
//   QUATRE chemins, et aucun n'a ete teste contre les autres :
//        `kH4` (note de base)  %K H4 x ΔK H4        ⟵ la NOTE
//        `facteur kH1`         %K H1 x K−D H1       ⟵ le MULTIPLICATEUR
//        `gapKd`               prix H1 x K−D H1     ⟵ meme K−D que le facteur
//        `gapKdH4`             prix H1 x K−D H4     ⟵ meme horloge que la note
//   ⇒ Le `K−D` H1 est lu DEUX FOIS ; et sur H4, `ΔK` (note) et `K−D` (gapKdH4) sont deux
//   dynamiques du MEME stochastique. Le depot a deja le chiffre generique : `kdCycleState` contre
//   `ΔK` = **0,342** de Cramer. Ici on mesure les notes REELLES, sur le residu.
//
// ⭐⭐ LA METRIQUE EST LE **V DE CRAMER** — celle que le depot emploie deja pour ce genre de
//   question. `0` = independants, `1` = l'un determine l'autre. On imprime aussi le `r` de Pearson
//   (les notes sont ORDINALES, donc un lien LINEAIRE se lit) : les deux ensemble separent
//   « meme information » de « meme direction ».
// ⚠⚠ UNE NOTE QUASI CONSTANTE NE PEUT PAS ETRE REDONDANTE DE FACON UTILE — sa variance est nulle,
//   donc son V est bas quoi qu'il arrive. La distribution de chaque note est imprimee AVANT les
//   couples, pour que le lecteur ne prenne pas un `V` bas pour une independance quand c'est une
//   ABSENCE DE VARIANCE.
// ⚠ PAR COTE. Lignes MORTES exclues. Residu `rangCont` seul.
//   usage : node stats/_cont_redondance_stoch4.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines";
const { contNoteKh4, contFacteurKh1, contNoteGapKd } = await import(`${R}/scoring/contScoringV1.js`);
const { computeDeviation } = await import(`${R}/config/DeviationConfig.js`);
const { deltaKBand } = await import(`${R}/opportunities/OpportunityDetector.js`);
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const MORT = 5;
const CH = ["symbol", "price", "zscore_h1_s0", "sigma_h1",
            "stoch_k_h1_s0", "stoch_d_h1_s0",
            "stoch_k_h4_s0", "stoch_d_h4_s0", "stoch_k_h4_s1"];
const CLES = ["kH4", "facH1", "gapKd", "gapKdH4"];
const S = {};
for (const c of ["BUY", "SELL"]) S[c] = { n: 0, v: { kH4: [], facH1: [], gapKd: [], gapKdH4: [] } };
let nGele = 0;

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f);
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const iTs = head.indexOf("timestamp");
  const ix = {}; for (const n of CH) ix[n] = head.indexOf(n);
  const manq = CH.filter((n) => ix[n] < 0); if (manq.length) throw new Error(`${f} : ${manq.join(", ")}`);
  const rows = new Map(), nParTs = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[iTs], c);
    nParTs.set(c[iTs], (nParTs.get(c[iTs]) ?? 0) + 1); }
  const gele = new Set([...nParTs].filter(([, n]) => n >= MORT).map(([t]) => t));

  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes" || !x.rangCont) continue;
    if (gele.has(x.tsMT)) { nGele++; continue; }
    const s = S[x.side]; if (!s) continue;
    const c = rows.get(x.tsMT); if (!c) continue;
    const row = {}; for (const n of CH) row[n] = c[ix[n]];
    const num = (k) => { const v = row[k]; return v === "" || v == null ? null : Number(v); };
    const d = computeDeviation(row, String(row.symbol || ""), "h1");
    const gapAtr = Number.isFinite(d?.gapAtr) ? d.gapAtr : null, lvl = d?.level ?? null;
    const k4 = num("stoch_k_h4_s0"), k4p = num("stoch_k_h4_s1"), d4 = num("stoch_d_h4_s0");
    const k1 = num("stoch_k_h1_s0"), d1 = num("stoch_d_h1_s0");
    const dk4 = (k4 == null || k4p == null) ? null : deltaKBand(k4 - k4p);
    const v = {
      kH4:     contNoteKh4(k4, dk4, x.side),
      facH1:   contFacteurKh1(k1, (k1 == null || d1 == null) ? null : k1 - d1, x.side),
      gapKd:   contNoteGapKd(gapAtr, lvl, (k1 == null || d1 == null) ? null : k1 - d1, x.side),
      gapKdH4: contNoteGapKd(gapAtr, lvl, (k4 == null || d4 == null) ? null : k4 - d4, x.side),
    };
    // ⚠ ON N'ANALYSE QUE LES BARRES OU LES QUATRE PARLENT — sinon le `V` melangerait « valeurs
    //   liees » et « muets qui coincident », deux faits differents sous un meme chiffre.
    if (!CLES.every((k) => Number.isFinite(v[k]))) continue;
    s.n++;
    for (const k of CLES) s.v[k].push(v[k]);
  }
  rows.clear();
}

// ── V de Cramer + r de Pearson ──
const cramer = (a, b) => {
  const A = [...new Set(a)].sort((x, y) => x - y), B = [...new Set(b)].sort((x, y) => x - y);
  if (A.length < 2 || B.length < 2) return NaN;
  const ia = new Map(A.map((v, i) => [v, i])), ib = new Map(B.map((v, i) => [v, i]));
  const O = A.map(() => B.map(() => 0)), rt = A.map(() => 0), ct = B.map(() => 0);
  for (let i = 0; i < a.length; i++) { const r = ia.get(a[i]), c = ib.get(b[i]); O[r][c]++; rt[r]++; ct[c]++; }
  let chi = 0;
  for (let r = 0; r < A.length; r++) for (let c = 0; c < B.length; c++) {
    const E = rt[r] * ct[c] / a.length; if (E <= 0) continue;
    chi += (O[r][c] - E) ** 2 / E;
  }
  return Math.sqrt(chi / (a.length * Math.min(A.length - 1, B.length - 1)));
};
const pearson = (a, b) => {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return (sa > 0 && sb > 0) ? sab / Math.sqrt(sa * sb) : NaN;
};

console.log(`\n══ REDONDANCE DES 4 LECTEURS DU STOCHASTIQUE · résidu ③ · lignes mortes exclues (${nGele}) ══`);
for (const cote of ["BUY", "SELL"]) {
  const s = S[cote]; if (!s.n) continue;
  console.log(`\n████ ${cote} — ${s.n} barres où les QUATRE parlent ████`);
  console.log(`\n  ── ① DISTRIBUTION de chaque note (⚠ une note plate ne PEUT PAS être redondante) ──`);
  for (const k of CLES) {
    const m = new Map();
    for (const v of s.v[k]) m.set(v, (m.get(v) ?? 0) + 1);
    const moy = s.v[k].reduce((a, b) => a + b, 0) / s.n;
    const modale = Math.max(...[...m.values()]) / s.n;
    console.log("  " + k.padEnd(9) + [...m].sort((a, b) => b[0] - a[0])
      .map(([v, n]) => `${v}→${(100 * n / s.n).toFixed(1)}%`).join("  ").padEnd(46)
      + `  moy ${moy.toFixed(2)} · modale ${(100 * modale).toFixed(1)} %`);
  }
  console.log(`\n  ── ② V DE CRAMÉR (0 = indépendants · 1 = l'un détermine l'autre) ──`);
  console.log("  " + "".padEnd(10) + CLES.map((k) => k.padStart(10)).join(""));
  for (const a of CLES)
    console.log("  " + a.padEnd(10) + CLES.map((b) => (a === b ? "—" : cramer(s.v[a], s.v[b]).toFixed(3)).padStart(10)).join(""));
  console.log(`\n  ── ③ r DE PEARSON (les notes sont ORDINALES : le SIGNE dit la direction) ──`);
  console.log("  " + "".padEnd(10) + CLES.map((k) => k.padStart(10)).join(""));
  for (const a of CLES)
    console.log("  " + a.padEnd(10) + CLES.map((b) => (a === b ? "—" : pearson(s.v[a], s.v[b]).toFixed(3)).padStart(10)).join(""));
}
console.log(`\n  ⚠ Repère du dépôt : \`kdCycleState\` contre \`ΔK\` = 0,342 (recouvrement MODÉRÉ, accepté).`);
console.log(`     \`kH1\`/\`kH4\` avaient été validées comme familles distinctes à 9,0 % de même case (hasard ~7 %).\n`);
