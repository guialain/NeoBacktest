// delta_adx_distribution.mjs — distribution de ΔADX (s0-s1 = adx[t]-adx[t-1]) H1, PAR ACTIF.
// Heures actives (barres consecutives actives), dataset augmente stats/data.
// Sortie: stats/delta_adx_distribution.xls (percentiles P1..P99) + console dispersion inter-actifs.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/Public/Neo-Backtest/stats/data';
const OUT = 'C:/Users/Public/Neo-Backtest/stats/delta_adx_distribution.xls';
const PCTS = [1, 5, 10, 25, 50, 75, 90, 95, 99];

const assets = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f))
  .map(f => f.replace(/^hist_/, '').replace(/_H1\.csv$/, '')).sort();

function pctl(s,p){if(!s.length)return null;const r=p/100*(s.length-1),lo=Math.floor(r),hi=Math.ceil(r);return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(r-lo);}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const std=a=>{const m=mean(a);return a.length?Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length):0;};

const data={};
for(const a of assets){
  const fp=path.join(DIR,`hist_${a}_H1.csv`); if(!fs.existsSync(fp))continue;
  const L=fs.readFileSync(fp,'utf8').split(/\r?\n/); const h=L[0].split(';');
  const iA=h.indexOf('adx14'), iAc=h.indexOf('is_active');
  const rows=[]; for(let i=1;i<L.length;i++){const c=L[i].split(';');if(c.length<h.length)continue;const adx=+c[iA];if(!Number.isFinite(adx))continue;rows.push({adx,active:c[iAc]==='1'});}
  rows.reverse();
  const dl=[];
  for(let i=1;i<rows.length;i++){ if(rows[i].active&&rows[i-1].active) dl.push(rows[i].adx-rows[i-1].adx); }
  dl.sort((x,y)=>x-y);
  data[a]={dl, n:dl.length};
}

// ---- .xls ----
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const numC=v=>v==null?'<Cell><Data ss:Type="String"></Data></Cell>':`<Cell><Data ss:Type="Number">${Math.round(v*1000)/1000}</Data></Cell>`;
const strC=(v,s)=>`<Cell${s?` ss:StyleID="${s}"`:''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
let rows='<Row>'+['Asset','N','mean','std',...PCTS.map(p=>'P'+p)].map(x=>strC(x,'hdr')).join('')+'</Row>\n';
for(const a of assets){const d=data[a];if(!d)continue;
  rows+='<Row>'+strC(a)+`<Cell><Data ss:Type="Number">${d.n}</Data></Cell>`+[mean(d.dl),std(d.dl),...PCTS.map(p=>pctl(d.dl,p))].map(numC).join('')+'</Row>\n';
}
fs.writeFileSync(OUT,`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="dADX s0-s1 (H1 actif)"><Table>\n${rows}</Table></Worksheet></Workbook>`,'utf8');
console.log(`OK -> ${OUT}\n`);

console.log(`ΔADX (s0-s1) H1, heures actives — par actif :`);
console.log(['asset'.padEnd(12),'n','std','P5','P25','P50','P75','P95'].map(s=>s.padStart(8)).join(''));
for(const a of assets){const d=data[a];if(!d)continue;
  console.log([a.padEnd(12),String(d.n).padStart(8),std(d.dl).toFixed(2).padStart(8),
    pctl(d.dl,5).toFixed(2).padStart(8),pctl(d.dl,25).toFixed(2).padStart(8),pctl(d.dl,50).toFixed(2).padStart(8),
    pctl(d.dl,75).toFixed(2).padStart(8),pctl(d.dl,95).toFixed(2).padStart(8)].join(''));
}
// dispersion inter-actifs (asset-agnostic ?)
const stds=assets.map(a=>data[a]?std(data[a].dl):null).filter(x=>x!=null);
const p95s=assets.map(a=>data[a]?pctl(data[a].dl,95):null).filter(x=>x!=null);
console.log(`\nInter-actifs : std du ΔADX ${Math.min(...stds).toFixed(2)}..${Math.max(...stds).toFixed(2)} | P95 ${Math.min(...p95s).toFixed(2)}..${Math.max(...p95s).toFixed(2)}`);
