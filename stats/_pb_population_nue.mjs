// _pb_population_nue.mjs — POINT C : QUE VAUT LE PULLBACK QUAND ON LUI RETIRE LA TABLE HÉRITÉE ?
//
// ⭐⭐⭐ AUCUN DÉSARMEMENT N'EST NÉCESSAIRE, ET C'EST IMPORTANT DE LE SAVOIR. Le pré-gate a été
//   retiré le 05/08 : « `pbRaw` n'est plus annulé par le veto, le score du rang ② existe sur TOUTES
//   les barres, refusées comprises ». La population NUE est donc déjà observable — `pConv` partout,
//   `pBlk`/`pVetos` à côté. Ajouter un interrupteur ferait PERDRE le croisement qu'on veut faire, et
//   laisserait un réglage caché derrière lui.
//
// ⚠ CONTREFACTUEL : ces trades n'existent pas (MIN_PB = 1000). On les simule avec le `walk()` de
//   l'actif — celui qui produit les R du carnet. C'est un MAJORANT : ils ne concourent contre
//   personne, alors que `maxOpen`/spacing réallouent dans le vrai moteur.
// ⚠ Dédoublonnage 15 min AVANT de marcher : une figure persiste plusieurs barres.
// ⚠ `tsMT` = `2026.08.05 …` ⇒ on NORMALISE avant toute découpe de date.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const SEUIL = Number(process.env.SEUIL_PB ?? 10);

// ── LA CARTE DES FAMILLES (revue owner 10/08) ─────────────────────────────────────────────────
const FAM = {
  AHEAD: ["exh-gap-no-room-ahead", "m15-live-extreme-ahead", "exh-rsi-no-room-ahead",
          "m15-no-room-ahead", "h1-k-falling-with-room-left"],
  POUSSE: ["h4-leg-still-pushing", "h4-mid-drift-not-fadable", "h1-and-d1-both-stretched",
           "h1-rsi-tipping-band-still-pushing", "h1-extreme-soft-grind",
           "d1-strong-trend-h4-accelerating"],
  INSTALLE: ["h1-rsi-deep-and-not-returning", "m15-rsi-approach-not-returning"],
};
const familleDe = (id) => Object.keys(FAM).find((f) => FAM[f].includes(id)) ?? "AUTRE";

const G = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const p = prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true });
  if (!p) continue;
  for (const g of (p.ghosts || [])) if (g.ghost === "boxes") G.push({ ...g, asset: a, _walk: p.walk });
}
// 🔴 GARDE-FOU : si `pVetos` n'était pas recopié, tout paraîtrait « jamais vetoté » — plausible et faux.
const avecIds = G.filter((g) => Array.isArray(g.pVetos)).length;
const bloquees = G.filter((g) => g.pBlk === true).length;
const avecIdsSiBloq = G.filter((g) => g.pBlk === true && (g.pVetos?.length ?? 0) > 0).length;
console.log(`\n═══ POINT C · POPULATION PB NUE ═══  [NO_TRIGGER · spread FACTURÉ · seuil PB = ${SEUIL}]`);
console.log(`  ${G.length} barres · \`pVetos\` présent sur ${avecIds}` +
  `   ·  bloquées ${bloquees}, dont ${avecIdsSiBloq} avec au moins un id ` +
  (bloquees && avecIdsSiBloq === bloquees ? "✅" : "🔴 IDS MANQUANTS — ne pas conclure"));
if (bloquees && avecIdsSiBloq !== bloquees) process.exit(1);

const jour = (x) => String(x.tsMT || "").slice(0, 10).replace(/\./g, "-");
const dedupe = (pop) => { const v = new Set(), o = [];
  for (const g of pop.slice().sort((a, b) => a.ep - b.ep)) {
    const k = `${g.asset}|${g.side}|${Math.floor(g.ep / 15)}`; if (v.has(k)) continue; v.add(k); o.push(g); }
  return o; };
const simuler = (pop) => dedupe(pop).map((g) => { const r = g._walk(g);
  return r ? { ...g, R: r.R, outcome: r.outcome } : null; })
  .filter((x) => x && (x.outcome === "WIN" || x.outcome === "LOSS"));
const BE = 75;
const st = (t) => { if (!t.length) return null;
  const w = t.filter((x) => x.outcome === "WIN").length, R = t.reduce((a, b) => a + (b.R || 0), 0);
  const g = new Map();
  for (const x of t) { const k = `${x.asset}|${jour(x)}`; if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, wr: 100 * w / t.length, R, gr: v.length,
           wrg: 100 * v.reduce((a, o) => a + o.w / o.n, 0) / v.length,
           bas: v.filter((o) => o.w / o.n < BE / 100).length }; };
const ligne = (lbl, t) => { const s = st(t);
  if (!s) { console.log(`    ${lbl.padEnd(34)}      —`); return; }
  console.log(`    ${lbl.padEnd(34)} ${String(s.n).padStart(5)} ${s.wr.toFixed(1).padStart(7)}%` +
    ` ${s.wrg.toFixed(1).padStart(8)}% ${String(s.gr).padStart(5)} ${String(s.bas).padStart(5)}` +
    ` ${((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8)} ${(s.R / s.n).toFixed(3).padStart(7)}`); };
const ENTETE = `    ${"".padEnd(34)}  tirs  WR/tir WR/grap  grap  <BE        R   R/tir`;

// ══ ② LA POPULATION NUE ═══════════════════════════════════════════════════════════════════════
const nue = G.filter((g) => Number.isFinite(g.pConv) && g.pConv > SEUIL);
console.log(`\n── ② POPULATION PB NUE (conviction > ${SEUIL}, TABLE HÉRITÉE IGNORÉE) ──`);
console.log(`  ${nue.length} barres sur ${G.length} (${(100 * nue.length / G.length).toFixed(1)} %)` +
  `  ·  dont la table héritée bloquerait ${nue.filter((g) => g.pBlk).length}` +
  ` (${(100 * nue.filter((g) => g.pBlk).length / (nue.length || 1)).toFixed(1)} %)\n`);
const sim = simuler(nue);
console.log(ENTETE);
ligne("TOUTE LA POPULATION NUE", sim);
ligne("  juillet", sim.filter((x) => jour(x) < "2026-08-01"));
ligne("  août", sim.filter((x) => jour(x) >= "2026-08-01"));
for (const s of ["BUY", "SELL"]) ligne(`  ${s}`, sim.filter((x) => x.side === s));

// ══ ③ DISCRIMINATION PAR FAMILLE ══════════════════════════════════════════════════════════════
console.log(`\n── ③ DISCRIMINATION PAR FAMILLE — chaque veto TRIE-T-IL, et DANS QUEL SENS ? ──`);
console.log(`  ⭐ prédiction owner : les ex-vetotées « AHEAD » doivent être AU-DESSUS (c'est`);
console.log(`     l'anatomie du pullback mûr), les « installé » doivent vetoter JUSTE.\n`);
console.log(ENTETE);
for (const fam of ["AHEAD", "POUSSE", "INSTALLE"]) {
  const touche = (x) => (x.pVetos || []).some((id) => FAM[fam].includes(id));
  ligne(`${fam} — vetoté (donc RETIRÉ)`, sim.filter(touche));
  ligne(`${fam} — non touché`, sim.filter((x) => !touche(x)));
}
console.log("");
ligne("AUCUN veto ne mord", sim.filter((x) => !(x.pVetos || []).length));
ligne("AU MOINS UN veto mord", sim.filter((x) => (x.pVetos || []).length > 0));

// ══ LE DÉTAIL PAR VETO — pour savoir lesquels PORTENT l'effet de leur famille ══════════════════
console.log(`\n── PAR VETO (population nue) ──`);
console.log(ENTETE);
const tous = [...new Set(sim.flatMap((x) => x.pVetos || []))]
  .map((id) => ({ id, n: sim.filter((x) => (x.pVetos || []).includes(id)).length }))
  .sort((a, b) => b.n - a.n);
for (const { id } of tous) ligne(`${familleDe(id).padEnd(9)} ${id}`, sim.filter((x) => (x.pVetos || []).includes(id)));
