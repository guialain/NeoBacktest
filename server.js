import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

const MT5_DIR =
  "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/" +
  "9B101088254A9C260A9790D5079A7B11/MQL5/Files";

/* ============================================================
   SAFE NUMBER
============================================================ */

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ============================================================
   SAFE INTEGER
============================================================ */

function toInt(v, fallback = null) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/* ============================================================
   READ CSV (NO BUSINESS LOGIC)
============================================================ */

function readCSV(filePath, options = {}) {
  const { limit = null, offset = 0 } = options;

  if (!fs.existsSync(filePath)) {
    return { error: "FILE_NOT_FOUND" };
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) return { error: "EMPTY_FILE" };

  const lines = content
    .split(/\r?\n/)
    .filter(line => line.trim() !== "");

  if (lines.length < 2) {
    return { error: "NO_DATA_ROWS" };
  }

  const headers = lines[0].split(";");
  const dataLines = lines.slice(1);

  const safeOffset = Math.min(offset, dataLines.length);
  const safeLimit =
    limit !== null
      ? Math.max(0, Math.min(limit, dataLines.length - safeOffset))
      : null;

  const sliced =
    safeLimit !== null
      ? dataLines.slice(safeOffset, safeOffset + safeLimit)
      : dataLines.slice(safeOffset);

  const rows = sliced
    .map(line => {
      const values = line.split(";");
      if (values.length !== headers.length) return null;

      const obj = {};

      headers.forEach((h, i) => {
        const val = values[i] ?? "";

        if (h === "symbol" || h === "assetclass" || h === "timestamp") {
          obj[h] = val;
        } else {
          obj[h] = toNum(val);
        }
      });

      return obj;
    })
    .filter(Boolean);

  return {
    rows,
    total: dataLines.length,
    returned: rows.length,
    offset: safeOffset,
    limit: safeLimit
  };
}

/* ============================================================
   LIST CSV FILES
============================================================ */

app.get("/api/backtest-files", (req, res) => {
  try {
    if (!fs.existsSync(MT5_DIR)) {
      return res.status(500).json({ error: "MT5_DIR_NOT_FOUND" });
    }

    const files = fs
      .readdirSync(MT5_DIR)
      .filter(f => f.toLowerCase().endsWith(".csv"));

    res.json({ files });

  } catch (err) {
    res.status(500).json({ error: "LIST_FILES_ERROR" });
  }
});

/* ============================================================
   META ONLY (NO CALCULATION)
============================================================ */

app.get("/api/backtest-meta/:fileName", (req, res) => {
  try {
    const safeName = path.basename(req.params.fileName);
    const filePath = path.join(MT5_DIR, safeName);

    const result = readCSV(filePath);

    if (result.error || !Array.isArray(result.rows) || result.rows.length === 0) {
      return res.status(404).json({ error: "INVALID_FILE" });
    }

    const firstRow = result.rows[0];
    const lastRow  = result.rows[result.rows.length - 1];

    res.json({
      symbol:       firstRow.symbol ?? null,
      assetclass:   firstRow.assetclass ?? null,
      periodStart:  firstRow.timestamp ?? null,
      periodEnd:    lastRow.timestamp ?? null,

      // 🔥 Données nécessaires pour sizing UI
      lastClose:    Number.isFinite(lastRow.close)      ? lastRow.close      : null,
      tickSize:     Number.isFinite(lastRow.tick_size)  ? lastRow.tick_size  : null,
      tickValue:    Number.isFinite(lastRow.tick_value) ? lastRow.tick_value : null,

      totalRows: result.total ?? 0
    });

  } catch (err) {
    console.error("META_API_ERROR:", err);
    res.status(500).json({ error: "META_API_ERROR" });
  }
});

/* ============================================================
   BACKTEST DATA (PAGINATED RAW)
============================================================ */

app.get("/api/backtest/:fileName", (req, res) => {
  try {
    const safeName = path.basename(req.params.fileName);
    const filePath = path.join(MT5_DIR, safeName);

    const limit = toInt(req.query.limit, null);
    const offset = toInt(req.query.offset, 0);

    const result = readCSV(filePath, { limit, offset });

    if (result.error) {
      return res.status(404).json(result);
    }

    res.json(result);

  } catch {
    res.status(500).json({ error: "BACKTEST_API_ERROR" });
  }
});

/* ============================================================
   DATA PREVIEW (FIRST 100 ROWS)
============================================================ */

app.get("/api/data/:fileName", (req, res) => {
  try {
    const safeName = path.basename(req.params.fileName);
    const filePath = path.join(MT5_DIR, safeName);

    const result = readCSV(filePath, { limit: 100, offset: 0 });

    if (result.error) {
      return res.status(404).json(result);
    }

    res.json(result);

  } catch {
    res.status(500).json({ error: "DATA_API_ERROR" });
  }
});

/* ============================================================
   SERVER START
============================================================ */

app.listen(PORT, () => {
  console.log(`🔥 NEO BACKTEST SERVER (DATA LAYER ONLY) RUNNING ON ${PORT}`);
});