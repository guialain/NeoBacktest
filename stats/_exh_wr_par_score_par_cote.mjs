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
// 🔴🔥⭐⭐⭐ 14/08 — L'ISOLEMENT ETAIT **ANNONCE ET JAMAIS APPLIQUE**. L'en-tete ci-dessus disait
//   « `MIN_PB`/`MIN_CONT` restent a 1000 : SEUL L'EXH TIRE », et la ligne de sortie l'IMPRIMAIT —
//   mais aucune des deux variables n'etait posee. Elles valaient donc leurs defauts de prod (10 et 2)
//   et les rangs ② et ③ tiraient pendant que le tableau affirmait le contraire.
//   ⭐ C'est le motif « un commentaire ASSERTIF vieillit comme un chiffre en dur », aggrave d'un cran :
//   ici l'affirmation etait RE-IMPRIMEE dans le resultat, donc un lecteur du tableau n'avait aucun
//   moyen de la mettre en doute. Un garde-fou qui ne tourne pas est un commentaire executable ; une
//   ISOLATION qui ne tourne pas est un commentaire IMPRIME.
//   ⚠ Consequence mesuree NULLE ici, et c'est pour ca que personne ne l'a vu : a `MIN_EXH = −91` le
//   rang ① tire sur TOUTES les barres et prend les creneaux en premier — les rangs ② et ③ n'en
//   recuperent aucun. Le depot l'avait d'ailleurs verifie le 13/08 (« cascade complete et run
//   EXH-isole donnent des chiffres identiques au bit pres »). ⇒ On POSE l'isolement pour que la
//   sonde fasse ce qu'elle dit, et la sortie imprime desormais les valeurs RESOLUES, pas une promesse.
process.env.MIN_PB = process.env.MIN_PB ?? "1000";
process.env.MIN_CONT = process.env.MIN_CONT ?? "1000";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  // 🔄 15/08 — CAPACITE SURCHARGEABLE. Elle etait figee a `maxOpen 30`, donc cette sonde ne mesurait
  //   PAS au point de mesure du jour (`maxOpen 100 · maxPerSymbol 100`) et ses WR n'etaient pas
  //   comparables a ceux de `_ab_moteur`. ⚠ La capacite SELECTIONNE : a `MIN_EXH = −91` toutes les
  //   barres tirent, donc c'est elle seule qui decide quels tirs entrent dans le tableau.
  const r = runMatrixBacktest(path.join(DIR, f), {
    maxOpen: +(process.env.MAXOPEN ?? 30), maxPerSymbol: process.env.MAXPERSYMBOL ? +process.env.MAXPERSYMBOL : undefined,
    cadenceMin: 2, chargeSpread: true });
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

// ⚠ VALEURS RESOLUES, RELUES DEPUIS LE MOTEUR — pas depuis `process.env`, et pas ecrites en dur.
//   Un seuil imprime doit etre celui que le moteur a REELLEMENT charge : c'est la seule forme qui ne
//   peut pas mentir. (`_ab_moteur` le fait deja pour les trois seuils.)
const { MIN_EXH: _mE, MIN_PB: _mP, MIN_CONT: _mC } =
  await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
console.log(`\n═══ EXH · WR PAR SCORE, PAR COTE ═══  [MIN_EXH=${_mE} · MIN_PB=${_mP} · MIN_CONT=${_mC} · spread FACTURE]`);
const sb = st(BUY), ss = st(SELL);
console.log(`  ${EXH.length} tirs · BUY ${sb.n} (${sb.gr} grap) · SELL ${ss.n} (${ss.gr} grap) · point mort 75,0 %`);
const vals = EXH.map(conv);
const MIN = Math.min(...vals), MAX = Math.max(...vals);
// 🔴🔥 BORNES **DERIVEES DES DONNEES**, plus jamais ecrites (12/08 soir). L'echelle du bareme ① a
//   bouge TROIS fois : `[−73·+73]` → `[−46,5·+46,5]` (somme par familles, 11/08) → `[−36,5·+36,5]`
//   (retrait de `kH1` puis `kdH1`, 12/08 soir). Les bandes en dur `-35..+35` survivaient a chaque
//   fois en imprimant un tableau plausible. ⭐ « Un seuil se perime avec son CAPTEUR » vaut aussi
//   pour les bornes d'une SONDE — et une sonde perimee ne leve rien, elle IMPRIME. La jumelle CONT
//   avait laisse 77 % de sa population hors de toute bande sans que rien ne le signale.
const PAS = Math.max(2, Math.ceil((MAX - MIN) / 16 / 2) * 2);
const LO = Math.floor(MIN / PAS) * PAS, HI = Math.ceil(MAX / PAS) * PAS;
console.log(`  conviction observee : ${MIN.toFixed(2)} … ${MAX.toFixed(2)}`);
// 🔄🔴🔥 15/08 — CE PARAGRAPHE ETAIT IMPRIME EN DUR ET PERIME : il annoncait « 5 entrees »,
//   « echelle [−36,5 · +36,5] » et « MIN_EXH = 10 » alors que le rang porte 6 entrees et que le
//   seuil vaut 20. ⭐⭐⭐ C'est le piege que ce fichier documente vingt lignes plus haut, retombe
//   dessus : les BORNES etaient derivees, mais la PHRASE QUI LES COMMENTE ne l'etait pas. Un
//   commentaire IMPRIME est pire qu'un commentaire mort — le lecteur du tableau n'a aucun moyen de
//   le mettre en doute. ⇒ la hauteur relative du seuil est maintenant CALCULEE.
// ⭐⭐ LE SEUIL DE PROD EST **LU DANS LA SOURCE**, pas recopie ici. On ne peut pas l'importer : ce
//   fichier pose `process.env.MIN_EXH = −91` AVANT le chargement du moteur, donc l'export vaudrait
//   −91. Le derivant du texte, il ne peut pas se perimer en silence — et s'il devient introuvable,
//   ca JETTE au lieu d'imprimer un chiffre faux.
// ⚠ Le defaut n'est pas un litteral mais la constante `SEUIL_V1` : on suit la chaine jusqu'au nombre.
const MIN_EXH_PROD = (() => {
  const R = "C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/";
  const dec = fs.readFileSync(R + "scoringDecision.js", "utf8");
  const m = dec.match(/export\s+const\s+MIN_EXH\s*=\s*_envNum\(\s*"MIN_EXH"\s*,\s*([A-Za-z_$][\w$]*|-?\d+(?:\.\d+)?)\s*\)/);
  if (!m) throw new Error("MIN_EXH introuvable dans scoringDecision.js — la sonde refuse d'imprimer un seuil invente");
  if (/^-?\d/.test(m[1])) return Number(m[1]);
  const exh = fs.readFileSync(R + "exhScoringV1.js", "utf8");
  const c = exh.match(new RegExp(`export\\s+const\\s+${m[1]}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*;`));
  if (!c) throw new Error(`${m[1]} introuvable dans exhScoringV1.js — la sonde refuse d'imprimer un seuil invente`);
  return Number(c[1]);
})();
{
  const seuil = Number(process.env.MIN_EXH ?? -91);
  const dansEchelle = seuil >= MIN && seuil <= MAX;
  console.log(`  ⚠ ECHELLE OBSERVEE, pas annoncee : [${MIN.toFixed(1)} · ${MAX.toFixed(1)}] sur ${EXH.length} tirs.`);
  console.log(`     Le seuil de PROD (\`MIN_EXH\`) vaut ${MIN_EXH_PROD} ⇒ ${(100 * (MIN_EXH_PROD - MIN) / (MAX - MIN)).toFixed(1)} % de l'etendue observee.`);
  console.log(`     ⚠ Ce run tire a MIN_EXH=${seuil}${dansEchelle ? "" : " (HORS echelle ⇒ toutes les barres tirent, c'est voulu)"}.\n`);
}

console.log(`  ── ① PAR BANDE DE ${PAS} (regroupe, pas filtre — bornes DERIVEES) ──`);
HEAD();
for (let lo = LO; lo < HI; lo += PAS) ligne(`[${lo} · ${lo + PAS}[`, (s) => conv(s) >= lo && conv(s) < lo + PAS);

console.log("\n  ── ② CUMULATIF (score ≥ v) — c'est CETTE table qui parle de `MIN_EXH` ──");
HEAD();
for (let v = LO; v <= HI - PAS; v += PAS) ligne("≥ " + v, (s) => conv(s) >= v);
console.log("\n  ⚠ Un `MIN_EXH` unique se lit sur les DEUX colonnes a la fois : le depot exige de");
console.log("     CREDITER UNE REGLE DE SON COTE LE PLUS FAIBLE, pas de la moyenne des deux.\n");
