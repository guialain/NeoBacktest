// _exh_trajectoire_episode.mjs — UN SCORE EXH SELL FORTEMENT NEGATIF FINIT-IL PAR BASCULER ?
//
// ⭐⭐⭐ LA QUESTION (owner 11/08) : « on attend que l'extreme bascule ». Toutes les mesures
//   precedentes testaient « NE PAS PRENDRE » ; celle-ci teste **« PRENDRE PLUS TARD »**. Ce n'est
//   pas la meme chose : ne pas prendre abandonne la figure, attendre suppose qu'elle revienne.
//   Si `conv < −20` ne repasse presque jamais au-dessus de `MIN_EXH`, « attendre » ne veut rien
//   dire — on ne fait qu'abandonner, et le mot cache la decision.
//
// ⭐⭐ L'EPISODE, ET C'EST LA DEFINITION QUI PORTE TOUT (validee owner) : des barres CONSECUTIVES
//   sur un actif ou le routeur maintient le MEME cote EXH — c'est-a-dire ou `regDir` ne change pas
//   de signe. **Des que `regDir` bascule, ce n'est plus la meme figure** : c'est le ROUTEUR qui a
//   change d'avis, pas le bareme, et suivre au-dela melangerait deux questions.
// ⚠ Un trou de plus de `TROU_MAX` minutes coupe aussi l'episode (nuit, week-end, flux gele).
//
// ⚠⚠ AUCUNE CAPACITE ICI, ET C'EST VOULU : on lit une TRAJECTOIRE DE SCORE, pas un carnet. Aucun
//   creneau n'est en jeu, donc pas de piege tranche/re-run. ⭐ C'est precisement pour ca que cette
//   mesure vient AVANT celle de la valeur du differe, qui exigera deux re-runs complets.
// ⭐ On lit `ghostBoxes` : le verdict des TROIS boites sur CHAQUE barre, tirs ou non. Conditionner
//   sur les tirs serait un collider — on ne verrait que les barres ou le score avait deja bascule.
//
// 🔴 CE QUE CETTE SONDE NE PEUT PAS DIRE, ET QU'IL FAUT LIRE AVEC LES CHIFFRES : si le score bascule
//   parce que LA FIGURE s'est retournee, ou parce que LE PRIX A DEJA FAIT LE MOUVEMENT. Dans le
//   second cas on aurait attendu pour entrer trop tard. D'ou la colonne `deriv %` — le deplacement
//   du prix entre le depart et la bascule, en ATR. Un gros deplacement = on a rate le mouvement.
//   usage : node stats/_exh_trajectoire_episode.mjs   [SEUIL_BAS=-20] [CIBLE=10]
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const BAS   = Number(process.env.SEUIL_BAS ?? -20);   // « fortement negatif »
const CIBLE = Number(process.env.CIBLE ?? 10);        // le seuil qu'il faut franchir pour tirer
const TROU_MAX = 90;                                  // minutes — au-dela, l'episode est coupe
const { prepareAsset } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const mn = (ts) => { const m = String(ts).match(/(\d{4})\.(\d{2})\.(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null; };

let cas = [];   // un depart = une barre SELL a `conv < BAS`
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const p = prepareAsset(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, ghostBoxes: true });
  // ⚠ On ne garde que les barres ou le rang ① vise le SELL — la question est posee sur CE cote.
  const g = (p.ghosts ?? []).filter((x) => x.ghost === "boxes" && x.eSide === "SELL"
                                        && Number.isFinite(x.eConv) && Number.isFinite(mn(x.tsMT)))
                            .sort((x, y) => mn(x.tsMT) - mn(y.tsMT));
  for (let i = 0; i < g.length; i++) {
    if (!(g[i].eConv < BAS)) continue;
    // ⚠ ON NE COMPTE QU'UN DEPART PAR EPISODE : si la barre precedente etait deja sous `BAS` et
    //   dans le meme episode, c'est la MEME figure — la compter deux fois gonflerait le denominateur
    //   avec des doublons et ferait baisser artificiellement le taux de bascule.
    const prev = g[i - 1];
    if (prev && prev.eConv < BAS && prev.regDir === g[i].regDir && mn(g[i].tsMT) - mn(prev.tsMT) <= TROU_MAX) continue;
    const t0 = mn(g[i].tsMT), r0 = g[i].regDir, px0 = +g[i].entry, atr = +g[i].atr || 1;
    let issue = "episode mort", dt = null, hi = g[i].eConv, dpx = null;
    for (let j = i + 1; j < g.length; j++) {
      if (g[j].regDir !== r0) { issue = "regDir bascule"; dt = mn(g[j].tsMT) - t0; break; }
      if (mn(g[j].tsMT) - mn(g[j - 1].tsMT) > TROU_MAX) { issue = "trou"; dt = mn(g[j].tsMT) - t0; break; }
      hi = Math.max(hi, g[j].eConv);
      if (g[j].eConv > CIBLE) { issue = "BASCULE"; dt = mn(g[j].tsMT) - t0; dpx = (px0 - +g[j].entry) / atr; break; }
    }
    cas.push({ a, ts: g[i].tsMT, conv0: g[i].eConv, issue, dt, hi, dpx });
  }
}

const n = cas.length, bas = cas.filter((x) => x.issue === "BASCULE");
const med = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
console.log(`\n═══ EXH SELL · UN SCORE < ${BAS} FINIT-IL PAR FRANCHIR ${CIBLE} ? ═══`);
console.log(`  episode = barres consecutives a \`regDir\` CONSTANT · trou > ${TROU_MAX} min = coupure`);
console.log(`  un seul depart par episode · aucune capacite en jeu (trajectoire de score, pas carnet)\n`);
console.log(`  departs : ${n}`);
const par = {};
for (const x of cas) par[x.issue] = (par[x.issue] || 0) + 1;
for (const [k, v] of Object.entries(par).sort((a, b) => b[1] - a[1]))
  console.log(`    ${k.padEnd(16)} ${String(v).padStart(5)}  ${(100 * v / n).toFixed(1).padStart(5)}%`);
if (bas.length) {
  console.log(`\n  ── QUAND ÇA BASCULE (${bas.length} cas) ──`);
  console.log(`     delai median      ${med(bas.map((x) => x.dt))} min   (min ${Math.min(...bas.map(x=>x.dt))} · max ${Math.max(...bas.map(x=>x.dt))})`);
  console.log(`     conviction au depart, mediane   ${med(bas.map((x) => x.conv0))}`);
  console.log(`     sommet atteint, mediane          ${med(bas.map((x) => x.hi))}`);
  const d = bas.map((x) => x.dpx).filter(Number.isFinite);
  console.log(`\n  ── OU EST LE PRIX A LA BASCULE (en ATR, + = le prix a DEJA baisse) ──`);
  console.log(`     mediane ${med(d).toFixed(2)} ATR · deja > 1 ATR plus bas : ${(100*d.filter(x=>x>1).length/d.length).toFixed(1)}%`);
  console.log(`     ⚠ Un deplacement important = la bascule arrive APRES le mouvement : on aurait`);
  console.log(`       attendu pour entrer trop tard. C'est la seule lecture qui distingue « la figure`);
  console.log(`       s'est retournee » de « le prix a deja fait le travail ».`);
}
console.log(`\n  ── LES EPISODES QUI NE BASCULENT PAS ──`);
const mortes = cas.filter((x) => x.issue !== "BASCULE");
console.log(`     ${mortes.length} sur ${n} (${(100*mortes.length/n).toFixed(1)}%) · sommet median atteint : ${med(mortes.map((x) => x.hi))}`);
console.log(`     ⭐ Si ce sommet reste tres en dessous de ${CIBLE}, « attendre » n'est pas une attente :`);
console.log(`        c'est un abandon, et le mot le cache.\n`);
