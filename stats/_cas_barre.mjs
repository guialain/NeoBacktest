// _cas_barre.mjs — LE DETAIL D'UNE BARRE, TERME A TERME.  `ACTIF=.. JOUR=2026.08.03 H=15,16`
// ⭐⭐⭐ LE FANTOME `boxes` NE PORTE PAS `parts` — et c'est voulu : un fantome doit rester plat
//   (4 Go mesures sinon). On RECONSTRUIT donc les entrees comme `scoringDecision` les construit…
//   ⚠ …et une reconstruction qui derive du moteur est exactement le piege que ce depot documente.
//   ⇒ ON RECOUPE : le total reconstruit doit egaler `pConv` du fantome, barre par barre. Une seule
//   divergence et la fiche est DECLAREE FAUSSE au lieu d'etre lue.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1"; process.env.PB_ISOLE = "1";
process.env.MIN_PB = process.env.MIN_PB ?? "-31";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
const { pbScoreV1 } = await import(M + "pbScoringV1.js");
const { readVetoTfs } = await import(M + "vetoGate.js");

const ACTIF = process.env.ACTIF ?? "AUDUSD";
const JOUR  = process.env.JOUR  ?? "2026.08.03";
const HH    = (process.env.H ?? "15,16").split(",");
const CSV   = path.join("C:/Users/Public/Neo-Backtest/data/matrix", ACTIF + ".csv");

// ── les rows brutes, pour relire les capteurs que le bareme n'utilise PAS (K/D, %D…) ──
const lignes = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/);
const head = lignes[0].split(";");
const rows = new Map();
for (const l of lignes.slice(1)) {
  const c = l.split(";"); const o = {};
  for (let i = 0; i < head.length; i++) o[head[i]] = c[i];
  rows.set(o.timestamp, o);   // ⚠ la colonne s'appelle `timestamp` dans le CSV, `tsMT` dans le moteur
}
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const r = runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true });
const dans = (ts) => String(ts).startsWith(JOUR) && HH.includes(String(ts).slice(11, 13));
const g = (r.ghosts ?? []).filter((x) => x.ghost === "boxes" && dans(x.tsMT));
const sig = (r.signals ?? []).filter((x) => dans(x.tsMT));
const f = (v, d = 2) => (v == null ? "—" : (typeof v === "number" ? (v >= 0 ? "+" : "") + v.toFixed(d) : String(v)));

console.log(`\n══ ${ACTIF} · ${JOUR} · h=${HH.join("/")} ══   ${g.length} barres avec boîte PB · ${sig.length} TIR(S)`);
// ⚠⚠ TROIS COLONNES POUR LE `z`, ET C'EST DELIBERE. La fiche n'en montrait QU'UNE, titree
//   « z_clos », qui etait en fait `u` — le niveau ORIENTE PAR LE COTE (`z x sens`) et pris a la
//   CLOTURE. Elle annoncait donc le `z` et montrait autre chose : sur un SELL le SIGNE etait
//   RETOURNE, et la valeur n'etait pas celle que l'UI affiche (l'UI montre le LIVE).
// ⭐⭐⭐ Un ecart de lecture entre l'operateur et la fiche coute plus cher qu'une colonne en plus :
//   on croit debattre du modele alors qu'on ne regarde meme pas le meme nombre.
// ⚠⚠ MÊME PIÈGE POUR LE `%K`, ET C'EST LA 3ᵉ FOIS DANS LA JOURNÉE : la colonne « ΔK » montrait la
//   FAMILLE ORIENTÉE (`DOWN`) sous un nom qui se lit comme la BANDE BRUTE (`SOFT_UP`). L'owner lit
//   la brute dans l'UI, la fiche affichait l'orientée — on croit se contredire alors qu'on nomme
//   deux choses différentes pareil. ⇒ Les DEUX, toujours, avec la flèche entre.
// 🔴 Et l'écart entre les deux colonnes EST une information : `FAST_UP` et `SOFT_UP` tombent dans la
//   même famille `DOWN`, donc la même note. L'axe ΔK est encore replié en 3, là où le `z` a été
//   déplié en 7 le 10/08 — le défaut réparé d'un côté est resté de l'autre.
console.log("\n  ⚠ NOTES ET TOTAL DANS LE REPÈRE SIGNÉ (négatif = SELL) — pas en « qualité ».");
console.log("  heure  côté |  z clôt   z live |     u    Δu  colonne        note |  %K cl  %K live |  kOr  ΔK brute → fam  note | dominance      note | repli app |  TOT");
let ecarts = 0;
for (const x of g) {
  const row = rows.get(x.tsMT); if (!row) continue;
  const v = readVetoTfs(row);
  const zC = num(row.zscore_h1), zL = num(row.zscore_h1_s0);
  const res = pbScoreV1({ zH1Closed: zC, dZH1Live: (zC != null && zL != null) ? zL - zC : null,
    kH1Closed: v.h1?.kClosed ?? null, dKBandH1Live: v.h1?.dKBand ?? null,
    diGapBandH1Live: v.h1?.gapBand ?? null,
    highD1Live: num(row.high_d1_s0), lowD1Live: num(row.low_d1_s0), prixLive: num(row.price),
    side: x.side });
  // ⚠ `res.total` sort SIGNE PAR LE COTE (contrat de `pbScoringV1`) alors que `pConv` est la
  //   QUALITE designee. On compare donc ce qui est comparable, sinon la fiche crie au loup sur
  //   tous les SELL — vecu le 10/08, et ca ressemblait a une vraie divergence.
  const p = res.parts;
  // ⚠⚠ 4ᵉ FOIS : LES NOTES AUSSI ONT DEUX REPERES. Le bareme les calcule en QUALITE
  //   (`+10 = ca aide mon cote`) puis signe le TOTAL par le cote. L'owner, lui, lit le repere
  //   SIGNE — « marche baissier, les vendeurs dominent, l'ADX doit valoir −10 ». Les deux sont
  //   justes ; n'en afficher qu'un fait croire a une faute de signe dans le modele.
  //   ⇒ La fiche montre le SIGNE (le repere de lecture) et rappelle la qualite entre parentheses.
  const sg = x.side === "BUY" ? 1 : -1;
  const q = (v) => (v == null ? null : v * sg);
  const totQ = res.total == null ? null : (x.side === "BUY" ? res.total : -res.total);
  const ok = totQ === (x.pConv ?? null);
  if (!ok) ecarts++;
  console.log("  " + String(x.tsMT).slice(11, 16) + " " + x.side.padEnd(5)
    + "| " + f(zC).padStart(7) + " " + f(zL).padStart(8)
    + " | " + f(p.u).padStart(5) + " " + f(p.du).padStart(5) + "  " + String(p.colZ ?? "—").padEnd(14) + f(q(p.z), 0).padStart(4)
    + " | " + f(num(row.stoch_k_h1_s1), 1).padStart(6) + " " + f(num(row.stoch_k_h1_s0), 1).padStart(7)
    + " | " + f(p.kOr, 1).padStart(5) + "  " + String(v.h1?.dKBand ?? "—").padEnd(9) + "→ " + String(p.colK ?? "—").padEnd(5) + f(q(p.k), 0).padStart(5)
    + " | " + String(p.domi ?? "—").padEnd(14) + f(q(p.di), 0).padStart(4)
    + " | " + f(p.repli).padStart(5) + " " + (p.appartient ? "OUI" : " · ")
    + " | " + f(res.total, 0).padStart(4) + (ok ? "" : " 🔴" + f(x.pConv, 0))
    + (sig.some((s) => s.tsMT === x.tsMT) ? "   ◀◀ TIR" : ""));
}
console.log(ecarts ? `\n  🔴 ${ecarts} DIVERGENCE(S) — la fiche ne reproduit pas le moteur, NE PAS LIRE LES COLONNES` : "\n  ✅ fiche = moteur sur toutes les barres");

// ── LES CAPTEURS QUE LE BAREME N'UTILISE PAS — c'est la question de l'owner ──
console.log("\n  ── ce que le barème NE REGARDE PAS ──");
console.log("  heure  |  %K h1   %D h1   K−D  | %K s0  %D s0  K−D  | état KD");
for (const x of g) {
  const row = rows.get(x.tsMT); if (!row) continue;
  const k1 = num(row.stoch_k_h1), d1 = num(row.stoch_d_h1);
  const k0 = num(row.stoch_k_h1_s0), d0 = num(row.stoch_d_h1_s0);
  console.log("  " + String(x.tsMT).slice(11, 16) + "  | " + f(k1, 1).padStart(6) + " " + f(d1, 1).padStart(7) + " " + f(k1 != null && d1 != null ? k1 - d1 : null, 1).padStart(6)
    + " | " + f(k0, 1).padStart(6) + " " + f(d0, 1).padStart(6) + " " + f(k0 != null && d0 != null ? k0 - d0 : null, 1).padStart(6)
    + "  | " + (k0 != null && d0 != null && k1 != null && d1 != null
        ? (Math.abs(k0 - d0) > Math.abs(k1 - d1) ? "DIVERGE" : "converge") : "—")
    + (sig.some((s) => s.tsMT === x.tsMT) ? "   ◀◀ TIR" : ""));
}
for (const s of sig) console.log(`\n  ▶ TIR ${s.tsMT} ${s.side} ${s.strategy} · ${s.outcome ?? "?"} · R ${f(s.R)} · sortie ${s.reason}`);
