// add_intraday_level.mjs — ajoute intraday_level (regime) + intraday_force (-4..+4) a chaque hist_*.csv.
// Replique getIntradayLevel() du moteur (src/utils/marketLevels.js) + INTRADAY_CONFIG par actif.
// Ecrit les copies augmentees dans stats/data/ (source MT5 preserve).
import fs from 'fs';
import path from 'path';
import { INTRADAY_CONFIG } from '../src/components/config/IntradayConfig.js';

const SRC = 'C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files';
const OUT = 'C:/Users/Public/Neo-Backtest/stats/data';
fs.mkdirSync(OUT, { recursive: true });

// classifieur EXACT du moteur
function getIntradayLevel(val, cfg) {
  if (!Number.isFinite(val)) return 'NEUTRE';
  if (val >  cfg.spikeUp)       return 'SPIKE_UP';
  if (val >= cfg.explosiveUp)   return 'EXPLOSIVE_UP';
  if (val >= cfg.strongUp)      return 'STRONG_UP';
  if (val >= cfg.softUp)        return 'SOFT_UP';
  if (val >  cfg.softDown)      return 'NEUTRE';
  if (val >  cfg.strongDown)    return 'SOFT_DOWN';
  if (val >  cfg.explosiveDown) return 'STRONG_DOWN';
  if (val >  cfg.spikeDown)     return 'EXPLOSIVE_DOWN';
  return 'SPIKE_DOWN';
}
const FORCE = { SPIKE_DOWN:-4, EXPLOSIVE_DOWN:-3, STRONG_DOWN:-2, SOFT_DOWN:-1, NEUTRE:0, SOFT_UP:1, STRONG_UP:2, EXPLOSIVE_UP:3, SPIKE_UP:4 };

// is_active : 7-20h heure serveur broker, jours ouvres (fenetre uniforme provisoire)
const HOUR_LO = 7, HOUR_HI = 20;
function isActive(ts) {
  const [dp, tp] = String(ts).split(' ');
  if (!dp || !tp) return 1;
  const [y, mo, d] = dp.split('.').map(Number);
  const [H] = tp.split(':').map(Number);
  const wd = new Date(y, mo - 1, d).getDay();
  if (wd === 0 || wd === 6) return 0;
  return (H >= HOUR_LO && H < HOUR_HI) ? 1 : 0;
}

const FAILED = [];
function writeRetry(fp, content) {
  try { fs.writeFileSync(fp, content, 'utf8'); return true; }
  catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM') { FAILED.push(path.basename(fp)); return false; }
    throw e;
  }
}

const files = fs.readdirSync(SRC).filter(f => /^hist_.+_(M15|H1|H4)\.csv$/.test(f));
const dist = {}; // dist[symbol] = {level:count}
let usedDefault = new Set();

for (const f of files) {
  const sym = f.match(/^hist_(.+)_(M15|H1|H4)\.csv$/)[1];
  const cfg = INTRADAY_CONFIG[sym] ?? INTRADAY_CONFIG.default;
  if (!INTRADAY_CONFIG[sym]) usedDefault.add(sym);
  const L = fs.readFileSync(path.join(SRC, f), 'utf8').split(/\r?\n/);
  const header = L[0].split(';');
  const ic = header.indexOf('intraday_change');
  const it = header.indexOf('time');
  const out = [header.concat(['intraday_level','intraday_force','is_active']).join(';')];
  dist[sym] = dist[sym] || {};
  for (let i = 1; i < L.length; i++) {
    if (!L[i].trim()) continue;
    const c = L[i].split(';');
    const v = Number(c[ic]);
    const lvl = getIntradayLevel(v, cfg);
    dist[sym][lvl] = (dist[sym][lvl] || 0) + 1;
    out.push(L[i] + ';' + lvl + ';' + FORCE[lvl] + ';' + isActive(c[it]));
  }
  writeRetry(path.join(OUT, f), out.join('\n'));
}

console.log(`OK — ${files.length - FAILED.length}/${files.length} fichiers augmentes -> ${OUT}`);
if (FAILED.length) console.log(`⚠ VERROUILLES (non ecrits, fermer Excel/relancer) : ${FAILED.join(', ')}`);
console.log(`Colonnes ajoutees : intraday_level, intraday_force (-4..+4)`);
if (usedDefault.size) console.log(`⚠ config DEFAULT (non calibre) pour : ${[...usedDefault].join(', ')}`);

// distribution realisee des regimes (agregat, sur H1 pour lisibilite)
const LEVELS = ['SPIKE_DOWN','EXPLOSIVE_DOWN','STRONG_DOWN','SOFT_DOWN','NEUTRE','SOFT_UP','STRONG_UP','EXPLOSIVE_UP','SPIKE_UP'];
console.log('\nDistribution realisee des regimes intraday (agregat 19 actifs, tous TF) :');
const agg = {}; let tot = 0;
for (const sym of Object.keys(dist)) for (const [lv,n] of Object.entries(dist[sym])) { agg[lv]=(agg[lv]||0)+n; tot+=n; }
console.log('  (design cible : NEUTRE 40%, SOFT 10%+10%, STRONG 15%+15%, EXPLOSIVE 4%+4%, SPIKE 1%+1%)');
for (const lv of LEVELS) console.log(`  ${lv.padEnd(16)} ${((100*(agg[lv]||0)/tot).toFixed(1)+'%').padStart(7)}  (${agg[lv]||0})`);
