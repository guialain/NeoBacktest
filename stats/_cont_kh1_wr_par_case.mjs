// _cont_kh1_wr_par_case.mjs — WR DES TIRS CONT PAR CASE `%K H1 x K−D H1` (owner 16/08).
//
// 🎯 PREREQUIS NOMME : la table `kH1` doit devenir un FACTEUR (`0` annule / `1` laisse passer /
//   `>1` amplifie) appliquee au score `kH4`. `_cont_kh1_multiplicateur_pop.mjs` a donne la
//   POPULATION et le SCORE EN JEU par case ; il manque **ce que ces cases RAPPORTENT**.
//
// ⚠⚠ TROIS RESERVES, ET IL FAUT LES LIRE AVANT LES CHIFFRES :
//   ① **COLLIDER** — on conditionne sur des TIRS. La case ne dit pas « ce que cette figure vaut »,
//      elle dit « ce que le carnet a fait quand il est passe par la ». Les barres non tirees ne
//      sont pas ici, et elles ne sont pas absentes au hasard.
//   ② **PAS UN BALAYAGE** — ceci decoupe UN carnet deja produit. Les creneaux ne se reallouent
//      qu'au RE-RUN : poser un `0` sur une case ne retire PAS son WR du total, il LIBERE des slots.
//      « un veto ne soustrait pas, il REMPLACE » (mesure : 82 refus ⇒ 27 trades en moins).
//   ③ **MIN_CONT ECRASE BAS** pour voir toute la population — sinon on ne verrait que la moitie
//      haute du barema, second collider. ⇒ ce n'est PAS le carnet de prod.
// ⚠ LES DEUX COMPTAGES : WR/TIR (l'ampleur) et WR/GRAPPE (la confiance). Leur ecart mesure la
//   concentration. Une case sous ~20 grappes ne conclut rien — elle est imprimee, pas interpretee.
// ⚠ CADRE QUALITE, les deux cotes ramenes dans le meme repere (bande miroir + colonne miroir).
//   usage : MAXOPEN=100 MAXPERSYMBOL=100 MIN_CONT=0 node stats/_cont_kh1_wr_par_case.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "0";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines";
const { bandeK, gapKdCol, GAP_KD_COLS, GAP_KD_COL_MIRROR } = await import(`${R}/scoring/exhScoringV1.js`);
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const envNum = (k, d) => { const r = process.env[k]; if (r === undefined || r === "") return d;
                           const v = Number(r); return Number.isFinite(v) ? v : d; };
const OPTS = { maxOpen: envNum("MAXOPEN", 100), cadenceMin: 2, chargeSpread: true };
const mps = envNum("MAXPERSYMBOL", undefined); if (mps !== undefined) OPTS.maxPerSymbol = mps;

// ⚠ MEME DECOUPE QUE LA SONDE DE POPULATION — symetrique autour de 50 (le miroir l'exige).
const CUTS = [0, 10, 15, 25, 35, 45, 55, 65, 75, 85, 90, 101];
const TABLE = CUTS.slice(0, -1).map((lo, i) => [lo, CUTS[i + 1], { i }]);
const N = TABLE.length;
const T_SELL = TABLE.map(([lo, hi]) => [100 - hi + (hi === 101 ? 1 : 0), 100 - lo + (lo === 0 ? 1 : 0)])
                    .sort((a, b) => a[0] - b[0]).map(([lo, hi], j) => [lo, hi, { i: j }]);
const LIB = TABLE.map(([lo, hi]) => `[${String(lo).padStart(2)}·${hi === 101 ? 100 : hi}[`);

const files = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"));
const RUN = runMatrixPortfolio(files.map((f) => path.join(DIR, f)), OPTS);
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const sym = (s) => String(s.asset ?? s.symbol ?? "");
const TIRS = (RUN.signals ?? []).filter((s) => s.strategy === "CONT" && fini(s) && typeof s.R === "number");

// ⭐ ON N'INDEXE QUE LES HORODATAGES DES TIRS — 434 k lignes en objets = heap OOM (piege nomme).
const besoin = new Map();
for (const s of TIRS) { const k = sym(s); if (!besoin.has(k)) besoin.set(k, new Set()); besoin.get(k).add(s.tsMT); }
const lu = new Map();
for (const f of files) {
  const a = path.basename(f, ".csv"); const veut = besoin.get(a); if (!veut) continue;
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";");
  const iTs = head.indexOf("timestamp"), iK = head.indexOf("stoch_k_h1_s0"), iD = head.indexOf("stoch_d_h1_s0");
  if (iTs < 0 || iK < 0 || iD < 0) throw new Error(`${a} : colonnes absentes`);
  for (const l of L.slice(1)) {
    const c = l.split(";"); if (!veut.has(c[iTs])) continue;
    const k = Number(c[iK]), d = Number(c[iD]);
    if (Number.isFinite(k) && Number.isFinite(d)) lu.set(a + "|" + c[iTs], [k, k - d]);
  }
}

const vide = () => Array.from({ length: N }, () => ({ KD_POS: [], CONTACT: [], KD_NEG: [] }));
const S = { BUY: vide(), SELL: vide() };
let sansRow = 0;
for (const s of TIRS) {
  const v = lu.get(sym(s) + "|" + s.tsMT); if (!v) { sansRow++; continue; }
  const [k1, kd1] = v;
  const cel = bandeK(s.side === "BUY" ? TABLE : T_SELL, k1); if (!cel) continue;
  const iq = s.side === "BUY" ? cel.i : N - 1 - cel.i;
  const col = gapKdCol(kd1);
  const cq = s.side === "BUY" ? col : GAP_KD_COL_MIRROR[col];
  (S[s.side] ?? S.BUY)[iq][cq].push(s);
}

const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = sym(x) + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()], w = t.filter((x) => x.outcome === "WIN").length;
  return { n: t.length, gr: v.length, wr: 100 * w / t.length,
           wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
// ⚠ SOUS 20 GRAPPES ON IMPRIME MAIS ON MARQUE : le depot a paye « decouper fin FABRIQUE de faux sigma ».
const cell = (o) => o ? `${String(o.n).padStart(5)}/${String(o.gr).padStart(3)} ${o.wr.toFixed(1).padStart(5)}%`
                        + `${o.wrg.toFixed(1).padStart(6)}%${((o.R >= 0 ? "+" : "") + o.R.toFixed(1)).padStart(7)}`
                        + (o.gr < 20 ? "⚠" : " ")
                      : "        —     —      —      — ";

console.log(`\n══ CONT · WR PAR CASE %K H1 × K−D H1 · CADRE QUALITE ══`);
console.log(`  MIN_CONT=${process.env.MIN_CONT} (ECRASE, pas la prod) · maxOpen ${OPTS.maxOpen} · maxPerSymbol ${OPTS.maxPerSymbol ?? "(live)"}`);
console.log(`  ${TIRS.length} tirs CONT · ${sansRow} sans ligne retrouvee · point mort 75,0 %`);
console.log(`  format : tirs/grappes  WR/tir  WR/grap  R    ⚠ = moins de 20 grappes\n`);
for (const cote of ["BUY", "SELL"]) {
  console.log(`\n████ ${cote} ████`);
  console.log("  bande        " + GAP_KD_COLS.map((c) => c.padStart(21) + "  ").join("") + "     LIGNE");
  for (let i = 0; i < N; i++) {
    const r = S[cote][i];
    const tous = GAP_KD_COLS.flatMap((c) => r[c]);
    if (!tous.length) continue;
    console.log("  " + LIB[i].padEnd(13) + GAP_KD_COLS.map((c) => cell(st(r[c]))).join("") + " " + cell(st(tous)));
  }
  const parCol = {};
  for (const c of GAP_KD_COLS) parCol[c] = S[cote].flatMap((r) => r[c]);
  console.log("  " + "COLONNE".padEnd(13) + GAP_KD_COLS.map((c) => cell(st(parCol[c]))).join(""));
}
console.log(`\n  ⚠ COLLIDER : conditionne sur des TIRS. Ne dit pas ce que la figure vaut, dit ce que le carnet a fait.`);
console.log(`  ⚠ PAS UN BALAYAGE : poser un 0 sur une case ne retire pas son WR — il LIBERE des slots. Verdict au RE-RUN.\n`);
