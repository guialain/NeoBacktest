// largest_candle_distribution.mjs — LARGEST CANDLE CONCEPT (owner 2026-07-16), étude de DISTRIBUTION.
// ============================================================================================
// Question : le mouvement récent est-il CONCENTRÉ sur une seule bougie (spike) ou RÉPARTI ?
//   Body = |close - open| (CORPS SEUL — pas de mèche, décision owner).
//   largestBody = max des Body des N dernières M5 · totalBody = somme · largestRatio = largest/total.
//
// AUCUN SEUIL, AUCUNE CLASSIFICATION : on logue pour étudier la distribution d'abord (méthode owner —
//   définition → calibrage stat → optimisation).
//
// Source = data/ohlc/ohlc_<ASSET>_M1.csv (M1 continu, 19 actifs) → M5 RECONSTRUIT. Pourquoi pas
//   data/matrix : il n'expose que 2 corps M5 SIGNÉS (s0/s1 via open/close) — `corps_abs_m5_s1/s2` sont
//   ABSOLUS, donc inutilisables pour une règle DIRECTIONNELLE. Le M1 donne N libre + le signe.
//   ⚠ Bougies M5 CLÔTURÉES uniquement. En live la barre s0 est EN FORMATION (son corps grandit) → la
//   distribution live sera décalée tant que s0 est jeune. Question SÉPARÉE, à traiter après.
//
// Sorties par barre (dump CSV) : largestBody, totalBody, largestRatio (les 3 demandées)
//   + largestDir  : signe de la plus grosse bougie (+1 UP / −1 DOWN) → règle directionnelle
//                   (spike UP ⇒ pas de BUY, SELL reste ouvert)
//   + largestAge  : position de la largest dans la fenêtre (0 = s0, 1 = s1, …) → permet de REJOUER
//                   offline n'importe quel cooldown (« 30 min après le largest M5 ») sans regénérer
//   + largestTs   : horodatage de la largest = l'ancre du cooldown
//   + largestAtr  : largestBody / atr_m5 → prépare le « corps minimum adossé à l'ATR » (magnitude).
//                   Le ratio est SANS ÉCHELLE : il ne distingue pas un spike d'un micro-frémissement.
//
// Usage : npx vite-node stats/largest_candle_distribution.mjs [N_min] [N_max]
// ============================================================================================
import fs from 'fs';
import path from 'path';

const OHLC_DIR = 'C:/Users/Public/Neo-Backtest/data/ohlc';
const OUT_DIR  = 'C:/Users/Public/Neo-Backtest/stats/data';
const N_MIN = Number(process.argv[2] || 2);
const N_MAX = Number(process.argv[3] || 8);
const ATR_PERIOD = 14;
const PCTS = [1, 5, 10, 25, 50, 75, 90, 95, 99];

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

// "2026.06.19 00:00" → epoch minutes (les M1 sont déjà à la minute, pas de parsing de secondes).
function mtMin(ts) {
  const m = String(ts).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000);
}

// M1 → M5 : regroupe par tranche de 5 min. open = 1re, close = dernière, high/low = extrêmes.
//   ⚠ Une tranche INCOMPLÈTE (trou de données) reste une bougie : on n'invente rien, mais on marque
//   `bars` pour pouvoir filtrer. Les M5 non contiguës cassent la fenêtre → on tronque (cf `gap`).
function buildM5(rows) {
  const out = [];
  let cur = null;
  for (const r of rows) {
    const slot = Math.floor(r.ep / 5) * 5;
    if (!cur || cur.ep !== slot) {
      if (cur) out.push(cur);
      cur = { ep: slot, ts: r.ts, open: r.open, high: r.high, low: r.low, close: r.close, bars: 1 };
    } else {
      cur.high = Math.max(cur.high, r.high); cur.low = Math.min(cur.low, r.low);
      cur.close = r.close; cur.bars++;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function loadM1(file) {
  const txt = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < txt.length; i++) {
    const p = txt[i].split(';');
    const ep = mtMin(p[0]);
    if (ep == null) continue;
    const o = +p[1], h = +p[2], l = +p[3], c = +p[4];
    if (![o, h, l, c].every(Number.isFinite)) continue;
    rows.push({ ep, ts: p[0], open: o, high: h, low: l, close: c });
  }
  rows.sort((a, b) => a.ep - b.ep);
  return rows;
}

// ATR(14) M5 (Wilder simplifié : moyenne glissante du True Range) — sert UNIQUEMENT à normaliser
//   largestBody pour l'étude de magnitude. Pas un seuil.
function atrSeries(m5, period = ATR_PERIOD) {
  const tr = m5.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = m5[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
  const out = new Array(m5.length).fill(null);
  let sum = 0;
  for (let i = 0; i < tr.length; i++) {
    sum += tr[i];
    if (i >= period) sum -= tr[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

const files = fs.readdirSync(OHLC_DIR).filter(f => /^ohlc_.+_M1\.csv$/.test(f)).sort();
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const ratiosByN = {};            // N → [ratios] (univers, pour la distribution)
const atrByN = {};               // N → [largestBody/atr]
for (let N = N_MIN; N <= N_MAX; N++) { ratiosByN[N] = []; atrByN[N] = []; }
const dumpRows = [];             // dump détaillé (N = N_MAX seulement, sinon 7× le volume)
const DUMP_N = N_MAX;
let totalM5 = 0, skippedGap = 0, skippedFlat = 0;

for (const f of files) {
  const asset = f.match(/^ohlc_(.+)_M1\.csv$/)[1];
  const m5 = buildM5(loadM1(path.join(OHLC_DIR, f)));
  const atr = atrSeries(m5);
  totalM5 += m5.length;

  const body = m5.map(b => b.close - b.open);          // SIGNÉ (le signe porte la direction du spike)

  for (let i = 0; i < m5.length; i++) {
    for (let N = N_MIN; N <= N_MAX; N++) {
      if (i < N - 1) continue;
      // Fenêtre contiguë obligatoire : un trou (week-end, data manquante) invaliderait la comparaison.
      if (m5[i].ep - m5[i - N + 1].ep !== (N - 1) * 5) { if (N === DUMP_N) skippedGap++; continue; }

      let largest = 0, total = 0, lIdx = -1;
      for (let k = i - N + 1; k <= i; k++) {
        const abs = Math.abs(body[k]);
        total += abs;
        if (abs > largest) { largest = abs; lIdx = k; }
      }
      // TotalBody = 0 (N doji parfaits) → ratio indéfini (0/0). null, jamais un chiffre inventé.
      if (!(total > 0)) { if (N === DUMP_N) skippedFlat++; continue; }

      const ratio = largest / total;
      ratiosByN[N].push(ratio);
      const a = atr[i];
      const lAtr = (a > 0) ? largest / a : null;
      if (lAtr !== null) atrByN[N].push(lAtr);

      if (N === DUMP_N) {
        dumpRows.push([
          asset, m5[i].ts, N,
          largest.toFixed(8), total.toFixed(8), ratio.toFixed(4),
          body[lIdx] >= 0 ? 1 : -1,      // largestDir : +1 UP / -1 DOWN
          i - lIdx,                       // largestAge : 0 = s0 (bougie courante), 1 = s1, …
          m5[lIdx].ts,                    // largestTs : ANCRE du cooldown « 30 min après le largest »
          lAtr === null ? '' : lAtr.toFixed(4),
        ].join(';'));
      }
    }
  }
}

// ── Dump CSV (rejouable offline : n'importe quel cooldown, sans regénérer) ──
const dumpPath = path.join(OUT_DIR, `largest_candle_m5_N${DUMP_N}.csv`);
fs.writeFileSync(dumpPath,
  'asset;ts;N;largestBody;totalBody;largestRatio;largestDir;largestAge;largestTs;largestBodyAtr\n'
  + dumpRows.join('\n') + '\n');

// ── Distribution ──
console.log(`\n===== LARGEST CANDLE (M5, corps seul) — ${files.length} actifs · ${totalM5} bougies M5 =====`);
console.log(`  fenêtres écartées : gap=${skippedGap} (non contiguës)  flat=${skippedFlat} (totalBody=0)   [à N=${DUMP_N}]`);
console.log(`  dump : ${dumpPath}  (${dumpRows.length} lignes)\n`);

console.log(`  largestRatio = largestBody / totalBody   —   borne basse théorique = 1/N`);
console.log(`  ${'N'.padStart(2)} ${'min'.padStart(6)} ${PCTS.map(p => `P${p}`.padStart(6)).join(' ')} ${'n'.padStart(9)}`);
for (let N = N_MIN; N <= N_MAX; N++) {
  const s = ratiosByN[N].slice().sort((a, b) => a - b);
  console.log(`  ${String(N).padStart(2)} ${(1 / N).toFixed(3).padStart(6)} `
    + PCTS.map(p => percentile(s, p).toFixed(3).padStart(6)).join(' ')
    + ` ${String(s.length).padStart(9)}`);
}

console.log(`\n  largestBody / ATR(14) M5   —   la MAGNITUDE (le ratio, lui, est sans échelle)`);
console.log(`  ${'N'.padStart(2)} ${PCTS.map(p => `P${p}`.padStart(6)).join(' ')}`);
for (let N = N_MIN; N <= N_MAX; N++) {
  const s = atrByN[N].slice().sort((a, b) => a - b);
  console.log(`  ${String(N).padStart(2)} ` + PCTS.map(p => percentile(s, p).toFixed(3).padStart(6)).join(' '));
}
