// _kh1_niveau_x_signe.mjs — LE %K H1 NE DIT PAS S'IL MONTE OU S'IL DESCEND.
//   Owner 09/08 : « il faut distinguer deltakh1live < 0 et > 0, sinon on score à l'aveugle sans
//   savoir si le k monte ou descend ». L'entrée ⑤ du barème note un NIVEAU seul : `%K = 82` en
//   train de monter et `%K = 82` en train de retomber reçoivent la MÊME note.
//
// 🔴🔥 LE PIÈGE À CONTOURNER AVANT DE MESURER : `k_s0 = k_s1 + ΔK`.
//   Croiser le niveau **LIVE** avec son propre Δ, c'est croiser une grandeur avec une de ses
//   composantes — un gros ΔK positif POUSSE mécaniquement le niveau dans la bande haute, donc la
//   case « haut ET monte » est en partie FABRIQUÉE par l'algèbre. Mesuré le 09/08 sur ce capteur
//   exact : avec le sélecteur live, `FAST_UP` pesait 32 épisodes à 93,8 % ; avec le sélecteur
//   clôturé, **0 épisode**, et l'ordre des classes s'inversait.
//   ⇒ LES DEUX LECTURES SONT IMPRIMÉES :
//     · LIVE    = ce que la table LIT aujourd'hui. C'est la bonne colonne pour juger la table
//                 TELLE QU'ELLE EST, et la mauvaise pour en déduire une géométrie.
//     · CLÔTURÉ = niveau ÉTABLI × vitesse LIVE, sans terme commun. C'est la bonne colonne pour
//                 décider d'un SECOND AXE, parce que c'est la seule où les deux axes sont
//                 indépendants.
//   L'écart entre les deux EST la taille de l'artefact.
//
// ⭐ ORIENTÉ PAR LE CÔTÉ : `ΔK > 0 orienté` = le %K pousse ENCORE dans le sens que le fade
//   contrarie (il monte pour un SELL, il descend pour un BUY). Sans ça chaque case serait un
//   demi-échantillon et le miroir invérifiable.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const SOCLE = String(process.env.SOCLE ?? "0") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

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
const ep = dedupeEpisodes(all.filter((s) => s.strategy === "EXH"))
  .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function gr(t) {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN;
}
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const somR = (t) => t.reduce((a, b) => a + (b.R || 0), 0);
const cell = (t) => (t.length
  ? `${String(t.length).padStart(3)} ép ${wr(t).toFixed(1).padStart(5)} % ${(somR(t) >= 0 ? "+" : "") + somR(t).toFixed(1).padStart(5)} ${gr(t).toFixed(0).padStart(3)}%g`
  : "      —              ");

// ⭐ Niveau ORIENTÉ (SELL : `k` · BUY : `100 − k`) et Δ ORIENTÉ (positif = pousse dans le sens fadé).
const niv = (s, champ) => (Number.isFinite(s[champ]) ? (s.side === "SELL" ? s[champ] : 100 - s[champ]) : null);
const dOr = (s) => (Number.isFinite(s.dKH1) ? (s.side === "SELL" ? s.dKH1 : -s.dKH1) : null);

const COUPES = String(process.env.COUPES ?? "62,65,70,75,80,85,90,95").split(",").map(Number);
const PLAGES = COUPES.map((c, i) => [c, COUPES[i + 1] ?? 101]);

for (const cote of ["SELL", "BUY"]) {
  const pop = ep.filter((s) => s.side === cote);
  console.log(`\n══ EXH ${cote} ${SOCLE ? "[SOCLE]" : "[POP PROD]"} · réf ${pop.length} ép ` +
    `${wr(pop).toFixed(1)} % (${gr(pop).toFixed(1)} %/gr) ══`);
  console.log("  plage    │ LIVE  ΔK>0 (pousse)      ΔK<0 (revient)   │ CLÔTURÉ  ΔK>0            ΔK<0");
  for (const [lo, hi] of PLAGES) {
    const dans = (champ) => pop.filter((s) => { const v = niv(s, champ); return v != null && v >= lo && v < hi; });
    const L = dans("kH1"), C = dans("kH1S1");
    const up = (t) => t.filter((s) => dOr(s) > 0), dn = (t) => t.filter((s) => dOr(s) <= 0);
    console.log(`  ${(hi === 101 ? `≥ ${lo}` : `${lo}-${hi}`).padEnd(8)} │ ${cell(up(L))} ${cell(dn(L))} │ ${cell(up(C))} ${cell(dn(C))}`);
  }
  // ⭐ LE CUMUL — c'est lui qui dit si le SIGNE porte quelque chose, indépendamment du découpage.
  const U = pop.filter((s) => dOr(s) > 0), D = pop.filter((s) => dOr(s) <= 0);
  console.log(`  ${"TOUT".padEnd(8)} │ ${cell(U)} ${cell(D)} │  (le signe seul, tous niveaux confondus)`);
}
