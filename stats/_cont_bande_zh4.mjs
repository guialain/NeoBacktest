// _cont_bande_zh4.mjs — DANS UNE BANDE DE SCORE ③, QU'EST-CE QUI SEPARE LES DEUX COTES ?
// ============================================================================================
// 🎯 LA QUESTION (owner, 20/08) : `[38·40[` porte assez de tirs pour etre lue (46 au carnet,
//   81 cote fire pour le SELL). A score EGAL, le BUY y fait 92,16 % et le SELL 62,96 % —
//   **29 points d'ecart dans la meme bande**. La decomposition par famille dit que le SELL qui
//   perd s'appuie sur `zdzH4` quasi SATURE (9,74 sur 10) la ou le BUY est a 9,14.
//   ⇒ `zdzH4` = `z H4 CLOTURE x Δz H4`, soit « le prix est loin de sa moyenne H4 ET s'en eloigne
//     encore ». On decoupe la bande sur `z H4` pour voir si la perte s'y concentre.
//
// ⚠⚠ UNE NOTE NE DIT PAS SA CASE. `zdzH4 = 9,74` peut venir d'un `z` MODERE qui pousse fort ou
//   d'un `z` EXTREME qui pousse peu — deux figures opposees, une seule note. C'est pour ca que la
//   sonde lit les DEUX ENTREES (`zH4Closed`, `dzH4`) et pas la note.
//
// ⚠ NIVEAU **FIRE** (`firedStrategy === "CONT"`), avant cadence et spacing. Le carnet en garde
//   ~31 %. ⛔ Et le spacing n'est PAS neutre : sur `[42·44[` SELL il a garde 4 barres sur 15, et
//   ce sont les mauvaises (25 % au carnet contre 80 % au fire). Un WR de carnet sur une bande
//   etroite peut donc etre l'INVERSE du WR de la bande. On lit le fire ICI, on ne melange pas.
//
// ⚠ `MIN_CONT=0` impose : sans ca les bandes basses n'existent pas. C'est un AUTRE run que la prod.
// ⚙ Usage : `node stats/_cont_bande_zh4.mjs`  ·  `BANDE=38:40`  ·  `COTE=SELL`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_CONT = process.env.MIN_CONT ?? "0";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";

const [A, B] = String(process.env.BANDE ?? "38:40").split(":").map(Number);
const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";

const T = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostBoxes: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "boxes")) {
    if (x.firedStrategy !== "CONT" || !Number.isFinite(x.cConv)) continue;
    const sc = Math.abs(x.cConv);
    if (!(sc >= A && sc < B)) continue;
    const r = p.walk({ ...x });
    if (!r || typeof r.R !== "number") continue;
    T.push({ ...x, asset, R: r.R });
  }
}

const BE = 75;
const wr = (a) => (a.length ? 100 * a.filter((t) => (t.R ?? 0) > 0).length / a.length : NaN);
const Rn = (a) => a.reduce((s, t) => s + (t.R ?? 0), 0);
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(26)}${String(a.length).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${Rn(a).toFixed(1).padStart(8)}${(Rn(a) / a.length).toFixed(4).padStart(9)}`
  : `   ${lbl.padEnd(26)}     —`;

console.log(`\n══ BANDE [${A}·${B}[ DU RANG ③ — DECOUPEE SUR \`z H4\` ══`);
console.log(`   ${T.length} tirs au niveau FIRE · point mort ${BE},00 %`);

for (const cote of ["SELL", "BUY"]) {
  const P = T.filter((t) => t.side === cote);
  if (!P.length) continue;
  console.log(`\n   ── ${cote} — ${P.length} tirs · WR ${wr(P).toFixed(2)} % · R ${Rn(P).toFixed(1)} ──`);
  console.log(`   ${"".padEnd(26)}${"tirs".padStart(6)}${"WR".padStart(10)}${"R net".padStart(8)}${"R/tir".padStart(9)}`);
  // ⭐ LE `z` ORIENTE : cote SELL, un prix LOIN SOUS sa moyenne est le meme fait qu'un prix loin
  //   AU-DESSUS cote BUY. Comparer les `z` BRUTS ferait lire deux populations opposees.
  const o = (t) => (cote === "SELL" ? -1 : 1) * (t.zH4Closed ?? NaN);
  const BANDES = [[-Infinity, 0], [0, 1.05], [1.05, 1.55], [1.55, 2.15], [2.15, 2.30], [2.30, 3.00], [3.00, Infinity]];
  for (const [lo, hi] of BANDES) {
    const a = P.filter((t) => Number.isFinite(o(t)) && o(t) >= lo && o(t) < hi);
    if (a.length) console.log(L(`z orienté [${lo === -Infinity ? "-inf" : lo.toFixed(2)}·${hi === Infinity ? "+inf" : hi.toFixed(2)}[`, a));
  }
  const muet = P.filter((t) => !Number.isFinite(o(t)));
  if (muet.length) console.log(L("z H4 ABSENT", muet));
  // ⚠⚠ LA BORNE DU VETO `h4-zscore-extreme-no-cont` EST A 3,00 DEPUIS CE MATIN (owner). Ce qui est
  //   SOUS 3,00 est donc ADMIS aujourd'hui — c'est la population que le veto laisse passer.
  const sous = P.filter((t) => Number.isFinite(o(t)) && o(t) < 3.00);
  const sur = P.filter((t) => Number.isFinite(o(t)) && o(t) >= 3.00);
  console.log(L("   ⇒ ADMIS par le veto (<3,00)", sous));
  console.log(L("   ⇒ au-dessus de 3,00", sur));
  // ⭐ ET LE COUPLE COMPLET : la table lit `z × Δz`, pas `z` seul. Un `z` eleve qui REVIENT n'est
  //   pas la meme figure qu'un `z` eleve qui POUSSE — et c'est la 2e entree qui le dit.
  const d = (t) => (cote === "SELL" ? -1 : 1) * (t.dzH4 ?? NaN);
  console.log(`   ── croise avec Δz H4 orienté ──`);
  for (const [nom, filt] of [["z≥2,15 · Δz POUSSE", (t) => o(t) >= 2.15 && d(t) > 0.20],
                             ["z≥2,15 · Δz plat/revient", (t) => o(t) >= 2.15 && d(t) <= 0.20],
                             ["z<2,15 · Δz POUSSE", (t) => o(t) < 2.15 && d(t) > 0.20],
                             ["z<2,15 · Δz plat/revient", (t) => o(t) < 2.15 && d(t) <= 0.20]])
    console.log(L(nom, P.filter((t) => Number.isFinite(o(t)) && Number.isFinite(d(t)) && filt(t))));
}
console.log(`\n   ⚠ niveau FIRE : le spacing en jette ~69 % APRES. Ces WR classent, ils ne chiffrent pas.\n`);
