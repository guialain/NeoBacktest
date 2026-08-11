// _pb_kd_dyn.mjs — LA DYNAMIQUE K/D, PAS SON ECART. Regle owner : « %K H1 live FAST UP + KD
//   DIVERGING, ce n'est pas le moment de vendre un pullback ».
// ⭐⭐⭐ ON LIT UNE TRANSITION, PAS UN ETAT — le cycle K/D tourne en ROUE
//   (CROSS → DIVERGING → STABLE → CONVERGING → CONTACT → CROSS). Un etat seul ne dit pas si on
//   ENTRE ou si on SORT de la boucle ; deux etats consecutifs le disent.
// ⚠⚠ `DIVERGING` N'EST PAS SIGNE : il dit que les lignes se sont ECARTEES, jamais DANS QUEL SENS.
//   Filtrer dessus seul bloquerait aussi le miroir. C'est le ΔK qui porte la direction ⇒ la regle
//   de l'owner est une CONJONCTION, et c'est elle qu'on mesure, pas les briques.
// ⚠ Population entiere de la boite, aucun seuil. Une voix par grappe. ~ = moins de 40 grappes.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1"; process.env.PB_ISOLE = "1"; process.env.MIN_PB = "-31";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
const { pbScoreV1, PB_K_GRID } = await import(M + "pbScoringV1.js");
const { readTfs } = await import(M + "vetoGate.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const T = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const actif = path.basename(f, ".csv"), CSV = path.join(DIR, f);
  const L = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/), head = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"), o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = c[i]; rows.set(o.timestamp, o); }
  for (const s of (runMatrixBacktest(CSV, { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals ?? [])) {
    if (s.strategy !== "PB" || (s.outcome !== "WIN" && s.outcome !== "LOSS")) continue;
    const row = rows.get(s.tsMT); if (!row) continue;
    const v = readTfs(row), zC = num(row.zscore_h1), zL = num(row.zscore_h1_s0);
    const r = pbScoreV1({ zH1Closed: zC, dZH1Live: (zC != null && zL != null) ? zL - zC : null,
      kH1Closed: v.h1?.kClosed ?? null, dKBandH1Live: v.h1?.dKBand ?? null,
      diGapBandH1Live: v.h1?.gapBand ?? null, highD1Live: num(row.high_d1_s0),
      lowD1Live: num(row.low_d1_s0), prixLive: num(row.price), side: s.side });
    const b = v.h1?.dKBand ?? null;
    // ⚠ « rapide CONTRE nous » = la bande brute va vers le contre-mouvement, orientee par le cote.
    const monte = b ? b.endsWith("_UP") : null;
    const versNous = monte == null ? null : (s.side === "BUY" ? monte : !monte);
    T.push({ ...s, actif, colK: r.parts.colK, band: b, kOr: r.parts.kOr,
             contreRapide: versNous === false && /^(FAST|EXPLOSIVE)_/.test(b ?? ""),
             prev: v.h1?.kdPrev ?? null, cur: v.h1?.kdCur ?? null });
  }
}
const jour = (s) => String(s.tsMT).slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const R = t.reduce((a, b) => a + (b.R || 0), 0), g = new Map();
  for (const x of t) { const k = x.actif + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length, R }; };
const l = (lbl, t) => { const s = st(t); if (!s) { console.log("  " + lbl.padEnd(38) + "      —"); return; }
  console.log("  " + lbl.padEnd(38) + String(s.n).padStart(6) + s.wrg.toFixed(1).padStart(9) + "%" + String(s.gr).padStart(6)
    + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) + (s.R / s.n).toFixed(3).padStart(8) + (s.gr < 40 ? "  ~" : "")); };
console.log(`\n═══ PB · LA DYNAMIQUE K/D ═══  ${T.length} tirs · point mort 75 %  ·  couverture kdCur : ${T.filter(x=>x.cur).length}`);
console.log("\n  ① L'ÉTAT SEUL (kdCur)                tirs  WR/grap  grap        R   R/tir");
for (const e of [...new Set(T.map((x) => x.cur))].filter(Boolean).sort()) l(e, T.filter((x) => x.cur === e));
console.log("\n  ② LA TRANSITION (kdPrev→kdCur), top 8 par effectif");
const tr = {}; for (const x of T) if (x.prev && x.cur) (tr[x.prev + "→" + x.cur] ??= []).push(x);
for (const [k, v] of Object.entries(tr).sort((a, b) => b[1].length - a[1].length).slice(0, 8)) l(k, v);
console.log("\n  ③ LA RÈGLE OWNER — ΔK RAPIDE CONTRE NOUS  ×  KD DIVERGING");
const CR = T.filter((x) => x.contreRapide);
l("ΔK rapide contre nous (seul)", CR);
l("   × kdCur = DIVERGING", CR.filter((x) => x.cur === "DIVERGING"));
l("   × DIVERGING→DIVERGING", CR.filter((x) => x.prev === "DIVERGING" && x.cur === "DIVERGING"));
l("   × kdCur ≠ DIVERGING", CR.filter((x) => x.cur && x.cur !== "DIVERGING"));
console.log("  ── témoin : DIVERGING sans ΔK rapide contre nous");
l("kdCur = DIVERGING, ΔK autre", T.filter((x) => x.cur === "DIVERGING" && !x.contreRapide));
l("TOUS", T);

// ⭐⭐⭐ ④ VITESSE x NIVEAU (owner) — « k mid fast up diverging n'est PAS k extreme haut fast up
//   diverging : en haut il ne reste plus de place pour acheter, donc on regarde vers le sell MEME
//   si ca diverge ». C'est le principe deja mesure le 06/08 (a SATURATION = epuisement, a MI-COURSE
//   = ca s'installe) et le tri du veto `k-falling-with-room-left` : c'est la PLACE RESTANTE.
// ⚠ `kOr` = %K ORIENTE par le cote. **kOr BAS = la correction est MURE** (= raw %K extreme du cote
//   oppose). C'est le « K extreme haut » de l'owner pour un SELL.
console.log("\n  ④ LA MÊME DYNAMIQUE, PAR NIVEAU DE kOr   (kOr bas = correction MÛRE = place épuisée)");
const zones = [[0, 25, "kOr 0-25   MÛRE, plus de place"], [25, 62, "kOr 25-62  mi-course"],
               [62, 101, "kOr 62-101 à peine commencée"]];
for (const [lo, hi, nom] of zones) {
  const Z = CR.filter((x) => x.kOr != null && x.kOr >= lo && x.kOr < hi);
  if (!Z.length) continue;
  console.log("  ── " + nom + "   (ΔK rapide contre nous : " + Z.length + " tirs)");
  l("      × DIVERGING", Z.filter((x) => x.cur === "DIVERGING"));
  l("      × autre état", Z.filter((x) => x.cur && x.cur !== "DIVERGING"));
}


// ══ ⑤ LA TABLE DE LA FUTURE ENTREE `kd` — `kOr` x ETAT KD ═══════════════════════════════════════
// ⭐⭐⭐ DECISION OWNER : PAS DE 3D. Une SECONDE table 2D qui S'AJOUTE a celle du `%K` (niveau x ΔK),
//   au lieu d'un cube niveau x vitesse x etat (8 x 3 x 5 = 120 cases dont la plupart seraient vides).
//   Deux tables de 40 et 24 cases se relisent ; un cube de 120, non — et une case qu'on ne relit pas
//   est une opinion que personne ne verifie.
// ⚠ MEMES LIGNES que `PB_K_GRID` : coupes PARTAGEES, aucune frontiere neuve a defendre.
// ⚠ On imprime les EFFECTIFS EN GRAPPES a cote de chaque WR : c'est lui qui dit ou on a le DROIT
//   d'ecrire une note. Sous 40 grappes, decouper fin FABRIQUE des sigma (methode 03/08).
const ETATS = ["CROSS", "DIVERGING", "STABLE", "CONVERGING", "CONTACT"];
console.log("\n═══ ⑤ TABLE CANDIDATE `kd` — niveau kOr × état KD ═══   [WR/grappe · grappes · R]");
console.log("  kOr bas = correction MÛRE (le « %K extrême » du côté opposé) · point mort 75,0 %\n");
console.log("  ligne kOr  " + ETATS.map((e) => e.slice(0, 10).padStart(17)).join(""));
for (const [lo, hi] of PB_K_GRID) {
  const Z = T.filter((x) => x.kOr != null && x.kOr >= lo && x.kOr < hi);
  const cells = ETATS.map((e) => {
    const q = st(Z.filter((x) => x.cur === e));
    if (!q) return "        ·        ";
    const w = q.wrg.toFixed(0) + "%", g = String(q.gr), r = (q.R >= 0 ? "+" : "") + q.R.toFixed(0);
    return (w.padStart(5) + " " + g.padStart(4) + " " + r.padStart(5) + (q.gr < 40 ? "~" : " ")).padStart(17);
  });
  console.log("  [" + String(lo).padStart(3) + " " + String(hi).padStart(3) + "]  " + cells.join(""));
}
const tot = ETATS.map((e) => { const q = st(T.filter((x) => x.cur === e));
  return (q ? (q.wrg.toFixed(0) + "% " + String(q.gr).padStart(4) + " " + ((q.R >= 0 ? "+" : "") + q.R.toFixed(0)).padStart(5) + " ") : "  ·  ").padStart(17); });
console.log("  TOUTES     " + tot.join(""));
console.log("\n  ⚠ `~` = moins de 40 grappes — on ne peut PAS y écrire de note.");

// ══ ⑥ LA MESURE DANS LA FORME DU `KD_TABLE` DE L'EXH — TRANSITION x MATURITE ════════════════════
// ⭐⭐⭐ « on a deja fait pour exh » (owner). Le modele est `KD_TABLE[transition][zone]` :
//     · la TRANSITION en ligne, pas l'etat — le cycle tourne en roue, un etat seul ne dit pas si on
//       ENTRE ou si on SORT de la boucle ;
//     · la MATURITE en colonne, avec les coupes PARTAGEES 12 / 38 / 62 / 88 ;
//     · une case ABSENTE = l'expert se TAIT. Jamais `0` — un zero est une OPINION (« ca ne penche
//       plus d'aucun cote »), une absence n'en est pas une. C'est le bug `num("")=0`, deja paye 2x.
// ⭐⭐ Et le motif central de la table EXH est exactement la remarque de l'owner : « ce n'est pas la
//   transition qui porte le sens, c'est son croisement avec la maturite — la meme geometrie vaut un
//   repli sain au milieu du cycle et un RETOURNEMENT au sommet ».
// ⚠ `kOr` = %K ORIENTE : **kOr BAS = correction MURE**. L'echelle de maturite du PB est donc
//   RETOURNEE par rapport a celle de l'EXH — on nomme les colonnes par ce qu'elles VEULENT DIRE
//   pour un pullback, pas par le niveau brut, sinon on relira la table a l'envers dans six semaines.
// ⚠⚠ LE VOCABULAIRE DES ZONES EST CELUI DU DEPOT (`stochZone`, coupes 12 / 38 / 62 / 88), pas des
//   noms inventes. ⭐⭐⭐ MAIS ELLES SONT LUES SUR `kOr`, LE %K **ORIENTE PAR LE COTE** — donc pour un
//   PB SELL, `kOr EXTREME_LOW` correspond au `%K` BRUT **EXTREME_HIGH**. Ecrire la table sur `kOr`
//   evite une seconde table miroir (le miroir vit dans `kOr = 100 - k`, en un seul endroit), au prix
//   de ce retournement de lecture — qu'il faut donc NOMMER ici et pas laisser deviner.
//   ⇒ En clair, cote PULLBACK : `kOr` BAS = la correction est allee au BOUT.
const ZONES = [[0, 12, "kOr XLOW"], [12, 38, "kOr LOW"], [38, 62, "kOr MID"],
               [62, 88, "kOr HIGH"], [88, 101, "kOr XHIGH"]];
const zoneDe = (k) => ZONES.find(([lo, hi]) => k >= lo && k < hi)?.[2] ?? null;
const trans = {};
for (const x of T) if (x.prev && x.cur && x.kOr != null) (trans[x.prev + "→" + x.cur] ??= []).push(x);
console.log("\n═══ ⑥ FORME `KD_TABLE` — TRANSITION × MATURITÉ ═══   [WR/grappe · grappes · R]");
console.log("  point mort 75,0 %  ·  `~` = <40 grappes, on n'y écrit RIEN\n");
console.log("  transition                " + ZONES.map(([, , n]) => n.padStart(16)).join(""));
for (const [k, v] of Object.entries(trans).sort((a, b) => b[1].length - a[1].length)) {
  if (v.length < 150) continue;
  const cells = ZONES.map(([, , n]) => {
    const q = st(v.filter((x) => zoneDe(x.kOr) === n));
    if (!q) return "        ·       ";
    return (q.wrg.toFixed(0) + "% " + String(q.gr).padStart(3) + " " + ((q.R >= 0 ? "+" : "") + q.R.toFixed(0)).padStart(4)
            + (q.gr < 40 ? "~" : " ")).padStart(16);
  });
  console.log("  " + k.padEnd(26) + cells.join(""));
}
console.log("\n  ⚠ Seules les transitions à ≥150 tirs sont affichées — les autres n'autorisent aucune note.");


// ══ ⑦ LA POPULATION PAR ZONE — AVANT DE NOTER, SAVOIR OU ELLE EST ══════════════════════════════
// ⭐⭐⭐ Owner : « pullback avec k extreme low, c'est a oublier ». On verifie POURQUOI : parce que la
//   case est mauvaise, ou parce qu'elle N'EXISTE PAS ? Les deux se corrigent differemment — une
//   case mauvaise se note, une case vide se RETIRE du vocabulaire.
console.log("
═══ ⑦ OÙ EST LA POPULATION ? ═══   kOr = %K ORIENTÉ (bas = correction allée au bout)");
console.log("  zone kOr        tirs    part   grap  WR/grap        R   R/tir");
for (const [lo, hi, nom] of ZONES) {
  const Z = T.filter((x) => x.kOr != null && x.kOr >= lo && x.kOr < hi);
  const q = st(Z);
  if (!q) { console.log("  " + nom.padEnd(14) + "       0"); continue; }
  console.log("  " + nom.padEnd(14) + String(q.n).padStart(6) + (100 * q.n / T.length).toFixed(1).padStart(7) + "%"
    + String(q.gr).padStart(7) + q.wrg.toFixed(1).padStart(8) + "%"
    + ((q.R >= 0 ? "+" : "") + q.R.toFixed(1)).padStart(9) + (q.R / q.n).toFixed(3).padStart(8) + (q.gr < 40 ? "  ~" : ""));
}
