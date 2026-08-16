// _cont_gapkd_desaccord.mjs — QUAND LE H1 DIT OUI ET LE H4 DIT NON, QUE VALENT CES TIRS ?
//
// 🎯 PREREQUIS NOMME — cas owner GBPUSD 2026.08.05 18:06:24 (BUY, rang ③, LOSS R −0,45) :
//   `gapAtr` H1 et H4 disent la MEME chose (`HAUT_SLACK` tous les deux), mais le stochastique
//   DIVERGE — `K−D` H1 = +5,75 (`KD_POS`) contre `K−D` H4 = −10,33 (`KD_NEG`). Le barème l'a vu :
//   `gapKd = +10`, `gapKdH4 = 0`.
//   🔴 Et la SCISSION du 16/08 a fait passer la contribution de `(10+0)/2 = 5` a `10+0 = 10` : dans
//   une MOYENNE un `0` s'oppose, dans une SOMME il s'abstient. Elle a desarme le seul organe qui
//   refusait. ⇒ Il faut savoir COMBIEN de tirs sont dans cette configuration, et ce qu'ils valent.
//
// ⚠⚠ CE QUE CETTE SONDE NE PEUT PAS DIRE, ET C'EST LA REGLE DU DEPOT : **un veto ne se juge PAS sur
//   le WR de sa poche.** Poser un refus ici ne SOUSTRAIT pas ces tirs — il LIBERE des creneaux qui
//   partent ailleurs (mesure : 82 refus ⇒ 27 trades en moins). Le verdict est un RE-RUN.
//   Ceci DIMENSIONNE la poche, ca ne la juge pas.
// ⚠ COLLIDER : conditionne sur des tirs. ⚠ PAR COTE. ⚠ < 20 grappes marque et non interprete.
//   usage : MAXOPEN=100 MAXPERSYMBOL=100 MIN_CONT=20 node stats/_cont_gapkd_desaccord.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "20";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines";
const { contNoteGapKd } = await import(`${R}/scoring/contScoringV1.js`);
const { computeDeviation } = await import(`${R}/config/DeviationConfig.js`);
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const envNum = (k, d) => { const r = process.env[k]; if (r === undefined || r === "") return d;
                           const v = Number(r); return Number.isFinite(v) ? v : d; };
const OPTS = { maxOpen: envNum("MAXOPEN", 100), cadenceMin: 2, chargeSpread: true };
const mps = envNum("MAXPERSYMBOL", undefined); if (mps !== undefined) OPTS.maxPerSymbol = mps;
const CH = ["symbol", "price", "zscore_h1_s0", "sigma_h1",
            "stoch_k_h1_s0", "stoch_d_h1_s0", "stoch_k_h4_s0", "stoch_d_h4_s0"];

const files = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"));
const RUN = runMatrixPortfolio(files.map((f) => path.join(DIR, f)), OPTS);
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const sym = (s) => String(s.asset ?? s.symbol ?? "");
const TIRS = (RUN.signals ?? []).filter((s) => s.strategy === "CONT" && fini(s) && typeof s.R === "number");

const besoin = new Map();
for (const s of TIRS) { const k = sym(s); if (!besoin.has(k)) besoin.set(k, new Set()); besoin.get(k).add(s.tsMT); }
const lu = new Map();
for (const f of files) {
  const a = path.basename(f, ".csv"); const veut = besoin.get(a); if (!veut) continue;
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const iTs = head.indexOf("timestamp");
  const ix = {}; for (const n of CH) ix[n] = head.indexOf(n);
  for (const l of L.slice(1)) {
    const c = l.split(";"); if (!veut.has(c[iTs])) continue;
    const row = {}; for (const n of CH) row[n] = c[ix[n]];
    lu.set(a + "|" + c[iTs], row);
  }
}

const CFG = ["ACCORD_POUR", "H1_SEUL (le H4 refuse)", "H4_SEUL (le H1 refuse)", "ACCORD_CONTRE"];
const S = {}; for (const c of ["BUY", "SELL"]) { S[c] = {}; for (const g of CFG) S[c][g] = []; }
const parNote = { BUY: {}, SELL: {} };   // H1_SEUL, ventile par la note H1 perdue
let sansRow = 0;

for (const s of TIRS) {
  const row = lu.get(sym(s) + "|" + s.tsMT); if (!row) { sansRow++; continue; }
  const n = (k) => { const v = row[k]; return v === "" || v == null ? null : Number(v); };
  const d = computeDeviation(row, String(row.symbol || ""), "h1");
  if (!Number.isFinite(d?.gapAtr) || !d?.level) continue;
  const kd = (tf) => { const k = n(`stoch_k_${tf}_s0`), dd = n(`stoch_d_${tf}_s0`); return (k == null || dd == null) ? null : k - dd; };
  const n1 = contNoteGapKd(d.gapAtr, d.level, kd("h1"), s.side);
  const n4 = contNoteGapKd(d.gapAtr, d.level, kd("h4"), s.side);
  if (!Number.isFinite(n1) || !Number.isFinite(n4)) continue;
  const g = n1 > 0 && n4 > 0 ? CFG[0] : n1 > 0 ? CFG[1] : n4 > 0 ? CFG[2] : CFG[3];
  (S[s.side] ?? S.BUY)[g].push(s);
  if (g === CFG[1]) ((parNote[s.side] ??= {})[n1] ??= []).push(s);
}

const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const gm = new Map();
  for (const x of t) { const k = sym(x) + "|" + jour(x); if (!gm.has(k)) gm.set(k, { w: 0, n: 0 });
    const o = gm.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...gm.values()], w = t.filter((x) => x.outcome === "WIN").length;
  return { n: t.length, gr: v.length, wr: 100 * w / t.length,
           wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const fmt = (o) => o ? `${String(o.n).padStart(5)}/${String(o.gr).padStart(3)}${o.wr.toFixed(1).padStart(7)}%`
                       + `${o.wrg.toFixed(1).padStart(7)}%${((o.R >= 0 ? "+" : "") + o.R.toFixed(1)).padStart(8)}`
                       + (o.gr < 20 ? " ⚠" : "  ") : "        —      —      —       —  ";

const tot = ["BUY", "SELL"].reduce((a, c) => a + CFG.reduce((b, g) => b + S[c][g].length, 0), 0);
console.log(`\n══ CONT · ACCORD / DÉSACCORD \`gapKd\` H1 vs H4 ══  MIN_CONT=${process.env.MIN_CONT} · ${tot} tirs · point mort 75,0 %`);
console.log(`  format : tirs/grappes  WR/tir  WR/grap  R    ⚠ = < 20 grappes\n`);
console.log("  " + "configuration".padEnd(24) + "         B U Y            │         S E L L");
console.log("  " + "".padEnd(24) + " tirs/gr  WR/tir WR/grap       R │ tirs/gr  WR/tir WR/grap       R");
console.log("  " + "─".repeat(24) + "─".repeat(26) + "┼" + "─".repeat(26));
for (const g of CFG)
  console.log("  " + g.padEnd(24) + fmt(st(S.BUY[g])) + "│" + fmt(st(S.SELL[g])));

console.log(`\n  ── \`H1_SEUL\` VENTILÉ PAR LA NOTE H1 QUE LE H4 CONTREDIT ──`);
console.log(`     ⭐ C'est le cas GBPUSD : plus la note H1 est HAUTE, plus le refus H4 coûte cher s'il a raison.`);
console.log("  " + "note H1".padEnd(24) + " tirs/gr  WR/tir WR/grap       R │ tirs/gr  WR/tir WR/grap       R");
const notes = [...new Set([...Object.keys(parNote.BUY), ...Object.keys(parNote.SELL)])].sort((a, b) => b - a);
for (const v of notes)
  console.log("  " + `+${v}`.padEnd(24) + fmt(st(parNote.BUY[v] ?? [])) + "│" + fmt(st(parNote.SELL[v] ?? [])));

console.log(`\n  ⚠ DIMENSIONNE la poche, ne la JUGE pas : poser un refus ici LIBÈRE des créneaux qui partent`);
console.log(`     ailleurs (82 refus ⇒ 27 trades en moins, mesuré). Le verdict est un RE-RUN.\n`);
