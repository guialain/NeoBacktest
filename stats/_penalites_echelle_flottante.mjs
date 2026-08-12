// _penalites_echelle_flottante.mjs — LE SEUIL EST FIXE, MAIS L'ECHELLE QU'IL COUPE NE L'EST PAS.
// ============================================================================================
// ⚠⚠ LA QUESTION, ET ELLE N'EST PAS CELLE DU CALIBRAGE. Les trois baremes SOMMENT DES FAMILLES et
//   **retirent de la somme toute famille entierement muette** (`if (!ids.length) continue`). L'echelle
//   atteignable n'est donc PAS une constante : elle vaut `n_familles_presentes x amplitude`. Or
//   `SEUIL_V1`, `MIN_PB` et `MIN_CONT` sont des nombres ABSOLUS.
//   ⇒ **Deux barres qui recoivent le meme score ne sont pas jugees sur la meme echelle**, et rien
//   dans la trace ne le dit. Une barre a 3 familles sur 5 est notee sur `[-27,9 . +27,9]` et comparee
//   au meme `10` qu'une barre a 5 familles notee sur `[-46,5 . +46,5]`.
// ⭐ C'EST LA MEME QUESTION QUE `null` vs `0`, MAIS D'UN CRAN AU-DESSUS. Dans la famille, le choix est
//   tranche (rang ① dilue a `0`, rangs ②③ retirent du denominateur). ENTRE les familles, personne n'a
//   tranche : on retire, donc on RACCOURCIT L'ECHELLE, ce qui n'est ni diluer ni amplifier — c'est
//   deplacer le seuil sans le dire.
// 🎯 CE QUE CETTE SONDE MESURE, ET RIEN D'AUTRE : a quelle FREQUENCE l'echelle est raccourcie, de
//   COMBIEN, et sur quelle part du volume le seuil change donc de hauteur RELATIVE. Elle ne lit
//   aucun resultat de trade — c'est une propriete de la MECANIQUE, pas une performance.
// ⚠ `file:///C:/...` en dur : sur Windows un chemin absolu nu est refuse par le chargeur ESM.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { prepareAsset } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

// Amplitude NOMINALE d'une famille, par rang. ⚠ Rang ① : les 5 familles ne valent PAS ±10 —
//   `stochH1` et `adx` sont des moyennes ponderees de 2 entrees a ±10, `rsi` idem ; l'echelle
//   annoncee du rang ① est `[-46,5 . +46,5]`, soit 9,3 par famille en moyenne. On lit donc
//   l'echelle ANNONCEE et on la divise par le nombre de familles — c'est l'approximation que fait
//   deja tout lecteur du seuil.
const RANGS = {
  EXH:  { n: 5, echelle: 46.5, seuil: 10,  fam: "eFam", conv: "eConv" },
  PB:   { n: 3, echelle: 30,   seuil: 10,  fam: "pFam", conv: "pConv" },
  CONT: { n: 4, echelle: 40,   seuil: 0.1, fam: "cFam", conv: "cConv" },
};

const S = {};
for (const r of Object.keys(RANGS)) S[r] = { n: 0, parFam: new Map(), scores: [] };

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f);
  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes") continue;
    for (const [r, cfg] of Object.entries(RANGS)) {
      const k = x[cfg.fam];
      // ⚠ `null` = le bareme n'a PAS tourne sur cette barre (portes d'appartenance en amont), et ce
      //   n'est PAS « 0 famille ». Les confondre gonflerait la case la plus alarmante du tableau.
      if (!Number.isFinite(k)) continue;
      const A = S[r]; A.n++;
      A.parFam.set(k, (A.parFam.get(k) ?? 0) + 1);
      if (Number.isFinite(x[cfg.conv])) A.scores.push({ k, c: x[cfg.conv] });
    }
  }
}

const pc = (n, t) => (t ? (100 * n / t).toFixed(2) : "0.00") + " %";
console.log(`\n══ L'ECHELLE FLOTTE — combien de FAMILLES parlent, et ce que le seuil vaut alors ══`);
for (const [r, cfg] of Object.entries(RANGS)) {
  const A = S[r];
  if (!A.n) { console.log(`\n  ── ${r} — aucune barre lue (la boite n'expose pas \`familles\`)`); continue; }
  console.log(`\n  ── ${r} — ${A.n} barres · echelle NOMINALE +/-${cfg.echelle} sur ${cfg.n} familles · seuil ${cfg.seuil}`);
  console.log(`     fam.  barres        part      echelle reelle   le seuil vaut alors`);
  for (const k of [...A.parFam.keys()].sort((a, b) => b - a)) {
    const n = A.parFam.get(k);
    const ech = +(cfg.echelle * k / cfg.n).toFixed(1);
    const rel = ech ? (100 * cfg.seuil / ech).toFixed(1) + " %" : "—";
    console.log(`      ${k}/${cfg.n}  ${String(n).padStart(7)}  ${pc(n, A.n).padStart(9)}   +/-${String(ech).padStart(6)}      ${rel.padStart(8)} de l'echelle`);
  }
  const complet = A.parFam.get(cfg.n) ?? 0;
  console.log(`     ⇒ echelle PLEINE sur ${pc(complet, A.n)} des barres · RACCOURCIE sur ${pc(A.n - complet, A.n)}`);
  // Ce que ca change au SEUIL : part des barres sous le seuil, par nombre de familles.
  if (A.scores.length) {
    console.log(`     part des barres qui PASSENT le seuil ${cfg.seuil}, par nombre de familles :`);
    for (const k of [...A.parFam.keys()].sort((a, b) => b - a)) {
      const g = A.scores.filter((s) => s.k === k);
      if (!g.length) continue;
      const pass = g.filter((s) => s.c >= cfg.seuil).length;
      console.log(`       ${k}/${cfg.n}  ${String(g.length).padStart(7)} barres  passent ${pc(pass, g.length).padStart(8)}`);
    }
  }
}
// ══ ② LE BONUS DU RANG ③ — DECIDE-T-IL, OU ENCOURAGE-T-IL ? ═════════════════════════════════
// ⭐⭐⭐ LA QUESTION N'EST PAS « combien vaut le bonus » MAIS « combien de barres change-t-il de
//   verdict ». Un bonus de `3` face a un `MIN_CONT` de `0,1` vaut **30 fois le seuil** : sur le
//   papier il decide seul de toute barre dont le bareme est entre `-2,9` et `+0,1`. Reste a savoir
//   sur QUELLE PART DU VOLUME cette fenetre tombe — c'est la seule chose qui compte.
// ⚠ Le rang ③ est le SEUL des trois a etre bonifie. Les bonus EXH sont calcules et jamais ajoutes.
{
  let n = 0, avecBonus = 0, bascule = 0, basculeInverse = 0, sommeB = 0;
  const abs = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
    for (const x of (prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
      if (x.ghost !== "boxes" || !Number.isFinite(x.cRaw) || !Number.isFinite(x.cConv)) continue;
      n++; abs.push(Math.abs(x.cRaw));
      if (x.cBonus) { avecBonus++; sommeB += Math.abs(x.cBonus); }
      const passeAvec = x.cConv >= 0.1, passeSans = x.cRaw >= 0.1;
      if (passeAvec && !passeSans) bascule++;            // le bonus OUVRE la porte
      if (!passeAvec && passeSans) basculeInverse++;     // le bonus la FERME (signe oppose au cote)
    }
  }
  console.log(`\n  ── LE BONUS CONT — decide-t-il ? (${n} barres notees) ──`);
  console.log(`     bonus NON NUL          ${String(avecBonus).padStart(7)}   ${pc(avecBonus, n)}   |bonus| moyen quand present ${(avecBonus ? sommeB / avecBonus : 0).toFixed(2)}`);
  console.log(`     le bonus OUVRE la porte ${String(bascule).padStart(6)}   ${pc(bascule, n)}   (bareme sous le seuil, bonifie au-dessus)`);
  console.log(`     le bonus FERME la porte ${String(basculeInverse).padStart(6)}   ${pc(basculeInverse, n)}   (bonus de signe oppose au cote joue)`);
  console.log(`     ⇒ le bonus CHANGE LE VERDICT sur ${pc(bascule + basculeInverse, n)} des barres notees.`);
  abs.sort((u, v) => u - v);
  const q = (r) => abs[Math.min(abs.length - 1, Math.floor(r * abs.length))];
  // ⭐⭐⭐ LE CHIFFRE QUI TRANCHE : `3` est-il GROS ou PETIT devant le bareme d'AUJOURD'HUI ?
  //   Le bonus a ete dicte le 31/07 contre un |score| CONT median de ~2,7 sur `[-10 . +10]`
  //   (`combinedScore`). Le bareme fait maintenant `[-40 . +40]` sur 4 familles. Un bonus qui ne
  //   bouge pas pendant que l'echelle quadruple ne veut plus dire la meme chose.
  console.log(`
     |bareme| non bonifie : p25 ${q(0.25).toFixed(2)} · MEDIANE ${q(0.5).toFixed(2)} · p75 ${q(0.75).toFixed(2)} · p95 ${q(0.95).toFixed(2)}`);
  console.log(`     ⇒ le bonus (3) vaut ${(3 / (q(0.5) || 1)).toFixed(2)}x le |bareme| MEDIAN, et 30x le seuil MIN_CONT (0,1).`);
  console.log(`     ⚠⚠ PRESENT SUR ${pc(avecBonus, n)} DES BARRES : a cette frequence ce n'est plus un`);
  console.log(`        encouragement, c'est un DECALAGE DU ZERO. Le seuil reel du bareme vaut -2,9.`);
}

console.log(`\n  ⭐⭐⭐ CE QU'IL FAUT LIRE : si le taux de passage CHUTE quand le nombre de familles baisse,`);
console.log(`     le seuil ne mesure plus la CONVICTION mais la COMPLETUDE DE LA DONNEE. Une barre est`);
console.log(`     alors refusee non pas parce qu'elle est mauvaise, mais parce qu'un capteur manquait.`);
console.log(`  ⚠ L'INVERSE EST AUSSI UNE FAUTE : si le taux MONTE, les barres incompletes sont FAVORISEES.\n`);
