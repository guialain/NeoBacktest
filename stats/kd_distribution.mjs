// kd_distribution.mjs — distribution de k-d (stoch_k - stoch_d) par actif × TF.
// Percentiles P1 P5 P10 P15 P20 P30 P40 P50 + miroir P60 P70 P80 P85 P90 P95 P99.
// Sortie: stats/kd_distribution.xls (SpreadsheetML 2003, un onglet par TF).
import fs from 'fs';
import path from 'path';

const FILES_DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const OUT = path.join('C:/Users/Public/Neo-Backtest/stats', 'kd_distribution.xls');
const TFS = ['M15', 'H1', 'H4'];
const PCTS = [1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95, 99];

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

// Découvre les actifs à partir des noms de fichiers hist_<ASSET>_<TF>.csv
const all = fs.readdirSync(FILES_DIR).filter(f => /^hist_.+_(M15|H1|H4)\.csv$/.test(f));
const assets = new Set();
for (const f of all) {
  const m = f.match(/^hist_(.+)_(M15|H1|H4)\.csv$/);
  if (m) assets.add(m[1]);
}
const ASSETS = [...assets].sort();

// Calcule k-d par actif/TF
const data = {}; // data[tf][asset] = { pcts:{}, n }
for (const tf of TFS) data[tf] = {};

for (const asset of ASSETS) {
  for (const tf of TFS) {
    const fp = path.join(FILES_DIR, `hist_${asset}_${tf}.csv`);
    if (!fs.existsSync(fp)) { data[tf][asset] = null; continue; }
    const lines = fs.readFileSync(fp, 'utf8').split(/\r?\n/);
    const header = lines[0].split(';');
    const ik = header.indexOf('stoch_k'), id = header.indexOf('stoch_d');
    const kd = [];
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(';');
      if (c.length < header.length) continue;
      const k = Number(c[ik]), d = Number(c[id]);
      if (Number.isFinite(k) && Number.isFinite(d)) kd.push(k - d);
    }
    kd.sort((a, b) => a - b);
    const pcts = {};
    for (const p of PCTS) pcts[p] = percentile(kd, p);
    data[tf][asset] = { pcts, n: kd.length };
  }
}

// ---- Écriture SpreadsheetML 2003 (.xls natif Excel) ----
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const numCell = v => v == null ? '<Cell><Data ss:Type="String"></Data></Cell>'
  : `<Cell><Data ss:Type="Number">${(Math.round(v * 100) / 100)}</Data></Cell>`;
const strCell = (v, style) => `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="String">${esc(v)}</Data></Cell>`;

let sheets = '';
for (const tf of TFS) {
  let rows = '';
  // en-tête
  rows += '<Row>' + strCell('Asset', 'hdr') + strCell('N', 'hdr') +
    PCTS.map(p => strCell('P' + p, 'hdr')).join('') + '</Row>\n';
  for (const asset of ASSETS) {
    const d = data[tf][asset];
    if (!d) { rows += '<Row>' + strCell(asset) + strCell('n/a') + '</Row>\n'; continue; }
    rows += '<Row>' + strCell(asset) +
      `<Cell><Data ss:Type="Number">${d.n}</Data></Cell>` +
      PCTS.map(p => numCell(d.pcts[p])).join('') + '</Row>\n';
  }
  sheets += `<Worksheet ss:Name="${tf}"><Table>\n${rows}</Table></Worksheet>\n`;
}

const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style>
</Styles>
${sheets}</Workbook>`;

fs.writeFileSync(OUT, xml, 'utf8');
console.log(`OK -> ${OUT}`);
console.log(`Actifs: ${ASSETS.length} | TF: ${TFS.join(',')} | percentiles: ${PCTS.map(p=>'P'+p).join(' ')}`);
// résumé console
for (const tf of TFS) {
  const ns = ASSETS.map(a => data[tf][a]?.n || 0);
  console.log(`  ${tf}: ${ns.filter(n=>n>0).length} actifs, barres ${Math.min(...ns)}..${Math.max(...ns)}`);
}
