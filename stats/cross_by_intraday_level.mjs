// cross_by_intraday_level.mjs — cross k-d ventiles par intraday_level, par actif (H1, session).
// cross = flip de signe k-d, session (t-1,t actives, meme jour), |k-d[t-1]| > 3.
// intraday_level = regime au moment du cross (barre t).
// Sortie: stats/cross_by_intraday_level.xls (onglet COUNT + onglet RATE cross/100 barres).
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/Public/Neo-Backtest/stats/data';
const MIN_STEP = 3;
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
    const c = rows[i];
    if (c.active) bars[c.lvl] = (bars[c.lvl] || 0) + 1;   // exposition (barres actives par regime)
    if (i === 0) continue;
    const p = rows[i-1];
    if (p.kd === 0 || !c.active || !p.active || c.date !== p.date) continue;
    if (Math.abs(p.kd) <= MIN_STEP) continue;
    if (Math.sign(c.kd) !== Math.sign(p.kd)) cross[c.lvl] = (cross[c.lvl] || 0) + 1;
  }
  data[a] = { cross, bars };
}

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const numC = v => v==null?'<Cell><Data ss:Type="String"></Data></Cell>':`<Cell><Data ss:Type="Number">${Math.round(v*100)/100}</Data></Cell>`;
const strC = (v,s) => `<Cell${s?` ss:StyleID="${s}"`:''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
const hdr = extra => '<Row>' + [strC('Asset','hdr'), ...LEVELS.map(l=>strC(l,'hdr')), strC(extra,'hdr')].join('') + '</Row>\n';

let rC = hdr('TOTAL');
let rR = hdr('moy/100b');
for (const a of assets) {
  const d = data[a]; if (!d) continue;
  const tot = LEVELS.reduce((s,l)=>s+d.cross[l],0);
  rC += '<Row>' + strC(a) + LEVELS.map(l=>`<Cell><Data ss:Type="Number">${d.cross[l]}</Data></Cell>`).join('') + `<Cell><Data ss:Type="Number">${tot}</Data></Cell></Row>\n`;
  const totBars = LEVELS.reduce((s,l)=>s+d.bars[l],0);
  rR += '<Row>' + strC(a) + LEVELS.map(l=>numC(d.bars[l]?100*d.cross[l]/d.bars[l]:0)).join('') + numC(totBars?100*tot/totBars:0) + '</Row>\n';
}
fs.writeFileSync('C:/Users/Public/Neo-Backtest/stats/cross_by_intraday_level.xls', `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="COUNT (nb cross)"><Table>\n${rC}</Table></Worksheet>
<Worksheet ss:Name="RATE (cross par 100 barres)"><Table>\n${rR}</Table></Worksheet>
</Workbook>`, 'utf8');
console.log('OK -> stats/cross_by_intraday_level.xls\n');

// console : GOLD detaille (l'exemple demande) + agregat groupe
function grp(d){ const g={DOWN_fort:0,DOWN_soft:0,NEUTRE:0,UP_soft:0,UP_fort:0};
  g.DOWN_fort=d.cross.SPIKE_DOWN+d.cross.EXPLOSIVE_DOWN+d.cross.STRONG_DOWN;
  g.DOWN_soft=d.cross.SOFT_DOWN; g.NEUTRE=d.cross.NEUTRE; g.UP_soft=d.cross.SOFT_UP;
  g.UP_fort=d.cross.STRONG_UP+d.cross.EXPLOSIVE_UP+d.cross.SPIKE_UP; return g; }
console.log('GOLD — cross par regime intraday (detail 9 niveaux) :');
for (const lv of LEVELS) console.log(`  ${lv.padEnd(15)} ${String(data.GOLD.cross[lv]).padStart(4)} cross   (${data.GOLD.bars[lv]} barres, ${(100*data.GOLD.cross[lv]/(data.GOLD.bars[lv]||1)).toFixed(1)}/100b)`);
const gg = grp(data.GOLD); const gt = Object.values(gg).reduce((a,b)=>a+b,0);
console.log(`  GROUPE: DOWN_fort ${gg.DOWN_fort} | DOWN_soft ${gg.DOWN_soft} | NEUTRE ${gg.NEUTRE} | UP_soft ${gg.UP_soft} | UP_fort ${gg.UP_fort}  (total ${gt})`);

// agregat univers : ou tombent les cross (% et taux)
console.log('\nAgregat univers — repartition des cross et TAUX par regime :');
const aggC = {}, aggB = {}; for (const lv of LEVELS) { aggC[lv]=0; aggB[lv]=0; }
for (const a of assets) for (const lv of LEVELS) { aggC[lv]+=data[a].cross[lv]; aggB[lv]+=data[a].bars[lv]; }
const totC = LEVELS.reduce((s,l)=>s+aggC[l],0);
console.log('  regime           %cross   taux/100b');
for (const lv of LEVELS) console.log(`  ${lv.padEnd(15)} ${(100*aggC[lv]/totC).toFixed(1).padStart(5)}%   ${(100*aggC[lv]/(aggB[lv]||1)).toFixed(1).padStart(5)}`);
