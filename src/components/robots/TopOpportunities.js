// ============================================================================
// TopOpportunities.js — ORCHESTRATEUR DE STRATÉGIES
// ============================================================================

import ReversalStrategy      from "./reversal";
import ContinuationStrategy  from "./continuation";

const TopOpportunities = (() => {

  function evaluate(marketData = [], opts = {}) {

    const reversal     = ReversalStrategy.evaluate(marketData, opts);
    const continuation = ContinuationStrategy.evaluate(marketData, opts);

    return [...reversal, ...continuation]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }

  return { evaluate };

})();

export default TopOpportunities;
