// _conjonction_v0.mjs — LA CONJONCTION : tickflow fort × ADX fort × intensité forte × cohérence.
// Hypothèse owner : quand ces conditions coïncident, on continue et on ne fade pas (CONT, no-EXH).
//
// ⭐ SI ELLE TIENT, L'HEURE DEVIENT INUTILE : les tranches horaires n'étaient qu'une OMBRE de la
//   conjonction. On mesure donc AUSSI *quand* elle tombe — en diagnostic, pas comme critère.
//
// ⚠ `ic` / `dailyForce` ÉCARTÉ DÉLIBÉRÉMENT : c'est un CUMUL depuis l'open, il RAMPE avec l'heure
//   (commentaire OpportunityDetector, mesuré sur COCOA). L'utiliser puis demander « à quelle heure
//   ça tombe » fabriquerait la réponse. `intensity` (Energy) dit la force sans la rampe.
//
// ⚠ ÉTAPE 0 = LE TAUX DE DÉCLENCHEMENT, PAS LE WR. Une conjonction de 4 conditions peut ne jamais
//   tomber. On lit les marges APRÈS avoir vu combien de journées elle couvre.
import fs from "fs";
import path from "path";
const API = "http://localhost:3001/api/matrix";
const DIR = "data/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const GAP = 240, BE = 75;

// ── FAMILLES, et leur orientation sur l'axe RISQUE ────────────────────────────────────────────
// ⚠ Le FX doit être orienté par le DOLLAR, pas par la paire : EURUSD↑ et USDJPY↑ disent l'inverse
//   du même dollar. `usdSign` = +1 si l'actif MONTE quand le dollar se renforce.
const USD = { EURUSD: -1, GBPUSD: -1, AUDUSD: -1, USDCAD: +1, USDCHF: +1, USDJPY: +1 };
const FAMILLE = { AUDUSD: "FX", EURUSD: "FX", GBPUSD: "FX", USDCAD: "FX", USDCHF: "FX", USDJPY: "FX",
  GERMANY_40: "INDEX", UK_100: "INDEX", US_30: "INDEX", US_500: "INDEX", US_TECH100: "INDEX",
  BTCUSD: "CRYPTO", ETHUSD: "CRYPTO", GOLD: "METAL", SILVER: "METAL",
  BRENT_OIL: "ENERGY", CrudeOIL: "ENERGY", GASOLINE: "ENERGY", COCOA: "AGRI" };
// Axe risque v0 : 4 familles seulement. METAL est EXCLU — l'or a deux rôles (liquidité ET refuge),
//   c'est le désambiguïsateur, pas un votant. AGRI exclu : COCOA est idiosyncratique.
const RISQUE = { FX: -1, INDEX: +1, CRYPTO: +1, ENERGY: +1 };   // signe = contribution au « risk-on »

const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
const tickBand = {};       // asset -> Map(ep -> "LOW"|"MED"|"HIGH"|"EXPLO")
const risqueParEp = {};    // ep -> { famille -> [signes] }

for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  const L = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  const h = L[0].split(";");
  const iT = h.indexOf("tick_count_15s_s0"), iTs = h.indexOf("ts_utc"), iIc = h.indexOf("intraday_change");
  const lignes = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const ep = Math.round(Date.parse(c[iTs]) / 60000); if (!Number.isFinite(ep)) continue;
    const tv = c[iT] === "" ? null : Number(c[iT]);
    const ic = c[iIc] === "" ? null : Number(c[iIc]);
    lignes.push({ ep, tv: Number.isFinite(tv) ? tv : null, ic: Number.isFinite(ic) ? ic : null });
  }
  // Bandes de tickflow PAR ACTIF (p25/p75/p95) — l'échelle va de 1 à 92 ticks/15s selon l'actif,
  //   des comptes bruts ne sont comparables ni entre actifs ni à un seuil universel.
  const v = lignes.map((x) => x.tv).filter((x) => x != null).sort((a, b) => a - b);
  const q = (p) => v[Math.floor(v.length * p)];
  const [p25, p75, p95] = [q(0.25), q(0.75), q(0.95)];
  const m = new Map();
  for (const x of lignes) {
    if (x.tv != null) m.set(x.ep, x.tv < p25 ? "LOW" : x.tv < p75 ? "MED" : x.tv < p95 ? "HIGH" : "EXPLO");
    // vote de risque : signe de la variation intraday, orienté dollar pour le FX
    const fam = FAMILLE[asset];
    if (x.ic != null && x.ic !== 0 && RISQUE[fam] != null) {
      const s = Math.sign(x.ic) * (USD[asset] ?? 1) * RISQUE[fam];
      ((risqueParEp[x.ep] ??= {})[fam] ??= []).push(s);
    }
  }
  tickBand[asset] = m;
}

// Cohérence = |somme des votes de famille| / nb de familles présentes. UNE VOIX PAR FAMILLE :
//   19 actifs ne sont pas 19 paris (US_30/500/TECH100 = un seul). Cf. tirs clonés, un étage plus haut.
const coherence = new Map();
for (const [ep, fams] of Object.entries(risqueParEp)) {
  const votes = Object.values(fams).map((a) => Math.sign(a.reduce((x, y) => x + y, 0))).filter((s) => s !== 0);
  if (votes.length >= 3) coherence.set(Number(ep), Math.abs(votes.reduce((a, b) => a + b, 0)) / votes.length);
}

// ── LES TRADES ────────────────────────────────────────────────────────────────────────────────
const assets = await (await fetch(`${API}/assets`)).json();
const all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || []).filter((s) => typeof s.R === "number").map((s) => {
    const ep = s.openEp ?? s.ep;
    return { R: s.R, out: s.outcome, asset: a, exh: s.type === "EXHAUSTION", ep,
             d: new Date(ep * 60000).toISOString().slice(0, 10),
             h: new Date(ep * 60000).toISOString().slice(11, 13),
             tick: tickBand[a]?.get(ep) ?? null, adx: s.adx, inten: s.obs?.intensity ?? null,
             coh: coherence.get(ep) ?? null };
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
  if (!t.n) { console.log(`${lbl.padEnd(34)}       —`); return; }
  const m = t.wr - BE;
  console.log(`${lbl.padEnd(34)} ${String(t.j).padStart(2)}j ${String(t.ep).padStart(4)}ép ${String(t.n).padStart(5)}tr`
    + `  marge ${((m >= 0 ? "+" : "") + m.toFixed(2)).padStart(6)}  R/tr ${t.rtr.toFixed(4).padStart(7)}`
    + `${t.j < 8 ? "  ⚠" : m < 0 ? "  🔴" : ""}`);
};

// ── LES BRANCHES, UNE PAR UNE ────────────────────────────────────────────────────────────────
// ADX : bandes universelles [16·24·33·55], indépendantes du TF (adx_bands_5rung_mirror).
const adxFort = (x) => x.adx != null && x.adx >= 33;
const tickFort = (x) => x.tick === "HIGH" || x.tick === "EXPLO";
const intenFort = (x) => x.inten === "HIGH" || x.inten === "EXTREME";
const cohFort = (x) => x.coh != null && x.coh >= 0.75;   // ≥ 3 familles sur 4 d'accord

const couv = (nom, f) => {
  const s = all.filter(f);
  console.log(`${nom.padEnd(26)} ${(100 * s.length / all.length).toFixed(1).padStart(5)} % des trades   `
    + `${String(new Set(s.map((x) => x.d)).size).padStart(2)} journées`);
};
console.log(`\n=== ÉTAPE 0 : COUVERTURE DE CHAQUE BRANCHE (${all.length} trades, ${new Set(all.map((x) => x.d)).size} journées) ===`);
couv("tick HIGH/EXPLO", tickFort);
couv("adx ≥ 33", adxFort);
couv("intensity HIGH/EXTREME", intenFort);
couv("cohérence ≥ 0,75", cohFort);
console.log(`(données manquantes : tick ${all.filter((x) => x.tick == null).length} · coh ${all.filter((x) => x.coh == null).length})`);

console.log(`\n=== LA CONJONCTION, BRANCHE PAR BRANCHE AJOUTÉE ===`);
const paliers = [["tick fort", (x) => tickFort(x)],
                 ["+ adx ≥ 33", (x) => tickFort(x) && adxFort(x)],
                 ["+ intensité forte", (x) => tickFort(x) && adxFort(x) && intenFort(x)],
                 ["+ cohérence ≥ 0,75", (x) => tickFort(x) && adxFort(x) && intenFort(x) && cohFort(x)]];
for (const [lbl, f] of paliers) {
  const s = all.filter(f);
  console.log(`\n-- ${lbl} · ${(100 * s.length / all.length).toFixed(2)} % des trades --`);
  row("   EXH", s.filter((x) => x.exh));
  row("   CONT", s.filter((x) => !x.exh));
}
console.log(`\n-- référence : tout le carnet --`);
row("   EXH", all.filter((x) => x.exh));
row("   CONT", all.filter((x) => !x.exh));

// La conjonction complète, en diagnostic horaire — l'heure est-elle son ombre ?
const CJ = (x) => tickFort(x) && adxFort(x) && intenFort(x) && cohFort(x);
const cj = all.filter(CJ);
if (cj.length) {
  console.log(`\n=== QUAND LA CONJONCTION TOMBE (diagnostic, pas critère) ===`);
  for (const h of [...new Set(all.map((x) => x.h))].sort()) {
    const tot = all.filter((x) => x.h === h).length, n = cj.filter((x) => x.h === h).length;
    if (!tot) continue;
    const pct = 100 * n / tot;
    console.log(`${h}h  ${String(n).padStart(4)}/${String(tot).padStart(5)}  ${pct.toFixed(1).padStart(5)} %  ${"█".repeat(Math.round(pct * 2))}`);
  }
  console.log(`\n=== STABILITÉ ===`);
  row("EXH  calibrage", cj.filter((x) => x.exh && x.d <= IN_END));
  row("EXH  vérif", cj.filter((x) => x.exh && x.d >= OOS_START));
  row("CONT calibrage", cj.filter((x) => !x.exh && x.d <= IN_END));
  row("CONT vérif", cj.filter((x) => !x.exh && x.d >= OOS_START));
}
