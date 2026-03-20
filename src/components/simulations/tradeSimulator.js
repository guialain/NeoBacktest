// ============================================================================
// tradeSimulator.js — NEO MATRIX Backtest Engine
// - Multi-trades
// - Spread à l'entrée
// - TickSize/TickValue figés à l'ouverture
// - Leverage cap GLOBAL
// - Trade spacing min
// ✅ v2 — TP/SL basés sur ATR H1 (tpAtr / slAtr)
//         Fallback sur tpPct/slPct % prix si atr_h1 absent
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig";

export function simulateTrades(marketData, signals, config) {

  const EMPTY = { trades: [], initialEquity: 0, finalEquity: 0, equityCurve: [] };
  if (!Array.isArray(marketData) || !Array.isArray(signals)) return EMPTY;

  const lastEntryTimeBySymbol = {};

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

  function computeSpreadPrice(barSpreadPoints, tickSize, assetCfg) {
    if (isPos(SPREAD_PRICE_FROM_CONFIG)) return SPREAD_PRICE_FROM_CONFIG;
    // Priorité 1 : spread_price fixe (override RiskConfig, en unités prix)
    const spreadPriceOverride = Number(assetCfg?.spread_price);
    if (isPos(spreadPriceOverride)) return spreadPriceOverride;
    // Priorité 2 : spread_points du CSV × tick_size
    const csvSpread = Number(barSpreadPoints) * Number(tickSize);
    if (isPos(csvSpread)) return csvSpread;
    // Fallback : spread fixe RiskConfig (ancien champ)
    const assetSpread = Number(assetCfg?.spread);
    if (isPos(assetSpread)) return assetSpread;
    return 0;
  }

// Nominal EUR par lot — tick_value est déjà converti en EUR dans le CSV
function nominalEURperLot(entry, tickSize, tickValue) {
  if (!isPos(entry) || !isPos(tickSize) || !isPos(tickValue)) return 0;
  return (entry / tickSize) * tickValue;
}

function portfolioNominalEUR(openTradesArr) {
  if (!openTradesArr?.length) return 0;

  return openTradesArr.reduce((sum, t) => {
    const n = nominalEURperLot(t.entry, t.tickSize, t.tickValue) * t.size;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

  // ============================================================================
  // ✅ COMPUTE SL/TP DISTANCE — ATR-based avec fallback % prix
  //
  // Priorité :
  //   1. atr_h1 présent dans le signal → slAtr × atr_h1 / tpAtr × atr_h1
  //   2. Fallback legacy → entry × slPct/100 / entry × tpPct/100
  //      (conservé pour les actifs sans atr_h1 dans le feed)
  // ============================================================================
  function computeSlTpDistances(entry, signal, assetCfg) {

    const atr = Number(signal?.atr_h1);

    // ── MODE ATR ─────────────────────────────────────────────────────────────
    if (Number.isFinite(atr) && atr > 0) {

      const slAtr = Number(assetCfg.slAtr ?? 1.25);
      const tpAtr = Number(assetCfg.tpAtr ?? 0.45);

      return { slDistance: atr * slAtr, tpDistance: atr * tpAtr, mode: "ATR" };
    }

    // ── FALLBACK % PRIX ──────────────────────────────────────────────────────
    const tpPct = Number(assetCfg.tpPct ?? 0.25) / 100;
    const slPct = Number(assetCfg.slPct ?? 0.75) / 100;

    return {
      slDistance: entry * slPct,
      tpDistance: entry * tpPct,
      mode: "PCT_FALLBACK",
    };
  }

  // ======================================================
  // MAIN LOOP
  // ======================================================

  const rejected = {
    noSignal:      0,
    maxOpenTrades: 0,
    minSpacing:    0,
    cooldown:      0,
    maxLeverage:   0,
    entered:       0,
  };

  for (let i = 1; i < marketData.length; i++) {
    const bar     = marketData[i];
    const prevBar = marketData[i - 1];
    const signal  = signalMap.get(i);

    if (!bar || !prevBar) continue;

    // ================= EXIT =================

    openTrades = openTrades.filter(trade => {

      // SELL sort à l'ASK = BID + spread
      const exitSpread = trade.side === "SELL" ? trade.spreadPrice : 0;

      const hitSL =
        trade.side === "BUY"
          ? Number(bar.low)  <= trade.sl
          : (Number(bar.high) + exitSpread) >= trade.sl;

      const hitTP =
        trade.side === "BUY"
          ? Number(bar.high) >= trade.tp
          : (Number(bar.low) + exitSpread)  <= trade.tp;

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

        if (pnl < 0) {
          const openBar  = marketData.find(b => b.timestamp === trade.openTime) ?? {};
          const atr      = Number(openBar.atr_h1);
          const close    = Number(openBar.close);
          const volRatio = (Number.isFinite(atr) && Number.isFinite(close))
            ? atr / close
            : null;

          console.warn("❌ LOSS ANALYSIS", {
            symbol:    trade.symbol,
            side:      trade.side,
            type:      trade.type,
            openTime:  trade.openTime,
            closeTime: bar.timestamp,
            score:     trade.score,
            pnl,
            sl:        trade.sl,
            entry:     trade.entry,
            slMode:    trade.slMode,       // ✅ "ATR" ou "PCT_FALLBACK"
            atr_h1:    trade.atr_h1,       // ✅ ATR au moment de l'entrée
            slDistance: trade.slDistance,  // ✅ distance réelle utilisée
            tpDistance: trade.tpDistance,
            rsi_h1:    openBar.rsi_h1,
            slope_h1:  openBar.slope_h1,
            dslope_h1: openBar.dslope_h1,
            zscore_h1: openBar.zscore_h1,
            dz_h1:     openBar.dz_h1,
            volRatio,
            rsi_m5:    openBar.rsi_m5,
            slope_m5:  openBar.slope_m5,
            dslope_m5: openBar.dslope_m5,
            drsi_m5:   openBar.drsi_m5,
            zscore_m5: openBar.zscore_m5,
          });
        }

        equity += pnl;
        equityCurve.push({ equity });

        trades.push({
          ticket:    trade.ticket,
          timestamp: trade.openTime,
          closeTime: bar.timestamp,
          symbol:    bar.symbol,
          side:      trade.side,
          type:      trade.type ?? "reversal",
          signalType: trade.signalType ?? null,
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
          // ✅ Infos TP/SL ATR pour analyse
          slMode:     trade.slMode,
          atr_h1:     trade.atr_h1,
          slDistance: trade.slDistance,
          tpDistance: trade.tpDistance,
        });

        return false;
      }

      return true;
    });

    // ================= ENTRY =================

    if (!signal) { rejected.noSignal++; continue; }
    if (openTrades.length >= MAX_OPEN_TRADES) { rejected.maxOpenTrades++; continue; }

    if (MIN_SPACING_MIN > 0 && lastEntryTimeBySymbol[bar.symbol]) {
      const currentTime = parseTimestamp(bar.timestamp);
      const lastTime    = parseTimestamp(lastEntryTimeBySymbol[bar.symbol]);
      if (Number.isFinite(currentTime) && Number.isFinite(lastTime)) {
        if ((currentTime - lastTime) / 60000 < MIN_SPACING_MIN) {
          rejected.minSpacing++;
          continue;
        }
      }
    }

    // 🔒 Blocage pyramiding en perte (même direction) — seuil 50% du SL
    const hasLosingSameSide = openTrades.some(trade => {
      if (trade.side !== signal.side) return false;
      const px =
        trade.side === "BUY"
          ? Number(bar.low)
          : Number(bar.high);
      if (!Number.isFinite(px)) return false;
      const unreal =
        trade.side === "BUY"
          ? (px - trade.entry)
          : (trade.entry - px);
      const slDist = Math.abs(trade.sl - trade.entry);
      return unreal < -(slDist * 0.5);
    });

    if (hasLosingSameSide) { rejected.cooldown++; continue; }

    if (!isPos(Number(bar.open))) continue;

const tickSize     = Number(bar.tick_size);
const tickValue    = Number(bar.tick_value);
const contractSize = Number(bar.contract_size);

if (!isPos(tickSize) || !isPos(tickValue) || !isPos(contractSize)) continue;

    const assetCfg    = getRiskConfig(bar.symbol);
    const spreadPrice = computeSpreadPrice(bar.spread_points, tickSize, assetCfg);

    const entry = signal.side === "BUY"
      ? Number(bar.open) + spreadPrice   // BUY  : on paye l'ASK
      : Number(bar.open);                // SELL : on vend au BID (= open MT5)

    if (!isPos(entry)) continue;

    // ✅ Calcul SL/TP — ATR-based ou fallback %
    const { slDistance, tpDistance, mode } = computeSlTpDistances(entry, signal, assetCfg);

    if (!isPos(slDistance) || !isPos(tpDistance)) continue;

    const sl = signal.side === "BUY" ? entry - slDistance : entry + slDistance;
    const tp = signal.side === "BUY" ? entry + tpDistance : entry - tpDistance;

    // Volume basé sur levier cible par trade (compound scaling)
    const targetLev  = isPos(Number(assetCfg.targetLeveragePerTrade)) ? Number(assetCfg.targetLeveragePerTrade) : 1;
    const eurPerLot = nominalEURperLot(entry, tickSize, tickValue);
    if (!isPos(eurPerLot)) continue;
    const requestedSize = Math.max(0.001, Math.round((equity * targetLev) / eurPerLot * 1000) / 1000);

    const currentNominal   = portfolioNominalEUR(openTrades);
    const requestedNominal = eurPerLot * requestedSize;
    const totalNominal     = currentNominal + requestedNominal;
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
      signalType: signal.signalType ?? null,
      entry,
      sl,
      tp,
      size:      requestedSize,
      contractSize,
      tickSize,
      tickValue,
      score:     signal.score ?? null,
      usedLeverageAtOpen: portfolioUsedLeverage,
      signalIndex: signal.index,
      // ✅ Traçabilité TP/SL ATR
      slMode:     mode,
      atr_h1:     Number(signal?.atr_h1) || null,
      slDistance,
      tpDistance,
      spreadPrice,
    });

    lastEntryTimeBySymbol[bar.symbol] = bar.timestamp;
  }

  // ================= FORCE CLOSE =================

  const lastBar = marketData[marketData.length - 1];

  if (lastBar) {
    for (const trade of openTrades) {
      const rawClose = isPos(Number(lastBar.close)) ? Number(lastBar.close) : trade.entry;
      // SELL ferme à l'ASK
      const closePx = trade.side === "SELL" ? rawClose + (trade.spreadPrice || 0) : rawClose;

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
          slMode:    trade.slMode,
          atr_h1:    trade.atr_h1,
          slDistance: trade.slDistance,
          tpDistance: trade.tpDistance,
          rsi_h1:    openBar.rsi_h1,
          slope_h1:  openBar.slope_h1,
          dslope_h1: openBar.dslope_h1,
          zscore_h1: openBar.zscore_h1,
          dz_h1:     openBar.dz_h1,
          volRatio,
          rsi_m5:    openBar.rsi_m5,
          slope_m5:  openBar.slope_m5,
          dslope_m5: openBar.dslope_m5,
          drsi_m5:   openBar.drsi_m5,
          zscore_m5: openBar.zscore_m5,
        });
      }

      trades.push({
        ticket:    trade.ticket,
        timestamp: trade.openTime,
        closeTime: lastBar.timestamp,
        symbol:    lastBar.symbol,
        side:      trade.side,
        type:      trade.type ?? "reversal",
        signalType: trade.signalType ?? null,
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
        slMode:     trade.slMode,
        atr_h1:     trade.atr_h1,
        slDistance: trade.slDistance,
        tpDistance: trade.tpDistance,
      });
    }
  }

  // ── RAPPORT DE REJETS ────────────────────────────────────────────────
  const totalSignals = rejected.entered + rejected.maxOpenTrades +
                       rejected.minSpacing + rejected.cooldown + rejected.maxLeverage;
  console.info("📊 ENTRY FILTER REPORT", {
    totalSignals,
    entered:             rejected.entered,
    blocked_maxOpen:     rejected.maxOpenTrades,
    blocked_minSpacing:  rejected.minSpacing,
    blocked_cooldown:    rejected.cooldown,
    blocked_maxLeverage: rejected.maxLeverage,
    pctEntered: totalSignals > 0
      ? `${((rejected.entered / totalSignals) * 100).toFixed(1)}%`
      : "—",
  });

  return { trades, initialEquity, finalEquity: equity, equityCurve };
}