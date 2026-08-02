// ic_profile_us30.mjs — PROFIL HORAIRE DE L'INTRADAY CHANGE, PAR RÉGIME — US_30
//
// Question : à quelle heure de la séance l'IC se trouve-t-il dans chacun des 7 régimes ?
// Chaque ligne (créneau de 30 min) somme à 100 % : c'est une distribution CONDITIONNELLE à l'heure,
// pas un comptage brut — sinon les créneaux les plus fournis écraseraient les autres.
//
// ⭐ SEUILS LUS DEPUIS LE MOTEUR (`INTRADAY_CONFIG`), jamais recopiés : un seuil recopié se périme
//   sans bruit le jour où la config bouge. Ils sont réaffichés en tête de sortie et écrits dans
//   l'onglet « Paramètres » du classeur, pour que le tableau reste lisible dans six mois.
//
// DÉFINITIONS, explicites parce qu'elles changent le résultat :
//   · IC(t) = (close(t) − open_du_JOUR) / open_du_JOUR × 100, cumulé depuis l'ouverture du jour.
//   · « open du jour » = ouverture de la PREMIÈRE bougie M1 de la journée (heure broker), ce qui
//     correspond à l'`open_d1_s0` que lit le moteur. ⚠ Ce n'est PAS l'ouverture de séance 08:00 :
//     l'IC de 08:00 porte donc déjà ce qui s'est passé la nuit. C'est la définition du moteur.
//   · Une bougie M30 est étiquetée par son DÉBUT (08:00 = 08:00→08:29) et son IC est pris sur sa
//     CLÔTURE.
//   · Heure = heure BROKER telle qu'elle sort de MT5 (le champ `time` de l'export OHLC).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { INTRADAY_CONFIG } from "../../Matrix-Revolution/src/components/robot/engines/config/IntradayConfig.js";

const SYM = "US_30";
const SRC = path.resolve("data/ohlc/ohlc_US_30_M1.csv");
const OUT = path.dirname(fileURLToPath(import.meta.url));
const H_DEB = 8 * 60, H_FIN = 19 * 60;        // séance 08:00 → 19:00, bornes en minutes
const PAS = 30;

const cfg = INTRADAY_CONFIG[SYM];
if (!cfg) throw new Error(`INTRADAY_CONFIG[${SYM}] introuvable`);
const { extremeDown, strongDown, softDown, softUp, strongUp, extremeUp } = cfg;

const REGIMES = ["EXTREME_DOWN", "STRONG_DOWN", "SOFT_DOWN", "NEUTRE", "SOFT_UP", "STRONG_UP", "EXTREME_UP"];
const classe = (ic) =>
  ic < extremeDown ? "EXTREME_DOWN" :
  ic < strongDown ? "STRONG_DOWN" :
  ic < softDown ? "SOFT_DOWN" :
  ic < softUp ? "NEUTRE" :
  ic < strongUp ? "SOFT_UP" :
  ic < extremeUp ? "STRONG_UP" : "EXTREME_UP";

// ── lecture M1 ────────────────────────────────────────────────────────────────────────────────
const L = fs.readFileSync(SRC, "utf8").split(/\r?\n/);
const h = L[0].split(";");
const [iT, iO, iC] = ["time", "open", "close"].map((k) => h.indexOf(k));
if (iT < 0 || iO < 0 || iC < 0) throw new Error(`colonnes attendues time;open;close — vu : ${h.join(";")}`);

const jours = new Map();   // "YYYY.MM.DD" -> { open, bougies: Map(minuteDuJour -> close) }
for (let i = 1; i < L.length; i++) {
  const c = L[i].split(";"); if (c.length < 5) continue;
  const m = /^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/.exec(c[iT]); if (!m) continue;
  const jour = `${m[1]}.${m[2]}.${m[3]}`;
  const min = Number(m[4]) * 60 + Number(m[5]);
  const o = Number(c[iO]), cl = Number(c[iC]);
  if (!Number.isFinite(o) || !Number.isFinite(cl)) continue;
  let d = jours.get(jour);
  // ⚠ open du jour = PREMIÈRE bougie rencontrée. Le fichier est chronologique ; on ne se fie pas à
  //   l'existence d'une bougie 00:00 (jours partiels en début et fin d'export).
  if (!d) { d = { open: o, premiere: min, bougies: new Map(), n: 0 }; jours.set(jour, d); }
  d.bougies.set(min, cl); d.n++;
}

// ── diagnostic : le week-end est un FLUX GELÉ, il fausserait la colonne NEUTRE ─────────────────
const jourSemaine = (j) => new Date(`${j.replace(/\./g, "-")}T12:00:00Z`).getUTCDay();
const tous = [...jours.keys()].sort();
const weekend = tous.filter((j) => jourSemaine(j) === 0 || jourSemaine(j) === 6);
const ouvres = tous.filter((j) => !(jourSemaine(j) === 0 || jourSemaine(j) === 6));

console.log(`Source   : ${SRC}`);
console.log(`Historique : ${tous[0]} → ${tous[tous.length - 1]} · ${tous.length} jours civils`);
console.log(`  jours ouvrés ${ouvres.length} · week-end ${weekend.length}`
  + (weekend.length ? ` (${weekend.join(", ")}) — EXCLUS : flux gelé` : ""));
const partiels = ouvres.filter((j) => jours.get(j).premiere > H_DEB);
if (partiels.length) console.log(`  ⚠ ${partiels.length} jour(s) dont la 1re bougie est APRÈS 08:00 : ${partiels.join(", ")}`
  + ` — leur « open du jour » n'est pas une vraie ouverture, ils ne contribuent qu'aux créneaux qu'ils couvrent`);
console.log(`\nSeuils INTRADAY_CONFIG['${SYM}'] (lus dans le moteur) :`);
console.log(`  extremeDown ${extremeDown} · strongDown ${strongDown} · softDown ${softDown}`
  + ` | softUp ${softUp} · strongUp ${strongUp} · extremeUp ${extremeUp}`);

// ── agrégation M1 → M30, puis comptage par créneau × régime ───────────────────────────────────
const creneaux = [];
for (let m = H_DEB; m < H_FIN; m += PAS) creneaux.push(m);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const libelle = (m) => `${hhmm(m)}-${hhmm(m + PAS)}`;

const compte = new Map(creneaux.map((m) => [m, Object.fromEntries(REGIMES.map((r) => [r, 0]))]));
let nBougies = 0;
for (const j of ouvres) {
  const d = jours.get(j);
  if (!(d.open > 0)) continue;
  for (const deb of creneaux) {
    // clôture de la bougie M30 = dernière M1 présente dans [deb, deb+30)
    let cl = null;
    for (let k = deb + PAS - 1; k >= deb; k--) { const v = d.bougies.get(k); if (v != null) { cl = v; break; } }
    if (cl == null) continue;                       // créneau non couvert ce jour-là
    const ic = (cl - d.open) / d.open * 100;
    compte.get(deb)[classe(ic)]++; nBougies++;
  }
}

// ── rendu ─────────────────────────────────────────────────────────────────────────────────────
const total = Object.fromEntries(REGIMES.map((r) => [r, 0]));
for (const m of creneaux) for (const r of REGIMES) total[r] += compte.get(m)[r];
const pct = (n, d) => (d > 0 ? (n / d * 100) : 0);

const lignes = creneaux.map((m) => {
  const c = compte.get(m), n = REGIMES.reduce((a, r) => a + c[r], 0);
  return { label: libelle(m), n, pct: REGIMES.map((r) => pct(c[r], n)), brut: REGIMES.map((r) => c[r]) };
});
const nTot = REGIMES.reduce((a, r) => a + total[r], 0);
const ligneTotal = { label: "TOTAL", n: nTot, pct: REGIMES.map((r) => pct(total[r], nTot)),
                     brut: REGIMES.map((r) => total[r]) };

console.log(`\n${nBougies} bougies M30 classées · ${ouvres.length} jours ouvrés\n`);
const md = [`| Créneau | ${REGIMES.map((r) => `${r} %`).join(" | ")} | n |`,
            `|---|${REGIMES.map(() => "---:").join("|")}|---:|`];
for (const l of [...lignes, ligneTotal]) md.push(`| ${l.label} | ${l.pct.map((p) => `${p.toFixed(2)} %`).join(" | ")} | ${l.n} |`);
console.log(md.join("\n"));

// ── CSV ───────────────────────────────────────────────────────────────────────────────────────
// ⚠ Le « % » est dans l'EN-TÊTE, pas dans les cellules : une cellule « 12,34 % » cesserait d'être
//   un nombre pour tout consommateur du CSV. Dans le XLS il est affiché par le FORMAT, donc la
//   cellule reste numérique — c'est la seule façon d'avoir les deux.
const csv = [`Creneau;${REGIMES.map((r) => `${r} %`).join(";")};n`,
  ...[...lignes, ligneTotal].map((l) => `${l.label};${l.pct.map((p) => p.toFixed(2).replace(".", ",")).join(";")};${l.n}`)];
fs.writeFileSync(path.join(OUT, `profil_ic_${SYM}.csv`), csv.join("\r\n") + "\r\n", "utf8");
fs.writeFileSync(path.join(OUT, `profil_ic_${SYM}.md`), md.join("\n") + "\n", "utf8");

// ── XLS (SpreadsheetML 2003 — la convention déjà utilisée dans stats/) ────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cellN = (v, st) => `<Cell${st ? ` ss:StyleID="${st}"` : ""}><Data ss:Type="Number">${v}</Data></Cell>`;
const cellS = (v, st) => `<Cell${st ? ` ss:StyleID="${st}"` : ""}><Data ss:Type="String">${esc(v)}</Data></Cell>`;
const feuille = (nom, rows) =>
  `<Worksheet ss:Name="${esc(nom)}"><Table>\n${rows.map((r) => `<Row>${r}</Row>`).join("\n")}\n</Table>`
  + `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/>`
  + `<SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>`
  + `</WorksheetOptions></Worksheet>`;

const enTete = (cols) => cellS(cols[0], "sHead") + cols.slice(1).map((c) => cellS(c, "sHead")).join("");
const f1 = [enTete(["Créneau", ...REGIMES, "n"])];
for (const l of lignes) f1.push(cellS(l.label, "sLbl") + l.pct.map((p) => cellN(p.toFixed(2), "sPct")).join("") + cellN(l.n));
f1.push(cellS(ligneTotal.label, "sTot") + ligneTotal.pct.map((p) => cellN(p.toFixed(2), "sTotN")).join("") + cellN(ligneTotal.n, "sTotN"));

const f2 = [enTete(["Créneau", ...REGIMES, "n"])];
for (const l of [...lignes, ligneTotal]) f2.push(cellS(l.label, l.label === "TOTAL" ? "sTot" : "sLbl")
  + l.brut.map((v) => cellN(v)).join("") + cellN(l.n));

const f3 = [enTete(["Paramètre", "Valeur"])];
for (const [k, v] of [["Symbole", SYM], ["Source", "data/ohlc/ohlc_US_30_M1.csv (M1, heure broker)"],
  ["Historique", `${tous[0]} → ${tous[tous.length - 1]}`], ["Jours ouvrés retenus", String(ouvres.length)],
  ["Week-ends exclus", String(weekend.length)], ["Bougies M30 classées", String(nBougies)],
  ["Séance", "08:00 → 19:00, créneaux de 30 min, étiquetés par leur DÉBUT"],
  ["IC", "(close − open du JOUR) / open du JOUR × 100"],
  ["open du jour", "1re bougie M1 de la journée = open_d1_s0 du moteur (PAS l'ouverture de séance)"],
  ["extremeDown", String(extremeDown)], ["strongDown", String(strongDown)], ["softDown", String(softDown)],
  ["softUp", String(softUp)], ["strongUp", String(strongUp)], ["extremeUp", String(extremeUp)],
  ["Seuils", "lus dans INTRADAY_CONFIG du moteur, non recopiés"]])
  f3.push(cellS(k, "sLbl") + cellS(v));

const xls = `<?xml version="1.0"?>\r\n<?mso-application progid="Excel.Sheet"?>\r\n`
  + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\r\n`
  + ` xmlns:o="urn:schemas-microsoft-com:office:office"\r\n`
  + ` xmlns:x="urn:schemas-microsoft-com:office:excel"\r\n`
  + ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\r\n`
  + ` xmlns:html="http://www.w3.org/TR/REC-html40">\r\n`
  + `<Styles>\r\n`
  + `<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>\r\n`
  + `<Style ss:ID="sHead"><Font ss:FontName="Calibri" ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>\r\n`
  + `<Style ss:ID="sLbl"><Font ss:FontName="Consolas"/></Style>\r\n`
  + `<Style ss:ID="sPct"><NumberFormat ss:Format="0.00&quot;%&quot;"/></Style>\r\n`
  + `<Style ss:ID="sTot"><Font ss:FontName="Consolas" ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/></Style>\r\n`
  + `<Style ss:ID="sTotN"><Font ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/><NumberFormat ss:Format="0.00&quot;%&quot;"/></Style>\r\n`
  + `</Styles>\r\n`
  + feuille("Profil % par créneau", f1) + "\r\n" + feuille("Effectifs bruts", f2) + "\r\n"
  + feuille("Paramètres", f3) + "\r\n</Workbook>\r\n";
fs.writeFileSync(path.join(OUT, `profil_ic_${SYM}.xls`), xls, "utf8");

console.log(`\nÉcrit dans ${OUT} :`);
console.log(`  profil_ic_${SYM}.xls   (3 onglets : % · effectifs bruts · paramètres)`);
console.log(`  profil_ic_${SYM}.csv   (séparateur « ; », décimale « , »)`);
console.log(`  profil_ic_${SYM}.md`);
