// _exh_di_minus_x_widening.mjs — LE CAMP VENDEUR AU PLAFOND, ET SA PRISE QUI CONTINUE DE SE CREUSER.
//   Owner 09/08 : « wr exh pour di− extrême high et H1 widening→widening ».
//
// ⭐ LA FIGURE : `DI−` en `EXTREME_HIGH` (les vendeurs sont au sommet de leur échelle) ET la
//   dynamique de l'écart DI est `WIDENING` **deux fenêtres de suite** (la prise ne se contente pas
//   de se creuser, elle continue). C'est une figure d'ALIMENTATION, la même famille que
//   `di-domination-still-widening` — mais posée sur le NIVEAU d'un camp, pas sur la bande d'écart.
//
// 🔴🔥 LA TRANSITION EST LUE CLOSE À CLOSE, LES DEUX TERMES. `diGapDynH1` de la fiche vaut
//   `live ?? closes` : parfait pour reproduire le moteur, PIRE CHOIX POSSIBLE pour une transition —
//   on comparerait un état mesuré sur `s0−c1` à un état mesuré sur `c1−c2`. Les DI perdent 13,3 % à
//   chaque ouverture de bougie et **9,1 % des bascules de bande se produisent SANS UN SEUL TICK**,
//   toutes vers le centre. ⇒ `cur = (c1,c2)`, `prev = (c2,c3)`, deux fenêtres comparables.
//
// ⚠⚠ `DI−` N'EST PAS UNE GRANDEUR ORIENTÉE — ET C'EST TOUT L'ENJEU DE CETTE MESURE.
//   `diLevelBand(minusDi)` dit la force des VENDEURS, quel que soit le côté du trade. La figure
//   telle qu'elle est dictée décrit donc « les vendeurs dominent et poussent encore » :
//     · pour un EXH **SELL** (on fade un sommet) c'est le mouvement fadé qui pousse ⇒ figure de DANGER ;
//     · pour un EXH **BUY**  (on fade un creux) c'est le mouvement fadé qui pousse AUSSI ⇒ même sens.
//   Les deux côtés sont donc DÉJÀ dans le même sens sans avoir à replier quoi que ce soit. On sort
//   quand même le MIROIR (`DI+ EXTREME_HIGH`) pour vérifier que la figure décrit une géométrie et
//   non la FENÊTRE — c'est le contrôle qui a disqualifié la vitesse dans `_exh_k_ou_x_vitesse`.
//
// ⭐⭐ DEUX POPULATIONS (`socle_dit_si_vrai_prod_dit_si_utile`). ⚠ ÉPISODES + une voix par grappe.
//   Point mort 75,0 %.
//
//   usage : node stats/_exh_di_minus_x_widening.mjs   ·   SOCLE=1 node …
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
  return { n: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN,
           bas: v.filter((o) => o.w / o.n < 0.75).length };
};
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const somR = (t) => t.reduce((a, b) => a + (b.R || 0), 0);
const cell = (t) => {
  if (!t.length) return "    —                              ";
  const g = grp(t);
  return `${String(t.length).padStart(4)} ép ${wr(t).toFixed(1).padStart(5)} % R ${(somR(t) >= 0 ? "+" : "") + somR(t).toFixed(1).padStart(6)} ` +
         `${String(g.n).padStart(3)}gr ${g.wr.toFixed(1).padStart(5)} % ${String(g.bas).padStart(3)}<BE`;
};

const DYN = ["NARROWING", "STABLE", "WIDENING"];
// ⭐⭐ DEUX LECTURES DE « WIDENING→WIDENING », ET ELLES NE DÉSIGNENT PAS LA MÊME POPULATION.
//   ① `W1` — L'OBSERVABLE SEUL : `Dynamic Gap DI · Δ|écart| · c2 → c1` vaut `WIDENING`.
//      La flèche est celle du capteur lui-même (de la close c2 vers la close c1), pas une
//      transition. 36,1 % des barres.
//   ② `W2` — LA TRANSITION : le capteur valait DÉJÀ `WIDENING` au relevé précédent (`c3 → c2`) et
//      il vaut ENCORE `WIDENING` maintenant. « Ça se creuse, et ça continue. » 12,3 % des barres.
//   ⇒ `W2 ⊂ W1`, et `W1` est trois fois plus peuplé. On imprime les deux : si `W2` ne bat pas `W1`,
//   la persistance n'apporte rien et la figure se dit avec l'observable seul.
const W1 = (s) => s.diGapDynCloseH1 === "WIDENING";
const wxw = (s) => s.diGapDynPrevH1 === "WIDENING" && s.diGapDynCloseH1 === "WIDENING";

for (const [camp, champ] of [["DI−", "diMinusLevelH1"], ["DI+  (miroir de contrôle)", "diPlusLevelH1"]]) {
  console.log(`\n═══ ${camp} × dynamique de l'écart · ${SOCLE ? "SOCLE" : "POP PROD"} · spread FACTURÉ · point mort 75,0 % ═══`);
  for (const cote of ["SELL", "BUY"]) {
    const pop = ep.filter((s) => s.side === cote);
    const g = grp(pop);
    console.log(`\n  ══ EXH ${cote} · réf ${pop.length} ép ${wr(pop).toFixed(1)} % R ${somR(pop).toFixed(1)} · ${g.n} gr ${g.wr.toFixed(1)} %`);
    // ① LE NIVEAU SEUL — sans lui on ne sait pas si la conjonction bat sa propre brique.
    console.log("  ── ① le niveau du camp, SEUL ──");
    for (const b of ["EXTREME_HIGH", "HIGH", "MEDIUM", "LOW", "EXTREME_LOW"]) {
      const t = pop.filter((s) => s[champ] === b);
      if (t.length) console.log(`  ${b.padEnd(14)} ${cell(t)}`);
    }
    // ② LA TRANSITION SEULE, puis la ligne `WIDENING→…` détaillée.
    console.log("  ── ② la transition de la dynamique, SEULE (close à close) ──");
    const w = pop.filter((s) => s.diGapDynPrevH1 === "WIDENING");
    for (const d of DYN) {
      const t = w.filter((s) => s.diGapDynCloseH1 === d);
      if (t.length) console.log(`  ${("WIDENING→" + d.slice(0, 3)).padEnd(14)} ${cell(t)}`);
    }
    console.log(`  ${"W→W (total)".padEnd(14)} ${cell(pop.filter(wxw))}`);
    // ③ LES DEUX CONJONCTIONS, ET LEUR CONTRASTE.
    const X = pop.filter((s) => s[champ] === "EXTREME_HIGH");
    console.log("  ── ③ LES CONJONCTIONS ──");
    for (const [nom, f] of [["① OBSERVABLE c2→c1", W1], ["② TRANSITION W→W", wxw]]) {
      const dans = X.filter(f), hors = pop.filter((s) => !(s[champ] === "EXTREME_HIGH" && f(s)));
      console.log(`  ${nom.padEnd(20)} ${cell(dans)}`);
      if (dans.length && hors.length) {
        const e = grp(dans).wr - grp(hors).wr;
        console.log(`  ${"   → vs le reste".padEnd(20)} ${(e >= 0 ? "+" : "") + e.toFixed(1)} pt/grappe   ` +
                    `(${(wr(dans) - wr(hors) >= 0 ? "+" : "") + (wr(dans) - wr(hors)).toFixed(1)} pt/épisode)`);
        // ⭐ La conjonction bat-elle ses briques ? Sinon elle n'ajoute rien à la meilleure des deux.
        const D = pop.filter(f);
        console.log(`  ${"   → vs ses briques".padEnd(20)} niveau seul ${grp(X).wr.toFixed(1)} %/gr (${X.length} ép) · ` +
                    `dynamique seule ${grp(D).wr.toFixed(1)} %/gr (${D.length} ép)`);
      }
    }
  }
}
