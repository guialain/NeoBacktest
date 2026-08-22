// _cont_rsi_m15_atteint.mjs — LA MOITIE HAUTE DE LA TABLE `rsi` M15 EST-ELLE ATTEIGNABLE AU ③ ?
//
// 🎯 QUESTION : depuis le 22/08 le RSI M15 **LIVE** porte 2/3 de la famille `rsi` du rang ③, avec
//   une rupture a `70` (note 8 -> 3 en franchissant vers le haut, cote BUY). Mais TROIS vetos
//   `%K` M15 refusent deja le bout de course sur la MEME horloge :
//       `m15-k-live-extreme-no-cont` · `cont-m15-bas-converging` · `cont-m15-bas-contact`
//   Or l'epitaphe de `m15-rsi-extreme-no-cont` (16/08) dit : « un RSI M15 live > 72 sur une
//   continuation BUY implique presque toujours un %K M15 en haut de sa plage — les deux capteurs
//   lisent le MEME exces sur la MEME horloge ». Si c'est vrai, la zone que la rupture penalise est
//   DEJA VIDE, et la moitie haute de la table est DECORATIVE — exactement le defaut qu'on vient de
//   corriger sur le H1 (13 cases a zero, 2 inatteignables).
//
// ⭐ ON MESURE SUR LE PERCENTILE ORIENTE DU RSI, pas sur la valeur brute : un BUY a RSI 75 et un
//   SELL a RSI 25 sont le MEME fait pour cette table (miroir `100 - r`). Melanger les deux cotes en
//   valeur brute rendrait la moitie haute artificiellement peuplee par les SELL.
// ⚠ Population = les TIRS du ③, donc APRES tous les vetos. C'est bien la question posee : ce que le
//   bareme peut encore VOIR, pas ce que le marche produit.
//   usage : node stats/_cont_rsi_m15_atteint.mjs   [MIN_CONT=5]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { contNoteRsiPos } = await import("../../Matrix-Revolution/src/components/robot/engines/scoring/contScoringV1.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s));
// ⚠ `rsiM15Live` n'est pas recopie dans la fiche : on le RETROUVE par la note, qui l'est. La note
//   etant monotone par morceaux ET non injective, on ne peut pas inverser — on lit donc directement
//   la valeur si elle est tracee, sinon on se rabat sur la NOTE, qui suffit a la question (la moitie
//   haute de la table = les notes du regime SURACHAT, `r >= 70` => note <= 3 et DECROISSANTE).
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const p = [...g.values()].map((o) => o.w / o.n);
  const m = p.reduce((a, b) => a + b, 0) / p.length;
  return { n: t.length, gr: p.length, wrg: 100 * m, R: t.reduce((a, b) => a + (b.R || 0), 0) }; };

console.log(`\n═══ LA TABLE \`rsi\` M15 EST-ELLE ATTEIGNABLE AU ③ ? ═══  [MIN_CONT=${process.env.MIN_CONT ?? "defaut"}]`);
console.log(`  ${CONT.length} tirs CONT\n`);
// ── ① On reconstruit le RSI ORIENTE a partir de la note M15 quand elle est disponible dans la
//    trace de famille. Sinon on utilise la note de la FAMILLE (melange H1+M15) — signale comme tel.
const fam = (s) => s.sc?.boxes?.cont?.familles?.rsi;
const parts = (s) => s.sc?.boxes?.cont;
const exemple = CONT.find((s) => parts(s));
console.log(`  champs de trace disponibles : ${exemple ? Object.keys(parts(exemple)).join(" · ") : "(aucun)"}`);

// ── ② LA COURBE DE REFERENCE : quelles notes la fonction peut-elle rendre, et sur quel domaine ──
console.log(`\n  ── LA TABLE, PAR REGIME (cote BUY ; le SELL lit \`100 − r\`) ──`);
console.log("  " + "regime".padEnd(16) + "RSI oriente".padEnd(16) + "note".padEnd(16) + "part de l'axe");
console.log("  " + "─".repeat(64));
for (const [nom, lo, hi] of [["SURVENTE", 0, 30], ["TENDANCE", 30, 70], ["SURACHAT", 70, 100]]) {
  const a = contNoteRsiPos(lo + 0.001, "BUY"), b = contNoteRsiPos(hi - 0.001, "BUY");
  console.log("  " + nom.padEnd(16) + `[${lo} · ${hi}[`.padEnd(16) + `${a.toFixed(2)} → ${b.toFixed(2)}`.padEnd(16) + `${hi - lo} points`);
}

// ── ③ LA NOTE **M15 ISOLEE**, prise dans `parts` ────────────────────────────────────────────
// 🔴 CORRECTION DE METHODE : lire la note de FAMILLE ne repond PAS a la question. La famille est
//   (1*H1 + 2*M15)/3 — un M15 en SURACHAT (note 3) avec un H1 a 8 rend 4,67, donc une note
//   parfaitement MOYENNE. Le test doit porter sur la note M15 SEULE, et `parts` la porte.
// ⭐ LECTURE DE L AXE : la fonction n est PAS injective. Mais note < 3 ⟺ r > 70 STRICTEMENT
//   (seul le regime SURACHAT descend sous 3) ⇒ c est le seul test propre du « surachat atteint ».
//   Et note > 8 ⟺ r < 20 (survente profonde). Entre les deux, l axe est ambigu et on ne conclut pas.
const m15 = (s) => s.sc?.boxes?.cont?.parts?.rsiM15;
const h1  = (s) => s.sc?.boxes?.cont?.parts?.rsiH1;
const vM = CONT.map(m15).filter(Number.isFinite), vH = CONT.map(h1).filter(Number.isFinite);
console.log(`
  ── LES DEUX HORLOGES, NOTES ISOLEES ──`);
console.log(`  M15 : ${vM.length} notes · H1 : ${vH.length} notes · sur ${CONT.length} tirs`);
if (!vM.length) { console.log("  🔴 `parts.rsiM15` ABSENT de la trace — mesure impossible."); process.exit(1); }
console.log("  " + "note".padEnd(12) + "M15 tirs".padStart(10) + "part".padStart(9) + "  │" + "H1 tirs".padStart(10) + "part".padStart(9));
console.log("  " + "─".repeat(56));
for (const [lo, hi, lbl] of [[0,1,"[0 · 1["],[1,2,"[1 · 2["],[2,3,"[2 · 3["],[3,4,"[3 · 4["],[4,5,"[4 · 5["],[5,6,"[5 · 6["],[6,7,"[6 · 7["],[7,8,"[7 · 8["],[8,9,"[8 · 9["],[9,11,"[9 · 10]"]]) {
  const nm = vM.filter((x) => x >= lo && x < hi).length, nh = vH.filter((x) => x >= lo && x < hi).length;
  if (!nm && !nh) continue;
  console.log("  " + lbl.padEnd(12) + String(nm).padStart(10) + ((100*nm/vM.length).toFixed(1)+" %").padStart(9)
    + "  │" + String(nh).padStart(10) + ((100*nh/vH.length).toFixed(1)+" %").padStart(9));
}
const surM = vM.filter((x) => x < 3).length, surH = vH.filter((x) => x < 3).length;
const svM = vM.filter((x) => x > 8).length, svH = vH.filter((x) => x > 8).length;
console.log("  " + "─".repeat(56));
console.log(`  SURACHAT atteint (note < 3, soit r > 70 oriente) : M15 ${surM} (${(100*surM/vM.length).toFixed(2)} %) · H1 ${surH} (${(100*surH/vH.length).toFixed(2)} %)`);
console.log(`  SURVENTE profonde (note > 8, soit r < 20)         : M15 ${svM} (${(100*svM/vM.length).toFixed(2)} %) · H1 ${svH} (${(100*svH/vH.length).toFixed(2)} %)`);
console.log(`
  ⇒ le regime SURACHAT couvre **30 points d axe RSI** et la rupture a 70 vaut **−5 points**`);
console.log(`     de note. S il est atteint par moins de 1 % des tirs, cette moitie de table est`);
console.log(`     DECORATIVE — le meme defaut que les 13 cases a zero qu on vient de retirer.
`);
