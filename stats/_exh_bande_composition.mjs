// _exh_bande_composition.mjs — DE QUOI EST FAIT UN SCORE ? Les 7 entrées du barème recalculées,
//   pour une tranche de `|score|` et un côté. Défaut : `SELL 20-24`, la poche creuse du barème.
//
// 🔴🔥 LA FICHE DE TRADE NE PORTE PAS `sc.parts` — le détail par entrée n'existe nulle part en
//   aval. On le RECALCULE donc à partir des mêmes champs que ceux que `scoringDecision` envoie au
//   barème. ⚠ Et un recalcul est une SECONDE dérivation : s'il diverge, on ventile un score qui
//   n'est pas celui qui a décidé, et rien ne le dirait.
//   ⇒ CONTRÔLE OBLIGATOIRE EN TÊTE : `somme des parts recalculées == sc.exh` sur TOUS les tirs.
//     Il échoue ⇒ on ne lit RIEN de ce qui suit. C'est le prix d'entrée du script.
//
// ⚠ `sc.exh` est le total SIGNÉ (positif = BUY). Pour un SELL, la conviction est `−sc.exh`.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const V1 = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/exhScoringV1.js");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const COTE = String(process.env.COTE ?? "SELL").toUpperCase();
const BANDES = String(process.env.BANDES ?? "15-19,20-24,25-29").split(",")
  .map((b) => b.split("-").map(Number));

let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const EXH = all.filter((s) => s.strategy === "EXH" && (s.outcome === "WIN" || s.outcome === "LOSS")
                           && Number.isFinite(s.sc?.exh));

// Les entrées, reconstruites depuis la FICHE — mêmes champs que `scoringDecision.entreesV1`.
const entrees = (s) => ({
  gapLevelLive: s.gapLevelLive ?? null,
  diBandLive:   s.diGapBandH1 ?? null,
  adxLive:      Number.isFinite(s.adxH1Live) ? s.adxH1Live : null,
  kH1Live:      Number.isFinite(s.kH1) ? s.kH1 : null,
  kH4Live:      Number.isFinite(s.kH4) ? s.kH4 : null,
  rsiM15Live:   Number.isFinite(s.rsiM15Live) ? s.rsiM15Live : null,
  dRsiH1Live:   Number.isFinite(s.dRsiH1Live) ? s.dRsiH1Live : null,
  side:         s.side,
});
const NOMS = ["gap", "di", "adx", "kH1", "kH4", "rsiM15", "dRsi"];

// ══ LE CONTRÔLE D'ENTRÉE ══════════════════════════════════════════════════════════════════════
let ko = 0, exemple = null;
for (const s of EXH) {
  const r = V1.exhScoreV1(entrees(s));
  if (r.total !== s.sc.exh) { ko++; if (!exemple) exemple = { asset: s.asset, ts: s.tsMT, recalc: r.total, fiche: s.sc.exh, parts: r.parts }; }
}
console.log(`══ CONTRÔLE — le recalcul reproduit-il \`sc.exh\` ? ══`);
console.log(`  ${EXH.length - ko}/${EXH.length} tirs identiques` +
  (ko === 0 ? "   ✅ le recalcul EST le score qui a décidé"
            : `   🔴 ${ko} DIVERGENCES — NE RIEN LIRE PLUS BAS\n  ex: ${JSON.stringify(exemple)}`));
// ⚠ 8 tirs sur 2 508 (0,3 %) divergent, et l'ecart vaut exactement 13 = le saut
//   `TENSE_HIGH (-5)` -> `EXTREME (+8)` de la table `gap` : la fiche stocke un `gapLevelLive`
//   qui differe du niveau que le moteur a calcule en direct sur ces barres (frontiere de bande).
//   ⇒ On les EXCLUT et on le DIT, plutot que de ventiler un score qui n'est pas celui qui a decide.
//   🎯 A creuser separement : une fiche qui ne reproduit pas la decision sur 0,3 % des barres est
//   une petite divergence, mais c'est exactement la forme qui grossit sans qu'on la voie.
const DIVERGENT = new Set();
for (const s of EXH) if (V1.exhScoreV1(entrees(s)).total !== s.sc.exh) DIVERGENT.add(s);
const OK = EXH.filter((s) => !DIVERGENT.has(s));

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN };
}
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const somR = (t) => t.reduce((a, b) => a + (b.R || 0), 0);

const cohortes = BANDES.map(([lo, hi]) => ({
  nom: `${lo}-${hi}`,
  t: OK.filter((s) => s.side === COTE && Math.abs(s.sc.exh) >= lo && Math.abs(s.sc.exh) <= hi),
}));

console.log(`\n[POP PROD] [spread FACTURÉ] · EXH ${COTE} · 7 entrées RECALCULÉES\n`);
for (const c of cohortes) {
  const g = grappes(c.t);
  console.log(`  ${c.nom.padEnd(8)} ${String(c.t.length).padStart(4)} tirs (${String(dedupeEpisodes(c.t).length).padStart(3)} ép)  ` +
    `WR ${wr(c.t).toFixed(1)} %  R ${(somR(c.t) >= 0 ? "+" : "") + somR(c.t).toFixed(1)}  | ${g.g} gr. ${g.wr.toFixed(1)} %`);
}

// ══ ① LA COMPOSITION MOYENNE — d'où vient le score dans chaque tranche ? ══════════════════════
// ⭐ ORIENTÉ : on affiche la contribution AU FADE (`−note` côté SELL), donc un nombre POSITIF veut
//   dire « cette entrée pousse le trade », des deux côtés. Sans ça le SELL se lirait en négatif et
//   on comparerait des signes au lieu de comparer des forces.
console.log(`\n══ ① CONTRIBUTION MOYENNE AU FADE (positif = pousse le trade) · muet en % ══`);
console.log("  entrée  " + cohortes.map((c) => c.nom.padStart(16)).join(""));
for (const nom of NOMS) {
  let ligne = "  " + nom.padEnd(8);
  for (const c of cohortes) {
    const vals = [], muets = [];
    for (const s of c.t) {
      const p = V1.exhScoreV1(entrees(s)).parts[nom];
      if (p == null) muets.push(s); else vals.push(COTE === "SELL" ? -p : p);
    }
    const moy = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
    ligne += `${(vals.length ? (moy >= 0 ? "+" : "") + moy.toFixed(2) : "—").padStart(9)}` +
             `${(100 * muets.length / c.t.length).toFixed(0).padStart(4)}%  `;
  }
  console.log(ligne);
}

// ══ ② DANS LA TRANCHE CIBLE : WR PAR VALEUR DE CHAQUE ENTRÉE ══════════════════════════════════
const cible = cohortes[Math.floor(cohortes.length / 2)];
console.log(`\n══ ② TRANCHE ${cible.nom} — WR par NOTE de chaque entrée (note ORIENTÉE au fade) ══`);
for (const nom of NOMS) {
  const par = new Map();
  for (const s of cible.t) {
    const p = V1.exhScoreV1(entrees(s)).parts[nom];
    const k = p == null ? "MUET" : (COTE === "SELL" ? -p : p);
    if (!par.has(k)) par.set(k, []);
    par.get(k).push(s);
  }
  const clefs = [...par.keys()].sort((a, b) => (a === "MUET" ? 1 : b === "MUET" ? -1 : a - b));
  console.log(`  ── ${nom} ──`);
  for (const k of clefs) {
    const t = par.get(k), g = grappes(t);
    console.log(`      note ${String(k).padStart(5)}  ${String(t.length).padStart(4)} tirs  ` +
      `WR ${wr(t).toFixed(1).padStart(5)} %  R ${(somR(t) >= 0 ? "+" : "") + somR(t).toFixed(1).padStart(5)}  ` +
      `| ${String(g.g).padStart(3)} gr. ${g.wr.toFixed(1).padStart(5)} %`);
  }
}
