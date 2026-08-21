// Recalibration H1-only des seaux de maturité — distribution du score maturityGate (full H1) sur les 19 actifs.
// Objectif : percentiles pour poser les 2 coupes late/exhausted du schéma signé 6-états.
import fs from 'fs';
import { maturityGate } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';

const dir = 'C:/Users/Public/Neo-Backtest/data/matrix';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.csv'));
const scores = [];          // per-scan (ce que voit le live)
const dedup = [];           // 1 valeur par barre H1 close (dédupliqué, moins biaisé)
let rows = 0;

for (const f of files) {
  const raw = fs.readFileSync(`${dir}/${f}`, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const H = raw[0].split(';').map(h => h.trim());
  const seen = new Set();   // dédup par (actif, heure-horloge) : 1 valeur par barre H1
  for (let i = 1; i < raw.length; i++) {
    const v = raw[i].split(';');
    const o = {}; H.forEach((h, j) => { const s = v[j]?.trim(); const n = Number(s); o[h] = (s !== '' && Number.isFinite(n)) ? n : s; });
    const m = maturityGate(o);
    if (m.score == null) continue;
    scores.push(m.score); rows++;
    const hourKey = f + '|' + String(v[1] ?? '').slice(0, 13);   // v[1] = ISO scan time → tronqué YYYY-MM-DDTHH
    if (!seen.has(hourKey)) { seen.add(hourKey); dedup.push(m.score); }
  }
}

function pct(arr, p) { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
function report(name, arr) {
  console.log(`\n── ${name}  (n=${arr.length}) ──`);
  console.log(`  min ${pct(arr,0)} · p10 ${pct(arr,.1)} · p25 ${pct(arr,.25)} · p30 ${pct(arr,.3)} · médiane ${pct(arr,.5)} · p60 ${pct(arr,.6)} · p75 ${pct(arr,.75)} · p87 ${pct(arr,.87)} · p90 ${pct(arr,.9)} · max ${pct(arr,1)}`);
  const hist = {}; arr.forEach(s => { const b = Math.floor(s / 10) * 10; hist[b] = (hist[b] || 0) + 1; });
  console.log('  histogramme /10 :', Object.entries(hist).sort((a,b)=>a[0]-b[0]).map(([b,n]) => `${b}:${(100*n/arr.length).toFixed(0)}%`).join(' '));
}
console.log(`Fichiers ${files.length} · lignes scorées ${rows}`);
report('PER-SCAN (population live, sur-échantillonnée)', scores);
report('DÉDUP par barre H1 close', dedup);
console.log('\nAncien schéma (blend h1/h4/m15) : mid=23 late=35 exhausted=52  [p30,p60,p87]');
console.log('Nouveau (2 coupes signées) : late = p60 · exhausted = p87 du H1-only ci-dessus.');
