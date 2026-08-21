import fs from 'fs'; import path from 'path';
process.env.NO_TRIGGER = "1";
const { runMatrixBacktest } = await import('../src/components/simulations/matrixBacktest.mjs');
const D='C:/Users/Public/Neo-Backtest/data/matrix';
const by={};
for (const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith('.csv')).sort())
  for (const s of (runMatrixBacktest(path.join(D,f)).signals||[])) {
    if (typeof s.R!=='number') continue;
    const k=s.profile ?? '?';
    (by[k] ??= {n:0,R:0,w:0}); by[k].n++; by[k].R+=s.R; if (s.outcome==='WIN') by[k].w++;
  }
console.log('JSON'+JSON.stringify(by));
