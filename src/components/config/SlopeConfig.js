// ============================================================================
// SlopeConfig.js — Classification des régimes de slope H1, par actif
// Calibration : P40/P60 (flat) — P20/P80 (weak) — P5/P95 (strong/extreme)
// Source : données réelles M5, colonne slope_h1
// ============================================================================

export const SLOPE_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────
  EURUSD: {
    flat:         { min: -0.8727, max:  0.7492  },
    up_weak:      { min:  0.7492, max:  2.9089  },
    up_strong:    { min:  2.9089, max:  5.2239  },
    up_extreme:   { min:  5.2239, max:  Infinity },
    down_weak:    { min: -2.9011, max: -0.8727  },
    down_strong:  { min: -5.3606, max: -2.9011  },
    down_extreme: { min: -Infinity, max: -5.3606 },
  },

  GBPUSD: {
    flat:         { min: -0.8141, max:  0.9241  },
    up_weak:      { min:  0.9241, max:  2.8014  },
    up_strong:    { min:  2.8014, max:  5.2455  },
    up_extreme:   { min:  5.2455, max:  Infinity },
    down_weak:    { min: -2.6866, max: -0.8141  },
    down_strong:  { min: -5.3530, max: -2.6866  },
    down_extreme: { min: -Infinity, max: -5.3530 },
  },

  USDJPY: {
    flat:         { min: -0.6069, max:  0.8387  },
    up_weak:      { min:  0.8387, max:  2.3470  },
    up_strong:    { min:  2.3470, max:  4.4481  },
    up_extreme:   { min:  4.4481, max:  Infinity },
    down_weak:    { min: -2.3730, max: -0.6069  },
    down_strong:  { min: -5.0950, max: -2.3730  },
    down_extreme: { min: -Infinity, max: -5.0950 },
  },

  EURJPY: {
    flat:         { min: -0.5644, max:  0.7899  },
    up_weak:      { min:  0.7899, max:  2.1768  },
    up_strong:    { min:  2.1768, max:  4.3671  },
    up_extreme:   { min:  4.3671, max:  Infinity },
    down_weak:    { min: -2.3464, max: -0.5644  },
    down_strong:  { min: -5.0461, max: -2.3464  },
    down_extreme: { min: -Infinity, max: -5.0461 },
  },

  GBPJPY: {
    flat:         { min: -0.3591, max:  0.8344  },
    up_weak:      { min:  0.8344, max:  2.2946  },
    up_strong:    { min:  2.2946, max:  4.6982  },
    up_extreme:   { min:  4.6982, max:  Infinity },
    down_weak:    { min: -2.3920, max: -0.3591  },
    down_strong:  { min: -5.0324, max: -2.3920  },
    down_extreme: { min: -Infinity, max: -5.0324 },
  },

  AUDUSD: {
    flat:         { min:  -0.6552, max:   0.7009  },
    up_weak:      { min:   0.7009, max:   2.3159  },
    up_strong:    { min:   2.3159, max:   5.4661  },
    up_extreme:   { min:   5.4661, max:  Infinity },
    down_weak:    { min:  -2.3602, max:  -0.6552  },
    down_strong:  { min:  -4.8322, max:  -2.3602  },
    down_extreme: { min: -Infinity, max:  -4.8322 },
  },

  NZDUSD: {
    flat:         { min:  -0.6893, max:   0.7721  },
    up_weak:      { min:   0.7721, max:   2.3158  },
    up_strong:    { min:   2.3158, max:   5.5389  },
    up_extreme:   { min:   5.5389, max:  Infinity },
    down_weak:    { min:  -2.4286, max:  -0.6893  },
    down_strong:  { min:  -4.7600, max:  -2.4286  },
    down_extreme: { min: -Infinity, max:  -4.7600 },
  },

  // ── INDEX ─────────────────────────────────────────────────────────────────
  UK_100: {
    flat:         { min: -0.6548, max:  1.0405  },
    up_weak:      { min:  1.0405, max:  2.8842  },
    up_strong:    { min:  2.8842, max:  5.2902  },
    up_extreme:   { min:  5.2902, max:  Infinity },
    down_weak:    { min: -2.7283, max: -0.6548  },
    down_strong:  { min: -5.3923, max: -2.7283  },
    down_extreme: { min: -Infinity, max: -5.3923 },
  },

  GERMANY_40: {
    flat:         { min: -0.6985, max:  0.8325  },
    up_weak:      { min:  0.8325, max:  2.7191  },
    up_strong:    { min:  2.7191, max:  5.2617  },
    up_extreme:   { min:  5.2617, max:  Infinity },
    down_weak:    { min: -2.4690, max: -0.6985  },
    down_strong:  { min: -4.9954, max: -2.4690  },
    down_extreme: { min: -Infinity, max: -4.9954 },
  },

  FRANCE_40: {
    flat:         { min: -0.5009, max:  0.9078  },
    up_weak:      { min:  0.9078, max:  2.4026  },
    up_strong:    { min:  2.4026, max:  4.4170  },
    up_extreme:   { min:  4.4170, max:  Infinity },
    down_weak:    { min: -2.0362, max: -0.5009  },
    down_strong:  { min: -4.4933, max: -2.0362  },
    down_extreme: { min: -Infinity, max: -4.4933 },
  },

  US_30: {
    flat:         { min: -0.7478, max:  1.1061  },
    up_weak:      { min:  1.1061, max:  3.4252  },
    up_strong:    { min:  3.4252, max:  6.2037  },
    up_extreme:   { min:  6.2037, max:  Infinity },
    down_weak:    { min: -2.9579, max: -0.7478  },
    down_strong:  { min: -6.2404, max: -2.9579  },
    down_extreme: { min: -Infinity, max: -6.2404 },
  },

  US_500: {
    flat:         { min: -0.6278, max:  1.1247  },
    up_weak:      { min:  1.1247, max:  3.0888  },
    up_strong:    { min:  3.0888, max:  5.6275  },
    up_extreme:   { min:  5.6275, max:  Infinity },
    down_weak:    { min: -2.6891, max: -0.6278  },
    down_strong:  { min: -6.3245, max: -2.6891  },
    down_extreme: { min: -Infinity, max: -6.3245 },
  },

  US_TECH100: {
    flat:         { min: -0.5502, max:  0.9580  },
    up_weak:      { min:  0.9580, max:  3.0687  },
    up_strong:    { min:  3.0687, max:  5.6138  },
    up_extreme:   { min:  5.6138, max:  Infinity },
    down_weak:    { min: -2.8780, max: -0.5502  },
    down_strong:  { min: -6.6421, max: -2.8780  },
    down_extreme: { min: -Infinity, max: -6.6421 },
  },

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  BTCEUR: {
    flat:         { min: -0.6778, max:  0.8229  },
    up_weak:      { min:  0.8229, max:  2.6232  },
    up_strong:    { min:  2.6232, max:  4.9469  },
    up_extreme:   { min:  4.9469, max:  Infinity },
    down_weak:    { min: -2.4728, max: -0.6778  },
    down_strong:  { min: -5.3654, max: -2.4728  },
    down_extreme: { min: -Infinity, max: -5.3654 },
  },

  BTCUSD: {
    flat:         { min: -0.6673, max:  0.7623  },
    up_weak:      { min:  0.7623, max:  2.6187  },
    up_strong:    { min:  2.6187, max:  4.8835  },
    up_extreme:   { min:  4.8835, max:  Infinity },
    down_weak:    { min: -2.5489, max: -0.6673  },
    down_strong:  { min: -5.4614, max: -2.5489  },
    down_extreme: { min: -Infinity, max: -5.4614 },
  },

  ETHUSD: {
    flat:         { min: -0.6048, max:  0.7997  },
    up_weak:      { min:  0.7997, max:  2.5253  },
    up_strong:    { min:  2.5253, max:  4.6848  },
    up_extreme:   { min:  4.6848, max:  Infinity },
    down_weak:    { min: -2.3895, max: -0.6048  },
    down_strong:  { min: -5.1627, max: -2.3895  },
    down_extreme: { min: -Infinity, max: -5.1627 },
  },

  // ── METAL ─────────────────────────────────────────────────────────────────
  GOLD: {
    flat:         { min: -0.5691, max:  0.6381  },
    up_weak:      { min:  0.6381, max:  2.0572  },
    up_strong:    { min:  2.0572, max:  4.7547  },
    up_extreme:   { min:  4.7547, max:  Infinity },
    down_weak:    { min: -2.1552, max: -0.5691  },
    down_strong:  { min: -5.2890, max: -2.1552  },
    down_extreme: { min: -Infinity, max: -5.2890 },
  },

  SILVER: {
    flat:         { min: -0.5747, max:  0.7607  },
    up_weak:      { min:  0.7607, max:  2.3079  },
    up_strong:    { min:  2.3079, max:  4.1789  },
    up_extreme:   { min:  4.1789, max:  Infinity },
    down_weak:    { min: -2.3355, max: -0.5747  },
    down_strong:  { min: -5.0464, max: -2.3355  },
    down_extreme: { min: -Infinity, max: -5.0464 },
  },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────
  CRUDEOIL: {
    flat:         { min: -0.5558, max:  1.2456  },
    up_weak:      { min:  1.2456, max:  3.2372  },
    up_strong:    { min:  3.2372, max:  5.8287  },
    up_extreme:   { min:  5.8287, max:  Infinity },
    down_weak:    { min: -2.7134, max: -0.5558  },
    down_strong:  { min: -6.0513, max: -2.7134  },
    down_extreme: { min: -Infinity, max: -6.0513 },
  },

  BRENT_OIL: {
    flat:         { min:  -0.5574, max:   0.8665  },
    up_weak:      { min:   0.8665, max:   2.5907  },
    up_strong:    { min:   2.5907, max:   5.6592  },
    up_extreme:   { min:   5.6592, max:  Infinity },
    down_weak:    { min:  -2.6582, max:  -0.5574  },
    down_strong:  { min:  -6.3011, max:  -2.6582  },
    down_extreme: { min: -Infinity, max:  -6.3011 },
  },

  GASOLINE: {
    flat:         { min:  -0.7381, max:   0.7456  },
    up_weak:      { min:   0.7456, max:   2.4146  },
    up_strong:    { min:   2.4146, max:   5.7238  },
    up_extreme:   { min:   5.7238, max:  Infinity },
    down_weak:    { min:  -2.3368, max:  -0.7381  },
    down_strong:  { min:  -5.1724, max:  -2.3368  },
    down_extreme: { min: -Infinity, max:  -5.1724 },
  },

  // ── AGRI ──────────────────────────────────────────────────────────────────
  WHEAT: {
    flat:         { min: -0.7854, max:  1.0560  },
    up_weak:      { min:  1.0560, max:  2.9483  },
    up_strong:    { min:  2.9483, max:  5.7452  },
    up_extreme:   { min:  5.7452, max:  Infinity },
    down_weak:    { min: -2.9696, max: -0.7854  },
    down_strong:  { min: -5.9408, max: -2.9696  },
    down_extreme: { min: -Infinity, max: -5.9408 },
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────
  default: {
    flat:         { min: -0.65,   max:  0.90   },
    up_weak:      { min:  0.90,   max:  2.60   },
    up_strong:    { min:  2.60,   max:  5.00   },
    up_extreme:   { min:  5.00,   max:  Infinity },
    down_weak:    { min: -2.60,   max: -0.65   },
    down_strong:  { min: -5.00,   max: -2.60   },
    down_extreme: { min: -Infinity, max: -5.00 },
  },

};

// ============================================================================
// HELPER
// ============================================================================
export function getSlopeClass(slope, symbol) {
  const cfg = getSlopeConfig(symbol);

  for (const [regime, { min, max }] of Object.entries(cfg)) {
    if (slope > min && slope <= max) return regime;
  }

  return "unknown";
}

export function getSlopeConfig(symbol) {
  if (!symbol) return SLOPE_CONFIG.default;
  const clean = String(symbol).trim().toUpperCase();
  return SLOPE_CONFIG[clean] ?? SLOPE_CONFIG.default;
}