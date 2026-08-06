// _fill_diff.mjs — LE TAUX DE REMPLISSAGE COLONNE PAR COLONNE, ANCIEN CSV vs NOUVEAU, SUR LES
//   JOURS COMMUNS. Le controle central de la recette de rebuild.
//   usage : node stats/_fill_diff.mjs <dirAncien> <dirNouveau>
//
// ⭐⭐⭐ POURQUOI CELUI-LA ET PAS UNE LISTE DE COLONNES A VERIFIER : `buildAssetCSV` ECRASE le CSV, et
//   l'ancien portait des POST-TRAITEMENTS qui ne sont PAS dans les archives. Un rebuild nu vide des
//   colonnes que le moteur LIT, **sans lever la moindre erreur** — mesure le 31/07 : `zscore_d1`
//   100 % -> 0 %, la famille ADX/DI 99,9 % -> 36 %. La porte EXH aurait ete AVEUGLE sur 64 % des
//   barres. Une liste ecrite a la main ne trouve que ce qu'on sait deja ; ce diff les trouve TOUS.
// ⚠ SUR LES JOURS COMMUNS UNIQUEMENT : comparer sur toute la plage ferait baisser le remplissage du
//   nouveau juste parce qu'il contient des jours en plus, et on lirait une regression la ou il n'y a
//   qu'une extension.
// ⚠ Les `add_*` inutiles ne ressortent pas : leur colonne est deja pleine des deux cotes.
import fs from "fs";

const [DA, DB] = process.argv.slice(2);
if (!DA || !DB) { console.log("usage : node stats/_fill_diff.mjs <dirAncien> <dirNouveau>"); process.exit(1); }

const lire = (dir, sym, joursOk) => {
  const p = `${dir}/${sym}.csv`;
  if (!fs.existsSync(p)) return null;
  const L = fs.readFileSync(p, "utf8").split(/\r?\n/);
  const h = L[0].split(";");
  const iTs = h.indexOf("ts_utc");
  const n = new Array(h.length).fill(0);
  let lignes = 0;
  const jours = new Set();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const j = String(c[iTs]).slice(0, 10);
    jours.add(j);
    if (joursOk && !joursOk.has(j)) continue;      // hors periode commune
    lignes++;
    for (let k = 0; k < h.length; k++) if (c[k] !== "" && c[k] != null) n[k]++;
  }
  return { h, n, lignes, jours };
};

const symboles = fs.readdirSync(DB).filter((f) => f.endsWith(".csv")).map((f) => f.replace(/\.csv$/, ""));

// ── Periode commune, etablie sur le PREMIER symbole puis appliquee a tous ────────────────────
const a0 = lire(DA, symboles[0], null), b0 = lire(DB, symboles[0], null);
if (!a0) { console.log(`ancien absent : ${DA}/${symboles[0]}.csv`); process.exit(1); }
const communs = new Set([...a0.jours].filter((j) => b0.jours.has(j)));
const nouveaux = [...b0.jours].filter((j) => !a0.jours.has(j)).sort();
console.log(`jours ancien ${a0.jours.size} · nouveau ${b0.jours.size} · COMMUNS ${communs.size}`);
console.log(`jours AJOUTES : ${nouveaux.join(" ") || "aucun"}\n`);

// ── En-tetes identiques ? Une colonne qui apparait/disparait est un signal a part entiere ────
let entetesKo = 0;
for (const s of symboles) {
  const A = lire(DA, s, communs), B = lire(DB, s, communs);
  if (!A) { console.log(`⚠ ${s} : absent de l'ancien`); entetesKo++; continue; }
  if (A.h.join(";") !== B.h.join(";")) {
    const seulA = A.h.filter((c) => !B.h.includes(c)), seulB = B.h.filter((c) => !A.h.includes(c));
    console.log(`⚠ ${s} : en-tetes DIFFERENTS — perdues [${seulA.join(",")}] · gagnees [${seulB.join(",")}]`);
    entetesKo++;
  }
}
console.log(entetesKo ? `\n⚠ ${entetesKo} symbole(s) a en-tete divergent\n` : "en-tetes : 19/19 identiques\n");

// ── LE DIFF DE REMPLISSAGE, agrege sur tous les symboles ────────────────────────────────────
const A = {}, B = {}, TOT = { a: 0, b: 0 };
for (const s of symboles) {
  const x = lire(DA, s, communs), y = lire(DB, s, communs);
  if (!x) continue;
  TOT.a += x.lignes; TOT.b += y.lignes;
  x.h.forEach((c, k) => { A[c] = (A[c] || 0) + x.n[k]; });
  y.h.forEach((c, k) => { B[c] = (B[c] || 0) + y.n[k]; });
}
console.log(`lignes sur la periode commune : ancien ${TOT.a} · nouveau ${TOT.b}` +
            (TOT.a !== TOT.b ? `  ⚠ ecart ${TOT.b - TOT.a} (week-ends retires ? jours partiels ?)` : ""));

const pertes = [];
for (const c of Object.keys(B)) {
  const pa = TOT.a ? (100 * (A[c] || 0)) / TOT.a : 0;
  const pb = TOT.b ? (100 * (B[c] || 0)) / TOT.b : 0;
  if (pb < pa - 0.5) pertes.push({ c, pa, pb, d: pb - pa });
}
pertes.sort((x, y) => x.d - y.d);
console.log(`\n${"═".repeat(72)}`);
if (!pertes.length) {
  console.log("✅ AUCUNE COLONNE NE PERD DE REMPLISSAGE — les post-traitements sont tous appliques.");
} else {
  console.log(`🔴 ${pertes.length} COLONNE(S) PERDENT DU REMPLISSAGE — post-traitement manquant :`);
  console.log("colonne                          ancien    nouveau     delta");
  for (const p of pertes) {
    console.log(p.c.padEnd(32) + `${p.pa.toFixed(1).padStart(6)} %  ${p.pb.toFixed(1).padStart(7)} %  ${p.d.toFixed(1).padStart(8)}`);
  }
}
