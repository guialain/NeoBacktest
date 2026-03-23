import { readFileSync, readdirSync } from 'fs';

const MT5_DIR = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/backtest';
const { default: TopOpp }      = await import('./src/components/robots/TopOpportunities.js');
const { default: ReversalStrat } = await import('./src/components/robots/reversal.js');

const files = readdirSync(MT5_DIR).filter(f => f.endsWith('.csv')).slice(0, 1);

for (const f of files) {
  const lines = readFileSync(MT5_DIR + '/' + f, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0].split(';').map(h => h.trim());
  const rows = lines.slice(1).map((l, i) => {
    const r = { index: i };
    l.split(';').forEach((v, j) => {
      const n = Number(v.trim());
      r[headers[j]] = Number.isFinite(n) ? n : v.trim();
    });
    return r;
  });

  // reversal brut (sans routing)
  const revRaw = ReversalStrat.evaluate(rows, { debug: true });
  console.log(`\nReversal brut (sans routing): ${revRaw.length}`);
  revRaw.slice(0, 3).forEach(s => console.log(' ', JSON.stringify({
    signalType: s.signalType, rsi_h1: s.rsi_h1, slope_h1: s.slope_h1,
    dslope_h1: s.dslope_h1, dz_h1: s.dz_h1, score: s.score
  })));

  // barres en zone reversal RSI
  const revBuyBars  = rows.filter(r => Number(r.rsi_h1) <= 33).length;
  const revSellBars = rows.filter(r => Number(r.rsi_h1) >= 67).length;
  const contBars    = rows.filter(r => Number(r.rsi_h1) > 33 && Number(r.rsi_h1) < 67).length;
  console.log(`\nZones RSI routing:`);
  console.log(`  REVERSAL_BUY  (rsi<=33): ${revBuyBars} bars`);
  console.log(`  CONTINUATION  (33<rsi<67): ${contBars} bars`);
  console.log(`  REVERSAL_SELL (rsi>=67): ${revSellBars} bars`);

  // check zscore distribution in reversal zone
  const revBuyRows = rows.filter(r => Number(r.rsi_h1) <= 33);
  const zscores = revBuyRows.map(r => Number(r.zscore_h1)).filter(Number.isFinite);
  if (zscores.length) {
    zscores.sort((a,b) => a-b);
    const p25 = zscores[Math.floor(zscores.length*0.25)];
    const p50 = zscores[Math.floor(zscores.length*0.50)];
    const p75 = zscores[Math.floor(zscores.length*0.75)];
    const pctBelow = zscores.filter(z => z < -1.5).length / zscores.length * 100;
    console.log(`\nzscore_h1 dans REVERSAL_BUY zone (n=${zscores.length}):`);
    console.log(`  p25=${p25?.toFixed(2)} p50=${p50?.toFixed(2)} p75=${p75?.toFixed(2)}`);
    console.log(`  % avec zscore < -1.5 : ${pctBelow.toFixed(1)}%`);
  }
}
