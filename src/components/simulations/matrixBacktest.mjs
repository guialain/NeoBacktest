// ============================================================================================
// matrixBacktest.mjs — Backtest MOTEUR MATRIX par actif (SSOT : import cross-repo, pas de copie).
// --------------------------------------------------------------------------------------------
// Charge un CSV actif (format Matrix, snapshots bakés) → run detectOpportunity row-par-row →
//   signaux post-trio → walk TP/SL close-to-close sur `price` (ATR-based) avec cap concurrence.
// Sortie = LOG DE SIGNAUX (timestamp MT pour croiser MT5) + résumé. R-multiples (pas de currency PnL
//   pour l'instant : les specs contrat viendront pour brancher le simulateur complet).
// Import cross-repo = SSOT (le moteur = celui de la prod, jamais une copie).
// ============================================================================================
import fs from "fs";
import { detectOpportunity } from "../../../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import GlobalMarketHours from "../../../../Matrix-Revolution/src/components/robot/engines/trading/GlobalMarketHours.js";
import { getTickFlowConfig, computeMeanTick5s } from "../../../../Matrix-Revolution/src/config/TickFlowConfig.js";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const STRAT = { CONT: "CONTINUATION", EXH: "EXHAUSTION", RANGE: "RANGE" };

// Copie du switch AssetEligibility.resolveMarket (celui-ci importe "./GlobalMarketHours" SANS extension →
// KO sous Node ESM ; le mapping est stable/documenté). assetclass → clé GlobalMarketHours.
function resolveMarket(assetclass) {
  switch (String(assetclass ?? "").toUpperCase()) {
    case "FX":      return "FX";
    case "INDEX":   return "INDEX";
    case "CRYPTO":  return "CRYPTO";
    case "METAL":   return "METAL";
    case "ENERGY":  return "ENERGY";
    case "OIL_GAS": return "ENERGY";
    case "GAS":     return "ENERGY";
    case "AGRI":    return "AGRI";
    case "SOFT":    return "AGRI";
    default:        return null;
  }
}

// ── ADMISSION (SSOT AssetEligibility) — 2 gates que le live applique EN AMONT du moteur, absents
//    du backtest jusqu'ici → fires en marché mort / hors séance que la prod aurait rejetés.
//    Gate 1 heures : GlobalMarketHours.check(market, now, symbol).allowed (now = ts_utc de la barre).
//    Gate 3 tick_low : mean(tick_5s_s0..s4) < tf_5s.p20 (⟺ Energy DEAD ; null = passthrough safe).
//    On NE réplique PAS Weekend/whitelist/burst : ces barres sont déjà dans l'archive (donc en séance
//    ouvrable) et le burst est un cas haut, hors du gap « marché mort » qu'on corrige ici.
function admissionBlock(row, asset) {
  // Gate 1 — heures de marché (UTC, comme GlobalMarketHours.getHour)
  const market = resolveMarket(row?.assetclass);
  const now = new Date(row?.ts_utc ?? row?.timestamp);
  if (!Number.isNaN(now.getTime())) {
    const h = GlobalMarketHours.check(market, now, asset);
    if (h && h.allowed === false) return "hours";
  }
  // Gate 3 — tick low (marché mort)
  const mean5s = computeMeanTick5s(row);
  if (mean5s !== null) {
    const p20 = getTickFlowConfig(asset, row?.assetclass)?.tf_5s?.p20;
    if (typeof p20 === "number" && mean5s < p20) return "tick_low";
  }
  return null;   // admissible
}

// Parse CSV ';' → tableau de rows (objets clé→string).
export function loadCsvRows(csvPath) {
  const lines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(";");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const v = lines[i].split(";"); const o = {};
    for (let j = 0; j < header.length; j++) o[header[j]] = v[j];
    rows.push(o);
  }
  return rows;
}

/**
 * runMatrixBacktest(csvPath, opts) — Mode A (par actif).
 * opts : { tpAtr=0.65, slAtr=1.95, maxOpen=30, cadenceMin=2, maxHoldMin=0(=EOD) }
 * @returns {{ asset, params, summary, signals:[...] }}
 */
export function runMatrixBacktest(csvPath, opts = {}) {
  const tpAtr = num(opts.tpAtr) ?? 0.65;
  const slAtr = num(opts.slAtr) ?? 1.95;
  const maxOpen = num(opts.maxOpen) ?? 30;
  const cadenceMin = num(opts.cadenceMin) ?? 2;
  const maxHoldMin = num(opts.maxHoldMin) ?? 0;   // 0 = jusqu'à la fin du jour
  const initialEquity = num(opts.initialEquity) ?? 10000;
  const riskPct = num(opts.riskPct) ?? 1.0;       // % de l'equity risqué par trade (SL = 1R). PnL = R × risque.
  const admission = opts.admission !== false;      // true (défaut) = applique les gates heures + tick_low

  const rows = loadCsvRows(csvPath);
  if (!rows.length) return { asset: null, params: opts, summary: { rows: 0 }, signals: [] };
  const asset = String(rows[0].symbol || "").toUpperCase();

  // série prix (walk TP/SL) : ep en minutes, price, day, atr_h1, ts MT
  const series = rows.map((r) => {
    const ep = Date.parse(r.ts_utc ?? r.timestamp);
    return { ep: Number.isFinite(ep) ? Math.round(ep / 60000) : null, price: num(r.price), atr: num(r.atr_h1), day: String(r.ts_utc ?? r.timestamp).slice(0, 10), tsMT: r.timestamp, i: 0 };
  });
  series.forEach((s, i) => (s.i = i));

  // ── PASSE 1 : détecter les fires (au cadenceMin) ──
  const cands = [];   // { i, ep, tsMT, side, strategy, entry, atr }
  let lastEp = -1e9, fires = 0, evals = 0, admHours = 0, admTick = 0;
  for (let i = 0; i < rows.length; i++) {
    const s = series[i];
    if (s.ep == null || s.ep < lastEp + cadenceMin) continue;
    lastEp = s.ep; evals++;
    // ADMISSION en amont (comme le live) : barre inadmissible → pas d'évaluation moteur.
    if (admission) {
      const blk = admissionBlock(rows[i], asset);
      if (blk === "hours") { admHours++; continue; }
      if (blk === "tick_low") { admTick++; continue; }
    }
    let det; try { det = detectOpportunity(rows[i], asset); } catch { continue; }
    const sel = det.selection;
    if (sel?.side !== "BUY" && sel?.side !== "SELL") continue;
    fires++;
    cands.push({ i, ep: s.ep, tsMT: s.tsMT, side: sel.side, strategy: sel.strategy, type: STRAT[sel.strategy] ?? sel.strategy, entry: s.price, atr: s.atr, score: sel.score, profile: sel.profile ?? det.marketProfile?.profile ?? null });
  }

  // ── PASSE 2 : cap concurrence + walk TP/SL close-to-close ──
  const walk = (c) => {
    if (c.entry == null || !(c.atr > 0)) return null;
    const sgn = c.side === "BUY" ? 1 : -1;
    const tpDist = tpAtr * c.atr, slDist = slAtr * c.atr;
    const tp = c.entry + sgn * tpDist, sl = c.entry - sgn * slDist;
    const day = series[c.i].day;
    for (let j = c.i + 1; j < series.length; j++) {
      const s = series[j]; if (s.day !== day) break;
      if (maxHoldMin > 0 && s.ep - c.ep > maxHoldMin) return finalize(c, s, "TIMEOUT_HOLD", sgn, slDist);
      if (s.price == null) continue;
      if (sgn > 0 ? s.price >= tp : s.price <= tp) return finalize(c, s, "WIN", sgn, slDist, tp);
      if (sgn > 0 ? s.price <= sl : s.price >= sl) return finalize(c, s, "LOSS", sgn, slDist, sl);
    }
    // fin de jour sans TP/SL : clôture au dernier prix du jour
    let last = c.i; for (let j = c.i + 1; j < series.length && series[j].day === day; j++) last = j;
    return finalize(c, series[last], "TIMEOUT_EOD", sgn, slDist);
  };
  const finalize = (c, s, outcome, sgn, slDist, px) => {
    const exit = px ?? s.price;
    const R = slDist > 0 ? ((exit - c.entry) * sgn) / slDist : 0;
    return { ...c, exitTs: s.tsMT, exit: +exit.toFixed(6), outcome, R: +R.toFixed(3), barsHeld: s.i - c.i,
             tp: +(c.entry + sgn * (slDist * tpAtr / slAtr)).toFixed(6), sl: +(c.entry - sgn * slDist).toFixed(6) };
  };

  cands.sort((a, b) => a.ep - b.ep);
  const book = [];   // exitEp des positions ouvertes
  let openedCount = 0, rejectedCap = 0;
  const signals = [];
  for (const c of cands) {
    for (let k = book.length - 1; k >= 0; k--) if (book[k] <= c.ep) book.splice(k, 1);
    if (book.length >= maxOpen) { rejectedCap++; continue; }
    const res = walk(c); if (!res) continue;
    const exitEp = series.find((s) => s.tsMT === res.exitTs)?.ep ?? c.ep;
    res.openEp = c.ep; res.closeEp = exitEp;
    book.push(exitEp); openedCount++;
    signals.push(res);
  }

  // ── EQUITY (risk-based, compound) : à l'OPEN on fige risque = riskPct% × equity réalisée ;
  //    au CLOSE : equity += R × risque. PnL en devise sans tickValue. Curve + max drawdown. ──
  const events = [];
  for (const s of signals) { events.push({ t: s.openEp, k: 0, s }); events.push({ t: s.closeEp, k: 1, s }); }
  events.sort((a, b) => a.t - b.t || a.k - b.k);   // opens (k=0) avant closes (k=1) à t égal
  let equity = initialEquity, peak = equity, maxDD = 0, netPnL = 0, gWin = 0, gLoss = 0;
  const equityCurve = [{ ts: signals[0]?.tsMT ?? null, equity: +equity.toFixed(2) }];
  for (const ev of events) {
    if (ev.k === 0) { ev.s.riskAmount = (riskPct / 100) * equity; }
    else {
      const pnl = ev.s.R * (ev.s.riskAmount ?? 0);
      ev.s.pnl = +pnl.toFixed(2);
      equity += pnl; netPnL += pnl;
      if (pnl > 0) gWin += pnl; else gLoss += -pnl;
      if (equity > peak) peak = equity;
      const dd = peak - equity; if (dd > maxDD) maxDD = dd;
      equityCurve.push({ ts: ev.s.exitTs, equity: +equity.toFixed(2), pnl: ev.s.pnl });
    }
  }

  // ── résumé ──
  const wins = signals.filter((s) => s.outcome === "WIN").length;
  const losses = signals.filter((s) => s.outcome === "LOSS").length;
  const timeouts = signals.length - wins - losses;
  const sumR = signals.reduce((a, s) => a + s.R, 0);
  const byType = {}, bySide = { BUY: 0, SELL: 0 };
  for (const s of signals) { byType[s.type] = (byType[s.type] || 0) + 1; bySide[s.side]++; }

  return {
    asset,
    params: { tpAtr, slAtr, maxOpen, cadenceMin, maxHoldMin, initialEquity, riskPct, admission },
    summary: {
      rows: rows.length, evals, fires, opened: openedCount, rejectedCap,
      admHours, admTick, admBlocked: admHours + admTick,
      wins, losses, timeouts,
      winRate: wins + losses ? +(100 * wins / (wins + losses)).toFixed(1) : null,
      avgR: signals.length ? +(sumR / signals.length).toFixed(3) : null,
      totalR: +sumR.toFixed(2),
      // devise (risk-based)
      initialEquity, finalEquity: +equity.toFixed(2), netPnL: +netPnL.toFixed(2),
      returnPct: +(100 * netPnL / initialEquity).toFixed(2),
      maxDrawdown: +maxDD.toFixed(2), maxDrawdownPct: peak > 0 ? +(100 * maxDD / peak).toFixed(2) : 0,
      profitFactor: gLoss > 0 ? +(gWin / gLoss).toFixed(2) : null,
      byType, bySide,
    },
    equityCurve,
    signals,
  };
}

// CLI : node src/components/simulations/matrixBacktest.mjs data/matrix/ETHUSD.csv
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("matrixBacktest.mjs")) {
  const csvPath = process.argv[2] || "data/matrix/ETHUSD.csv";
  const r = runMatrixBacktest(csvPath, {});
  console.log(`\n=== ${r.asset} — Matrix backtest (${JSON.stringify(r.params)}) ===`);
  console.log(JSON.stringify(r.summary, null, 2));
  console.log(`\n-- 10 premiers signaux --`);
  for (const s of r.signals.slice(0, 10)) console.log(`${s.tsMT}  ${s.side.padEnd(4)} ${s.type.padEnd(12)} entry ${s.entry}  ${s.outcome.padEnd(11)} R=${s.R}  (${s.barsHeld}min)`);
}
