// exh_detection_funnel.mjs — le moteur voit-il TOUS les cross H1 ? (owner 16/07)
//   Hypothèse owner : « le moteur ne voit pas tous les exh, c'est pour ça qu'il CONT BUY là où il y a
//   un EXH SELL ». On prend CHAQUE cross H1 frais (dédupliqué par barre de cross) et on regarde ce que
//   le moteur en fait, puis OÙ ça bloque.
import fs from 'fs'; import path from 'path';
process.env.NO_TRIGGER = "1";
import { loadCsvRows, admissionBlock } from '../src/components/simulations/matrixBacktest.mjs';
import { detectOpportunity } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js';
import { observeProfile } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js';

const D = 'C:/Users/Public/Neo-Backtest/data/matrix';
const V = { n: 0, fireEXH: 0, fireCONT: 0, wait: 0 };
const waitWhy = {}, blockedBy = {}, contDir = { agree: 0, against: 0 };
const stageAt = {}, zoneAt = {};
const hourKey = (ts) => String(ts).slice(0, 13);

for (const f of fs.readdirSync(D).filter(x => x.toLowerCase().endsWith('.csv')).sort()) {
  const asset = f.replace('.csv', '');
  const seen = new Set();
  for (const r of loadCsvRows(path.join(D, f))) {
    if (admissionBlock(r, asset)) continue;                 // comme le live
    let det; try { det = detectOpportunity(r, asset); } catch { continue; }
    const h1 = det.stoch?.perTf?.h1 ?? {};
    if (h1.crossFresh !== true || h1.k == null) continue;    // on ne regarde QUE les cross H1 frais
    const key = `${asset}|${hourKey(r.timestamp)}|${(h1.k - h1.d) > 0 ? 'U' : 'D'}`;
    if (seen.has(key)) continue;                             // 1 cross = 1 événement (pas N rows)
    seen.add(key);

    const obs = observeProfile({ vector: det.vector, energy: det.energy, maturity: det.maturity, stoch: det.stoch });
    const kdSide = (h1.k - h1.d) > 0 ? "BUY" : "SELL";       // sens que le cross H1 désigne
    const rs = det.rawSelection;
    V.n++;
    stageAt[obs.stage ?? '?'] = (stageAt[obs.stage ?? '?'] ?? 0) + 1;
    zoneAt[obs.zone ?? '?'] = (zoneAt[obs.zone ?? '?'] ?? 0) + 1;

    if (rs.strategy === "EXH" && (rs.side === "BUY" || rs.side === "SELL")) V.fireEXH++;
    else if (rs.strategy === "CONT" && (rs.side === "BUY" || rs.side === "SELL")) {
      V.fireCONT++;
      if (rs.side === kdSide) contDir.agree++; else contDir.against++;   // CONT à contresens du cross ?
    } else {
      V.wait++;
      waitWhy[rs.waitNature ?? '?'] = (waitWhy[rs.waitNature ?? '?'] ?? 0) + 1;
      if (rs.waitNature === "criterion-blocked") blockedBy[`${rs.waitProfile}/${rs.blockedBy?.observable}`] = (blockedBy[`${rs.waitProfile}/${rs.blockedBy?.observable}`] ?? 0) + 1;
    }
  }
}
const pc = (x) => `${(100 * x / V.n).toFixed(1)}%`;
console.log(`\n===== ${V.n} cross H1 FRAIS (dédupliqués, admission appliquée, 19 actifs) =====`);
console.log(`   fire EXH   ${String(V.fireEXH).padStart(5)}  ${pc(V.fireEXH)}`);
console.log(`   fire CONT  ${String(V.fireCONT).padStart(5)}  ${pc(V.fireCONT)}     dont ${contDir.against} À CONTRESENS du cross (${pc(contDir.against)})`);
console.log(`   WAIT       ${String(V.wait).padStart(5)}  ${pc(V.wait)}`);
console.log(`\n   nature des WAIT :`);
for (const [k, v] of Object.entries(waitWhy).sort((a, b) => b[1] - a[1])) console.log(`     ${k.padEnd(22)} ${String(v).padStart(5)}  ${pc(v)}`);
console.log(`\n   critère bloquant (profil/observable) :`);
for (const [k, v] of Object.entries(blockedBy).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`     ${k.padEnd(30)} ${String(v).padStart(5)}`);
console.log(`\n   STAGE au moment du cross H1 :`);
for (const [k, v] of Object.entries(stageAt).sort((a, b) => b[1] - a[1])) console.log(`     ${k.padEnd(16)} ${String(v).padStart(5)}  ${pc(v)}`);
console.log(`\n   ZONE au moment du cross H1 :`);
for (const [k, v] of Object.entries(zoneAt).sort((a, b) => b[1] - a[1])) console.log(`     ${k.padEnd(16)} ${String(v).padStart(5)}  ${pc(v)}`);
