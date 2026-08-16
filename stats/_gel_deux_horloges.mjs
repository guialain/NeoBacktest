// _gel_deux_horloges.mjs — DETECTER UN GEL PAR LE **CROISEMENT DES DEUX HORLOGES** (16/08).
//
// ⭐⭐⭐ LE DEPOT PORTE DEUX HORLOGES ET NE LES A JAMAIS CROISEES :
//     `ts_utc`    = l'horloge du COLLECTEUR (quand la ligne a ete ecrite). Avance tant qu'il tourne.
//     `timestamp` = l'horloge MT5, c'est-a-dire **l'heure du DERNIER TICK recu du broker**.
//   ⇒ Les trois etats se separent sans ambiguite, et aucun ne se confond avec les autres :
//        `ts_utc` AVANCE  · `timestamp` AVANCE  → collecte SAINE
//        `ts_utc` SAUTE                          → COLLECTEUR ARRETE (PC eteint, EA inactif, week-end)
//        `ts_utc` AVANCE  · `timestamp` FIGE     → 🔴 **LIGNE MORTE** : le collecteur tourne et
//                                                  ecrit fidelement un terminal MT5 qui ne se
//                                                  rafraichit plus (connexion broker perdue).
// 🔴🔥 CE QUE CE CROISEMENT REGLE, ET QUI ETAIT NOMME COMME NON RESOLU DANS `_gel_flux.mjs` (08/08) :
//   « ce script CONFOND la fermeture normale et la panne de scan ; separer (a) de (b) demande de
//   croiser avec les HEURES DECLAREES par actif — pas fait. » ⇒ **Il ne fallait pas les heures
//   declarees, il fallait la DEUXIEME HORLOGE.** Une fermeture de marche arrete le collecteur (ou
//   fige les DEUX) ; une panne broker fige UNE SEULE des deux. Le critere « prix identique » qu'il
//   utilisait ne pouvait pas les distinguer — un marche ferme a lui aussi un prix identique.
// ⚠ Et le gel N'EST PAS un artefact de la reconstruction : verifie dans l'archive BRUTE
//   (`data/snapshots/archive_20260804.jsonl`), qui contient deja 226 enregistrements a `ts_utc`
//   croissant et `timestamp`+`price` figes. `buildAssetCSV.mjs` lit `r.ts_utc` du JSONL, il ne le
//   fabrique pas et ne remplit aucune grille.
//
//   usage : node stats/_cont_gel_deux_horloges.mjs
import fs from "fs"; import path from "path";
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const blocs = [];
let nTot = 0, nMort = 0, nSaut = 0;

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const iT = head.indexOf("timestamp"), iU = head.indexOf("ts_utc");
  if (iT < 0 || iU < 0) throw new Error(`${f} : les deux horloges sont requises`);
  let pT = null, pU = null, deb = null, n = 0;
  const clore = () => { if (n >= 2) blocs.push({ a: f.slice(0, -4), deb, fin: pU, min: n }); deb = null; n = 0; };
  for (const l of L.slice(1)) {
    const c = l.split(";"); const T = c[iT], U = Date.parse(c[iU]);
    if (!T || !Number.isFinite(U)) continue;
    nTot++;
    if (pT != null) {
      const dU = (U - pU) / 60000;
      if (dU > 2) { nSaut++; clore(); }              // collecteur arrete : le bloc ne continue pas
      else if (T === pT) { nMort++; if (!deb) { deb = pU; n = 1; } n++; }
      else clore();
    }
    pT = T; pU = U;
  }
  clore();
}

const pc = (x, t) => (100 * x / t).toFixed(2) + " %";
console.log(`\n══ GEL DETECTE PAR CROISEMENT DES DEUX HORLOGES ══`);
console.log(`  lignes totales ................... ${nTot}`);
console.log(`  🔴 LIGNES MORTES (ts_utc avance, timestamp fige) ... ${nMort}   ${pc(nMort, nTot)}`);
console.log(`  sauts du collecteur (PC/EA arrete, marche ferme) ... ${nSaut}`);
console.log(`  blocs de >= 2 lignes mortes ...................... ${blocs.length}`);

const longs = blocs.filter((b) => b.min >= 30).sort((x, y) => y.min - x.min);
console.log(`  dont >= 30 min : ${longs.length}`);
console.log(`\n  ── LES 10 PLUS LONGS ──`);
for (const b of longs.slice(0, 10))
  console.log(`    ${b.a.padEnd(12)} ${new Date(b.deb).toISOString().slice(0, 16).replace("T", " ")} → ${new Date(b.fin).toISOString().slice(11, 16)}   ${String(b.min).padStart(4)} min`);

// ⭐ SIMULTANEITE = LA SIGNATURE. Une panne broker touche les 19 actifs a la meme minute ; un
//   probleme d'actif n'en touche qu'un. C'est ce qui separe « bug d'infra » de « symbole illiquide ».
const parMinute = {};
for (const b of longs) { const k = new Date(b.deb).toISOString().slice(0, 16); (parMinute[k] ??= new Set()).add(b.a); }
console.log(`\n  ── SIMULTANEITE (blocs >= 30 min demarrant a la meme minute) ──`);
for (const [k, s] of Object.entries(parMinute).sort((a, b) => b[1].size - a[1].size).slice(0, 10))
  console.log(`    ${k.replace("T", " ")}   ${String(s.size).padStart(2)}/19 actifs` + (s.size >= 15 ? "   🔴 PANNE GLOBALE" : ""));
const minMortes = longs.reduce((a, b) => a + b.min, 0);
console.log(`\n  ⇒ ${minMortes} lignes dans des blocs de >= 30 min, soit ${pc(minMortes, nTot)} du dataset.`);
