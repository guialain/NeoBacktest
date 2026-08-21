// _exec_m5_les22.mjs — CE QUE LE M5 ATTRAPAIT VRAIMENT. Jugement de VALEUR, pas de couverture.
//
// La mesure de recouvrement a dit que le M5 est aux 2/3 redondant et que sa contribution propre
// vaut 22 barres. Elle n'a PAS dit si ces 22 méritaient d'être retenues. C'est ce script.
//
// TROIS GROUPES, TOUS SIMULÉS DE LA MÊME FAÇON (barre à barre, dédoublonnés 15 min) :
//     M5 SEUL     le M5 retient, le M1 laisse passer   ⟵ sa contribution PROPRE
//     LES DEUX    les deux retiennent                   ⟵ ce qu'il redouble
//     PASSÉES     aucune porte ne retient               ⟵ la référence
//
// ⚠⚠ RÉFÉRENCE = LE **BUY** PASSÉ, PAS TOUTES LES PASSÉES. `m5TimingBlocks` ne teste que le BUY
//   (`side === "BUY" && …`) : comparer ses 22 barres à une référence tous côtés confondrait l'effet
//   du CAPTEUR avec l'asymétrie du CÔTÉ, et le SELL vaut structurellement moins dans cette fenêtre.
// ⚠ Trigger ACTIF obligatoire, sinon le groupe « M1 laisse passer » n'a pas de sens.
// ⚠ MAJORANT : ces barres ne concourent contre personne (`maxOpen`/spacing absents de la simulation).
//   C'est vrai pour LES TROIS groupes, donc la COMPARAISON reste juste même si les niveaux montent.
import fs from "fs";
import path from "path";
delete process.env.NO_TRIGGER;
delete process.env.NO_TRIGGER;
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const G = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const p = prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostExec: true });
  if (!p) continue;
  for (const g of (p.ghosts || [])) if (g.ghost === "exec") G.push({ ...g, asset: a, _walk: p.walk });
}
if (G.some((g) => g.trigState === "BYPASS")) { console.log("🔴 trigger désarmé — STOP"); process.exit(1); }

const jour = (x) => String(x.tsMT || "").slice(0, 10).replace(/\./g, "-");
const dedupe = (pop) => { const v = new Set(), o = [];
  for (const g of pop.slice().sort((a, b) => a.ep - b.ep)) {
    const k = `${g.asset}|${g.side}|${Math.floor(g.ep / 15)}`; if (v.has(k)) continue; v.add(k); o.push(g); }
  return o; };
const sim = (pop) => dedupe(pop).map((g) => { const r = g._walk(g);
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
           wrg: 100 * v.reduce((a, o) => a + o.w / o.n, 0) / v.length }; };
const ligne = (lbl, t) => { const s = st(t);
  if (!s) { console.log(`    ${lbl.padEnd(26)}     —`); return; }
  console.log(`    ${lbl.padEnd(26)} ${String(s.n).padStart(5)} ${s.wr.toFixed(1).padStart(7)}%` +
    ` ${s.wrg.toFixed(1).padStart(8)}% ${String(s.gr).padStart(5)}` +
    ` ${((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8)} ${(s.R / s.n).toFixed(3).padStart(7)}`); };

const BUY = G.filter((g) => g.side === "BUY");
const m5Seul = BUY.filter((g) => g.m5Pass === false && g.trigPass !== false);
const lesDeux = BUY.filter((g) => g.m5Pass === false && g.trigPass === false);
const passees = BUY.filter((g) => g.m5Pass !== false && g.trigPass !== false);

console.log(`\n═══ CE QUE LE M5 ATTRAPAIT — jugement de VALEUR ═══  [trigger ACTIF · côté BUY seul]`);
console.log(`  ${BUY.length} barres BUY détectées · M5 seul ${m5Seul.length} · les deux ${lesDeux.length} · passées ${passees.length}\n`);
console.log(`    ${"".padEnd(26)}  tirs  WR/tir WR/grap  grap        R   R/tir`);
ligne("PASSÉES (référence BUY)", sim(passees));
ligne("M5 SEUL (sa valeur propre)", sim(m5Seul));
ligne("LES DEUX (redoublé)", sim(lesDeux));
console.log("");
ligne("M5 retient (22+44)", sim([...m5Seul, ...lesDeux]));

// ── DE QUOI SONT FAITES CES BARRES — pour la fiche, si la condition mérite un capteur propre ──
console.log(`\n── ANATOMIE DES BARRES QUE LE M5 RETIENT (n=${m5Seul.length + lesDeux.length}) ──`);
const tous = [...m5Seul, ...lesDeux];
const q = (v) => { const s = v.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? `min ${s[0].toFixed(1)} · méd ${s[s.length >> 1].toFixed(1)} · max ${s[s.length - 1].toFixed(1)}` : "—"; };
console.log(`  %K M5   : ${q(tous.map((g) => g.m5K))}`);
console.log(`  ΔK/D M5 : ${q(tous.map((g) => g.m5Kd))}`);
const parA = new Map();
for (const g of tous) parA.set(g.asset, (parA.get(g.asset) ?? 0) + 1);
console.log(`  actifs  : ${[...parA.entries()].sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a} ${n}`).join(" · ")}`);
const parM = new Map();
for (const g of tous) parM.set(jour(g).slice(0, 7), (parM.get(jour(g).slice(0, 7)) ?? 0) + 1);
console.log(`  mois    : ${[...parM.entries()].sort().map(([m, n]) => `${m} ${n}`).join(" · ")}`);
