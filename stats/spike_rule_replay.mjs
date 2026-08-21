// spike_rule_replay.mjs — LARGEST CANDLE : distribution conjointe + REJEU de la règle owner.
// ============================================================================================
// Règle testée (owner 2026-07-16) :
//   spike UP détecté (ratio >= R ET largestBody/ATR >= A, sur N bougies M5, corps seul)
//     → AUCUN BUY pendant COOLDOWN min APRÈS LA BOUGIE LARGEST (ancre = largestTs, pas la détection).
//   Miroir : spike DOWN → aucun SELL. Le côté opposé reste OUVERT (on garde le droit de fader).
//
// Mesuré SANS toucher au moteur : on passe par les hooks opts.contGate/opts.exhGate de matrixBacktest,
//   prévus pour les gates expérimentaux. Les spikes sont pré-calculés depuis data/ohlc (M5 reconstruit).
//
// Usage : npx vite-node stats/spike_rule_replay.mjs [N] [COOLDOWN_min]
// ============================================================================================
import fs from 'fs';
import path from 'path';
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest } from '../src/components/simulations/matrixBacktest.mjs';

const N        = Number(process.argv[2] || 6);
const COOLDOWN = Number(process.argv[3] || 30);
const MATRIX = 'C:/Users/Public/Neo-Backtest/data/matrix';
const OHLC   = 'C:/Users/Public/Neo-Backtest/data/ohlc';
const ATR_P  = 14;

const mtMin = (ts) => { const m = String(ts).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };

// M1 → M5 + ATR(14) + fenêtre glissante N → événements spike candidats (ratio/atr par bougie largest).
function spikeSeries(asset) {
  const f = path.join(OHLC, `ohlc_${asset}_M1.csv`);
  if (!fs.existsSync(f)) return null;
  const rows = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).slice(1).map(l => {
    const p = l.split(';'); const ep = mtMin(p[0]);
    return ep == null ? null : { ep, o: +p[1], h: +p[2], l: +p[3], c: +p[4] };
  }).filter(Boolean).sort((a, b) => a.ep - b.ep);

  const m5 = [];
  for (const r of rows) {
    const slot = Math.floor(r.ep / 5) * 5;
    const cur = m5[m5.length - 1];
    if (!cur || cur.ep !== slot) m5.push({ ep: slot, o: r.o, h: r.h, l: r.l, c: r.c });
    else { cur.h = Math.max(cur.h, r.h); cur.l = Math.min(cur.l, r.l); cur.c = r.c; }
  }
  const tr = m5.map((b, i) => i === 0 ? b.h - b.l : Math.max(b.h - b.l, Math.abs(b.h - m5[i - 1].c), Math.abs(b.l - m5[i - 1].c)));
  const atr = new Array(m5.length).fill(null);
  let s = 0;
  for (let i = 0; i < tr.length; i++) { s += tr[i]; if (i >= ATR_P) s -= tr[i - ATR_P]; if (i >= ATR_P - 1) atr[i] = s / ATR_P; }

  const out = [];
  for (let i = N - 1; i < m5.length; i++) {
    if (m5[i].ep - m5[i - N + 1].ep !== (N - 1) * 5) continue;   // fenêtre non contiguë → invalide
    let largest = 0, total = 0, li = -1;
    for (let k = i - N + 1; k <= i; k++) { const a = Math.abs(m5[k].c - m5[k].o); total += a; if (a > largest) { largest = a; li = k; } }
    if (!(total > 0) || !(atr[i] > 0)) continue;
    out.push({ ep: m5[i].ep, ratio: largest / total, atrX: largest / atr[i], dir: (m5[li].c - m5[li].o) >= 0 ? 1 : -1, lep: m5[li].ep });
  }
  return out;
}

const files = fs.readdirSync(MATRIX).filter(f => f.toLowerCase().endsWith('.csv')).sort();
const assets = files.map(f => f.replace(/\.csv$/i, ''));
const SERIES = {};
for (const a of assets) SERIES[a] = spikeSeries(a) ?? [];

// ── 1) DISTRIBUTION CONJOINTE ratio × body/ATR ────────────────────────────────────────────────
const all = Object.values(SERIES).flat();
console.log(`\n===== DISTRIBUTION CONJOINTE (N=${N}, ${all.length} fenêtres M5) =====`);
console.log(`  combien de fenêtres passent les DEUX seuils ? (part de l'univers)\n`);
const RS = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80], AS = [0, 1.5, 2.0, 2.5, 3.0];
console.log(`  ${'ratio >='.padEnd(9)} ` + AS.map(a => `atr>=${a.toFixed(1)}`.padStart(11)).join(''));
for (const R of RS) {
  const line = AS.map(A => {
    const n = all.filter(x => x.ratio >= R && x.atrX >= A).length;
    return `${(100 * n / all.length).toFixed(3)}%`.padStart(11);
  }).join('');
  console.log(`  ${R.toFixed(2).padEnd(9)} ${line}`);
}
// Événements DISTINCTS (dédupliqués par bougie largest) — c'est ça, le nombre de spikes réels.
const distinct = (R, A) => {
  let n = 0;
  for (const a of assets) { const seen = new Set(); for (const x of SERIES[a]) if (x.ratio >= R && x.atrX >= A) seen.add(x.lep); n += seen.size; }
  return n;
};
console.log(`\n  spikes DISTINCTS (dédupliqués par bougie largest) sur ~18 jours × 19 actifs :`);
console.log(`  ${'ratio >='.padEnd(9)} ` + AS.map(a => `atr>=${a.toFixed(1)}`.padStart(11)).join(''));
for (const R of RS) console.log(`  ${R.toFixed(2).padEnd(9)} ` + AS.map(A => String(distinct(R, A)).padStart(11)).join(''));

// ── 2) REJEU de la règle sur le backtest ──────────────────────────────────────────────────────
// Index par actif : liste des spikes {lep, dir} filtrés → gate = « un spike de MÊME sens que le trade
//   a-t-il eu lieu dans les COOLDOWN dernières minutes ? ». Ancré sur lep (idempotent : re-détecter le
//   même spike ne prolonge pas le blocage ; un spike PLUS RÉCENT, lui, ré-ancre).
//   mode 'chase'  (règle owner)      : spike UP bloque les BUY   (on ne POURSUIT pas le spike)
//   mode 'fade'   (hypothèse inverse): spike UP bloque les SELL  (on ne FADE pas le spike)
//   mode 'both'                      : spike UP bloque TOUT      (ni BUY ni SELL pendant le cooldown)
function buildGate(asset, R, A, mode = 'chase') {
  const seen = new Map();   // lep → dir
  for (const x of SERIES[asset]) if (x.ratio >= R && x.atrX >= A) seen.set(x.lep, x.dir);
  const spikes = [...seen.entries()].map(([lep, dir]) => ({ lep, dir })).sort((a, b) => a.lep - b.lep);
  return (rows, i, sel) => {
    const ep = mtMin(rows[i]?.timestamp);
    if (ep == null) return false;
    const side = sel.side === "BUY" ? 1 : -1;
    for (let k = spikes.length - 1; k >= 0; k--) {
      const d = ep - spikes[k].lep;
      if (d > COOLDOWN) break;                   // trié : au-delà du cooldown, tous les suivants aussi
      if (d < 0) continue;
      if (mode === 'both') return true;                       // n'importe quel spike bloque n'importe quel côté
      if (mode === 'chase' && spikes[k].dir === side) return true;
      if (mode === 'fade'  && spikes[k].dir === -side) return true;
    }
    return false;
  };
}

function run(tag, R, A, mode = 'chase') {
  let totR = 0, wins = 0, losses = 0;
  for (const a of assets) {
    const opts = (R === null) ? {} : { contGate: buildGate(a, R, A, mode), exhGate: buildGate(a, R, A, mode) };
    const r = runMatrixBacktest(path.join(MATRIX, `${a}.csv`), opts);
    totR += r.summary.totalR || 0; wins += r.summary.wins || 0; losses += r.summary.losses || 0;
  }
  const n = wins + losses;
  console.log(`  ${tag.padEnd(26)} trades=${String(n).padStart(6)}  totalR=${totR.toFixed(1).padStart(7)}  WR=${(100 * wins / n).toFixed(1)}%  avgR=${(totR / n).toFixed(3)}`);
  return { n, totR };
}

console.log(`\n===== REJEU : spike UP ⇒ pas de BUY pendant ${COOLDOWN} min (miroir SELL) · N=${N} =====`);
const base = run('BASELINE (sans règle)', null, null);
const rep = (r) => {
  const dn = r.n - base.n, dr = r.totR - base.totR;
  //  avgR des trades COUPÉS : > baseline ⇒ on a jeté des gagnants ; < 0 ⇒ on a coupé des perdants.
  console.log(`  ${''.padEnd(26)} Δ trades=${dn.toString().padStart(6)}  Δ R=${(dr >= 0 ? '+' : '') + dr.toFixed(1)}`
    + `   avgR des coupés=${dn === 0 ? '—' : (dr / dn).toFixed(3)}  (baseline ${(base.totR / base.n).toFixed(3)})`);
};
// ── BALAYAGE DU RATIO (mode FADE, atr>=2.0 fixé) ─────────────────────────────────────────────
//    Repères distribution N=6 : P50=0.351 · P75=0.418 · P90=0.497 · P95=0.549 · P99=0.661.
//    Sous ~0.45 on n'est plus dans la queue : « spike » perdrait son sens (moitié des barres).
console.log(`\n===== BALAYAGE RATIO — mode FADE, atr>=2.0, cooldown ${COOLDOWN} min =====`);
//    Repères distribution N=6 : min=1/N=0.167 · P25=0.301 · P50=0.351 · P75=0.418 · P90=0.497 · P95=0.549 · P99=0.661
//    ⚠ 0.167 = borne basse théorique ⇒ le ratio n'exclut RIEN = ABLATION : la règle devient « ne pas fader
//      après une bougie >= 2 ATR », sans notion de concentration. C'est le TÉMOIN : si son gain égale celui
//      des seuils plus hauts, le ratio n'apporte rien et il faut le jeter (tout viendrait de l'ATR).
for (const R of [0.167, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50])
  rep(run(`FADE ratio>=${R.toFixed(3)}${R <= 0.167 ? ' (ABLATION)' : ''}`, R, 2.0, 'fade'));
