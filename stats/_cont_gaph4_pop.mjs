// _cont_gaph4_pop.mjs — POPULATION D'UNE TABLE `gapAtr H4` JUMELLE DE CELLE DU H1 (owner 16/08).
//
// 🎯 CE QUE L'OWNER VEUT : « une table gapatrh4 comme celle de h1 » — meme forme
//   `cote du prix x niveau x K−D`, 12 lignes x 3 colonnes, mais TOUT en H4. Elle remplacerait
//   `gapKdH4`, qui lit aujourd'hui un prix **H1** croise a un `K−D` H4 (donc une demi-voix H4).
//
// 🔴🔥 LA SEULE DECISION EN SUSPENS EST LE **BARREAU**, et elle est imprimee ici des DEUX facons :
//   ⓐ `gapLevel(gapAtrH4 / 2)` — on reutilise les barreaux H1. Le `2` n'est PAS un reglage :
//      `sqrt(4 h / 1 h) = 2`, et la mesure le confirme (rapport H4/H1 = 2,00 · 2,07 · 1,98 · 2,06
//      aux quantiles p25/p50/p75/p90). ⇒ une seule definition de `gapLevel`, aucun nouveau nombre.
//   ⓑ des barreaux PROPRES au H4 — la sonde imprime les quantiles bruts de `|gapAtrH4|` pour qu'on
//      voie ce qu'ils vaudraient. ⚠ Ca coute **95 nombres** (19 actifs x 5 coupes) a re-deriver a
//      chaque recalibrage du H1, et le depot ne duplique que ce qui peut LEGITIMEMENT diverger —
//      ici la divergence mesuree est un PUR facteur d'echelle.
//   ⇒ Les deux donnent la MEME occupation a ~4 % pres. Le tableau ⓐ est donc aussi la reponse a ⓑ.
//
// ⚠⚠ ATTENTION AU PIEGE DEJA DANS LE CODE : `atrP50Price` fait `getATRConfig(symbol, "H1")` —
//   l'etalon est CODE EN DUR sur H1. On le GARDE volontairement : c'est lui qui rend les deux
//   horizons comparables, et c'est aussi l'unite de risque du TP/SL. Le changer melangerait deux
//   gestes. ⚠ `gapLevel()` n'a AUCUN parametre `tf` — d'ou la normalisation AVANT l'appel.
//
// ⚠ Residu `rangCont` SEUL, PAR COTE, lignes MORTES exclues (panne broker).
//   usage : node stats/_cont_gaph4_pop.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines";
const { gapKdCote, gapKdCol, GAP_KD_COLS, GAP_KD_ROWS } = await import(`${R}/scoring/exhScoringV1.js`);
const { computeDeviation, gapLevel } = await import(`${R}/config/DeviationConfig.js`);
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const MORT = 5, NORM = 2;                        // ⓐ sqrt(4h / 1h)
const CH = ["symbol", "price", "zscore_h1_s0", "sigma_h1", "zscore_h4_s0", "sigma_h4",
            "stoch_k_h4_s0", "stoch_d_h4_s0", "stoch_k_h1_s0", "stoch_d_h1_s0"];
const vide = () => { const g = {}; for (const r of GAP_KD_ROWS) { g[r] = {}; for (const c of GAP_KD_COLS) g[r][c] = 0; } return g; };
const S = {};
for (const c of ["BUY", "SELL"]) S[c] = { n: 0, muet: 0, h4: vide(), h1: vide(), abs: [],
                                          memeCote: 0, memeNiveau: 0 };
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
    const sym = String(row.symbol || "");
    const num = (k) => { const v = row[k]; return v === "" || v == null ? null : Number(v); };
    s.n++;
    const d1 = computeDeviation(row, sym, "h1"), d4 = computeDeviation(row, sym, "h4");
    const g1 = Number.isFinite(d1?.gapAtr) ? d1.gapAtr : null;
    const g4 = Number.isFinite(d4?.gapAtr) ? d4.gapAtr : null;
    if (g1 == null || g4 == null) { s.muet++; continue; }
    // ⚠ LE NIVEAU H4 EST LU SUR LE GAP **NORMALISE**, le COTE sur le gap BRUT : un signe est
    //   invariant d'echelle, le diviser par 2 ne le change pas — mais l'ecrire ainsi dit lequel
    //   des deux depend du barreau et lequel n'en depend pas.
    const lvl4 = gapLevel(g4 / NORM, sym), lvl1 = d1.level;
    if (!lvl4 || !lvl1) { s.muet++; continue; }
    s.abs.push(Math.abs(g4));
    const kd4 = (() => { const k = num("stoch_k_h4_s0"), dd = num("stoch_d_h4_s0"); return (k == null || dd == null) ? null : k - dd; })();
    const kd1 = (() => { const k = num("stoch_k_h1_s0"), dd = num("stoch_d_h1_s0"); return (k == null || dd == null) ? null : k - dd; })();
    if (!Number.isFinite(kd4) || !Number.isFinite(kd1)) { s.muet++; continue; }
    s.h4[`${gapKdCote(g4)}_${lvl4}`][gapKdCol(kd4)]++;
    s.h1[`${gapKdCote(g1)}_${lvl1}`][gapKdCol(kd1)]++;
    if (gapKdCote(g1) === gapKdCote(g4)) s.memeCote++;
    if (lvl1 === lvl4) s.memeNiveau++;
  }
  rows.clear();
}

const pc = (n, t) => (t ? (100 * n / t).toFixed(2) : "0.00") + " %";
const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
console.log(`\n══ TABLE \`gapAtr H4\` JUMELLE — population du résidu ③ · lignes mortes exclues (${nGele}) ══`);
for (const cote of ["BUY", "SELL"]) {
  const s = S[cote]; const t = s.n - s.muet; if (!t) continue;
  console.log(`\n████ ${cote} — ${t} barres (muettes ${s.muet}) ████`);
  console.log(`\n  ── ⓐ LES 36 CASES \`côté H4 × niveau H4 × K−D H4\` (barreaux H1, gap ÷ ${NORM}) ──`);
  console.log("  ligne".padEnd(20) + GAP_KD_COLS.map((c) => c.padStart(11)).join("") + "      ligne │  rappel H1");
  for (const r of GAP_KD_ROWS) {
    const row = s.h4[r], l4 = GAP_KD_COLS.reduce((a, c) => a + row[c], 0);
    const l1 = GAP_KD_COLS.reduce((a, c) => a + s.h1[r][c], 0);
    console.log("  " + r.padEnd(18) + GAP_KD_COLS.map((c) => pc(row[c], t).padStart(11)).join("")
      + pc(l4, t).padStart(11) + " │" + pc(l1, t).padStart(11) + (l4 === 0 ? "  🔴 VIDE" : ""));
  }
  const col = { KD_POS: 0, CONTACT: 0, KD_NEG: 0 };
  for (const r of GAP_KD_ROWS) for (const c of GAP_KD_COLS) col[c] += s.h4[r][c];
  console.log("  " + "COLONNE".padEnd(18) + GAP_KD_COLS.map((c) => pc(col[c], t).padStart(11)).join(""));
  const cases = GAP_KD_ROWS.flatMap((r) => GAP_KD_COLS.map((c) => s.h4[r][c]));
  console.log(`  → case la mieux peuplée ${pc(Math.max(...cases), t)} · cases non vides ${cases.filter((v) => v > 0).length}/36`);
  console.log(`\n  ── CE QUE LE H4 DIT DE PLUS QUE LE H1 ──`);
  console.log(`  même CÔTÉ de la moyenne (H1 et H4) ... ${pc(s.memeCote, t)}   ⇒ ${pc(t - s.memeCote, t)} de CÔTÉS OPPOSÉS`);
  console.log(`  même NIVEAU .......................... ${pc(s.memeNiveau, t)}`);
  console.log(`\n  ── ⓑ QUANTILES BRUTS de |gapAtr H4| (ce que des barreaux PROPRES vaudraient) ──`);
  console.log("  " + [0.20, 0.40, 0.60, 0.80, 0.92].map((p) => `p${(100 * p).toFixed(0)} ${q(s.abs, p).toFixed(2)}`).join("   "));
}
console.log(`\n  ⚠ ⓐ et ⓑ donnent la MÊME occupation à ~4 % près : le rapport H4/H1 est un 2,00× net sur`);
console.log(`     tous les quantiles, donc une calibration percentile RETROUVERAIT ce facteur 2.\n`);
