// _exh_divergence_rsi_k_h1.mjs — LA DIVERGENCE RSI vs %K EN H1, AU RANG ①.
// ============================================================================================
// 🎯 LA FIGURE (owner, 20/08) : le stochastique roule depuis le HAUT pendant que le RSI a encore
//   DE LA PLACE et pousse ENCORE. Autrement dit : l'oscillateur borne dit « c'est fini », l'element
//   de momentum dit « ca continue ». Le rang ① ne croise ces deux capteurs NULLE PART — `rsi` et
//   `stochH1` sont deux familles SEPAREES qui s'additionnent, et une somme ne peut pas exprimer un
//   DESACCORD (⭐ « seul un CROISEMENT ou un PRODUIT separe ; une combinaison LINEAIRE ne
//   discrimine pas »).
//
// ⚠⚠ MIROIR OBLIGATOIRE — PAS DE REGLE PAR COTE. Tout est ramene dans le repere « du cote FADE »
//   (SELL = on fade une hausse ; BUY = on fade une baisse) :
//        rsiOr   = SELL ? rsi        : 100 − rsi        ⇒ « ou en est le RSI vers l'extreme fade »
//        drsiOr  = SELL ? dRSI       : −dRSI            ⇒ « le RSI pousse-t-il ENCORE dans le sens fade »
//        kOr     = SELL ? %K         : 100 − %K
//        kdOr    = SELL ? (K−D)      : −(K−D)           ⇒ « le stoch TOURNE-t-il contre le mouvement »
//   ⇒ « rsi<70, dRSI up/flat, k>70, K−D<0 » devient : rsiOr < RSI_MAX · drsiOr ≥ 0 · kOr > K_MIN · kdOr < 0
//
// ⭐ FACTORIEL, PAS UNE SEULE CASE : une case isolee ne dit pas QUI fait le travail. On separe
//     A = « le stoch roule depuis le haut »   (kOr > K_MIN ET kdOr < 0)
//     B = « le RSI a de la place et pousse »  (rsiOr < RSI_MAX ET drsiOr ≥ 0)
//   La figure de l'owner est `A ET B`. Ses trois complements sont le controle.
// ⚠ HORLOGE : le rang ① lit la CLOTURE ⇒ `rsiH1`/`dRsiH1`/`kH1` (bare). Le bras LIVE est imprime
//   dessous comme CONTROLE — si les deux horloges disent l'inverse, aucune des deux ne conclut.
// ⚙ Usage : `node stats/_exh_divergence_rsi_k_h1.mjs`  ·  `RSI_MAX=70 K_MIN=70 DFLAT=0.5`
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
const RSI_MAX = envNum("RSI_MAX", 70), K_MIN = envNum("K_MIN", 70), DFLAT = envNum("DFLAT", 0.5);
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number");

const S = (t) => (t.side === "SELL" ? 1 : -1);
const rsiOr = (t, live) => { const v = live ? t.rsiH1Live : t.rsiH1; return v == null ? null : (t.side === "SELL" ? v : 100 - v); };
const drsiOr = (t, live) => { const v = live ? t.dRsiH1Live : t.dRsiH1; return v == null ? null : S(t) * v; };
const kOr = (t) => (t.kH1 == null ? null : (t.side === "SELL" ? t.kH1 : 100 - t.kH1));
const kdOr = (t) => (t.kdGapH1 == null ? null : S(t) * t.kdGapH1);

const BE = 75;
const wr = (v) => 100 * v.g / v.n;
const sg = (v) => (wr(v) - BE) / (Math.sqrt(0.75 * 0.25 / v.n) * 100);
const agg = (arr) => { const o = { n: arr.length, g: 0, R: 0 }; for (const t of arr) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const l1 = (lbl, arr) => arr.length
  ? `   ${lbl.padEnd(40)}${String(arr.length).padStart(6)}  ${wr(agg(arr)).toFixed(2).padStart(6)} %  ${agg(arr).R.toFixed(1).padStart(8)} R  ${(agg(arr).R / arr.length).toFixed(4).padStart(8)}  σ ${sg(agg(arr)).toFixed(1).padStart(5)}`
  : `   ${lbl.padEnd(40)}     — (case vide)`;

function passe(live) {
  // ⚠⚠ ON COMPTE CE QU'ON JETTE : un capteur manquant n'est PAS un « non » — le confondre avec un
  //   `false` remplirait les cases de complement avec des trades ILLISIBLES.
  const lisible = EXH.filter((t) => [rsiOr(t, live), drsiOr(t, live), kOr(t), kdOr(t)].every((x) => Number.isFinite(x)));
  const A = (t) => kOr(t) > K_MIN && kdOr(t) < 0;                     // le stoch roule depuis le haut
  const B = (t) => rsiOr(t, live) < RSI_MAX && drsiOr(t, live) >= 0;  // le RSI a de la place ET pousse
  const AB = lisible.filter((t) => A(t) && B(t));
  const AnB = lisible.filter((t) => A(t) && !B(t));
  const nAB = lisible.filter((t) => !A(t) && B(t));
  const nAnB = lisible.filter((t) => !A(t) && !B(t));
  return { lisible, A, B, AB, AnB, nAB, nAnB };
}

console.log(`\n══ RANG ① — DIVERGENCE RSI vs %K (H1) ══`);
console.log(`   MIN_EXH ${MIN_EXH} · capacite ${MAXOPEN}/${MAXPERSYMBOL} · NO_TRIGGER=1`);
console.log(`   A = « le stoch roule depuis le haut » : kOr > ${K_MIN} ET (K−D)Or < 0`);
console.log(`   B = « le RSI a de la place et pousse » : rsiOr < ${RSI_MAX} ET dRSIOr ≥ 0`);
console.log(`   (Or = oriente cote fade : SELL tel quel, BUY en miroir 100−x / −x)`);

for (const live of [false, true]) {
  const { lisible, A, B, AB, AnB, nAB, nAnB } = passe(live);
  console.log(`\n   ${"═".repeat(88)}`);
  console.log(`   HORLOGE ${live ? "LIVE (`_s0`) — BRAS DE CONTROLE" : "CLOTURE (bare) — CELLE QUE LE RANG ① LIT"}`);
  console.log(`   tirs EXH ${EXH.length} · lisibles ${lisible.length}` + (EXH.length !== lisible.length ? `  ⚠ ${EXH.length - lisible.length} EXCLUS (capteur absent), non ranges en « non »` : ""));
  console.log(`   ${"case".padEnd(40)}${"tirs".padStart(6)}      WR         R     R/tir      σ/BE`);
  console.log(l1(`⭐ A ET B — LA DIVERGENCE (figure owner)`, AB));
  console.log(l1(`   A ET NON-B — stoch roule, RSI d'accord`, AnB));
  console.log(l1(`   NON-A ET B — RSI pousse, stoch muet`, nAB));
  console.log(l1(`   NON-A ET NON-B — ni l'un ni l'autre`, nAnB));
  console.log(l1(`   ── A (stoch roule), tous B confondus`, lisible.filter(A)));
  console.log(l1(`   ── B (RSI pousse), tous A confondus`, lisible.filter(B)));
  console.log(l1(`   ── TOUT LE RANG ①`, lisible));
  if (!live) {
    // ⭐⭐⭐ PAR COTE : un ecart qui change de SIGNE entre les cotes est invisible dans l'agregat.
    console.log(`\n   ── LA DIVERGENCE, PAR COTE ──`);
    for (const c of ["BUY", "SELL"]) {
      const p = AB.filter((t) => t.side === c), q = lisible.filter((t) => t.side === c);
      console.log(`      ${c.padEnd(5)} divergence ${String(p.length).padStart(4)} / ${wr(agg(p)).toFixed(2).padStart(6)} %   ·   rang ① du cote ${String(q.length).padStart(4)} / ${wr(agg(q)).toFixed(2)} %   ⇒ ecart ${(wr(agg(p)) - wr(agg(q))).toFixed(2)} pt`);
    }
    // ⭐ « dRSI up » et « dRSI flat » ne sont pas la meme chose — l'owner les groupe, on VERIFIE.
    console.log(`\n   ── DANS LA DIVERGENCE : dRSI qui MONTE vs dRSI PLAT (|dRSI| ≤ ${DFLAT}) ──`);
    console.log(l1(`      dRSI MONTE (> ${DFLAT})`, AB.filter((t) => drsiOr(t, false) > DFLAT)));
    console.log(l1(`      dRSI PLAT (0 ≤ dRSI ≤ ${DFLAT})`, AB.filter((t) => drsiOr(t, false) <= DFLAT)));
    // ⭐ LA QUEUE, pas la moyenne — c'est le juge d'une regle de PROTECTION.
    const parJour = new Map();
    for (const t of AB) { const j = `${t.asset ?? t.symbol}|${String(t.tsMT ?? "").slice(0, 10)}`; const o = parJour.get(j) ?? { n: 0, g: 0 }; o.n++; if ((t.R ?? 0) > 0) o.g++; parJour.set(j, o); }
    const pires = [...parJour.entries()].filter(([, o]) => o.n >= 3).sort((x, y) => (x[1].g / x[1].n) - (y[1].g / y[1].n)).slice(0, 6);
    console.log(`\n   pires grappes de la divergence (actif|jour, n≥3) : ${pires.map(([j, o]) => `${j} ${o.g}/${o.n}`).join("  ·  ") || "(aucune)"}`);
    console.log(`   grappes de la divergence : ${parJour.size}  ·  tirs ${AB.length}  ⇒  ${(AB.length / (parJour.size || 1)).toFixed(2)} tirs/grappe`);
    // ⭐⭐⭐ LE CRIBLE DECISIF, AUTOMATIQUE — « une regle candidate doit survivre au retrait de sa
    //   PIRE grappe ; si elle s'INVERSE, ce n'etait pas une regle ». Cinq candidats du depot sont
    //   morts ici, chaque fois sur UNE journee d'UN actif. On le CALCULE au lieu de le deriver.
    // ⚠ « pire » = celle qui apporte le PLUS DE PERTES, pas le plus mauvais taux : une grappe 0/2
    //   a un taux pire qu'une 0/10 et ne pese rien.
    const jourDe = (t) => `${t.asset ?? t.symbol}|${String(t.tsMT ?? "").slice(0, 10)}`;
    const pertesPar = new Map();
    for (const t of AB) if ((t.R ?? 0) <= 0) pertesPar.set(jourDe(t), (pertesPar.get(jourDe(t)) ?? 0) + 1);
    const pire = [...pertesPar.entries()].sort((a, b) => b[1] - a[1])[0];
    console.log(`\n   ── CRIBLE : LA FIGURE SURVIT-ELLE AU RETRAIT DE SA PIRE GRAPPE ? ──`);
    if (!pire) { console.log(`      (aucune perte dans la case — rien a retirer)`); }
    else {
      const reste = AB.filter((t) => jourDe(t) !== pire[0]);
      const a0 = agg(AB), a1 = agg(reste);
      console.log(`      pire grappe : ${pire[0]}  (${pire[1]} pertes sur ${AB.filter((t) => jourDe(t) === pire[0]).length} tirs de la case)`);
      console.log(l1(`      AVEC elle`, AB));
      console.log(l1(`      SANS elle`, reste));
      const d = wr(a1) - wr(a0);
      const moy = wr(agg(lisible));
      console.log(`      ⇒ ${d >= 0 ? "+" : ""}${d.toFixed(2)} pt · moyenne du rang ① ${moy.toFixed(2)} %` +
        `  ⇒  ${wr(a1) >= moy ? "⛔ LA FIGURE S'INVERSE (elle passe AU-DESSUS de la moyenne) — CE N'ETAIT PAS UNE REGLE"
                              : "✅ elle reste sous la moyenne du rang"}`);
      // ⭐ Et le meme crible sur la sous-bande PLAT, la ou le degat etait concentre.
      const plat = AB.filter((t) => drsiOr(t, false) <= DFLAT);
      const platR = plat.filter((t) => jourDe(t) !== pire[0]);
      console.log(l1(`      sous-bande dRSI PLAT — AVEC`, plat));
      console.log(l1(`      sous-bande dRSI PLAT — SANS`, platR));
      // ⭐⭐⭐ 2e CRIBLE, ET IL DOIT ETRE PASSE **APRES** LE RETRAIT : si la pire grappe est d'UN
      //   seul cote, l'asymetrie BUY/SELL qu'on lit AVANT elle est la grappe, pas une saison.
      //   « les deux cotes doivent bouger dans le MEME sens » — sinon ce n'est pas une regle.
      console.log(`      composition de la pire grappe : ${["BUY", "SELL"].map((c) => `${c} ${AB.filter((t) => jourDe(t) === pire[0] && t.side === c).length}`).join(" · ")}`);
      for (const c of ["BUY", "SELL"]) {
        const av = AB.filter((t) => t.side === c), ap = reste.filter((t) => t.side === c);
        const ref = wr(agg(lisible.filter((t) => t.side === c)));
        if (!av.length) { console.log(`      ${c.padEnd(5)} (case vide)`); continue; }
        const dAp = ap.length ? (wr(agg(ap)) - ref) : NaN;
        console.log(`      ${c.padEnd(5)} AVEC ${String(av.length).padStart(4)} / ${wr(agg(av)).toFixed(2).padStart(6)} %` +
          `   SANS ${String(ap.length).padStart(4)} / ${(ap.length ? wr(agg(ap)).toFixed(2) : "—").padStart(6)} %` +
          `   · rang ① ${c} ${ref.toFixed(2)} %  ⇒ ecart APRES retrait ${Number.isFinite(dAp) ? (dAp >= 0 ? "+" : "") + dAp.toFixed(2) + " pt" : "—"}`);
      }
    }
  }
}
console.log(`\n   ⚠ point mort 75,0 %.\n`);
