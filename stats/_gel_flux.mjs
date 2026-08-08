// _gel_flux.mjs — LES GELS DE FLUX, ET CE QUE VALENT LES TIRS QUI PARTENT JUSTE APRES (08/08).
//
// 🔴🔥 TROUVE EN OUVRANT DEUX CAS : le 04/08, **226 lignes IDENTIQUES de 10:25 a 14:10 UTC sur les
//   19 actifs a la fois** — prix ET tous les capteurs figes. Ce n'est pas un marche fige (3 h 45 un
//   mardi, tous marches confondus) : c'est le scan qui a repete sa derniere ligne.
//   ⇒ Le 1er SELL EXH d'US_TECH100 part a 14:11, UNE MINUTE apres la reprise. Celui de SILVER part
//     a 14:15, sur la barre de reprise elle-meme : prix +2,0 %, `z` 0,64 → 1,90, `%K H1` 22 → 86 en
//     UN tick de scan. Le moteur n'a pas vu la montee, il en a vu le RESULTAT — et l'a lue comme un
//     epuisement.
//
// ⚠⚠ EFFET SUR TOUTE MESURE DE DUREE : un gel compte comme du temps ecoule. La persistance
//   `%K H4` lue au 1er tir du 04/08 valait 281 min, dont **225 de gel** — reelle ~56 min.
//
// ⚠⚠ CE QUE CE SCRIPT NE SAIT PAS FAIRE, ET QU'IL FAUT SAVOIR EN LISANT SA SORTIE : il CONFOND
//   deux choses tres differentes —
//     (a) la FERMETURE NORMALE (week-end, overnight indices, session COCOA) : legitime, le prix ne
//         bouge pas parce qu'il n'y a pas de marche. Les gels de ~3 467 min du 31/07 20:58 sont ca.
//     (b) la PANNE DE SCAN MARCHE OUVERT (04/08 10:25→14:10) : un bug.
//   ⇒ « delai depuis le gel » mesure donc surtout « minutes depuis l'ouverture de session ». C'est
//     une variable causale et gratuite, mais ce n'est PAS la these de la panne. Separer (a) de (b)
//     demande de croiser avec les HEURES DECLAREES par actif — pas fait.
//
//   usage : node stats/_gel_flux.mjs        (MIN_GEL en env, defaut 10 lignes)
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "../data/matrix");
const MIN_GEL = Number(process.env.MIN_GEL ?? 10);        // lignes consecutives a prix IDENTIQUE
const F = []; const GELS = [];

for (const a of readdirSync(DIR).filter((f) => f.endsWith(".csv")).map((f) => f.slice(0, -4))) {
  const lines = readFileSync(`${DIR}/${a}.csv`, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 5);
  const H = lines[0].split(";").map((s) => s.trim());
  const ci = Object.fromEntries(H.map((h, i) => [h, i]));
  const N = lines.length - 1, ts = new Array(N), row = new Array(N), prix = new Array(N);
  for (let i = 0; i < N; i++) { const c = lines[i + 1].split(";"); row[i] = c; ts[i] = Date.parse(c[ci.ts_utc]); prix[i] = c[ci.price]; }
  // ⚠ comparaison de CHAINES, pas de nombres : un prix repete est bit-a-bit identique ; un arrondi
  //   sur `Number` ferait passer deux prix voisins pour un gel.
  const depuis = new Array(N).fill(Infinity);
  let n = 1, fin = null;
  for (let i = 1; i < N; i++) {
    if (prix[i] === prix[i - 1]) n++;
    else { if (n >= MIN_GEL) { fin = ts[i - 1]; GELS.push({ a, debut: ts[i - n], fin: ts[i - 1], min: (ts[i - 1] - ts[i - n]) / 60000 }); } n = 1; }
    depuis[i] = fin === null ? Infinity : (ts[i] - fin) / 60000;
  }
  const idx = new Map(); for (let i = 0; i < N; i++) idx.set(row[i][ci.timestamp], i);
  let r; try { r = runMatrixBacktest(`${DIR}/${a}.csv`, { chargeSpread: true, spacing: false, maxOpen: 100000 }); } catch { continue; }
  for (const s of r.signals ?? []) {
    if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
    const i = idx.get(s.tsMT); if (i === undefined) continue;
    F.push({ a, d: String(s.tsMT).slice(0, 10), side: s.side, win: s.R > 0, R: s.R, dep: depuis[i] });
  }
}

const longs = GELS.filter((g) => g.min >= 30).sort((x, y) => y.min - x.min);
console.log(`=== ${GELS.length} gels (>= ${MIN_GEL} lignes identiques) · dont ${longs.length} de >= 30 min ===`);
const parJour = {}; for (const g of longs) { const j = new Date(g.fin).toISOString().slice(0, 10); (parJour[j] ??= new Set()).add(g.a); }
console.log("  journees ou >= 5 actifs gelent (candidats PANNE DE SCAN si marche ouvert) :");
for (const [j, s] of Object.entries(parJour).sort()) if (s.size >= 5) console.log(`    ${j}  ${String(s.size).padStart(2)} actifs`);
console.log("  les 8 plus longs :");
for (const g of longs.slice(0, 8)) console.log(`    ${g.a.padEnd(12)} ${new Date(g.debut).toISOString().slice(0, 16)} -> ${new Date(g.fin).toISOString().slice(11, 16)}  ${g.min.toFixed(0).padStart(5)} min`);

const st = (rs) => { const n = rs.length; if (!n) return null;
  const G = {}; for (const x of rs) { const k = `${x.a}|${x.d}`; (G[k] ??= { n: 0, w: 0 }); G[k].n++; G[k].w += x.win ? 1 : 0; }
  const gs = Object.values(G);
  return { n, wr: 100 * rs.filter((x) => x.win).length / n, R: rs.reduce((a, x) => a + x.R, 0), g: gs.length,
    wrg: 100 * gs.reduce((a, o) => a + o.w / o.n, 0) / gs.length }; };
const BD = [["< 15 min", 0, 15], ["15-30 min", 15, 30], ["30-60 min", 30, 60], ["1-2 h", 60, 120], ["2-6 h", 120, 360], ["> 6 h / jamais", 360, Infinity]];
console.log(`\n=== WR EXH selon le DELAI depuis la fin du dernier gel ===`);
console.log(`${"".padEnd(24)}  tirs   WR/tir  WR/grap  grap       R`);
for (const side of ["SELL", "BUY"]) {
  console.log(`--- ${side} ---`);
  const S = F.filter((x) => x.side === side); const t = st(S);
  console.log(`  ${"TOUT".padEnd(22)} ${String(t.n).padStart(5)} ${t.wr.toFixed(1).padStart(7)}% ${t.wrg.toFixed(1).padStart(7)}% ${String(t.g).padStart(5)} ${t.R.toFixed(1).padStart(7)}`);
  for (const [l, lo, hi] of BD) {
    const o = st(S.filter((x) => x.dep >= lo && x.dep < hi));
    if (!o) { console.log(`  ${l.padEnd(22)}     0`); continue; }
    console.log(`  ${l.padEnd(22)} ${String(o.n).padStart(5)} ${o.wr.toFixed(1).padStart(7)}% ${o.wrg.toFixed(1).padStart(7)}% ${String(o.g).padStart(5)} ${o.R.toFixed(1).padStart(7)}`);
  }
}
