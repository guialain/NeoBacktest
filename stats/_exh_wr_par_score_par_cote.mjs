// _exh_wr_par_score_par_cote.mjs — LE SCORE EXH TRIE-T-IL, ET AUSSI BIEN DES DEUX COTES ?
//
// ⭐⭐⭐ PREREQUIS NOMME : l'entree ⑧ `kdM15` (11/08) a porte l'etendue de la conviction EXH de 73 a
//   89. `MIN_EXH = 10` a ete pose sur l'ANCIENNE echelle — il ne designe plus le meme point de
//   fonctionnement. « On n'a pas resserre le tri 3 fois, on a RELEVE LE SEUIL 3 fois sans le dire. »
//
// ⭐⭐ ET C'EST UN TEST DE MIROIR AUTANT QU'UN BALAYAGE. `conviction` est ORIENTEE (`orient` rend
//   `−v` pour un SELL) : une meme note doit valoir LA MEME CHOSE en BUY et en SELL. Si les colonnes
//   divergent, ce n'est pas « le SELL paie moins » — c'est que la note ne mesure pas la meme chose
//   selon le cote. ⚠ Deja vu cote PB le 11/08 : BUY +57,6 R contre SELL −55,8 R a volume egal.
//
// ⚠⚠ ON NE FILTRE AUCUNE CASE PAR EFFECTIF (owner 11/08) : ecarter les cases peu peuplees retire les
//   QUEUES, rares PAR CONSTRUCTION — selection CORRELEE a la variable testee. On REGROUPE en bandes,
//   on ne jette pas. Les effectifs (`grap`) sont AFFICHES partout pour que le lecteur juge lui-meme.
//
// ⚠ `MIN_EXH` TRES BAS ⇒ tout le rang ① tire, y compris les convictions negatives : c'est le seul
//   moyen de voir la courbe ENTIERE. Conditionner sur un seuil ne montrerait que sa moitie haute —
//   le collider que ce depot documente partout.
// ⚠ `MIN_PB` / `MIN_CONT` restent a 1000 : SEUL L'EXH TIRE. Sans ca, les rangs ② et ③ prendraient
//   des creneaux et la population EXH ne serait plus celle qu'on croit mesurer.
// ⚠ `exh-present-empeche` reste ACTIF, et c'est neutre ici : une barre empechee ne peut pas devenir
//   un deal EXH de toute facon — la regle ne change que ce qu'elle devient APRES (DROP ou cession).
// ⚠ Une voix par grappe actif×jour — les tirs ne sont pas independants (sigma gonfle x9).
// ⚠ Point mort 75,0 % (spread facture) : sous cette barre c'est une PERTE, pas une petite marge.
//   usage : node stats/_exh_wr_par_score_par_cote.mjs   [MIN_EXH=<n>]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.MIN_EXH = process.env.MIN_EXH ?? "-91";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = (s) => s.outcome === "WIN" || s.outcome === "LOSS";
const jour = (s) => String(s.tsMT || "").slice(0, 10).replace(/\./g, "-");
const conv = (s) => s.sc?.boxes?.exh?.conviction;
const EXH = all.filter((s) => s.strategy === "EXH" && fini(s) && Number.isFinite(conv(s)));
const BUY = EXH.filter((s) => s.side === "BUY"), SELL = EXH.filter((s) => s.side === "SELL");
const BE = 75;

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()], R = t.reduce((a, b) => a + (b.R || 0), 0);
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length, R }; };

const cell = (s) => s ? String(s.n).padStart(5) + String(s.gr).padStart(5) + s.wrg.toFixed(1).padStart(8) + "%"
                        + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(8) : "    —    —        —       —";
const ligne = (lbl, f) => {
  const b = st(BUY.filter(f)), s = st(SELL.filter(f));
  // ⚠ ECART affiche seulement si les DEUX cotes ont >= 20 grappes : en dessous il decrirait du bruit.
  //   La ligne reste AFFICHEE (on ne jette pas de case) — on refuse juste d'en tirer une conclusion.
  const ec = (b && s && b.gr >= 20 && s.gr >= 20)
    ? ((b.wrg - s.wrg >= 0 ? "+" : "") + (b.wrg - s.wrg).toFixed(1)).padStart(7) : "      ·";
  console.log("  " + lbl.padEnd(13) + cell(b) + " │" + cell(s) + " │" + ec);
};
const HEAD = () => {
  console.log("  " + " ".repeat(13) + "        B U Y          │        S E L L        │  ecart");
  console.log("  " + "score".padEnd(13) + " tirs grap  WR/grap       R │ tirs grap  WR/grap       R │ WR pts");
  console.log("  " + "─".repeat(13) + "─".repeat(27) + "┼" + "─".repeat(27) + "┼" + "─".repeat(8));
};

console.log(`\n═══ EXH · WR PAR SCORE, PAR COTE ═══  [MIN_EXH=${process.env.MIN_EXH} · MIN_PB/CONT=1000 · spread FACTURE]`);
const sb = st(BUY), ss = st(SELL);
console.log(`  ${EXH.length} tirs · BUY ${sb.n} (${sb.gr} grap) · SELL ${ss.n} (${ss.gr} grap) · point mort 75,0 %`);
const vals = EXH.map(conv);
console.log(`  conviction observee : ${Math.min(...vals)} … ${Math.max(...vals)}  (8 entrees depuis le 11/08)\n`);

console.log("  ── ① PAR BANDE DE 5 (regroupe, pas filtre) ──");
console.log("  ⚠ BANDES RESSERREES LE 11/08 : la somme par FAMILLES a divise l'echelle par 1,57");
console.log("     (`[−73·+73]` → `[−46,5·+46,5]`). Des bandes de 10 auraient lu du vide aux extremes.");
HEAD();
for (let lo = -35; lo < 35; lo += 5) {
  const hi = lo + 5;
  ligne(`[${lo} · ${hi}[`, (s) => conv(s) >= lo && conv(s) < hi);
}

console.log("\n  ── ② CUMULATIF (score ≥ v) — c'est CETTE table qui parle de `MIN_EXH` ──");
HEAD();
for (let v = -30; v <= 25; v += 5) ligne("≥ " + v, (s) => conv(s) >= v);
console.log("\n  ⚠ Un `MIN_EXH` unique se lit sur les DEUX colonnes a la fois : le depot exige de");
console.log("     CREDITER UNE REGLE DE SON COTE LE PLUS FAIBLE, pas de la moyenne des deux.\n");
