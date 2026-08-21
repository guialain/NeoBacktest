// vpivot_by_intraday_level.mjs — V-pivots PROFONDS (>5 des 2 cotes) ventiles par intraday_level, par actif.
// V-pivot = flip signe k-d, session (t-1,t actives, meme jour), max|kd|{t-2,t-1}>5 ET max|kd|{t+1,t+2}>5.
// Sortie: stats/vpivot_by_intraday_level.xls (COUNT + RATE /100 barres).
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/Public/Neo-Backtest/stats/data';
const VTHR = 5;
const LEVELS = ['SPIKE_DOWN','EXPLOSIVE_DOWN','STRONG_DOWN','SOFT_DOWN','NEUTRE','SOFT_UP','STRONG_UP','EXPLOSIVE_UP','SPIKE_UP'];
const files = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f));
const assets = files.map(f => f.replace(/^hist_/, '').replace(/_H1\.csv$/, '')).sort();

const data = {};
for (const a of assets) {
  const fp = path.join(DIR, `hist_${a}_H1.csv`); if (!fs.existsSync(fp)) continue;
  const L = fs.readFileSync(fp, 'utf8').split(/\r?\n/); const h = L[0].split(';');
  const it = h.indexOf('time'), iK = h.indexOf('stoch_k'), iD = h.indexOf('stoch_d'), iLv = h.indexOf('intraday_level'), iAc = h.indexOf('is_active');
  const rows = [];
  for (let i = 1; i < L.length; i++) { const c = L[i].split(';'); if (c.length < h.length) continue;
    const k = +c[iK], d = +c[iD]; if (!Number.isFinite(k) || !Number.isFinite(d)) continue;
    rows.push({ date: String(c[it]).split(' ')[0], kd: k - d, lvl: c[iLv], active: c[iAc] === '1' }); }
  rows.reverse();
  const cross = {}, bars = {};
  for (const lv of LEVELS) { cross[lv] = 0; bars[lv] = 0; }
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].active) bars[rows[i].lvl] = (bars[rows[i].lvl] || 0) + 1;
  }
  for (let i = 2; i < rows.length - 2; i++) {
    const p = rows[i-1], c = rows[i];
    if (p.kd === 0 || !c.active || !p.active || c.date !== p.date) continue;
    if (Math.sign(c.kd) === Math.sign(p.kd)) continue;
    const before = Math.max(Math.abs(rows[i-2].kd), Math.abs(rows[i-1].kd));
    const after  = Math.max(Math.abs(rows[i+1].kd), Math.abs(rows[i+2].kd));
    if (before > VTHR && after > VTHR) cross[c.lvl] = (cross[c.lvl] || 0) + 1;
  }
  data[a] = { cross, bars };
}

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const numC = v => v==null?'<Cell><Data ss:Type="String"></Data></Cell>':`<Cell><Data ss:Type="Number">${Math.round(v*100)/100}</Data></Cell>`;
const strC = (v,s) => `<Cell${s?` ss:StyleID="${s}"`:''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
const hdr = extra => '<Row>' + [strC('Asset','hdr'), ...LEVELS.map(l=>strC(l,'hdr')), strC(extra,'hdr')].join('') + '</Row>\n';
let rC = hdr('TOTAL'), rR = hdr('moy/100b');
for (const a of assets) { const d = data[a]; if (!d) continue;
  const tot = LEVELS.reduce((s,l)=>s+d.cross[l],0);
  rC += '<Row>' + strC(a) + LEVELS.map(l=>`<Cell><Data ss:Type="Number">${d.cross[l]}</Data></Cell>`).join('') + `<Cell><Data ss:Type="Number">${tot}</Data></Cell></Row>\n`;
  const tb = LEVELS.reduce((s,l)=>s+d.bars[l],0);
  rR += '<Row>' + strC(a) + LEVELS.map(l=>numC(d.bars[l]?100*d.cross[l]/d.bars[l]:0)).join('') + numC(tb?100*tot/tb:0) + '</Row>\n';
}
fs.writeFileSync('C:/Users/Public/Neo-Backtest/stats/vpivot_by_intraday_level.xls', `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="COUNT (V-pivots)"><Table>\n${rC}</Table></Worksheet>
<Worksheet ss:Name="RATE (Vpiv par 100 barres)"><Table>\n${rR}</Table></Worksheet>
</Workbook>`, 'utf8');
console.log('OK -> stats/vpivot_by_intraday_level.xls  (V-pivots >'+VTHR+')\n');

console.log('GOLD — V-pivots par regime intraday :');
for (const lv of LEVELS) console.log(`  ${lv.padEnd(15)} ${String(data.GOLD.cross[lv]).padStart(4)}   (${data.GOLD.bars[lv]} barres, ${(100*data.GOLD.cross[lv]/(data.GOLD.bars[lv]||1)).toFixed(1)}/100b)`);

console.log('\nAgregat univers — V-pivots par regime :');
const aggC = {}, aggB = {}; for (const lv of LEVELS) { aggC[lv]=0; aggB[lv]=0; }
for (const a of assets) for (const lv of LEVELS) { aggC[lv]+=data[a].cross[lv]; aggB[lv]+=data[a].bars[lv]; }
const totC = LEVELS.reduce((s,l)=>s+aggC[l],0);
console.log('  regime           %Vpiv   taux/100b');
for (const lv of LEVELS) console.log(`  ${lv.padEnd(15)} ${(100*aggC[lv]/totC).toFixed(1).padStart(5)}%   ${(100*aggC[lv]/(aggB[lv]||1)).toFixed(1).padStart(5)}`);
