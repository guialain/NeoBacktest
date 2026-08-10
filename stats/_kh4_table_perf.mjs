// _kh4_table_perf.mjs — LA TABLE `KH4_V1_SELL` CONFRONTÉE À SES PROPRES LIGNES.
//   Chaque ligne du barème, avec ce qu'elle NOTE et ce qu'elle VAUT. Prépare la revue du barème.
//
// 🔴🔥 SUR L'INSTANT DE LECTURE, ET C'EST LE CŒUR DE LA MESURE :
//   l'entrée ④ lit `kH4Live` (`stoch_k_h4_s0`) — c'est CETTE valeur qui choisit la ligne appliquée.
//   Mais le veto `h4-k-saturated-not-returning` et toutes mes mesures du 09/08 lisent le CLÔTURÉ
//   (`stoch_k_h4_s1`). Les deux colonnes sont donc imprimées :
//     · LIVE    = la population que la ligne a RÉELLEMENT notée  ⟵ ce qu'il faut pour juger la table
//     · CLÔTURÉ = la population que la ligne DÉCRIRAIT si on la rebasculait
//   Un écart entre les deux dit que la table note une valeur qui n'est pas celle qui décrit la barre.
//
// ⚠ Les bornes sont LUES sur la table (`KH4_V1_SELL`), jamais recopiées : si l'owner la redicte,
//   cette sonde suit toute seule.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
// ⚠ `SOCLE=1` pour voir la table hors de tout filtrage — les cinq vetos du 09/08 ont DÉJÀ façonné
//   la population prod, donc juger une ligne de barème dessus, c'est la juger sur ce qui a survécu.
const SOCLE = String(process.env.SOCLE ?? "0") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const V1 = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js");
// TABLE=kh4 (defaut) | kh1 — meme sonde, deux entrees du bareme.
//   Les champs de la fiche changent avec l'entree : le %K H1 vit dans `kH1` (LIVE) / `kH1S1`
//   (CLOTURE), le %K H4 dans `kH4` / `kH4S1`. Les tables sont LUES, jamais recopiees.
const QUOI = String(process.env.TABLE ?? "kh4").toLowerCase();
const T = QUOI === "adx"
  // ⚠ L'ADX est une MAGNITUDE : sa table se lit avec `[lo · hi[` partout, PAS avec la bascule a 50
  //   des %K (qui existe parce que leur echelle est symetrique autour de 50). Utiliser `bandeK` ici
  //   deplacerait les bornes au-dessus de 50 sans rien lever. `magnitude: true` porte la difference.
  //   ⚠ Et il n'a PAS de lecture "cloturee" equivalente : l'entree lit `adx14_h1_s0` et la fiche ne
  //   porte que `adxH1Live`. La colonne CLOTURE affiche donc `adx` (= `adx14_h1_c1`) A TITRE DE
  //   COMPARAISON — deux series proches mais pas le meme instant.
  ? { nom: "ADX_V1", SELL: V1.ADX_V1_SELL, BUY: V1.ADX_V1_BUY, live: "adxH1Live", clos: "adx",
      colLive: "adx14_h1_s0", magnitude: true }
  : QUOI === "kh1"
  ? { nom: "KH1_V1", SELL: V1.KH1_V1_SELL, BUY: V1.KH1_V1_BUY, live: "kH1", clos: "kH1S1",
      colLive: "stoch_k_h1_s0" }
  : { nom: "KH4_V1", SELL: V1.KH4_V1_SELL, BUY: V1.KH4_V1_BUY, live: "kH4", clos: "kH4S1",
      colLive: "stoch_k_h4_s0" };

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const OPTS = SOCLE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), OPTS);
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const EXH = all.filter((s) => s.strategy === "EXH");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN };
}
const BE = 75;
function cell(t) {
  if (!t.length) return "        —                    ";
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, sig = (wr - BE) / (Math.sqrt(0.75 * 0.25 / t.length) * 100);
  const gr = grappes(t);
  return `${String(t.length).padStart(4)} ép ${wr.toFixed(1).padStart(5)} %${Math.abs(sig) >= 2 ? "⭐" : " "} ` +
         `R ${(R >= 0 ? "+" : "") + R.toFixed(1).padStart(6)} ${gr.wr.toFixed(1).padStart(5)} %/gr`;
}

// ⚠ MÊME LECTURE DE BANDE QUE LE BARÈME (`bandeK`) : sous 50 `[lo · hi[`, au-dessus `]lo · hi]`.
//   Recopier un `>= lo && < hi` naïf déplacerait le point de bascule d'une borne — c'est la faute
//   réellement commise le 07/08 sur `%K = 12 / 88`, attrapée par le contrôle d'antisymétrie.
const bandeK = (table, v) => {
  if (!Number.isFinite(v)) return null;
  if (T.magnitude) { for (const l of table) if (v >= l[0] && v < l[1]) return l; return null; }
  const haut = v > 50;
  for (const l of table) if (haut ? (v > l[0] && v <= l[1]) : (v >= l[0] && v < l[1])) return l;
  return null;
};

for (const [cote, TABLE] of [["SELL", T.SELL], ["BUY", T.BUY]]) {
  const pop = dedupeEpisodes(EXH.filter((s) => s.side === cote))
    .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");
  const g = grappes(pop);
  // ⚠ LE TITRE EST CONSTRUIT DEPUIS `T.nom` — un libellé écrit en dur aurait annoncé `KH4` au-dessus
  //   de chiffres `KH1` dès le premier usage du paramètre. Vécu ici même : une sortie mal étiquetée
  //   est pire qu'absente, elle se recopie ailleurs.
  console.log(`\n══ TABLE \`${T.nom}_${cote}\` — EXH ${cote} ${SOCLE ? "[SOCLE]" : "[POP PROD]"} ` +
    `· réf ${pop.length} ép ${(100 * pop.filter((x) => x.outcome === "WIN").length / pop.length).toFixed(1)} % ` +
    `(${g.g} gr ${g.wr.toFixed(1)} %) ══`);
  console.log(`  ligne        note │ LIVE \`${T.colLive}\` (ce que la table LIT)  │ CLÔTURÉ \`_s1\``);
  for (const l of TABLE) {
    const [lo, hi, pts] = l;
    const liv = pop.filter((s) => bandeK(TABLE, s[T.live]) === l);
    const clo = pop.filter((s) => bandeK(TABLE, s[T.clos]) === l);
    console.log(`  ${`${lo}-${hi === 101 ? 100 : (hi === Infinity ? "inf" : hi)}`.padEnd(8)} ${(pts >= 0 ? "+" : "") + pts}`.padEnd(19) +
      ` │ ${cell(liv)} │ ${cell(clo)}`);
  }
  const muetL = pop.filter((s) => bandeK(TABLE, s[T.live]) == null).length;
  if (muetL) console.log(`  ⚠ ${muetL} épisode(s) hors table en LIVE ⇒ entrée MUETTE (elle AMPLIFIE les six autres)`);
}
