// _exh_kzone_x_vitesse.mjs — CE QUE LE BARÈME NOTE, EN FACE DE CE QUE ÇA VAUT.
//   Owner 09/08 : « révisons kh1 live zone basse et soft down dans le barème, pareil pour kh4 live
//   basse et flat, les deux exh buy et on fera le miroir ».
//
// ⭐⭐⭐ LA SONDE IMPRIME LA NOTE DU BARÈME DANS CHAQUE CASE. C'est le seul format qui permette de
//   réviser : une grille de WR seule oblige à retrouver la ligne de table à la main, et c'est là
//   qu'on se trompe de bande. Les tables sont IMPORTÉES du moteur, jamais recopiées.
// ⚠ ⑤ `%K H1` est 2D (niveau × groupe de vitesse) · ④ `%K H4` est encore 1D : sa colonne de note
//   est donc CONSTANTE sur une ligne, et c'est précisément la question posée.
//
// 🔴🔥 LES DEUX LECTURES DU NIVEAU SONT IMPRIMÉES, ET IL FAUT LIRE LES DEUX.
//   Le barème lit le niveau en **LIVE** (dictée owner : « le cycle du %K est rapide »). Mais
//   `k_s0 = k_s1 + ΔK` : croiser le niveau LIVE avec le ΔK, c'est croiser une grandeur avec une de
//   ses composantes — un ΔK négatif POUSSE mécaniquement le niveau vers le bas, donc la case
//   « bas ET descend » est en partie FABRIQUÉE par l'algèbre. Mesuré le 09/08 sur ce capteur exact :
//   `FAST_UP` pesait 32 ép à 93,8 % en live, **0 épisode** au clôturé.
//   ⇒ colonne LIVE = ce que la table LIT (bonne pour juger la table telle quelle)
//     colonne CLÔTURÉ = niveau ÉTABLI × vitesse LIVE, sans terme commun (bonne pour REDICTER).
//   L'écart entre les deux EST la taille de l'artefact.
//
// ⚠ ÉPISODES + une voix par grappe. SOCLE par défaut — c'est la population qui juge un barème.
//   Point mort 75,0 %.
//
//   usage : node stats/_exh_kzone_x_vitesse.mjs      ·   SOCLE=0 node … (prod)
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const SOCLE = String(process.env.SOCLE ?? "1") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const V1 = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const OPTS = SOCLE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), OPTS).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const ep = dedupeEpisodes(all.filter((s) => s.strategy === "EXH"))
  .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
const grp = (t) => {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN;
};
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const somR = (t) => t.reduce((a, b) => a + (b.R || 0), 0);
const cel = (t, ref) => {
  if (!t.length) return "     —                ";
  const g = grp(t);
  return `${String(t.length).padStart(3)}ép ${g.toFixed(0).padStart(3)}%g ${((g - ref) >= 0 ? "+" : "") + (g - ref).toFixed(0).padStart(3)} R${(somR(t) >= 0 ? "+" : "") + somR(t).toFixed(0).padStart(4)}`;
};

// ⚠ LES BANDES SONT CELLES DES TABLES, PAS DES ZONES INVENTÉES ICI. `zone BASSE` = `12 < K < 38`,
//   ce que la table ⑤ découpe en `12-20 · 20-25 · 25-38`. On garde ce découpage : réviser une case
//   exige de voir la LIGNE de table, pas une zone qui en recouvre trois.
// ⚠ LES BANDES DÉPENDENT DU CÔTÉ, et ce n'est pas un confort d'affichage : le routeur envoie les
//   EXH BUY dans le BAS de l'échelle et les EXH SELL dans le HAUT. Balayer le bas pour un SELL
//   n'aurait imprimé que des cases vides — et une grille vide se lit comme « pas d'effet » alors
//   qu'elle dit « mauvaise adresse ». C'est le motif `router_tests_never_run`, en version tableau.
const H1_BAS = [[0, 12], [12, 20], [20, 25], [25, 38], [38, 62]];
const H1_HAUT = [[38, 62], [62, 75], [75, 80], [80, 88], [88, 101]];
const H4_BAS = [[0, 10], [10, 15], [15, 20], [20, 25], [25, 75]];
const H4_HAUT = [[25, 75], [75, 80], [80, 85], [85, 90], [90, 101]];
const GRP = ["DOWN", "FLAT", "UP"];

// La note du barème pour une ligne 2D (⑤) ou 1D (④), côté BUY.
const noteH1 = (lo, g) => { const l = V1.KH1_V1_REFERENCE.find(([a]) => a === lo); return l ? l[2][g] : null; };
const TH4 = () => (String(process.env.COTE ?? "BUY").toUpperCase() === "SELL" ? V1.KH4_V1_SELL : V1.KH4_V1_BUY);
const noteH4 = (lo) => { const l = TH4().find(([a, b]) => lo >= a && lo < b); return l ? l[2] : null; };

// ⚠ LE CÔTÉ EST UN PARAMÈTRE. Écrire une table 2D exige de voir les DEUX populations : sur le %K H4
//   une colonne de vitesse peut être VIDE d'un côté (le capteur ne bouge pas assez entre deux
//   relevés), et une case sans population ne se dicte pas — elle se déduit du miroir.
const COTE = String(process.env.COTE ?? "BUY").toUpperCase();
const B = ep.filter((s) => s.side === COTE);
const ref = grp(B);
console.log(`\n═══ EXH ${COTE} · ${SOCLE ? "SOCLE" : "PROD"} · ${B.length} ép · ${wr(B).toFixed(1)} % · réf ${ref.toFixed(1)} %/gr · point mort 75 % ═══`);
console.log(`    cases : n épisodes · WR/grappe · ÉCART à la réf · R      [note] = ce que le barème donne AUJOURD'HUI`);

const HAUT = COTE === "SELL";
for (const [titre, LIGNES, champL, champC, champV, note1D] of [
  ["⑤ %K H1 (table 2D)", HAUT ? H1_HAUT : H1_BAS, "kH1", "kH1S1", "dKBandH1", null],
  ["④ %K H4 (table 1D — la vitesse n'y entre PAS)", HAUT ? H4_HAUT : H4_BAS, "kH4", "kH4S1", "dKBandH4", noteH4]]) {
  for (const [lbl, champ] of [["LIVE — ce que la table LIT", champL], ["CLÔTURÉ — sans terme commun", champC]]) {
    console.log(`\n── ${titre} · ${lbl} ──`);
    console.log("  ligne     │ " + GRP.map((g) => `${g.padEnd(6)}                `).join("│ "));
    for (const [lo, hi] of LIGNES) {
      const L = B.filter((s) => { const v = s[champ]; return Number.isFinite(v) && v >= lo && v < hi; });
      const notes = GRP.map((g) => (note1D ? note1D(lo) : noteH1(lo, g)));
      console.log(`  ${`${lo}-${hi}`.padEnd(9)} │ ` +
        GRP.map((g, i) => `${cel(L.filter((s) => V1.GROUPE_VITESSE(s[champV]) === g), ref)} [${notes[i] == null ? " —" : (notes[i] >= 0 ? "+" : "") + notes[i]}]`).join("│ "));
    }
  }
}

// ⭐ LE DÉTAIL DE `SOFT_DOWN` CONTRE LES DEUX AUTRES VITESSES DESCENDANTES — la dictée nomme
//   `SOFT_DOWN`, or le barème note le GROUPE `DOWN` en bloc. Si les trois bandes divergent, le
//   groupe est le mauvais grain et c'est ça qu'il faut redire.
// ⚠ La zone visée est celle du CÔTÉ : `BASSE` 12-38 pour un BUY, son miroir `62-88` pour un SELL.
const [ZLO, ZHI] = HAUT ? [62, 88] : [12, 38];
console.log(`\n── ⑤ %K H1 · la vitesse DÉPLIÉE (zone ${ZLO}-${ZHI}, niveau LIVE) ──`);
const bas = B.filter((s) => Number.isFinite(s.kH1) && s.kH1 >= ZLO && s.kH1 < ZHI);
for (const b of ["SOFT_DOWN", "FAST_DOWN", "EXPLOSIVE_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"]) {
  const t = bas.filter((s) => s.dKBandH1 === b);
  if (t.length) console.log(`  ${b.padEnd(16)} ${cel(t, ref)}`);
}
console.log(`\n── ④ %K H4 · zone ${ZLO}-${ZHI} (niveau LIVE) × vitesse H4 dépliée ──`);
const basH4 = B.filter((s) => Number.isFinite(s.kH4) && s.kH4 >= ZLO && s.kH4 < ZHI);
for (const b of ["SOFT_DOWN", "FAST_DOWN", "EXPLOSIVE_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"]) {
  const t = basH4.filter((s) => s.dKBandH4 === b);
  if (t.length) console.log(`  ${b.padEnd(16)} ${cel(t, ref)}`);
}
