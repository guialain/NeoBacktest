// ============================================================================
// IntradayConfig.js — 9 régimes intraday, calibrés sur context CSVs H1
//
//  Régime            Percentile    Borne basse (cfg)
//  ────────────────────────────────────────────────
//  ⚡ SPIKE_DOWN      < P1          spikeDown
//  🟥 EXPLOSIVE_DOWN  P1  – P5      explosiveDown
//  🔻 STRONG_DOWN     P5  – P20     strongDown
//  ⬇️  SOFT_DOWN      P20 – P30     softDown
//  ➖ NEUTRE          P30 – P70     (entre softDown et softUp)
//  ↗️  SOFT_UP        P70 – P80     softUp
//  ⬆️  STRONG_UP      P80 – P95     strongUp
//  🟩 EXPLOSIVE_UP   P95 – P99     explosiveUp
//  ⚡ SPIKE_UP        > P99         spikeUp
//
// Sources : context CSVs (intraday contexte/) — données H1 longues
// ============================================================================

export const INTRADAY_CONFIG = {

  // ── FX ───────────────────────────────────────────────────────────────────────
  EURUSD: { // 6303 bars [ctx]
    spikeDown: -0.8, explosiveDown: -0.49, strongDown: -0.19, softDown: -0.1,
    softUp: 0.1, strongUp: 0.19, explosiveUp: 0.55, spikeUp: 0.99,
  },
  GBPUSD: { // 6303 bars [ctx]
    spikeDown: -0.87, explosiveDown: -0.53, strongDown: -0.19, softDown: -0.12,
    softUp: 0.12, strongUp: 0.21, explosiveUp: 0.54, spikeUp: 0.87,
  },
  USDJPY: { // 6305 bars [ctx]
    spikeDown: -1.16, explosiveDown: -0.66, strongDown: -0.29, softDown: -0.17,
    softUp: 0.17, strongUp: 0.29, explosiveUp: 0.71, spikeUp: 1.18,
  },
  USDCHF: { // 6303 bars [ctx]
    spikeDown: -1.15, explosiveDown: -0.64, strongDown: -0.21, softDown: -0.12,
    softUp: 0.12, strongUp: 0.22, explosiveUp: 0.56, spikeUp: 0.98,
  },
  USDCAD: { // 6302 bars [ctx]
    spikeDown: -0.69, explosiveDown: -0.36, strongDown: -0.12, softDown: -0.08,
    softUp: 0.08, strongUp: 0.13, explosiveUp: 0.31, spikeUp: 0.51,
  },
  AUDUSD: { // 6302 bars [ctx]
    spikeDown: -1.02, explosiveDown: -0.65, strongDown: -0.26, softDown: -0.2,
    softUp: 0.2, strongUp: 0.32, explosiveUp: 0.7, spikeUp: 1.25,
  },
  NZDUSD: { // 6304 bars [ctx]
    spikeDown: -1.09, explosiveDown: -0.72, strongDown: -0.31, softDown: -0.19,
    softUp: 0.19, strongUp: 0.31, explosiveUp: 0.74, spikeUp: 1.29,
  },
  EURJPY: { // 6302 bars [ctx]
    spikeDown: -0.75, explosiveDown: -0.48, strongDown: -0.19, softDown: -0.14,
    softUp: 0.14, strongUp: 0.23, explosiveUp: 0.53, spikeUp: 0.83,
  },
  GBPJPY: { // 6302 bars [ctx]
    spikeDown: -0.92, explosiveDown: -0.54, strongDown: -0.21, softDown: -0.14,
    softUp: 0.14, strongUp: 0.23, explosiveUp: 0.58, spikeUp: 0.93,
  },
  EURCHF: { // 6304 bars [ctx]
    spikeDown: -0.61, explosiveDown: -0.31, strongDown: -0.12, softDown: -0.06,
    softUp: 0.06, strongUp: 0.12, explosiveUp: 0.3, spikeUp: 0.5,
  },

  // ── INDEX ────────────────────────────────────────────────────────────────────
  UK_100: { // 5108 bars [ctx]
    spikeDown: -1.81, explosiveDown: -0.74, strongDown: -0.22, softDown: -0.19,
    softUp: 0.19, strongUp: 0.34, explosiveUp: 0.93, spikeUp: 1.64,
  },
  GERMANY_40: { // 5229 bars [ctx]
    spikeDown: -2.73, explosiveDown: -1.26, strongDown: -0.43, softDown: -0.22,
    softUp: 0.22, strongUp: 0.38, explosiveUp: 1.03, spikeUp: 1.75,
  },
  FRANCE_40: { // 3596 bars [ctx]
    spikeDown: -2.63, explosiveDown: -1.11, strongDown: -0.4, softDown: -0.33,
    softUp: 0.33, strongUp: 0.53, explosiveUp: 1.07, spikeUp: 1.84,
  },
  US_30: { // 5917 bars [ctx]
    spikeDown: -1.85, explosiveDown: -0.83, strongDown: -0.26, softDown: -0.15,
    softUp: 0.15, strongUp: 0.28, explosiveUp: 0.92, spikeUp: 1.76,
  },
  US_500: { // 5991 bars [ctx]
    spikeDown: -1.86, explosiveDown: -0.89, strongDown: -0.27, softDown: -0.19,
    softUp: 0.19, strongUp: 0.32, explosiveUp: 0.89, spikeUp: 1.9,
  },
  US_TECH100: { // 5996 bars [ctx]
    spikeDown: -2.25, explosiveDown: -1.16, strongDown: -0.35, softDown: -0.26,
    softUp: 0.26, strongUp: 0.44, explosiveUp: 1.2, spikeUp: 2.26,
  },
  JAPAN_225: { // 6033 bars [ctx]
    spikeDown: -3.35, explosiveDown: -1.66, strongDown: -0.66, softDown: -0.49,
    softUp: 0.49, strongUp: 0.84, explosiveUp: 1.88, spikeUp: 3.15,
  },

  // ── CRYPTO ───────────────────────────────────────────────────────────────────
  BTCUSD: { // 8831 bars [ctx]
    spikeDown: -4.44, explosiveDown: -2.59, strongDown: -0.88, softDown: -0.49,
    softUp: 0.49, strongUp: 0.89, explosiveUp: 2.27, spikeUp: 4.56,
  },
  BTCEUR: { // 8833 bars [ctx]
    spikeDown: -4.54, explosiveDown: -2.61, strongDown: -0.86, softDown: -0.48,
    softUp: 0.48, strongUp: 0.88, explosiveUp: 2.26, spikeUp: 4.42,
  },
  BTCJPY: { // 8832 bars [ctx]
    spikeDown: -4.67, explosiveDown: -2.68, strongDown: -0.86, softDown: -0.53,
    softUp: 0.53, strongUp: 0.94, explosiveUp: 2.36, spikeUp: 4.6,
  },
  ETHUSD: { // 8833 bars [ctx]
    spikeDown: -6.69, explosiveDown: -4.19, strongDown: -1.42, softDown: -0.82,
    softUp: 0.82, strongUp: 1.48, explosiveUp: 4.1, spikeUp: 7.9,
  },

  // ── METAL ────────────────────────────────────────────────────────────────────
  GOLD: { // 5988 bars [ctx]
    spikeDown: -4.13, explosiveDown: -1.69, strongDown: -0.52, softDown: -0.48,
    softUp: 0.48, strongUp: 0.78, explosiveUp: 1.75, spikeUp: 2.92,
  },
  SILVER: { // 5974 bars [ctx]
    spikeDown: -8.72, explosiveDown: -3.51, strongDown: -0.8, softDown: -0.91,
    softUp: 0.91, strongUp: 1.5, explosiveUp: 3.81, spikeUp: 6.4,
  },

  // ── ENERGY ───────────────────────────────────────────────────────────────────
  CrudeOIL: { // 5982 bars [ctx]
    spikeDown: -4.82, explosiveDown: -2.38, strongDown: -0.84, softDown: -0.49,
    softUp: 0.49, strongUp: 0.94, explosiveUp: 2.57, spikeUp: 6.3,
  },
  BRENT_OIL: { // 5673 bars [ctx]
    spikeDown: -4.51, explosiveDown: -2.26, strongDown: -0.78, softDown: -0.53,
    softUp: 0.53, strongUp: 0.97, explosiveUp: 2.69, spikeUp: 6.35,
  },
  GASOLINE: { // 4727 bars [ctx]
    spikeDown: -3.34, explosiveDown: -1.8, strongDown: -0.61, softDown: -0.46,
    softUp: 0.46, strongUp: 0.84, explosiveUp: 2.27, spikeUp: 4.31,
  },

  // ── AGRI ─────────────────────────────────────────────────────────────────────
  WHEAT: { // 4899 bars [ctx]
    spikeDown: -2.35, explosiveDown: -1.44, strongDown: -0.56, softDown: -0.33,
    softUp: 0.33, strongUp: 0.5, explosiveUp: 1.47, spikeUp: 2.63,
  },

  // ── Default — actifs sans context CSV ─────────────────────────────────────
  default: {
    spikeDown: -2.00, explosiveDown: -1.00, strongDown: -0.50, softDown: -0.25,
    softUp: 0.25, strongUp: 0.50, explosiveUp: 1.00, spikeUp: 2.00,
  },
};

