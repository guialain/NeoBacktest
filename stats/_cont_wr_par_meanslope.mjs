// _cont_wr_par_meanslope.mjs — LE RANG ③ SELON LA PENTE DE LA MOYENNE H1
//
// 🎯 PREREQUIS NOMME : l'autopsie de la bande haute (22/08) a montre que 11 des 14 tirs les mieux
//   notes du ③ ont la moyenne H1 qui bouge CONTRE le pari, et qu'AUCUNE des cinq familles ne mesure
//   ce sens. Cette sonde repond a la question qui suit : **sur tout le carnet ③, la pente separe-t-elle ?**
//
// ⚠⚠⭐⭐⭐ DEUX TABLES POUR UNE SEULE GRANDEUR, ET C'EST LA FAUTE QUE CE DEPOT PAIE LE PLUS SOUVENT.
//   `meanSlopeBand` est BRUTE (`SOFT_UP` = « la moyenne monte »), exactement comme `deltaKBand` ;
//   elle ne dit rien du pari. Lire un WR par bande BRUTE sur une population qui melange BUY et SELL
//   moyennerait deux faits opposes. ⇒ ① imprime la bande BRUTE **par cote** (aucun melange), ② la
//   bande ORIENTEE sur le pari (AVEC / CONTRE), qui est la seule qui reponde a « la continuation
//   veut-elle la pente avec elle ». Les deux, jamais une seule.
//
// 🔴🔥 LA LIGNE `FLAT` EST TRONQUEE PAR CONSTRUCTION, ET IL NE FAUT PAS LA LIRE COMME LES AUTRES.
//   `FLAT` = `|meanSlope| < p30` (grammaire `dMean`), mais le veto `cont-mean-flat` REFUSE deja tout
//   ce qui est sous le **p20** (`dMeanFlat`). Les tirs `FLAT` survivants sont donc la tranche
//   `[p20 · p30[` SEULE — pas la bande. Un WR bas ici ne dirait PAS « le plat perd », il dirait
//   « ce qui reste du plat perd », et un WR haut ne justifierait pas de desarmer le veto.
//
// 🔴 ET `dMean` PORTE UNE DETTE : le controle du 16/08 a trouve `dMean[0]` stocke a **10,8 % en
//   moyenne du p30 reel** (jusqu'a ±23 % : COCOA −23,0 · BRENT_OIL −19,7 · US_500 +15,4). Seul
//   `dMeanFlat` (p20) a ete re-mesure. ⇒ les frontieres FLAT/SOFT/FAST de cette table sont
//   APPROXIMATIVES par actif. Elles CLASSENT, elles ne calibrent pas.
//
// ⚠ WR PAR GRAPPE actif x jour (les tirs ne sont pas independants, sigma x9) · point mort 75,0 %.
// ⚠ La capacite SATURE a `MIN_CONT` bas : ce sont des survivants, pas une cohorte.
//   usage : node stats/_cont_wr_par_meanslope.mjs   [MIN_CONT=0]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "0";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
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
const AVEC_BANDE = CONT.filter((s) => s.meanSlopeBandH1);
const BUY = AVEC_BANDE.filter((s) => s.side === "BUY"), SELL = AVEC_BANDE.filter((s) => s.side === "SELL");

// ⭐ L'ORIENTATION SE FAIT EN UN SEUL ENDROIT. `SOFT_UP` sur un BUY et `SOFT_DOWN` sur un SELL sont
//   le MEME fait (« la moyenne va dans mon sens ») — c'est le miroir, et il n'a de sens que sur la
//   bande BRUTE. ⛔ Ne jamais orienter deux fois.
const ori = (s) => { const b = s.meanSlopeBandH1; if (!b) return null; if (b === "FLAT") return "FLAT";
  const up = b.endsWith("_UP"), fam = b.replace(/_(UP|DOWN)$/, "");
  return fam + (up === (s.side === "BUY") ? "_AVEC" : "_CONTRE"); };

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length,
           wrt: 100 * t.filter((x) => x.outcome === "WIN").length / t.length,
           R: t.reduce((a, b) => a + (b.R || 0), 0) }; };
const cell = (s) => s ? String(s.n).padStart(6) + String(s.gr).padStart(5) + s.wrg.toFixed(1).padStart(8) + "%"
                        + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8) : "     —    —        —       —";
const HEAD = (l) => { console.log("  " + " ".repeat(l) + "        B U Y          │        S E L L        │  ecart");
  console.log("  " + "bande".padEnd(l) + "  tirs grap  WR/grap       R │  tirs grap  WR/grap       R │ WR pts");
  console.log("  " + "─".repeat(l) + "─".repeat(28) + "┼" + "─".repeat(28) + "┼" + "─".repeat(8)); };
const ligne = (lbl, f, l) => { const b = st(BUY.filter(f)), s = st(SELL.filter(f));
  // ⚠ ECART affiche seulement si les DEUX cotes ont >= 20 grappes — sinon il decrirait du bruit.
  const ec = (b && s && b.gr >= 20 && s.gr >= 20)
    ? ((b.wrg - s.wrg >= 0 ? "+" : "") + (b.wrg - s.wrg).toFixed(1)).padStart(7) : "      ·";
  console.log("  " + lbl.padEnd(l) + cell(b) + " │" + cell(s) + " │" + ec); };

console.log(`\n═══ RANG ③ · WR SELON \`meanSlopeBand\` H1 ═══  [MIN_CONT=${process.env.MIN_CONT} · ① et ② a leurs seuils REELS · spread FACTURE]`);
const muets = CONT.length - AVEC_BANDE.length;
console.log(`  ${CONT.length} tirs CONT · ${AVEC_BANDE.length} avec une bande · ${muets} MUETS (${(100 * muets / (CONT.length || 1)).toFixed(1)} % — \`middle_h1_s1\` absent)`);
console.log(`  BUY ${BUY.length} · SELL ${SELL.length} · point mort 75,0 %`);
const TOT = st(AVEC_BANDE);
console.log(`  reference toutes bandes : ${TOT.wrg.toFixed(1)} % /grappe · ${TOT.wrt.toFixed(1)} % /tir · ${(TOT.R >= 0 ? "+" : "") + TOT.R.toFixed(1)} R\n`);

console.log("  ── ① BANDE BRUTE (le sens de la MOYENNE, pas du pari) — par cote, jamais melangee ──");
HEAD(16);
for (const b of ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"])
  ligne(b, (s) => s.meanSlopeBandH1 === b, 16);

console.log("\n  ── ② BANDE ORIENTEE SUR LE PARI — c'est CETTE table qui repond a la question ──");
HEAD(16);
for (const b of ["EXPLOSIVE_CONTRE", "FAST_CONTRE", "SOFT_CONTRE", "FLAT", "SOFT_AVEC", "FAST_AVEC", "EXPLOSIVE_AVEC"])
  ligne(b, (s) => ori(s) === b, 16);

console.log("\n  ── ③ AGREGE AVEC / CONTRE (FLAT exclu) ──");
HEAD(16);
ligne("CONTRE", (s) => String(ori(s)).endsWith("_CONTRE"), 16);
ligne("AVEC",   (s) => String(ori(s)).endsWith("_AVEC"), 16);

console.log("\n  🔴 `FLAT` = tranche `[p20 · p30[` SEULE (le veto `cont-mean-flat` a deja pris ce qui est sous p20).");
console.log("  🔴 `dMean` (p30/p70/p90) porte la dette de calibrage du 16/08 : ces frontieres CLASSENT, elles ne calibrent pas.");
console.log("  ⚠ Un WR par bande sur UN carnet n'est pas un balayage : les creneaux ne se reallouent qu'au RE-RUN.\n");
