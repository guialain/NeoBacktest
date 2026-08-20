// _veto_gap_exclusif_pourquoi.mjs — POURQUOI DESARMER `exh-gap-no-room-ahead` NE REND AUCUN TIR.
// ============================================================================================
// 🔴🔥 LE FAIT (20/08) : `VETO_GAP_AHEAD=off` rend un carnet IDENTIQUE AU BIT PRES — `fires 4 911`,
//   `opened 1 798`, meme R, meme maxDD. Le levier fonctionne pourtant (verifie sur le predicat :
//   `true` sans, `false` avec). Donc ses 1 577 barres « exclusives » echouent AILLEURS.
// ⭐⭐⭐ CE QUE « EXCLUSIF » NE DIT PAS : `vetoed` ne liste QUE des vetos. Une barre peut n'avoir
//   qu'UN veto **et** etre sous `MIN_EXH`, ou perdre au routeur, ou etre mangee par le spacing.
//   ⇒ « seul veto sur la barre » ≠ « le veto est la seule raison qu'elle n'ait pas tire ».
//   C'est la meme faute que « les lignes predisent les tirs », d'un cran plus subtil.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
const { MIN_EXH } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const E = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllExh: true, chargeSpread: true });
  for (const c of (p.ghosts ?? []).filter((x) => x.ghost === "exh-all")) E.push({ ...c, asset: f.replace(/\.csv$/i, "") });
}
const ID = "exh-gap-no-room-ahead";
const porte = E.filter((x) => (x.vetoed ?? []).includes(ID));
const seul = porte.filter((x) => new Set(x.vetoed).size === 1);
const sc = (x) => (Number.isFinite(x.exhScore) ? Math.abs(x.exhScore) : null);
console.log(`\n══ POURQUOI LE DESARMEMENT NE REND RIEN ══`);
console.log(`   ${E.length} barres scorees · ${porte.length} portent \`${ID}\` · ${seul.length} ne portent QUE lui`);
console.log(`   MIN_EXH = ${MIN_EXH}`);
const sousSeuil = seul.filter((x) => sc(x) !== null && sc(x) < MIN_EXH);
const auDessus = seul.filter((x) => sc(x) !== null && sc(x) >= MIN_EXH);
const sansScore = seul.filter((x) => sc(x) === null);
console.log(`\n   parmi les ${seul.length} « exclusives » :`);
console.log(`      score < MIN_EXH  ${String(sousSeuil.length).padStart(5)}  (${(100 * sousSeuil.length / seul.length).toFixed(1)} %)  ⇒ n'auraient PAS tire meme sans le veto`);
console.log(`      score ≥ MIN_EXH  ${String(auDessus.length).padStart(5)}  (${(100 * auDessus.length / seul.length).toFixed(1)} %)  ⇒ les SEULES vraiment liberables`);
console.log(`      sans score       ${String(sansScore.length).padStart(5)}`);
if (auDessus.length) {
  const q = [...auDessus].sort((a, b) => sc(a) - sc(b));
  console.log(`      leurs scores : min ${sc(q[0]).toFixed(2)} · median ${sc(q[Math.floor(q.length / 2)]).toFixed(2)} · max ${sc(q[q.length - 1]).toFixed(2)}`);
  console.log(`      grappes : ${new Set(auDessus.map((x) => `${x.asset}|${String(x.tsMT).slice(0, 10)}`)).size}`);
}
const d = [...sousSeuil].map(sc).sort((a, b) => a - b);
if (d.length) console.log(`      scores des sous-seuil : min ${d[0].toFixed(2)} · median ${d[Math.floor(d.length / 2)].toFixed(2)} · max ${d[d.length - 1].toFixed(2)}`);
