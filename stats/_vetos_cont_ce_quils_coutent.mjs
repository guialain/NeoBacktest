// _vetos_cont_ce_quils_coutent.mjs — CE QUE LES VETOS DU RANG ③ BLOQUENT, ET CE QUI LES PRECEDE.
// ============================================================================================
// 🎯 LA QUESTION (owner, 20/08) : le ③ n'admet qu'UNE barre sur 10 175 que le routage lui rend
//   (14 a `MIN_CONT = 18`). Le goulot est-il ses VETOS, et lesquels ?
//
// ⚠⚠⚠ L'ORDRE DES REFUS COMMANDE TOUTE LA LECTURE (`scoringDecision`, rang ③) :
//        ① `cont-counter-cross`  (cross H1 contre le cote)
//        ② `cont-below-min`      (`contConviction < MIN_CONT`)
//        ③ `cont-vetoed`         (`vetoGate(row,"CONT",…)`)
//   **Le veto est teste APRES le seuil** : une barre sous `MIN_CONT` ne l'atteint JAMAIS. Compter
//   « ce que les vetos bloquent » sans separer ces trois causes attribuerait au VETO ce que le
//   SEUIL a deja refuse — la meme faute que la table ① de ce matin, d'une autre forme.
//
// ⚠ LE COTE DU ③ N'EST PAS CELUI DU ① : `contSide` est l'OPPOSE de `SIDE_EXH = −regDir`. On lit
//   donc `contVeto.side`, jamais le cote du fantome.
// ⚠ `R` simule une entree CONT sur la barre : a capacite infinie, sans spacing. Il CLASSE, il ne
//   chiffre pas un gain recuperable — la seule preuve reste le carnet re-couru (lecon du jour :
//   la table ① surestimait de SEPT FOIS).
// ⚙ Usage : `node stats/_vetos_cont_ce_quils_coutent.mjs`  ·  `NMIN=20`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes } from "./_episodes.mjs";
const { MIN_CONT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");

const _num = (k, d) => { const r = process.env[k]; if (r === undefined || String(r).trim() === "") return d;
  const v = Number(r); return Number.isFinite(v) ? v : d; };
const NMIN = _num("NMIN", 20);
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

const E = [];
let rows = 0;
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  const g = (p.ghosts ?? []).filter((c) => c.ghost === "all-rows");
  rows += g.length;
  // ⚠ ON NE `walk` QUE CE QU'ON VA LIRE : simuler 90 000 barres couterait sans rien apprendre.
  for (const x of g) {
    if (!x.contVeto && x.selStrategy !== "CONT" && !String(x.waitNature ?? "").startsWith("cont-")) continue;
    const side = x.contVeto?.side ?? (x.selStrategy === "CONT" ? x.side : null);
    if (!side) continue;
    const r = p.walk({ ...x, side });
    if (r && typeof r.R === "number") E.push({ ...x, asset, contSide: side, R: r.R, outcome: r.outcome });
  }
}

const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => (v.n ? 100 * v.g / v.n : NaN);
const jour = (x) => `${x.asset}|${String(x.tsMT ?? "").slice(0, 10)}`;
const gr = (a) => new Set(a.map(jour)).size;
const eps = (a) => agg(dedupeEpisodes(a.map((x) => ({ ...x }))));
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(36)}${String(a.length).padStart(7)}${wr(agg(a)).toFixed(2).padStart(8)} %${agg(a).R.toFixed(1).padStart(9)}${(agg(a).R / a.length).toFixed(4).padStart(9)}   ${`${eps(a).n} ep / ${wr(eps(a)).toFixed(1)} %`.padStart(16)}${String(gr(a)).padStart(8)}`
  : `   ${lbl.padEnd(36)}      —`;

console.log(`\n══ LE RANG ③ : POURQUOI REFUSE-T-IL ? ══`);
console.log(`   ${rows} lignes balayees · ${E.length} ou le ③ a ete evalue jusqu'a produire un cote · MIN_CONT ${MIN_CONT}`);
console.log(`   ⚠ point mort ${BE},00 % — le R simule une entree CONT a capacite infinie : il CLASSE, il ne chiffre pas.`);

console.log(`\n   ── ① LES TROIS REFUS, DANS L'ORDRE OU LE MOTEUR LES POSE ──`);
console.log(`   ${"".padEnd(36)}${"barres".padStart(7)}${"WR".padStart(9)}${"R net".padStart(9)}${"R/barre".padStart(9)}   ${"episodes".padStart(16)}${"grappes".padStart(8)}`);
const nat = (x) => x.waitNature ?? (x.selStrategy === "CONT" ? "(a TIRE)" : "(autre)");
const par = new Map();
for (const x of E) (par.get(nat(x)) ?? par.set(nat(x), []).get(nat(x))).push(x);
for (const [k, a] of [...par.entries()].sort((x, y) => y[1].length - x[1].length)) L(k, a) && console.log(L(k, a));

// ⭐⭐⭐ LE POINT QUI DECIDE : le veto n'est atteint QUE si la barre a passe le seuil. On mesure donc
//   la population qui LUI EST SOUMISE, pas l'ensemble des refus du rang.
const soumises = E.filter((x) => x.contVeto || x.selStrategy === "CONT");
const bloquees = E.filter((x) => x.contVeto);
const passees = E.filter((x) => x.selStrategy === "CONT");
console.log(`\n   ── ② CE QUI ARRIVE AU VETO (apres `+"`cont-below-min`"+`) ──`);
console.log(L("soumis au veto ③", soumises));
console.log(L("   BLOQUE par un veto ③", bloquees));
console.log(L("   PASSE (le ③ a tire)", passees));
if (soumises.length) console.log(`   ⇒ taux de blocage du veto ③ : ${(100 * bloquees.length / soumises.length).toFixed(1)} % de ce qui lui est soumis`);

console.log(`\n   ── ③ PAR VETO ③ (R net POSITIF = il bloque du GAGNANT, il coute) ──`);
console.log(`   ${"veto".padEnd(36)}${"barres".padStart(7)}${"WR".padStart(9)}${"R net".padStart(9)}${"R/barre".padStart(9)}   ${"episodes".padStart(16)}${"grappes".padStart(8)}`);
const ids = new Map();
for (const x of bloquees) for (const id of new Set(x.contVeto.ids)) (ids.get(id) ?? ids.set(id, []).get(id)).push(x);
const lignes = [...ids.entries()].map(([id, a]) => ({ id, a })).filter((r) => r.a.length >= NMIN)
  .sort((x, y) => agg(y.a).R - agg(x.a).R);
console.log(`   (${ids.size} vetos distincts · ${lignes.length} avec ≥ ${NMIN} barres)`);
for (const r of lignes) console.log(L(r.id, r.a));

// ⭐ LA PART EXCLUSIVE — la seule qu'un retrait libererait. Lecon du ① : sans elle on classe a l'envers.
console.log(`\n   ── ④ LA PART EXCLUSIVE (seul veto ③ sur la barre) ──`);
console.log(`   ${"veto".padEnd(36)}${"exclusif".padStart(9)}${"WR".padStart(9)}${"R net".padStart(9)}${"grappes".padStart(9)}`);
for (const r of lignes) {
  const seul = r.a.filter((x) => new Set(x.contVeto.ids).size === 1);
  if (!seul.length) { console.log(`   ${r.id.padEnd(36)}${"0".padStart(9)}`); continue; }
  console.log(`   ${r.id.padEnd(36)}${String(seul.length).padStart(9)}${wr(agg(seul)).toFixed(2).padStart(8)} %${agg(seul).R.toFixed(1).padStart(9)}${String(gr(seul)).padStart(9)}`);
}
console.log(`\n   ⚠ « exclusif » ≠ « liberable » : la barre peut echouer ailleurs. SEUL LE CARNET RE-COURU PROUVE.\n`);
