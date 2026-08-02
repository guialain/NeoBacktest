// _coherence_v1.mjs — LE TEST DU §7 : la cohérence multi-actifs trie-t-elle le fade ?
//
// v1 = votes PONDÉRÉS PAR THETA, une voix par famille. Ce que theta apporte et que rien d'autre
// n'a dans ce moteur : une grandeur SIGNÉE, BORNÉE (−90..+90) et normalisée DEUX FOIS —
//   · par le p50 de l'actif  → comparable ENTRE ACTIFS (des rendements bruts ne le sont pas)
//   · par la fraction de jour → comparable ENTRE HEURES (profil |theta| plat à ±5° de 08h à 20h)
// ⭐ Ces deux normalisations sont exactement ce qu'une couche cross-actifs exige, et elles existent
//   déjà. ⚠ sign(theta) ≡ sign(ic) : le gain n'est PAS dans le signe, il est dans la PONDÉRATION.
//
// ⭐ SSOT : theta vient de `computeThetaVector` du moteur, pas d'une recopie de la formule —
//   le dérivé recalculé en parallèle a déjà divergé une fois dans ce dépôt.
// ⚠ La fonction lit `row.timestamp` (heure BROKER) pour la fraction de jour, pas `ts_utc`. On la
//   nourrit telle quelle : reproduire le moteur, pas le corriger. (À signaler, pas à patcher ici.)
import fs from "fs";
import path from "path";
import { computeThetaVector } from "../../Matrix-Revolution/src/components/robot/engines/config/ThetaConfig.js";

const API = "http://localhost:3001/api/matrix";
const DIR = "data/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const GAP = 240, BE = 75;

// riskDir = +1 si l'actif QUI MONTE veut dire « risk-on ». Le FX s'oriente par le DOLLAR :
//   EURUSD↑ = USD faible = risk-on (+1) ; USDJPY↑ = USD fort = risk-off (−1).
const RISK_DIR = { EURUSD: +1, GBPUSD: +1, AUDUSD: +1, USDCAD: -1, USDCHF: -1, USDJPY: -1,
  GERMANY_40: +1, UK_100: +1, US_30: +1, US_500: +1, US_TECH100: +1,
  BTCUSD: +1, ETHUSD: +1, BRENT_OIL: +1, CrudeOIL: +1, GASOLINE: +1 };
// ⚠ GOLD/SILVER ABSENTS VOLONTAIREMENT : l'or a deux rôles (liquidité ET refuge) — il DÉSAMBIGUÏSE
//   le régime, il ne vote pas. COCOA absent : idiosyncratique, une famille à un actif.
const FAM = { EURUSD: "FX", GBPUSD: "FX", AUDUSD: "FX", USDCAD: "FX", USDCHF: "FX", USDJPY: "FX",
  GERMANY_40: "INDEX", UK_100: "INDEX", US_30: "INDEX", US_500: "INDEX", US_TECH100: "INDEX",
  BTCUSD: "CRYPTO", ETHUSD: "CRYPTO", BRENT_OIL: "ENERGY", CrudeOIL: "ENERGY", GASOLINE: "ENERGY" };

// ── theta par actif × barre, via la fonction du moteur ────────────────────────────────────────
const votes = new Map();     // ep -> { famille -> [vote normalisé −1..+1] }
const thetaAt = {};          // asset -> Map(ep -> thetaDayDeg)
let lignes = 0, thetaNull = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const asset = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  const h = L[0].split(";");
  const idx = Object.fromEntries(h.map((c, i) => [c, i]));
  const besoin = ["intraday_change", "timestamp", "ts_utc", "open_d1_s0",
                  "price_d1_s45min", "price_d1_s30min", "price_d1_s15min", "is_active"];
  const m = new Map();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const row = {}; for (const k of besoin) if (idx[k] != null) row[k] = c[idx[k]];
    // marché fermé ⇒ theta serait figé sur la dernière valeur : on n'en fait pas un vote.
    if (row.is_active != null && row.is_active !== "" && Number(row.is_active) === 0) continue;
    const ep = Math.round(Date.parse(row.ts_utc) / 60000); if (!Number.isFinite(ep)) continue;
    lignes++;
    const tv = computeThetaVector(row, asset);
    if (tv.thetaDayDeg == null) { thetaNull++; continue; }
    m.set(ep, tv.thetaDayDeg);
    const fam = FAM[asset]; if (!fam) continue;                      // GOLD/SILVER/COCOA ne votent pas
    const v = (tv.thetaDayDeg / 90) * RISK_DIR[asset];               // −1..+1, orienté risque
    const slot = votes.get(ep) ?? votes.set(ep, {}).get(ep);
    (slot[fam] ??= []).push(v);
  }
  thetaAt[asset] = m;
}
console.log(`barres actives lues ${lignes} · theta non calculé ${thetaNull} (${(100 * thetaNull / lignes).toFixed(1)} %, début de séance < 1h30)`);

// Cohérence = |moyenne des votes de FAMILLE|. Une voix par famille : 16 actifs ne sont pas 16 paris.
const coh = new Map(), dirMacro = new Map();
for (const [ep, fams] of votes) {
  const vf = Object.values(fams).map((a) => a.reduce((x, y) => x + y, 0) / a.length);
  if (vf.length < 3) continue;                                       // au moins 3 familles présentes
  const s = vf.reduce((a, b) => a + b, 0) / vf.length;
  coh.set(ep, Math.abs(s)); dirMacro.set(ep, Math.sign(s));
}
console.log(`cohérence calculée sur ${coh.size} horodatages`);

// ── LES TRADES ────────────────────────────────────────────────────────────────────────────────
const assets = await (await fetch(`${API}/assets`)).json();
const all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || []).filter((s) => typeof s.R === "number").map((s) => {
    const ep = s.openEp ?? s.ep;
    // le trade va-t-il DANS le sens de la macro ? BUY exprime riskDir(actif), SELL l'inverse.
    const rd = RISK_DIR[a] ?? null;
    const sens = rd == null ? null : (s.side === "BUY" ? 1 : -1) * rd;
    const dm = dirMacro.get(ep) ?? null;
    return { R: s.R, out: s.outcome, asset: a, exh: s.type === "EXHAUSTION", ep,
             d: new Date(ep * 60000).toISOString().slice(0, 10),
             h: new Date(ep * 60000).toISOString().slice(11, 13),
             coh: coh.get(ep) ?? null,
             aligne: (sens == null || dm == null || dm === 0) ? null : (sens === dm) };
  }).sort((x, y) => x.ep - y.ep);
  let epi = 0, prev = -Infinity;
  for (const t of mine) { if (t.ep - prev > GAP) epi++; prev = t.ep; t.epi = `${a}|${epi}`; }
  all.push(...mine);
}

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length, l = s.filter((x) => x.out === "LOSS").length;
  const R = s.reduce((a, b) => a + b.R, 0);
  return { n: s.length, ep: new Set(s.map((x) => x.epi)).size, j: new Set(s.map((x) => x.d)).size,
           wr: (w + l) ? w / (w + l) * 100 : 0, rtr: s.length ? R / s.length : 0 };
};
const row = (lbl, s) => {
  const t = stat(s);
  if (!t.n) { console.log(`${lbl.padEnd(30)}       —`); return; }
  const m = t.wr - BE;
  console.log(`${lbl.padEnd(30)} ${String(t.j).padStart(2)}j ${String(t.ep).padStart(4)}ép ${String(t.n).padStart(5)}tr`
    + `  marge ${((m >= 0 ? "+" : "") + m.toFixed(2)).padStart(6)}  R/tr ${t.rtr.toFixed(4).padStart(7)}`
    + `${t.j < 8 ? "  ⚠" : m < 0 ? "  🔴" : ""}`);
};

const avecCoh = all.filter((x) => x.coh != null);
console.log(`\ntrades avec cohérence : ${avecCoh.length}/${all.length} (${(100 * avecCoh.length / all.length).toFixed(1)} %)`);

// ⚠ CONTRÔLE ANTI-RAMPE : si la cohérence monte avec l'heure, c'est encore une horloge déguisée.
console.log(`\n=== CONTRÔLE : la cohérence rampe-t-elle avec l'heure ? (moyenne par heure UTC) ===`);
for (const h of [...new Set(avecCoh.map((x) => x.h))].sort()) {
  const v = avecCoh.filter((x) => x.h === h).map((x) => x.coh);
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  console.log(`${h}h  n=${String(v.length).padStart(5)}  coh moy ${m.toFixed(3)}  ${"█".repeat(Math.round(m * 60))}`);
}

const BANDES = [[0, 0.15], [0.15, 0.30], [0.30, 0.45], [0.45, 0.60], [0.60, 1.01]];
console.log(`\n=== ⭐ LE TEST : marge par bande de COHÉRENCE · point mort ${BE} % ===`);
for (const [lo, hi] of BANDES) {
  const s = avecCoh.filter((x) => x.coh >= lo && x.coh < hi);
  console.log(`-- cohérence ${lo.toFixed(2)}–${hi === 1.01 ? "1,00" : hi.toFixed(2)} · ${(100 * s.length / avecCoh.length).toFixed(1)} % --`);
  row("   EXH", s.filter((x) => x.exh));
  row("   CONT", s.filter((x) => !x.exh));
}
console.log(`-- référence : tout --`);
row("   EXH", avecCoh.filter((x) => x.exh));
row("   CONT", avecCoh.filter((x) => !x.exh));

// ⭐ LA PROJECTION : ce n'est pas la pression qui coûte, c'est d'aller CONTRE elle.
console.log(`\n=== ⭐ COHÉRENCE × ALIGNEMENT DU TRADE (le coût du contre-pied) ===`);
for (const [lo, hi] of BANDES) {
  const s = avecCoh.filter((x) => x.coh >= lo && x.coh < hi && x.aligne != null);
  if (stat(s).n < 50) continue;
  console.log(`-- cohérence ${lo.toFixed(2)}–${hi === 1.01 ? "1,00" : hi.toFixed(2)} --`);
  row("   EXH  AVEC la macro", s.filter((x) => x.exh && x.aligne));
  row("   EXH  CONTRE", s.filter((x) => x.exh && !x.aligne));
  row("   CONT AVEC la macro", s.filter((x) => !x.exh && x.aligne));
  row("   CONT CONTRE", s.filter((x) => !x.exh && !x.aligne));
}

console.log(`\n=== STABILITÉ — chaque bande sur les deux fenêtres ===`);
for (const [lo, hi] of BANDES) {
  const s = avecCoh.filter((x) => x.coh >= lo && x.coh < hi);
  console.log(`-- cohérence ${lo.toFixed(2)}–${hi === 1.01 ? "1,00" : hi.toFixed(2)} --`);
  row("   EXH  calibrage", s.filter((x) => x.exh && x.d <= IN_END));
  row("   EXH  vérif", s.filter((x) => x.exh && x.d >= OOS_START));
  row("   CONT calibrage", s.filter((x) => !x.exh && x.d <= IN_END));
  row("   CONT vérif", s.filter((x) => !x.exh && x.d >= OOS_START));
}
// Le geste candidat : au-dessus du croisement, la CONT passe devant. Ce qu'il pèse.
console.log(`\n=== LE CROISEMENT À 0,30 — ce que pèserait un basculement d'arbitrage ===`);
for (const [lbl, f] of [["sous 0,30", (x) => x.coh < 0.30], ["au-dessus de 0,30", (x) => x.coh >= 0.30]]) {
  const s = avecCoh.filter(f);
  console.log(`-- ${lbl} · ${(100 * s.length / avecCoh.length).toFixed(1)} % du carnet --`);
  row("   EXH", s.filter((x) => x.exh));
  row("   CONT", s.filter((x) => !x.exh));
  row("   EXH  calibrage", s.filter((x) => x.exh && x.d <= IN_END));
  row("   EXH  vérif", s.filter((x) => x.exh && x.d >= OOS_START));
  row("   CONT calibrage", s.filter((x) => !x.exh && x.d <= IN_END));
  row("   CONT vérif", s.filter((x) => !x.exh && x.d >= OOS_START));
}
