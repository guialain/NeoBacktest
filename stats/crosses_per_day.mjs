// crosses_per_day.mjs — nombre de cross K/D H1 par jour + distribution, par actif.
// FILTRES : (1) session 7-20h jours ouvres (les DEUX barres du flip actives + meme jour)
//           (2) flip venant de |k-d| > MIN_STEP (exclut les micro-flips, cf Resultat #2)
// cross = flip de signe de k-d (contact=evenement).
// Sortie: stats/crosses_per_day.xls (2 onglets: resume + histogramme %jours par nb de cross).
import fs from 'fs';
import path from 'path';

const SRC = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const OUT = 'C:/Users/Public/Neo-Backtest/stats/crosses_per_day.xls';
const TF = 'H1';
const MIN_STEP = 3;           // |k-d| barre AVANT flip doit etre > 3
const HOUR_LO = 7, HOUR_HI = 20;
const HIST_MAX = 10;

const assets = fs.readdirSync(SRC).filter(f => new RegExp(`^hist_.+_${TF}\\.csv$`).test(f))
  .map(f => f.replace(/^hist_/, '').replace(new RegExp(`_${TF}\\.csv$`), '')).sort();

function pctl(s, p) { if (!s.length) return null; const r = p/100*(s.length-1), lo = Math.floor(r), hi = Math.ceil(r); return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(r-lo); }
const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
const std = a => { const m = mean(a); return a.length?Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length):0; };

function info(ts) {
  const [dp, tp] = String(ts).split(' ');
  const [y, mo, d] = dp.split('.').map(Number);
  const H = +tp.split(':')[0];
  const wd = new Date(y, mo - 1, d).getDay();
  return { date: dp, hour: H, active: wd !== 0 && wd !== 6 && H >= HOUR_LO && H < HOUR_HI };
}

const data = {};
for (const a of assets) {
  const fp = path.join(SRC, `hist_${a}_${TF}.csv`); if (!fs.existsSync(fp)) continue;
  const L = fs.readFileSync(fp, 'utf8').split(/\r?\n/); const h = L[0].split(';');
  const it = h.indexOf('time'), ik = h.indexOf('stoch_k'), id = h.indexOf('stoch_d');
  const rows = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(';'); if (c.length < h.length) continue;
    const k = +c[ik], d = +c[id]; if (!Number.isFinite(k) || !Number.isFinite(d)) continue;
    const inf = info(c[it]);
    rows.push({ date: inf.date, active: inf.active, kd: k - d });
  }
  rows.reverse(); // chrono
  // jours qui ont au moins une barre active = base du denominateur
  const byDay = {};
  for (const r of rows) if (r.active) byDay[r.date] = byDay[r.date] || 0;
  for (let i = 1; i < rows.length; i++) {
    const p = rows[i-1], c = rows[i];
    if (p.kd === 0) continue;
    if (!c.active || !p.active || c.date !== p.date) continue; // cross en session, meme jour
    if (Math.abs(p.kd) <= MIN_STEP) continue;                  // exclut micro-flips
    if (Math.sign(c.kd) !== Math.sign(p.kd)) byDay[c.date]++;
  }
  data[a] = { perDay: Object.values(byDay) };
}

// ---- .xls ----
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const numC = v => v==null?'<Cell><Data ss:Type="String"></Data></Cell>':`<Cell><Data ss:Type="Number">${Math.round(v*100)/100}</Data></Cell>`;
const strC = (v,s) => `<Cell${s?` ss:StyleID="${s}"`:''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;

let r1 = '<Row>' + ['Asset','N_jours','mean/j','median','std','min','P10','P25','P75','P90','max'].map(x=>strC(x,'hdr')).join('') + '</Row>\n';
for (const a of assets) {
  const d = data[a]; if (!d) continue;
  const s = [...d.perDay].sort((x,y)=>x-y);
  r1 += '<Row>' + strC(a) + `<Cell><Data ss:Type="Number">${s.length}</Data></Cell>` +
    [mean(d.perDay), pctl(s,50), std(d.perDay), s[0], pctl(s,10), pctl(s,25), pctl(s,75), pctl(s,90), s[s.length-1]].map(numC).join('') + '</Row>\n';
}
let r2 = '<Row>' + strC('Asset','hdr') + Array.from({length:HIST_MAX+1},(_,i)=>strC(i<HIST_MAX?String(i):`${HIST_MAX}+`,'hdr')).join('') + '</Row>\n';
for (const a of assets) {
  const d = data[a]; if (!d) continue;
  const hist = new Array(HIST_MAX+1).fill(0);
  for (const c of d.perDay) hist[Math.min(c, HIST_MAX)]++;
  const tot = d.perDay.length || 1;
  r2 += '<Row>' + strC(a) + hist.map(n=>numC(100*n/tot)).join('') + '</Row>\n';
}
fs.writeFileSync(OUT, `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="resume"><Table>\n${r1}</Table></Worksheet>
<Worksheet ss:Name="histo (%jours par nb cross)"><Table>\n${r2}</Table></Worksheet>
</Workbook>`, 'utf8');
console.log(`OK -> ${OUT}   (session ${HOUR_LO}-${HOUR_HI}h, |k-d|>${MIN_STEP}, hors micro-flips)\n`);

console.log(`Cross K/D H1 significatifs par jour de session :`);
console.log(['asset'.padEnd(12),'jours','mean/j','med','P10','P90','max'].map(s=>s.padStart(7)).join(''));
for (const a of assets) {
  const d = data[a]; if (!d) continue;
  const s = [...d.perDay].sort((x,y)=>x-y);
  console.log([a.padEnd(12), String(s.length).padStart(7), mean(d.perDay).toFixed(2).padStart(7),
    String(pctl(s,50)).padStart(4), String(pctl(s,10)).padStart(4), String(pctl(s,90)).padStart(4), String(s[s.length-1]).padStart(4)].join(''));
}
const allMeans = assets.map(a=>data[a]?mean(data[a].perDay):null).filter(x=>x!=null);
console.log(`\nInter-actifs mean/j : min=${Math.min(...allMeans).toFixed(2)} max=${Math.max(...allMeans).toFixed(2)} moyenne=${mean(allMeans).toFixed(2)}`);
