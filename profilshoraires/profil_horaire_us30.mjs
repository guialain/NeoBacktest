// profil_horaire_us30.mjs — PROFILS HORAIRES PAR RÉGIME : ADX · TICKFLOW · THETA — US_30
//
// Même forme que le profil IC : lignes = créneaux de 30 min de 08:00 à 19:00, colonnes = régimes,
// chaque ligne somme à 100 %. Distribution CONDITIONNELLE à l'heure, pas un comptage brut.
//
// ⭐ TOUTES LES BANDES VIENNENT DU MOTEUR, aucune recopie :
//     ADX      → `adxLevelBand` (ADX_BANDS [16·24·33·55], équiréparties en POPULATION)
//     THETA    → `getThetaBand` (THETA_BANDS |25/45/65|°, 7 bandes signées)
//     TICKFLOW → `computeMeanTick5s` + les percentiles de `REGIME_BASELINE_TICKFLOW_MEANT5`
//
// ⚠ FENÊTRE PLUS COURTE QUE LE PROFIL IC : l'ADX, le tickflow et theta n'existent que dans
//   data/matrix (28/06→30/07), pas dans l'export OHLC M1 (19/06→31/07). Les quatre tableaux ne
//   couvrent donc PAS le même historique — c'est écrit dans chaque onglet « Paramètres ».
//
// ⚠ Une « bougie M30 » ici = la DERNIÈRE ligne matrice du créneau (les snapshots sont ~1/min).
//   C'est l'équivalent d'une clôture de bougie, cohérent avec le profil IC.
// ⚠ Heure = heure BROKER (champ `timestamp`), comme le profil IC.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { adxLevelBand, ADX_BANDS } from "../../Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
import { getThetaBand, THETA_BANDS, computeThetaVector } from "../../Matrix-Revolution/src/components/robot/engines/config/ThetaConfig.js";
import { computeMeanTick5s, REGIME_BASELINE_TICKFLOW_MEANT5 } from "../../Matrix-Revolution/src/config/TickFlowConfig.js";

const SYM = "US_30";
const SRC = path.resolve(`data/matrix/${SYM}.csv`);
const OUT = path.dirname(fileURLToPath(import.meta.url));
const H_DEB = 8 * 60, H_FIN = 19 * 60, PAS = 30;

// Banding tickflow : la règle est documentée en tête de REGIME_BASELINE_TICKFLOW_MEANT5
//   (< p25 LOW | p25–p75 MED | p75–p95 HIGH | ≥ p95 EXPLO). Les SEUILS sont importés, pas recopiés.
const TF5 = REGIME_BASELINE_TICKFLOW_MEANT5[SYM];
if (!TF5) throw new Error(`REGIME_BASELINE_TICKFLOW_MEANT5[${SYM}] absent`);
const tickBand = (m) => m == null ? null : m < TF5.p25 ? "LOW" : m < TF5.p75 ? "MED" : m < TF5.p95 ? "HIGH" : "EXPLO";

const DIMS = [
  { cle: "ADX", titre: "ADX H1 (clôture)",
    regimes: ["EXTREME_LOW", "LOW", "MEDIUM", "HIGH", "EXTREME_HIGH"],
    lire: (r) => { const v = Number(r.adx14_h1_c1); return Number.isFinite(v) ? adxLevelBand(v) : null; },
    params: [["Colonne source", "adx14_h1_c1 (dernière CLÔTURE H1, ≡ adxClose)"],
             ["Bandes ADX_BANDS", ADX_BANDS.join(" · ")],
             ["Règle", "≥55 EXTREME_HIGH · ≥33 HIGH · ≥24 MEDIUM · ≥16 LOW · sinon EXTREME_LOW"],
             ["Note", "bandes équiréparties en POPULATION, pas en amplitude — et indépendantes du TF"]] },
  { cle: "TICKFLOW", titre: "Tickflow (meanTick5s)",
    regimes: ["LOW", "MED", "HIGH", "EXPLO"],
    lire: (r) => tickBand(computeMeanTick5s(r)),
    params: [["Quantité", "computeMeanTick5s = moyenne de tick_count_5s_s0..s4"],
             ["Percentiles US_30", `p25 ${TF5.p25} · p50 ${TF5.p50} · p75 ${TF5.p75} · p95 ${TF5.p95}`],
             ["Règle", "< p25 LOW | p25–p75 MED | p75–p95 HIGH | ≥ p95 EXPLO"],
             ["⚠ Autre échelle", "classifyTickflow (DEAD/OFF/OK/HIGH/HOT/BURST) est une échelle DIFFÉRENTE, sur d'autres percentiles"],
             ["⚠ Saisonnalité", "le tick est saisonnier : η² ≈ 0,55 sur US_30 (part de variance expliquée par l'HEURE seule)"]] },
  { cle: "THETA", titre: "Theta jour (angle)",
    regimes: ["VERTICAL_DOWN", "STEEP_DOWN", "MILD_DOWN", "FLAT", "MILD_UP", "STEEP_UP", "VERTICAL_UP"],
    lire: (r) => getThetaBand(computeThetaVector(r, SYM).thetaDayDeg),
    params: [["Quantité", "thetaDayDeg = arctan((ic / p50) / fraction_de_jour), en degrés"],
             ["Bandes |t1/t2/t3|", `${THETA_BANDS.t1}° / ${THETA_BANDS.t2}° / ${THETA_BANDS.t3}°`],
             ["Règle", "|θ| ≥65 VERTICAL · ≥45 STEEP · ≥25 MILD · sinon FLAT, signé"],
             ["Note", "theta est l'ic normalisé 2× (par le p50 de l'actif ET par l'heure) — c'est la version DÉ-RAMPÉE de l'IC"],
             ["⚠ Non calculé", "avant 01h30 de séance (theta sature) — hors de notre fenêtre 08:00-19:00"]] },
];

// ── lecture ───────────────────────────────────────────────────────────────────────────────────
const L = fs.readFileSync(SRC, "utf8").split(/\r?\n/);
const head = L[0].split(";");
// ⚠⚠ DÉCOUPAGE SUR `ts_utc`, PAS SUR `timestamp` (corrigé le 02/08). Mesuré sur US_30 : `timestamp`
//   est de l'UTC avec du jitter (médiane +13 s) MAIS **1,48 % des lignes sont périmées de plus de
//   30 min** — elles atterrissaient dans le mauvais créneau. `ts_utc` est la colonne autoritaire.
//   ℹ️ `computeThetaVector` lit quand même `row.timestamp` pour sa fraction de jour : sur ces mêmes
//   lignes theta est calculé sur une heure fausse. C'est le MOTEUR, on ne le corrige pas ici.
const iTs = head.indexOf("ts_utc");
if (iTs < 0) throw new Error("colonne `ts_utc` absente");
const jours = new Map();   // "YYYY.MM.DD" -> Map(creneau -> row)
for (let i = 1; i < L.length; i++) {
  const c = L[i].split(";"); if (c.length < head.length) continue;
  const d = new Date(c[iTs]); if (Number.isNaN(d.getTime())) continue;
  const min = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (min < H_DEB || min >= H_FIN) continue;
  const deb = H_DEB + Math.floor((min - H_DEB) / PAS) * PAS;
  const jour = c[iTs].slice(0, 10).replace(/-/g, ".");
  const row = {}; for (let k = 0; k < head.length; k++) row[head[k]] = c[k];
  // dernière ligne du créneau = « clôture » : le fichier est chronologique, on écrase.
  (jours.get(jour) ?? jours.set(jour, new Map()).get(jour)).set(deb, row);
}
const jourSemaine = (j) => new Date(`${j.replace(/\./g, "-")}T12:00:00Z`).getUTCDay();
const tous = [...jours.keys()].sort();
const ouvres = tous.filter((j) => jourSemaine(j) !== 0 && jourSemaine(j) !== 6);
const weekend = tous.filter((j) => jourSemaine(j) === 0 || jourSemaine(j) === 6);

const creneaux = []; for (let m = H_DEB; m < H_FIN; m += PAS) creneaux.push(m);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const lib = (m) => `${hhmm(m)}-${hhmm(m + PAS)}`;

console.log(`Source     : ${SRC}`);
console.log(`Historique : ${tous[0]} → ${tous[tous.length - 1]} · ${ouvres.length} jours ouvrés`
  + (weekend.length ? ` · ${weekend.length} week-end EXCLUS (flux gelé)` : " · aucun week-end"));

// ── XLS (SpreadsheetML 2003, convention stats/) ───────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cN = (v, st) => `<Cell${st ? ` ss:StyleID="${st}"` : ""}><Data ss:Type="Number">${v}</Data></Cell>`;
const cS = (v, st) => `<Cell${st ? ` ss:StyleID="${st}"` : ""}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
const feuille = (nom, rows) =>
  `<Worksheet ss:Name="${esc(nom)}"><Table>\n${rows.map((r) => `<Row>${r}</Row>`).join("\n")}\n</Table>`
  + `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/>`
  + `<SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>`
  + `</WorksheetOptions></Worksheet>`;
const STYLES = `<Styles>\r\n`
  + `<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>\r\n`
  + `<Style ss:ID="sHead"><Font ss:FontName="Calibri" ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>\r\n`
  + `<Style ss:ID="sLbl"><Font ss:FontName="Consolas"/></Style>\r\n`
  // ⭐ format 0.00"%" : le « % » est AFFICHÉ mais la cellule reste NUMÉRIQUE (0-100).
  //   `0.00%` d'Excel multiplierait par 100 — ce n'est pas ce qu'on veut, nos valeurs sont déjà en %.
  + `<Style ss:ID="sPct"><NumberFormat ss:Format="0.00&quot;%&quot;"/></Style>\r\n`
  + `<Style ss:ID="sTot"><Font ss:FontName="Consolas" ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/></Style>\r\n`
  + `<Style ss:ID="sTotN"><Font ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/><NumberFormat ss:Format="0.00&quot;%&quot;"/></Style>\r\n`
  + `<Style ss:ID="sTotI"><Font ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/></Style>\r\n`
  + `</Styles>\r\n`;

for (const dim of DIMS) {
  const R = dim.regimes;
  const compte = new Map(creneaux.map((m) => [m, Object.fromEntries(R.map((r) => [r, 0]))]));
  let nul = 0, tot = 0;
  for (const j of ouvres) {
    const parCreneau = jours.get(j);
    for (const deb of creneaux) {
      const row = parCreneau.get(deb); if (!row) continue;
      const b = dim.lire(row);
      if (b == null || !R.includes(b)) { nul++; continue; }
      compte.get(deb)[b]++; tot++;
    }
  }
  const pct = (n, d) => (d > 0 ? n / d * 100 : 0);
  const lignes = creneaux.map((m) => {
    const c = compte.get(m), n = R.reduce((a, r) => a + c[r], 0);
    return { label: lib(m), n, pct: R.map((r) => pct(c[r], n)), brut: R.map((r) => c[r]) };
  });
  const sum = Object.fromEntries(R.map((r) => [r, creneaux.reduce((a, m) => a + compte.get(m)[r], 0)]));
  const nT = R.reduce((a, r) => a + sum[r], 0);
  const ligneT = { label: "TOTAL", n: nT, pct: R.map((r) => pct(sum[r], nT)), brut: R.map((r) => sum[r]) };

  console.log(`\n${"=".repeat(70)}\n=== ${dim.titre} — ${SYM} · ${tot} observations` + (nul ? ` · ${nul} non classées` : "") + `\n${"=".repeat(70)}`);
  const md = [`| Créneau | ${R.map((r) => `${r} %`).join(" | ")} | n |`,
              `|---|${R.map(() => "---:").join("|")}|---:|`];
  for (const l of [...lignes, ligneT]) md.push(`| ${l.label} | ${l.pct.map((p) => `${p.toFixed(2)} %`).join(" | ")} | ${l.n} |`);
  console.log(md.join("\n"));

  const csv = [`Creneau;${R.map((r) => `${r} %`).join(";")};n`,
    ...[...lignes, ligneT].map((l) => `${l.label};${l.pct.map((p) => p.toFixed(2).replace(".", ",")).join(";")};${l.n}`)];
  const base = path.join(OUT, `profil_${dim.cle.toLowerCase()}_${SYM}`);
  fs.writeFileSync(`${base}.csv`, csv.join("\r\n") + "\r\n", "utf8");
  fs.writeFileSync(`${base}.md`, md.join("\n") + "\n", "utf8");

  const hdr = (cols) => cols.map((c) => cS(c, "sHead")).join("");
  const f1 = [hdr(["Créneau", ...R, "n"])];
  for (const l of lignes) f1.push(cS(l.label, "sLbl") + l.pct.map((p) => cN(p.toFixed(2), "sPct")).join("") + cN(l.n));
  f1.push(cS(ligneT.label, "sTot") + ligneT.pct.map((p) => cN(p.toFixed(2), "sTotN")).join("") + cN(ligneT.n, "sTotI"));
  const f2 = [hdr(["Créneau", ...R, "n"])];
  for (const l of [...lignes, ligneT]) f2.push(cS(l.label, l.label === "TOTAL" ? "sTot" : "sLbl")
    + l.brut.map((v) => cN(v, l.label === "TOTAL" ? "sTotI" : null)).join("") + cN(l.n, l.label === "TOTAL" ? "sTotI" : null));
  const f3 = [hdr(["Paramètre", "Valeur"])];
  for (const [k, v] of [["Symbole", SYM], ["Dimension", dim.titre],
    ["Source", `data/matrix/${SYM}.csv (snapshots ~1/min, heure BROKER)`],
    ["Historique", `${tous[0]} → ${tous[tous.length - 1]}`],
    ["⚠ Fenêtre", "PLUS COURTE que le profil IC (OHLC 19/06→31/07) : ADX/tick/theta n'existent que dans la matrice"],
    ["Jours ouvrés", String(ouvres.length)], ["Week-ends exclus", String(weekend.length)],
    ["Observations classées", String(tot)], ["Non classées", String(nul)],
    ["Séance", "08:00 → 19:00, créneaux de 30 min, étiquetés par leur DÉBUT"],
    ["Bougie M30", "dernière ligne matrice du créneau (≡ clôture)"],
    ...dim.params, ["Seuils", "importés du moteur, jamais recopiés"]])
    f3.push(cS(k, "sLbl") + cS(v));

  fs.writeFileSync(`${base}.xls`,
    `<?xml version="1.0"?>\r\n<?mso-application progid="Excel.Sheet"?>\r\n`
    + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\r\n`
    + ` xmlns:o="urn:schemas-microsoft-com:office:office"\r\n xmlns:x="urn:schemas-microsoft-com:office:excel"\r\n`
    + ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\r\n xmlns:html="http://www.w3.org/TR/REC-html40">\r\n`
    + STYLES + feuille("Profil % par créneau", f1) + "\r\n" + feuille("Effectifs bruts", f2) + "\r\n"
    + feuille("Paramètres", f3) + "\r\n</Workbook>\r\n", "utf8");
  console.log(`\n→ ${path.basename(base)}.xls · .csv · .md`);
}
