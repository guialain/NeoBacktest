// profil_horaire_all.mjs — PROFILS HORAIRES PAR RÉGIME, LES 19 ACTIFS × 4 DIMENSIONS
//   IC · ADX H1 · Tickflow · Theta      lignes = créneaux 30 min 08:00→19:00, chaque ligne = 100 %
//
// Sortie : UN classeur par DIMENSION, un onglet par ACTIF (+ onglet Paramètres). C'est le découpage
// qui rend la comparaison entre actifs immédiate — l'inverse (un classeur par actif) obligerait à
// ouvrir 19 fichiers pour comparer une colonne.
//
// ⭐ TOUTES LES BANDES VIENNENT DU MOTEUR : INTRADAY_CONFIG · adxLevelBand · getThetaBand ·
//   computeMeanTick5s + REGIME_BASELINE_TICKFLOW_MEANT5. Aucun seuil recopié.
//
// ⚠⚠ HORLOGE — vérifié le 02/08, contre-intuitif :
//   · le champ `timestamp` de la matrice N'EST PAS une heure broker décalée, c'est de l'UTC avec du
//     jitter (médiane +13 s) — MAIS **1,48 % des lignes sont périmées de plus de 30 min** (+0,55 %
//     entre 5 et 30). ⇒ on découpe sur **`ts_utc`**, la colonne autoritaire.
//   · l'export OHLC M1 est LUI AUSSI en UTC : son amplitude high-low pique à 13h, soit l'ouverture
//     cash US (13:30 UTC en été). Les deux sources sont donc sur la même horloge.
//   ⇒ « 08:00-19:00 heure locale » = 08:00-19:00 **UTC**.
//   ℹ️ `computeThetaVector` lit `row.timestamp` pour sa fraction de jour : sur les ~1,5 % de lignes
//     périmées, theta est calculé sur une heure fausse. Comportement du MOTEUR, non corrigé ici.
//
// ⚠ FENÊTRES DIFFÉRENTES SELON LA DIMENSION : l'IC vient de l'OHLC M1 (historique long), les trois
//   autres de la matrice (plus court, ce sont les seules sources qui les portent). Comparable
//   d'un actif à l'autre DANS une dimension, pas d'une dimension à l'autre.
// ⚠ HORAIRES DE MARCHÉ : le créneau 08:00-19:00 dépasse la clôture de COCOA (≈14:48), UK_100 et
//   GERMANY_40 (17:00). Leurs derniers créneaux sont vides ou maigres — lire la colonne `n`.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { INTRADAY_CONFIG } from "../../Matrix-Revolution/src/components/robot/engines/config/IntradayConfig.js";
import { adxLevelBand, ADX_BANDS } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { getThetaBand, THETA_BANDS, computeThetaVector } from "../../Matrix-Revolution/src/components/robot/engines/config/ThetaConfig.js";
import { computeMeanTick5s, REGIME_BASELINE_TICKFLOW_MEANT5 } from "../../Matrix-Revolution/src/config/TickFlowConfig.js";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const H_DEB = 8 * 60, H_FIN = 19 * 60, PAS = 30;
const creneaux = []; for (let m = H_DEB; m < H_FIN; m += PAS) creneaux.push(m);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const lib = (m) => `${hhmm(m)}-${hhmm(m + PAS)}`;
const jourSem = (j) => new Date(`${j.replace(/\./g, "-")}T12:00:00Z`).getUTCDay();
const ouvre = (j) => jourSem(j) !== 0 && jourSem(j) !== 6;

const ASSETS = fs.readdirSync("data/matrix").filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

const REG_IC = ["EXTREME_DOWN", "STRONG_DOWN", "SOFT_DOWN", "NEUTRE", "SOFT_UP", "STRONG_UP", "EXTREME_UP"];
const REG_ADX = ["EXTREME_LOW", "LOW", "MEDIUM", "HIGH", "EXTREME_HIGH"];
const REG_TF = ["LOW", "MED", "HIGH", "EXPLO"];
const REG_TH = ["VERTICAL_DOWN", "STEEP_DOWN", "MILD_DOWN", "FLAT", "MILD_UP", "STEEP_UP", "VERTICAL_UP"];

// ── un actif → les 4 comptages ────────────────────────────────────────────────────────────────
const vide = (R) => new Map(creneaux.map((m) => [m, Object.fromEntries(R.map((r) => [r, 0]))]));
const notes = [];

function lireMatrice(sym) {
  const L = fs.readFileSync(path.join("data/matrix", `${sym}.csv`), "utf8").split(/\r?\n/);
  const head = L[0].split(";");
  const iU = head.indexOf("ts_utc");
  const parJour = new Map();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < head.length) continue;
    const d = new Date(c[iU]); if (Number.isNaN(d.getTime())) continue;
    const min = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (min < H_DEB || min >= H_FIN) continue;
    const jour = c[iU].slice(0, 10).replace(/-/g, ".");
    if (!ouvre(jour)) continue;
    const deb = H_DEB + Math.floor((min - H_DEB) / PAS) * PAS;
    const row = {}; for (let k = 0; k < head.length; k++) row[head[k]] = c[k];
    (parJour.get(jour) ?? parJour.set(jour, new Map()).get(jour)).set(deb, row);   // dernière = clôture
  }
  return parJour;
}

function lireOhlc(sym) {
  const fp = path.join("data/ohlc", `ohlc_${sym}_M1.csv`);
  if (!fs.existsSync(fp)) return null;
  const L = fs.readFileSync(fp, "utf8").split(/\r?\n/);
  const h = L[0].split(";");
  const [iT, iO, iC] = ["time", "open", "close"].map((k) => h.indexOf(k));
  const jours = new Map();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < 5) continue;
    const m = /^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/.exec(c[iT]); if (!m) continue;
    const jour = `${m[1]}.${m[2]}.${m[3]}`; if (!ouvre(jour)) continue;
    const min = Number(m[4]) * 60 + Number(m[5]);
    const o = Number(c[iO]), cl = Number(c[iC]);
    if (!Number.isFinite(o) || !Number.isFinite(cl)) continue;
    let d = jours.get(jour);
    if (!d) { d = { open: o, bougies: new Map() }; jours.set(jour, d); }
    d.bougies.set(min, cl);
  }
  return jours;
}

function profils(sym) {
  const res = {};
  // ── IC (OHLC) ──
  const cfg = INTRADAY_CONFIG[sym] ?? INTRADAY_CONFIG.default;
  if (!INTRADAY_CONFIG[sym]) notes.push(`${sym} : pas d'entrée INTRADAY_CONFIG → seuils DEFAULT`);
  const ohlc = lireOhlc(sym);
  const cIC = vide(REG_IC); let jIC = new Set();
  if (ohlc) {
    for (const [j, d] of ohlc) {
      if (!(d.open > 0)) continue;
      for (const deb of creneaux) {
        let cl = null;
        for (let k = deb + PAS - 1; k >= deb; k--) { const v = d.bougies.get(k); if (v != null) { cl = v; break; } }
        if (cl == null) continue;
        const ic = (cl - d.open) / d.open * 100;
        const b = ic < cfg.extremeDown ? "EXTREME_DOWN" : ic < cfg.strongDown ? "STRONG_DOWN"
          : ic < cfg.softDown ? "SOFT_DOWN" : ic < cfg.softUp ? "NEUTRE" : ic < cfg.strongUp ? "SOFT_UP"
          : ic < cfg.extremeUp ? "STRONG_UP" : "EXTREME_UP";
        cIC.get(deb)[b]++; jIC.add(j);
      }
    }
  } else notes.push(`${sym} : aucun fichier OHLC → pas de profil IC`);
  res.IC = { compte: cIC, jours: jIC.size, seuils: cfg };

  // ── ADX / TICKFLOW / THETA (matrice) ──
  const mat = lireMatrice(sym);
  const TF5 = REGIME_BASELINE_TICKFLOW_MEANT5[sym];
  if (!TF5) notes.push(`${sym} : pas de baseline tickflow → colonne vide`);
  else if (!(TF5.p25 > 0)) notes.push(`${sym} : baseline tickflow p25 = ${TF5.p25} ⇒ la bande LOW est INATTEIGNABLE par construction`);
  const tb = (m) => (!TF5 || m == null) ? null : m < TF5.p25 ? "LOW" : m < TF5.p75 ? "MED" : m < TF5.p95 ? "HIGH" : "EXPLO";
  const cADX = vide(REG_ADX), cTF = vide(REG_TF), cTH = vide(REG_TH);
  const jM = new Set();
  for (const [j, parCr] of mat) for (const deb of creneaux) {
    const row = parCr.get(deb); if (!row) continue; jM.add(j);
    const a = Number(row.adx14_h1_c1);
    const ba = Number.isFinite(a) ? adxLevelBand(a) : null; if (ba) cADX.get(deb)[ba]++;
    const bt = tb(computeMeanTick5s(row)); if (bt) cTF.get(deb)[bt]++;
    const bh = getThetaBand(computeThetaVector(row, sym).thetaDayDeg); if (bh) cTH.get(deb)[bh]++;
  }
  res.ADX = { compte: cADX, jours: jM.size };
  res.TICKFLOW = { compte: cTF, jours: jM.size, tf5: TF5 };
  res.THETA = { compte: cTH, jours: jM.size };
  return res;
}

console.log(`Calcul sur ${ASSETS.length} actifs…`);
const tout = {};
for (const s of ASSETS) { process.stdout.write(`  ${s}\r`); tout[s] = profils(s); }
console.log(" ".repeat(30));
if (notes.length) { console.log("Remarques :"); for (const n of notes) console.log(`  ⚠ ${n}`); }

// ── rendu ─────────────────────────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cN = (v, st) => `<Cell${st ? ` ss:StyleID="${st}"` : ""}><Data ss:Type="Number">${v}</Data></Cell>`;
const cS = (v, st) => `<Cell${st ? ` ss:StyleID="${st}"` : ""}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
const feuille = (nom, rows) => `<Worksheet ss:Name="${esc(nom)}"><Table>\n${rows.map((r) => `<Row>${r}</Row>`).join("\n")}\n</Table>`
  + `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/>`
  + `<SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions></Worksheet>`;
// 0.00"%" : le signe est AFFICHÉ, la cellule reste NUMÉRIQUE. `0.00%` d'Excel multiplierait par 100.
const STYLES = `<Styles>\r\n`
  + `<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>\r\n`
  + `<Style ss:ID="sHead"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>\r\n`
  + `<Style ss:ID="sLbl"><Font ss:FontName="Consolas"/></Style>\r\n`
  + `<Style ss:ID="sPct"><NumberFormat ss:Format="0.00&quot;%&quot;"/></Style>\r\n`
  + `<Style ss:ID="sTot"><Font ss:FontName="Consolas" ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/></Style>\r\n`
  + `<Style ss:ID="sTotN"><Font ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/><NumberFormat ss:Format="0.00&quot;%&quot;"/></Style>\r\n`
  + `<Style ss:ID="sTotI"><Font ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/></Style>\r\n</Styles>\r\n`;

const DIMS = [
  { cle: "IC", titre: "Intraday Change", R: REG_IC, src: "data/ohlc/ohlc_<SYM>_M1.csv (M1 → M30)" },
  { cle: "ADX", titre: "ADX H1 (clôture)", R: REG_ADX, src: "data/matrix/<SYM>.csv, colonne adx14_h1_c1" },
  { cle: "TICKFLOW", titre: "Tickflow (meanTick5s)", R: REG_TF, src: "data/matrix/<SYM>.csv, tick_count_5s_s0..s4" },
  { cle: "THETA", titre: "Theta jour (angle)", R: REG_TH, src: "data/matrix/<SYM>.csv → computeThetaVector" },
];

for (const dim of DIMS) {
  const R = dim.R;
  const onglets = [], csv = [`Actif;Creneau;${R.map((r) => `${r} %`).join(";")};n`], md = [`# ${dim.titre} — profil horaire par régime\n`];
  for (const sym of ASSETS) {
    const { compte, jours } = tout[sym][dim.cle];
    const lignes = creneaux.map((m) => {
      const c = compte.get(m), n = R.reduce((a, r) => a + c[r], 0);
      return { l: lib(m), n, p: R.map((r) => n > 0 ? c[r] / n * 100 : 0), b: R.map((r) => c[r]) };
    });
    const sum = Object.fromEntries(R.map((r) => [r, creneaux.reduce((a, m) => a + compte.get(m)[r], 0)]));
    const nT = R.reduce((a, r) => a + sum[r], 0);
    const T = { l: "TOTAL", n: nT, p: R.map((r) => nT > 0 ? sum[r] / nT * 100 : 0), b: R.map((r) => sum[r]) };

    const rows = [cS("Créneau", "sHead") + R.map((r) => cS(r, "sHead")).join("") + cS("n", "sHead")];
    for (const l of lignes) rows.push(cS(l.l, "sLbl") + l.p.map((p) => cN(p.toFixed(2), "sPct")).join("") + cN(l.n));
    rows.push(cS(T.l, "sTot") + T.p.map((p) => cN(p.toFixed(2), "sTotN")).join("") + cN(T.n, "sTotI"));
    onglets.push(feuille(sym.slice(0, 31), rows));

    for (const l of [...lignes, T]) csv.push(`${sym};${l.l};${l.p.map((p) => p.toFixed(2).replace(".", ",")).join(";")};${l.n}`);
    md.push(`## ${sym} — ${jours} jours ouvrés · ${nT} obs\n`);
    md.push(`| Créneau | ${R.map((r) => `${r} %`).join(" | ")} | n |`, `|---|${R.map(() => "---:").join("|")}|---:|`);
    for (const l of [...lignes, T]) md.push(`| ${l.l} | ${l.p.map((p) => `${p.toFixed(2)} %`).join(" | ")} | ${l.n} |`);
    md.push("");
  }
  const par = [cS("Paramètre", "sHead") + cS("Valeur", "sHead")];
  const lignesPar = [["Dimension", dim.titre], ["Source", dim.src],
    ["Horloge", "UTC — vérifié : matrice ts_utc, et l'OHLC pique à 13h = ouverture cash US"],
    ["⚠ timestamp", "1,48 % des lignes matrice périmées de >30 min ⇒ découpage sur ts_utc, pas timestamp"],
    ["Séance", "08:00 → 19:00 UTC, créneaux de 30 min, étiquetés par leur DÉBUT"],
    ["Bougie M30", dim.cle === "IC" ? "clôture = dernière M1 du créneau" : "dernière ligne matrice du créneau"],
    ["Week-ends", "exclus (flux gelé)"],
    ["⚠ Horaires marché", "08:00-19:00 dépasse la clôture de COCOA (~14:48), UK_100 et GERMANY_40 (17:00) — lire la colonne n"],
    ["⚠ Fenêtres", "IC vient de l'OHLC (historique long), les 3 autres de la matrice (plus court) — comparable ENTRE ACTIFS, pas entre dimensions"],
    ...(dim.cle === "IC" ? [["Seuils", "INTRADAY_CONFIG par actif (extremeDown/strongDown/softDown/softUp/strongUp/extremeUp)"],
                            ["IC", "(close − open du JOUR) / open du JOUR × 100"],
                            ["open du jour", "1re bougie M1 de la journée ≡ open_d1_s0 du moteur, PAS l'ouverture de séance"]] : []),
    ...(dim.cle === "ADX" ? [["ADX_BANDS", ADX_BANDS.join(" · ")], ["Règle", "≥55 EXTREME_HIGH · ≥33 HIGH · ≥24 MEDIUM · ≥16 LOW · sinon EXTREME_LOW"],
                             ["Note", "bandes équiréparties en POPULATION et indépendantes du TF"]] : []),
    ...(dim.cle === "TICKFLOW" ? [["Quantité", "moyenne de tick_count_5s_s0..s4"],
                                  ["Règle", "< p25 LOW | p25–p75 MED | p75–p95 HIGH | ≥ p95 EXPLO (percentiles PAR ACTIF)"],
                                  ["⚠ COCOA", "p25 = 0 ⇒ la bande LOW est inatteignable par construction"],
                                  ["⚠ Saisonnalité", "η² ≈ 0,32 en médiane sur l'univers : un tiers de la variance du tick est l'HEURE"]] : []),
    ...(dim.cle === "THETA" ? [["Bandes |t1/t2/t3|", `${THETA_BANDS.t1}° / ${THETA_BANDS.t2}° / ${THETA_BANDS.t3}°`],
                               ["Quantité", "arctan((ic / p50) / fraction_de_jour) — l'IC dé-rampé"],
                               ["ℹ️ Fraction de jour", "lue sur row.timestamp par le moteur : fausse sur les ~1,5 % de lignes périmées"]] : []),
    ["Seuils", "importés du moteur, jamais recopiés"], ["Actifs", ASSETS.join(" · ")]];
  for (const [k, v] of lignesPar) par.push(cS(k, "sLbl") + cS(v));
  onglets.push(feuille("Paramètres", par));

  const base = path.join(OUT, `profil_${dim.cle.toLowerCase()}_TOUS`);
  fs.writeFileSync(`${base}.xls`, `<?xml version="1.0"?>\r\n<?mso-application progid="Excel.Sheet"?>\r\n`
    + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office"`
    + ` xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"`
    + ` xmlns:html="http://www.w3.org/TR/REC-html40">\r\n` + STYLES + onglets.join("\r\n") + "\r\n</Workbook>\r\n", "utf8");
  fs.writeFileSync(`${base}.csv`, csv.join("\r\n") + "\r\n", "utf8");
  fs.writeFileSync(`${base}.md`, md.join("\n"), "utf8");
  console.log(`→ profil_${dim.cle.toLowerCase()}_TOUS.xls (${ASSETS.length} onglets + Paramètres) · .csv (format long) · .md`);
}

// ── récapitulatif transversal : la ligne TOTAL de chaque actif, pour comparer d'un coup d'œil ──
console.log(`\n=== TOTAL par actif — part de chaque régime sur toute la séance (%) ===`);
for (const dim of DIMS) {
  console.log(`\n-- ${dim.titre} --`);
  console.log(`${"actif".padEnd(12)} ${dim.R.map((r) => r.slice(0, 11).padStart(12)).join("")}${"n".padStart(8)}`);
  for (const sym of ASSETS) {
    const { compte } = tout[sym][dim.cle];
    const sum = dim.R.map((r) => creneaux.reduce((a, m) => a + compte.get(m)[r], 0));
    const n = sum.reduce((a, b) => a + b, 0);
    console.log(`${sym.padEnd(12)} ${sum.map((v) => (n ? (v / n * 100).toFixed(1) + " %" : "—").padStart(12)).join("")}${String(n).padStart(8)}`);
  }
}
