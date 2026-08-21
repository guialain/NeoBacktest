// vpivot_direction_vs_day.mjs — sens du V-pivot (sell/buy) x sens du jour (intraday), par regime.
// sell-pivot = k-d +->- (fade bas) ; buy-pivot = k-d -->+ (fade haut).
// jour : UP si intraday_force>0, DOWN si <0, FLAT si 0 (NEUTRE).
// AGAINST = fade contre le jour (sell dans UP, buy dans DOWN) ; WITH = reprise (sell dans DOWN, buy dans UP).
// V-pivot profond >5 des 2 cotes, session. Sortie: stats/vpivot_direction_vs_day.xls
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
  const it=h.indexOf('time'), iK=h.indexOf('stoch_k'), iD=h.indexOf('stoch_d'), iLv=h.indexOf('intraday_level'), iFo=h.indexOf('intraday_force'), iAc=h.indexOf('is_active');
  const rows = [];
  for (let i = 1; i < L.length; i++) { const c = L[i].split(';'); if (c.length < h.length) continue;
    const k=+c[iK], d=+c[iD]; if (!Number.isFinite(k)||!Number.isFinite(d)) continue;
    rows.push({ date:String(c[it]).split(' ')[0], kd:k-d, lvl:c[iLv], force:+c[iFo], active:c[iAc]==='1' }); }
  rows.reverse();
  const per = {}; for (const lv of LEVELS) per[lv] = { sell:0, buy:0 };
  for (let i = 2; i < rows.length - 2; i++) {
    const p = rows[i-1], c = rows[i];
    if (p.kd === 0 || !c.active || !p.active || c.date !== p.date) continue;
    if (Math.sign(c.kd) === Math.sign(p.kd)) continue;
    const before = Math.max(Math.abs(rows[i-2].kd), Math.abs(rows[i-1].kd));
    const after  = Math.max(Math.abs(rows[i+1].kd), Math.abs(rows[i+2].kd));
    if (!(before > VTHR && after > VTHR)) continue;
    const sell = c.kd < 0; // k-d +->- : K passe sous D
    per[c.lvl][sell ? 'sell' : 'buy']++;
  }
  data[a] = per;
}

const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const strC=(v,s)=>`<Cell${s?` ss:StyleID="${s}"`:''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
const nC=v=>`<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
const pC=v=>`<Cell><Data ss:Type="Number">${Math.round(v*10)/10}</Data></Cell>`;
// onglet : par actif x regime -> sell% (part de sell parmi les V-pivots du regime)
let r1 = '<Row>' + [strC('Asset','hdr'), ...LEVELS.map(l=>strC(l,'hdr'))].join('') + '</Row>\n';
for (const a of assets) { const d=data[a]; if(!d)continue;
  r1 += '<Row>'+strC(a)+LEVELS.map(l=>{const t=d[l].sell+d[l].buy; return t?pC(100*d[l].sell/t):strC('');}).join('')+'</Row>\n'; }
// onglet 2 : compte sell/buy agrege
let r2 = '<Row>'+[strC('Regime','hdr'),strC('sell','hdr'),strC('buy','hdr'),strC('sell%','hdr'),strC('N','hdr')].join('')+'</Row>\n';
const agg={}; for(const lv of LEVELS)agg[lv]={sell:0,buy:0};
for(const a of assets)for(const lv of LEVELS){agg[lv].sell+=data[a][lv].sell;agg[lv].buy+=data[a][lv].buy;}
for(const lv of LEVELS){const t=agg[lv].sell+agg[lv].buy; r2+='<Row>'+strC(lv)+nC(agg[lv].sell)+nC(agg[lv].buy)+pC(t?100*agg[lv].sell/t:0)+nC(t)+'</Row>\n';}
fs.writeFileSync('C:/Users/Public/Neo-Backtest/stats/vpivot_direction_vs_day.xls', `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="sell% par actif x regime"><Table>\n${r1}</Table></Worksheet>
<Worksheet ss:Name="agrege sell-buy"><Table>\n${r2}</Table></Worksheet>
</Workbook>`, 'utf8');
console.log('OK -> stats/vpivot_direction_vs_day.xls\n');

console.log('Agregat univers — sens du V-pivot par regime intraday :');
console.log('  regime           sell   buy   sell%   AGAINST-day%');
let awith=0, aagainst=0;
for(const lv of LEVELS){ const s=agg[lv].sell,b=agg[lv].buy,t=s+b;
  // AGAINST : sell dans UP, buy dans DOWN. le regime donne le sens du jour.
  const isUp=LEVELS.indexOf(lv)>4, isDown=LEVELS.indexOf(lv)<4, isFlat=lv==='NEUTRE';
  let against=0; if(isUp)against=s; else if(isDown)against=b; // FLAT: pas de sens
  if(isUp){aagainst+=s;awith+=b;} else if(isDown){aagainst+=b;awith+=s;}
  const agTxt=isFlat?'  (jour plat)':`${(100*against/t).toFixed(0)}%`;
  console.log(`  ${lv.padEnd(15)} ${String(s).padStart(4)}  ${String(b).padStart(4)}  ${(100*s/t).toFixed(0).padStart(4)}%   ${agTxt}`);
}
console.log(`\n  Hors NEUTRE : AGAINST-day ${aagainst} vs WITH-day ${awith}  -> ${(100*aagainst/(aagainst+awith)).toFixed(0)}% contre le jour`);

console.log('\nGOLD — sens par regime :');
for(const lv of LEVELS){const s=data.GOLD[lv].sell,b=data.GOLD[lv].buy,t=s+b; if(!t)continue; console.log(`  ${lv.padEnd(15)} sell ${String(s).padStart(3)} / buy ${String(b).padStart(3)}  (sell ${(100*s/t).toFixed(0)}%)`);}
