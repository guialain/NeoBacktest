// _veto_kplace_morsure.mjs — CE VETO MORD-IL, ET QUE DEVIENNENT LES BARRES QU'IL BLOQUE ?
// ⚠⚠ CONTROLE D'ARMEMENT D'ABORD : un A/B qui rend un resultat IDENTIQUE au bit pres ne prouve
//   pas que la regle est neutre — il prouve d'abord que le harnais n'a peut-etre rien teste.
//   On compte donc la MORSURE avant de conclure quoi que ce soit sur l'effet.
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { prepareAsset } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const CIBLE = "h1-k-falling-with-room-left";

let barres = 0;
const morsure = { BUY: 0, SELL: 0 };
const tousVetos = new Map();
const devenir = new Map();   // ce que la cascade a fait des barres mordues
let bloqueEtSeul = 0;        // le veto CIBLE est le SEUL a mordre sur cette barre

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  for (const x of (prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes") continue;
    barres++;
    const v = x.eVetos ?? [];
    for (const id of v) tousVetos.set(id, (tousVetos.get(id) ?? 0) + 1);
    if (!v.includes(CIBLE)) continue;
    morsure[x.side] = (morsure[x.side] ?? 0) + 1;
    if (v.length === 1) bloqueEtSeul++;
    // ⭐ LA QUESTION DE L'OWNER : « il envoie beaucoup de trades en cont ». `firedStrategy` dit ce
    //   que la cascade a REELLEMENT fait de la barre, pas ce qu'on en deduirait.
    const d = x.firedStrategy ?? "aucun tir";
    devenir.set(d, (devenir.get(d) ?? 0) + 1);
  }
}
const T = morsure.BUY + morsure.SELL;
const pc = (n, t) => (t ? (100 * n / t).toFixed(2) : "0.00") + " %";
console.log(`\n══ MORSURE DE \`${CIBLE}\` — ${barres} barres lues ══`);
console.log(`   mord sur         ${String(T).padStart(7)}   ${pc(T, barres)}   (BUY ${morsure.BUY} · SELL ${morsure.SELL})`);
console.log(`   SEUL a mordre    ${String(bloqueEtSeul).padStart(7)}   ${pc(bloqueEtSeul, T || 1)} de ses morsures`);
console.log(`\n   ce que la cascade fait des barres qu'il bloque :`);
for (const [k, n] of [...devenir.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`     ${String(k).padEnd(12)} ${String(n).padStart(7)}   ${pc(n, T || 1)}`);
console.log(`\n   TOUS LES VETOS EXH qui mordent, par frequence (pour situer celui-ci) :`);
for (const [k, n] of [...tousVetos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14))
  console.log(`     ${k === CIBLE ? "\u25b6 " : "  "}${k.padEnd(38)} ${String(n).padStart(7)}   ${pc(n, barres)}`);
// ══ ⭐⭐⭐ LE VETO EST-IL SEULEMENT ARME ? ═══════════════════════════════════════════════════
// L'A/B moteur (`_ab_moteur`, VETO_K_PLACE_DEVANT on/off) a rendu un resultat IDENTIQUE AU CHIFFRE
// PRES. Ce n'est pas « la regle est neutre » : c'est une question a poser avant de conclure.
// ⭐ L'HYPOTHESE TESTABLE : un veto de DETECTION **ROUTE** (depuis le 10/08 le tri par `kind` est
//   supprime). La barre bloquee au rang ① part donc vers ②/③. Si, SANS le veto, elle ne franchit
//   pas `MIN_EXH` non plus, elle part vers ②/③ **exactement pareil** — et le veto ne change RIEN.
//   ⇒ On mesure la conviction EXH des barres mordues. Si aucune n'atteint `MIN_EXH`, le veto est
//   INERTE au point de fonctionnement courant, et l'A/B ne s'est pas trompe : il n'y avait rien.
// ⚠⚠ « INERTE » EST UNE PROPRIETE DU POINT DE FONCTIONNEMENT, PAS DE LA REGLE (memoire du 10/08).
//   Le meme veto redeviendrait actif si `MIN_EXH` baissait. Le supprimer sur ce constat, c'est
//   supprimer une regle qui n'a jamais eu l'occasion de parler.
{
  const { MIN_EXH } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
  let mordues = 0, auDessus = 0, muet = 0;
  const bandes = new Map();
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
    for (const x of (prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
      if (x.ghost !== "boxes" || !(x.eVetos ?? []).includes(CIBLE)) continue;
      mordues++;
      if (!Number.isFinite(x.eConv)) { muet++; continue; }
      if (x.eConv >= MIN_EXH) auDessus++;
      const b = x.eConv < 0 ? "< 0" : x.eConv < 1 ? "[0 . 1[" : x.eConv < 5 ? "[1 . 5[" : x.eConv < 10 ? "[5 . 10[" : ">= 10 (FRANCHIT)";
      bandes.set(b, (bandes.get(b) ?? 0) + 1);
    }
  }
  console.log(`
   ── LA CONVICTION EXH DES ${mordues} BARRES MORDUES (MIN_EXH = ${MIN_EXH}) ──`);
  for (const b of ["< 0", "[0 . 1[", "[1 . 5[", "[5 . 10[", ">= 10 (FRANCHIT)"]) {
    const n = bandes.get(b) ?? 0;
    console.log(`     ${b.padEnd(18)} ${String(n).padStart(7)}   ${pc(n, mordues)}`);
  }
  console.log(`     ${"muettes".padEnd(18)} ${String(muet).padStart(7)}   ${pc(muet, mordues)}`);
  console.log(`
   ⇒ ${auDessus} barre(s) FRANCHIRAIENT \`MIN_EXH\` sans ce veto.`);
  console.log(`      ${auDessus === 0 ? "⭐⭐⭐ AUCUNE : le veto est INERTE au point de fonctionnement courant." : "le veto MORD reellement sur ces barres-la."}`);
}
console.log("");
