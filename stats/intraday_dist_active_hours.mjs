// intraday_dist_active_hours.mjs — distribution de intraday_change par actif, HEURES ACTIVES seulement.
// Les heures mortes (nuit/week-end) figent intraday_change et biaisent la distribution.
// Filtre = heure serveur broker dans [HOUR_LO, HOUR_HI) + jours ouvres. TF = H1.
// Sortie: stats/intraday_active_hours.xls (percentiles = bornes IntradayConfig) + console filtre vs brut.
import fs from 'fs';
import path from 'path';

const SRC = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const OUT = 'C:/Users/Public/Neo-Backtest/stats/intraday_active_hours.xls';
const TF = 'H1';
const HOUR_LO = 7, HOUR_HI = 20;   // fenetre active (exemple)
const WEEKDAYS_ONLY = true;
const PCTS = [1, 5, 10, 20, 30, 50, 70, 80, 90, 95, 99];

const assets = fs.readdirSync(SRC).filter(f => new RegExp(`^hist_.+_${TF}\\.csv$`).test(f))
  .map(f => f.replace(/^hist_/, '').replace(new RegExp(`_${TF}\\.csv$`), '')).sort();

function pctl(s, p) { if (!s.length) return null; const r = p/100*(s.length-1), lo = Math.floor(r), hi = Math.ceil(r); return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(r-lo); }

// parse "YYYY.MM.DD HH:MM" -> {hour, wday}
function tinfo(ts) {
  const [dp, tp] = String(ts).split(' ');
  if (!dp || !tp) return null;
  const [y, mo, d] = dp.split('.').map(Number);
  const [H] = tp.split(':').map(Number);
  const wd = new Date(y, mo - 1, d).getDay();
  return { hour: H, wday: wd };
}
const isActive = ts => { const t = tinfo(ts); if (!t) return true; if (WEEKDAYS_ONLY && (t.wday === 0 || t.wday === 6)) return false; return t.hour >= HOUR_LO && t.hour < HOUR_HI; };

const data = {}; // data[asset] = {act:[], full:[]}
for (const a of assets) {
  const fp = path.join(SRC, `hist_${a}_${TF}.csv`); if (!fs.existsSync(fp)) continue;
  const L = fs.readFileSync(fp, 'utf8').split(/\r?\n/); const h = L[0].split(';');
  const it = h.indexOf('time'), ic = h.indexOf('intraday_change');
  const act = [], full = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(';'); if (c.length < h.length) continue;
    const v = Number(c[ic]); if (!Number.isFinite(v)) continue;
    full.push(v); if (isActive(c[it])) act.push(v);
  }
  act.sort((x,y)=>x-y); full.sort((x,y)=>x-y);
  data[a] = { act, full };
}

// ---- .xls (percentiles heures actives) ----
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const numC=v=>v==null?'<Cell><Data ss:Type="String"></Data></Cell>':`<Cell><Data ss:Type="Number">${Math.round(v*1000)/1000}</Data></Cell>`;
const strC=(v,s)=>`<Cell${s?` ss:StyleID="${s}"`:''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
let rows = '<Row>'+strC('Asset','hdr')+strC('N_actif','hdr')+PCTS.map(p=>strC('P'+p,'hdr')).join('')+'</Row>\n';
for (const a of assets) { const d = data[a]; if (!d) continue;
  rows += '<Row>'+strC(a)+`<Cell><Data ss:Type="Number">${d.act.length}</Data></Cell>`+PCTS.map(p=>numC(pctl(d.act,p))).join('')+'</Row>\n';
}
fs.writeFileSync(OUT, `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="intraday ${HOUR_LO}-${HOUR_HI}h"><Table>\n${rows}</Table></Worksheet></Workbook>`, 'utf8');
console.log(`OK -> ${OUT}   (${TF}, heures ${HOUR_LO}-${HOUR_HI}h, jours ouvres)\n`);

// ---- console : filtre vs brut, effet sur la bande NEUTRE (P30/P70) et les extremes ----
console.log(`Effet du filtre heures actives sur intraday_change (${TF}) :`);
console.log(['asset'.padEnd(12),'%gardé','P30_brut','P30_act','P70_brut','P70_act','P95_brut','P95_act'].map(s=>s.padStart(9)).join(''));
for (const a of assets) {
  const d = data[a]; if (!d) continue;
  const keep = 100*d.act.length/d.full.length;
  const row = [a.padEnd(12), keep.toFixed(0)+'%',
    pctl(d.full,30).toFixed(2), pctl(d.act,30).toFixed(2),
    pctl(d.full,70).toFixed(2), pctl(d.act,70).toFixed(2),
    pctl(d.full,95).toFixed(2), pctl(d.act,95).toFixed(2)];
  console.log(row.map(s=>String(s).padStart(9)).join(''));
}
