// _score_exh_tri_attrib.mjs — « LE SCORE EXH TRIE » (02/08, 5,7 ET) : ÇA VIENT D'OÙ ?
//   Usage: npx vite-node stats/_score_exh_tri_attrib.mjs
//
// LE CHIFFRE À EXPLIQUER : 02/08 — bas 40 % à 77,11 % contre haut 20 % à 84,01 %, 5,7 ET.
//   C'est CE contraste-là qu'on reproduit (40/20), pas des quintiles : comparer un résultat à un
//   autre découpage, c'est changer la question en croyant y répondre.
//
// TROIS RUNS POUR SÉPARER DEUX CAUSES POSSIBLES :
//   A. moteur du 02/08 (ni spread ni cap) · PAR TIR      → doit reproduire ~77,11 / 84,01 / 5,7 ET
//   B. même moteur                        · PAR ÉPISODE  → isole l'effet du COMPTAGE seul
//   C. moteur d'aujourd'hui (spread+cap+bonus) · ÉPISODE → isole l'effet du MOTEUR
// ⇒ A→B = ce que la déduplication retire. B→C = ce que les changements de moteur ont fait.
//   Sans cette décomposition, on ne peut pas dire si le tri a disparu ou n'a jamais existé.
import fs from "fs";
import path from "path";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort();

function collect(opts) {
  const tirs = [], epi = [];
  for (const f of files) {
    const r = runMatrixBacktest(path.join(MATRIX, f), { maxOpen: 30, cadenceMin: 2, ...opts });
    const seq = {}; const seen = new Set();
    for (const s of (r.signals || [])) {
      if (typeof s.R !== "number" || s.type !== "EXHAUSTION") continue;
      const k = s.side;
      if (seq[k] == null || (s.ep - seq[k].ep) > 60) seq[k] = { ep: s.ep, n: (seq[k]?.n ?? 0) + 1 };
      else seq[k].ep = s.ep;
      const id = `${r.asset}|${k}|${seq[k].n}`;
      const row = { R: s.R, o: s.outcome, rs: s.reason, exh: s.sc?.exh, exhRaw: s.sc?.exhRaw };
      tirs.push(row);
      if (!seen.has(id)) { seen.add(id); epi.push(row); }
    }
  }
  return { tirs, epi };
}

const wrOf = (t) => {
  const w = t.filter((x) => x.o === "WIN").length, l = t.filter((x) => x.o === "LOSS").length;
  const N = w + l, wr = N ? 100 * w / N : NaN, p = wr / 100;
  return { N, wr, se: N ? 100 * Math.sqrt(p * (1 - p) / N) : NaN };
};
// LE CONTRASTE DU 02/08 : bas 40 % contre haut 20 % de |score|.
function contrast(pop, key) {
  const t = pop.filter((x) => Number.isFinite(x[key])).map((x) => ({ ...x, v: Math.abs(x[key]) }));
  const srt = [...t].sort((a, b) => a.v - b.v);
  const c40 = srt[Math.floor(0.40 * srt.length)].v, c80 = srt[Math.floor(0.80 * srt.length)].v;
  const bas = wrOf(t.filter((x) => x.v < c40)), haut = wrOf(t.filter((x) => x.v >= c80));
  const se = Math.sqrt(bas.se ** 2 + haut.se ** 2);
  return { bas, haut, d: haut.wr - bas.wr, sig: se > 0 ? (haut.wr - bas.wr) / se : NaN };
}
const show = (lab, c) => console.log(
  `  ${lab.padEnd(46)} bas40 ${c.bas.wr.toFixed(2)} % (n ${String(c.bas.N).padStart(4)}) · haut20 ${c.haut.wr.toFixed(2)} % (n ${String(c.haut.N).padStart(4)}) · Δ ${c.d.toFixed(2).padStart(5)} pt · ${c.sig.toFixed(1).padStart(4)} σ  ${Math.abs(c.sig) < 2 ? "ne trie pas" : "TRIE"}`);

console.log("\nCible à reproduire (02/08) : bas 40 % 77,11 % · haut 20 % 84,01 % · Δ 6,90 pt · 5,7 ET\n");

const OLD = collect({ spreadCap: false });                       // ni spread ni cap = conditions 02/08
console.log(`A · MOTEUR DU 02/08 (ni spread ni cap) — ${OLD.tirs.length} tirs / ${OLD.epi.length} épisodes`);
show("A1 · score bonifié · PAR TIR", contrast(OLD.tirs, "exh"));
show("A2 · score brut    · PAR TIR", contrast(OLD.tirs, "exhRaw"));
console.log("");
show("B1 · score bonifié · PAR ÉPISODE", contrast(OLD.epi, "exh"));
show("B2 · score brut    · PAR ÉPISODE", contrast(OLD.epi, "exhRaw"));

const NEW = collect({ chargeSpread: true });                     // spread + cap + bonus = aujourd'hui
console.log(`\nC · MOTEUR D'AUJOURD'HUI (spread + cap + bonus M15) — ${NEW.tirs.length} tirs / ${NEW.epi.length} épisodes`);
show("C1 · score bonifié · PAR ÉPISODE", contrast(NEW.epi, "exh"));
show("C2 · score brut    · PAR ÉPISODE", contrast(NEW.epi, "exhRaw"));
console.log("  (pour mémoire, même moteur PAR TIR :)");
show("C3 · score bonifié · PAR TIR", contrast(NEW.tirs, "exh"));

console.log("\n  LECTURE : A→B = ce que la DÉDUPLICATION retire. B→C = ce que le MOTEUR a changé.");
// 🔴🔥 CORRECTION D'UNE IDÉE QUE CE RUN A DÉMENTIE. J'ai d'abord écrit que dédupliquer « ne déplace
//   pas l'effet, seulement la confiance » — c'était vrai sur le contraste Q5−Q1 (4,91 → 4,73) et
//   c'est FAUX ici : sur le contraste 40/20 du 02/08, l'effet CHANGE DE SIGNE (+7,06 → −3,17).
// ⭐⭐ LE MÉCANISME : compter par TIR pondère chaque épisode par SON NOMBRE DE CLONES, et le nombre
//   de clones n'est pas indépendant du résultat — une configuration qui part dans le bon sens
//   continue de tirer et TOUS ses clones gagnent. Le comptage par tir est donc un estimateur
//   BIAISÉ vers les épisodes gagnants, pas seulement un estimateur sur-confiant.
// ⇒ « dédupliquer ne change que σ » est un raccourci FAUX. Il ne tient que quand le facteur de
//   clonage est indépendant de l'issue, ce qu'il faut vérifier et non supposer.
console.log("  🔴 dédupliquer ne retire PAS que la confiance : ici l'effet CHANGE DE SIGNE (+7,06 → −3,17).");
console.log("     Compter par tir pondère chaque épisode par son nombre de clones, et ce nombre");
console.log("     n'est pas indépendant du résultat — un épisode qui gagne continue de tirer.");
