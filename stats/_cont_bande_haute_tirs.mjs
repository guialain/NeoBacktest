// _cont_bande_haute_tirs.mjs — LES TIRS DE LA BANDE HAUTE, UN PAR UN, AVEC LEURS CINQ FAMILLES
//
// 🎯 PREREQUIS NOMME : `_cont_wr_par_score_par_cote` (22/08, MIN_CONT=0) montre que le barema ③
//   ORDONNE jusqu'a `[24 · 28[` puis SE RETOURNE, et que l'ecart BUY−SELL GRANDIT avec le score
//   (`−0,8` en bas → `+26,6` dans `[32 · 36[`). Une bande de 14 tirs (`[36 · 40[`) ne se juge pas
//   sur un WR : elle se LIT. Cette sonde imprime donc CHAQUE TIR, pas une moyenne.
//
// ⭐⭐⭐ POURQUOI IMPRIMER DES TIRS ALORS QUE CE DEPOT REPETE « LES BARRES NE SONT PAS LES TIRS » :
//   la regle vise les MESURES (une part, un WR de population). Ici l'objet EST le carnet — on veut
//   savoir CE QUI A ETE PRIS au sommet de l'echelle, et par quelle combinaison de familles. C'est
//   une AUTOPSIE, pas une statistique : aucun chiffre d'ici ne vaut preuve d'une regle.
//
// ⚠ 14 tirs ⇒ AUCUN WR n'est lisible (plancher de bruit ~0,3 pt, sigma x9 par grappe). La colonne
//   `grappe` est imprimee pour ca : si les tirs se concentrent sur peu de couples actif|jour, la
//   bande decrit UN EPISODE, pas une population. C'est le crible « survivre au retrait de sa pire
//   grappe » applique a l'oeil.
//
// ⚠ Les notes de famille sont les MOYENNES PONDEREES internes (bornees [0 · 10]) ; le total est leur
//   SOMME a poids 1. Une famille MUETTE est ABSENTE (`—`), elle ne DILUE pas — l'inverse du rang ①.
//   ⇒ un total haut avec 4 familles n'est pas le meme fait qu'un total haut avec 5.
//
//   usage : node stats/_cont_bande_haute_tirs.mjs   [LO=36] [HI=40] [MIN_CONT=0]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "0";
const LO = Number(process.env.LO ?? 36), HI = Number(process.env.HI ?? 40);
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { CONT_ECHELLE } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js");
const { BONUS_APPLIQUE } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
// 🔬 22/08 — LA COUPE DU VETO `cont-mean-flat`, LUE A SA SOURCE (`meanFlatCut`, p20 PAR ACTIF), jamais
//   recopiee ni approchee par `dMean[0]` (qui est le p30 de la GRAMMAIRE des bandes, pas le seuil du
//   veto). Elle sert a repondre a UNE question : ces tirs sont-ils loin du plancher, ou juste au-dessus ?
const { meanFlatCut } = await import("../../Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const conv = (s) => s.sc?.boxes?.cont?.conviction;
const fam  = (s, n) => s.sc?.boxes?.cont?.familles?.[n];
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s) && Number.isFinite(conv(s)));
const T = CONT.filter((s) => conv(s) >= LO && conv(s) < HI).sort((a, b) => conv(b) - conv(a));
const NOMS = CONT_ECHELLE.familles;

console.log(`\n═══ RANG ③ · AUTOPSIE DE LA BANDE [${LO} · ${HI}[ ═══  [MIN_CONT=${process.env.MIN_CONT} · ① et ② a leurs seuils REELS · spread FACTURE]`);
console.log(`  bareme [${CONT_ECHELLE.min} · ${CONT_ECHELLE.max}] · familles ${NOMS.join(" + ")} · bonus ${BONUS_APPLIQUE ? "APPLIQUES" : "DEBRANCHES"}`);
console.log(`  ${CONT.length} tirs CONT au total · ${T.length} dans la bande (${(100 * T.length / CONT.length).toFixed(1)} %)`);
if (!T.length) { console.log("  🔴 BANDE VIDE — rien a lire."); process.exit(0); }
const gr = new Set(T.map((s) => s.asset + "|" + jour(s)));
console.log(`  ${gr.size} grappes actif|jour distinctes pour ${T.length} tirs · point mort 75,0 %\n`);

// ⚠⚠ DEUX COLONNES POUR UNE SEULE GRANDEUR, ET C EST VOULU : `mSlope` est la valeur BRUTE (le sens
//   de la moyenne H1) et `→pari` la MEME valeur ORIENTEE sur le cote joue (SELL ⇒ signe inverse).
//   Le depot documente exactement ce piege sur `deltaKBand` (brut) vs `zDeltaCol` (oriente) : deux
//   vocabulaires, deux semantiques. On imprime les deux pour n avoir a en deviner aucune.
// ⚠ `x p20` = |meanSlope| / coupe du veto `cont-mean-flat`. `1,0` = pile sur le plancher, `<1`
//   serait BLOQUE (donc impossible parmi des tirs), `10` = dix fois au-dessus du plancher.
const ori = (s) => Number.isFinite(s.meanSlopeH1) ? (s.side === "SELL" ? -s.meanSlopeH1 : s.meanSlopeH1) : null;
const xp20 = (s) => { const c = meanFlatCut(s.asset);
  return (Number.isFinite(s.meanSlopeH1) && Number.isFinite(c) && c > 0) ? Math.abs(s.meanSlopeH1) / c : null; };
const H = "  " + "date  heure".padEnd(18) + "actif".padEnd(11) + "cote".padEnd(6) + "res".padEnd(6)
        + "R".padStart(7) + "  conv" + NOMS.map((n) => n.padStart(8)).join("")
        + "mSlope".padStart(9) + "→pari".padStart(9) + "x p20".padStart(8) + "  bande";
console.log(H); console.log("  " + "─".repeat(H.length - 2));
for (const s of T) {
  const ts = String(s.tsMT || "").replace(/\./g, "-");
  const notes = NOMS.map((n) => Number.isFinite(fam(s, n)) ? fam(s, n).toFixed(1).padStart(8) : "       —");
  const muettes = NOMS.filter((n) => !Number.isFinite(fam(s, n)));
  console.log("  " + ts.slice(0, 16).padEnd(18) + String(s.asset).padEnd(11) + String(s.side).padEnd(6)
    + (s.outcome === "WIN" ? "WIN " : "LOSS").padEnd(6)
    + ((s.R >= 0 ? "+" : "") + s.R.toFixed(2)).padStart(7) + "  " + conv(s).toFixed(0).padStart(4)
    + notes.join("")
    + (Number.isFinite(s.meanSlopeH1) ? ((s.meanSlopeH1 >= 0 ? "+" : "") + s.meanSlopeH1.toFixed(3)).padStart(9) : "        —")
    + (Number.isFinite(ori(s)) ? ((ori(s) >= 0 ? "+" : "") + ori(s).toFixed(3)).padStart(9) : "        —")
    + (Number.isFinite(xp20(s)) ? xp20(s).toFixed(1).padStart(8) : "       —")
    + "  " + String(s.meanSlopeBandH1 ?? "—").padEnd(14) + (muettes.length ? "muettes:" + muettes.join(",") : ""));
}
// ⚠ Les moyennes ci-dessous portent sur <20 tirs par cote : elles ORIENTENT le regard, elles ne
//   concluent RIEN. Elles sont imprimees parce que la question posee est « quelle famille pousse ».
const moy = (t, n) => { const v = t.map((x) => fam(x, n)).filter(Number.isFinite);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length) : null; };
console.log("\n  ── MOYENNE DE CHAQUE FAMILLE DANS LA BANDE (⚠ orienter le regard, pas conclure) ──");
console.log("  " + "groupe".padEnd(22) + "tirs".padStart(5) + NOMS.map((n) => n.padStart(8)).join(""));
for (const [lbl, t] of [["tous", T], ["BUY", T.filter((s) => s.side === "BUY")],
                        ["SELL", T.filter((s) => s.side === "SELL")],
                        ["gagnants", T.filter((s) => s.outcome === "WIN")],
                        ["PERDANTS", T.filter((s) => s.outcome === "LOSS")]]) {
  if (!t.length) { console.log("  " + lbl.padEnd(22) + "    0" + NOMS.map(() => "       —").join("")); continue; }
  console.log("  " + lbl.padEnd(22) + String(t.length).padStart(5)
    + NOMS.map((n) => { const m = moy(t, n); return m === null ? "       —" : m.toFixed(1).padStart(8); }).join(""));
}
const R = T.reduce((a, b) => a + (b.R || 0), 0), W = T.filter((s) => s.outcome === "WIN").length;
console.log(`\n  bande : ${W}/${T.length} gagnants · ${(R >= 0 ? "+" : "") + R.toFixed(1)} R`);
console.log("  🔴 RAPPEL : cette bande est le SOMMET ATTEINT de l'echelle, pas le sommet DECLARE.");
console.log(`     Le bareme monte a ${CONT_ECHELLE.max} ; ce qui suit ${HI} n'existe dans aucun carnet.\n`);
