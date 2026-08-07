// MODE DEV MOTEUR PUR — aligne l'UI backtest (:5173) sur stats/run_universe.mjs, qui force déjà NO_TRIO=1.
//   Sans ça les deux ne mesuraient PAS la même chose : l'UI appliquait le gate de timing (comme la prod),
//   la CLI non → écart mesuré 1028,3 R / 10305 trades (UI) contre 1470,2 / 13589 (CLI). Mêmes conclusions
//   (le trio est un filtre AVAL, il rabote les deux versions pareil) mais chiffres incomparables à l'écran.
//   Le trio MASQUE l'effet des changements moteur — c'est exactement pourquoi le flag existe (owner 15/07).
//   ⚠ N'affecte QUE le backtest local. La PROD (Matrix-Revolution) n'a pas ce flag → trio ACTIF, inchangé.
//   Mettre NO_TRIO=0 dans l'environnement pour retrouver le comportement prod.
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";

import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import { runMatrixBacktest } from "./src/components/simulations/matrixBacktest.mjs";
import { getTpSl } from "../Matrix-Revolution/src/config/TpSlConfig.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

const MT5_DIR =
  "C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/" +
  "9B101088254A9C260A9790D5079A7B11/MQL5/Files/backtest/v8r";

// ============================================================
//   MATRIX BACKTEST — CSV par actif dans le projet (data/matrix)
//   Moteur importé cross-repo (SSOT, cf matrixBacktest.mjs).
// ============================================================
const MATRIX_DIR = path.resolve("data/matrix");

app.get("/api/matrix/assets", (req, res) => {
  try {
    const files = fs.readdirSync(MATRIX_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
    res.json(files.map((f) => f.replace(/\.csv$/i, "")).sort());
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// ── LIGNE BRUTE du dataset (page Indicateurs, 2026-07-25) ────────────────────────────────────────
//   Rend UNE ligne du CSV telle quelle + le nombre total, pour inspecter les capteurs barre par barre.
//   `?i=` index (défaut : la dernière) · `?ts=` horodatage ts_utc, prend la 1re ligne >= à cette valeur.
//   ⚠ Casse de l'actif RÉSOLUE CONTRE LE DISQUE, pas uppercase : `CrudeOIL` est en casse mixte et
//   l'uppercase aveugle a déjà cassé le chemin OHLC par le passé.
const _matrixFile = (raw) => {
  const want = String(raw).replace(/[^A-Za-z0-9_]/g, "").toLowerCase();
  const hit = fs.readdirSync(MATRIX_DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
    .find((f) => f.replace(/\.csv$/i, "").toLowerCase() === want);
  return hit ? path.join(MATRIX_DIR, hit) : null;
};

app.get("/api/matrix/row/:asset", (req, res) => {
  try {
    const fp = _matrixFile(req.params.asset);
    if (!fp) return res.status(404).json({ error: "ASSET_INCONNU" });
    const lines = fs.readFileSync(fp, "utf8").split(/\r?\n/).filter((l) => l.trim().length > 5);
    if (lines.length < 2) return res.status(404).json({ error: "CSV_VIDE" });
    const header = lines[0].split(";").map((s) => s.trim());
    const total = lines.length - 1;
    const iTs = header.indexOf("ts_utc");

    let idx = total - 1;                                  // défaut = dernière ligne
    if (req.query.ts != null && iTs >= 0) {
      const want = String(req.query.ts);
      const found = lines.findIndex((l, k) => k > 0 && (l.split(";")[iTs] ?? "") >= want);
      idx = found > 0 ? found - 1 : total - 1;
    } else if (req.query.i != null) {
      const n = Number(req.query.i);
      if (Number.isFinite(n)) idx = Math.max(0, Math.min(total - 1, Math.trunc(n)));
    }

    const cells = lines[idx + 1].split(";");
    const row = {};
    header.forEach((h, k) => { row[h] = cells[k] ?? ""; });
    // Bornes du dataset : l'UI en a besoin pour borner son sélecteur de date (min/max).
    const firstTs = iTs >= 0 ? (lines[1].split(";")[iTs] ?? null) : null;
    const lastTs = iTs >= 0 ? (lines[total].split(";")[iTs] ?? null) : null;
    res.json({ asset: path.basename(fp, ".csv"), index: idx, total, firstTs, lastTs, row });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// Couple TP/SL de l'actif (SSOT TpSlConfig). L'UI s'en sert pour PRÉREMPLIR ses champs au changement
//   d'actif : sans ça elle enverrait son 0,65/1,95 en dur et écraserait silencieusement la config.
app.get("/api/matrix/tpsl/:asset", (req, res) => {
  const asset = String(req.params.asset).toUpperCase().replace(/[^A-Z0-9_]/g, "");
  res.json({ asset, ...getTpSl(asset) });
});

app.get("/api/matrix/run/:asset", (req, res) => {
  try {
    const asset = String(req.params.asset).toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const csvPath = path.join(MATRIX_DIR, `${asset}.csv`);
    if (!fs.existsSync(csvPath)) return res.status(404).json({ error: `CSV introuvable: ${asset}` });
    const result = runMatrixBacktest(csvPath, {
      tpAtr: req.query.tpAtr, slAtr: req.query.slAtr, maxOpen: req.query.maxOpen,
      cadenceMin: req.query.cadenceMin, maxHoldMin: req.query.maxHoldMin,
      admission: req.query.admission === "false" ? false : undefined,
      // 🔬 `?spacing=false` — DESACTIVE le position spacing ET le cap `maxOpen`. Existait dans
      //   `runMatrixBacktest` sans etre joignable par l'API, donc inutilisable depuis les stats.
      // ⭐⭐ POURQUOI LE PROTOCOLE V3 EN A BESOIN : avec le moteur eteint + bonus de test, TOUTE
      //   barre du socle tire. Le carnet depasse alors en permanence les 30 places (8 par actif) et
      //   ce n'est plus la FIGURE qui decide d'entrer, c'est l'ORDRE D'ARRIVEE. Une figure rare
      //   n'obtiendrait presque jamais de place — le biais frapperait CHAQUE axe a la fois.
      // ⚠ DEFAUT INCHANGE (spacing ACTIF) : sans le parametre, le run reproduit la reference.
      spacing: req.query.spacing === "false" ? false : undefined,
      // ⭐ `?chargeSpread=true` — facture le spread historique de la barre (BUY rempli à l'ASK,
      //   SELL au BID, SL/TP recalculés depuis le remplissage, cf. `Neo_TradeExecutor.mq5`).
      //   ⚠ OPT-IN, et le défaut reste `undefined` : sans le paramètre, le run reproduit la
      //   référence AU BIT PRÈS. C'est ce qui rend les deux modes comparables.
      chargeSpread: req.query.chargeSpread === "true" ? true : undefined,
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: String(e.stack || e.message || e) }); }
});

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