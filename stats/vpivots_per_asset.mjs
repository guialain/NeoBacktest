// vpivots_per_asset.mjs — nombre de V-pivots k-d par actif (H1, heures actives).
// V-pivot = flip de signe de k-d ou l'ecart est REEL des 2 cotes :
//   max|k-d| sur {t-2,t-1} > VTHR  ET  max|k-d| sur {t+1,t+2} > VTHR  (V profond, pas plat).
// On sort 2 seuils (VTHR=3 et 5). cross en session (t-1,t actives, meme jour).
// Sortie: stats/vpivots_per_asset.xls
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/Public/Neo-Backtest/stats/data';
const V3 = 3, V5 = 5;
const files = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f));
const assets = files.map(f => f.replace(/^hist_/, '').replace(/_H1\.csv$/, '')).sort();

const data = {};
for (const a of assets) {
  const fp = path.join(DIR, `hist_${a}_H1.csv`); if (!fs.existsSync(fp)) continue;
  const L = fs.readFileSync(fp, 'utf8').split(/\r?\n/); const h = L[0].split(';');
  const it = h.indexOf('time'), iK = h.indexOf('stoch_k'), iD = h.indexOf('stoch_d'), iAc = h.indexOf('is_active');
  const rows = [];
  for (let i = 1; i < L.length; i++) { const c = L[i].split(';'); if (c.length < h.length) continue;
    const k = +c[iK], d = +c[iD]; if (!Number.isFinite(k) || !Number.isFinite(d)) continue;
    rows.push({ date: String(c[it]).split(' ')[0], kd: k - d, active: c[iAc] === '1' }); }
  rows.reverse();
  const days = new Set(rows.filter(r=>r.active).map(r=>r.date));
  let sig = 0, v3 = 0, v5 = 0;
  for (let i = 2; i < rows.length - 2; i++) {
    const p = rows[i-1], c = rows[i];
    if (p.kd === 0 || !c.active || !p.active || c.date !== p.date) continue;
    if (Math.sign(c.kd) === Math.sign(p.kd)) continue;
    const before = Math.max(Math.abs(rows[i-2].kd), Math.abs(rows[i-1].kd));
    const after  = Math.max(Math.abs(rows[i+1].kd), Math.abs(rows[i+2].kd));
    if (before > V3) sig++;                             // cross significatif (cote sortant seul)
    if (before > V3 && after > V3) v3++;                // V-pivot seuil 3
    if (before > V5 && after > V5) v5++;                // V-pivot seuil 5
  }
  data[a] = { nDays: days.size, sig, v3, v5 };
}

// ---- .xls ----
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const numC = v => v==null?'<Cell><Data ss:Type="String"></Data></Cell>':`<Cell><Data ss:Type="Number">${Math.round(v*100)/100}</Data></Cell>`;
const strC = (v,s) => `<Cell${s?` ss:StyleID="${s}"`:''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
let rows = '<Row>' + ['Asset','N_jours','cross_signif','Vpivot(>3)','Vpivot(>5)','Vpiv>3/jour','Vpiv>5/jour'].map(x=>strC(x,'hdr')).join('') + '</Row>\n';
for (const a of assets) { const d = data[a]; if (!d) continue;
  rows += '<Row>' + strC(a) +
    `<Cell><Data ss:Type="Number">${d.nDays}</Data></Cell>` +
    `<Cell><Data ss:Type="Number">${d.sig}</Data></Cell>` +
    `<Cell><Data ss:Type="Number">${d.v3}</Data></Cell>` +
    `<Cell><Data ss:Type="Number">${d.v5}</Data></Cell>` +
    numC(d.v3/d.nDays) + numC(d.v5/d.nDays) + '</Row>\n';
}
fs.writeFileSync('C:/Users/Public/Neo-Backtest/stats/vpivots_per_asset.xls', `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="V-pivots"><Table>\n${rows}</Table></Worksheet></Workbook>`, 'utf8');
console.log(`OK -> stats/vpivots_per_asset.xls\n`);

console.log(`V-pivots k-d par actif (H1, session) :`);
console.log(['asset'.padEnd(12),'jours','cross>3','Vpiv>3','Vpiv>5','V>5/j'].map(s=>s.padStart(9)).join(''));
let tot5 = 0;
for (const a of assets) { const d = data[a]; if (!d) continue; tot5 += d.v5;
  console.log([a.padEnd(12), String(d.nDays).padStart(9), String(d.sig).padStart(9), String(d.v3).padStart(9), String(d.v5).padStart(9), (d.v5/d.nDays).toFixed(2).padStart(9)].join(''));
}
console.log(`\nTotal V-pivots(>5) univers : ${tot5}`);
