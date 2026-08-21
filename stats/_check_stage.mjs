import fs from 'fs';
import { detectOpportunity } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
const raw = fs.readFileSync('C:/Users/Public/Neo-Backtest/data/matrix/GERMANY_40.csv','utf8').split(/\r?\n/).filter(l=>l.trim());
const H = raw[0].split(';').map(h=>h.trim());
const toRow = l => { const v=l.split(';'); const o={}; H.forEach((h,i)=>{const s=v[i]?.trim();const n=Number(s);o[h]=(s!==''&&Number.isFinite(n))?n:s;}); return o; };
// distribution des stages produits + ranking non vide, sur un échantillon
const seenStages = {}; let emptyRank=0, tot=0;
for (let i=1;i<raw.length;i+=50){ const r=detectOpportunity(toRow(raw[i]),'GERMANY_40'); const st=r.marketProfile? undefined:undefined;
  const obs = r.rawSelection; }
// dump précis de la barre litigieuse + 2 voisines
for (const ts of ['2026.07.08 15:08:32','2026.07.08 15:09:32','2026.07.08 15:10:32']) {
  const r = detectOpportunity(toRow(raw.find(l=>l.startsWith(ts))),'GERMANY_40');
  // obs.stage n'est pas exposé direct; on le lit via marketProfile? Non → via reconstruction: score+dLevel
  console.log(`${ts}: state=${r.maturity.state} score=${r.maturity.score} dLevel=${r.stoch.dLevel} → décision ${r.rawSelection.side}/${r.rawSelection.strategy} ${r.rawSelection.profile??r.rawSelection.waitProfile??''} (${r.rawSelection.reasons?.[0]??''}) | ranking=${r.marketProfile.ranking.length} winner=${r.marketProfile.ranking[0]?.[0]}`);
}
// balayage stages sur tout le fichier (échantillon 1/20)
for (let i=1;i<raw.length;i+=20){ const r=detectOpportunity(toRow(raw[i]),'GERMANY_40'); tot++;
  if(!r.marketProfile.ranking.length) emptyRank++;
}
console.log(`\nÉchantillon ${tot} barres : ranking vide = ${emptyRank} (${(100*emptyRank/tot).toFixed(1)}%)`);
