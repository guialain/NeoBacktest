// kd_individual_distribution.mjs — distribution de stoch_k et stoch_d SEPAREMENT.
// Percentiles P1..P99 (+ miroir), par actif x TF. Sortie: stats/stoch_kd_individual.xls
// (6 onglets : K-M15 K-H1 K-H4 D-M15 D-H1 D-H4). + resume console (ou tombent 80/20).
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const OUT = 'C:/Users/Public/Neo-Backtest/stats/stoch_kd_individual.xls';
const TFS = ['M15', 'H1', 'H4'];
const PCTS = [1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95, 99];

function pctl(s, p) { if (!s.length) return null; const r = p/100*(s.length-1), lo=Math.floor(r), hi=Math.ceil(r); return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(r-lo); }
// percentile inverse: quelle fraction est <= v
function rankOf(sorted, v){ let lo=0,hi=sorted.length; while(lo<hi){const m=(lo+hi)>>1; if(sorted[m]<v)lo=m+1;else hi=m;} return 100*lo/sorted.length; }

const assets = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f))
  .map(f => f.replace(/^hist_/, '').replace(/_H1\.csv$/, '')).sort();

// data[metric][tf][asset] = {pcts, n, sorted}
const data = { K: {}, D: {} };
for (const m of ['K','D']) for (const tf of TFS) data[m][tf] = {};

for (const a of assets) {
  for (const tf of TFS) {
    const fp = path.join(DIR, `hist_${a}_${tf}.csv`);
    if (!fs.existsSync(fp)) { data.K[tf][a]=null; data.D[tf][a]=null; continue; }
    const L = fs.readFileSync(fp,'utf8').split(/\r?\n/); const h=L[0].split(';');
    const ik=h.indexOf('stoch_k'), id=h.indexOf('stoch_d');
    const K=[],D=[];
    for(let i=1;i<L.length;i++){const c=L[i].split(';');if(c.length<h.length)continue;const k=+c[ik],d=+c[id];if(Number.isFinite(k))K.push(k);if(Number.isFinite(d))D.push(d);}
    K.sort((x,y)=>x-y); D.sort((x,y)=>x-y);
    const mk={}; for(const p of PCTS)mk[p]=pctl(K,p);
    const md={}; for(const p of PCTS)md[p]=pctl(D,p);
    data.K[tf][a]={pcts:mk,n:K.length,sorted:K};
    data.D[tf][a]={pcts:md,n:D.length,sorted:D};
  }
}

// ---- .xls SpreadsheetML ----
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const numC=v=>v==null?'<Cell><Data ss:Type="String"></Data></Cell>':`<Cell><Data ss:Type="Number">${Math.round(v*100)/100}</Data></Cell>`;
const strC=(v,s)=>`<Cell${s?` ss:StyleID="${s}"`:''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
let sheets='';
for(const m of ['K','D']) for(const tf of TFS){
  let rows='<Row>'+strC('Asset','hdr')+strC('N','hdr')+PCTS.map(p=>strC('P'+p,'hdr')).join('')+'</Row>\n';
  for(const a of assets){const d=data[m][tf][a];
    if(!d){rows+='<Row>'+strC(a)+strC('n/a')+'</Row>\n';continue;}
    rows+='<Row>'+strC(a)+`<Cell><Data ss:Type="Number">${d.n}</Data></Cell>`+PCTS.map(p=>numC(d.pcts[p])).join('')+'</Row>\n';
  }
  sheets+=`<Worksheet ss:Name="${m}-${tf}"><Table>\n${rows}</Table></Worksheet>\n`;
}
const xml=`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
${sheets}</Workbook>`;
fs.writeFileSync(OUT,xml,'utf8');
console.log(`OK -> ${OUT}`);

// ---- resume console : agregat inter-actifs + ou tombent 80/20 ----
for(const m of ['K','D']){
  console.log(`\n===== stoch_${m} : agregat inter-actifs (moyenne des 19) =====`);
  console.log(['TF'.padEnd(5),...[5,10,20,50,80,90,95].map(p=>('P'+p).padStart(7))].join(''));
  for(const tf of TFS){
    const vals=assets.map(a=>data[m][tf][a]).filter(Boolean);
    const line=[5,10,20,50,80,90,95].map(p=>{
      const mean=vals.reduce((s,d)=>s+d.pcts[p],0)/vals.length; return mean.toFixed(1).padStart(7);
    });
    console.log([tf.padEnd(5),...line].join(''));
  }
  // ou tombent les seuils 20 et 80 en percentile (moyenne inter-actifs)
  console.log(`  seuils extremes actuels sur ${m} :`);
  for(const tf of TFS){
    const vals=assets.map(a=>data[m][tf][a]).filter(Boolean);
    const r20=vals.reduce((s,d)=>s+rankOf(d.sorted,20),0)/vals.length;
    const r80=vals.reduce((s,d)=>s+rankOf(d.sorted,80),0)/vals.length;
    console.log(`    ${tf.padEnd(4)}  ${m}<=20 = ${r20.toFixed(1)}% des barres  |  ${m}>=80 = ${(100-r80).toFixed(1)}% des barres`);
  }
}
