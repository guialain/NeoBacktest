// _exh_figure_k_cross.mjs — LA FIGURE « %K H1 A L'EXTREME + K/D QUI PASSE DE CONTACT A CROSS ».
// ============================================================================================
// 🎯 DICTEE OWNER (12/08) : « mesure exh sell kH1 haute/xhaute et contact->cross, et miroir ».
//   SELL : `%K H1` en `HAUTE`/`EXTREME_HAUTE` + `kdPrev = CONTACT` -> `kdCur = CROSS`
//   BUY  : le MIROIR — `BASSE`/`EXTREME_BASSE` + la MEME transition.
// ⭐ LA TRANSITION, PAS L'ETAT : `CONTACT -> CROSS` est un EVENEMENT (les deux lignes se touchaient,
//   elles viennent de se croiser). `kdCur = CROSS` seul ne dit pas d'ou il vient.
//
// ⚠⚠ DEUX INSTANTS MESURES, ET C'EST OBLIGATOIRE ICI. La zone existe en LIVE (`zone`, sur `k_s0`) et
//   en CLOTURE (`zoneClosed`, sur `k_s1`). Ce depot a mesure que `k_s0 = k_s1 + dK` : selectionner sur
//   le niveau LIVE puis regarder un evenement de cycle peut FABRIQUER la population. Le 09/08, deux
//   classes entieres (`FAST_UP` 32 ep, `EXPLOSIVE_UP` 12 ep) tombaient a ZERO en passant a la cloture.
//   ⇒ On donne les deux. Si elles divergent, la figure est un artefact d'instant.
//
// ⚠ CONTRASTE ET PAS WR ISOLE : un WR de poche n'est pas une connaissance. On affiche toujours la
//   figure CONTRE le reste du rang ①, du MEME cote — c'est l'ecart qui informe.
// ⚠ WR PAR GRAPPE actif x jour (sigma x9 sinon) · point mort 75,0 %.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixBacktest } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { readTfs } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const HAUT = new Set(["HAUTE", "EXTREME_HAUTE"]), BAS = new Set(["BASSE", "EXTREME_BASSE"]);

const T = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f), sym = path.basename(f, ".csv");
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/); const h = L[0].split(";");
  const iT = h.indexOf("timestamp");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[iT], c); }
  for (const s of (runMatrixBacktest(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || [])) {
    if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
    const c = rows.get(s.tsMT); if (!c) continue;
    const t = readTfs(Object.fromEntries(h.map((k, i) => [k, c[i]])))?.h1;
    if (!t) continue;
    // ⭐ L'EXTREME EST CELUI DU COTE JOUE : un SELL fade le HAUT, un BUY fade le BAS.
    const bonExtreme = (z) => (s.side === "SELL" ? HAUT.has(z) : BAS.has(z));
    const transition = t.kdPrev === "CONTACT" && t.kdCur === "CROSS";
    T.push({ ...s, asset: sym,
             figLive: bonExtreme(t.zone) && transition,
             figClose: bonExtreme(t.zoneClosed) && transition,
             transition, zone: t.zone, zoneClosed: t.zoneClosed });
  }
  rows.clear();
}
const jour = (s) => String(s.tsMT || "").slice(0, 10);
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wr: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const cel = (v) => v ? String(v.n).padStart(6) + String(v.gr).padStart(5) + v.wr.toFixed(1).padStart(7) + "%" + ((v.R >= 0 ? "+" : "") + v.R.toFixed(1)).padStart(8) : "     —    —      —       —";

console.log(`\n══ RANG ① · figure « %K H1 a l'extreme du cote joue + K/D CONTACT -> CROSS » ══`);
console.log(`   ${T.length} tirs EXH lus · point mort 75,0 %\n`);
for (const [nom, cle] of [["ZONE LIVE (`k_s0`)", "figLive"], ["ZONE CLOTUREE (`k_s1`)", "figClose"]]) {
  console.log(`  ── ${nom} ──`);
  console.log(`     cote   etat            tirs grap     WR       R`);
  for (const side of ["SELL", "BUY"]) {
    const S = T.filter((x) => x.side === side);
    const dans = st(S.filter((x) => x[cle])), hors = st(S.filter((x) => !x[cle]));
    console.log(`     ${side.padEnd(6)} FIGURE       ` + cel(dans));
    console.log(`     ${" ".padEnd(6)} le reste     ` + cel(hors));
    if (dans && hors) console.log(`     ${" ".padEnd(6)} ecart        ${(dans.wr - hors.wr >= 0 ? "+" : "") + (dans.wr - hors.wr).toFixed(1)} pts` + (dans.gr < 20 ? `   ⚠ ${dans.gr} grappes seulement — sous le plancher de lisibilite` : ""));
  }
  console.log("");
}
// ⚠ LA TRANSITION SEULE, sans la condition de zone : sert de temoin. Si elle explique tout, la zone
//   n'apporte rien et la figure est en fait un evenement de cycle.
console.log(`  ── TEMOIN : la transition CONTACT -> CROSS SEULE (sans condition de zone) ──`);
for (const side of ["SELL", "BUY"]) {
  const S = T.filter((x) => x.side === side);
  console.log(`     ${side.padEnd(6)} transition   ` + cel(st(S.filter((x) => x.transition))));
  console.log(`     ${" ".padEnd(6)} le reste     ` + cel(st(S.filter((x) => !x.transition))));
}
console.log("");
