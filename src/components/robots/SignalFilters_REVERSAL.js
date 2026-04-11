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

      // Filtre heures 8h-21h
      const ts = opp?.timestamp;
      if (ts) {
        const [, timePart] = String(ts).split(" ");
        if (timePart) {
          const hour = parseInt(timePart.split(":")[0], 10);
          if (hour < 8 || hour >= 21) {
            waitOpportunities.push({ ...opp, state: "WAIT_HOURS" });
            continue;
          }
        }
      }

      validOpportunities.push({ ...opp, state: "VALID" });
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters_REVERSAL;
