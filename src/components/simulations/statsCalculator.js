// ============================================================================
// statsCalculator.js — FIXED
// ============================================================================

export function calculateStats(trades, config = {}) {

  if (!Array.isArray(trades)) {
    console.error("calculateStats: trades is not an array", trades);
    trades = [];
  }

  const initialEquity =
    Number.isFinite(Number(config.initialEquity))
      ? Number(config.initialEquity)
      : 10000;

  let equity = initialEquity;

  const equityCurve = [{
    timestamp: null,
    equity: initialEquity
  }];

  let totalWin  = 0;
  let totalLose = 0;
  let pnlWin    = 0;
  let pnlLose   = 0;
  let totalPnl  = 0;

  let peak           = initialEquity;
  let maxDrawdown    = 0;
  let maxDrawdownPct = 0;

  const returns = [];

  trades.forEach(t => {

    const equityBefore = equity;
    equity   += t.pnl;
    totalPnl += t.pnl;

    equityCurve.push({
      timestamp: t.closeTime,
      equity
    });

    const tradeReturn =
      equityBefore !== 0 ? t.pnl / equityBefore : 0;

    returns.push(tradeReturn);

    if (t.pnl > 0) {
      totalWin++;
      pnlWin += t.pnl;
    } else if (t.pnl < 0) {
      totalLose++;
      pnlLose += t.pnl;
    }

    if (equity > peak) peak = equity;

    const drawdown = peak - equity;
    const drawdownPct =
      peak !== 0 ? (drawdown / peak) * 100 : 0;

    if (drawdown    > maxDrawdown)    maxDrawdown    = drawdown;
    if (drawdownPct > maxDrawdownPct) maxDrawdownPct = drawdownPct;
  });

  const finalEquity  = equity;
  const totalNonZero = totalWin + totalLose;

  const successRate =
    totalNonZero ? (totalWin / totalNonZero) * 100 : 0;

  const performancePct =
    ((finalEquity - initialEquity) / initialEquity) * 100;

  const avgWin  = totalWin  ? pnlWin  / totalWin  : 0;
  const avgLoss = totalLose ? Math.abs(pnlLose / totalLose) : 0;

  const expectancy =
    trades.length ? totalPnl / trades.length : 0;

  const profitFactor =
    pnlLose !== 0 ? Math.abs(pnlWin / pnlLose) : Infinity;

  const rrRatio =
    avgLoss !== 0 ? avgWin / avgLoss : null;

  // Sharpe simplifié
  const meanReturn =
    returns.length
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : 0;

  const variance =
    returns.length
      ? returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length
      : 0;

  const stdDev = Math.sqrt(variance);

  const sharpe =
    stdDev !== 0 ? meanReturn / stdDev : null;

  return {
    initialEquity,
    finalEquity,
    performancePct,

    totalTrades:    trades.length,
    totalWin,
    totalLose,
    totalBreakeven: trades.length - totalNonZero,
    successRate,

    pnlWin,
    pnlLose,
    totalPnl,

    avgWin,
    avgLoss,
    expectancy,

    profitFactor,
    rrRatio,

    maxDrawdown,
    maxDrawdownPct,

    sharpe,

    equityCurve
  };
}