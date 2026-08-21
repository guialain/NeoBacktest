// _cont_meanslope_pop.mjs — LA PENTE DE LA MOYENNE EST-ELLE DISCRIMINANTE SUR LE RESIDU DU RANG ③ ?
//
// 🎯 PREREQUIS NOMME : les deux premieres entrees du barema ③ ont echoue pour la MEME raison
//   structurelle — la cascade avait deja consomme leur variance avant que le residu arrive. Le `RSI`
//   H1 : 70 % de la population dans UNE zone, colonne `DOWN` a 3,41 %. Le `di` : 75 % dans
//   `HIGH`/`EXTREME_HIGH`, et c'est exactement l'argument qui avait fait retirer l'ancienne entree
//   `di` du rang ① (« le routeur a deja selectionne les barres ou un camp domine »).
//   ⇒ AVANT de dicter une table, on regarde si l'axe RESPIRE sur CETTE population. C'est la seule
//   question qui vaille : une entree dont 90 % de la population tient dans une case n'est pas un
//   discriminant, c'est une CONSTANTE.
//
// ⭐⭐ ON MESURE LA BANDE **ORIENTEE**, et c'est le point. `meanSlope` ne donne pas le cote du TRADE
//   (owner : « meanSlope negatif peut conduire a la fois a exh sell ou exh buy ») — il donne la
//   DESTINATION du ballet, et le sens vaut `destination − position`. MAIS au rang ③ le cote vient du
//   PROFIL : il n'y a aucun cote a deviner. La question devient donc « la moyenne va-t-elle DANS MON
//   SENS ? », et il suffit d'orienter la bande par le cote — comme `kOr` le fait pour le `%K` du ②.
// ⚠ On imprime les DEUX (brute et orientee) : sur un cote unique elles ne different que par le
//   miroir, mais les publier separement evite de croire qu'on a mesure l'une en lisant l'autre.
//
// ⚠⚠ DISPONIBILITE — verifiee le 12/08 : `middle_h1_s1` est rempli a 96,64 %, avec UN trou du
//   31/07 22h au 02/08 20h. Les 3,4 % restants rendront la pente `null` : c'est un MUET, jamais un
//   `0`. ⛔ `middle_h4_s1` est a 10,40 % (rien avant le 03/08) — le H4 est hors de question ici.
// 🔴 PIEGE `num("")=0` : `computeDeviation` exige `mPrev > 0` et pas `!== null`, parce que le `num()`
//   de `server.js` transforme une cellule vide en `0` EN AMONT. Un `middle_h1_s1` vide donnerait une
//   pente de ~380 ATR au lieu de « pas de donnee ». On passe donc PAR `computeDeviation`, jamais par
//   une soustraction ecrite ici.
// ⚠ UN ACTIF A LA FOIS, `rows` relache ensuite (OOM mesure a 4 Go).
//   usage : node stats/_cont_meanslope_pop.mjs   [COTE=BUY|SELL]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1";
const D = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/config/DeviationConfig.js";
const { computeDeviation, DELTA_COLS, DELTA_COL_MIRROR } = await import(D);
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const COTE = process.env.COTE ?? "BUY";
const brute = {}, orient = {};
for (const c of DELTA_COLS) { brute[c] = 0; orient[c] = 0; }
let nCote = 0, nCont = 0, muetPente = 0, muetDev = 0;

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const p = path.join(DIR, f), sym = path.basename(f, ".csv");
  const L = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const iTs = head.indexOf("timestamp");
  const rows = new Map();
  for (const l of L.slice(1)) {
    const c = l.split(";"); const o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = c[i];
    rows.set(o.timestamp, o);
  }
  for (const x of (prepareAsset(p, { maxOpen: 30, cadenceMin: 2, chargeSpread: true, ghostBoxes: true }).ghosts ?? [])) {
    if (x.ghost !== "boxes" || x.side !== COTE) continue;
    nCote++;
    if (!x.rangCont) continue;                    // ⚠ la cascade n'est PAS arrivee au rang ③
    nCont++;
    const row = rows.get(x.tsMT); if (!row) continue;
    const dev = computeDeviation(row, sym, "h1");
    if (!dev) { muetDev++; continue; }
    const b = dev.meanSlopeBand;
    if (b == null) { muetPente++; continue; }
    brute[b]++;
    orient[COTE === "BUY" ? b : DELTA_COL_MIRROR[b]]++;
  }
  rows.clear();
}

const pc = (n, t) => (t ? (100 * n / t).toFixed(2) : "0.00") + " %";
const lu = nCont - muetDev - muetPente;
console.log(`\n══ RANG ③ · \`meanSlopeBand\` SUR LE RESIDU · COTE ${COTE} ══`);
console.log(`  barres cote ${COTE} .............. ${nCote}`);
console.log(`  atteintes par la cascade ..... ${nCont}   ${pc(nCont, nCote)}`);
console.log(`  🔴 pente MUETTE .............. ${muetPente + muetDev}   ${pc(muetPente + muetDev, nCont)}   (deviation ${muetDev} · pente ${muetPente})`);
console.log(`  lues ......................... ${lu}\n`);
if (!lu) { console.log("  🔴 RIEN A MESURER."); process.exit(0); }
console.log("  bande            BRUTE      ORIENTEE   (+ = la moyenne va DANS mon sens)");
for (const c of DELTA_COLS)
  console.log("  " + c.padEnd(16) + pc(brute[c], lu).padStart(9) + pc(orient[c], lu).padStart(12)
    + (brute[c] === 0 ? "   🔴 VIDE" : brute[c] * 100 / lu < 1 ? "   ⚠ <1 %" : ""));
const parts = DELTA_COLS.map((c) => brute[c]);
console.log(`\n  → bande la plus peuplee : ${pc(Math.max(...parts), lu)} · bandes non vides : ${parts.filter((v) => v > 0).length}/7`);
console.log(`  ⚠ Une entree dont la population tient dans une case ajoute une CONSTANTE, pas un tri.`);
console.log(`     Reperes de la session : \`RSI\` 70 % dans une zone · \`di\` 75 % dans deux lignes.\n`);
