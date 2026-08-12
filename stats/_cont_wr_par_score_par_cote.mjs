// _cont_wr_par_score_par_cote.mjs — LE SCORE CONT TRIE-T-IL, ET AUSSI BIEN DES DEUX COTES ?
//
// 🎯 PREREQUIS NOMME : le rang ③ a recu SON barema le 12/08 (`contScoringV1`, entree `RSI zone x
//   rang-sur-3`) et il a ete RALLUME (`MIN_CONT` 1000 -> 0,1). Ce `0,1` est la valeur de prod de
//   l'ANCIEN vote pondere d'experts — elle n'a JAMAIS ete balayee sur ce barema-ci, dont la
//   distribution de score est entierement differente. C'est ce que cette sonde sert a poser.
//
// ⭐⭐⭐ CE QUI DIFFERE DU JUMEAU EXH, ET CE N'EST PAS UN DETAIL DE RECOPIE. `_exh_wr_par_score_par_cote`
//   ISOLE son rang (`MIN_PB/CONT = 1000`) pour que la population EXH soit bien celle qu'on croit.
//   **ON NE PEUT PAS FAIRE PAREIL ICI, ET LE FAIRE SERAIT UNE FAUTE** : le rang ③ est le RESIDU — il
//   ne voit que ce que ① et ② lui cedent. Eteindre les deux rangs du dessus ne l'isolerait pas, ca
//   lui donnerait des barres qu'il ne recoit JAMAIS en vrai. ⇒ **les rangs ① et ② gardent leurs
//   seuils reels**, et la population mesuree est le vrai residu.
//
// ⚠⚠ CE QUE CETTE SONDE NE PEUT PAS MONTRER PROPREMENT, ET IL FAUT LE LIRE AVEC LES CHIFFRES. A
//   `MIN_CONT` tres bas, le rang ③ tire sur TOUT son residu — or il est ENORME (63,7 % des barres
//   cote BUY, mesure le 12/08). La capacite (`maxOpen 30`, `MAX_POSITIONS_PER_SYMBOL 8`, spacing)
//   SATURE, et ce qui entre alors n'est plus decide par le score seul. ⇒ les bandes basses sont
//   sous-representees par CONSTRUCTION, et un WR par bande y est un WR de survivants.
//   🔴 Consequence directe : **cette table dit si le score ORDONNE, elle ne dit pas ce que chaque
//   bande RAPPORTERAIT si on la prenait seule.** Pour ca il faudra un balayage par RE-RUN, un
//   processus par seuil, comme `_pb_seuil_balayage`.
//
// ⚠ WR PAR GRAPPE actif x jour — les tirs ne sont pas independants (sigma x9).
// ⚠ Point mort 75,0 % (spread facture) : sous cette barre c'est une PERTE.
// ⚠ Echelle du barema : `[−10 · +10]` (UNE entree a ±10). Bandes de 2, sinon on lit du vide.
//   usage : node stats/_cont_wr_par_score_par_cote.mjs   [MIN_CONT=<n>]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
// ⚠ `-11` et non `0` : conditionner sur le seuil de prod ne montrerait que la moitie haute de la
//   courbe — le collider que ce depot documente partout.
process.env.MIN_CONT = process.env.MIN_CONT ?? "-11";
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
// ⚠ `boxes.cont.conviction` est la note ORIENTEE (positif = bonne continuation de SON cote), comme
//   `boxes.pb`. Lire `sc.cont` donnerait le score SIGNE + bonus — deux grandeurs differentes.
const conv = (s) => s.sc?.boxes?.cont?.conviction;
const CONT = all.filter((s) => s.strategy === "CONT" && fini(s) && Number.isFinite(conv(s)));
const BUY = CONT.filter((s) => s.side === "BUY"), SELL = CONT.filter((s) => s.side === "SELL");

const st = (t) => { if (!t.length) return null;
  const g = new Map();
  for (const x of t) { const k = x.asset + "|" + jour(x); if (!g.has(k)) g.set(k, { w: 0, n: 0 });
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()], R = t.reduce((a, b) => a + (b.R || 0), 0);
  return { n: t.length, gr: v.length, wrg: 100 * v.reduce((a, b) => a + b.w / b.n, 0) / v.length, R }; };

const cell = (s) => s ? String(s.n).padStart(6) + String(s.gr).padStart(5) + s.wrg.toFixed(1).padStart(8) + "%"
                        + ((s.R >= 0 ? "+" : "") + s.R.toFixed(1)).padStart(9) : "     —    —        —        —";
const ligne = (lbl, f) => {
  const b = st(BUY.filter(f)), s = st(SELL.filter(f));
  // ⚠ ECART affiche seulement si les DEUX cotes ont >= 20 grappes : en dessous il decrirait du bruit.
  //   La ligne reste AFFICHEE (on ne jette pas de case) — on refuse juste d'en tirer une conclusion.
  const ec = (b && s && b.gr >= 20 && s.gr >= 20)
    ? ((b.wrg - s.wrg >= 0 ? "+" : "") + (b.wrg - s.wrg).toFixed(1)).padStart(7) : "      ·";
  console.log("  " + lbl.padEnd(13) + cell(b) + " │" + cell(s) + " │" + ec);
};
const HEAD = () => {
  console.log("  " + " ".repeat(13) + "         B U Y           │         S E L L         │  ecart");
  console.log("  " + "score".padEnd(13) + "  tirs grap  WR/grap        R │  tirs grap  WR/grap        R │ WR pts");
  console.log("  " + "─".repeat(13) + "─".repeat(29) + "┼" + "─".repeat(29) + "┼" + "─".repeat(8));
};

console.log(`\n═══ CONT · WR PAR SCORE, PAR COTE ═══  [MIN_CONT=${process.env.MIN_CONT} · ① et ② a leurs seuils REELS · spread FACTURE]`);
if (!CONT.length) { console.log("  🔴 AUCUN TIR CONT — le rang ③ ne tire pas, la sonde ne mesure rien."); process.exit(0); }
const sb = st(BUY), ss = st(SELL);
console.log(`  ${CONT.length} tirs · BUY ${sb ? sb.n : 0} (${sb ? sb.gr : 0} grap) · SELL ${ss ? ss.n : 0} (${ss ? ss.gr : 0} grap) · point mort 75,0 %`);
const vals = CONT.map(conv);
console.log(`  conviction observee : ${Math.min(...vals).toFixed(2)} … ${Math.max(...vals).toFixed(2)}   (echelle [−10 · +10], UNE entree)`);
console.log(`  ⚠ capacite SATUREE a ce seuil — les bandes basses sont des SURVIVANTES, pas une cohorte.\n`);

console.log("  ── ① PAR BANDE DE 2 (regroupe, pas filtre) ──");
HEAD();
for (let lo = -10; lo < 10; lo += 2) ligne(`[${lo} · ${lo + 2}[`, (s) => conv(s) >= lo && conv(s) < lo + 2);

console.log("\n  ── ② CUMULATIF (score ≥ v) — c'est CETTE table qui parle de `MIN_CONT` ──");
HEAD();
for (let v = -8; v <= 8; v += 2) ligne("≥ " + v, (s) => conv(s) >= v);
console.log("\n  ⚠ Un `MIN_CONT` unique se lit sur les DEUX colonnes a la fois : CREDITER UNE REGLE DE");
console.log("     SON COTE LE PLUS FAIBLE, pas de la moyenne des deux.");
console.log("  🔴 Et le cumulatif ci-dessus n'est PAS un balayage : il decoupe UN carnet deja produit.");
console.log("     Les creneaux ne se reallouent qu'au RE-RUN — voir `_pb_seuil_balayage` pour la forme.\n");
