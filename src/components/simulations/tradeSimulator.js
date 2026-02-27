// ============================================================================
// tradeSimulator.js — NEO MATRIX Backtest Engine
// - Multi-trades
// - Spread à l'entrée
// - TickSize/TickValue figés à l'ouverture
// - Leverage cap GLOBAL
// - Trade spacing min
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig";

export function simulateTrades(marketData, signals, config) {

  const EMPTY = { trades: [], initialEquity: 0, finalEquity: 0, equityCurve: [] };
  if (!Array.isArray(marketData) || !Array.isArray(signals)) return EMPTY;

  let lastEntryTime = null;

  const MIN_SPACING_MIN = Number.isFinite(Number(config?.minTradeSpacingMinutes))
    ? Number(config.minTradeSpacingMinutes)
    : 0;

  const LOSS_COOLDOWN_MIN = 15; // cooldown après une perte significative avant nouvelle entrée

  function parseTimestamp(ts) {
    if (!ts || typeof ts !== "string") return NaN;
    const [datePart, timePartRaw] = ts.trim().split(" ");
    if (!datePart || !timePartRaw) return NaN;
    const dateISO = datePart.replace(/\./g, "-");
    const timePart = timePartRaw.length === 5 ? `${timePartRaw}:00` : timePartRaw;
    const t = new Date(`${dateISO}T${timePart}`).getTime();
    return Number.isFinite(t) ? t : NaN;
  }

  const initialEquity = Number.isFinite(Number(config?.initialEquity))
    ? Number(config.initialEquity)
    : 10000;

  let equity = initialEquity;

  const equityCurve  = [{ equity: initialEquity }];
  const trades       = [];
  let openTrades     = [];
  let ticketCounter  = 1;

  const MAX_OPEN_TRADES = Number.isFinite(Number(config?.maxOpenTrades))
    ? Number(config.maxOpenTrades)
    : 3;

  const USED_LEVERAGE_MAX =
    Number.isFinite(Number(config?.usedLeverageMax)) && Number(config.usedLeverageMax) > 0
      ? Number(config.usedLeverageMax)
      : null;

  const SPREAD_PRICE_FROM_CONFIG =
    Number.isFinite(Number(config?.spread)) ? Number(config.spread) : null;

  // =============================
  // SIGNAL MAP (VALID only)
  // =============================

  const signalMap = new Map();

  for (const s of signals) {
    if (!s) continue;
    if (s.state !== "VALID") continue;
    if (!Number.isFinite(Number(s.index))) continue;
    const side = (s.side === "BUY" || s.side === "SELL") ? s.side : null;
    if (!side) continue;
    signalMap.set(Number(s.index), { ...s, side });
  }

  const isPos = v => Number.isFinite(v) && v > 0;

  function computeSpreadPrice(bar, prevBar) {
    if (isPos(SPREAD_PRICE_FROM_CONFIG)) return SPREAD_PRICE_FROM_CONFIG;
    const spreadPoints = Number(bar?.spread_points);
    const tickSize     = Number(prevBar?.tick_size);
    if (isPos(spreadPoints) && isPos(tickSize)) return spreadPoints * tickSize;
    return 0;
  }

  // Nominal EUR par lot : (price / tickSize) × tickValue
  // Fonctionne pour tous les types d'actifs :
  //   FX    → (1.08 / 0.00001) × 0.926  ≈ 100 000 EUR/lot  (EURUSD)
  //   INDEX → (19500 / 0.1) × 1.0       = 195 000 EUR/lot  (DAX)
  //   GOLD  → (2700 / 0.01) × 0.847     = 228 690 EUR/lot
  //   CRYPTO→ (85000 / 0.01) × 0.01     =  85 000 EUR/lot  (BTCEUR, tickValue=contractSize*tickSize)
  // tickValue est exporté par MT5 en devise du compte (EUR).
  function nominalEURperLot(price, tickSize, tickValue) {
    if (!isPos(price) || !isPos(tickSize) || !isPos(tickValue)) return 0;
    return (price / tickSize) * tickValue;
  }

  function portfolioNominalEUR(openTradesArr) {
    if (!openTradesArr?.length) return 0;
    return openTradesArr.reduce((sum, t) => {
      const n = nominalEURperLot(t.entry, t.tickSize, t.tickValue) * t.size;
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  // ======================================================
  // MAIN LOOP
  // ======================================================

  // ── COMPTEURS DE REJETS ──────────────────────────────────────────────
  const rejected = {
    noSignal:     0,
    maxOpenTrades: 0,
    minSpacing:   0,
    cooldown:     0,
    maxLeverage:  0,
    entered:      0,
  };

  for (let i = 1; i < marketData.length; i++) {
    const bar     = marketData[i];
    const prevBar = marketData[i - 1];
    const signal  = signalMap.get(i);




    if (!bar || !prevBar) continue;

    // ================= EXIT =================

    openTrades = openTrades.filter(trade => {

      const hitSL =
        trade.side === "BUY"
          ? Number(bar.low)  <= trade.sl
          : Number(bar.high) >= trade.sl;

      const hitTP =
        trade.side === "BUY"
          ? Number(bar.high) >= trade.tp
          : Number(bar.low)  <= trade.tp;

      let exitPrice = null;
      let reason    = null;

      if (hitSL && hitTP) {
        const bullishBar = Number(bar.close) >= Number(bar.open);
        if      (trade.side === "BUY"  && bullishBar)  { exitPrice = trade.tp; reason = "TP"; }
        else if (trade.side === "SELL" && !bullishBar) { exitPrice = trade.tp; reason = "TP"; }
        else                                            { exitPrice = trade.sl; reason = "SL"; }
      } else if (hitSL) {
        exitPrice = trade.sl; reason = "SL";
      } else if (hitTP) {
        exitPrice = trade.tp; reason = "TP";
      }

      if (exitPrice !== null) {
        const rawMove =
          trade.side === "BUY"
            ? exitPrice - trade.entry
            : trade.entry - exitPrice;

        const pnl = (rawMove / trade.tickSize) * trade.tickValue * trade.size;
        
        //============log pour debug=========
if (pnl < 0) {

  const openBar = marketData.find(b => b.timestamp === trade.openTime) ?? {};

  const atr     = Number(openBar.atr_h1);
  const close   = Number(openBar.close);
  const volRatio = (Number.isFinite(atr) && Number.isFinite(close))
    ? atr / close
    : null;

  console.warn("❌ LOSS ANALYSIS", {

    // === IDENTITÉ ===
    symbol: trade.symbol,
    side: trade.side,
    type: trade.type,
    openTime: trade.openTime,
    closeTime: bar.timestamp,
    score: trade.score,

    // === PNL ===
    pnl,
    sl: trade.sl,
    entry: trade.entry,

    // === H1 STRUCTURE ===
    rsi_h1: openBar.rsi_h1,
    slope_h1: openBar.slope_h1,
    dslope_h1: openBar.dslope_h1,
    zscore_h1: openBar.zscore_h1,
    dz_h1: openBar.dz_h1,

    // === VOLATILITY ===
    atr_h1: atr,
    volRatio,

    // === M5 MICRO ===
    rsi_m5: openBar.rsi_m5,
    slope_m5: openBar.slope_m5,
    dslope_m5: openBar.dslope_m5,
    drsi_m5: openBar.drsi_m5,

  });
}

        ///==================================
        

        equity += pnl;

        equityCurve.push({ equity });

        trades.push({
          ticket:    trade.ticket,
          timestamp: trade.openTime,
          closeTime: bar.timestamp,
          symbol:    bar.symbol,
          side:      trade.side,
          type:      trade.type ?? "reversal",
          size:      trade.size,
          open:      trade.entry,
          close:     exitPrice,
          tp:        trade.tp,
          sl:        trade.sl,
          pnl,
          equityAfter:        equity,
          reason,
          score:              trade.score ?? null,
          usedLeverageAtOpen: trade.usedLeverageAtOpen ?? null,
        });

        return false;
      }

      return true;
    });

    // ================= ENTRY =================

    if (!signal) { rejected.noSignal++; continue; }
    if (openTrades.length >= MAX_OPEN_TRADES) { rejected.maxOpenTrades++; continue; }

    if (MIN_SPACING_MIN > 0 && lastEntryTime) {
      const currentTime = parseTimestamp(bar.timestamp);
      const lastTime    = parseTimestamp(lastEntryTime);
      if (Number.isFinite(currentTime) && Number.isFinite(lastTime)) {
        if ((currentTime - lastTime) / 60000 < MIN_SPACING_MIN) {
          rejected.minSpacing++;
          continue;
        }
      }
    }

    // Cooldown : si un trade ouvert depuis < LOSS_COOLDOWN_MIN est en perte significative → skip
    const hasOpenLoss = openTrades.some(trade => {
      const openMs    = parseTimestamp(trade.openTime);
      const currentMs = parseTimestamp(bar.timestamp);
      if (!Number.isFinite(openMs) || !Number.isFinite(currentMs)) return false;
      if ((currentMs - openMs) / 60000 > LOSS_COOLDOWN_MIN) return false;

      const currentPrice = Number(bar.open);
      const unrealized   = trade.side === "BUY"
        ? currentPrice - trade.entry
        : trade.entry - currentPrice;

      const threshold = trade.entry * 0.0005;
      return unrealized < -threshold;
    });
    if (hasOpenLoss) { rejected.cooldown++; continue; }

    if (!isPos(Number(bar.open))) continue;

    const tickSize  = Number(prevBar.tick_size);
    const tickValue = Number(prevBar.tick_value);
    if (!isPos(tickSize) || !isPos(tickValue)) continue;

    const spreadPrice   = computeSpreadPrice(bar, prevBar);

    const entry =
      signal.side === "BUY"
        ? Number(bar.open) + spreadPrice
        : Number(bar.open) - spreadPrice;

    if (!isPos(entry)) continue;

    const assetCfg   = getRiskConfig(bar.symbol);
    const tpPct      = Number(assetCfg.tpPct ?? 0.25) / 100;
    const slPct      = Number(assetCfg.slPct ?? 0.75) / 100;
    const tpDistance = entry * tpPct;
    const slDistance = entry * slPct;

    if (!isPos(tpDistance) || !isPos(slDistance)) continue;

    // Volume basé sur levier cible par trade (compound scaling)
    // Formule tick-based : valide pour FX, indices, métaux, crypto
    const targetLev    = isPos(Number(assetCfg.targetLeveragePerTrade)) ? Number(assetCfg.targetLeveragePerTrade) : 1;
    const eurPerLot    = nominalEURperLot(entry, tickSize, tickValue);
    if (!isPos(eurPerLot)) continue;
    const requestedSize = Math.max(0.001, Math.round((equity * targetLev) / eurPerLot * 1000) / 1000);

    const sl = signal.side === "BUY" ? entry - slDistance : entry + slDistance;
    const tp = signal.side === "BUY" ? entry + tpDistance : entry - tpDistance;

    const currentNominal    = portfolioNominalEUR(openTrades);
    const requestedNominal  = eurPerLot * requestedSize;
    const totalNominal      = currentNominal + requestedNominal;
    const portfolioUsedLeverage = equity > 0 ? totalNominal / equity : Infinity;

    if (USED_LEVERAGE_MAX && portfolioUsedLeverage > USED_LEVERAGE_MAX) {
      rejected.maxLeverage++;
      continue;
    }

    rejected.entered++;

openTrades.push({
  ticket:    ticketCounter++,
  openTime:  bar.timestamp,
  symbol:    bar.symbol,
  side:      signal.side,
  type:      signal.type ?? "reversal",
  entry,
  sl,
  tp,
  size:      requestedSize,
  tickSize,
  tickValue,
  score:     signal.score ?? null,
  usedLeverageAtOpen: portfolioUsedLeverage,
  signalIndex: signal.index
});

    lastEntryTime = bar.timestamp;
  }

  // ================= FORCE CLOSE =================

  const lastBar = marketData[marketData.length - 1];

  if (lastBar) {
    for (const trade of openTrades) {
      const closePx = isPos(Number(lastBar.close)) ? Number(lastBar.close) : trade.entry;

      const rawMove =
        trade.side === "BUY"
          ? closePx - trade.entry
          : trade.entry - closePx;

      const pnl = (rawMove / trade.tickSize) * trade.tickValue * trade.size;
      equity += pnl;
      equityCurve.push({ equity });

      if (pnl < 0) {
        const openBar  = marketData.find(b => b.timestamp === trade.openTime) ?? {};
        const atr      = Number(openBar.atr_h1);
        const close    = Number(openBar.close);
        const volRatio = (Number.isFinite(atr) && Number.isFinite(close)) ? atr / close : null;

        console.warn("❌ LOSS ANALYSIS (FORCED_CLOSE)", {
          symbol:    trade.symbol,
          side:      trade.side,
          type:      trade.type,
          openTime:  trade.openTime,
          closeTime: lastBar.timestamp,
          score:     trade.score,
          pnl,
          entry:     trade.entry,
          closePx,
          sl:        trade.sl,
          // H1
          rsi_h1:    openBar.rsi_h1,
          slope_h1:  openBar.slope_h1,
          dslope_h1: openBar.dslope_h1,
          zscore_h1: openBar.zscore_h1,
          dz_h1:     openBar.dz_h1,
          atr_h1:    atr,
          volRatio,
          // M5
          rsi_m5:    openBar.rsi_m5,
          slope_m5:  openBar.slope_m5,
          dslope_m5: openBar.dslope_m5,
          drsi_m5:   openBar.drsi_m5,
        });
      }

      trades.push({
        ticket:    trade.ticket,
        timestamp: trade.openTime,
        closeTime: lastBar.timestamp,
        symbol:    lastBar.symbol,
        side:      trade.side,
        type:      trade.type ?? "reversal",
        size:      trade.size,
        open:      trade.entry,
        close:     closePx,
        tp:        trade.tp,
        sl:        trade.sl,
        pnl,
        equityAfter:        equity,
        reason:             "FORCED_CLOSE",
        score:              trade.score ?? null,
        usedLeverageAtOpen: trade.usedLeverageAtOpen ?? null,
      });
    }
  }

  // ── RAPPORT DE REJETS ────────────────────────────────────────────────
  const totalSignals = rejected.entered + rejected.maxOpenTrades +
                       rejected.minSpacing + rejected.cooldown + rejected.maxLeverage;
  console.info("📊 ENTRY FILTER REPORT", {
    totalSignals,
    entered:        rejected.entered,
    blocked_maxOpen:    rejected.maxOpenTrades,
    blocked_minSpacing: rejected.minSpacing,
    blocked_cooldown:   rejected.cooldown,
    blocked_maxLeverage: rejected.maxLeverage,
    pctEntered: totalSignals > 0
      ? `${((rejected.entered / totalSignals) * 100).toFixed(1)}%`
      : "—",
  });

  return { trades, initialEquity, finalEquity: equity, equityCurve };
}