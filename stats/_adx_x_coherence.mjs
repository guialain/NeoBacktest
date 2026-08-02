// _adx_x_coherence.mjs — PRESSION LOCALE × PRESSION GLOBALE : additives ou en INTERACTION ?
//
// Deux lectures concurrentes de la même intuition owner :
//   (A) « arbre Pressure » — ADX et cohérence sont deux pressions qui s'AJOUTENT. Alors l'effet de
//       la cohérence doit être le MÊME à ADX fort et à ADX faible (deux lignes parallèles).
//   (B) « amplitude × attribution » — l'ADX dit qu'il y a un mouvement, la cohérence dit à QUI il
//       appartient. Alors la cohérence doit mordre BEAUCOUP PLUS à ADX fort (interaction).
// La table à quatre cases départage. Ce qu'on lit : l'écart des écarts.
//
// ⚠ Mesuré sur le moteur COMMITÉ (règle adx-45-50 en place) : la cohorte EXH n'a donc pas
//   d'observations en [45,50) hors bord. Trou connu, étroit, signalé — pas corrigé ici.
// ⚠ Effectif réel = JOURNÉES. Quatre cases × deux thèses sur 24 journées : on lit des SIGNES et des
//   ÉCARTS D'ÉCARTS, pas des amplitudes.
import fs from "fs";
import path from "path";
import { computeThetaVector } from "../../Matrix-Revolution/src/components/robot/engines/config/ThetaConfig.js";

const API = "http://localhost:3001/api/matrix";
const DIR = "data/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const GAP = 240, BE = 75;
const COH_SEUIL = 0.30;    // le croisement mesuré
const ADX_SEUIL = 33;      // borne de bande universelle [16·24·33·55]

const RISK_DIR = { EURUSD: +1, GBPUSD: +1, AUDUSD: +1, USDCAD: -1, USDCHF: -1, USDJPY: -1,
  GERMANY_40: +1, UK_100: +1, US_30: +1, US_500: +1, US_TECH100: +1,
  BTCUSD: +1, ETHUSD: +1, BRENT_OIL: +1, CrudeOIL: +1, GASOLINE: +1 };
const FAM = { EURUSD: "FX", GBPUSD: "FX", AUDUSD: "FX", USDCAD: "FX", USDCHF: "FX", USDJPY: "FX",
  GERMANY_40: "INDEX", UK_100: "INDEX", US_30: "INDEX", US_500: "INDEX", US_TECH100: "INDEX",
  BTCUSD: "CRYPTO", ETHUSD: "CRYPTO", BRENT_OIL: "ENERGY", CrudeOIL: "ENERGY", GASOLINE: "ENERGY" };

const votes = new Map();
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const asset = f.replace(/\.csv$/i, ""); if (!FAM[asset]) continue;
  const L = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const idx = Object.fromEntries(h.map((c, i) => [c, i]));
  const cols = ["intraday_change", "timestamp", "ts_utc", "open_d1_s0", "is_active"];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const row = {}; for (const k of cols) if (idx[k] != null) row[k] = c[idx[k]];
    if (row.is_active != null && row.is_active !== "" && Number(row.is_active) === 0) continue;
    const ep = Math.round(Date.parse(row.ts_utc) / 60000); if (!Number.isFinite(ep)) continue;
    const tv = computeThetaVector(row, asset); if (tv.thetaDayDeg == null) continue;
    const slot = votes.get(ep) ?? votes.set(ep, {}).get(ep);
    (slot[FAM[asset]] ??= []).push((tv.thetaDayDeg / 90) * RISK_DIR[asset]);
  }
}
const coh = new Map();
for (const [ep, fams] of votes) {
  const vf = Object.values(fams).map((a) => a.reduce((x, y) => x + y, 0) / a.length);
  if (vf.length >= 3) coh.set(ep, Math.abs(vf.reduce((a, b) => a + b, 0) / vf.length));
}

const assets = await (await fetch(`${API}/assets`)).json();
const all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || []).filter((s) => typeof s.R === "number").map((s) => {
    const ep = s.openEp ?? s.ep;
    return { R: s.R, out: s.outcome, asset: a, exh: s.type === "EXHAUSTION", ep,
             d: new Date(ep * 60000).toISOString().slice(0, 10),
             adx: s.adx, adxM15: s.adxM15, coh: coh.get(ep) ?? null };
  }).sort((x, y) => x.ep - y.ep);
  let epi = 0, prev = -Infinity;
  for (const t of mine) { if (t.ep - prev > GAP) epi++; prev = t.ep; t.epi = `${a}|${epi}`; }
  all.push(...mine);
}

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length, l = s.filter((x) => x.out === "LOSS").length;
  return { n: s.length, ep: new Set(s.map((x) => x.epi)).size, j: new Set(s.map((x) => x.d)).size,
           m: (w + l) ? w / (w + l) * 100 - BE : null };
};
const fmt = (t) => t.n === 0 ? "      —        "
  : `${String(t.j).padStart(2)}j ${String(t.ep).padStart(3)}ép ${String(t.n).padStart(4)}tr ${((t.m >= 0 ? "+" : "") + t.m.toFixed(2)).padStart(6)}${t.j < 8 ? "⚠" : " "}`;

const U = all.filter((x) => x.coh != null && Number.isFinite(x.adx));
console.log(`cohorte : ${U.length} trades avec ADX H1 et cohérence`);

for (const [nomAdx, champ] of [["ADX H1", "adx"], ["ADX M15 (contrôle)", "adxM15"]]) {
  const V = all.filter((x) => x.coh != null && Number.isFinite(x[champ]));
  console.log(`\n${"=".repeat(72)}\n=== 2×2 — ${nomAdx} ≥ ${ADX_SEUIL} × cohérence ≥ ${COH_SEUIL} · marge = WR − ${BE}\n${"=".repeat(72)}`);
  for (const [these, f] of [["EXH", (x) => x.exh], ["CONT", (x) => !x.exh]]) {
    const g = V.filter(f);
    const cell = (aFort, cFort) => stat(g.filter((x) => (x[champ] >= ADX_SEUIL) === aFort && (x.coh >= COH_SEUIL) === cFort));
    const [bb, bh, hb, hh] = [cell(false, false), cell(false, true), cell(true, false), cell(true, true)];
    console.log(`\n${these}                    cohérence < ${COH_SEUIL}          cohérence ≥ ${COH_SEUIL}        Δ (faible − forte)`);
    console.log(`  ADX < ${ADX_SEUIL}         ${fmt(bb)}   ${fmt(bh)}   ${(bb.m != null && bh.m != null) ? ((bb.m - bh.m >= 0 ? "+" : "") + (bb.m - bh.m).toFixed(2)).padStart(7) : "   —"}`);
    console.log(`  ADX ≥ ${ADX_SEUIL}         ${fmt(hb)}   ${fmt(hh)}   ${(hb.m != null && hh.m != null) ? ((hb.m - hh.m >= 0 ? "+" : "") + (hb.m - hh.m).toFixed(2)).padStart(7) : "   —"}`);
    if ([bb, bh, hb, hh].every((t) => t.m != null)) {
      const dLow = bb.m - bh.m, dHigh = hb.m - hh.m;
      console.log(`  ⇒ écart des écarts (interaction) : ${((dHigh - dLow >= 0 ? "+" : "") + (dHigh - dLow).toFixed(2))}`
        + `   — parallèle ⇒ additif (arbre Pressure) · divergent ⇒ interaction (amplitude × attribution)`);
    }
  }
}

// La même chose en bandes fines d'ADX : la forme dit plus que le seuil.
console.log(`\n${"=".repeat(72)}\n=== EXH — marge par bande d'ADX H1, séparément sous et au-dessus du seuil de cohérence\n${"=".repeat(72)}`);
console.log(`bande ADX      cohérence < ${COH_SEUIL}          cohérence ≥ ${COH_SEUIL}          Δ`);
for (const [lo, hi] of [[0, 16], [16, 24], [24, 33], [33, 55], [55, 999]]) {
  const g = U.filter((x) => x.exh && x.adx >= lo && x.adx < hi);
  const b = stat(g.filter((x) => x.coh < COH_SEUIL)), h = stat(g.filter((x) => x.coh >= COH_SEUIL));
  console.log(`${String(lo).padStart(3)}–${hi === 999 ? "∞ " : String(hi).padEnd(2)}       ${fmt(b)}   ${fmt(h)}   `
    + `${(b.m != null && h.m != null) ? ((b.m - h.m >= 0 ? "+" : "") + (b.m - h.m).toFixed(2)).padStart(7) : "   —"}`);
}

console.log(`\n=== STABILITÉ des quatre cases, LES DEUX THÈSES (ADX H1) ===`);
for (const [these, ft] of [["EXH", (x) => x.exh], ["CONT", (x) => !x.exh]]) {
  console.log(`\n-- ${these} --`);
  for (const [lbl, fen] of [["calibrage", (x) => x.d <= IN_END], ["vérif    ", (x) => x.d >= OOS_START]]) {
    const g = U.filter((x) => ft(x) && fen(x));
    const cell = (a, c) => stat(g.filter((x) => (x.adx >= ADX_SEUIL) === a && (x.coh >= COH_SEUIL) === c));
    console.log(`  ${lbl}  ADXfaible/cohfaible ${fmt(cell(false, false))} ADXfaible/cohFORTE ${fmt(cell(false, true))}`);
    console.log(`             ADXfort  /cohfaible ${fmt(cell(true, false))} ADXfort  /cohFORTE ${fmt(cell(true, true))}`);
  }
}

// ── LA CASE PASSAGER, EN FACE À FACE ─────────────────────────────────────────────────────────
// C'est la seule décision candidate : dans cette case, laquelle des deux thèses paie ?
console.log(`\n${"=".repeat(72)}\n=== ⭐ LA CASE PASSAGER — ADX H1 < ${ADX_SEUIL} ET cohérence ≥ ${COH_SEUIL}\n${"=".repeat(72)}`);
const pass = U.filter((x) => x.adx < ADX_SEUIL && x.coh >= COH_SEUIL);
const ligne = (lbl, s) => console.log(`${lbl.padEnd(26)} ${fmt(stat(s))}`);
ligne("EXH  tout", pass.filter((x) => x.exh));
ligne("EXH  calibrage", pass.filter((x) => x.exh && x.d <= IN_END));
ligne("EXH  vérif", pass.filter((x) => x.exh && x.d >= OOS_START));
ligne("CONT tout", pass.filter((x) => !x.exh));
ligne("CONT calibrage", pass.filter((x) => !x.exh && x.d <= IN_END));
ligne("CONT vérif", pass.filter((x) => !x.exh && x.d >= OOS_START));
console.log(`\n-- la même case, par ACTIF (≥ 8 journées) — un effet universel ou trois actifs ? --`);
for (const a of [...new Set(pass.map((x) => x.asset))].sort()) {
  const e = stat(pass.filter((x) => x.asset === a && x.exh));
  const c = stat(pass.filter((x) => x.asset === a && !x.exh));
  if (e.j >= 8 || c.j >= 8) console.log(`${a.padEnd(12)} EXH ${fmt(e)}   CONT ${fmt(c)}`);
}
