// mergeSigmaH1.mjs — INJECTE `sigma_h1_s1` et `middle_h1_s1` DANS data/matrix/*.csv
//
// Entrée  : data/sigma/sigma_h1_<SYMBOL>.csv  (produit par mql5/ExportSigmaH1.mq5, `time;middle;sigma`)
// Sortie  : data/matrix/<SYMBOL>.csv, réécrit en place avec deux colonnes de plus.
//
// ⚠⚠ POST-TRAITEMENT IN-PLACE — À RÉ-APPLIQUER APRÈS TOUT `prep/buildAssetCSV.mjs`, qui écrase les
//   matrices. C'est la même contrainte que `reconstructStochFromOHLC --fill` ; elle rejoint la liste
//   des post-traitements de la recette de rebuild. Un rebuild nu vide ces colonnes SANS erreur.
//
// ⭐ APPARIEMENT — le seul point où l'on peut se tromper, donc il est écrit ici :
//   MT5 nomme une bougie par son OUVERTURE. La ligne `time=09:00` de l'export porte donc les valeurs
//   de la bougie 09:00→10:00, connues À 10:00.
//   Pour une ligne de matrice à 10:37, la dernière bougie H1 CLÔTURÉE est celle ouverte à 09:00.
//   ⇒ clé = (heure de la ligne) − 1 h.
//   ⚠ L'export est en heure BROKER (TimeToString sur le temps de barre MT5) ; les lignes de matrice
//     sont indexées par `ts_utc`. Vérifié le 02/08 : les deux horloges sont l'UTC (l'amplitude
//     high-low de l'OHLC pique à 13h = ouverture cash US). Un contrôle de recouvrement ci-dessous
//     le revérifie à chaque exécution — si le taux d'appariement s'effondre, c'est là qu'il faut
//     regarder AVANT de croire les colonnes.
import fs from "fs";
import path from "path";

const MATRIX = "data/matrix", SIGMA = "data/sigma";
const COLS = ["middle_h1_s1", "sigma_h1_s1"];

if (!fs.existsSync(SIGMA)) { console.error(`Dossier ${SIGMA} absent — copier MQL5/Files/sigma_h1_*.csv dedans.`); process.exit(1); }

let total = 0, ecrits = 0;
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const sym = f.replace(/\.csv$/i, "");
  const src = path.join(SIGMA, `sigma_h1_${sym.toUpperCase()}.csv`);
  if (!fs.existsSync(src)) { console.log(`${sym.padEnd(12)} ⚠ pas d'export sigma — ignoré`); continue; }

  // ── référence : heure d'OUVERTURE de bougie (epoch minutes) → { middle, sigma }
  const ref = new Map();
  for (const l of fs.readFileSync(src, "utf8").split(/\r?\n/).slice(1)) {
    const c = l.split(";"); if (c.length < 3) continue;
    const m = /^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/.exec(c[0].trim()); if (!m) continue;
    const ep = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`) / 60000;
    const mid = Number(c[1]), sig = Number(c[2]);
    if (Number.isFinite(ep) && Number.isFinite(mid) && Number.isFinite(sig)) ref.set(ep, { mid, sig });
  }

  const L = fs.readFileSync(path.join(MATRIX, f), "utf8").split(/\r?\n/);
  const head = L[0].split(";");
  const iU = head.indexOf("ts_utc");
  if (iU < 0) { console.log(`${sym.padEnd(12)} 🔴 colonne ts_utc absente`); continue; }
  // ⚠ IDEMPOTENT : si les colonnes existent déjà (ré-exécution), on les REMPLACE au lieu d'en
  //   ajouter une seconde paire. Un post-traitement qui duplique ses colonnes est un piège.
  const dejaLa = COLS.map((c) => head.indexOf(c));
  const nouveau = dejaLa[0] < 0;
  const out = [nouveau ? [...head, ...COLS].join(";") : L[0]];

  let n = 0, apparie = 0;
  for (let i = 1; i < L.length; i++) {
    if (!L[i].trim()) continue;
    const c = L[i].split(";"); if (c.length < head.length) continue;
    const d = new Date(c[iU]);
    let mid = "", sig = "";
    if (!Number.isNaN(d.getTime())) {
      n++;
      // dernière bougie CLÔTURÉE = celle ouverte à l'heure précédente
      const cle = Math.floor(d.getTime() / 3600000) * 60 - 60;
      const r = ref.get(cle);
      if (r) { mid = r.mid.toFixed(5); sig = r.sig.toFixed(6); apparie++; }
    }
    if (nouveau) out.push([...c, mid, sig].join(";"));
    else { c[dejaLa[0]] = mid; c[dejaLa[1]] = sig; out.push(c.join(";")); }
  }
  fs.writeFileSync(path.join(MATRIX, f), out.join("\r\n") + "\r\n", "utf8");
  const taux = n ? (100 * apparie / n) : 0;
  console.log(`${sym.padEnd(12)} ${nouveau ? "ajout " : "màj   "} ${String(apparie).padStart(6)}/${String(n).padStart(6)} lignes appariées  ${taux.toFixed(1).padStart(5)} %`
    + (taux < 90 ? "   🔴 RECOUVREMENT FAIBLE — vérifier la fenêtre d'export et l'horloge" : ""));
  total += n; ecrits += apparie;
}
console.log(`\n${ecrits}/${total} lignes renseignées (${(100 * ecrits / total).toFixed(1)} %).`);
console.log(`⚠ À RE-LANCER après chaque prep/buildAssetCSV.mjs — il écrase les matrices.`);
