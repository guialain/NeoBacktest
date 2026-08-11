// _pb_deversoir_exh.mjs — LE RANG ② EST-IL LE DÉVERSOIR DES EXH EMPÊCHÉS ?
//
// ⭐⭐⭐ LA QUESTION (owner 2026-08-11). Le rang ① cède au rang ② pour TROIS raisons très
//   différentes, et la cascade les traite identiquement :
//       `score`        — conviction ≤ MIN_PRES : l'EXH n'a RIEN VU. Céder est légitime.
//       `veto`         — l'EXH a lu la barre et VU une figure, un refus l'empêche de tirer.
//       `routeur-zone` — le garde-fou dit que l'EXH n'aurait PAS DÛ lire cette barre.
//   Or ①→② CHANGE DE CÔTÉ. Céder une barre à signature EXH FORTE, c'est autoriser le rang ② à
//   vendre dans un épuisement acheteur caractérisé. La cascade s'en protège déjà — la bande
//   `exh-ambiguous` existe au motif qu'« un épuisement faible POLLUE la thèse pro-tendance qui
//   suit » — mais cette protection est en 4ᵉ position dans le `if/else if` : les sorties `veto` et
//   `routeur-zone` la COURT-CIRCUITENT. ⇒ Plus la figure EXH est forte, plus elle a de chances de
//   croiser un veto, donc MOINS elle est protégée. C'est inversé, et ça n'a jamais été décidé.
//
// ⚠⚠ POURQUOI ON SÉPARE `veto` DE `routeur-zone`, ET CE N'EST PAS COSMÉTIQUE. Le score n'a pas le
//   même STATUT dans les deux cas :
//     · `veto`         — l'EXH a lu légitimement ; la conviction MESURE la figure. Exploitable.
//     · `routeur-zone` — le routeur vient de déclarer la LECTURE incohérente (zone contre le côté,
//                        ou MID). La conviction existe mais on vient de dire qu'elle ne veut rien
//                        dire ici. S'en servir pour disqualifier le PB, ce serait disqualifier avec
//                        un nombre déclaré non fiable. ⇒ Les deux colonnes ne se somment PAS.
//
// ⚠ CONTREFACTUEL ET MAJORANT : les tirs PB simulés ici ne concourent contre personne, alors que
//   `maxOpen`/spacing réallouent dans le vrai moteur. Même réserve que `_pb_population_nue`.
// ⚠ `VETOS_TUEURS=off` FORCÉ : on mesure l'état AVANT le geste du 11/08, sinon la sonde mesurerait
//   déjà une partie de ce qu'elle sert à décider.
// ⚠ Dédoublonnage 15 min AVANT de marcher · `tsMT` NORMALISÉ avant toute découpe de date.
//   usage : node stats/_pb_deversoir_exh.mjs   [SEUIL_PB=<n>]
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.VETOS_TUEURS = "off";
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
const { readTfs } = await import(M + "vetoGate.js");
const { exhNeLitPasCetteBarre } = await import(M + "routeur.js");
const { MIN_EXH, MIN_PRES } = await import(M + "scoringDecision.js");

const SEUIL_PB = Number(process.env.SEUIL_PB ?? 5);
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ── On traite UN ACTIF À LA FOIS et on relâche ses `rows` : 19 × 23 115 × 292 colonnes tenus
//    ensemble font sauter le tas de Node (OOM mesuré à 4 Go, cf. `matrixBacktest`).
const P = [];
let sansRow = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) {
    const c = l.split(";"); const o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = c[i];
    rows.set(o.timestamp, o);          // ⚠ `timestamp` dans le CSV, `tsMT` dans le moteur
  }
  const p = prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true });
  if (!p) continue;
  for (const g of (p.ghosts || [])) {
    if (g.ghost !== "boxes") continue;
    const row = rows.get(g.tsMT);
    if (!row) { sansRow++; continue; }
    const v = readTfs(row);
    // 🔴 ON REPRODUIT LA CHAÎNE DE `decideFromScoring`, DANS SON ORDRE. Le fantôme porte le verdict
    //   de la BOÎTE (évaluation parallèle, SANS garde-fou de zone) — s'en servir ici mesurerait
    //   l'autre organe. Constaté le 11/08 : boîte `deal` 4 673 contre cascade `FIRE_EXH` 2 499, et
    //   l'écart EST le garde-fou. ⇒ On recalcule `contreSaZone` pour parler de la CASCADE.
    const contreSaZone = exhNeLitPasCetteBarre(v.h1?.zone, v.h1?.kdGap, g.eSide, v.h4, v.m15);
    const conv = g.eConv;
    let branche;
    if (contreSaZone) branche = "routeur-zone";
    else if (g.eBlk === true) branche = "veto";
    else if (Number.isFinite(conv) && conv > MIN_EXH) branche = "·deal·";
    else if (Number.isFinite(conv) && conv > MIN_PRES) branche = "·drop·";
    else branche = "score";
    P.push({ asset: a, ep: g.ep, tsMT: g.tsMT, side: g.side, eSide: g.eSide, eConv: conv,
             pConv: g.pConv, branche, entry: g.entry, atr: g.atr, spreadRaw: g.spreadRaw,
             _walk: p.walk });
  }
}
console.log(`\n═══ LE RANG ② EST-IL LE DÉVERSOIR DES EXH EMPÊCHÉS ? ═══`);
console.log(`  [NO_TRIGGER · spread FACTURÉ · VETOS_TUEURS=off · MIN_EXH ${MIN_EXH} · MIN_PRES ${MIN_PRES} · seuil PB ${SEUIL_PB}]`);
console.log(`  ${P.length} barres avec boîte PB` + (sansRow ? `  🔴 ${sansRow} sans row (jointure) — NE PAS CONCLURE` : "  ✅ jointure complète"));
if (sansRow) process.exit(1);

// ── ① LA COMPOSITION DU RANG ② ────────────────────────────────────────────────────────────────
const rang2 = P.filter((x) => x.branche === "routeur-zone" || x.branche === "veto" || x.branche === "score");
const bande = (c) => (!Number.isFinite(c) ? "muet" : c <= MIN_PRES ? "≤0" : c <= MIN_EXH ? `]0·${MIN_EXH}]` : `>${MIN_EXH}`);
console.log(`\n── ① QUI ARRIVE AU RANG ②, ET AVEC QUELLE SIGNATURE EXH ──`);
console.log(`  ${rang2.length} barres atteignent le rang ② (sur ${P.length})\n`);
const BANDES = ["≤0", `]0·${MIN_EXH}]`, `>${MIN_EXH}`, "muet"];
const BRANCHES = ["score", "veto", "routeur-zone"];
console.log("    " + "branche".padEnd(15) + BANDES.map((b) => b.padStart(10)).join("") + "     total");
for (const br of BRANCHES) {
  const t = rang2.filter((x) => x.branche === br);
  console.log("    " + br.padEnd(15) + BANDES.map((b) => String(t.filter((x) => bande(x.eConv) === b).length).padStart(10)).join("")
    + String(t.length).padStart(10));
}
const trou = rang2.filter((x) => x.branche !== "score" && Number.isFinite(x.eConv) && x.eConv > MIN_PRES);
console.log(`\n  ⇒ LE TROU (conviction > ${MIN_PRES} ET sortie veto/garde-fou) : ${trou.length} barres` +
  `  =  ${(100 * trou.length / (rang2.length || 1)).toFixed(1)} % du rang ②`);

// ── ② CE QUE LE PB EN FAIT ────────────────────────────────────────────────────────────────────
const jour = (x) => String(x.tsMT || "").slice(0, 10).replace(/\./g, "-");
const dedupe = (pop) => { const v = new Set(), o = [];
  for (const g of pop.slice().sort((a, b) => a.ep - b.ep)) {
    const k = `${g.asset}|${g.side}|${Math.floor(g.ep / 15)}`; if (v.has(k)) continue; v.add(k); o.push(g); }
  return o; };
// ⚠ `side` = celui du PB (le fantôme le porte déjà) — c'est la boîte qu'on mesure ici.
const simuler = (pop) => dedupe(pop.filter((x) => Number.isFinite(x.pConv) && x.pConv > SEUIL_PB))
  .map((g) => { const r = g._walk(g); return r ? { ...g, R: r.R, outcome: r.outcome } : null; })
  .filter((x) => x && (x.outcome === "WIN" || x.outcome === "LOSS"));

const BE = 75;
const st = (t) => { if (!t.length) return null;
  const w = t.filter((x) => x.outcome === "WIN").length, R = t.reduce((a, b) => a + (b.R || 0), 0);
  const g = new Map();
  for (const x of t) { const k = `${x.asset}|${jour(x)}`; if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, wr: 100 * w / t.length, R, gr: v.length,
           wrg: 100 * v.reduce((a, o) => a + o.w / o.n, 0) / v.length,
           bas: v.filter((o) => o.w / o.n < BE / 100).length }; };
const ligne = (lbl, t) => { const s = st(t);
  if (!s) { console.log(`    ${lbl.padEnd(38)}     —`); return null; }
  console.log(`    ${lbl.padEnd(38)} ${String(s.n).padStart(5)} ${s.wr.toFixed(1).padStart(7)}%` +
    ` ${s.wrg.toFixed(1).padStart(8)}% ${String(s.gr).padStart(5)} ${String(s.bas).padStart(5)}` +
    ` ${((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8)} ${(s.R / s.n).toFixed(3).padStart(7)}`);
  return s; };
const ENTETE = `    ${"".padEnd(38)}  tirs  WR/tir WR/grap  grap  <BE        R   R/tir`;

console.log(`\n── ② LE CONTRASTE — les barres à signature EXH forte font-elles de BONS pullbacks ? ──`);
console.log(`  ⭐ Si elles sont MAUVAISES, le critère de l'owner paie deux fois. Si elles sont BONNES,`);
console.log(`     on reproduirait l'erreur de SIGNE du point C sur un autre axe.\n`);
console.log(ENTETE);
const tout = ligne("TOUT LE RANG ② (référence)", simuler(rang2));
ligne("  sortie `score` (l'EXH n'a rien vu)", simuler(rang2.filter((x) => x.branche === "score")));
console.log("");
const sTrou = ligne("LE TROU (conv>0, veto/garde-fou)", simuler(trou));
ligne("  …dont sortie `veto`", simuler(trou.filter((x) => x.branche === "veto")));
ligne("  …dont sortie `routeur-zone`", simuler(trou.filter((x) => x.branche === "routeur-zone")));
console.log("");
for (const b of [MIN_EXH, 20, 30]) {
  ligne(`  …dont conviction EXH > ${b}`, simuler(trou.filter((x) => x.eConv > b)));
}

if (tout && sTrou) {
  console.log(`\n  ⇒ le trou pèse ${(100 * sTrou.n / tout.n).toFixed(1)} % des tirs PB et ` +
    `${(100 * sTrou.R / (tout.R || 1)).toFixed(1)} % du R`);
  const d = sTrou.wrg - (st(simuler(rang2.filter((x) => x.branche === "score")))?.wrg ?? NaN);
  console.log(`     écart WR/grappe (trou − « l'EXH n'a rien vu ») : ${(d >= 0 ? "+" : "") + d.toFixed(1)} pt` +
    (d < 0 ? "   ⇒ le trou est le MAUVAIS côté du carnet" : "   ⇒ 🔴 le trou est le MEILLEUR côté — signe inversé"));
}

console.log(`\n── ③ JUILLET / AOÛT — un gain ADOSSÉ est le signal d'alarme ──`);
console.log(ENTETE);
for (const [lbl, f] of [["juillet", (x) => jour(x) < "2026-08-01"], ["août", (x) => jour(x) >= "2026-08-01"]]) {
  ligne(`${lbl} — le trou`, simuler(trou.filter(f)));
  ligne(`${lbl} — « l'EXH n'a rien vu »`, simuler(rang2.filter((x) => x.branche === "score" && f(x))));
}
