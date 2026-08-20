// _exh_kh1_parle_kh4_tait.mjs — WR DU RANG ① SELON QUE LE %K H4 CONFIRME, SE TAIT, OU CONTREDIT
//   le %K H1 qui, lui, a parle. Croisement, pas marginal.
// ============================================================================================
// ⭐⭐⭐ POURQUOI UN CROISEMENT : le rang ① ne lit le H4 QUE par l'etirement (`gapH4`). Il n'a aucune
//   entree pour l'ELAN du H4. La question « quand le H1 s'essouffle et que le H4 ne suit pas, le
//   fade tient-il ? » ne peut donc pas se lire dans le bareme — elle se mesure DEHORS.
// ⚠⚠ LES DEUX AXES SONT ORIENTES PAR LE COTE, SINON ILS S'ANNULENT. `kdGapH4 = K−D` est SIGNE dans
//   le repere du PRIX. Pour un fade SELL, l'essoufflement H4 c'est `K−D < 0` ; pour un fade BUY,
//   c'est `K−D > 0`. On ramene donc tout en repere « QUALITE DU FADE » :
//        h4conf = (side === "SELL") ? −kdGapH4 : +kdGapH4
//   `h4conf > 0` = le H4 va dans le sens du fade · `< 0` = il pousse CONTRE.
//   ⭐ C'est le miroir de l'owner : « %K haut qui monte » ≡ « %K bas qui descend ».
// ⚠ `kH1 PARLE` = l'entree `parts.kH1` du bareme est NON NULLE. On prend la note du MOTEUR, pas une
//   re-derivation : un controle qui DERIVE ce qu'il verifie est tautologique.
// ⚠ PLAT n'est pas ZERO : `|K−D| < PLAT` (defaut 2) est une bande d'indifference ASSUMEE. Sans elle
//   le signe de `−0,03` compterait autant que celui de `+19` — un signe n'est pas une amplitude.
// ⚙ Usage : `node stats/_exh_kh1_parle_kh4_tait.mjs`   (defauts PURS = carnet de prod)
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { MIN_EXH } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const envNum = (k, def) => {
  const raw = process.env[k];
  if (raw === undefined || raw === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
};
const PLAT = envNum("PLAT", 2);
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });

const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number");
// ⚠⚠ ON COMPTE CE QU'ON JETTE. Un trade sans `kdGapH4` (H4 absent de la ligne) n'est PAS un trade
//   « H4 muet » — c'est un trade ILLISIBLE, et les confondre inventerait une case.
const lisible = EXH.filter((t) => Number.isFinite(t.kdGapH4) && Number.isFinite(t.sc?.boxes?.exh?.parts?.kH1));
const perdus = EXH.length - lisible.length;

const parle = (t) => t.sc.boxes.exh.parts.kH1 !== 0;
const h4conf = (t) => (t.side === "SELL" ? -t.kdGapH4 : t.kdGapH4);
const colH4 = (t) => { const v = h4conf(t); return Math.abs(v) < PLAT ? "PLAT" : (v > 0 ? "CONFIRME" : "CONTRE"); };

const cel = new Map();
const add = (k, t) => { const v = cel.get(k) ?? { n: 0, g: 0, R: 0 }; v.n++; v.R += t.R ?? 0; if ((t.R ?? 0) > 0) v.g++; cel.set(k, v); };
for (const t of lisible) {
  const l = parle(t) ? "kH1 PARLE" : "kH1 MUET";
  add(`${l}|${colH4(t)}|TOUS`, t); add(`${l}|${colH4(t)}|${t.side}`, t);
  add(`${l}|— toutes —|TOUS`, t); add(`${l}|— toutes —|${t.side}`, t);
  add(`— tous —|${colH4(t)}|TOUS`, t);
}
const BE = 75;
const wr = (v) => 100 * v.g / v.n;
const sig = (v) => (wr(v) - BE) / (Math.sqrt(0.75 * 0.25 / v.n) * 100);

console.log(`\n══ RANG ① — %K H1 QUI PARLE × ELAN DU %K H4 (oriente par le cote) ══`);
console.log(`   MIN_EXH ${MIN_EXH} · capacite ${MAXOPEN}/${MAXPERSYMBOL} · NO_TRIGGER=1 · bande PLAT |K−D H4| < ${PLAT}`);
console.log(`   tirs EXH ${EXH.length} · lisibles ${lisible.length}` + (perdus ? `  ⚠ ${perdus} SANS kdGapH4 ou sans note kH1 — EXCLUS, pas ranges en « muet »` : ""));
console.log(`\n   CONFIRME = le %K H4 va DANS le sens du fade · CONTRE = il pousse contre · PLAT = |K−D H4| < ${PLAT}\n`);
const ligne = (lbl, v) => v
  ? `   ${lbl.padEnd(34)}${String(v.n).padStart(6)}  ${wr(v).toFixed(2).padStart(6)} %  ${v.R.toFixed(1).padStart(8)} R  ${(v.R / v.n).toFixed(4).padStart(8)}  σ ${sig(v).toFixed(1).padStart(5)}`
  : `   ${lbl.padEnd(34)}     —`;
console.log(`   ${"case".padEnd(34)}${"tirs".padStart(6)}      WR         R     R/tir      σ/BE`);
for (const l of ["kH1 PARLE", "kH1 MUET"]) {
  console.log(`   ${"─".repeat(80)}`);
  for (const c of ["CONFIRME", "PLAT", "CONTRE", "— toutes —"])
    console.log(ligne(`${l}  ×  ${c}`, cel.get(`${l}|${c}|TOUS`)));
}
console.log(`   ${"─".repeat(80)}`);
for (const c of ["CONFIRME", "PLAT", "CONTRE"]) console.log(ligne(`— tous —  ×  ${c}`, cel.get(`— tous —|${c}|TOUS`)));

// ⭐⭐⭐ PAR COTE, TOUJOURS : un ecart qui change de SIGNE entre les cotes est invisible dans l'agregat.
console.log(`\n   ── LE MEME TABLEAU, PAR COTE ──`);
console.log(`   ${"case".padEnd(28)}${"BUY  n / WR".padStart(20)}${"SELL  n / WR".padStart(22)}`);
const cote = (k) => { const v = cel.get(k); return v ? `${String(v.n).padStart(5)} / ${wr(v).toFixed(2).padStart(6)} %` : "    —          "; };
for (const l of ["kH1 PARLE", "kH1 MUET"])
  for (const c of ["CONFIRME", "PLAT", "CONTRE", "— toutes —"])
    console.log(`   ${`${l} × ${c}`.padEnd(28)}${cote(`${l}|${c}|BUY`).padStart(20)}${cote(`${l}|${c}|SELL`).padStart(22)}`);

// ── LA CASE DE L'OWNER, EN DETAIL : combien de R laisse-t-elle, et ou vit-elle ? ──────────────
const cible = lisible.filter((t) => parle(t) && colH4(t) === "CONTRE");
if (cible.length) {
  const v = cel.get(`kH1 PARLE|CONTRE|TOUS`);
  console.log(`\n   ── « kH1 PARLE × H4 CONTRE » — le detail ──`);
  console.log(`   ${cible.length} tirs · WR ${wr(v).toFixed(2)} % · ${v.R.toFixed(1)} R · ${(100 * cible.length / lisible.length).toFixed(1)} % du rang ①`);
  const parAsset = new Map();
  for (const t of cible) { const a = t.asset ?? t.symbol ?? "?"; const o = parAsset.get(a) ?? { n: 0, g: 0, R: 0 }; o.n++; o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; parAsset.set(a, o); }
  console.log(`   par actif (les 8 plus gros) :`);
  for (const [a, o] of [...parAsset.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 8))
    console.log(`      ${a.padEnd(12)}${String(o.n).padStart(4)} tirs  ${wr(o).toFixed(2).padStart(6)} %  ${o.R.toFixed(1).padStart(7)} R`);
  // ⭐ « une regle candidate doit survivre au retrait de sa PIRE grappe » — on donne de quoi le voir.
  const parJour = new Map();
  for (const t of cible) { const j = `${t.asset ?? t.symbol}|${String(t.tsMT ?? "").slice(0, 10)}`; const o = parJour.get(j) ?? { n: 0, g: 0 }; o.n++; if ((t.R ?? 0) > 0) o.g++; parJour.set(j, o); }
  const pires = [...parJour.entries()].filter(([, o]) => o.n >= 3).sort((x, y) => (x[1].g / x[1].n) - (y[1].g / y[1].n)).slice(0, 5);
  console.log(`   pires grappes (actif|jour, n≥3) : ${pires.map(([j, o]) => `${j} ${o.g}/${o.n}`).join("  ·  ") || "(aucune)"}`);
}
console.log(`\n   ⚠ point mort 75,0 %.\n`);
