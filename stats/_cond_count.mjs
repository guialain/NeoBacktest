// Compte les BARRES du dataset qui satisfont la condition, INDEPENDAMMENT du moteur.
// ⭐ Distingue « la figure n'existe pas » de « le moteur la bloque ». Sans ce comptage, une
//   population vide a deux explications et on ne sait pas laquelle.
import fs from "fs";
import { tfInputs } from "../../Matrix-Revolution/src/components/robot/engines/scoring/scoringInputs.js";
const DIR = "data/matrix";
let n = 0, zoneX = 0, zoneXdiv = 0, tot = 0, zoneHaute = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const L = fs.readFileSync(`${DIR}/${f}`, "utf8").split(/\r?\n/);
  const h = L[0].split(";");
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const row = Object.fromEntries(h.map((x, j) => [x, c[j]]));
    const I = tfInputs(row, "h1");
    tot++;
    if (I.zone === "HAUTE") zoneHaute++;
    if (I.zone !== "EXTREME_HAUTE") continue;
    zoneX++;
    if (I.kdCur !== "DIVERGING") continue;
    zoneXdiv++;
    if (Number.isFinite(I.kdGap) && I.kdGap > 0) n++;
  }
}
console.log(`barres totales                        ${tot}`);
console.log(`H1 zone = HAUTE                       ${zoneHaute}  (${(100*zoneHaute/tot).toFixed(2)} %)`);
console.log(`H1 zone = EXTREME_HAUTE               ${zoneX}  (${(100*zoneX/tot).toFixed(2)} %)`);
console.log(`  + kdCur = DIVERGING                 ${zoneXdiv}  (${(100*zoneXdiv/tot).toFixed(2)} %)`);
console.log(`  + kdGap > 0  (DIVERGING-UP)         ${n}  (${(100*n/tot).toFixed(2)} %)`);
