// _exh_adx_x_gapdi.mjs — ADX H1 × ÉCART DI H1, croisés. Les deux appartiennent à la MÊME famille
//   (`gap · di · adx`, celle qui trie les DEUX côtés — cf. `deux_familles_capteurs`), et ils
//   mesurent deux choses différentes de la même chose : l'ADX dit COMBIEN ça pousse, le DI dit QUI
//   pousse. Le fichier `diExpert` note d'ailleurs que corr(ADX, |DI+−DI−|) = 0,604 — liés, pas
//   redondants : « en bande ADX HIGH, 8,5 % des barres ont les DI à moins de 4,5 points ».
//
// ⭐⭐ ORIENTATION — INDISPENSABLE, ET ELLE NE PORTE QUE SUR LE DI :
//   · l'ADX est une MAGNITUDE : `40` veut dire la même chose des deux côtés, aucune orientation.
//   · `diGapBand` est SIGNÉ : `STRONG_BUY` côté SELL et `STRONG_SELL` côté BUY sont LA MÊME FIGURE
//     — « le camp que ce fade prend à contre-pied domine fortement ». On replie donc le BUY sur le
//     repère du SELL, sinon chaque colonne est un demi-échantillon (faute du 06/08).
//   ⇒ Colonnes lues comme : `CONTRE` = le camp FADÉ mène · `BALANCED` = personne · `AVEC` = le camp
//     que le fade REJOINT mène déjà.
//
// ⚠ TROIS COLONNES ET NON SEPT : `STRONG`/`SOLID`/`WEAK` × 2 camps donne 7 bandes, et sur ~350
//   épisodes par côté ça fait des cases à 5-15. Le repli est imprimé AVEC le détail `STRONG+SOLID`
//   vs `WEAK` sur la colonne `CONTRE`, qui est la seule assez peuplée pour être coupée.
import fs from "fs";
import path from "path";
import { dedupeEpisodes } from "./_episodes.mjs";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
const SOCLE = String(process.env.SOCLE ?? "0") === "1";
if (SOCLE) process.env.TOUT_ADMETTRE = "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const OPTS = SOCLE ? { spacing: false, maxOpen: 100000, cadenceMin: 2, chargeSpread: true }
                   : { maxOpen: 30, cadenceMin: 2, chargeSpread: true };
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), OPTS);
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
all.sort((x, y) => x.ep - y.ep);
const ep = dedupeEpisodes(all.filter((s) => s.strategy === "EXH"))
  .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");

const jour = (s) => String(s.tsMT || "").slice(0, 10);
function gr(t) {
  const g = new Map();
  for (const s of t) { const k = `${s.asset}|${jour(s)}`;
    if (!g.has(k)) g.set(k, { w: 0, n: 0 }); const o = g.get(k); o.n++; if (s.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return v.length ? 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length : NaN;
}
const wr = (t) => (t.length ? 100 * t.filter((x) => x.outcome === "WIN").length / t.length : NaN);
const cel = (t) => (t.length ? `${String(t.length).padStart(3)} ${wr(t).toFixed(0).padStart(3)}%${gr(t).toFixed(0).padStart(4)}g` : "        ·");

// ⭐ Le camp FADÉ : un SELL prend à contre-pied les ACHETEURS, un BUY les VENDEURS.
const CAMP_FADE = { SELL: "BUY", BUY: "SELL" };
const groupeDI = (s) => {
  const b = s.diGapBandH1;
  if (b == null) return null;
  if (b === "BALANCED") return "BALANCED";
  const camp = b.endsWith("_BUY") ? "BUY" : "SELL";
  return camp === CAMP_FADE[s.side] ? "CONTRE" : "AVEC";
};
const forceDI = (s) => {                       // pour couper la colonne `CONTRE` en deux
  const b = s.diGapBandH1;
  return b == null || b === "BALANCED" ? null : (b.startsWith("WEAK") ? "WEAK" : "FORT");
};

// ⭐ `AXE=dyn` — croise l'ADX avec la DYNAMIQUE de l'ecart DI (`diGapDynH1`) au lieu de sa BANDE.
//   ⚠⚠ ET C'EST UN AXE VRAIMENT DIFFERENT, pas une variante d'ecriture : la BANDE est quasi
//   CONSTANTE sur la population EXH (`CONTRE fort` = 87 % des SELL — le routeur a deja selectionne
//   les barres ou un camp mene), donc elle ne peut rien croiser. La DYNAMIQUE, elle, se repartit.
//   ⭐ Et elle N'A PAS DE COTE : `diGapDynamics` porte sur d|DI+ - DI-|, une DISTANCE. Rien a
//   orienter — meme statut que `kdDist` et que `DIVERGING`. Les colonnes se lisent donc a
//   l'identique des deux bords.
const AXE = String(process.env.AXE ?? "bande").toLowerCase();
const COUPES = String(process.env.COUPES ?? "0,30,40,50").split(",").map(Number);
const PLAGES = COUPES.map((c, i) => [c, COUPES[i + 1] ?? Infinity]);
const lbl = ([lo, hi]) => (hi === Infinity ? `≥ ${lo}` : `${lo}-${hi}`);

console.log(`${SOCLE ? "[SOCLE]" : "[POP PROD]"} [spread FACTURÉ] [par ÉPISODE] · ADX H1 LIVE × écart DI H1` +
  `\n  colonnes : CONTRE = le camp FADÉ mène · AVEC = le camp que le fade REJOINT mène\n` +
  `  cellule : n · WR/tir · WR/grappe\n`);
for (const cote of ["SELL", "BUY"]) {
  const pop = ep.filter((s) => s.side === cote);
  console.log(`══ EXH ${cote} · réf ${pop.length} ép ${wr(pop).toFixed(1)} % (${gr(pop).toFixed(1)} %/gr) ══`);
  const COLS = AXE === "dyn"
    ? [["NARROWING", (s) => s.diGapDynH1 === "NARROWING"],
       ["STABLE",    (s) => s.diGapDynH1 === "STABLE"],
       ["WIDENING",  (s) => s.diGapDynH1 === "WIDENING"],
       ["sans dyn",  (s) => s.diGapDynH1 == null]]
    : [["CONTRE fort",   (s) => groupeDI(s) === "CONTRE" && forceDI(s) === "FORT"],
       ["CONTRE faible", (s) => groupeDI(s) === "CONTRE" && forceDI(s) === "WEAK"],
       ["BALANCED",      (s) => groupeDI(s) === "BALANCED"],
       ["AVEC",          (s) => groupeDI(s) === "AVEC"]];
  console.log("  ADX      " + COLS.map(([n]) => n.padStart(15)).join("") + "          TOTAL");
  for (const p of PLAGES) {
    const dans = pop.filter((s) => Number.isFinite(s.adxH1Live) && s.adxH1Live >= p[0] && s.adxH1Live < p[1]);
    console.log(`  ${lbl(p).padEnd(8)} ` + COLS.map(([, f]) => cel(dans.filter(f)).padStart(15)).join("") +
      `   ${cel(dans)}`);
  }
  console.log("  TOTAL    " + COLS.map(([, f]) => cel(pop.filter(f)).padStart(15)).join("") + "\n");
}
