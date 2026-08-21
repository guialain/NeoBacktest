import fs from 'fs';
import { detectOpportunity, maturityGate } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
import { observeProfile } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js';
const load = a => { const raw=fs.readFileSync(`C:/Users/Public/Neo-Backtest/data/matrix/${a}.csv`,'utf8').split(/\r?\n/).filter(l=>l.trim()); const H=raw[0].split(';').map(h=>h.trim()); return {raw,H}; };
const toRow=(l,H)=>{const v=l.split(';');const o={};H.forEach((h,i)=>{const s=v[i]?.trim();const n=Number(s);o[h]=(s!==''&&Number.isFinite(n))?n:s;});return o;};
for (const [a,ts] of [['USDCAD','2026.07.02 13:33:27'],['GERMANY_40','2026.07.08 15:09:32']]) {
  const {raw,H}=load(a); const row=toRow(raw.find(l=>l.startsWith(ts)),H);
  const r=detectOpportunity(row,a); const m=maturityGate(row);
  const obs=observeProfile({vector:r.vector,energy:r.energy,maturity:m,stoch:r.stoch});
  console.log(`${a} ${ts}: score=${m.score} z=${m.zscoreH1} → stage=${obs.stage}  | décision ${r.rawSelection.side}/${r.rawSelection.strategy} ${r.rawSelection.profile??r.rawSelection.waitProfile}`);
}
// sanity : ranking non vide + distribution des stages sur GERMANY (échantillon)
const {raw,H}=load('GERMANY_40'); const cnt={}; let empty=0,tot=0;
for(let i=1;i<raw.length;i+=20){const row=toRow(raw[i],H);const r=detectOpportunity(row,'GERMANY_40');const m=maturityGate(row);const obs=observeProfile({vector:r.vector,energy:r.energy,maturity:m,stoch:r.stoch});cnt[obs.stage]=(cnt[obs.stage]||0)+1;tot++;if(!r.marketProfile.ranking.length)empty++;}
console.log('\nStages (échantillon GERMANY):',Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${(100*v/tot).toFixed(0)}%`).join(' '));
console.log('ranking vide:',empty,'/',tot);
