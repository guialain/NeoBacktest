// v1_score_wr.mjs — LE BARÈME EXH v1 CONFRONTÉ AU CARNET : WR par score, EXH BUY et EXH SELL.
// ============================================================================================
// ⭐⭐⭐ CE QUE CE SCRIPT MESURE, ET CE QU'IL NE MESURE PAS. Il ne teste PAS « le barème gagne-t-il
//   de l'argent » — le carnet vient d'un montage `moteur éteint + bonus 2000`, donc la population
//   n'est pas celle de la prod. Il teste UNE SEULE CHOSE : **le score TRIE-T-IL ?** Une WR qui monte
//   avec le score = le barème ordonne. Une WR plate = il ne dit rien, quelle que soit sa moyenne.
//
// 🔴🔥 LE SCORE EST LU **ORIENTÉ**, ET C'EST OBLIGATOIRE POUR COMPARER LES DEUX CÔTÉS. Le barème est
//   signé au sens du MARCHÉ (`>0` = acheter) : la cellule EXH SELL tire sur `total < −seuil`. Lire la
//   colonne brute mettrait les bons SELL en bas du tableau et les bons BUY en haut — les deux côtés
//   s'ANNULERAIENT dans un agrégat. ⇒ `oriente = BUY ? total : −total` = « à quel point la cellule
//   aime CE trade », croissant des deux côtés. C'est la faute du 06/08 (`FAST_DOWN` à 100 % sur un
//   demi-échantillon) transposée au score.
//
// 🔴🔥 UNE VOIX PAR GRAPPE. `spacing=false` produit des dizaines de tirs quasi identiques par
//   actif×jour : 20 185 tirs = 222 grappes ⇒ **σ gonflé ×9** si on compte par tir. Le σ publié ici
//   est calculé sur les MOYENNES DE GRAPPE (actif×jour), jamais sur les tirs.
// ⚠ Le WR, lui, reste le WR par tir — c'est la grandeur qu'on compare aux 75,0 % de point mort. Le σ
//   dit seulement à quel point ce WR est fragile.
//
// ⚠ SPREAD FACTURÉ. Point mort **75,0 %**. Un WR de bande sous 75 % perd de l'argent même s'il a
//   l'air haut.
import fs from "fs";
import { exhScoreV1 } from "../../Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js";

const API = "http://localhost:3001/api/matrix";
const RUN = "maxOpen=100000&cadenceMin=2&spacing=false&chargeSpread=true";

const assets = await (await fetch(`${API}/assets`)).json();
const tirs = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?${RUN}`)).json();
  if ((j.summary?.rejectedCap ?? 0) || (j.summary?.rejSpacingTotal ?? 0))
    throw new Error(`${a}: la capacité mord (cap ${j.summary.rejectedCap} · spacing ${j.summary.rejSpacingTotal})`);
  for (const s of j.signals || []) {
    if (s.strategy !== "EXH") continue;
    if (s.outcome !== "WIN" && s.outcome !== "LOSS") continue;
    // ⚠ LES SIX ENTRÉES, AVEC LEURS NOMS D'INSTANT. Un `s.adx` (clôture) passé à `adxLive` lèverait
    //   le fail-fast du barème ; c'est exactement pour ça qu'il existe.
    const sc = exhScoreV1({
      gapLevelLive: s.gapLevelLive ?? null,
      diBandLive:   s.diGapBandH1 ?? null,
      adxLive:      s.adxH1Live ?? null,
      kH1Live:      s.kH1 ?? null,
      kH4Live:      s.kH4 ?? null,
      rsiM15Live:   s.rsiM15Live ?? null,
      side:         s.side,
    });
    tirs.push({
      asset: a, side: s.side, ep: s.ep, win: s.outcome === "WIN" ? 1 : 0, R: s.R,
      total: sc.total, moyenne: sc.moyenne,
      oriente: sc.total == null ? null : (s.side === "BUY" ? sc.total : -sc.total),
      nMuets: sc.muets.length, muets: sc.muets,
      jour: Math.floor(s.ep / 1440),
    });
  }
}

// ── AGRÉGATION, σ SUR LES GRAPPES ────────────────────────────────────────────────────────────
function bloc(rows) {
  const n = rows.length;
  if (!n) return { n: 0 };
  const wins = rows.reduce((a, r) => a + r.win, 0);
  const R = rows.reduce((a, r) => a + r.R, 0);
  const g = new Map();                                  // grappe = actif × jour
  for (const r of rows) {
    const k = `${r.asset}|${r.jour}`;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(r.win);
  }
  const mg = [...g.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length);
  const mu = mg.reduce((a, b) => a + b, 0) / mg.length;
  const sd = mg.length > 1 ? Math.sqrt(mg.reduce((a, b) => a + (b - mu) ** 2, 0) / (mg.length - 1)) : NaN;
  return { n, grappes: g.size, wr: 100 * wins / n, sigma: 100 * sd / Math.sqrt(g.size), R, rt: R / n };
}

const BORNES = [-Infinity, -20, -10, 0, 10, 20, 30, Infinity];
const libelle = (i) => {
  const lo = BORNES[i], hi = BORNES[i + 1];
  return lo === -Infinity ? `      < ${hi}` : hi === Infinity ? `    >= ${lo}` : `${String(lo).padStart(6)} – ${hi}`;
};
const bande = (v) => { for (let i = 0; i < BORNES.length - 1; i++) if (v >= BORNES[i] && v < BORNES[i + 1]) return i; return null; };

const ligne = (lbl, b) => b.n
  ? `  ${lbl.padEnd(13)} ${String(b.n).padStart(6)} ${String(b.grappes).padStart(6)}  ${b.wr.toFixed(1).padStart(5)} % ±${b.sigma.toFixed(1).padStart(4)}  ${b.R.toFixed(1).padStart(8)}  ${b.rt.toFixed(4).padStart(8)}`
  : `  ${lbl.padEnd(13)}      0`;

const parles = tirs.filter((t) => t.oriente != null);
console.log(`carnet EXH : ${tirs.length} tirs · ${parles.length} scorés · ${tirs.length - parles.length} sans score (toutes entrées muettes)`);
console.log(`spread FACTURÉ — point mort 75,0 %\n`);

for (const [nom, sel] of [["TOUT EXH", parles], ["EXH BUY", parles.filter((t) => t.side === "BUY")],
                          ["EXH SELL", parles.filter((t) => t.side === "SELL")]]) {
  const g = bloc(sel);
  console.log(`── ${nom} — ${g.n} tirs · ${g.grappes} grappes · ${g.wr.toFixed(1)} % · R ${g.R.toFixed(1)}`);
  console.log(`  score orienté  tirs grappes      WR   ±σ         R      R/tir`);
  for (let i = 0; i < BORNES.length - 1; i++)
    console.log(ligne(libelle(i), bloc(sel.filter((t) => bande(t.oriente) === i))));
  console.log("");
}

// ── LE SILENCE : combien d'entrées se taisent, et est-ce que ça change le WR ? ────────────────
console.log("── ENTRÉES MUETTES (un muet SORT du dénominateur et AMPLIFIE les autres)");
const cnt = {};
for (const t of tirs) for (const m of t.muets) cnt[m] = (cnt[m] ?? 0) + 1;
for (const [k, v] of Object.entries(cnt).sort((a, b) => b[1] - a[1]))
  console.log(`  ${k.padEnd(8)} muet sur ${String(v).padStart(6)} tirs  ${(100 * v / tirs.length).toFixed(2)} %`);
console.log("");
console.log("  nb muets   tirs grappes      WR   ±σ         R      R/tir");
for (const k of [0, 1, 2, 3, 4, 5, 6])
  console.log(ligne(`  ${k} muet(s)`, bloc(tirs.filter((t) => t.nMuets === k))));

fs.mkdirSync("analyse_out/v3", { recursive: true });
fs.writeFileSync("analyse_out/v3/v1_scores.jsonl", tirs.map((t) => JSON.stringify(t)).join("\n"));
console.log(`\n→ analyse_out/v3/v1_scores.jsonl (${tirs.length} lignes)`);
