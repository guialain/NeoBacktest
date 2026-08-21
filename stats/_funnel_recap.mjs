// _funnel_recap.mjs — LE FUNNEL COMPLET : combien de lignes ENTRENT, combien ARRIVENT a chaque rang.
// ============================================================================================
// ⚠⚠ TROIS COMPTEURS DIFFERENTS EXISTENT ET ILS NE MESURENT PAS LA MEME CHOSE. Les confondre est
//   la faute la plus facile de ce fichier :
//     · `rows`   — les lignes du CSV (~23 000 par actif, ~437 000 au total).
//     · `evals`  — le compteur du MOTEUR (`SUM.evals`), ce qu'il a reellement evalue.
//     · `ghostAllRows` — ce que le collecteur voit. Il est pousse APRES `det`, donc APRES tout
//       `continue` place plus haut dans la boucle : il en voit MOINS que `rows`.
//   ⇒ On imprime les TROIS et on nomme l'ecart, plutot que d'en choisir un et d'appeler ca « les
//     lignes ». Un funnel dont la premiere ligne est ambigue ne prouve rien de ce qui suit.
// ⚙ Usage : `node stats/_funnel_recap.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset, runMatrixPortfolio } from "../src/components/simulations/matrixBacktest.mjs";
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring";
const { MIN_EXH, MIN_PRES, MIN_CONT } = await import(`${M}/scoringDecision.js`);
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const fichiers = fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort();

// ── ① LE CARNET REEL, pour ses compteurs de moteur ────────────────────────────────────────────
const RUN = runMatrixPortfolio(fichiers.map((f) => path.join(MATRIX, f)),
  { maxOpen: 100, maxPerSymbol: 100, cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });
const S = RUN.summary ?? {};
const parRang = new Map();
for (const t of (RUN.signals ?? [])) parRang.set(t.strategy, (parRang.get(t.strategy) ?? 0) + 1);

// ── ② LE COLLECTEUR, pour la ventilation par DESTIN ───────────────────────────────────────────
let vus = 0, lignesCsv = 0;
const destin = new Map();
const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
for (const f of fichiers) {
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  lignesCsv += p.meta?.rowsLen ?? 0;
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    vus++;
    if (x.selStrategy) bump(destin, `FIRE ${x.selStrategy}`);
    else bump(destin, `WAIT ${x.waitNature ?? "(sans nature)"}`);
  }
}

const pc = (n, d) => (d ? (100 * n / d).toFixed(2).padStart(6) : "   —  ");
console.log(`\n══ FUNNEL — DE LA LIGNE AU TRADE ══`);
console.log(`   MIN_EXH ${MIN_EXH} · MIN_PRES ${MIN_PRES} · MIN_CONT ${MIN_CONT} · capacite 100/100 · NO_TRIGGER=1`);

console.log(`\n   ── ① LES TROIS COMPTEURS D'ENTREE (ils ne mesurent PAS la meme chose) ──`);
console.log(`      lignes CSV (rowsLen)            ${String(lignesCsv).padStart(8)}   ce que le fichier contient`);
console.log(`      evals (compteur MOTEUR)         ${String(S.evals ?? 0).padStart(8)}   ce que le moteur a evalue`);
console.log(`      vues par le collecteur          ${String(vus).padStart(8)}   ${pc(vus, lignesCsv)} % des lignes CSV`);
console.log(`      ⇒ ecart CSV vs collecteur : ${lignesCsv - vus} lignes n'atteignent PAS le point de collecte`);
console.log(`        (le fantome est pousse APRES \`det\`, donc apres tout \`continue\` place plus haut)`);

console.log(`\n   ── ② OU VONT LES ${vus} LIGNES VUES ──`);
console.log(`      ${"destin".padEnd(34)}${"lignes".padStart(8)}${"part".padStart(9)}`);
for (const [k, v] of [...destin.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`      ${k.padEnd(34)}${String(v).padStart(8)}${pc(v, vus)} %`);

console.log(`\n   ── ③ CE QUI ARRIVE A CHAQUE RANG (candidats retenus par la cascade) ──`);
const fireEXH = destin.get("FIRE EXH") ?? 0, firePB = destin.get("FIRE PB") ?? 0, fireCONT = destin.get("FIRE CONT") ?? 0;
const tot = fireEXH + firePB + fireCONT;
console.log(`      ① EXH   ${String(fireEXH).padStart(7)}   ${pc(fireEXH, vus)} % des lignes   ${pc(fireEXH, tot)} % des candidats`);
console.log(`      ② PB    ${String(firePB).padStart(7)}   ${pc(firePB, vus)} % des lignes   ${pc(firePB, tot)} % des candidats`);
console.log(`      ③ CONT  ${String(fireCONT).padStart(7)}   ${pc(fireCONT, vus)} % des lignes   ${pc(fireCONT, tot)} % des candidats`);

console.log(`\n   ── ④ DU CANDIDAT AU TRADE (compteurs du moteur) ──`);
console.log(`      fires (un cote resolu)          ${String(S.fires ?? 0).padStart(8)}`);
console.log(`      opened (trades ouverts)         ${String(S.opened ?? 0).padStart(8)}   ${pc(S.opened, S.fires)} % des fires`);
console.log(`      refuses par CAPACITE            ${String(S.rejectedCap ?? 0).padStart(8)}`);
console.log(`      refuses par SPACING             ${String(S.rejSpacingTotal ?? 0).padStart(8)}   ${pc(S.rejSpacingTotal, S.fires)} % des fires`);
console.log(`      ⇒ par rang : ${[...parRang.entries()].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
// ⚠ `fires` compte les CANDIDATS du moteur, `destin` compte les BARRES vues par le collecteur.
//   L'ecart entre les deux est la cadence (2 min) et la deduplication interne — pas une perte.
console.log(`\n   ⚠ \`fires\` (moteur) et les \`FIRE *\` (collecteur) ne coincident PAS : la cadence 2 min`);
console.log(`     et le spacing agissent APRES la selection. L'ecart n'est pas une perte, c'est un filtre aval.\n`);
