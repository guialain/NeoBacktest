// Colonnes exportées par le script MQL5 (ordre de référence) :
// symbol, assetclass, digits, spread_points, volume_min, volume_max, volume_step,
// contract_size, tick_size, tick_value, stops_level,
// timestamp, open, high, low, close,
// rsi_m1, slope_m1, zscore_m1, drsi_m1, dslope_m1, dz_m1,
// rsi_m5, slope_m5, zscore_m5, drsi_m5, dslope_m5, dz_m5,
// rsi_m15, slope_m15, zscore_m15, drsi_m15, dslope_m15, dz_m15,
// rsi_h1, slope_h1, zscore_h1, drsi_h1, dslope_h1, dz_h1,
// bb_m5_upper, bb_m5_mid, bb_m5_lower,
// bb_m15_upper, bb_m15_mid, bb_m15_lower,
// bb_h1_upper, bb_h1_mid, bb_h1_lower,
// intraday_change, change_h4,
// atr_m1, datr_m1, atr_m5, datr_m5, atr_m15, datr_m15,
// atr_h1, datr_h1, atr_h4, atr_d1

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(";").map(s => s.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j];
      const raw = (cols[j] ?? "").trim();
      const n   = Number(raw);
      obj[key]  = raw === "" ? null : (Number.isFinite(n) ? n : raw);
    }
    rows.push(obj);
  }
  return rows;
}
