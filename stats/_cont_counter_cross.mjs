// _cont_counter_cross.mjs — LA POPULATION QUE PERSONNE N'AVAIT JAMAIS REGARDEE.
// ============================================================================================
// 🎯 LA QUESTION (owner, 20/08) : `WAIT cont-counter-cross` est le 2e destin du depot en volume —
//   **18 491 lignes, 20,37 % de tout ce que le collecteur voit**. Il n'a jamais ete mesure.
//
// ⚠⚠⚠ POURQUOI IL N'AVAIT JAMAIS PU L'ETRE, ET CE QUE CA DIT DES TABLEAUX DEJA PUBLIES :
//   `cont-counter-cross` est le **PREMIER** refus du rang ③ — pose AVANT `cont-below-min` et AVANT
//   `vetoGate`. La barre n'a donc **ni `contVeto`, ni `selStrategy`**. Or les deux sondes ③
//   existantes deduisaient le cote ainsi :
//        const side = x.contVeto?.side ?? (x.selStrategy === "CONT" ? x.side : null);
//        if (!side) continue;                      // ⇐ 18 491 lignes tombent ICI, en silence
//   ⇒ **UNE POPULATION ENTIERE MANQUAIT A UN TABLEAU QUI AVAIT L'AIR COMPLET.** C'est la 4e forme
//   du motif « un carnet vide ne se signale pas » : pas un carnet vide, une COLONNE ABSENTE.
//   🎯 Le champ `regDir` a ete ajoute au fantome `all-rows` pour ca.
//
// ⚠ `contSide = SIDE_PRO`, et `SIDE_PRO = proDir` qui ne vaut `regDir` QUE parce que `PRO_DIR_SRC`
//   vaut `regime` par defaut. La sonde REFUSE de tourner si le levier est pose (elle mesurerait un
//   cote faux sans le dire).
//
// ⛔ IL N'EXISTE AUCUN LEVIER PROPRE POUR CE REFUS. `TOUT_ADMETTRE=1` le desarme, mais il desarme
//   AUSSI deux portes du rang ② (lignes 2258 et 2279) : ce n'est donc PAS un A/B de
//   `cont-counter-cross`, c'est un A/B de trois choses a la fois. Tout ce fichier est une TABLE.
//   La lecon du jour tient : **SEUL LE CARNET RE-COURU PROUVE** (surestimation mesuree jusqu'a ×7).
//
// ⚠ `R` simule une entree CONT sur la barre, a capacite infinie et sans spacing. Il CLASSE.
//   Et le spacing jette 69,5 % des `fires` : le R recuperable est une FRACTION de ce qui est ecrit.
// ⚙ Usage : `node stats/_cont_counter_cross.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes } from "./_episodes.mjs";
const { MIN_CONT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");

if (String(process.env.PRO_DIR_SRC ?? "regime") !== "regime") {
  console.log("\n⛔ `PRO_DIR_SRC` est pose : `SIDE_PRO` ne vaut plus `regDir` et la deduction du cote");
  console.log("   serait FAUSSE sans que rien ne le dise. Sonde arretee — c'est voulu.\n");
  process.exit(1);
}

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const sideDe = (rd) => (rd > 0 ? "BUY" : rd < 0 ? "SELL" : null);

const E = [];            // les barres `cont-counter-cross`
const REF = [];          // le reste du rang ③ (below-min + vetoed + tire), pour comparer
let rows = 0;
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    rows++;
    const nat = x.waitNature ?? null;
    const cc = nat === "cont-counter-cross";
    const autre = nat === "cont-below-min" || nat === "cont-vetoed" || x.selStrategy === "CONT";
    if (!cc && !autre) continue;
    // ⭐ LE COTE : pour `cont-counter-cross` il ne peut venir que de `regDir` (voir l'en-tete).
    const side = x.contVeto?.side ?? (x.selStrategy === "CONT" ? x.side : null) ?? sideDe(x.regDir);
    if (!side) continue;
    const r = p.walk({ ...x, side });
    if (!r || typeof r.R !== "number") continue;
    (cc ? E : REF).push({ ...x, asset, contSide: side, R: r.R, nat });
  }
}

const BE = 75;
const agg = (a) => { const o = { n: a.length, g: 0, R: 0 }; for (const t of a) { o.R += t.R ?? 0; if ((t.R ?? 0) > 0) o.g++; } return o; };
const wr = (v) => (v.n ? 100 * v.g / v.n : NaN);
const jour = (x) => `${x.asset}|${String(x.tsMT ?? "").slice(0, 10)}`;
const gr = (a) => new Set(a.map(jour)).size;
const eps = (a) => agg(dedupeEpisodes(a.map((x) => ({ ...x }))));
const L = (lbl, a) => {
  if (!a.length) return `   ${lbl.padEnd(34)}       —`;
  const v = agg(a);
  return `   ${lbl.padEnd(34)}${String(v.n).padStart(7)}${wr(v).toFixed(2).padStart(9)} %${v.R.toFixed(1).padStart(9)}${(v.R / v.n).toFixed(4).padStart(9)}   ${`${eps(a).n} ep / ${wr(eps(a)).toFixed(1)} %`.padStart(16)}${String(gr(a)).padStart(8)}`;
};
const HEAD = `   ${"".padEnd(34)}${"barres".padStart(7)}${"WR".padStart(10)}${"R net".padStart(9)}${"R/barre".padStart(9)}   ${"episodes".padStart(16)}${"grappes".padStart(8)}`;

console.log(`\n══ \`WAIT cont-counter-cross\` — LE 2e DESTIN DU DEPOT, MESURE POUR LA 1re FOIS ══`);
console.log(`   ${rows} lignes vues · ${E.length} en \`cont-counter-cross\` · ${REF.length} autres barres du ③`);
console.log(`   MIN_CONT ${MIN_CONT} · point mort ${BE},00 % · le R CLASSE, il ne chiffre pas.`);

console.log(`\n   ── ① LE REFUS COMPARE AU RESTE DU RANG ③ ──`);
console.log(HEAD);
console.log(L("cont-counter-cross", E));
console.log(L("   dont BUY", E.filter((x) => x.contSide === "BUY")));
console.log(L("   dont SELL", E.filter((x) => x.contSide === "SELL")));
console.log(L("le reste du ③ (reference)", REF));
console.log(L("   dont BUY", REF.filter((x) => x.contSide === "BUY")));
console.log(L("   dont SELL", REF.filter((x) => x.contSide === "SELL")));
console.log(L("   dont le ③ a TIRE", REF.filter((x) => x.selStrategy === "CONT")));

// ⭐⭐⭐ LE POINT QUI DECIDE. Le refus est pose AVANT le seuil : la majorite de ces barres seraient
//   de toute facon tombees en `cont-below-min`. Ce que le refus coute VRAIMENT, c'est la part qui
//   aurait passe `MIN_CONT` — et elle seule. Confondre les deux gonflerait le prix du refus.
// ⚠ « aurait passe le seuil » n'est PAS « aurait tire » : `vetoGate` vient APRES, et il bloque
//   100 % de ce qui lui est soumis aujourd'hui. On ne peut pas le simuler ici (il faut `row`/`tfs`).
const passeSeuil = (x) => Number.isFinite(x.contScore) && x.contScore >= MIN_CONT;
console.log(`\n   ── ② CE QUE LE REFUS COUTE VRAIMENT : LA PART QUI AURAIT PASSE \`MIN_CONT ${MIN_CONT}\` ──`);
console.log(HEAD);
console.log(L(`sous le seuil (perdues d'avance)`, E.filter((x) => !passeSeuil(x))));
console.log(L(`AU-DESSUS du seuil  ⟵ LE COUT`, E.filter(passeSeuil)));
console.log(L(`   dont BUY`, E.filter((x) => passeSeuil(x) && x.contSide === "BUY")));
console.log(L(`   dont SELL`, E.filter((x) => passeSeuil(x) && x.contSide === "SELL")));
const au = E.filter(passeSeuil);
if (E.length) console.log(`   ⇒ ${(100 * au.length / E.length).toFixed(1)} % des barres refusees auraient atteint le veto ③.`);

console.log(`\n   ── ③ PAR TRANCHE DE SCORE ③ (les refusees en counter-cross) ──`);
console.log(HEAD);
const B = [-Infinity, 0, 5, 10, 14, 18, 22, 26, 30, Infinity];
for (let i = 0; i < B.length - 1; i++) {
  const a = E.filter((x) => Number.isFinite(x.contScore) && x.contScore >= B[i] && x.contScore < B[i + 1]);
  if (a.length >= 20) console.log(L(`[${B[i] === -Infinity ? "-inf" : B[i]}·${B[i + 1] === Infinity ? "+inf" : B[i + 1]}[`, a));
}

// 🔴🔥⭐⭐⭐ SECTION ④ RETIREE APRES SA 1re EXECUTION — ELLE NE POUVAIT RIEN MESURER.
//   Elle demandait « le rang ① avait-il un avis sur ces barres ? » et rendait **0 barre avec un
//   score ① sur 18 491**. Ce n'est PAS un fait de marche : `traceCont` pose litteralement
//   `exh: null, exhRaw: null` — la trace d'un refus du ③ n'emporte JAMAIS le score du ①. Le
//   fantome lisait donc un champ **NUL PAR CONSTRUCTION**, et la sonde imprimait une ligne
//   d'apparence parfaite : « le ① est muet : 18 491 / 73,33 % ».
// ⚠⚠ **UNE SONDE QUI LIT UN CHAMP TOUJOURS NUL REND UN RESULTAT TOUJOURS VRAI ET TOUJOURS VIDE
//   DE SENS.** Elle ne leve pas, elle ne rend pas 0 ligne — elle rend LA POPULATION ENTIERE dans
//   la mauvaise case. C'est plus dangereux qu'un carnet vide : ca ressemble a une reponse.
// 🎯 Pour poser cette question il faut lire `exhYielded` / `exhConviction`, que `traceCont`
//   porte VRAIMENT. Non fait : ce n'est pas la question posee.
console.log(`\n   ⚠ « aurait passe le seuil » n'est PAS « aurait tire » : \`vetoGate\` vient APRES,`);
console.log(`     et le spacing jette 69,5 % de ce qui tire. SEUL LE CARNET RE-COURU PROUVE.\n`);
