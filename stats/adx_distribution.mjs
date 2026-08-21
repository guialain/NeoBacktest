// adx_distribution.mjs — distribution de adx14 par actif x TF.
// Percentiles P1..P99. Sortie: stats/adx_distribution.xls (un onglet par TF).
// + resume console : agregat inter-actifs, dispersion, ou tombent 20/25/40.
import fs from 'fs';
import path from 'path';

const DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const OUT = 'C:/Users/Public/Neo-Backtest/stats/adx_distribution.xls';
const TFS = ['M15', 'H1', 'H4'];
const PCTS = [1, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 99];

function pctl(s,p){if(!s.length)return null;const r=p/100*(s.length-1),lo=Math.floor(r),hi=Math.ceil(r);return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(r-lo);}
function fracBelow(sorted,v){let lo=0,hi=sorted.length;while(lo<hi){const m=(lo+hi)>>1;if(sorted[m]<v)lo=m+1;else hi=m;}return 100*lo/sorted.length;}
const std=arr=>{const m=arr.reduce((a,b)=>a+b,0)/arr.length;return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length);};

const assets = fs.readdirSync(DIR).filter(f => /^hist_.+_H1\.csv$/.test(f))
  .map(f => f.replace(/^hist_/, '').replace(/_H1\.csv$/, '')).sort();

const data = {}; for(const tf of TFS)data[tf]={};
for (const a of assets) {
  for (const tf of TFS) {
    const fp=path.join(DIR,`hist_${a}_${tf}.csv`); if(!fs.existsSync(fp)){data[tf][a]=null;continue;}
    const L=fs.readFileSync(fp,'utf8').split(/\r?\n/);const h=L[0].split(';');const ia=h.indexOf('adx14');
    const A=[];for(let i=1;i<L.length;i++){const c=L[i].split(';');if(c.length<h.length)continue;const v=+c[ia];if(Number.isFinite(v))A.push(v);}
    A.sort((x,y)=>x-y);
    const pc={};for(const p of PCTS)pc[p]=pctl(A,p);
    data[tf][a]={pcts:pc,n:A.length,sorted:A};
  }
}

// ---- .xls ----
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const numC=v=>v==null?'<Cell><Data ss:Type="String"></Data></Cell>':`<Cell><Data ss:Type="Number">${Math.round(v*100)/100}</Data></Cell>`;
const strC=(v,s)=>`<Cell${s?` ss:StyleID="${s}"`:''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
let sheets='';
for(const tf of TFS){
  let rows='<Row>'+strC('Asset','hdr')+strC('N','hdr')+PCTS.map(p=>strC('P'+p,'hdr')).join('')+'</Row>\n';
  for(const a of assets){const d=data[tf][a];
    if(!d){rows+='<Row>'+strC(a)+strC('n/a')+'</Row>\n';continue;}
    rows+='<Row>'+strC(a)+`<Cell><Data ss:Type="Number">${d.n}</Data></Cell>`+PCTS.map(p=>numC(d.pcts[p])).join('')+'</Row>\n';
  }
  sheets+=`<Worksheet ss:Name="${tf}"><Table>\n${rows}</Table></Worksheet>\n`;
}
fs.writeFileSync(OUT,`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
${sheets}</Workbook>`,'utf8');
console.log(`OK -> ${OUT}\n`);

// ---- resume ----
console.log('ADX(14) agregat inter-actifs (moyenne des 19) :');
console.log(['TF'.padEnd(5),...[10,25,50,75,90,95].map(p=>('P'+p).padStart(7))].join(''));
for(const tf of TFS){
  const vals=assets.map(a=>data[tf][a]).filter(Boolean);
  console.log([tf.padEnd(5),...[10,25,50,75,90,95].map(p=>(vals.reduce((s,d)=>s+d.pcts[p],0)/vals.length).toFixed(1).padStart(7))].join(''));
}
console.log('\nOu tombent les seuils ADX usuels (%% des barres au-dessus, moyenne inter-actifs) :');
console.log(['TF'.padEnd(5),'>=20','>=25','>=40'].map(s=>s.padStart(9)).join(''));
for(const tf of TFS){
  const vals=assets.map(a=>data[tf][a]).filter(Boolean);
  const above=v=>(vals.reduce((s,d)=>s+(100-fracBelow(d.sorted,v)),0)/vals.length);
  console.log([tf.padEnd(5),above(20).toFixed(1)+'%',above(25).toFixed(1)+'%',above(40).toFixed(1)+'%'].map(s=>s.padStart(9)).join(''));
}
console.log('\nDispersion inter-actifs de la mediane ADX (asset-agnostic ?) :');
for(const tf of TFS){
  const meds=assets.map(a=>data[tf][a]).filter(Boolean).map(d=>d.pcts[50]);
  console.log(`  ${tf.padEnd(4)}  median ADX : min=${Math.min(...meds).toFixed(1)} max=${Math.max(...meds).toFixed(1)} spread=${(Math.max(...meds)-Math.min(...meds)).toFixed(1)} std=${std(meds).toFixed(1)}`);
}
