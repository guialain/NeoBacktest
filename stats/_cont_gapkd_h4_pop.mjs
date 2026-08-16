// _cont_gapkd_h4_pop.mjs — LA POPULATION DES 36 CASES DE `gapKd` AVEC LA COLONNE **H4**.
// ⚠ DESCRIPTIF SEUL. Aucune note dictee, aucun A/B, aucun tir compte.
//
// 🎯 LE VIDE QU'ELLE COMBLE, ecrit dans `contScoringV1` (entree ⑸, 13/08) : « Premiere chose a
//   mesurer sur cette entree : la population des 36 cases avec la colonne H4. Elle ne sera PAS celle
//   du H1 — le `K−D` H4 change de signe bien plus rarement, donc la colonne `CONTACT` (bande morte
//   ±2,1) y sera nettement plus lourde. » Cette phrase n'a jamais eu de chiffre.
//
// ⭐⭐⭐ ET LA VRAIE QUESTION N'EST PAS LA POPULATION, C'EST LA REDONDANCE. La famille `gapKd` est une
//   MOYENNE 1:1 de deux membres qui partagent la LIGNE (`gapAtr` H1) et ne different que par la
//   COLONNE. Trois cas, et un seul justifie l'entree ⑸ :
//     · les deux colonnes coincident         ⇒ la famille compte DEUX FOIS la meme voix
//     · le H4 est MUET (`kdGap` absent)      ⇒ le H1 parle seul a pleine amplitude — inoffensif
//     · le H4 rend `0` alors que le H1 note  ⇒ 🔴 il DILUE DE MOITIE, et `0` n'est PAS un silence
//   Le 3e cas est le motif `scoring_penalise_le_silence` deja mesure sur le RSI M15 du meme rang
//   (23,91 % des barres, un tiers de la note retiree). Ici la famille n'a que DEUX membres a poids
//   egaux : un `0` cote H4 coute la MOITIE, pas un tiers.
//   ⚠ `KD_NEG` vaut `0` sur les 12 lignes et `CONTACT` vaut `0` sur les 6 lignes `HAUT_*` — donc
//   « le H4 rend 0 » est un evenement FREQUENT par construction, pas un cas limite.
//
// ⚠ CLASSIFICATEURS IMPORTES, JAMAIS RECOPIES (`gapKdCote`, `gapKdCol`, `computeDeviation`,
//   `contNoteGapKd`) : recopier un barreau ici ferait ranger la meme barre dans deux cases
//   differentes que le moteur — la faute `derived_dataset_computed_3x`.
// ⚠ POPULATION = le RESIDU que le rang ③ atteint reellement (`rangCont`, pose par le moteur depuis
//   la cascade), **PAR COTE**. Reconstruire la cascade ici recopierait un arbre de decision qui
//   change toutes les semaines. Et un ecart qui CHANGE DE SIGNE entre les cotes est invisible dans
//   l'agregat (lecon du 15/08, §7) ⇒ les deux cotes tournent, jamais leur somme.
// ⚠ TOUT EST LIVE (`zscore_h1_s0 x sigma_h1` pour la ligne, `k_s0 − d_s0` pour les colonnes) :
//   c'est la convention de l'entree ⑷/⑸. Passer `gapAtrClose` produirait un tableau plausible et faux.
// ⚠ UN ACTIF A LA FOIS, `rows` relache ensuite (OOM mesure a 4 Go).
//   usage : node stats/_cont_gapkd_h4_pop.mjs
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines";
const { gapKdCote, gapKdCol, GAP_KD_COLS, GAP_KD_ROWS } = await import(`${R}/scoring/exhScoringV1.js`);
const { contNoteGapKd } = await import(`${R}/scoring/contScoringV1.js`);
const { computeDeviation } = await import(`${R}/config/DeviationConfig.js`);
const { STOCHDYN_CONTACT } = await import(`${R}/opportunities/OpportunityDetector.js`);
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const COTES = ["BUY", "SELL"];
// ⚠ Les CHAMPS dont la sonde a besoin, et rien d'autre : on ne construit un objet-ligne que pour
//   les barres retenues (434 k x 278 colonnes en objets = heap OOM, piege nomme du depot).
const CHAMPS = ["symbol", "price", "zscore_h1_s0", "sigma_h1",
                "stoch_k_h1_s0", "stoch_d_h1_s0", "stoch_k_h4_s0", "stoch_d_h4_s0"];

const MORT = Number(process.env.MORT ?? 5);
let nGele = 0;
const vide = () => { const g = {}; for (const r of GAP_KD_ROWS) { g[r] = {}; for (const c of GAP_KD_COLS) g[r][c] = 0; } return g; };
const S = {};
for (const c of COTES) S[c] = {
  n: 0, pop: { H1: vide(), H4: vide() },
  muet: { H1: 0, H4: 0, ligne: 0 },          // ligne muette = `gapAtr`/`level` absents ⇒ les DEUX membres se taisent
  accord: 0,                                  // meme COLONNE sur les deux horloges
  accordNote: 0,                              // meme NOTE sur les deux horloges
  dilue: 0, diluePerte: 0,                    // H4 = 0 alors que H1 > 0  ⇒ la famille tombe de moitie
  porte: 0, portePerte: 0,                    // H1 = 0 alors que H4 > 0  ⇒ le H4 fait TRAVAILLER la famille
  h4Seul: 0,                                  // H1 muet, H4 present
  nH1: {}, nH4: {}, nFam: {},                 // distributions de note
  couples: {},                                // 🔴 (n1,n4) → n : ce que la MOYENNE 1:1 CONFOND
  sumH1: 0, sumFam: 0,
};

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f);
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const iTs = head.indexOf("timestamp");
  const ix = {}; for (const n of CHAMPS) ix[n] = head.indexOf(n);
  const manquants = CHAMPS.filter((n) => ix[n] < 0);
  // 🔴 UN CHAMP ABSENT DOIT LEVER, PAS SE TAIRE : sans ca la sonde rendrait « 100 % muet » et on
  //   lirait « le H4 ne dit rien » au lieu de « la colonne n'est pas dans le fichier ».
  if (manquants.length) throw new Error(`${f} : champs absents — ${manquants.join(", ")}`);
  const rows = new Map();
  // 🔴🔥⭐⭐⭐ LES LIGNES MORTES SONT EXCLUES (16/08, apres objection owner) — cf. `_gel_deux_horloges`.
  //   Pendant une panne broker le terminal MT5 ne se rafraichit plus : `timestamp` (heure du DERNIER
  //   TICK) reste fige pendant que le collecteur ecrit une ligne par minute. ⇒ un MEME instant de
  //   marche est compte jusqu'a 226 fois, et ce n'est PAS du bruit aleatoire : c'est concentre sur
  //   6 moments precis (2,99 % du dataset). Une case de barème peut y prendre du poids sans qu'aucun
  //   marche ne l'ait produite.
  // ⚠ LA DETECTION SE FAIT SUR LE COMPTE PAR HORODATAGE, et pas autrement : dans un bloc gele les
  //   226 lignes portent LE MEME `timestamp`, donc `tsMT` ne peut pas distinguer la ligne legitime
  //   des 225 mortes. On exclut le bloc ENTIER — on perd 1 observation vraie sur 226, ce qui est
  //   conservateur dans le bon sens.
  const nParTs = new Map();
  for (const l of L.slice(1)) { const c = l.split(";"); rows.set(c[iTs], c);
    nParTs.set(c[iTs], (nParTs.get(c[iTs]) ?? 0) + 1); }
  const gele = new Set([...nParTs].filter(([, n]) => n >= MORT).map(([t]) => t));

  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes" || !x.rangCont) continue;      // ⚠ la cascade n'est PAS arrivee au rang ③
    if (gele.has(x.tsMT)) { nGele++; continue; }           // 🔴 ligne morte : panne broker
    const s = S[x.side]; if (!s) continue;
    const c = rows.get(x.tsMT); if (!c) continue;
    s.n++;
    const row = {}; for (const n of CHAMPS) row[n] = c[ix[n]];
    const num = (k) => { const v = row[k]; return v === "" || v == null ? null : Number(v); };
    const d = computeDeviation(row, String(row.symbol || ""), "h1");
    const gapAtr = Number.isFinite(d?.gapAtr) ? d.gapAtr : null, level = d?.level ?? null;
    const kd = (tf) => { const k = num(`stoch_k_${tf}_s0`), dd = num(`stoch_d_${tf}_s0`);
                         return (k == null || dd == null) ? null : k - dd; };
    const kdH1 = kd("h1"), kdH4 = kd("h4");
    if (gapAtr == null || !level) { s.muet.ligne++; s.muet.H1++; s.muet.H4++; continue; }
    const ligne = `${gapKdCote(gapAtr)}_${level}`;
    for (const [tf, v] of [["H1", kdH1], ["H4", kdH4]]) {
      if (!Number.isFinite(v)) { s.muet[tf]++; continue; }
      s.pop[tf][ligne][gapKdCol(v)]++;
    }
    // ── les NOTES reelles, par le barème lui-même ──
    const n1 = contNoteGapKd(gapAtr, level, kdH1, x.side);
    const n4 = contNoteGapKd(gapAtr, level, kdH4, x.side);
    const ids = [n1, n4].filter((v) => Number.isFinite(v));
    const fam = ids.length ? ids.reduce((a, b) => a + b, 0) / ids.length : null;
    if (Number.isFinite(n1)) { s.nH1[n1] = (s.nH1[n1] ?? 0) + 1; s.sumH1 += n1; }
    if (Number.isFinite(n4)) s.nH4[n4] = (s.nH4[n4] ?? 0) + 1;
    if (Number.isFinite(fam)) { s.nFam[fam.toFixed(1)] = (s.nFam[fam.toFixed(1)] ?? 0) + 1; s.sumFam += fam; }
    if (Number.isFinite(n1) && Number.isFinite(n4)) {
      const cle = `${fam.toFixed(1)}|${n1}+${n4}`; s.couples[cle] = (s.couples[cle] ?? 0) + 1;
    }
    if (Number.isFinite(kdH1) && Number.isFinite(kdH4)) {
      if (gapKdCol(kdH1) === gapKdCol(kdH4)) s.accord++;
      if (n1 === n4) s.accordNote++;
      if (n4 === 0 && n1 > 0) { s.dilue++; s.diluePerte += n1 / 2; }
      if (n1 === 0 && n4 > 0) { s.porte++; s.portePerte += n4 / 2; }
    }
    if (!Number.isFinite(n1) && Number.isFinite(n4)) s.h4Seul++;
  }
  rows.clear();
}

const pc = (n, t) => (t ? (100 * n / t).toFixed(2) : "0.00") + " %";
console.log(`\n══ RANG ③ · FAMILLE \`gapKd\` · POPULATION DU RESIDU · bande morte ±${STOCHDYN_CONTACT} ══`);
for (const cote of COTES) {
  const s = S[cote]; if (!s.n) { console.log(`\n── ${cote} : AUCUNE barre ──`); continue; }
  console.log(`\n████ ${cote} — ${s.n} barres atteintes par la cascade au rang ③ ████`);
  console.log(`  ligne muette (gapAtr/level absents) : ${s.muet.ligne}  ${pc(s.muet.ligne, s.n)}`);
  for (const tf of ["H1", "H4"]) {
    const t = s.n - s.muet[tf];
    console.log(`\n  ── COLONNE ${tf} ── (${t} barres notees · muettes ${s.muet[tf]} = ${pc(s.muet[tf], s.n)})`);
    console.log("  ligne".padEnd(20) + GAP_KD_COLS.map((c) => c.padStart(11)).join("") + "     total");
    const parCol = { KD_POS: 0, CONTACT: 0, KD_NEG: 0 };
    for (const r of GAP_KD_ROWS) {
      const row = s.pop[tf][r], t0 = GAP_KD_COLS.reduce((a, c) => a + row[c], 0);
      for (const c of GAP_KD_COLS) parCol[c] += row[c];
      console.log("  " + r.padEnd(18) + GAP_KD_COLS.map((c) => pc(row[c], t).padStart(11)).join("")
        + pc(t0, t).padStart(11) + (t0 === 0 ? "  🔴 VIDE" : t0 * 100 / t < 1 ? "  ⚠ <1 %" : ""));
    }
    console.log("  " + "COLONNE".padEnd(18) + GAP_KD_COLS.map((c) => pc(parCol[c], t).padStart(11)).join(""));
    const cases = GAP_KD_ROWS.flatMap((r) => GAP_KD_COLS.map((c) => s.pop[tf][r][c]));
    console.log(`  → case la mieux peuplee : ${pc(Math.max(...cases), t)} · cases non vides : ${cases.filter((v) => v > 0).length}/36`);
  }
  const both = s.n - s.muet.ligne - Math.max(0, s.muet.H1 - s.muet.ligne) - Math.max(0, s.muet.H4 - s.muet.ligne);
  console.log(`\n  ── LES DEUX MEMBRES, SUR LES BARRES OU ILS PARLENT TOUS LES DEUX (${both}) ──`);
  console.log(`  meme COLONNE ............... ${s.accord}  ${pc(s.accord, both)}`);
  console.log(`  meme NOTE .................. ${s.accordNote}  ${pc(s.accordNote, both)}`);
  console.log(`  🔴 H4 = 0 et H1 > 0 (DILUE)  ${s.dilue}  ${pc(s.dilue, both)}   · note perdue : ${s.diluePerte.toFixed(0)} pts cumules`);
  console.log(`  H1 = 0 et H4 > 0 (le H4 PORTE) ${s.porte}  ${pc(s.porte, both)}   · note ajoutee : ${s.portePerte.toFixed(0)} pts cumules`);
  console.log(`  H1 muet, H4 seul ........... ${s.h4Seul}  ${pc(s.h4Seul, s.n)}`);
  const dist = (lab, o, t) => console.log(`  ${lab.padEnd(10)}` + Object.entries(o).sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([k, v]) => `${k}→${pc(v, t)}`).join("  "));
  console.log(`\n  ── DISTRIBUTION DES NOTES ──`);
  dist("H1", s.nH1, s.n - s.muet.H1);
  dist("H4", s.nH4, s.n - s.muet.H4);
  dist("FAMILLE", s.nFam, s.n - s.muet.ligne);
  const nn = s.n - s.muet.ligne;
  console.log(`  moyenne : H1 SEUL ${(s.sumH1 / Math.max(1, s.n - s.muet.H1)).toFixed(3)}   ·   FAMILLE (H1+H4)/2 ${(s.sumFam / Math.max(1, nn)).toFixed(3)}`);
  // ⭐⭐⭐ CE QUE LA MOYENNE 1:1 CONFOND — deux horloges QUASI INDEPENDANTES qui disent `10 & 0`
  //   rendent la MEME note que deux horloges D'ACCORD a `5`. La moyenne est indifferente a l'accord ;
  //   c'est l'argument que le fichier oppose lui-meme a la moyenne ENTRE familles.
  console.log(`\n  ── COLLISION DE LA MOYENNE 1:1 (note famille ← couples (H1+H4)) ──`);
  const parFam = {};
  for (const [k, v] of Object.entries(s.couples)) { const [f, c] = k.split("|"); (parFam[f] ??= []).push([c, v]); }
  for (const f of Object.keys(parFam).sort((a, b) => Number(b) - Number(a))) {
    const l = parFam[f].sort((a, b) => b[1] - a[1]);
    const tot = l.reduce((a, b) => a + b[1], 0);
    console.log(`  ${f.padStart(5)}  ${pc(tot, nn).padStart(8)}  ← ${l.length} couple(s) : `
      + l.map(([c, v]) => `${c} ${pc(v, tot)}`).join("  ") + (l.length > 1 ? "  ⚠ CONFONDUS" : ""));
  }
}
