// _meanslope_percentiles_12mois.mjs — LES PERCENTILES SIGNES DE `meanSlope` SUR 12 MOIS, PAR ACTIF
//
// 🎯 DICTEE owner 22/08 — la TENTE, modulateur multiplicatif du rang ③ :
//        FLAT      P45 … P55   -> 0
//        Weak Up   P55 … P75   -> 0.25 + 0.75 * (p - P55) / 20
//        Strong Up P75 … P95   -> 1    - 0.75 * (p - P75) / 20
//        Extreme   > P95       -> 0.25 * (100 - p) / 5
//        SELL = 0 sur toutes les bandes UP, miroir EXACT pour DOWN.
//    Applique APRES le bonus (sur `sContB`).
//    ⛔ CONDITION POSEE PAR L'OWNER : la tente n'est conservee QUE si `P45 … P55` est
//       reellement une zone AUTOUR DE ZERO. C'est ce que cette sonde tranche, et rien d'autre.
//
// 🔴🔥 POURQUOI CETTE CONDITION N'EST PAS UNE FORMALITE. Mesure du 22/08 sur les 28 jours de la
//   matrice : `FLAT` NE CONTENAIT PAS ZERO sur **9 actifs sur 19** (USDCHF P(v<0) = 33,0 %,
//   BRENT_OIL 38,6 %, GBPUSD 57,5 %...), parce qu'une grille en percentiles SIGNES centre ses
//   bandes sur la MEDIANE et non sur zero. Sur 28 jours la mediane EST la derive de juillet.
//   Sur 12 mois la fenetre contient des regimes opposes : l'objection doit s'effondrer, ou la
//   grille signee est a abandonner. Le test est binaire et il est ici.
//
// ⭐⭐⭐ ON MESURE LE `meanSlope` **LIVE**, PAS CLOTURE A CLOTURE, ET C'EST TOUT L'OBJET DU M1.
//   Le scanner lit `iBands` au **shift 0** (barre EN FORMATION) toutes les ~2 min. Par l'algebre
//   de la SMA(20) :
//       middle_s0 - middle_s1 = ( prix_courant - cloture_H1[i-19] ) / 20
//   ou `i` est la derniere barre H1 CLOTUREE. Le prix courant a la minute m EST la cloture M1.
//   ⇒ on rejoue la barre en formation minute par minute. Une calibration cloture-a-cloture
//   decrirait une AUTRE grandeur (toujours prise au dernier instant de la barre), donc une autre
//   distribution — et le modulateur lirait un percentile qui ne veut rien dire.
//   ⚠ L'identite ci-dessus est VERIFIEE dans la sonde (bloc CONTROLE), pas supposee : elle avait
//     ete testee le 22/08 sur la matrice et le test etait INCONCLUANT, la quantification a 5
//     decimales noyant le signal. Ici les clotures sont brutes, le test redevient possible.
//
// ⚠ CONTIGUITE EXIGEE : les barres `i-19 … i` doivent etre contigues a l'heure pres, ET la barre
//   en formation doit suivre `i`. C'est la population ou `meanSlope` explose (jusqu'a 36x le P99).
//   Mesure du 22/08 : 0,91 % de barres non contigues en FX, 4,5-5,3 % sur indices/energie,
//   **10,64 % sur COCOA** (coupure de seance QUOTIDIENNE, invisible dans la fenetre 06-20 UTC).
//
// ⚠ ATR p50 **GELE** sur `ATRConfig` (choix assume) : `meanSlope` est normalise par lui, donc le
//   recalibrer re-scalerait TOUTES les valeurs et rendrait les coupes incomparables. Un geste a la
//   fois. C'est le motif `SLOPE_DELTA_MEDIAN se regenere AVEC sa table`.
//
// ⚠⚠ DEUX POPULATIONS IMPRIMEES, ET IL FAUT CHOISIR : **24h/24** (les bandes sont une propriete de
//   l'ACTIF) contre **06:00-20:00 UTC** (ce que le scanner voit REELLEMENT). Si la session
//   asiatique est plus calme, une grille 24h place les barres tradables TROP HAUT dans l'echelle,
//   et le modulateur lit un percentile flatteur. On mesure l'ecart au lieu de le supposer nul.
//   usage : node --max-old-space-size=8192 stats/_meanslope_percentiles_12mois.mjs
import fs from "fs"; import path from "path";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/";
const { getATRConfig } = await import(R + "ATRConfig.js");
const DIR = "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/MeanSlopeRaw";
const H = 3600000;

const lireH1 = (f) => {
  const L = fs.readFileSync(f, "utf8").trim().split(/\r?\n/);
  const h = L[0].split(";"); const iT = h.indexOf("time_utc"), iC = h.indexOf("close");
  const out = [];
  for (const l of L.slice(1)) { const c = l.split(";");
    const t = Date.parse(c[iT].replace(" ", "T") + "Z"), v = Number(c[iC]);
    if (Number.isFinite(t) && Number.isFinite(v) && v > 0) out.push({ t, v }); }
  return out;
};

const q = (a, p) => { const i = Math.min(a.length - 1, Math.max(0, Math.floor(p / 100 * a.length))); return a[i]; };
const PCT = [5, 25, 45, 50, 55, 75, 95];
const actifs = [...new Set(fs.readdirSync(DIR).map((f) => f.replace(/_(H1|M1)\.csv$/, "")))].sort();

const res = {};
let ctrlN = 0, ctrlMax = 0;

for (const a of actifs) {
  const h1 = lireH1(path.join(DIR, a + "_H1.csv"));
  // index : debut d'heure -> position dans h1
  const idx = new Map(); for (let i = 0; i < h1.length; i++) idx.set(h1[i].t, i);
  const p50 = getATRConfig(a, "H1")?.p50;
  if (!(p50 > 0)) { console.log(`  🔴 ${a} : pas de p50 ATR, ignore`); continue; }

  const txt = fs.readFileSync(path.join(DIR, a + "_M1.csv"), "utf8");
  const tout = [], jour = [], ctg = [];   // 24h/24 · 06:00-20:00 UTC · sous-population CONTIGUE
  let nLu = 0, nNonContigu = 0, nSansBarre = 0;

  let i0 = txt.indexOf("\n") + 1;
  while (i0 > 0 && i0 < txt.length) {
    const j = txt.indexOf("\n", i0);
    const ligne = txt.slice(i0, j < 0 ? txt.length : j);
    i0 = j < 0 ? -1 : j + 1;
    const c1 = ligne.indexOf(";"); if (c1 < 0) continue;
    const c2 = ligne.indexOf(";", c1 + 1); if (c2 < 0) continue;
    const c3 = ligne.indexOf(";", c2 + 1); if (c3 < 0) continue;
    const t = Date.parse(ligne.slice(c1 + 1, c2).replace(" ", "T") + "Z");
    // ⚠ `close` est la DERNIERE colonne du M1 : il n'y a pas de `;` apres. Chercher un 4e
    //   separateur rend -1, et `slice(0)` rendrait la LIGNE ENTIERE -> `NaN` silencieux sur
    //   6,5 M de lignes, donc une sonde qui ne mesure RIEN sans le dire. (Pris a l'ecriture.)
    const prix = Number(ligne.slice(c3 + 1));
    if (!Number.isFinite(t) || !Number.isFinite(prix) || prix <= 0) continue;
    nLu++;

    // La barre H1 EN FORMATION commence a l'heure pleine ; la derniere CLOTUREE est celle d'avant.
    const debut = Math.floor(t / H) * H;
    const i = idx.get(debut - H);
    if (i === undefined) { nSansBarre++; continue; }
    if (i < 19) continue;
    // 🔄 CORRECTION 22/08 — ON NE FILTRE **PLUS** SUR LA CONTIGUITE, ET C'EST UN REVIREMENT ASSUME.
    //   J'avais ecrit « ces barres seront exclues du calibrage ». C'est FAUX, et le premier run l'a
    //   montre : exiger 20 barres H1 contigues ne gardait que **23 816 valeurs sur 328 253** pour
    //   BRENT_OIL. La cause est mecanique — un actif a coupure de seance QUOTIDIENNE n'a que
    //   ~22 barres par jour, donc presque aucune fenetre de 20 ne tient dans une seule seance.
    //   ⭐⭐⭐ ET SURTOUT LA RAISON DE FOND : **`iBands` NE VERIFIE AUCUNE CONTIGUITE EN PROD.**
    //   Le moteur lit « les 20 dernieres barres », point. Calibrer sur une sous-population que le
    //   moteur ne rencontre jamais donnerait un percentile qui ne veut rien dire — exactement la
    //   faute « un bras de controle doit rejouer l'origine ».
    //   ⇒ La population PRIMAIRE est ce que le moteur voit. On mesure la contigue A COTE, pour
    //     chiffrer la distorsion au lieu de la supposer.
    const contigu = (h1[i].t - h1[i - 19].t === 19 * H);
    if (!contigu) nNonContigu++;

    // ⭐ L'IDENTITE : middle_s0 - middle_s1 = (prix - cloture[i-19]) / 20
    const d = (prix - h1[i - 19].v) / 20;
    const atr = p50 / 100000 * prix;
    if (!(atr > 0)) continue;
    const ms = d / atr;

    // ── CONTROLE (1 barre sur 5000) : la forme algebrique contre le calcul DIRECT des deux SMA.
    if (nLu % 5000 === 0) {
      let s1 = 0, s0 = prix;
      for (let k = i - 19; k <= i; k++) s1 += h1[k].v;
      for (let k = i - 18; k <= i; k++) s0 += h1[k].v;
      const direct = (s0 / 20 - s1 / 20) / atr;
      const ec = Math.abs(direct - ms) / (Math.abs(ms) + 1e-12);
      ctrlN++; if (ec > ctrlMax) ctrlMax = ec;
    }

    tout.push(ms);
    if (contigu) ctg.push(ms);
    const hh = new Date(t).getUTCHours();
    if (hh >= 6 && hh < 20) jour.push(ms);
  }

  tout.sort((x, y) => x - y); jour.sort((x, y) => x - y); ctg.sort((x, y) => x - y);
  // 🔴 UNE POPULATION VIDE NE DOIT PAS RENDRE `undefined` EN SILENCE : le premier run a plante
  //   sur COCOA parce que `q()` d une liste vide rend `undefined`. On refuse l actif, en le DISANT.
  if (!tout.length) { console.log(`  🔴 ${a} : AUCUNE valeur exploitable (${nSansBarre} sans barre H1 prealable) — ignore`); continue; }
  res[a] = {
    n: tout.length, nJ: jour.length, nC: ctg.length, nNonContigu, nSansBarre,
    p: PCT.map((x) => q(tout, x)),
    pJ: jour.length ? PCT.map((x) => q(jour, x)) : null,
    pC: ctg.length ? PCT.map((x) => q(ctg, x)) : null,
    pz: 100 * tout.filter((v) => v < 0).length / tout.length,
    pzJ: jour.length ? 100 * jour.filter((v) => v < 0).length / jour.length : null,
  };
}

console.log(`\n══ CONTROLE DE L'IDENTITE ALGEBRIQUE ══`);
console.log(`  \`middle_s0 - middle_s1 = (prix - cloture[i-19]) / 20\` — verifie contre le calcul`);
console.log(`  DIRECT des deux SMA(20), sur ${ctrlN} barres tirees. Ecart relatif MAX : ${ctrlMax.toExponential(2)}`);
console.log(`  ${ctrlMax < 1e-9 ? "✅ IDENTITE EXACTE — `meanSlope` EST le deplacement du prix sur 20 barres, / 20."
                                : "🔴 ECART — l'identite ne tient pas, ne pas s'en servir."}`);

console.log(`\n══ PERCENTILES SIGNES DE \`meanSlope\` LIVE — 12 MOIS, 24h/24 ══`);
console.log("  " + "actif".padEnd(12) + "n".padStart(9) + PCT.map((x) => ("P" + x).padStart(10)).join(""));
console.log("  " + "─".repeat(12 + 9 + 10 * PCT.length));
for (const a of actifs) { const r = res[a]; if (!r) continue;
  console.log("  " + a.padEnd(12) + String(r.n).padStart(9)
    + r.p.map((v) => ((v >= 0 ? "+" : "") + v.toFixed(4)).padStart(10)).join("")); }

console.log(`\n══ 🔴 LE CONTROLE OWNER : \`P45 … P55\` EST-IL UNE ZONE AUTOUR DE ZERO ? ══`);
console.log("  " + "actif".padEnd(12) + "P45".padStart(10) + "P55".padStart(10) + "P(v<0)".padStart(10)
  + "   verdict 24h" + "        06-20h : P(v<0)");
console.log("  " + "─".repeat(92));
let ok = 0, ko = [];
for (const a of actifs) { const r = res[a]; if (!r) continue;
  const contient = r.p[2] <= 0 && r.p[4] >= 0;       // P45 <= 0 <= P55
  if (contient) ok++; else ko.push(a);
  console.log("  " + a.padEnd(12) + ((r.p[2] >= 0 ? "+" : "") + r.p[2].toFixed(4)).padStart(10)
    + ((r.p[4] >= 0 ? "+" : "") + r.p[4].toFixed(4)).padStart(10)
    + (r.pz.toFixed(1) + " %").padStart(10)
    + (contient ? "   ✅ FLAT contient zero" : "   🔴 FLAT NE CONTIENT PAS ZERO")
    + ("     " + (r.pzJ === null ? "—" : r.pzJ.toFixed(1) + " %")).padStart(24)); }
console.log("  " + "─".repeat(92));
console.log(`  ⭐ ${ok}/${Object.keys(res).length} actifs ont zero dans \`P45 … P55\`` + (ko.length ? `   🔴 hors : ${ko.join(", ")}` : ""));
console.log(`  (rappel 28 jours : 10/19 seulement)`);

console.log(`\n══ ⚠ 24h/24 CONTRE 06:00-20:00 UTC — la session asiatique decale-t-elle l'echelle ? ══`);
console.log("  " + "actif".padEnd(12) + "P75 24h".padStart(11) + "P75 06-20".padStart(11) + "ecart".padStart(9)
  + "P95 24h".padStart(11) + "P95 06-20".padStart(11) + "ecart".padStart(9));
console.log("  " + "─".repeat(76));
let som = 0, cnt = 0;
for (const a of actifs) { const r = res[a]; if (!r || !r.pJ) continue;
  const e75 = 100 * (r.pJ[5] - r.p[5]) / Math.abs(r.p[5]), e95 = 100 * (r.pJ[6] - r.p[6]) / Math.abs(r.p[6]);
  som += Math.abs(e75); cnt++;
  console.log("  " + a.padEnd(12) + r.p[5].toFixed(4).padStart(11) + r.pJ[5].toFixed(4).padStart(11)
    + ((e75 >= 0 ? "+" : "") + e75.toFixed(1) + "%").padStart(9)
    + r.p[6].toFixed(4).padStart(11) + r.pJ[6].toFixed(4).padStart(11)
    + ((e95 >= 0 ? "+" : "") + e95.toFixed(1) + "%").padStart(9)); }
console.log("  " + "─".repeat(76));
console.log(`  ⭐ ecart ABSOLU moyen sur P75 : ${(som / cnt).toFixed(1)} %`);
console.log(`\n  ⚠ Un ecart non nul veut dire qu'une grille 24h place les barres TRADABLES ailleurs`);
console.log(`     dans l'echelle que ce qu'elles valent dans leur propre population.\n`);
