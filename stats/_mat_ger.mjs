import fs from 'fs';
import { detectOpportunity } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
const raw = fs.readFileSync('C:/Users/Public/Neo-Backtest/data/matrix/GERMANY_40.csv','utf8').split(/\r?\n/).filter(l=>l.trim());
const H = raw[0].split(';').map(h=>h.trim());
const toRow = l => { const v=l.split(';'); const o={}; H.forEach((h,i)=>{const s=v[i]?.trim();const n=Number(s);o[h]=(s!==''&&Number.isFinite(n))?n:s;}); return o; };
const row = toRow(raw.find(l=>l.startsWith('2026.07.08 15:09:32')));
const r = detectOpportunity(row,'GERMANY_40');
console.log('maturity.state =', r.maturity.state, '| score =', r.maturity.score, ' (seaux: EARLY<23 MID<35 LATE<52 EXH≥52)');
console.log('dLevel (%D h1) =', r.stoch.dLevel, '→ suffixe', (r.stoch.dLevel>=50?'BUY':'SELL'), '(bascule à 50 pile)');
console.log('\nContribs par TF (chaque indic = band 0..3) :');
for (const tf of ['h1','h4']) { const p=r.maturity.perTf[tf];
  console.log(` ${tf}: rsi=${p.rsi} wr=${p.wr} zscore=${p.zscore} stoch=${p.stoch} tdr=${p.tdr} | dist=${p.distance?.toFixed?.(2)} pos=${p.position} fat=${p.fatigue} frac=${p.frac?.toFixed?.(3)}`); }
console.log('\nValeurs brutes s0 :');
for (const tf of ['h1','h4']) console.log(` ${tf}: rsi=${row['rsi_'+tf+'_s0']} wr=${row['wr_'+tf+'_s0']} zscore=${row['zscore_'+tf+'_s0']} stochK=${row['stoch_k_'+tf+'_s0']}`);
