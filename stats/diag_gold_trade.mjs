// diag_gold_trade.mjs — dump tous les observables du moteur pour la row GOLD 2026.06.30 15:47:55
// (BUY CONTINUATION qui a perdu). Cherche quel observable aurait pu freiner.
import fs from 'fs';
import { detectOpportunity } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';

const TS = '2026.06.30 15:47:55';
const raw = fs.readFileSync('C:/Users/Public/Neo-Backtest/data/matrix/GOLD.csv', 'utf8').split(/\r?\n/).filter(l => l.trim());
const headers = raw[0].split(';').map(h => h.trim());
function toRow(line) { const v = line.split(';'); const o = {}; headers.forEach((h, i) => { const s = v[i]?.trim(); const n = Number(s); o[h] = (s !== '' && Number.isFinite(n)) ? n : s; }); return o; }

// contexte : quelques rows autour pour voir la dynamique
const idx = raw.findIndex(l => l.startsWith(TS));
if (idx < 0) { console.log('row introuvable'); process.exit(1); }

function dump(line, tag) {
  const row = toRow(line);
  const r = detectOpportunity(row, 'GOLD');
  const v = r.vector, e = r.energy, m = r.maturity, s = r.stoch, mp = r.marketProfile;
  const sel = r.selection || r.rawSelection || {};
  console.log(`\n===== ${row.timestamp}  ${tag} =====`);
  console.log(`  DÉCISION : ${sel.signal ?? sel.action ?? '?'} | profil=${mp?.profile ?? mp?.ranking?.[0]?.[0] ?? '?'} | side=${sel.side ?? '?'} | strat=${sel.strategy ?? '?'} | ${sel.classification ?? ''} ${sel.waitReason ? '('+sel.waitReason+')' : ''}`);
  console.log(`  TREND   : dailyDir=${v?.dailyDirection}  force=${forceBand(v?.forceScore)}(${v?.forceScore})  thetaDay=${v?.thetaDay}  thetaDeg=${v?.thetaDayDeg}  thetaRotation=${v?.thetaRotation}  deltaTheta=${v?.deltaTheta}`);
  console.log(`  VECTOR  : impulse(score)=${v?.score}  direction=${v?.direction}  continuationDelta=${v?.continuationDelta}  angle=${v?.angle}`);
  console.log(`  ENERGY  : energyState=${e?.energyState}  score=${e?.score}  intensity=${e?.intensity ?? '?'}`);
  console.log(`  CYCLE   : stage=${m?.state ?? m?.stage}`);
  console.log(`  STOCHDYN: zone=${s?.zone}  contact=${s?.contact}  contactPrev=${s?.contactPrev}  crossFresh=${s?.perTf?.h1?.crossFresh||s?.perTf?.m15?.crossFresh}  dLevel=${s?.dLevel}  sep=${s?.separation}`);
  console.log(`             h1: K=${s?.perTf?.h1?.k} D=${s?.perTf?.h1?.d} zone=${s?.perTf?.h1?.zone} crossFresh=${s?.perTf?.h1?.crossFresh}`);
  console.log(`             m15:K=${s?.perTf?.m15?.k} D=${s?.perTf?.m15?.d} zone=${s?.perTf?.m15?.zone} crossFresh=${s?.perTf?.m15?.crossFresh}`);
}
function forceBand(fs){ if(fs==null)return '?'; return fs>=75?'EXTREME':fs>=50?'HIGH':fs>=25?'MEDIUM':'LOW'; }

// 3 rows avant + la row + 2 après
for (let i = Math.max(1, idx - 3); i <= Math.min(raw.length - 1, idx + 2); i++) {
  dump(raw[i], i === idx ? '⭐ ENTRÉE' : (i < idx ? '(avant)' : '(après)'));
}
