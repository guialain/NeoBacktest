import fs from 'fs';
import { detectOpportunity, maturityGate } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
import { observeProfile } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js';
const dir='C:/Users/Public/Neo-Backtest/data/matrix';
const winCount={}, soStage={}, raStage={}; let bars=0;
let soWin=0, raWin=0, soLateBuy=0, raLateSell=0;
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.csv'))){
  const raw=fs.readFileSync(`${dir}/${f}`,'utf8').split(/\r?\n/).filter(l=>l.trim());
  const H=raw[0].split(';').map(h=>h.trim());const seen=new Set();
  for(let i=1;i<raw.length;i++){const v=raw[i].split(';');const hk=String(v[1]??'').slice(0,13);if(seen.has(hk))continue;seen.add(hk);
    const o={};H.forEach((h,j)=>{const s=v[j]?.trim();const n=Number(s);o[h]=(s!==''&&Number.isFinite(n))?n:s;});
    const r=detectOpportunity(o,f.replace('.csv',''));bars++;
    const win=r.marketProfile.ranking?.[0]?.[0];if(!win)continue;winCount[win]=(winCount[win]||0)+1;
    const m=maturityGate(o);const obs=observeProfile({vector:r.vector,energy:r.energy,maturity:m,stoch:r.stoch});
    if(win==="Sell-off"){soWin++;soStage[obs.stage]=(soStage[obs.stage]||0)+1;if(obs.stage==="LATE_BUY")soLateBuy++;}
    if(win==="Rally"){raWin++;raStage[obs.stage]=(raStage[obs.stage]||0)+1;if(obs.stage==="LATE_SELL")raLateSell++;}
  }
}
console.log(`barres H1 (dédup) : ${bars}`);
console.log('\nWINNER ranking c2 (distribution) :');
for(const [k,n] of Object.entries(winCount).sort((a,b)=>b[1]-a[1]))console.log(`  ${k.padEnd(13)} ${n} (${(100*n/bars).toFixed(1)}%)`);
console.log(`\nSell-off gagne ${soWin}× → stage:`, Object.entries(soStage).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k}:${n}`).join(' '), `→ LATE_BUY (critère) = ${soLateBuy}`);
console.log(`Rally gagne    ${raWin}× → stage:`, Object.entries(raStage).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${k}:${n}`).join(' '), `→ LATE_SELL (critère) = ${raLateSell}`);
