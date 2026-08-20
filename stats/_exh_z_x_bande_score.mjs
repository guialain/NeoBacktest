// _exh_z_x_bande_score.mjs — `z H1` SEPARE-T-IL ENCORE **A SCORE EGAL** ?
// ============================================================================================
// 🎯 LA QUESTION : `zOr H1 < 2,15` — SEUIL **SIGNE**, oriente cote fade, PAS une valeur absolue —
//   vaut 85,98 % contre 96,58 % au-dessus, soit
//   10,60 pt sur une coupe qui partage le rang ① en deux. Mais la famille `gap` fait 50 a 62 % du
//   score et elle est batie sur `gapAtrH1`, une mesure d'ETIREMENT. Si `z` bas = `gap` bas = score
//   bas, alors on relit le SCORE et l'axe est INERTE (`axe_deja_trie_par_le_routeur_est_inerte`).
//   ⇒ On stratifie PAR BANDE DE SCORE, au pas de 1, et on lit l'ecart DANS chaque bande.
//
// ⭐⭐⭐ LE RESUME STRATIFIE EST LA VRAIE REPONSE, PAS LA MOYENNE BRUTE. On agrege les ecarts
//   intra-bande ponderes par l'effectif de la bande (Mantel-Haenszel) : c'est l'effet de `z` A
//   SCORE CONSTANT. Si l'ecart brut (10,60 pt) s'effondre une fois stratifie, c'etait le score.
// ⚠⚠ ET ON IMPRIME LA COLLINEARITE : la part de `z < seuil` DANS chaque bande. Si elle passe de
//   90 % en bande basse a 10 % en bande haute, les deux axes sont le meme axe et aucune
//   stratification ne sauvera l'ecart — il faut le SAVOIR avant de lire les cases.
//
// ⚠ SAISON — la fenetre est HAUSSIERE (owner, 20/08). Le cote BUY du rang ① fade une BAISSE, donc
//   il est porte par la derive et son WR discrimine mal. On rend donc les deux cotes, mais on ne
//   conclut PAS d'un desaccord BUY/SELL sans regarder si le BUY du test est SOUS les autres BUY.
// ⚠ CAPACITE — a `100/100` (`rejectedCap = 0`) un refus fait un tir EN MOINS, pas un tir REMPLACE.
//   Rien ici ne dit ce qu'une regle RAPPORTERAIT : ca se lit sur un carnet re-couru, pas sur la poche.
// ⚙ Usage : `node stats/_exh_z_x_bande_score.mjs`  ·  `Z_SEUIL=2.15 PAS=1 DEPUIS=16 ZLIVE=1`
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
const Z_SEUIL = envNum("Z_SEUIL", 2.15), PAS = envNum("PAS", 1), DEPUIS = envNum("DEPUIS", 16);
const ZLIVE = envNum("ZLIVE", 0) === 1;
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const EXH = (RUN.signals ?? []).filter((t) => t.strategy === "EXH" && typeof t.R === "number");

const S = (t) => (t.side === "SELL" ? 1 : -1);
const zOr = (t) => { const v = ZLIVE ? t.zscoreH1S0 : t.zscoreH1; return Number.isFinite(v) ? S(t) * v : null; };
const score = (t) => (Number.isFinite(t.sc?.exh) ? Math.abs(t.sc.exh) : null);
const lisible = EXH.filter((t) => Number.isFinite(zOr(t)) && Number.isFinite(score(t)));
const perdus = EXH.length - lisible.length;
const bas = (t) => zOr(t) < Z_SEUIL;
const bande = (t) => Math.floor(score(t) / PAS) * PAS;

const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => 100 * v.g / v.n;

console.log(`\n══ RANG ① — \`z H1\` (${ZLIVE ? "LIVE" : "CLOTURE"}) × BANDE DE SCORE, pas de ${PAS} ══`);
console.log(`   MIN_EXH ${MIN_EXH} · capacite ${MAXOPEN}/${MAXPERSYMBOL} · NO_TRIGGER=1 · seuil SIGNE zOr = ${Z_SEUIL}`);
console.log(`   tirs EXH ${EXH.length} · lisibles ${lisible.length}` + (perdus ? `  ⚠ ${perdus} EXCLUS` : ""));
const A = lisible.filter(bas), B = lisible.filter((t) => !bas(t));
// 🔴🔥⭐⭐⭐ LA DECOMPOSITION QUI MANQUAIT (owner, 20/08) — `zOr < 2,15` EST UN SEUIL **SIGNE**, PAS
//   UNE VALEUR ABSOLUE. Le 1er jet imprimait `zOr < seuil` : etiquette FAUSSE. Le groupe « bas »
//   melange DEUX populations qui n'ont rien a voir :
//     · `0 ≤ zOr < 2,15` — le prix est etire DANS le sens qu'on fade, mais pas assez. C'est la these.
//     · `zOr < 0`        — le prix est etire DE L'AUTRE COTE. On vend un epuisement haussier sur un
//                          prix SOUS sa moyenne. Ce n'est pas « pas assez », c'est « a l'envers ».
//   ⇒ Sans cette ligne, un ecart porte par la 2e poche se lirait comme la 1re. On les separe TOUJOURS.
{
  const neg = lisible.filter((t) => zOr(t) < 0);
  const mou = lisible.filter((t) => zOr(t) >= 0 && zOr(t) < Z_SEUIL);
  const fort = lisible.filter((t) => zOr(t) >= Z_SEUIL);
  console.log(`\n   ── DECOMPOSITION DU GROUPE « z BAS » (le seuil est SIGNE, pas absolu) ──`);
  for (const [lbl, a] of [[`zOr < 0        (etire A L'ENVERS)`, neg],
                          [`0 ≤ zOr < ${Z_SEUIL}   (etire du bon cote, PAS ASSEZ)`, mou],
                          [`zOr ≥ ${Z_SEUIL}       (etire, la these du fade)`, fort]]) {
    if (!a.length) { console.log(`      ${lbl.padEnd(44)}   — (vide)`); continue; }
    console.log(`      ${lbl.padEnd(44)}${String(a.length).padStart(5)} tirs  ${wr(agg(a)).toFixed(2).padStart(6)} %  ${agg(a).R.toFixed(1).padStart(7)} R  ` +
      `score moy ${(a.reduce((x, t) => x + score(t), 0) / a.length).toFixed(2).padStart(5)}  ` +
      `(${(100 * a.length / lisible.length).toFixed(1)} % du rang)`);
  }
  for (const c of ["SELL", "BUY"]) {
    const f = (a) => a.filter((t) => t.side === c);
    console.log(`      ${c.padEnd(5)} : envers ${f(neg).length}/${f(neg).length ? wr(agg(f(neg))).toFixed(2) : "—"} %` +
      `  ·  pas assez ${f(mou).length}/${f(mou).length ? wr(agg(f(mou))).toFixed(2) : "—"} %` +
      `  ·  etire ${f(fort).length}/${f(fort).length ? wr(agg(f(fort))).toFixed(2) : "—"} %`);
  }
}
console.log(`\n   BRUT (non stratifie, groupe « bas » = LES DEUX poches ci-dessus) :`);
console.log(`      zOr <  ${Z_SEUIL}   ${String(A.length).padStart(4)} tirs  ${wr(agg(A)).toFixed(2).padStart(6)} %  ${agg(A).R.toFixed(1).padStart(7)} R   score moyen ${(A.reduce((a, t) => a + score(t), 0) / A.length).toFixed(2)}`);
console.log(`      zOr ≥  ${Z_SEUIL}   ${String(B.length).padStart(4)} tirs  ${wr(agg(B)).toFixed(2).padStart(6)} %  ${agg(B).R.toFixed(1).padStart(7)} R   score moyen ${(B.reduce((a, t) => a + score(t), 0) / B.length).toFixed(2)}`);
console.log(`      ⇒ ecart BRUT ${(wr(agg(A)) - wr(agg(B))).toFixed(2)} pt` +
  `   ⚠ ecart de SCORE MOYEN entre les deux groupes : ${((A.reduce((a, t) => a + score(t), 0) / A.length) - (B.reduce((a, t) => a + score(t), 0) / B.length)).toFixed(2)} pt de score`);

function tableau(nom, pop) {
  console.log(`\n   ${"═".repeat(104)}`);
  console.log(`   ${nom}  —  ${pop.length} tirs / ${wr(agg(pop)).toFixed(2)} %`);
  console.log(`   ${"bande".padEnd(12)}${"zOr < seuil".padStart(22)}${"zOr ≥ seuil".padStart(22)}${"ecart".padStart(10)}${"part z bas".padStart(12)}`);
  const bandes = [...new Set(pop.map(bande))].filter((b) => b >= DEPUIS).sort((a, b) => a - b);
  let numW = 0, den = 0, nUtiles = 0;          // agregation ponderee des ecarts INTRA-bande
  for (const b of bandes) {
    const p = pop.filter((t) => bande(t) === b);
    const a = p.filter(bas), c = p.filter((t) => !bas(t));
    const cel = (x) => (x.length ? `${String(x.length).padStart(4)} / ${wr(agg(x)).toFixed(2).padStart(6)} %` : `   —          `);
    let ec = "     —";
    // ⚠ UN ECART NE SE CALCULE QUE SI LES DEUX CASES EXISTENT. Une bande ou un groupe est vide
    //   n'apporte AUCUNE information sur `z` — l'inclure a 0 diluerait l'effet vers le neutre.
    if (a.length && c.length) {
      const d = wr(agg(a)) - wr(agg(c));
      ec = `${(d >= 0 ? "+" : "") + d.toFixed(2)}`;
      const w = (a.length * c.length) / (a.length + c.length);   // poids Mantel-Haenszel
      numW += w * d; den += w; nUtiles += p.length;
    }
    console.log(`   ${`[${b}·${b + PAS}[`.padEnd(12)}${cel(a).padStart(22)}${cel(c).padStart(22)}${ec.padStart(10)}${(a.length + c.length ? (100 * a.length / (a.length + c.length)).toFixed(0) + " %" : "—").padStart(12)}`);
  }
  const brut = (() => { const a = pop.filter(bas), c = pop.filter((t) => !bas(t)); return (a.length && c.length) ? wr(agg(a)) - wr(agg(c)) : NaN; })();
  console.log(`   ${"─".repeat(104)}`);
  console.log(`   ecart BRUT ${Number.isFinite(brut) ? brut.toFixed(2) : "—"} pt   ⇒   ecart STRATIFIE (a score egal) ` +
    `${den ? (numW / den >= 0 ? "+" : "") + (numW / den).toFixed(2) : "—"} pt   (sur ${nUtiles} tirs de bandes ou les DEUX cases existent)`);
  if (den) {
    const strat = numW / den;
    const garde = Number.isFinite(brut) && brut !== 0 ? 100 * strat / brut : NaN;
    console.log(`   ⇒ la stratification conserve ${Number.isFinite(garde) ? garde.toFixed(0) : "—"} % de l'ecart brut  ` +
      `${Number.isFinite(garde) && garde < 35 ? "⛔ L'AXE EST LARGEMENT LE SCORE — inerte a score egal"
        : Number.isFinite(garde) && garde > 70 ? "✅ L'AXE SURVIT AU CONTROLE PAR LE SCORE" : "🟡 partiel — l'axe et le score se recouvrent"}`);
  }
}
tableau("LES DEUX COTES", lisible);
tableau("SELL", lisible.filter((t) => t.side === "SELL"));
// ⚠ SAISON HAUSSIERE : le BUY fade une baisse, il est porte par la derive. On le rend pour voir si
//   le BUY DU TEST est SOUS les autres BUY — pas pour en tirer une refutation par desaccord.
tableau("BUY  (⚠ saison haussiere — lire « sous les autres BUY ? », pas « d'accord avec le SELL ? »)",
  lisible.filter((t) => t.side === "BUY"));
console.log(`\n   ⚠ point mort 75,0 % · capacite 100/100 ⇒ AUCUNE substitution : ceci ne dit pas ce qu'une regle RAPPORTERAIT.\n`);
