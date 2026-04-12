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

      // Filtre weekend + sessions EU/US (9h-19h) et Asia (23h-08h)
      // Pas de trade entre 19h-23h et 08h-09h
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
            const hour = d.getHours();
            const inEuUs = hour >= 9 && hour < 19;
            const inAsia = hour >= 23 || hour < 8;
            if (!inEuUs && !inAsia) {
              waitOpportunities.push({ ...opp, state: "WAIT_HOURS" });
              continue;
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

      // Filtre M5 dslope — accélération M5 contraire = news ou retournement en cours
      // CONT/EARLY seulement : pour REV c'est souvent le setup lui-même
      const m5Type = opp?.signalType ?? "CONTINUATION";
      const dslope_m5_val = num(opp?.dslope_m5);
      if (dslope_m5_val !== null) {
        const dslopeThr = m5Type === "CONTINUATION" ? 3.0
                        : m5Type === "EARLY"        ? 3.0
                        : null; // REVERSAL : pas de gate
        if (dslopeThr !== null) {
          if (side === "BUY"  && dslope_m5_val < -dslopeThr) {
            waitOpportunities.push({ ...opp, state: "WAIT_M5_ACCEL" });
            continue;
          }
          if (side === "SELL" && dslope_m5_val >  dslopeThr) {
            waitOpportunities.push({ ...opp, state: "WAIT_M5_ACCEL" });
            continue;
          }
        }
      }

      // Filtre M5 zscore live — seuil selon mode (mêmes tables que passZscoreGate H1)
      const zscore_m5_live = num(opp?.zscore_m5_s0) ?? num(opp?.zscore_m5);
      if (zscore_m5_live !== null) {
        const m5Mode = opp?.mode ?? "normal";
        const CONT_THR  = { strict: 1.8, normal: 1.8, soft: 2.0, relaxed: 2.3, spike: 99 };
        const REV_THR   = { strict: 1.8, normal: 1.8, soft: 1.0, relaxed: 0.8, spike: 0.5 };
        const EARLY_THR = { strict: 1.8, normal: 1.8, soft: 1.2, relaxed: 1.5, spike: 1.5 };
        const thrTable  = m5Type === "REVERSAL" ? REV_THR
                        : m5Type === "EARLY"    ? EARLY_THR
                        : CONT_THR;
        const zm5Thr = thrTable[m5Mode] ?? 1.5;

        if (side === "BUY"  && zscore_m5_live >  zm5Thr) {
          waitOpportunities.push({ ...opp, state: "WAIT_M5_ZSCORE" });
          continue;
        }
        if (side === "SELL" && zscore_m5_live < -zm5Thr) {
          waitOpportunities.push({ ...opp, state: "WAIT_M5_ZSCORE" });
          continue;
        }
      }

      validOpportunities.push({ ...opp, state: "VALID" });
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters_LAB;
