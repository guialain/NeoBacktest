// Trace GERMANY_40 2026.07.08 15:09:32 — pourquoi CONT SELL (Strong Bear) et pas EXH ?
import fs from 'fs';
import { detectOpportunity } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
import { detectTransition, scoreTransition } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/MarketTransition.js';

const TS = '2026.07.08 15:09:32';
const raw = fs.readFileSync('C:/Users/Public/Neo-Backtest/data/matrix/GERMANY_40.csv', 'utf8').split(/\r?\n/).filter(l => l.trim());
const headers = raw[0].split(';').map(h => h.trim());
function toRow(line) { const v = line.split(';'); const o = {}; headers.forEach((h, i) => { const s = v[i]?.trim(); const n = Number(s); o[h] = (s !== '' && Number.isFinite(n)) ? n : s; }); return o; }

// ── réplication EXACTE de readTransition + exhTradable + exhGatesPass (non exportés) ─────────────
function readTransition(gate) {
  const tr = detectTransition(gate?.h1Crossover);
  if (!tr) return null;
  const score = scoreTransition(tr, {
    crossoverMaturity: gate?.h1Crossover?.crossoverMaturity ?? null,
    dominanceTurn: gate?.h1Adx?.dominanceTurn ?? null,
    axisMove: tr.axisMove,
  });
  return { ...tr, score, sideUC: tr.side === 'Buy' ? 'BUY' : 'SELL', isExh: tr.type.startsWith('exh') };
}
function exhGatesPass(side, gate, log) {
  if (gate?.h1Contact !== 'SEPARATED') { log.push(`   ✗ h1Contact=${gate?.h1Contact} ≠ SEPARATED`); return false; }
  const z = gate?.h1Zone;
  if (z == null) { log.push('   ✗ h1Zone null'); return false; }
  const zLow = z === 'BASSE' || z === 'EXTREME_BASSE', zHigh = z === 'HAUTE' || z === 'EXTREME_HAUTE';
  if (side === 'BUY' && !zLow) { log.push(`   ✗ zone ${z} incohérente pour BUY (fade plancher exige bas)`); return false; }
  if (side === 'SELL' && !zHigh) { log.push(`   ✗ zone ${z} incohérente pour SELL (fade sommet exige haut)`); return false; }
  const mk = gate?.m5K, mkd = gate?.m5Kd;
  if (side === 'BUY' && mk != null && mkd != null && ((mk >= 80 && mkd < 0) || (mk >= 65 && mkd < -5))) { log.push('   ✗ veto M5'); return false; }
  log.push(`   ✓ exhGatesPass OK (contact SEPARATED, zone ${z} cohérente ${side})`);
  return true;
}
function exhTradable(tr, gate, log) {
  if (!tr?.isExh) { log.push('   ✗ pas d\'événement exh (detectTransition)'); return false; }
  const lvl = gate?.h1Adx?.adxClose;
  log.push(`   • ADX close niveau = ${lvl}`);
  if (lvl != null) {
    if (lvl >= 40 && lvl < 50) { log.push('   ✗ ADX∈[40,50) ZONE MORTE → REFUS'); return false; }
    if (lvl >= 50) {
      const z = gate?.h1Zone;
      if (z !== 'EXTREME_HAUTE' && z !== 'EXTREME_BASSE') { log.push(`   ✗ ADX≥50 mais zone ${z} non extrême → REFUS`); return false; }
    }
  }
  return exhGatesPass(tr.sideUC, gate, log);
}

const idx = raw.findIndex(l => l.startsWith(TS));
function dump(line, tag) {
  const row = toRow(line);
  const r = detectOpportunity(row, 'GERMANY_40');
  const sel = r.rawSelection || {};
  const h1 = r.stoch?.perTf?.h1 || {};
  const kd = h1.kd || {};           // crossover
  const adx = h1.adx || {};
  const gate = {
    h1Zone: h1.zone ?? null, h1Contact: h1.contact ?? null,
    h1Crossover: kd, h1Adx: adx,
    m5K: Number(row['stoch_k_m5_s0']) || null,
    m5Kd: (row['stoch_k_m5_s0'] && row['stoch_d_m5_s0']) ? +(Number(row['stoch_k_m5_s0']) - Number(row['stoch_d_m5_s0'])).toFixed(2) : null,
  };
  console.log(`\n===== ${row.timestamp}  ${tag} =====`);
  console.log(`  DÉCISION : side=${sel.side} strat=${sel.strategy} profil=${sel.profile ?? sel.waitProfile ?? '-'} class=${sel.classification} nature=${sel.waitNature ?? '-'}`);
  console.log(`  reasons  : ${(sel.reasons||[]).join(' | ')}`);
  console.log(`  STAGE    : ${r.maturity?.state ?? r.maturity?.stage}`);
  console.log(`  H1 stoch : K=${h1.k} D=${h1.d} zone=${h1.zone} contact=${h1.contact} crossFresh=${h1.crossFresh}`);
  console.log(`  H1 cross : state=${kd.crossoverState} age=${kd.crossAge} maturity=${kd.crossoverMaturity} count=${kd.crossCount}`);
  console.log(`  H1 ADX   : close=${adx.adxClose} delta1=${adx.delta1} deltaLive=${adx.deltaLive} dominanceTurn=${adx.dominanceTurn}`);
  console.log(`  M5       : K=${gate.m5K} K-D=${gate.m5Kd}`);
  console.log(`  zscoreH1 : ${row['zscore_h1_s0']}`);
  // reconstruire l'éligibilité EXH
  const log = [];
  const tr = readTransition(gate);
  if (!tr) { console.log('  EXH ?    : detectTransition → null (aucun cross exploitable)'); }
  else {
    console.log(`  EXH tr   : type=${tr.type} side=${tr.sideUC} isExh=${tr.isExh} score=${tr.score?.toFixed?.(3)}`);
    const ok = exhTradable(tr, gate, log);
    log.forEach(l => console.log(l));
    console.log(`  EXH éligible (aurait été le repli) ? → ${ok ? 'OUI' : 'NON'}`);
  }
}

for (let i = Math.max(1, idx - 2); i <= Math.min(raw.length - 1, idx + 2); i++)
  dump(raw[i], i === idx ? '⭐ ENTRÉE' : (i < idx ? '(avant)' : '(après)'));
