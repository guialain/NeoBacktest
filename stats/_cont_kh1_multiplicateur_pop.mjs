// _cont_kh1_multiplicateur_pop.mjs — LA POPULATION DES 21 CASES `%K H1 x K−D H1` (owner 16/08).
// ⚠ DESCRIPTIF SEUL. Aucune note dictee, aucun A/B, aucun tir compte.
//
// 🎯 PREREQUIS NOMME : conception « **le H4 SCORE, le H1 MODULE** » — la table `kH1` cesse d'etre
//   une note et devient un **FACTEUR** (`0` annule · `1` laisse passer · `>1` amplifie), lu sur
//   `bande %K H1 x sign(K−D) H1`. Avant de dicter les 21 cases il faut savoir **ou est la
//   population**, et surtout **quelle part du score `kH4` tomberait dans les cases `annule`**.
//   ⛔ Un facteur `0` n'est pas une note basse : il ANNIHILE. Le meme chiffre qui dilue dans une
//   somme detruit dans un produit — c'est pour ca que cette mesure passe AVANT la dictee.
//
// ⚠⚠ REPERE **QUALITE**, LES DEUX COTES DANS LE MEME CADRE. Le SELL est ramene dans le cadre du BUY
//   par la reflexion (bande miroir + colonne miroir), sinon les deux colonnes du tableau ne
//   parleraient pas de la meme figure. ⭐ Les 7 bandes sont SYMETRIQUES autour de 50, donc la
//   reflexion renvoie l'ensemble sur lui-meme et la bande `i` du SELL correspond a la bande `6−i`
//   du BUY. ⚠ « de la place devant » se lit donc DANS LE SENS DU COTE JOUE : bas pour un BUY, haut
//   pour un SELL — c'est la meme case dans le cadre qualite.
//
// ⚠ CLASSIFICATEURS IMPORTES, JAMAIS RECOPIES : `bandeK` (qui porte la bascule a 50), `gapKdCol`
//   (bande morte ±2,1) et `contNoteKh4`. Un barreau recopie rangerait la barre autrement que le moteur.
// ⚠ POPULATION = le RESIDU `rangCont`, PAR COTE, **lignes mortes EXCLUES** (panne broker, 2,99 % du
//   dataset — cf. `_gel_deux_horloges`).
//   usage : node stats/_cont_kh1_multiplicateur_pop.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines";
const { bandeK, gapKdCol, GAP_KD_COLS, GAP_KD_COL_MIRROR } = await import(`${R}/scoring/exhScoringV1.js`);
const { CONT_KH1_TABLE_BUY, CONT_KH1_TABLE_SELL, contNoteKh4 } = await import(`${R}/scoring/contScoringV1.js`);
const { deltaKBand } = await import(`${R}/opportunities/OpportunityDetector.js`);
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const MORT = 5;
const CH = ["stoch_k_h1_s0", "stoch_d_h1_s0", "stoch_k_h1_s1", "stoch_k_h4_s0", "stoch_d_h4_s0", "stoch_k_h4_s1"];
// ══ 🔬 DECOUPE DE MESURE — **PAS UNE DICTEE** (owner 16/08) ═══════════════════════════════════
// ⭐ Demande : scinder `[55·80[`, qui portait a elle seule **41,15 % du score `kH4`** (BUY) — deux
//   fois le « seuil de nuisance ~21 % » nomme dans ce depot. Coupes demandees : 55-65 · 65-75 · 75-85.
// ⚠⚠ ELLES SONT COMPLETEES PAR LEURS MIROIRS, ET CE N'EST PAS UNE LIBERTE : le jeu de bandes doit
//   etre SYMETRIQUE autour de 50, sinon la reflexion ne renvoie pas l'ensemble sur lui-meme et les
//   deux cotes lisent une granularite differente aux extremes — defaut nomme et corrige le 15/08.
//   Les miroirs de 65/75/85 sont 35/25/15. ⇒ 11 bandes, `[45·55[` reste son propre miroir.
// ⚠ La granularite ci-dessous sert a VOIR ou la masse se separe. La table dictee pourra en garder
//   moins — mais elle ne pourra pas en garder d'ASYMETRIQUES.
const CUTS = [0, 10, 15, 25, 35, 45, 55, 65, 75, 85, 90, 101];
const TABLE = CUTS.slice(0, -1).map((lo, i) => [lo, CUTS[i + 1], { i }]);
const N = TABLE.length;                                     // 11 bandes
// ⚠ MIROIR DERIVE EN CODE, meme patron que `CONT_KH1_TABLE_SELL` — jamais ecrit a la main.
// ⚠⚠ LE SELL EST RE-MARQUE **PAR POSITION**, PAS EN TRANSPORTANT LA MARQUE DU BUY. Le miroir fait
//   deja la conversion d'indice ; laisser passer l'objet `{i}` d'origine reviendrait a l'appliquer
//   DEUX FOIS plus bas (`N−1−i`) et a retourner la table sans que rien ne leve — la faute exacte
//   que ce depot nomme « retourner deux fois ». Ici l'indice est POSITIONNEL des deux cotes, et la
//   seule conversion vit a l'endroit ou elle est ecrite.
const T_BUY = TABLE;
const T_SELL = TABLE.map(([lo, hi]) => [100 - hi + (hi === 101 ? 1 : 0), 100 - lo + (lo === 0 ? 1 : 0)])
                    .sort((a, b) => a[0] - b[0])
                    .map(([lo, hi], j) => [lo, hi, { i: j }]);
// 🔴 CONTROLE DE SYMETRIE — si les bornes reflechies ne coincident pas avec les bornes d'origine, la
//   correspondance `bande i du SELL == bande N−1−i du BUY` est FAUSSE et tout le tableau ment.
{
  const bornes = (T) => T.map(([lo, hi]) => `${lo}-${hi}`).join(" ");
  if (bornes(T_BUY) !== bornes(T_SELL))
    throw new Error(`decoupe NON SYMETRIQUE autour de 50 :\n  BUY  ${bornes(T_BUY)}\n  MIR  ${bornes(T_SELL)}`);
}
const LIB = TABLE.map(([lo, hi]) => `[${String(lo).padStart(2)}·${hi === 101 ? 100 : hi}[`);

const vide = () => Array.from({ length: N }, () => ({ KD_POS: 0, CONTACT: 0, KD_NEG: 0 }));
const S = {};
for (const c of ["BUY", "SELL"]) S[c] = { n: 0, muet: 0, pop: vide(), popNote: vide(), somme: vide(), kh4Muet: 0 };
let nGele = 0;

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f);
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const iTs = head.indexOf("timestamp");
  const ix = {}; for (const n of CH) ix[n] = head.indexOf(n);
  const manq = CH.filter((n) => ix[n] < 0); if (manq.length) throw new Error(`${f} : ${manq.join(", ")}`);
  const rows = new Map(), nParTs = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[iTs], c);
    nParTs.set(c[iTs], (nParTs.get(c[iTs]) ?? 0) + 1); }
  const gele = new Set([...nParTs].filter(([, n]) => n >= MORT).map(([t]) => t));

  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes" || !x.rangCont) continue;
    if (gele.has(x.tsMT)) { nGele++; continue; }
    const s = S[x.side]; if (!s) continue;
    const c = rows.get(x.tsMT); if (!c) continue;
    s.n++;
    const num = (k) => { const v = c[ix[k]]; return v === "" || v == null ? null : Number(v); };
    const k1 = num("stoch_k_h1_s0"), d1 = num("stoch_d_h1_s0");
    if (k1 == null || d1 == null) { s.muet++; continue; }
    const cel = bandeK(x.side === "BUY" ? T_BUY : T_SELL, k1);
    if (!cel) { s.muet++; continue; }
    // ⇒ cadre QUALITE : la bande `i` du SELL est l'image de la bande `6−i` du BUY, et la colonne se reflete.
    const iq = x.side === "BUY" ? cel.i : N - 1 - cel.i;
    const col = gapKdCol(k1 - d1);
    const cq = x.side === "BUY" ? col : GAP_KD_COL_MIRROR[col];
    s.pop[iq][cq]++;
    // ── ce que `kH4` note sur cette meme barre : c'est LUI que le facteur multipliera ──
    const k4 = num("stoch_k_h4_s0"), k4p = num("stoch_k_h4_s1");
    const dk4 = (k4 == null || k4p == null) ? null : deltaKBand(k4 - k4p);
    const n4 = contNoteKh4(k4, dk4, x.side);
    if (!Number.isFinite(n4)) { s.kh4Muet++; continue; }
    if (n4 > 0) { s.popNote[iq][cq]++; s.somme[iq][cq] += n4; }
  }
  rows.clear();
}

const pc = (n, t) => (t ? (100 * n / t).toFixed(2) : "0.00") + " %";
console.log(`\n══ RANG ③ · %K H1 × K−D H1 · CADRE QUALITE · residu, lignes mortes exclues (${nGele}) ══`);
for (const cote of ["BUY", "SELL"]) {
  const s = S[cote]; if (!s.n) continue;
  const t = s.n - s.muet;
  const totNote = s.popNote.flatMap((r) => GAP_KD_COLS.map((c) => r[c])).reduce((a, b) => a + b, 0);
  const totScore = s.somme.flatMap((r) => GAP_KD_COLS.map((c) => r[c])).reduce((a, b) => a + b, 0);
  console.log(`\n████ ${cote} — ${t} barres (muettes ${s.muet}) · kH4 muet ${s.kh4Muet} · kH4 > 0 sur ${totNote} (${pc(totNote, t)}) ████`);
  console.log(`\n  ── ① POPULATION des 21 cases (% des ${t} barres) ──`);
  console.log("  bande        " + GAP_KD_COLS.map((c) => c.padStart(11)).join("") + "     ligne");
  for (let i = 0; i < N; i++) {
    const r = s.pop[i], l = GAP_KD_COLS.reduce((a, c) => a + r[c], 0);
    console.log("  " + LIB[i].padEnd(13) + GAP_KD_COLS.map((c) => pc(r[c], t).padStart(11)).join("") + pc(l, t).padStart(11));
  }
  const parCol = { KD_POS: 0, CONTACT: 0, KD_NEG: 0 };
  for (const r of s.pop) for (const c of GAP_KD_COLS) parCol[c] += r[c];
  console.log("  " + "COLONNE".padEnd(13) + GAP_KD_COLS.map((c) => pc(parCol[c], t).padStart(11)).join(""));

  console.log(`\n  ── ② LE SCORE \`kH4\` EN JEU dans chaque case (% du score total, ${totScore.toFixed(0)} pts) ──`);
  console.log(`     ⭐ C'EST CETTE TABLE QUI DÉCIDE : un \`0\` posé sur une case y annule TOUT ce score.`);
  console.log("  bande        " + GAP_KD_COLS.map((c) => c.padStart(11)).join("") + "     ligne");
  for (let i = 0; i < N; i++) {
    const r = s.somme[i], l = GAP_KD_COLS.reduce((a, c) => a + r[c], 0);
    console.log("  " + LIB[i].padEnd(13) + GAP_KD_COLS.map((c) => pc(r[c], totScore).padStart(11)).join("") + pc(l, totScore).padStart(11));
  }
  const parColS = { KD_POS: 0, CONTACT: 0, KD_NEG: 0 };
  for (const r of s.somme) for (const c of GAP_KD_COLS) parColS[c] += r[c];
  console.log("  " + "COLONNE".padEnd(13) + GAP_KD_COLS.map((c) => pc(parColS[c], totScore).padStart(11)).join(""));

  // ══ 🔴🔥⭐⭐⭐ SEPARER LES DEUX CAUSES — la table ② les CONFOND ═══════════════════════════════
  // ⭐⭐⭐ « la case porte plus de score » a DEUX explications qui n'ont pas les memes consequences :
  //     ③ COUVERTURE — la part des barres de la case ou `kH4` note (le reste est a `0`, colonne
  //        `DOWN` du H4, muette sur ses 7 lignes). C'est un effet de POPULATION.
  //     ④ NOTE MOYENNE — combien `kH4` met, sur les barres qu'il note. C'est un effet d'INTENSITE.
  //   ⇒ Si l'alignement vient de ③, le multiplicateur module une COUVERTURE (il croise la meme
  //   question). S'il vient de ④, il module une INTENSITE (deux questions differentes). La forme de
  //   la table dictee n'est pas la meme dans les deux cas — d'ou cette passe AVANT la dictee.
  // ⚠ Une case a faible effectif rend une moyenne instable : `—` sous 30 barres notees, plutot
  //   qu'un chiffre precis et faux (le depot a deja paye « decouper fin FABRIQUE de faux sigma »).
  const cellC = (n, d) => (d >= 30 ? (100 * n / d).toFixed(1).padStart(10) + "%" : "         —");
  const cellM = (n, d) => (d >= 30 ? (n / d).toFixed(2).padStart(11) : "         —");
  console.log(`\n  ── ③ COUVERTURE : part des barres de la case où kH4 > 0 (— si < 30 barres notées) ──`);
  console.log("  bande        " + GAP_KD_COLS.map((c) => c.padStart(11)).join(""));
  for (let i = 0; i < N; i++)
    console.log("  " + LIB[i].padEnd(13) + GAP_KD_COLS.map((c) => cellC(s.popNote[i][c], s.pop[i][c])).join(""));

  console.log(`\n  ── ④ NOTE MOYENNE de kH4 sur les barres notées (amplitude ±10) ──`);
  console.log("  bande        " + GAP_KD_COLS.map((c) => c.padStart(11)).join(""));
  for (let i = 0; i < N; i++)
    console.log("  " + LIB[i].padEnd(13) + GAP_KD_COLS.map((c) => cellM(s.somme[i][c], s.popNote[i][c])).join(""));
}
console.log(`\n  ⚠ Cadre QUALITÉ : \`KD_POS\` = « le %K H1 mène DANS LE SENS DU CÔTÉ JOUÉ », et la bande basse`);
console.log(`     = « de la place devant soi » (donc %K bas pour un BUY, %K HAUT pour un SELL).`);
console.log(`  ⚠ Table ② = la part du score \`kH4\` qui vit dans chaque case — pas un WR, une EXPOSITION.\n`);
