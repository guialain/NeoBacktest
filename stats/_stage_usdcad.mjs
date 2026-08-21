import fs from 'fs';
import { detectOpportunity } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
const raw = fs.readFileSync('C:/Users/Public/Neo-Backtest/data/matrix/USDCAD.csv','utf8').split(/\r?\n/).filter(l=>l.trim());
const H = raw[0].split(';').map(h=>h.trim());
const toRow = l => { const v=l.split(';'); const o={}; H.forEach((h,i)=>{const s=v[i]?.trim();const n=Number(s);o[h]=(s!==''&&Number.isFinite(n))?n:s;}); return o; };
for (const ts of ['2026.07.02 13:33:27','2026.07.02 13:37','2026.07.02 13:43','2026.07.02 13:51','2026.07.02 13:53']) {
  const line = raw.find(l=>l.startsWith(ts)); if(!line){console.log(ts,'introuvable');continue;}
  const row = toRow(line); const r = detectOpportunity(row,'USDCAD');
  const s = r.rawSelection, h1 = r.stoch.perTf.h1, p = r.maturity.perTf.h1;
  console.log(`\n${row.timestamp}  → ${s.side}/${s.strategy} ${s.profile??s.waitProfile} (${s.reasons?.[0]})`);
  console.log(`  STAGE = ${s.obs?.stage ?? '(via marketProfile)'}  | maturity.state=${r.maturity.state} score=${r.maturity.score}  dLevel(%D h1)=${r.stoch.dLevel} → ${r.stoch.dLevel>=50?'HIGH/BUY':'LOW/SELL'}`);
  console.log(`  contribs h1: rsi=${p.rsi} wr=${p.wr} zscore=${p.zscore} stoch=${p.stoch} tdr=${p.tdr} frac=${p.frac?.toFixed(3)}  | bruts: RSI=${row['rsi_h1_s0']} %K=${row['stoch_k_h1_s0']} z=${row['zscore_h1_s0']}`);
}
