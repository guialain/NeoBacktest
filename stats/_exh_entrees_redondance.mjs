// _exh_entrees_redondance.mjs — LES 8 ENTREES DU RANG ① SE REPETENT-ELLES ?
// ============================================================================================
// 🎯 PREREQUIS NOMME (owner 12/08) : « kdH1 est devenu de trop vu que gapAtr croise avec K donne
//   deja l'info et de facon plus precise, meme chose pour kH1 ; kH4 merite de rester car sur un TF
//   different ». Avant de retirer 2 entrees sur 8, on verifie que la redondance est REELLE.
// ⚠⚠ ON MESURE SUR LES **NOTES**, PAS SUR LES CAPTEURS BRUTS. Deux capteurs correles peuvent donner
//   des notes independantes (les tables les decoupent differemment), et l'inverse est vrai aussi.
//   C'est la note qui entre dans la somme — c'est donc elle qu'il faut regarder.
// ⚠ Population = TOUTES les barres ou le rang ① est evalue, cote JOUE (`eSide`). Mesurer sur les
//   TIRS serait un collider : on conditionnerait sur le score qu'on etudie.
// ⭐ `sc.boxes.exh.parts` porte les 8 notes SIGNEES. La somme passe par les FAMILLES, pas par les
//   parts — mais pour une question de redondance ce sont bien les parts qui parlent.
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const { prepareAsset } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const IDS = ["gap", "kH1", "kdH1", "kH4", "rsiTrendH1", "rsiM15", "adx", "di"];
const V = Object.fromEntries(IDS.map((k) => [k, []]));
let n = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  for (const x of (prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes" || !x.eParts) continue;
    n++;
    for (const k of IDS) V[k].push(Number.isFinite(x.eParts[k]) ? x.eParts[k] : null);
  }
}
if (!n) { console.log("\n  🔴 `eParts` absent du fantome — rien a mesurer. Ajouter `eParts: bx.exh?.parts` cote bkt.\n"); process.exit(0); }
const corr = (a, b) => {
  const p = [];
  for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) p.push([a[i], b[i]]);
  if (p.length < 100) return null;
  const m = (j) => p.reduce((s, x) => s + x[j], 0) / p.length;
  const ma = m(0), mb = m(1);
  const cov = p.reduce((s, x) => s + (x[0] - ma) * (x[1] - mb), 0) / p.length;
  const sa = Math.sqrt(p.reduce((s, x) => s + (x[0] - ma) ** 2, 0) / p.length);
  const sb = Math.sqrt(p.reduce((s, x) => s + (x[1] - mb) ** 2, 0) / p.length);
  return (sa && sb) ? cov / (sa * sb) : null;
};
console.log(`\n══ RANG ① · CORRELATION ENTRE LES 8 NOTES (${n} barres, cote JOUE) ══`);
console.log(`  ⚠ Une correlation ELEVEE = les deux entrees disent la meme chose ⇒ double comptage.`);
console.log(`    Une correlation NEGATIVE = elles se CONTREDISENT ⇒ auto-annulation (le defaut mesure`);
console.log(`    a 42,8 % sur \`kH1\`+\`kdH1\` le 12/08 au matin).\n`);
process.stdout.write("             " + IDS.map((k) => k.slice(0, 6).padStart(7)).join("") + "\n");
for (const a of IDS) {
  let l = "  " + a.padEnd(11);
  for (const b of IDS) l += (a === b ? "    —  " : (corr(V[a], V[b]) == null ? "    ?  " : corr(V[a], V[b]).toFixed(2).padStart(7)));
  console.log(l);
}
console.log(`\n  ── SILENCE PAR ENTREE (une entree souvent muette pese moins qu'elle n'annonce) ──`);
for (const k of IDS) {
  const m = V[k].filter((v) => v == null).length;
  console.log(`     ${k.padEnd(12)} muette ${(100 * m / n).toFixed(2).padStart(6)} %`);
}
