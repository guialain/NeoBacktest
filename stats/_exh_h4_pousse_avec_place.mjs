// _exh_h4_pousse_avec_place.mjs — « LE H4 DIVERGE, %K MONTE FRANCHEMENT ET IL A DE LA PLACE, ET LE
//   PRIX N'EST PAS AU BOUT » (owner, 20/08). La these : `kdH1` donne de FAUX signaux dans ce cas.
// ============================================================================================
// 🎯 SELL (on fade une hausse) — les cinq termes, TOUS lus depuis le MOTEUR :
//      ① `kdCycleH4 = DIVERGING`   (kdCycleState, bande morte 2,1, NON signee)
//      ② `kH4 < 80`                 il reste de la place avant l'extreme
//      ③ `dKBandH4 ∈ {SOFT_UP, FAST_UP}`   (`deltaKBand`, bandes [4,4 · 13 · 21])
//      ④ `z H1 < 2,15`              le prix n'est pas encore a l'etirement extreme
//      ⑤ `Δz H1` flat/up            l'etirement ne se resorbe pas
//
// 🔴🔥⭐⭐⭐ IL Y A **DEUX** `dz` ET ILS ONT DES SIGNES OPPOSES SUR LA BARRE DE REFERENCE :
//      · `dZ` DU MOTEUR   = `zscore_h1_s0 − zscore_h1` (live moins cloture), ce que `scoringInputs`
//        construit et ce que le rang ③ consomme sous `dzH1Live`.
//      · `dz_h1`          = une colonne du CSV, calculee par l'EA.
//   `US_TECH100 2026.07.30 16:31` : moteur **−0,11** · colonne **+0,01**. On mesure LES DEUX BRAS et
//   on le dit. Choisir en silence aurait donne un resultat plausible et faux.
//
// ⚠ MIROIR obligatoire — le BUY tourne en CONTROLE :
//      ① idem · ② kH4 > 20 · ③ {SOFT_DOWN, FAST_DOWN} · ④ z H1 > −2,15 · ⑤ Δz flat/down
// ⭐ EMPILEMENT + crible de la pire grappe : une conjonction de 5 termes isole un episode par
//   construction. Sept candidats du depot sont morts sur UNE journee.
// ⚙ Usage : `node stats/_exh_h4_pousse_avec_place.mjs`  ·  `Z_MAX=2.15 K_EXT=80 EXPLO=1`
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
const Z_MAX = envNum("Z_MAX", 2.15), K_EXT = envNum("K_EXT", 80);
const EXPLO = envNum("EXPLO", 0) === 1;   // 1 ⇒ accepte aussi EXPLOSIVE_UP dans ③
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number");

const SELLish = (t) => t.side === "SELL";
const S = (t) => (SELLish(t) ? 1 : -1);
const kOr = (t) => (Number.isFinite(t.kH4) ? (SELLish(t) ? t.kH4 : 100 - t.kH4) : null);
const zOr = (t) => (Number.isFinite(t.zscoreH1) ? S(t) * t.zscoreH1 : null);
// ⚠ LES DEUX `dz`, NOMMES SEPAREMENT — jamais fondus dans une variable « dz ».
const dzMoteur = (t) => (Number.isFinite(t.zscoreH1S0) && Number.isFinite(t.zscoreH1) ? S(t) * (t.zscoreH1S0 - t.zscoreH1) : null);
const dzColonne = (t) => (Number.isFinite(t.dzH1Col) ? S(t) * t.dzH1Col : null);
const HAUT = EXPLO ? ["SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"] : ["SOFT_UP", "FAST_UP"];
const BAS = EXPLO ? ["SOFT_DOWN", "FAST_DOWN", "EXPLOSIVE_DOWN"] : ["SOFT_DOWN", "FAST_DOWN"];
const dkOr = (t) => (SELLish(t) ? HAUT : BAS).includes(t.dKBandH4);

const lisible = EXH.filter((t) => typeof t.kdCycleH4 === "string" && typeof t.dKBandH4 === "string"
  && [kOr(t), zOr(t), dzMoteur(t), dzColonne(t)].every((x) => Number.isFinite(x)));
const perdus = EXH.length - lisible.length;

const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => 100 * v.g / v.n;
const sg = (v) => (wr(v) - BE) / (Math.sqrt(0.75 * 0.25 / v.n) * 100);
const L = (lbl, a, ref) => a.length
  ? `   ${lbl.padEnd(48)}${String(a.length).padStart(5)}  ${wr(agg(a)).toFixed(2).padStart(6)} %  ${agg(a).R.toFixed(1).padStart(7)} R  ${(agg(a).R / a.length).toFixed(4).padStart(8)}  σ ${sg(agg(a)).toFixed(1).padStart(5)}${Number.isFinite(ref) ? `  ${(wr(agg(a)) - ref >= 0 ? "+" : "") + (wr(agg(a)) - ref).toFixed(2)} pt` : ""}`
  : `   ${lbl.padEnd(48)}    — (case vide)`;

console.log(`\n══ RANG ① — H4 QUI DIVERGE, %K QUI MONTE, DE LA PLACE DEVANT ══`);
console.log(`   MIN_EXH ${MIN_EXH} · capacite ${MAXOPEN}/${MAXPERSYMBOL} · NO_TRIGGER=1`);
console.log(`   ② kH4 < ${K_EXT} · ③ ${HAUT.join("/")} · ④ |z H1| < ${Z_MAX} · ⑤ Δz flat/up`);
console.log(`   tirs EXH ${EXH.length} · lisibles ${lisible.length}` + (perdus ? `  ⚠ ${perdus} EXCLUS (capteur absent)` : ""));
const dist = new Map();
for (const t of lisible) dist.set(t.dKBandH4, (dist.get(t.dKBandH4) ?? 0) + 1);
console.log(`   `+"`dKBandH4` : " + [...dist.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "));
// ⭐ LES DEUX `dz`, COMBIEN DE FOIS SONT-ILS D'ACCORD ? Si le desaccord est massif, aucun resultat
//   « au dz » ne se lit sans dire lequel.
const acc = lisible.filter((t) => (dzMoteur(t) >= 0) === (dzColonne(t) >= 0)).length;
console.log(`   ⚠ les deux \`dz\` s'accordent sur le SIGNE dans ${acc}/${lisible.length} cas (${(100 * acc / lisible.length).toFixed(1)} %)`);

for (const [brasNom, dzF] of [["Δz DU MOTEUR (z_s0 − z_close)", dzMoteur], ["Δz COLONNE CSV (`dz_h1`)", dzColonne]]) {
  const C = [
    ["① kdCycleH4 = DIVERGING", (t) => t.kdCycleH4 === "DIVERGING"],
    [`② kH4 < ${K_EXT} (de la place devant)`, (t) => kOr(t) < K_EXT],
    [`③ dKBandH4 = ${HAUT.join("/")}`, dkOr],
    [`④ z H1 < ${Z_MAX}`, (t) => zOr(t) < Z_MAX],
    [`⑤ Δz H1 flat/up (≥ 0)`, (t) => dzF(t) >= 0],
  ];
  for (const [nom, pop] of [["SELL — CE QUE TU DEMANDES", lisible.filter(SELLish)],
                            ["BUY — LE MIROIR, EN CONTROLE", lisible.filter((t) => !SELLish(t))]]) {
    const ref = wr(agg(pop));
    console.log(`\n   ${"═".repeat(100)}`);
    console.log(`   ${nom}  ·  bras ${brasNom}   —   base ${pop.length} tirs / ${ref.toFixed(2)} %`);
    console.log(`   ${"case".padEnd(48)}${"tirs".padStart(5)}      WR        R     R/tir      σ/BE     ecart`);
    console.log(`   ── CHAQUE CONDITION SEULE ──`);
    for (const [lbl, f] of C) console.log(L(lbl, pop.filter(f), ref));
    console.log(`   ── EMPILEMENT ──`);
    let cur = pop;
    for (let i = 0; i < C.length; i++) { cur = cur.filter(C[i][1]); console.log(L(`  jusqu'a ${"①②③④⑤"[i]}`, cur, ref)); }
    console.log(L(`   ⭐ LA FIGURE COMPLETE`, cur, ref));
    console.log(L(`      son complement`, pop.filter((t) => !C.every(([, f]) => f(t))), ref));

    const jour = (t) => `${t.asset ?? t.symbol}|${String(t.tsMT ?? "").slice(0, 10)}`;
    const pertes = new Map();
    for (const t of cur) if ((t.R ?? 0) <= 0) pertes.set(jour(t), (pertes.get(jour(t)) ?? 0) + 1);
    const pire = [...pertes.entries()].sort((a, b) => b[1] - a[1])[0];
    const g = new Set(cur.map(jour));
    console.log(`   ── CRIBLE ──  grappes ${g.size} pour ${cur.length} tirs (${(cur.length / (g.size || 1)).toFixed(2)}/grappe)` +
      (g.size && g.size <= 3 ? `   ⚠⚠ ${g.size} GRAPPE(S) : c'est un EPISODE, pas une population` : ""));
    if (pire) {
      const reste = cur.filter((t) => jour(t) !== pire[0]);
      console.log(`      pire grappe ${pire[0]} : ${pire[1]} pertes / ${cur.filter((t) => jour(t) === pire[0]).length} tirs`);
      console.log(L(`      SANS elle`, reste, ref));
      if (reste.length) console.log(`      ⇒ ${wr(agg(reste)) >= ref ? "⛔ S'INVERSE — ce n'etait pas une regle" : "✅ reste sous la moyenne du cote"}`);
    } else if (cur.length) console.log(`      aucune perte dans la case — rien a retirer`);
    if (cur.length && cur.length <= 30) console.log(`      les grappes : ${[...g].join(" · ")}`);
  }
}
console.log(`\n   ⚠ point mort 75,0 %.\n`);
