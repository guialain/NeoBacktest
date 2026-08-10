// _score_deciles.mjs — LE WR PAR DÉCILE DE |score EXH|, DEPUIS ZÉRO — pas depuis le seuil.
//   Usage: npx vite-node stats/_score_deciles.mjs
//
// ⭐⭐ POURQUOI DEPUIS ZÉRO. Toutes les mesures « WR par score » du dépôt partaient de la population
//   QUI A TIRÉ, donc de `|score| ≥ MIN_EXH`. Elles ne pouvaient donc PAS répondre à la seule
//   question qui compte pour un seuil : **ce qui est en dessous est-il moins bon ?** Un seuil ne se
//   juge pas sur ce qu'il garde, il se juge sur la FRONTIÈRE.
//   Ici on prend toutes les barres où l'EXH a un avis (`ghostAllExh`), on les simule, et on découpe
//   en DÉCILES de |score| de 0 au maximum. Le seuil moteur n'est qu'un REPÈRE tracé dans le tableau.
//
// ⚠ Fantômes : ils ne prennent aucune place au carnet et ne paient pas l'espacement. On mesure la
//   VALEUR INFORMATIVE du score, pas ce que rapporterait de tout prendre.
// ⚠ Déduplication AVANT le walk (`_episodes.mjs`), sinon 5 marches sur 6 sont des clones.
// ⚠ Le repère est le POINT MORT de chaque décile (déduit de ses TP), pas zéro, et le verdict vient
//   de σ. Une pente « à l'œil » sur dix cases bruitées ne prouve rien.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes, cohortStats } from "./_episodes.mjs";
import { MIN_EXH } from "../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const E = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllExh: true, chargeSpread: true });
  const g = (p.ghosts ?? []).filter((c) => c.ghost === "exh-all").map((c) => ({ ...c, asset }));
  for (const c of dedupeEpisodes(g)) {
    const r = p.walk(c);
    if (r && typeof r.R === "number") E.push({ ...c, R: r.R, outcome: r.outcome, reason: r.reason });
  }
}
const pop = E.filter((x) => Number.isFinite(x.exhScore)).map((x) => ({ ...x, v: Math.abs(x.exhScore) }));
const fired = pop.filter((x) => x.fired).length;
console.log(`\n${pop.length} épisodes EXH scorés · ${fired} ont tiré (${(100 * fired / pop.length).toFixed(1)} %) · seuil moteur ${MIN_EXH}\n`);

const srt = [...pop].sort((a, b) => a.v - b.v);
const cut = (i) => srt[Math.min(srt.length - 1, Math.floor(i * srt.length / 10))].v;

console.log("1 · WR PAR DÉCILE DE |score| — le seuil moteur n'est qu'un repère");
console.log(`   ${"décile".padEnd(20)} ${"n".padStart(5)} ${"WR".padStart(7)} ${"marge".padStart(7)} ${"σ".padStart(6)} ${"R/tr".padStart(8)}`);
const rows = [];
for (let i = 0; i < 10; i++) {
  const lo = i === 0 ? -Infinity : cut(i), hi = i === 9 ? Infinity : cut(i + 1);
  const band = srt.filter((x) => x.v >= lo && x.v < hi);
  const s = cohortStats(band); rows.push({ lo, hi, s });
  const mark = (MIN_EXH >= (lo === -Infinity ? 0 : lo) && MIN_EXH < (hi === Infinity ? Infinity : hi)) ? "  ⬅ SEUIL 1,8 ICI" : "";
  const lab = `D${String(i + 1).padStart(2)}  ${(lo === -Infinity ? "0" : lo.toFixed(2))}–${hi === Infinity ? "+" : hi.toFixed(2)}`;
  console.log(`   ${lab.padEnd(20)} ${String(s.n).padStart(5)} ${s.wr.toFixed(2).padStart(7)} ${s.marge.toFixed(2).padStart(7)} ${((s.sig >= 0 ? "+" : "") + s.sig.toFixed(1)).padStart(6)} ${s.rt.toFixed(4).padStart(8)}${mark}`);
}
{
  const a = rows[0].s, z = rows[9].s;
  const se = Math.sqrt(a.se ** 2 + z.se ** 2), d = z.wr - a.wr;
  const mono = rows.every((r, i) => i === 0 || r.s.wr >= rows[i - 1].s.wr - 1e-9);
  // ⚠⚠ CE VERDICT EST INADAPTÉ À LA FORME OBSERVÉE, ET IL FAUT LE DIRE PLUTÔT QUE LE LIRE.
  //   `D10 − D1` teste une RAMPE. Ce que les données montrent est une MARCHE : les huit premiers
  //   déciles sont tous sous le point mort, les deux derniers sont les seuls positifs. Un test
  //   d'extrêmes rend « ne trie pas » sur une marche parfaitement nette — la même faute que juger
  //   un U par sa pente. ⇒ C'est le §2 (au-dessus / en dessous) qui décide, pas cette ligne.
  console.log(`   ⇒ D10 − D1 = ${d.toFixed(2)} pt · ${(d / se).toFixed(1)} σ · ${Math.abs(d / se) < 2 ? "pas de RAMPE" : d > 0 ? "rampe croissante" : "rampe décroissante"}${mono ? " · monotone" : " · NON monotone"}`);
  const neg = rows.filter((r) => r.s.marge < 0).length;
  console.log(`   ⚠ Test de RAMPE, pas de MARCHE : ${neg}/10 déciles sont sous le point mort. Si ce sont`);
  console.log(`     les PREMIERS, la relation est une marche et cette ligne ne la voit pas — lire le §2.`);
}

// ── 2 · CE QUE VAUDRAIT CHAQUE SEUIL — la lecture qui DÉCIDE ──
// ⭐ Un seuil ne se lit pas sur une case mais sur ce qu'il RETIENT et ce qu'il JETTE. Les deux
//   colonnes sont donc cumulées : au-dessus (retenu) et en dessous (jeté).
console.log("\n2 · SI LE SEUIL ÉTAIT ICI — retenu au-dessus / jeté en dessous");
console.log(`   ${"seuil".padEnd(9)} ${"retenu n".padStart(9)} ${"WR".padStart(7)} ${"marge".padStart(7)} ${"σ".padStart(6)}  │ ${"jeté n".padStart(7)} ${"WR".padStart(7)} ${"marge".padStart(7)} ${"σ".padStart(6)}`);
for (let i = 1; i < 10; i++) {
  const t = cut(i);
  const up = cohortStats(srt.filter((x) => x.v >= t)), dn = cohortStats(srt.filter((x) => x.v < t));
  const mark = (t <= MIN_EXH && cut(i + 1) > MIN_EXH) ? "  ⬅ ~seuil actuel" : "";
  console.log(`   ${t.toFixed(2).padEnd(9)} ${String(up.n).padStart(9)} ${up.wr.toFixed(2).padStart(7)} ${up.marge.toFixed(2).padStart(7)} ${((up.sig >= 0 ? "+" : "") + up.sig.toFixed(1)).padStart(6)}  │ ${String(dn.n).padStart(7)} ${dn.wr.toFixed(2).padStart(7)} ${dn.marge.toFixed(2).padStart(7)} ${((dn.sig >= 0 ? "+" : "") + dn.sig.toFixed(1)).padStart(6)}${mark}`);
}
console.log("\n   ⚠ Un seuil ne vaut que si le lot JETÉ est PIRE que le lot RETENU. Si les deux colonnes");
console.log("     se ressemblent, le seuil échantillonne au hasard — il ne filtre rien.");
