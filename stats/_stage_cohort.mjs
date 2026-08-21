import fs from 'fs'; import path from 'path';
process.env.NO_TRIGGER="1";
const { runMatrixBacktest } = await import('../src/components/simulations/matrixBacktest.mjs');
const { detectOpportunity } = await import('../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js');
const { observeProfile } = await import('../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js');
const { loadCsvRows } = await import('../src/components/simulations/matrixBacktest.mjs');
const D='C:/Users/Public/Neo-Backtest/data/matrix';
const by={};
for (const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith('.csv')).sort()) {
  const a=f.replace('.csv','');
  const rows=loadCsvRows(path.join(D,f));
  const idx=new Map(); rows.forEach((r,i)=>idx.set(String(r.timestamp),i));
  for (const s of (runMatrixBacktest(path.join(D,f)).signals||[])) {
    if (typeof s.R!=='number' || s.strategy!=='CONT') continue;
    const i=idx.get(String(s.tsMT)); if(i==null) continue;
    let d; try{ d=detectOpportunity(rows[i],a); }catch{ continue; }
    const o=observeProfile({vector:d.vector,energy:d.energy,maturity:d.maturity,stoch:d.stoch});
    const k=`${s.profile}|${o.stage}`;
    (by[k]??={n:0,R:0,w:0}); by[k].n++; by[k].R+=s.R; if(s.outcome==='WIN') by[k].w++;
  }
}
console.log('JSON'+JSON.stringify(by));
