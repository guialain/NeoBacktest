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
import { createPhotoTracker } from "../../../../Matrix-Revolution/src/components/robot/engines/opportunities/TransitionProfile.js";
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
export function admissionBlock(row, asset) {
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

// ── OHLC M1 CONTINU (owner 2026-07-13) : l'archive snapshot a des TROUS (soirs/nuits — buffer live) qui
//    faisaient rater TP/SL au walk (ex. USDJPY 07-08 19:45 : TP touché à 20:36 mais snapshot coupé à 19:57).
//    On charge l'historique M1 GAPLESS exporté de MT5 (script mql5/ExportOHLC_M1) → walk TP/SL sur high/low
//    intra-barre, temps MT server. Fallback = ancien walk snapshot si pas d'OHLC pour l'actif.
const mtMin = (s) => { const m = String(s).match(/(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})/); return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000) : null; };
function loadOHLC(ohlcPath) {
  let txt; try { txt = fs.readFileSync(ohlcPath, "utf8"); } catch { return null; }
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(";"); const ep = mtMin(p[0]);
    if (ep == null) continue;
    out.push({ ep, ts: p[0], date: String(p[0]).slice(0, 10), high: +p[2], low: +p[3], close: +p[4] });
  }
  out.sort((a, b) => a.ep - b.ep);
  return out.length ? out : null;
}

/**
 * runMatrixBacktest(csvPath, opts) — Mode A (par actif).
 * opts : { tpAtr=0.65, slAtr=1.95, maxOpen=30, cadenceMin=2, maxHoldMin=0(=EOD) }
 * @returns {{ asset, params, summary, signals:[...] }}
 */
// ── TRANSITION (owner 2026-07-15) — PORTÉE DANS LE MOTEUR le 2026-07-16 ──────────────────────────────
//   La table + la règle vivaient ICI (harness) → n'affectaient PAS le live. Elles sont désormais dans
//   Matrix-Revolution/.../TransitionProfile.js, appliquées par routeSignal en fallback WAIT. Le harness ne
//   garde que ce qui lui revient : l'ÉTAT (le buffer de photos horaires), tenu par le caller — comme
//   MatrixEngine le fait pour le live. Le backtest et la prod exercent ainsi le MÊME code de décision.

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

  // OHLC M1 continu (gapless) pour l'actif — data/ohlc/ohlc_<ASSET>_M1.csv (dérivé du chemin matrix).
  const ohlc = loadOHLC(csvPath.replace(/matrix[\/\\][^\/\\]+\.csv$/i, `ohlc/ohlc_${asset}_M1.csv`));

  // série prix (walk TP/SL) : ep en minutes, price, day, atr_h1, ts MT
  const series = rows.map((r) => {
    const ep = Date.parse(r.ts_utc ?? r.timestamp);
    return { ep: Number.isFinite(ep) ? Math.round(ep / 60000) : null, price: num(r.price), atr: num(r.atr_h1), day: String(r.ts_utc ?? r.timestamp).slice(0, 10), tsMT: r.timestamp, i: 0 };
  });
  series.forEach((s, i) => (s.i = i));

  // ── PASSE 1 : détecter les fires (au cadenceMin) ──
  const cands = [];   // { i, ep, tsMT, side, strategy, entry, atr }
  let lastEp = -1e9, fires = 0, evals = 0, admHours = 0, admTick = 0;
  const transOn = opts.trans !== false;   // TRANSITION activable (défaut ON) — trans:false → photos non passées
  const tracker = createPhotoTracker();   // ÉTAT photo horaire (côté caller) ; le moteur reste pur
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
    // Photo horaire : roll AVANT la décision (clôt l'heure écoulée), record APRÈS — cf TransitionProfile.js.
    tracker.roll(s.tsMT);
    let det; try { det = detectOpportunity(rows[i], asset, transOn ? { photos: tracker.photos() } : {}); } catch { continue; }
    tracker.record(det);
    const sel = det.selection;
    const hasSide = sel?.side === "BUY" || sel?.side === "SELL";
    if (!hasSide) continue;   // la TRANSITION est désormais un fallback DANS routeSignal (plus de branche ici)
    if (opts.contGate && sel.strategy === "CONT" && opts.contGate(rows, i, sel)) continue;   // gate expérimental (ex: cont-into-rising-maturity) appliqué AU STADE FIRE → le cap réutilise le slot libéré
    if (opts.exhGate && sel.strategy === "EXH" && opts.exhGate(rows, i, sel, det)) continue;   // gate EXH expérimental (ex: exh-vs-daily-angle)
    fires++;
    // type : TRANS reste distingué pour les rapports (le moteur, lui, le route en famille EXH — mêmes TP/SL).
    cands.push({ i, ep: s.ep, tsMT: s.tsMT, side: sel.side, strategy: sel.strategy,
      type: sel.profile === "Transitioning" ? "TRANS" : (STRAT[sel.strategy] ?? sel.strategy),
      entry: s.price, atr: s.atr, score: sel.score, profile: sel.profile ?? det.marketProfile?.profile ?? null });
  }

  // ── PASSE 2 : cap concurrence + walk TP/SL close-to-close ──
  const walk = (c) => {                                        // fallback (pas d'OHLC) — snapshot troué, SANS timeout EOD
    if (c.entry == null || !(c.atr > 0)) return null;
    const sgn = c.side === "BUY" ? 1 : -1;
    const tpDist = tpAtr * c.atr, slDist = slAtr * c.atr;
    const tp = c.entry + sgn * tpDist, sl = c.entry - sgn * slDist;
    for (let j = c.i + 1; j < series.length; j++) {
      const s = series[j];
      if (maxHoldMin > 0 && s.ep - c.ep > maxHoldMin) return finalize(c, s, "TIMEOUT", sgn, slDist);
      if (s.price == null) continue;
      if (sgn > 0 ? s.price >= tp : s.price <= tp) return finalize(c, s, "TP", sgn, slDist, tp);
      if (sgn > 0 ? s.price <= sl : s.price >= sl) return finalize(c, s, "SL", sgn, slDist, sl);
    }
    // pas de TP/SL sur toutes les données → OPEN_END (fin des données)
    let last = c.i; for (let j = c.i + 1; j < series.length; j++) if (series[j].price != null) last = j;
    return finalize(c, series[last], "OPEN_END", sgn, slDist);
  };
  // reason = DÉCLENCHEUR de sortie (TP/SL/TIMEOUT) ; outcome = RÉSULTAT P&L (WIN/LOSS). TP→WIN, SL→LOSS,
  //   TIMEOUT→WIN si R>0 sinon LOSS (une clôture EOD peut finir gagnante ou perdante). Séparés : « pourquoi
  //   c'est sorti » ≠ « ça a rapporté ou coûté » (owner 2026-07-12).
  const finalize = (c, s, reason, sgn, slDist, px) => {
    const exit = px ?? s.price;
    const R = slDist > 0 ? ((exit - c.entry) * sgn) / slDist : 0;
    const outcome = reason === "TP" ? "WIN" : reason === "SL" ? "LOSS" : (R > 0 ? "WIN" : "LOSS");
    return { ...c, exitTs: s.tsMT, exit: +exit.toFixed(6), reason, outcome, R: +R.toFixed(3), barsHeld: s.i - c.i,
             tp: +(c.entry + sgn * (slDist * tpAtr / slAtr)).toFixed(6), sl: +(c.entry - sgn * slDist).toFixed(6) };
  };

  // ── WALK OHLC M1 (gapless, high/low intra-barre) — utilisé si `ohlc` dispo, sinon walk() snapshot ──
  const finalizeOHLC = (c, b, reason, sgn, slDist, px, fireMin) => {
    const exit = px ?? b.close;
    const R = slDist > 0 ? ((exit - c.entry) * sgn) / slDist : 0;
    const outcome = reason === "TP" ? "WIN" : reason === "SL" ? "LOSS" : (R > 0 ? "WIN" : "LOSS");
    const hold = b.ep - fireMin;
    return { ...c, exitTs: b.ts, exit: +exit.toFixed(6), reason, outcome, R: +R.toFixed(3), barsHeld: hold, closeEp: c.ep + hold,
             tp: +(c.entry + sgn * (slDist * tpAtr / slAtr)).toFixed(6), sl: +(c.entry - sgn * slDist).toFixed(6) };
  };
  const walkOHLC = (c) => {
    if (c.entry == null || !(c.atr > 0)) return null;
    const sgn = c.side === "BUY" ? 1 : -1;
    const tpDist = tpAtr * c.atr, slDist = slAtr * c.atr;
    const tp = c.entry + sgn * tpDist, sl = c.entry - sgn * slDist;
    const fireMin = mtMin(c.tsMT), fireDate = String(c.tsMT).slice(0, 10);
    if (fireMin == null) return null;
    let lo = 0, hi = ohlc.length;                                   // 1re barre M1 STRICTEMENT après l'entrée
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ohlc[mid].ep <= fireMin) lo = mid + 1; else hi = mid; }
    // PAS DE TIMEOUT EOD (owner 2026-07-13) : le trade tient jusqu'à TP ou SL, À TRAVERS LES JOURS (OHLC
    //   continu, week-end inclus). maxHoldMin (0=off par défaut) reste dispo pour un futur maxHoldGreen.
    //   Seule sortie non-TP/SL = OPEN_END (fin des données OHLC dispo) — artefact de bord de fenêtre, à surveiller.
    let last = null;
    for (let j = lo; j < ohlc.length; j++) {
      const b = ohlc[j];
      if (maxHoldMin > 0 && b.ep - fireMin > maxHoldMin) return finalizeOHLC(c, b, "TIMEOUT", sgn, slDist, null, fireMin);
      if (sgn > 0) { if (b.high >= tp) return finalizeOHLC(c, b, "TP", sgn, slDist, tp, fireMin); if (b.low <= sl) return finalizeOHLC(c, b, "SL", sgn, slDist, sl, fireMin); }
      else         { if (b.low <= tp) return finalizeOHLC(c, b, "TP", sgn, slDist, tp, fireMin);  if (b.high >= sl) return finalizeOHLC(c, b, "SL", sgn, slDist, sl, fireMin); }
      last = b;
    }
    return last ? finalizeOHLC(c, last, "OPEN_END", sgn, slDist, null, fireMin) : null;
  };

  cands.sort((a, b) => a.ep - b.ep);
  const book = [];   // exitEp des positions ouvertes
  let openedCount = 0, rejectedCap = 0;
  const signals = [];
  for (const c of cands) {
    for (let k = book.length - 1; k >= 0; k--) if (book[k] <= c.ep) book.splice(k, 1);
    if (book.length >= maxOpen) { rejectedCap++; continue; }
    const res = ohlc ? walkOHLC(c) : walk(c); if (!res) continue;
    const exitEp = res.closeEp ?? (series.find((s) => s.tsMT === res.exitTs)?.ep ?? c.ep);
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
  const losses = signals.filter((s) => s.outcome === "LOSS").length;   // wins+losses = TOUS les trades (outcome binaire)
  const byReason = { TP: 0, SL: 0, TIMEOUT: 0 };                       // déclencheur de sortie (indépendant du P&L)
  for (const s of signals) byReason[s.reason] = (byReason[s.reason] || 0) + 1;
  const sumR = signals.reduce((a, s) => a + s.R, 0);
  const byType = {}, bySide = { BUY: 0, SELL: 0 };
  for (const s of signals) { byType[s.type] = (byType[s.type] || 0) + 1; bySide[s.side]++; }

  return {
    asset,
    params: { tpAtr, slAtr, maxOpen, cadenceMin, maxHoldMin, initialEquity, riskPct, admission },
    summary: {
      rows: rows.length, evals, fires, opened: openedCount, rejectedCap,
      admHours, admTick, admBlocked: admHours + admTick,
      wins, losses, byReason,
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
  for (const s of r.signals.slice(0, 10)) console.log(`${s.tsMT}  ${s.side.padEnd(4)} ${s.type.padEnd(12)} entry ${s.entry}  ${s.outcome.padEnd(4)} ${s.reason.padEnd(7)} R=${s.R}  (${s.barsHeld}min)`);
}
