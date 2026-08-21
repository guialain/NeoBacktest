import fs from "fs";
const lines = fs.readFileSync("data/matrix/US_30.csv","utf8").split("\n");
const hdr = lines[0].split(";");
const ik=hdr.indexOf("stoch_k_h1_s1"), id=hdr.indexOf("stoch_d_h1_s1");
// une row juste après 13:00 → s1 = clôture de la bougie 12:00
const row = lines.find(l => l.startsWith("2026.07.02 13:0"));
if(!row){console.log("pas de row 13:0x");process.exit();}
const c=row.split(";"); const k=parseFloat(c[ik]),d=parseFloat(c[id]);
console.log(`Clôture de la bougie 12h (lu à 13h, s1) : K=${k.toFixed(2)} D=${d.toFixed(2)} → K−D=${(k-d).toFixed(2)} ${k-d>0?"→ K REPASSÉ AU-DESSUS (faux cross live !)":"→ cross confirmé (K reste sous D)"}`);
