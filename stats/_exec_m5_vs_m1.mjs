// _exec_m5_vs_m1.mjs — LES DEUX PORTES D'EXÉCUTION FONT-ELLES LE MÊME TRAVAIL ?
//
// Depuis le découpage du 10/08, la couche EXÉCUTION porte deux gardes qui interrogent la MÊME
// famille de capteur — le court terme est-il déjà parti ? — sur deux horloges :
//     TimingM5     `m5TimingBlocks(side, gate)`   → %K M5 et ΔK/D M5
//     DealTrigger  `dealTrigger(sel, row)`        → %K vs %D en M1 + garde de zone sur %D
// Deux fois la même question mérite une mesure de RECOUVREMENT avant qu'on en garde deux.
//
// 🔴🔥 LE FUNNEL NE PEUT PAS Y RÉPONDRE, et c'est pour ça que ce script existe : `heldBy` ne nomme
//   que la PREMIÈRE porte qui retient. Deux portes qui retiennent la même barre s'y lisent comme
//   une seule, et l'ordre du tableau décide laquelle on voit. Il faut le verdict de CHACUNE.
//
// ⚠⚠ TRIGGER ACTIF OBLIGATOIRE. Sous `NO_TRIGGER`/`NO_TRIGGER`, `DealTrigger` rend `BYPASS/pass` :
//   le recouvrement sortirait VIDE côté M1 sans que rien ne le signale. Ce script FORCE donc le
//   trigger, et il le VÉRIFIE avant de conclure.
// ⚠ LA POPULATION N'EST DONC PAS CELLE DES CARNETS DE LA JOURNÉE (tous en `NO_TRIGGER=1`). On ne
//   compare pas ces chiffres au `926 / +168,6` : on mesure l'EXÉCUTION, pas la détection.
import fs from "fs";
import path from "path";
// 🔴 On EFFACE les drapeaux de bypass au lieu de supposer qu'ils sont absents : un `NO_TRIGGER` laissé
//   par un shell précédent viderait la mesure en silence.
delete process.env.NO_TRIGGER;
delete process.env.NO_TRIGGER;
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const G = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const p = prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostExec: true });
  if (!p) continue;
  for (const g of (p.ghosts || [])) if (g.ghost === "exec") G.push({ ...g, asset: a });
}
console.log(`\n═══ EXÉCUTION · RECOUVREMENT M5 ↔ M1 ═══`);
console.log(`  ${G.length} barres où la DÉTECTION a produit un côté`);
const bypass = G.filter((g) => g.trigState === "BYPASS").length;
console.log(`  DealTrigger en BYPASS sur ${bypass} barres ` +
  (bypass ? "🔴 LE TRIGGER EST DÉSARMÉ — mesure invalide, STOP" : "✅ trigger actif"));
if (bypass) process.exit(1);
if (!G.length) { console.log("  🔴 aucune barre collectée — `ghostExec` ne remonte pas"); process.exit(1); }

const pc = (n) => (100 * n / G.length).toFixed(1).padStart(5) + " %";
const m5NON = G.filter((g) => g.m5Pass === false);
const m1NON = G.filter((g) => g.trigPass === false);
const deux  = G.filter((g) => g.m5Pass === false && g.trigPass === false);
const m5SEUL = G.filter((g) => g.m5Pass === false && g.trigPass !== false);
const m1SEUL = G.filter((g) => g.m5Pass !== false && g.trigPass === false);
const aucune = G.filter((g) => g.m5Pass !== false && g.trigPass !== false);

console.log(`\n── QUI RETIENT QUOI ──`);
console.log(`  M5 retient          ${String(m5NON.length).padStart(6)}  ${pc(m5NON.length)}`);
console.log(`  M1 retient          ${String(m1NON.length).padStart(6)}  ${pc(m1NON.length)}`);
console.log(`  ─────────────────────────────────────`);
console.log(`  les DEUX            ${String(deux.length).padStart(6)}  ${pc(deux.length)}   ⟵ le recouvrement`);
console.log(`  M5 SEUL             ${String(m5SEUL.length).padStart(6)}  ${pc(m5SEUL.length)}   ⟵ ce que M1 laisserait passer`);
console.log(`  M1 SEUL             ${String(m1SEUL.length).padStart(6)}  ${pc(m1SEUL.length)}   ⟵ ce que M5 laisserait passer`);
console.log(`  aucune (ça passe)   ${String(aucune.length).padStart(6)}  ${pc(aucune.length)}`);

// ⭐ LA QUESTION DE L'INCLUSION — une porte est-elle REDONDANTE, c'est-à-dire son travail est-il
//   déjà fait par l'autre ? C'est la part de ses refus que l'autre couvre déjà.
const inc = (a, b) => (a.length ? (100 * b / a.length).toFixed(1) + " %" : "—");
console.log(`\n── INCLUSION ──`);
console.log(`  des refus M5, déjà couverts par M1 : ${inc(m5NON, deux.length)}` +
  `   ⇒ retirer M5 laisserait passer ${m5SEUL.length} barres`);
console.log(`  des refus M1, déjà couverts par M5 : ${inc(m1NON, deux.length)}` +
  `   ⇒ retirer M1 laisserait passer ${m1SEUL.length} barres`);

// ⚠ M5 NE REGARDE QUE LE BUY (asymétrie antérieure, portée telle quelle par le déménagement).
//   Sans ce découpage, le recouvrement global mélangerait un côté où M5 est actif et un où il est
//   MUET par construction — l'inclusion paraîtrait bien meilleure qu'elle ne l'est.
console.log(`\n── PAR CÔTÉ (⚠ \`m5TimingBlocks\` ne regarde QUE le BUY) ──`);
for (const s of ["BUY", "SELL"]) {
  const t = G.filter((g) => g.side === s);
  const a = t.filter((g) => g.m5Pass === false).length, b = t.filter((g) => g.trigPass === false).length;
  const d = t.filter((g) => g.m5Pass === false && g.trigPass === false).length;
  console.log(`  ${s.padEnd(5)} ${String(t.length).padStart(6)} barres · M5 retient ${String(a).padStart(5)}` +
    ` · M1 retient ${String(b).padStart(5)} · les deux ${String(d).padStart(5)}`);
}
const etats = new Map();
for (const g of m1NON) etats.set(g.trigState, (etats.get(g.trigState) ?? 0) + 1);
console.log(`\n  états du DealTrigger quand il retient : ` +
  [...etats.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · "));
