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

import { getRiskConfig, RISK_CONFIG } from "../config/RiskConfig";

function volMetrics(bar) {
  const v1 = Number(bar.range_m5_s1);
  const v2 = Number(bar.range_m5_s2);
  const atr = Number(bar.atr_m15);
  if (!Number.isFinite(v1) || !Number.isFinite(atr) || atr === 0) return { vol1: null, vol2: null, volChange: null };
  const ratio1 = v1 / atr;
  const ratio2 = Number.isFinite(v2) && atr !== 0 ? v2 / atr : null;
  const change = ratio2 ? (ratio1 - ratio2) / ratio2 : null;
  return { vol1: +ratio1.toFixed(3), vol2: ratio2 !== null ? +ratio2.toFixed(3) : null, volChange: change !== null ? +(change * 100).toFixed(1) : null };
}

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
    const t = new Date(`${dateISO}T${timePart}Z`).getTime();
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

  function computeSpreadPrice(bar, tickSize, assetCfg) {
    if (isPos(SPREAD_PRICE_FROM_CONFIG)) return SPREAD_PRICE_FROM_CONFIG;
    // Priorité 1 : spread_price du CSV (dynamique par barre)
    const csvSpreadPrice = Number(bar?.spread_price);
    if (isPos(csvSpreadPrice)) return csvSpreadPrice;
    // Priorité 2 : spread_price fixe RiskConfig
    const spreadPriceOverride = Number(assetCfg?.spread_price);
    if (isPos(spreadPriceOverride)) return spreadPriceOverride;
    // Priorité 3 : spread_points du CSV × tick_size (legacy)
    const csvSpread = Number(bar?.spread_points) * Number(tickSize);
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

      const atrH1Cap = Number(assetCfg.atrH1Cap);
      const atrUsed = (Number.isFinite(atrH1Cap) && atrH1Cap > 0) ? Math.min(atr, atrH1Cap) : atr;

      return { slDistance: atrUsed * slAtr, tpDistance: atrUsed * tpAtr, mode: "ATR" };
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

    // ── Close-to-close M5 model ──
    // Pas de high/low — tout est basé sur bar.close
    const barClose = Number(bar.close);

    // ================= FRIDAY CLOSE (>= 20:00) =================

    const barTs = parseTimestamp(bar.timestamp);
    const barDate = Number.isFinite(barTs) ? new Date(barTs) : null;
    const isFridayClose = barDate && barDate.getUTCDay() === 5 && (barDate.getUTCHours() + barDate.getUTCMinutes() / 60) >= 21;

    if (isFridayClose && openTrades.length > 0) {
      for (const trade of openTrades) {
        const rawClose = Number(bar.close);
        const exitSpreadFC = trade.side === "SELL" ? (trade.spreadPrice || 0) : 0;
        const closePx = rawClose + exitSpreadFC;

        const rawMove = trade.side === "BUY"
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

          const rsi = Number(openBar.rsi_h1);
          const zone = !Number.isFinite(rsi) ? "?" :
            rsi < 20 ? "EXTREME_LOW" :
            rsi < 30 ? "DEEP_LOW" :
            rsi < 35 ? "SEMI_LOW" :
            rsi > 80 ? "EXTREME_HIGH" :
            rsi > 70 ? "DEEP_HIGH" :
            rsi > 65 ? "SEMI_HIGH" :
            rsi <= 45 ? "CONT_LOW" :
            rsi >= 55 ? "CONT_HIGH" : "NEUTRAL";

          console.warn(`❌ LOSS FRIDAY_CLOSE | ${trade.symbol} ${trade.side} ${trade.route ?? trade.type} | ${zone} | rsi_h1=${rsi?.toFixed(1)} rsi_s0=${Number(openBar.rsi_h1_s0)?.toFixed(1)} slope_s0=${Number(openBar.slope_h1_s0)?.toFixed(2)} z_s0=${Number(openBar.zscore_h1_s0)?.toFixed(2)} intra=${Number(openBar.intraday_change)?.toFixed(2)}`, {
            openTime:  trade.openTime,
            closeTime: bar.timestamp,
            route:     trade.route,
            score:     trade.score,
            pnl,
            entry:     trade.entry,
            closePx,
            sl:        trade.sl,
            slMode:    trade.slMode,
            atr_h1:    trade.atr_h1,
            slDistance: trade.slDistance,
            tpDistance: trade.tpDistance,
            volRatio,
            // H1 s1
            rsi_h1:    openBar.rsi_h1,
            slope_h1:  openBar.slope_h1,
            dslope_h1: openBar.dslope_h1,
            drsi_h1:   openBar.drsi_h1,
            zscore_h1: openBar.zscore_h1,
            // H1 s0
            rsi_h1_s0:    openBar.rsi_h1_s0,
            slope_h1_s0:  openBar.slope_h1_s0,
            drsi_h1_s0:   openBar.drsi_h1_s0,
            zscore_h1_s0: openBar.zscore_h1_s0,
            // H4 s1/s0
            slope_h4:     openBar.slope_h4,
            drsi_h4:      openBar.drsi_h4,
            slope_h4_s0:  openBar.slope_h4_s0,
            drsi_h4_s0:   openBar.drsi_h4_s0,
            // M5 s1/s0
            rsi_m5:       openBar.rsi_m5,
            slope_m5:     openBar.slope_m5,
            dslope_m5:    openBar.dslope_m5,
            drsi_m5:      openBar.drsi_m5,
            zscore_m5:    openBar.zscore_m5,
            slope_m5_s0:  openBar.slope_m5_s0,
            drsi_m5_s0:   openBar.drsi_m5_s0,
            zscore_m5_s0: openBar.zscore_m5_s0,
            // V8R context
            signalType:    trade.signalType,
            mode:          trade.mode,
            intradayLevel: trade.intradayLevel,
            slopeH4Level:  trade.slopeH4Level,
            signalPhase:   trade.signalPhase,
            intraday_change: openBar.intraday_change,
          });
        }

        trades.push({
          ticket:    trade.ticket,
          timestamp: trade.openTime,
          closeTime: bar.timestamp,
          symbol:    bar.symbol,
          side:      trade.side,
          type:      trade.type ?? "reversal",
          route:     trade.route ?? null,
          signalType: trade.signalType ?? null,
          size:      trade.size,
          open:      trade.entry,
          close:     closePx,
          tp:        trade.tp,
          sl:        trade.sl,
          pnl,
          equityAfter:        equity,
          reason:             "FRIDAY_CLOSE",
          score:              trade.score ?? null,
          usedLeverageAtOpen: trade.usedLeverageAtOpen ?? null,
          slMode:     trade.slMode,
          atr_h1:     trade.atr_h1,
          slDistance: trade.slDistance,
          tpDistance: trade.tpDistance,
        });
      }
      openTrades = [];
    }

    // ================= EXIT =================

    openTrades = openTrades.filter(trade => {

      // ── MAX HOLD CHECK ──────────────────────────────────────────────────
      const maxHoldMin = (trade.maxHoldH || RISK_CONFIG.default.defaultMaxHoldH || 8) * 60;
      const barTime  = parseTimestamp(bar.timestamp);
      const openTime = parseTimestamp(trade.openTime);

      if (Number.isFinite(barTime) && Number.isFinite(openTime) &&
          (barTime - openTime) / 60000 >= maxHoldMin) {

        const rawClose = Number(bar.close);
        const exitSpreadMH = trade.side === "SELL" ? (trade.spreadPrice || 0) : 0;
        const closePx = rawClose + exitSpreadMH;

        const rawMove = trade.side === "BUY"
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

          const rsi = Number(openBar.rsi_h1);
          const zone = !Number.isFinite(rsi) ? "?" :
            rsi < 20 ? "EXTREME_LOW" :
            rsi < 30 ? "DEEP_LOW" :
            rsi < 35 ? "SEMI_LOW" :
            rsi > 80 ? "EXTREME_HIGH" :
            rsi > 70 ? "DEEP_HIGH" :
            rsi > 65 ? "SEMI_HIGH" :
            rsi <= 45 ? "CONT_LOW" :
            rsi >= 55 ? "CONT_HIGH" : "NEUTRAL";

          console.warn(`❌ LOSS MAX_HOLD | ${trade.symbol} ${trade.side} ${trade.route ?? trade.type} | ${zone} | rsi_h1=${rsi?.toFixed(1)} rsi_s0=${Number(openBar.rsi_h1_s0)?.toFixed(1)} slope_s0=${Number(openBar.slope_h1_s0)?.toFixed(2)} z_s0=${Number(openBar.zscore_h1_s0)?.toFixed(2)} intra=${Number(openBar.intraday_change)?.toFixed(2)}`, {
            openTime:  trade.openTime,
            closeTime: bar.timestamp,
            route:     trade.route,
            score:     trade.score,
            pnl,
            entry:     trade.entry,
            closePx,
            sl:        trade.sl,
            slMode:    trade.slMode,
            atr_h1:    trade.atr_h1,
            slDistance: trade.slDistance,
            tpDistance: trade.tpDistance,
            volRatio,
            // H1 s1
            rsi_h1:    openBar.rsi_h1,
            slope_h1:  openBar.slope_h1,
            dslope_h1: openBar.dslope_h1,
            drsi_h1:   openBar.drsi_h1,
            zscore_h1: openBar.zscore_h1,
            // H1 s0
            rsi_h1_s0:    openBar.rsi_h1_s0,
            slope_h1_s0:  openBar.slope_h1_s0,
            drsi_h1_s0:   openBar.drsi_h1_s0,
            zscore_h1_s0: openBar.zscore_h1_s0,
            // H4 s1/s0
            slope_h4:     openBar.slope_h4,
            drsi_h4:      openBar.drsi_h4,
            slope_h4_s0:  openBar.slope_h4_s0,
            drsi_h4_s0:   openBar.drsi_h4_s0,
            // M5 s1/s0
            rsi_m5:       openBar.rsi_m5,
            slope_m5:     openBar.slope_m5,
            dslope_m5:    openBar.dslope_m5,
            drsi_m5:      openBar.drsi_m5,
            zscore_m5:    openBar.zscore_m5,
            slope_m5_s0:  openBar.slope_m5_s0,
            drsi_m5_s0:   openBar.drsi_m5_s0,
            zscore_m5_s0: openBar.zscore_m5_s0,
            // V8R context
            signalType:    trade.signalType,
            mode:          trade.mode,
            intradayLevel: trade.intradayLevel,
            slopeH4Level:  trade.slopeH4Level,
            signalPhase:   trade.signalPhase,
            intraday_change: openBar.intraday_change,
          });
        }

        trades.push({
          ticket:    trade.ticket,
          timestamp: trade.openTime,
          closeTime: bar.timestamp,
          symbol:    bar.symbol,
          side:      trade.side,
          type:      trade.type ?? "reversal",
          route:     trade.route ?? null,
          signalType: trade.signalType ?? null,
          size:      trade.size,
          open:      trade.entry,
          close:     closePx,
          tp:        trade.tp,
          sl:        trade.sl,
          pnl,
          equityAfter:        equity,
          reason:             "MAX_HOLD",
          score:              trade.score ?? null,
          usedLeverageAtOpen: trade.usedLeverageAtOpen ?? null,
          slMode:     trade.slMode,
          atr_h1:     trade.atr_h1,
          slDistance: trade.slDistance,
          tpDistance: trade.tpDistance,
        });

        return false; // remove from openTrades
      }

      // ── TP/SL CHECK — close-to-close M5 ─────────────────────────────────
      // On vérifie si le close a franchi TP ou SL (pas d'intra-bar)
      const exitSpread = trade.side === "SELL" ? trade.spreadPrice : 0;
      const exitClose  = barClose + exitSpread; // SELL sort à l'ASK

      const hitSL =
        trade.side === "BUY"
          ? barClose   <= trade.sl
          : exitClose  >= trade.sl;

      const hitTP =
        trade.side === "BUY"
          ? barClose   >= trade.tp
          : exitClose  <= trade.tp;

      let exitPrice = null;
      let reason    = null;

      // Close a franchi les deux → SL prioritaire (worst case)
      if (hitSL && hitTP) {
        exitPrice = trade.sl; reason = "SL";
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

          const rsi = Number(openBar.rsi_h1);
          const zone = !Number.isFinite(rsi) ? "?" :
            rsi < 20 ? "EXTREME_LOW" :
            rsi < 30 ? "DEEP_LOW" :
            rsi < 35 ? "SEMI_LOW" :
            rsi > 80 ? "EXTREME_HIGH" :
            rsi > 70 ? "DEEP_HIGH" :
            rsi > 65 ? "SEMI_HIGH" :
            rsi <= 45 ? "CONT_LOW" :
            rsi >= 55 ? "CONT_HIGH" : "NEUTRAL";

          console.warn(`❌ LOSS | ${trade.symbol} ${trade.side} ${trade.route ?? trade.type} | ${zone} | rsi_h1=${rsi?.toFixed(1)} rsi_s0=${Number(openBar.rsi_h1_s0)?.toFixed(1)} slope_s0=${Number(openBar.slope_h1_s0)?.toFixed(2)} z_s0=${Number(openBar.zscore_h1_s0)?.toFixed(2)} intra=${Number(openBar.intraday_change)?.toFixed(2)}`, {
            openTime:  trade.openTime,
            closeTime: bar.timestamp,
            route:     trade.route,
            score:     trade.score,
            pnl,
            entry:     trade.entry,
            sl:        trade.sl,
            slMode:    trade.slMode,
            atr_h1:    trade.atr_h1,
            slDistance: trade.slDistance,
            tpDistance: trade.tpDistance,
            volRatio,
            // H1 s1
            rsi_h1:    openBar.rsi_h1,
            slope_h1:  openBar.slope_h1,
            dslope_h1: openBar.dslope_h1,
            drsi_h1:   openBar.drsi_h1,
            zscore_h1: openBar.zscore_h1,
            // H1 s0
            rsi_h1_s0:    openBar.rsi_h1_s0,
            slope_h1_s0:  openBar.slope_h1_s0,
            drsi_h1_s0:   openBar.drsi_h1_s0,
            zscore_h1_s0: openBar.zscore_h1_s0,
            // H4 s1/s0
            slope_h4:     openBar.slope_h4,
            drsi_h4:      openBar.drsi_h4,
            slope_h4_s0:  openBar.slope_h4_s0,
            drsi_h4_s0:   openBar.drsi_h4_s0,
            // M5 s1/s0
            rsi_m5:       openBar.rsi_m5,
            slope_m5:     openBar.slope_m5,
            dslope_m5:    openBar.dslope_m5,
            drsi_m5:      openBar.drsi_m5,
            zscore_m5:    openBar.zscore_m5,
            slope_m5_s0:  openBar.slope_m5_s0,
            drsi_m5_s0:   openBar.drsi_m5_s0,
            zscore_m5_s0: openBar.zscore_m5_s0,
            // V8R context
            signalType:    trade.signalType,
            mode:          trade.mode,
            intradayLevel: trade.intradayLevel,
            slopeH4Level:  trade.slopeH4Level,
            signalPhase:   trade.signalPhase,
            intraday_change: openBar.intraday_change,
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
          route:     trade.route ?? null,
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
    if (isFridayClose) { rejected.noSignal++; continue; }  // no new entries Friday >= 20h
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


    if (!isPos(barClose)) continue;

const tickSize     = Number(bar.tick_size);
const tickValue    = Number(bar.tick_value);
const contractSize = Number(bar.contract_size);

if (!isPos(tickSize) || !isPos(tickValue) || !isPos(contractSize)) continue;

    const assetCfg    = getRiskConfig(bar.symbol);
    const spreadPrice = computeSpreadPrice(bar, tickSize, assetCfg);

    // Close-to-close: entrée au close de la barre (+ spread pour BUY)
    const entry = signal.side === "BUY"
      ? barClose + spreadPrice   // BUY  : on paye l'ASK
      : barClose;                // SELL : on vend au BID

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
      type:         signal.type ?? "reversal",
      route:        signal.route ?? null,
      signalType:   signal.signalType ?? null,
      mode:         signal.mode ?? null,
      intradayLevel: signal.intradayLevel ?? null,
      slopeH4Level: signal.slopeH4Level ?? null,
      signalPhase:  signal.signalPhase ?? null,
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
      maxHoldH:   assetCfg.maxHoldH || RISK_CONFIG.default.defaultMaxHoldH || 8,
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

        const rsi = Number(openBar.rsi_h1);
        const zone = !Number.isFinite(rsi) ? "?" :
          rsi < 20 ? "EXTREME_LOW" :
          rsi < 30 ? "DEEP_LOW" :
          rsi < 35 ? "SEMI_LOW" :
          rsi > 80 ? "EXTREME_HIGH" :
          rsi > 70 ? "DEEP_HIGH" :
          rsi > 65 ? "SEMI_HIGH" :
          rsi <= 45 ? "CONT_LOW" :
          rsi >= 55 ? "CONT_HIGH" : "NEUTRAL";

        console.warn(`❌ LOSS FORCED | ${trade.symbol} ${trade.side} ${trade.route ?? trade.type} | ${zone} | rsi_h1=${rsi?.toFixed(1)} rsi_s0=${Number(openBar.rsi_h1_s0)?.toFixed(1)} slope_s0=${Number(openBar.slope_h1_s0)?.toFixed(2)} z_s0=${Number(openBar.zscore_h1_s0)?.toFixed(2)} intra=${Number(openBar.intraday_change)?.toFixed(2)}`, {
          openTime:  trade.openTime,
          closeTime: lastBar.timestamp,
          route:     trade.route,
          score:     trade.score,
          pnl,
          entry:     trade.entry,
          closePx,
          sl:        trade.sl,
          slMode:    trade.slMode,
          atr_h1:    trade.atr_h1,
          slDistance: trade.slDistance,
          tpDistance: trade.tpDistance,
          volRatio,
          // H1 s1
          rsi_h1:    openBar.rsi_h1,
          slope_h1:  openBar.slope_h1,
          dslope_h1: openBar.dslope_h1,
          drsi_h1:   openBar.drsi_h1,
          zscore_h1: openBar.zscore_h1,
          // H1 s0
          rsi_h1_s0:    openBar.rsi_h1_s0,
          slope_h1_s0:  openBar.slope_h1_s0,
          drsi_h1_s0:   openBar.drsi_h1_s0,
          zscore_h1_s0: openBar.zscore_h1_s0,
          // H4 s1/s0
          slope_h4:     openBar.slope_h4,
          drsi_h4:      openBar.drsi_h4,
          slope_h4_s0:  openBar.slope_h4_s0,
          drsi_h4_s0:   openBar.drsi_h4_s0,
          // context
          intraday_change: openBar.intraday_change,
          rsi_h1_prevLow3:  openBar.rsi_h1_previouslow3,
          rsi_h1_prevHigh3: openBar.rsi_h1_previoushigh3,
        });
      }

      trades.push({
        ticket:    trade.ticket,
        timestamp: trade.openTime,
        closeTime: lastBar.timestamp,
        symbol:    lastBar.symbol,
        side:      trade.side,
        type:      trade.type ?? "reversal",
        route:     trade.route ?? null,
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


  return { trades, initialEquity, finalEquity: equity, equityCurve };
}