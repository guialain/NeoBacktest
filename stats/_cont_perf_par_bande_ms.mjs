// _cont_perf_par_bande_ms.mjs — LA FORME REELLE DE `meanSlopeH1 percentile -> performance ③`
//
// 🎯 DEMANDE owner 22/08, `MIN_CONT = 1` : par bande, episodes / BUY / SELL / WR / R / sigma, puis
//   BUY-SELL separes quand l'echantillon le permet. Objectif NOMME : mesurer la FORME de la
//   relation AVANT de choisir `MIN_CONT`.
//
// ⭐⭐⭐ CE QUE LA DEMANDE SUPPOSE ET QUI N'EST PAS VRAI ICI — A LIRE AVANT LE TABLEAU.
//   « Separer BUY / SELL par bande » n'a PAS de sens dans ce design : la porte de cote rend un
//   modulateur `0` du mauvais cote, donc **chaque bande n'a qu'un seul cote par construction**
//   (DOWN = SELL pur, UP = BUY pur, FLAT = vide). Une colonne BUY d'une bande DOWN sera
//   TOUJOURS a zero, et ce n'est pas un manque d'echantillon.
//   ⇒ La vraie separation BUY/SELL de ce moteur est la comparaison des bandes **MIROIR** entre
//     elles : `STRONG_DOWN` (SELL) contre `STRONG_UP` (BUY). C'est ce que fait le bloc ②.
//
// ⚠⚠ SIGMA EST CALCULE SUR LES **GRAPPES**, PAS SUR LES TIRS. Les tirs d'un meme actif-jour ne sont
//   pas independants — ce depot a mesure **sigma x9** entre les deux comptages. Un sigma par tir
//   ferait passer pour lisible une case qui ne l'est pas. `sigma` ici = erreur-type de la moyenne
//   des WR par grappe = ecart-type(WR/grappe) / racine(n_grappes).
// ⚠ Point mort **75,0 %** (spread facture, tout en 1:3). Sous cette barre c'est une PERTE.
// ⚠ La capacite SATURE a `MIN_CONT = 1` (maxOpen 30, 8/symbole, spacing) : les cases sont des
//   SURVIVANTES. La table CLASSE, seul un carnet re-couru par seuil PROUVE.
//   usage : node stats/_cont_perf_par_bande_ms.mjs   [MIN_CONT=1]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { MS_BANDES } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/contMeanSlopeMod.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));

/** ⭐ Le seul agregateur du fichier — un concept, un domicile. `wrg` et `sig` viennent de la MEME
 *  liste de grappes, donc ils ne peuvent pas diverger. */
const st = (t) => {
  if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const parts = [...g.values()].map((o) => o.w / o.n);
  const wrg = parts.reduce((a, b) => a + b, 0) / parts.length;
  // ⚠ ecart-type d'ECHANTILLON (n-1). Avec 1 seule grappe, sigma n'existe pas — on rend `null`
  //   plutot que `0`, qui se lirait « mesure parfaitement precise ».
  const va = parts.length > 1
    ? parts.reduce((a, b) => a + (b - wrg) ** 2, 0) / (parts.length - 1) : null;
  return {
    n: t.length, gr: parts.length,
    wrt: 100 * t.filter((x) => x.outcome === "WIN").length / t.length,
    wrg: 100 * wrg,
    sig: va === null ? null : 100 * Math.sqrt(va / parts.length),
    R: t.reduce((a, b) => a + (b.R || 0), 0),
    buy: t.filter((x) => x.side === "BUY").length, sell: t.filter((x) => x.side === "SELL").length,
  };
};
const LIS = 20;   // ⚠ seuil de LISIBILITE en grappes — en dessous on affiche sans conclure.
const ligne = (lbl, s, l = 18) => {
  if (!s) { console.log("  " + lbl.padEnd(l) + "       0    0        —        —        —       —        —"); return; }
  console.log("  " + lbl.padEnd(l) + String(s.n).padStart(8) + String(s.gr).padStart(5)
    + String(s.buy).padStart(7) + String(s.sell).padStart(7)
    + (s.wrt.toFixed(1) + "%").padStart(9) + (s.wrg.toFixed(1) + "%").padStart(9)
    + (s.sig === null ? "—" : "±" + s.sig.toFixed(1)).padStart(8)
    + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9)
    + (s.gr < LIS ? "   ⚠ <20 grappes" : (s.wrg < 75 ? "   🔴 sous le point mort" : "")));
};
const HEAD = (l = 18) => {
  console.log("  " + "bande".padEnd(l) + "tirs".padStart(8) + "grap".padStart(5) + "BUY".padStart(7) + "SELL".padStart(7)
    + "WR/tir".padStart(9) + "WR/grap".padStart(9) + "sigma".padStart(8) + "R".padStart(9));
  console.log("  " + "─".repeat(l + 62));
};

console.log(`\n═══ RANG ③ · PERFORMANCE PAR BANDE \`meanSlopeH1\` ═══  [MIN_CONT=${process.env.MIN_CONT} · spread FACTURE · point mort 75,0 %]`);
const T = st(CONT);
console.log(`  ${CONT.length} tirs · ${T.gr} grappes · WR/tir ${T.wrt.toFixed(1)} % · WR/grappe ${T.wrg.toFixed(1)} % ±${T.sig.toFixed(1)} · ${(T.R >= 0 ? "+" : "") + T.R.toFixed(1)} R\n`);

console.log("  ── ① LES 7 BANDES (ordre BRUT, du plus baissier au plus haussier) ──");
HEAD();
for (const b of MS_BANDES) ligne(b, st(CONT.filter((s) => s.sc?.msBande === b)));

console.log("\n  ── ② LES PAIRES MIROIR — c'est ICI qu'est la separation BUY / SELL ──");
console.log("  ⭐ chaque bande etant d'un seul cote, comparer `X_DOWN` (SELL) a `X_UP` (BUY) EST la");
console.log("     comparaison des deux cotes a intensite de deplacement EGALE.");
HEAD(18);
for (const [d, u] of [["MS_EXTREME_DOWN", "MS_EXTREME_UP"], ["MS_STRONG_DOWN", "MS_STRONG_UP"], ["MS_WEAK_DOWN", "MS_WEAK_UP"]]) {
  const sd = st(CONT.filter((s) => s.sc?.msBande === d)), su = st(CONT.filter((s) => s.sc?.msBande === u));
  ligne(d + " (SELL)", sd); ligne(u + " (BUY)", su);
  if (sd && su && sd.gr >= LIS && su.gr >= LIS) {
    const e = su.wrg - sd.wrg, s2 = Math.sqrt(sd.sig ** 2 + su.sig ** 2);
    console.log("  " + "".padEnd(18) + `   ecart BUY−SELL ${(e >= 0 ? "+" : "") + e.toFixed(1)} pt  (±${s2.toFixed(1)})`
      + (Math.abs(e) > 2 * s2 ? "   ⭐ au-dela de 2 sigma" : "   ⚠ dans le bruit"));
  } else console.log("  " + "".padEnd(18) + "   ecart NON calcule — une des deux moities est sous 20 grappes");
  console.log("");
}

console.log("  ── ③ LA FORME, AU PAS DE 5 PERCENTILES SUR L'AXE ORIENTE ──");
console.log("  ⭐ C'est CETTE table qui repond a la question posee : les 7 bandes sont trop grossieres");
console.log("     pour montrer une FORME. `p oriente` = le percentile dans le repere du pari.");
console.log("  ⚠ Sous 55 il n'y a rien : le modulateur y vaut 0, donc aucun tir. C'est voulu.");
HEAD(18);
for (let lo = 55; lo < 100; lo += 5) {
  const t = CONT.filter((s) => Number.isFinite(s.sc?.msPctOri) && s.sc.msPctOri >= lo && s.sc.msPctOri < lo + 5);
  ligne(`p [${lo} · ${lo + 5}[`, st(t));
  // ⭐ LE DECOUPAGE PAR COTE, ET IL EST INDISPENSABLE ICI : une tranche de percentile ORIENTE
  //   melange les deux cotes, alors que les 7 bandes ne le peuvent pas. Sans lui, un pic pourrait
  //   n etre que la moitie BUY qui pese plus lourd dans cette tranche — le motif « un chiffre
  //   agrege ne decrit pas une population qui a deux moities ».
  for (const c of ["BUY", "SELL"]) {
    const x = st(t.filter((s) => s.side === c));
    if (x) ligne("    " + c, x);
  }
}
console.log("\n  ⚠ Une table CLASSE des candidats ; seul un carnet RE-COURU par seuil PROUVE.");
console.log("     Les creneaux ne se reallouent qu'au re-run — ces cases sont des SURVIVANTES.\n");
