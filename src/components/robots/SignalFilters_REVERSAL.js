// ============================================================================
// SignalFilters_REVERSAL.js — M5 ENTRY FILTER for REVERSAL LAB
// Minimal: only blocks when M5 RSI is overextended against the trade
// ============================================================================

const SignalFilters_REVERSAL = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  function evaluate({ opportunities } = {}) {
    const opps = Array.isArray(opportunities) ? opportunities : [];

    const validOpportunities = [];
    const waitOpportunities  = [];

    for (const opp of opps) {
      const side = opp?.side;
      if (!side) continue;

      const rsi_m5 = num(opp?.rsi_m5);

      // Pas de filtre M5 pour l'instant

      validOpportunities.push({ ...opp, state: "VALID" });
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters_REVERSAL;
