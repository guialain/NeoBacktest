// trans_impulse_rules.mjs — la table de transition ignore l'IMPULSE. Quelle règle l'ajouterait le mieux ?
// ============================================================================================
//   Constat (trans_cells_impulse) : deux cohortes seules détruisent 137 R —
//     Rally→Strong Bull + FAST_UP  : −84.8   (vendre pendant que ça rippe)
//     Exh→Soft Bull    + FAST_DOWN : −52.1   (vendre quand c'est déjà effondré = tard)
//   …alors que la MEILLEURE cohorte est un CONTRESENS : Exh→Strong Bear + FAST_DOWN = avgR 0.225, WR 91.9 %
//   (acheter tôt, pendant que ça tombe encore). Donc « exiger l'impulse dans le sens » serait FAUX.
//
//   Testé via opts.exhGate (les TRANS sortent en strategy EXH) → AUCUNE modif du moteur.
//   ⚠ Les règles F/G sont du cherry-pick de cohortes → surajustement probable. Elles servent de
//     PLAFOND théorique (« combien y a-t-il à gagner ? »), pas de candidates.
// ============================================================================================
import fs from 'fs'; import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest } from '../src/components/simulations/matrixBacktest.mjs';
import { observeProfile } from '../../Matrix-Revolution/src/components/robot/engines/opportunities/classifyMarketProfile.js';

const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const files = fs.readdirSync(MATRIX).filter(f => f.toLowerCase().endsWith('.csv')).sort();
const CUT = '2026.07.05';

const impOf = (det) => observeProfile({ vector: det.vector, energy: det.energy, maturity: det.maturity, stoch: det.stoch }).impulse ?? null;
const isUp = (i) => i === 'UP' || i === 'FAST_UP';
const isDown = (i) => i === 'DOWN' || i === 'FAST_DOWN';

// chaque règle : (sel, det) → true = ON JETTE ce fire TRANS
const RULES = {
  'A · baseline (aucun filtre)': null,
  'B · SELL sans impulse UP': (s, d) => s.side === 'SELL' && isUp(impOf(d)),
  'C · BUY sans impulse DOWN (intuitif)': (s, d) => s.side === 'BUY' && isDown(impOf(d)),
  'D · pas d\'impulse À CONTRESENS (B+C)': (s, d) => { const i = impOf(d); return (s.side === 'SELL' && isUp(i)) || (s.side === 'BUY' && isDown(i)); },
  'E · pas d\'impulse DANS LE SENS': (s, d) => { const i = impOf(d); return (s.side === 'BUY' && isUp(i)) || (s.side === 'SELL' && isDown(i)); },
  'F · jette les 2 cohortes tueuses': (s, d) => { const i = impOf(d), f = d.rawSelection?.transition?.from, t = d.rawSelection?.transition?.to;
    return (f === 'Rally' && t === 'Strong Bull' && i === 'FAST_UP') || (f === 'Exhaustion' && t === 'Soft Bull' && i === 'FAST_DOWN'); },
  'G · jette TOUTE la moitié SELL': (s) => s.side === 'SELL',
};

function run(rule) {
  let totR = 0, n = 0, wins = 0; const half = { a: 0, b: 0 };
  const gate = rule ? ((rows, i, sel, det) => sel.profile === 'Transitioning' && rule(sel, det)) : undefined;
  for (const f of files) {
    const r = runMatrixBacktest(path.join(MATRIX, f), gate ? { exhGate: gate } : {});
    totR += r.summary.totalR || 0; wins += r.summary.wins || 0;
    n += (r.summary.wins || 0) + (r.summary.losses || 0);
    for (const s of (r.signals || [])) { if (typeof s.R !== 'number') continue; if (String(s.tsMT).slice(0, 10) < CUT) half.a += s.R; else half.b += s.R; }
  }
  return { totR, n, wr: 100 * wins / n, half };
}

const base = run(null);
console.log(`\n===== IMPULSE dans la table de transition — ${files.length} actifs =====`);
console.log(`  ${'règle'.padEnd(38)} ${'trades'.padStart(7)} ${'totalR'.padStart(8)} ${'WR'.padStart(6)} ${'avgR'.padStart(6)} ${'ΔR'.padStart(8)} ${'moitié1 / moitié2'}`);
for (const [name, rule] of Object.entries(RULES)) {
  const r = rule === null ? base : run(rule);
  const d = r.totR - base.totR;
  console.log(`  ${name.padEnd(38)} ${String(r.n).padStart(7)} ${r.totR.toFixed(1).padStart(8)} ${r.wr.toFixed(1).padStart(5)}% ${(r.totR / r.n).toFixed(3).padStart(6)} ${((d >= 0 ? '+' : '') + d.toFixed(1)).padStart(8)}   ${(r.half.a - base.half.a >= 0 ? '+' : '') + (r.half.a - base.half.a).toFixed(1)} / ${(r.half.b - base.half.b >= 0 ? '+' : '') + (r.half.b - base.half.b).toFixed(1)}`);
}
