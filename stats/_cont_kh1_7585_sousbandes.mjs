// _cont_kh1_7585_sousbandes.mjs — LE CREUX `[75·85[ x KD_POS` SE RESSERRE-T-IL ? (owner 16/08)
//
// 🎯 PREREQUIS NOMME : `_cont_kh1_wr_par_case` a isole UNE case qui survit au mix, a la symetrie et
//   a l'effectif — `[75·85[ x KD_POS`, **68,6 % de WR/grappe credite du cote faible sur 147
//   grappes**, sous le point mort de 75 %. C'est la seule case qui justifie un geste. Reste a
//   savoir si le creux est ETALE sur toute la case ou CONCENTRE dans un coin.
//
// ⚠⚠ DEUX DECOUPES, PARCE QUE LA CASE A DEUX DIMENSIONS NON LUES :
//   ① le NIVEAU — `]75·80]` contre `]80·85]` (miroirs `[20·25[` et `[15·20[`). Symetrique.
//   ② l'AMPLITUDE du `K−D` — `gapKdCol` ecrase `+2,2` et `+25` dans la MEME case `KD_POS`. C'est le
//      meme defaut que `gapKd`, et `kdDistanceBand` (bandes 2,1 · 7 · 14 · 18) existe deja.
//   ⇒ Si le creux se resserre sur ①, c'est un probleme de PLACE. Sur ②, de VIOLENCE de la poussee.
//      Les deux dictent des tables differentes.
//
// ⚠ CREDITE DU COTE LE PLUS FAIBLE (decision owner 16/08 : pas de regle qui encode une direction).
//   Le miroir est MAINTENU — « un %K haut qui monte encore » et « un %K bas qui descend encore »
//   sont la MEME figure, et l'ecart entre les cotes est un biais de fenetre, pas une propriete.
// ⚠ COLLIDER (tirs) · PAS UN BALAYAGE (un 0 libere des slots, il ne soustrait pas) · < 20 grappes
//   marque ⚠ et non interprete.
//   usage : MAXOPEN=100 MAXPERSYMBOL=100 MIN_CONT=0 node stats/_cont_kh1_7585_sousbandes.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "0";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines";
const { gapKdCol } = await import(`${R}/scoring/exhScoringV1.js`);
const { kdDistanceBand } = await import(`${R}/opportunities/OpportunityDetector.js`);
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const envNum = (k, d) => { const r = process.env[k]; if (r === undefined || r === "") return d;
                           const v = Number(r); return Number.isFinite(v) ? v : d; };
const OPTS = { maxOpen: envNum("MAXOPEN", 100), cadenceMin: 2, chargeSpread: true };
const mps = envNum("MAXPERSYMBOL", undefined); if (mps !== undefined) OPTS.maxPerSymbol = mps;

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
  const head = L[0].split(";");
  const iTs = head.indexOf("timestamp"), iK = head.indexOf("stoch_k_h1_s0"), iD = head.indexOf("stoch_d_h1_s0");
  for (const l of L.slice(1)) {
    const c = l.split(";"); if (!veut.has(c[iTs])) continue;
    const k = Number(c[iK]), d = Number(c[iD]);
    if (Number.isFinite(k) && Number.isFinite(d)) lu.set(a + "|" + c[iTs], [k, k - d]);
  }
}

// ── la CASE : `%K H1` dans ]75·85] cote BUY, [15·25[ cote SELL · `K−D` qui POUSSE dans le sens joue ──
// ⚠ La borne haute est INCLUSIVE cote BUY et EXCLUSIVE cote SELL — c'est la bascule a 50 de `bandeK`
//   (`[lo·hi[` sous 50, `]lo·hi]` au-dessus), reproduite ici parce qu'on ne passe plus par une table.
//   ⛔ L'ecrire « pareil des deux cotes » decalerait la population d'un cran sur un cote seulement.
const dansCase = (side, k) => side === "BUY" ? (k > 75 && k <= 85) : (k >= 15 && k < 25);
const pousse = (side, kd) => gapKdCol(kd) === (side === "BUY" ? "KD_POS" : "KD_NEG");
// ⇒ sous-bande QUALITE : « le plus pres du bout » = haut cote BUY, bas cote SELL.
const sousBande = (side, k) => side === "BUY" ? (k > 80 ? "]80·85] (au bout)" : "]75·80] (un cran avant)")
                                             : (k < 20 ? "]80·85] (au bout)" : "]75·80] (un cran avant)");

const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = sym(x) + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()], w = t.filter((x) => x.outcome === "WIN").length;
  return { n: t.length, gr: v.length, wr: 100 * w / t.length,
           wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };

const CASE = { BUY: [], SELL: [] };
for (const s of TIRS) {
  const v = lu.get(sym(s) + "|" + s.tsMT); if (!v) continue;
  const [k, kd] = v;
  if (!dansCase(s.side, k) || !pousse(s.side, kd)) continue;
  CASE[s.side]?.push({ ...s, _sb: sousBande(s.side, k), _amp: kdDistanceBand(Math.abs(kd)) });
}
const fmt = (o) => o ? `${String(o.n).padStart(4)}/${String(o.gr).padStart(3)}${o.wr.toFixed(1).padStart(7)}%`
                       + `${o.wrg.toFixed(1).padStart(7)}%${((o.R >= 0 ? "+" : "") + o.R.toFixed(1)).padStart(7)}`
                       + (o.gr < 20 ? " ⚠" : "  ") : "        —      —      —      —  ";
const credit = (b, s) => (b && s) ? Math.min(b.wrg, s.wrg).toFixed(1).padStart(7) + "%" : "      · ";
const LIGNE = (lbl, f) => {
  const b = st(CASE.BUY.filter(f)), s = st(CASE.SELL.filter(f));
  console.log("  " + lbl.padEnd(24) + fmt(b) + "│" + fmt(s) + "│" + credit(b, s));
};
const HEAD = () => {
  console.log("  " + " ".repeat(24) + "         B U Y           │         S E L L         │ credit");
  console.log("  " + "".padEnd(24) + " tirs/gr  WR/tir WR/grap      R │ tirs/gr  WR/tir WR/grap      R │ faible");
  console.log("  " + "─".repeat(24) + "─".repeat(25) + "┼" + "─".repeat(25) + "┼" + "─".repeat(8));
};

console.log(`\n══ LE CREUX \`[75·85[ × KD_POS\` — SE RESSERRE-T-IL ? ══   (MIN_CONT=${process.env.MIN_CONT}, écrasé)`);
console.log(`  BUY : %K H1 ∈ ]75·85] et K>D   ·   SELL : %K H1 ∈ [15·25[ et K<D   ·   point mort 75,0 %\n`);
HEAD();
LIGNE("LA CASE ENTIÈRE", () => true);
console.log(`\n  ── ① par SOUS-BANDE de niveau (5 pts) ──`);
HEAD();
for (const sb of ["]75·80] (un cran avant)", "]80·85] (au bout)"]) LIGNE(sb, (x) => x._sb === sb);
console.log(`\n  ── ② par AMPLITUDE du |K−D| (bandes 2,1 · 7 · 14 · 18) ──`);
HEAD();
for (const a of ["LOW", "MEDIUM", "HIGH", "EXTREME"]) LIGNE(a, (x) => x._amp === a);
console.log(`\n  ── ③ CROISÉ niveau × amplitude ──`);
HEAD();
for (const sb of ["]75·80] (un cran avant)", "]80·85] (au bout)"])
  for (const a of ["LOW", "MEDIUM", "HIGH+"])
    LIGNE(`${sb.slice(0, 9)} × ${a}`, (x) => x._sb === sb && (a === "HIGH+" ? (x._amp === "HIGH" || x._amp === "EXTREME") : x._amp === a));
console.log(`\n  ⚠ ⚠ = moins de 20 grappes, imprimé mais non interprété.`);
console.log(`  ⚠ COLLIDER (tirs) · PAS UN BALAYAGE : un 0 posé ici LIBÈRE des slots, il ne soustrait pas ce WR.\n`);
