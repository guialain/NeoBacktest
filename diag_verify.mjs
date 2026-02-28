// diag_verify.mjs — Verify signal count after SignalFilters.js fixes
// Run: node --experimental-vm-modules diag_verify.mjs
// Or:  node diag_verify.mjs  (ES module, package.json has "type":"module")

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load a single CSV file ────────────────────────────────────────────────────
function loadCSV(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map(h => h.trim());

  return lines.slice(1).map((line, i) => {
    const vals = line.split(";");
    const row = { index: i + 1 };
    headers.forEach((h, j) => {
      const v = vals[j]?.trim();
      row[h] = v !== undefined ? v : "";
    });
    return row;
  });
}

// ── Dynamic imports (ES modules) ─────────────────────────────────────────────
const { default: TopOpportunities } = await import(
  "./src/components/robots/TopOpportunities.js"
);
const { default: SignalFilters } = await import(
  "./src/components/robots/SignalFilters.js"
);

// ── Find available CSV files ──────────────────────────────────────────────────
import { readdirSync } from "fs";

const MT5_DIR =
  "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files";

let csvFiles = [];
try {
  csvFiles = readdirSync(MT5_DIR)
    .filter(f => f.endsWith(".csv"))
    .slice(0, 3); // limit to 3 files for speed
} catch (e) {
  console.error("Cannot read MT5 dir:", e.message);
  process.exit(1);
}

if (csvFiles.length === 0) {
  console.error("No CSV files found in", MT5_DIR);
  process.exit(1);
}

console.log("Files to process:", csvFiles, "\n");

// ── Process each file ─────────────────────────────────────────────────────────
const totals = {
  rawSignals: 0,
  byType: { reversal: 0, continuation: 0 },
  valid: 0,
  validByType: { reversal: 0, continuation: 0 },
  waitCounts: {},
};

for (const file of csvFiles) {
  const filePath = join(MT5_DIR, file);
  const marketData = loadCSV(filePath);

  if (marketData.length < 10) {
    console.log(`  ${file}: too few rows (${marketData.length}), skipping`);
    continue;
  }

  // Add numeric index
  marketData.forEach((row, i) => {
    row.index = i;
    // normalize numeric fields
    for (const k of Object.keys(row)) {
      if (k === "index" || k === "timestamp" || k === "symbol") continue;
      const n = Number(row[k]);
      if (Number.isFinite(n)) row[k] = n;
    }
  });

  const symbol = marketData[0]?.symbol ?? file;

  // Generate signals
  const raw = TopOpportunities.evaluate(marketData);
  const rawArr = Array.isArray(raw) ? raw : (raw?.opportunities ?? []);

  totals.rawSignals += rawArr.length;
  for (const s of rawArr) {
    const t = String(s.type ?? "").toUpperCase() === "CONTINUATION" ? "continuation" : "reversal";
    totals.byType[t] = (totals.byType[t] ?? 0) + 1;
  }

  // Apply filters
  const { validOpportunities, waitOpportunities } = SignalFilters.evaluate({
    opportunities: rawArr,
  });

  totals.valid += validOpportunities.length;
  for (const s of validOpportunities) {
    const t = String(s.type ?? "").toUpperCase() === "CONTINUATION" ? "continuation" : "reversal";
    totals.validByType[t] = (totals.validByType[t] ?? 0) + 1;
  }

  for (const s of waitOpportunities) {
    const st = s.state ?? "UNKNOWN";
    totals.waitCounts[st] = (totals.waitCounts[st] ?? 0) + 1;
  }

  console.log(
    `  ${symbol} (${file}): raw=${rawArr.length}` +
      `  reversal=${rawArr.filter(s => String(s.type ?? "").toUpperCase() !== "CONTINUATION").length}` +
      `  continuation=${rawArr.filter(s => String(s.type ?? "").toUpperCase() === "CONTINUATION").length}` +
      `  → valid=${validOpportunities.length}`
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n════════════ FUNNEL SUMMARY ════════════");
console.log(`Raw signals:  ${totals.rawSignals}`);
console.log(
  `  reversal:      ${totals.byType.reversal ?? 0}`,
  `  continuation:  ${totals.byType.continuation ?? 0}`
);
console.log(`Valid signals: ${totals.valid}`);
console.log(
  `  reversal:      ${totals.validByType.reversal ?? 0}`,
  `  continuation:  ${totals.validByType.continuation ?? 0}`
);

const pct = totals.rawSignals > 0
  ? ((totals.valid / totals.rawSignals) * 100).toFixed(1)
  : "—";
console.log(`Pass rate: ${pct}%`);

console.log("\n── WAIT states ──");
const sorted = Object.entries(totals.waitCounts).sort((a, b) => b[1] - a[1]);
for (const [state, count] of sorted) {
  const pctW =
    totals.rawSignals > 0
      ? ((count / totals.rawSignals) * 100).toFixed(1)
      : "—";
  console.log(`  ${state.padEnd(30)} ${String(count).padStart(5)}  (${pctW}%)`);
}
