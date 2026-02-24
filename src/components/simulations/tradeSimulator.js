// ============================================================================
// tradeSimulator.js — NEO MATRIX Backtest Engine
// - Multi-trades
// - Spread à l'entrée
// - TickSize/TickValue figés à l'ouverture
// - Leverage cap GLOBAL
// - Trade spacing min
// ============================================================================

import { getAssetConfig } from "../config/AssetConfig";

export function simulateTrades(marketData, signals, config) {

  const EMPTY = { trades: [], initialEquity: 0, finalEquity: 0, equityCurve: [] };
  if (!Array.isArray(marketData) || !Array.isArray(signals)) return EMPTY;

  let lastEntryTime = null;

  const MIN_SPACING_MIN = Number.isFinite(Number(config?.minTradeSpacingMinutes))
    ? Number(config.minTradeSpacingMinutes)
    : 0;

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

  function tradeNominal(entryPrice, contractSize, lots) {
    if (!isPos(entryPrice) || !isPos(contractSize) || !isPos(lots)) return 0;
    return entryPrice * contractSize * lots;
  }

  function portfolioNominal(openTradesArr, contractSize) {
    if (!isPos(contractSize) || !openTradesArr?.length) return 0;
    return openTradesArr.reduce(
      (sum, t) => sum + tradeNominal(t.entry, contractSize, t.size), 0
    );
  }

  // ======================================================
  // MAIN LOOP
  // ======================================================

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

    if (!signal || openTrades.length >= MAX_OPEN_TRADES) continue;

    if (MIN_SPACING_MIN > 0 && lastEntryTime) {
      const currentTime = parseTimestamp(bar.timestamp);
      const lastTime    = parseTimestamp(lastEntryTime);
      if (Number.isFinite(currentTime) && Number.isFinite(lastTime)) {
        if ((currentTime - lastTime) / 60000 < MIN_SPACING_MIN) continue;
      }
    }

    if (!isPos(Number(bar.open))) continue;

    const tickSize     = Number(prevBar.tick_size);
    const tickValue    = Number(prevBar.tick_value);
    const contractSize = Number(prevBar.contract_size);
    if (!isPos(tickSize) || !isPos(tickValue) || !isPos(contractSize)) continue;

    const requestedSize = isPos(Number(config?.volume)) ? Number(config.volume) : 1;
    const spreadPrice   = computeSpreadPrice(bar, prevBar);

    const entry =
      signal.side === "BUY"
        ? Number(bar.open) + spreadPrice
        : Number(bar.open) - spreadPrice;

    if (!isPos(entry)) continue;

    const assetCfg   = getAssetConfig(bar.symbol) ?? {};
    const tpPct      = Number(assetCfg.tpPct ?? 0.25) / 100;
    const slPct      = Number(assetCfg.slPct ?? 0.75) / 100;
    const tpDistance = entry * tpPct;
    const slDistance = entry * slPct;

    if (!isPos(tpDistance) || !isPos(slDistance)) continue;

    const sl = signal.side === "BUY" ? entry - slDistance : entry + slDistance;
    const tp = signal.side === "BUY" ? entry + tpDistance : entry - tpDistance;

    const currentNominal   = portfolioNominal(openTrades, contractSize);
    const requestedNominal = tradeNominal(entry, contractSize, requestedSize);
    const totalNominal     = currentNominal + requestedNominal;
    const portfolioUsedLeverage = equity > 0 ? totalNominal / equity : Infinity;

    if (USED_LEVERAGE_MAX && portfolioUsedLeverage > USED_LEVERAGE_MAX) continue;

openTrades.push({
  ticket:    ticketCounter++,
  openTime:  bar.timestamp,
  symbol:    bar.symbol,   // ✅ ajout
  side:      signal.side,
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

      trades.push({
        ticket:    trade.ticket,
        timestamp: trade.openTime,
        closeTime: lastBar.timestamp,
        symbol:    lastBar.symbol,
        side:      trade.side,
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

  return { trades, initialEquity, finalEquity: equity, equityCurve };
}