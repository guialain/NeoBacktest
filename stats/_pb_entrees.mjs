// _pb_entrees.mjs — LE JEU D'ENTREES DU BAREME PB, CONSTRUIT UNE SEULE FOIS POUR TOUTES LES SONDES.
//
// 🔴🔥⭐⭐⭐ POURQUOI CE FICHIER EXISTE (11/08 au soir). L'entree ⑴ du rang ② est passee de `z` a
//   `gapAtr`, et CINQ sondes construisaient chacune leur propre objet d'entrees a la main. Migrer
//   « les quatre qui restent » aurait produit SIX copies de la meme derivation — `computeDeviation`
//   + `gapInstalled` + `gapDeltaCol`, plus le choix CLOTURE/LIVE sur chaque terme.
//   ⭐⭐⭐ Et la copie n'est pas le vrai danger : le vrai danger est qu'elles DIVERGENT sans lever.
//   Une sonde qui lirait `level` (live) au lieu de `levelClose` rendrait des chiffres plausibles sur
//   une AUTRE ligne de bareme que le moteur — et rien ne le dirait. C'est la faute
//   `derived_dataset_computed_3x`, dans sa forme la plus chere : elle ne casse pas, elle ment.
//
// ⚠⚠ CE FICHIER NE REIMPLEMENTE RIEN. Il APPELLE les memes fonctions, aux memes domiciles, que
//   `scoringDecision`. S'il fallait un jour y recopier trois lignes de `DeviationConfig`, ce serait
//   le signe qu'elles doivent DEMENAGER, pas etre dupliquees.
// ⚠ IL N'EST PAS LE MOTEUR POUR AUTANT : `scoringDecision` reste la seule verite. Ce fichier est la
//   pour que les SONDES posent la meme question que lui — si les deux divergent un jour, c'est ici
//   qu'il faut regarder en premier, pas dans la sonde qui affiche le chiffre.
//
// 🔴 LA CONVENTION D'INSTANT DU RANG ②, ET ELLE EST STRUCTURELLE :
//     NIVEAU + INSTALLATION a la **CLOTURE**  ·  VITESSE en **LIVE**.
//   `gap_s0 = gap_close + Δgap` : croiser un niveau live avec sa propre vitesse fait PARTAGER un
//   terme aux deux axes, et « le Δ choisit la ligne de bareme qu'on va lui appliquer ». C'est ce qui
//   a FABRIQUE deux classes sur le `%K` le 09/08 (`FAST_UP` 32 ep. a 93,8 % → **0 episode** en
//   lecture propre, et l'ordre des classes s'INVERSE).
// ⚠⚠ LE RANG ① LIT LE MEME TRIPLET **TOUT EN LIVE**, et c'est VOULU. Ne pas « harmoniser » : ce
//   serait changer la metrique ET l'instant d'un seul coup.
const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/";
const { computeDeviation, gapInstalled, gapDeltaCol } = await import(M + "config/DeviationConfig.js");
// ⚠ `readTfs` vit dans `scoringInputs` depuis le 11/08 (il s'appelait `readVetoTfs` dans `vetoGate` —
//   le nom decrivait UN consommateur, les BAREMES en sont devenus le principal).
const { readTfs } = await import(M + "scoring/scoringInputs.js");

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

/**
 * Les entrees de `pbScoreV1` pour une barre et un cote.
 * @param {object} row    la ligne CSV brute
 * @param {string} actif  le symbole — les barreaux de `gapLevel` et les medianes de Δgap sont PAR ACTIF
 * @param {"BUY"|"SELL"} side
 * ⚠ Le `side` n'entre QUE comme cle : aucune orientation n'est faite ici. La colonne part en sens
 *   BRUT et c'est `pbNoteGap` qui la miroite — en UN seul endroit, comme dans le moteur.
 */
export function pbEntrees(row, actif, side) {
  const v = readTfs(row);
  const d = computeDeviation(row, actif, "h1");
  const lvl = d?.levelClose ?? null;          // ⚠ `levelClose`, PAS `level` : cloture, pas live
  return {
    gapLevelH1Closed: lvl,
    // ⚠ L'INSTALLATION AUSSI EN CLOTURE (`gapAtrClose`) : melanger un signe live et un niveau
    //   cloture donnerait une ligne de bareme composite, et personne ne saurait laquelle.
    gapInstalledH1Closed: gapInstalled(lvl, d?.gapAtrClose, d?.meanSlope),
    // ⚠ Echelonnee par le niveau CLOTURE, coherent avec la ligne qu'elle va croiser.
    gapColH1Live: (lvl && Number.isFinite(d?.gapSlope)) ? gapDeltaCol(d.gapSlope, lvl, actif) : null,
    kH1Closed: v.h1?.kClosed ?? null,
    dKBandH1Live: v.h1?.dKBand ?? null,
    diGapBandH1Live: v.h1?.gapBand ?? null,
    // ⓪ LE CRITERE D'APPARTENANCE — sans ces trois-la, `pbRepli` rend `null` et le score sort en
    //   `total: null` AVANT toute somme. ⭐⭐⭐ C'est exactement ce qui a rendu deux garde-fous MUETS
    //   pendant une journee entiere le 11/08 : une porte posee EN AMONT desarme en silence tout ce
    //   qui l'appelle en aval. Une sonde qui les oublie ne mesure RIEN et affiche des tirets.
    highD1Live: num(row.high_d1_s0),
    lowD1Live: num(row.low_d1_s0),
    prixLive: num(row.price),
    side,
  };
}

/**
 * Les GRANDEURS BRUTES du gap, pour AFFICHAGE seulement — jamais pour noter.
 * ⭐⭐⭐ POURQUOI CE SECOND POINT D'ENTREE PLUTOT QU'UNE LECTURE DIRECTE DANS LA SONDE : une fiche qui
 *   affiche une grandeur sous un nom, et en note une autre, est le defaut le plus cher du depot —
 *   « on croit debattre du modele alors qu'on ne regarde meme pas le meme nombre ». En passant par
 *   ici, la valeur AFFICHEE et la valeur NOTEE sortent du meme `computeDeviation`, au meme instant.
 * ⚠ `gapAtrClose` est la grandeur qui produit la LIGNE ; `gapAtr` (live) ne sert a rien au rang ② et
 *   n'est expose que pour qu'on voie l'ecart entre les deux instants d'un coup d'oeil.
 */
export function pbGapBrut(row, actif) {
  const d = computeDeviation(row, actif, "h1");
  return { gapAtrClose: d?.gapAtrClose ?? null, gapAtrLive: d?.gapAtr ?? null,
           gapSlope: d?.gapSlope ?? null, levelClose: d?.levelClose ?? null };
}

/** L'index `timestamp → row` d'un CSV de scan. Les cinq sondes le refaisaient a l'identique. */
export function indexRows(csvPath, fs) {
  const L = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/), head = L[0].split(";");
  const rows = new Map();
  for (const l of L.slice(1)) {
    const c = l.split(";"), o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = c[i];
    rows.set(o.timestamp, o);
  }
  return rows;
}
