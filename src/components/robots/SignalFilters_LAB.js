// ============================================================================
// SignalFilters_LAB.js — ENTRY FILTER for LAB engines (reversal + continuation)
// ============================================================================

import { getVolatilityRegime } from "./VolatilityEngine";

const SignalFilters_LAB = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  function evaluate({ opportunities } = {}) {
    const opps = Array.isArray(opportunities) ? opportunities : [];

    const validOpportunities = [];
    const waitOpportunities  = [];

    for (const opp of opps) {
      const side = opp?.side;
      if (!side) continue;

      // Filtre weekend + horaires indices 9h-19h
      const ts = opp?.timestamp;
      if (ts) {
        const [datePart, timePart] = String(ts).split(" ");
        if (datePart && timePart) {
          const d = new Date(`${datePart.replace(/\./g, "-")}T${timePart}:00`);
          if (!isNaN(d.getTime())) {
            const day = d.getDay();
            if (day === 0 || day === 6) {
              waitOpportunities.push({ ...opp, state: "WAIT_WEEKEND" });
              continue;
            }
            const sym = opp?.symbol ?? "";
            const isIndex = /^(UK_100|GERMANY_40|FRANCE_40|ITALY_40|US_30|US_500|US_TECH100|JAPAN_225)$/.test(sym);
            if (isIndex) {
              const hour = d.getHours();
              if (hour < 9 || hour >= 19) {
                waitOpportunities.push({ ...opp, state: "WAIT_HOURS" });
                continue;
              }
            }
          }
        }
      }

      // Filtre volatilité ATR M15 — régime "low" bloqué
      const regime = getVolatilityRegime(opp?.symbol, opp?.atr_m15, opp?.close);
      if (regime === "low") {
        waitOpportunities.push({ ...opp, state: "WAIT_VOL_ATR" });
        continue;
      }

      // Filtre volatilité M5 — range trop basse = prix bouge pas assez pour TP
      const range_s1 = num(opp?.range_m5_s1);
      const atr_m15  = num(opp?.atr_m15);
      if (range_s1 !== null && atr_m15 !== null && atr_m15 > 0) {
        const vol1 = range_s1 / atr_m15;
        if (vol1 < 0.25) {
          waitOpportunities.push({ ...opp, state: "WAIT_VOL_LOW" });
          continue;
        }
      }

      // Filtre M5 — rsi_m5 pas suracheté/survendu
      const rsi_m5 = num(opp?.rsi_m5);

      if (side === "BUY" && rsi_m5 !== null && rsi_m5 >= 65) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_RSI" });
        continue;
      }
      if (side === "SELL" && rsi_m5 !== null && rsi_m5 <= 35) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_RSI" });
        continue;
      }

      validOpportunities.push({ ...opp, state: "VALID" });
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters_LAB;
