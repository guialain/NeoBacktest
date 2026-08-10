// _ab_di_crush.mjs — A/B DU VETO `di-domination-still-widening`, LE MOTEUR DANS LE PROCESSUS.
// ⭐ POURQUOI PAS L'API : l'interrupteur `VETO_DI_CRUSH` est lu par le MODULE du moteur, donc par le
//   processus qui l'importe. Passé au script mais pas au serveur, il ne changerait RIEN et l'A/B
//   afficherait deux fois la même colonne sans qu'aucune erreur ne le signale — la forme exacte du
//   piège « un garde-fou qui ne tourne pas ». En appelant `runMatrixBacktest` ici, l'environnement
//   du script EST celui du moteur.
// ⚠ UN SEUL RUN PAR COLONNE, et les deux dans des PROCESSUS SÉPARÉS (`VETO_DI_CRUSH=off node …`) :
//   les modules ES sont mis en cache, un `process.env` modifié en cours de route ne serait relu par
//   personne.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
// 🔴🔥⭐⭐ `NO_TRIGGER` — LA LIGNE SANS LAQUELLE CE SCRIPT MESURE UNE AUTRE POPULATION QUE LA RÉFÉRENCE.
//   Elle bypasse le gate de timing `DealTrigger` ⇒ **MOTEUR PUR**. ⚠ Ce n'est PAS la prod (là le gate
//   est ACTIF) : c'est la convention de TOUTE la série de mesures du dépôt — `server.js` la pose
//   ligne 8, et ~30 scripts `stats/` la portent déjà. Un script qui l'oublie ne mesure pas « la
//   prod », il mesure un TROISIÈME régime comparable à rien.
//   MESURÉ le 09/08 sur US_30, MÊME code, MÊMES options : **294 tirs par l'API contre 200 en
//   processus** ; sur les 19 actifs, **3 559 contre 2 602**. Un tiers du carnet.
//   ⚠⚠ Et RIEN ne le signale — les deux runs affichent le même bloc `params`, ce drapeau n'y figure
//   pas. L'A/B aurait comparé off/on sur une population amputée et le verdict aurait tenu debout.
//   ⇒ Posée AVANT l'import dynamique du moteur, et avec `??` comme dans `server.js` pour qu'un
//   `NO_TRIGGER=0` explicite reste possible.
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const ETAT = String(process.env.VETO_DI_CRUSH ?? "on");

let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);

const EXH = all.filter((s) => s.strategy === "EXH");
const ep = dedupeEpisodes(EXH).filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function grappes(t) {
  const g = new Map();
  for (const s of t) {
    const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++;
  }
  const v = [...g.values()];
  return { g: v.length, wr: v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN };
}
const BE = 75;
function line(lbl, t) {
  if (!t.length) { console.log(lbl.padEnd(22) + "— vide"); return; }
  const w = t.filter((x) => x.outcome === "WIN").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const wr = 100 * w / t.length, se = Math.sqrt(0.75 * 0.25 / t.length) * 100;
  const gr = grappes(t);
  console.log(lbl.padEnd(22) +
    `ép=${String(t.length).padStart(4)}  WR ${wr.toFixed(1).padStart(5)} %  ` +
    `${((wr - BE) / se >= 0 ? "+" : "") + ((wr - BE) / se).toFixed(2)} σ  ` +
    `R ${(R >= 0 ? "+" : "") + R.toFixed(1).padStart(6)}  R/ép ${(R / t.length).toFixed(3).padStart(6)}  ` +
    `| ${String(gr.g).padStart(3)} grappes ${gr.wr.toFixed(1)} %`);
}

console.log(`\n════ VETO_DI_CRUSH = ${ETAT} ════  [maxOpen=30 · cadence 2 min · spread FACTURÉ]`);
console.log(`tirs EXH ${EXH.length}  ·  épisodes ${ep.length}\n`);
line("EXH — TOUS", ep);
line("  BUY", ep.filter((s) => s.side === "BUY"));
line("  SELL", ep.filter((s) => s.side === "SELL"));
console.log("");
line("TIRS — TOUS", EXH.filter((s) => s.outcome === "WIN" || s.outcome === "LOSS"));
line("  BUY", EXH.filter((s) => s.side === "BUY" && (s.outcome === "WIN" || s.outcome === "LOSS")));
line("  SELL", EXH.filter((s) => s.side === "SELL" && (s.outcome === "WIN" || s.outcome === "LOSS")));

// ⭐⭐ LE COMPTEUR DE MORSURE — combien de tirs la figure porte-t-elle ENCORE dans ce run ?
// 🔴 NE PAS LE CHERCHER DANS `reasons` : un veto qui BLOQUE empêche le tir d'exister, donc sa trace
//   n'est dans AUCUNE fiche. Un compteur écrit là rendrait `0` dans les deux colonnes et se lirait
//   « le veto ne mord pas » alors qu'il aurait tout retiré — sonde à la mauvaise adresse, la
//   première des trois formes du garde-fou qui ne tourne pas.
// ⇒ On compte la FIGURE dans le carnet PRODUIT. Colonne `off` : la population visée. Colonne `on` :
//   doit valoir **0**, sinon le veto ne s'applique pas là où on croit.
const REST = (s) => {
  const p = s.plusDiLive, m = s.minusDiLive;
  if (!Number.isFinite(p) || !Number.isFinite(m)) return false;
  const [fade, contre] = s.side === "SELL" ? [p, m] : [m, p];
  return fade >= 32 && contre < 7 && s.diGapDynH1 === "WIDENING";
};
const rest = EXH.filter(REST);
console.log(`\ntirs de la FIGURE encore présents : ${rest.length}` +
  (ETAT === "on" && rest.length ? "   🔴 devrait être 0 — le veto ne mord pas où on croit" : ""));
