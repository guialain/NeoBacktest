import fs from "fs";
const dir = "data/matrix";
const files = fs.readdirSync(dir).filter(f=>f.endsWith(".csv"));
let report=[];
for (const f of files) {
  const p = `${dir}/${f}`;
  const raw = fs.readFileSync(p,"utf8");
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(nl);
  const header = lines[0].split(";");
  if (header.includes("adx14_h1_c4")) { report.push(`${f}: déjà présent, skip`); continue; }
  const iTs = header.indexOf("timestamp");
  const iC1 = header.indexOf("adx14_h1_c1"), iC2 = header.indexOf("adx14_h1_c2"), iC3 = header.indexOf("adx14_h1_c3");
  if (iC1<0||iC2<0||iC3<0) { report.push(`${f}: colonnes ADX absentes, skip`); continue; }
  const out = [ header.concat("adx14_h1_c4").join(";") ];
  let prevHour=null, prevC3="", c4="", nNonEmpty=0;
  for (let li=1; li<lines.length; li++) {
    const line = lines[li];
    if (!line || line.length<5) { out.push(line); continue; }
    const cols = line.split(";");
    const hour = (cols[iTs]||"").slice(0,13);   // "YYYY.MM.DD HH"
    if (prevHour!==null && hour!==prevHour) c4 = prevC3;  // bascule H1 → c4 = c3 d'avant la bascule
    cols.push(c4);
    if (c4!=="") nNonEmpty++;
    out.push(cols.join(";"));
    prevHour = hour; prevC3 = cols[iC3];
  }
  fs.writeFileSync(p, out.join(nl));
  report.push(`${f}: +col c4 (${nNonEmpty} valeurs non vides / ${lines.length-1} rows)`);
}
console.log(report.join("\n"));
// sanity : US_30 @ 12:05 → attendu c4 = ADX(H−4), plausible autour de c3=17.3
const us = fs.readFileSync(`${dir}/US_30.csv`,"utf8").split(/\r?\n/);
const h = us[0].split(";"); const i4=h.indexOf("adx14_h1_c4"),i1=h.indexOf("adx14_h1_c1"),i2=h.indexOf("adx14_h1_c2"),i3=h.indexOf("adx14_h1_c3");
const r = us.find(l=>l.startsWith("2026.07.02 12:05"));
if(r){const c=r.split(";");console.log(`\nSANITY US_30 12:05 → c1=${c[i1]} c2=${c[i2]} c3=${c[i3]} c4=${c[i4]}`);}
