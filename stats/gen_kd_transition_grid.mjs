// gen_kd_transition_grid.mjs — génère la grille VIDE du K/D Expert (transition × zone %K).
//   Sortie : stats/kd_expert_v1.xls  —  feuille SCORES à remplir + feuille FREQ (effectifs mesurés).
//   ⚠ La grille est écrite pour le cas K > D (gap positif). L'autre sens se dérive par MIROIR :
//      score(zone, t | K<D) = − SCORES[miroir(zone)][t]      (miroir : XLOW↔XHIGH, LOW↔HIGH, MID↔MID)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { kdCycleState, stochZone } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "..", "data", "matrix");
const num = (v) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const Z2L = { EXTREME_BASSE: "EXTREME_LOW", BASSE: "LOW", MID: "MID", HAUTE: "HIGH", EXTREME_HAUTE: "EXTREME_HIGH" };

const ZONES = ["EXTREME_LOW", "LOW", "MID", "HIGH", "EXTREME_HIGH"];
// Ordre de la ROUE : CROSS → DIVERGING → CONVERGING → CONTACT, STABLE hors-roue en dernier.
// ⚠ `CROSS` est ORIGINE mais PAS DESTINATION (owner 2026-07-26) : une barre dont l'état COURANT est
//   `CROSS` ne reçoit aucun score — l'expert se tait, le cross est traité en veto c3. Comme origine
//   il reste de l'information (« on vient de croiser, maintenant ça s'écarte »), pas un veto.
const FROM = ["CROSS", "DIVERGING", "CONVERGING", "CONTACT", "STABLE"];
const TO = ["DIVERGING", "CONVERGING", "CONTACT", "STABLE"];
const TRANSITIONS = FROM.flatMap((a) => TO.map((b) => `${a}→${b}`));

// ── mesure ────────────────────────────────────────────────────────────────────────────────────
const cell = {};                       // "t|zone" → n   (K > D uniquement)
const cellNeg = {};                    // "t|zone" → n   (K < D, pour contrôle de symétrie)
let n = 0, muted = 0;
for (const f of fs.readdirSync(DATA).filter((x) => x.endsWith(".csv"))) {
  const L = fs.readFileSync(path.join(DATA, f), "utf8").split(/\r?\n/);
  const H = L[0].split(";"); const ix = (k) => H.indexOf(k);
  const C = ["ts_utc", "stoch_k_h1_s0", "stoch_d_h1_s0", "stoch_k_h1_s1", "stoch_d_h1_s1", "stoch_k_h1_s2", "stoch_d_h1_s2"].map(ix);
  const seen = new Set();
  for (let i = 1; i < L.length; i++) {
    if (!L[i]) continue;
    const g = L[i].split(";"); const ts = g[C[0]]; if (!ts) continue;
    const key = ts.slice(0, 13); if (seen.has(key)) continue;
    const v = C.slice(1).map((j) => num(g[j])); if (v.some((x) => x == null)) continue;
    seen.add(key);
    const gap0 = v[0] - v[1], gap1 = v[2] - v[3], gap2 = v[4] - v[5];
    const cur = kdCycleState(gap0, gap1), prv = kdCycleState(gap1, gap2);
    const z = Z2L[stochZone(v[0])];
    if (!cur || !prv || !z || gap0 === 0) continue;
    if (cur === "CROSS") { muted++; continue; }   // état courant = cross ⇒ pas d'avis (veto c3)
    n++;
    const k = `${prv}→${cur}|${z}`;
    if (gap0 > 0) cell[k] = (cell[k] || 0) + 1; else cellNeg[k] = (cellNeg[k] || 0) + 1;
  }
}

// ── écriture SpreadsheetML ────────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cellS = (v, style) => v == null || v === ""
  ? `<Cell${style ? ` ss:StyleID="${style}"` : ""}/>`
  : (typeof v === "number"
      ? `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="Number">${v}</Data></Cell>`
      : `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="String">${esc(v)}</Data></Cell>`);
const row = (cells) => `   <Row>${cells.join("")}</Row>`;

function sheet(name, header, rows) {
  return `  <Worksheet ss:Name="${name}">
   <Table>
    <Column ss:Width="150"/>${ZONES.map(() => `<Column ss:Width="88"/>`).join("")}
${row(header.map((h, i) => cellS(h, i === 0 ? "hdrL" : "hdr")))}
${rows.join("\n")}
   </Table>
  </Worksheet>`;
}

const scoreRows = TRANSITIONS.map((t) =>
  row([cellS(t, "lbl"), ...ZONES.map((z) => cellS("", "num"))]));
const freqRows = TRANSITIONS.map((t) =>
  row([cellS(t, "lbl"), ...ZONES.map((z) => cellS(cell[`${t}|${z}`] || 0, "num"))]));
const freqNegRows = TRANSITIONS.map((t) =>
  row([cellS(t, "lbl"), ...ZONES.map((z) => cellS(cellNeg[`${t}|${z}`] || 0, "num"))]));

const HDR = ["transition  (K > D)", ...ZONES];
const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="hdr"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="hdrL"><Font ss:Bold="1"/><Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="lbl"><Font ss:Bold="1"/></Style>
  <Style ss:ID="num"><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/></Borders></Style>
 </Styles>
${sheet("SCORES", HDR, scoreRows)}
${sheet("FREQ_K_sup_D", HDR, freqRows)}
${sheet("FREQ_K_inf_D", ["transition  (K < D)", ...ZONES], freqNegRows)}
</Workbook>
`;
const out = path.join(HERE, "kd_expert_v1.xls");
fs.writeFileSync(out, xml, "utf8");
console.log("écrit :", out, " — n =", n, "barres H1 scorables ·",
  muted, "muettes (état courant = CROSS,", (muted * 100 / (n + muted)).toFixed(0) + "%)");
