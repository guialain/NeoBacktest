// _cont_rsi_pop.mjs — LA POPULATION DU RANG ③ SUR `zone RSI x rang-sur-3`.
// ⚠ DESCRIPTIF SEUL. Aucune note, aucun A/B, aucun tir compte.
//
// ⭐⭐⭐ CE QUE « POPULATION DU RANG ③ » VEUT DIRE ICI, ET POURQUOI CE N'EST PAS `boxes.cont`.
//   Les trois boites sont evaluees EN PARALLELE : `cConv` existe sur TOUTES les barres et dit « ce
//   que ③ PENSERAIT », pas « ce que ③ a RECU ». Le rang ③ est le RESIDU — il ne voit que ce que ①
//   et ② lui ont cede. ⇒ on filtre sur `rangCont`, le booleen que le moteur pose lui-meme depuis la
//   cascade. Le reconstruire ici (`eConv <= MIN_PRES && (pConv == null || pConv <= MIN_PB_PRES)`)
//   reviendrait a recopier un arbre de decision qui a change DEUX FOIS le 12/08.
//
// ⚠⚠ CETTE POPULATION VIENT DE CHANGER : la bande `pb-ambiguous` (owner 12/08) fait DROPPER les
//   barres a `MIN_PB_PRES < pConv <= MIN_PB` au lieu de les ceder. Le rang ③ ne recoit donc plus que
//   les barres ou le rang ② n'a RIEN VU. Toute grille dictee avant ce geste noterait une population
//   qui n'existe plus.
//
// ⚠ ZONE a la CLOTURE, RANG sur le LIVE — meme convention que le rang ②, et pour la meme raison
//   mesuree : en zone live les deux axes partagent `s0` et la population se tasse sur la diagonale.
// ⚠ UN ACTIF A LA FOIS, `rows` relache ensuite (OOM mesure a 4 Go).
//   usage : node stats/_cont_rsi_pop.mjs   ·   COTE=SELL node stats/_cont_rsi_pop.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/experts/rsiExpert.js";
const { rsiZone, rsiRang3, RSI_ZONES } = await import(M);
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const TEND = ["UP", "FLAT", "DOWN"];
const COTE = process.env.COTE ?? "BUY";
const g = { h1: {}, m15: {} };
for (const tf of ["h1", "m15"]) for (const z of RSI_ZONES) g[tf][z] = { UP: 0, FLAT: 0, DOWN: 0 };
let nBoites = 0, nCote = 0, nCont = 0, muet = { h1: 0, m15: 0 };

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f);
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const iTs = head.indexOf("timestamp");
  const ix = {};
  for (const n of ["rsi_h1", "rsi_h1_s0", "rsi_h1_previouslow3", "rsi_h1_previoushigh3",
                   "rsi_m15", "rsi_m15_s0", "rsi_m15_previouslow3", "rsi_m15_previoushigh3"]) ix[n] = head.indexOf(n);
  const rows = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[iTs], c); }

  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes") continue;
    nBoites++;
    if (x.side !== COTE) continue;
    nCote++;
    if (!x.rangCont) continue;          // ⚠ la cascade n'est PAS arrivee au rang ③
    nCont++;
    const c = rows.get(x.tsMT); if (!c) continue;
    const num = (k) => { const v = c[ix[k]]; return v === "" || v == null ? null : Number(v); };
    for (const tf of ["h1", "m15"]) {
      const z = rsiZone(num(`rsi_${tf}`));                                   // NIVEAU : cloture
      const t = rsiRang3(num(`rsi_${tf}_s0`), num(`rsi_${tf}_previouslow3`), num(`rsi_${tf}_previoushigh3`));
      if (z == null || t == null) { muet[tf]++; continue; }
      g[tf][z][t]++;
    }
  }
  rows.clear();
}

const pc = (n, t) => (t ? (100 * n / t).toFixed(2) : "0.00") + " %";
console.log(`\n══ RANG ③ · POPULATION ${COTE} · zone RSI (CLÔTURE) × rang-sur-3 ══`);
console.log(`  barres avec boîte ............ ${nBoites}`);
console.log(`  dont côté ${COTE} ................ ${nCote}`);
console.log(`  dont ATTEINTES par la cascade  ${nCont}   ${pc(nCont, nCote)} du côté`);
console.log(`  muettes : H1 ${muet.h1} · M15 ${muet.m15}`);
for (const tf of ["h1", "m15"]) {
  console.log(`\n  ── ${tf.toUpperCase()} ──`);
  console.log("  zone".padEnd(18) + TEND.map((t) => t.padStart(9)).join("") + "     total");
  for (const z of RSI_ZONES) {
    const r = g[tf][z], t0 = r.UP + r.FLAT + r.DOWN;
    console.log("  " + z.padEnd(16) + TEND.map((t) => pc(r[t], nCont).padStart(9)).join("")
      + pc(t0, nCont).padStart(10) + (t0 === 0 ? "  🔴 VIDE" : t0 * 100 / nCont < 1 ? "  ⚠ <1 %" : ""));
  }
  const parts = RSI_ZONES.map((z) => Object.values(g[tf][z]).reduce((a, b) => a + b, 0));
  console.log(`  → ligne la plus peuplée : ${pc(Math.max(...parts), nCont)} · lignes non vides : ${parts.filter((v) => v > 0).length}/6`);
}
