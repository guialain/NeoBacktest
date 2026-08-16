// _cont_gapkd_h4_persistance.mjs — LE `K−D` H4 CHANGE-T-IL D'ETAT PLUS RAREMENT QUE LE H1 ?
// ⚠ DESCRIPTIF SEUL. Aucune note, aucun A/B, aucun tir compte.
//
// 🔴🔥⭐⭐⭐ POURQUOI CETTE SONDE EXISTE — UNE PART NE REPOND PAS A UNE QUESTION DE FREQUENCE.
//   `_cont_gapkd_h4_pop.mjs` (16/08) a mesure la PART de chaque colonne et conclu que la prediction
//   du 13/08 etait refutee. Objection owner, et elle porte : « dans un seul CONTACT h4 il peut y
//   avoir plusieurs contacts h1 ; h1 fait des va-et-vient pendant que h4 reste en contact. »
//   ⇒ La prediction ecrite avait DEUX moities, et une seule avait ete testee :
//        (a) « le `K−D` H4 change de signe bien plus rarement »   ← FREQUENCE
//        (b) « donc la colonne CONTACT y sera nettement plus lourde » ← PART
//   ⭐⭐⭐ `part = frequence d'entree x duree` ⇒ un capteur 2x plus persistant peut avoir EXACTEMENT
//   la meme part. **La faute est dans le « donc », pas dans une moitie.**
//
// ══ 🔄🔴🔥🔥⭐⭐⭐ v2 — 16/08 : **LES LIGNES MORTES SONT DES RUPTURES** (objection owner) ═══════════
// ⭐⭐⭐ LA v1 LISAIT LES DUREES SUR `timestamp`, QUI NE BOUGE PAS PENDANT UNE PANNE BROKER. Une plage
//   de 4 h reelles y comptait pour ZERO minute, et « transitions / 1 000 min » etait en fait
//   « / 1 000 LIGNES ». ⇒ Les durees d'episode de la v1 sont SOUS-ESTIMEES, dans le sens meme de
//   l'objection owner (« mes episodes sont trop courts »).
// ⭐⭐ LE CROISEMENT DES DEUX HORLOGES (cf. `_gel_deux_horloges.mjs`) :
//        `ts_utc`    = horloge du COLLECTEUR   ·   `timestamp` = heure du DERNIER TICK BROKER
//        ts_utc SAUTE                 → collecteur arrete (PC/EA off, week-end)  ⇒ RUPTURE
//        ts_utc avance, timestamp FIGE → 🔴 LIGNE MORTE (panne broker)
// ⚠⚠ ET TOUTES LES LIGNES MORTES NE SE VALENT PAS — c'est le seul arbitrage de cette v2 :
//     · un run COURT = le broker n'a simplement pas tique (actif peu liquide, seance calme).
//       La staleness est REELLE : le marche n'a pas bouge, donc la persistance non plus. ⇒ GARDEE.
//     · un run LONG  = panne. La staleness est FAUSSE : le marche a bouge (56,5 pts le 04/08) et on
//       ne l'a pas vu. La garder FABRIQUE de la persistance. ⇒ EXCISEE + RUPTURE.
//   `MORT` (defaut 5 lignes) est la frontiere. ⛔ Elle n'est PAS calee sur un resultat : elle est
//   balayee ci-dessous et la sortie imprime la sensibilite. Si le classement bouge avec `MORT`,
//   c'est la mesure qui ne conclut pas — pas le seuil qu'il faut choisir.
// ⚠ L'HORLOGE DES DUREES DEVIENT `ts_utc` (temps reel ecoule), et le taux est par 1 000 minutes
//   REELLES, plus par 1 000 lignes. La colonne « v1 » reste imprimee pour que l'ecart soit LISIBLE.
//
// ⚠ POPULATION = LE FLUX COMPLET, pas le residu : une transition se compte sur des lignes CONTIGUES,
//   et la question posee est une propriete du CAPTEUR, pas de la population notee.
// ⚠ CLASSIFICATEUR IMPORTE (`gapKdCol`), jamais recopie — meme barreau `±2,1` que le barème.
//   usage : node stats/_cont_gapkd_h4_persistance.mjs        (MORT=5 par defaut)
//           MORT=30 node stats/_cont_gapkd_h4_persistance.mjs
import fs from "fs"; import path from "path";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines";
const { gapKdCol } = await import(`${R}/scoring/exhScoringV1.js`);
const { STOCHDYN_CONTACT } = await import(`${R}/opportunities/OpportunityDetector.js`);

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const TROU_MIN = 5;
const MORT = Number(process.env.MORT ?? 5);
const BOUGIE = { H1: 60, H4: 240 };
const CH = ["timestamp", "ts_utc", "stoch_k_h1_s0", "stoch_d_h1_s0", "stoch_k_h4_s0", "stoch_d_h4_s0"];

const neuf = () => ({ tr: 0, ep: [], epC: [] });
const S = { v1: { H1: neuf(), H2: null, H4: neuf() }, v2: { H1: neuf(), H4: neuf() } };
let nL = 0, nMort = 0, nRun = 0, nExcise = 0, minReelles = 0, minV1 = 0;
const croise = { epH4: 0, transH1: [], duree: [] };

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const ix = {}; for (const n of CH) ix[n] = head.indexOf(n);
  const manq = CH.filter((n) => ix[n] < 0); if (manq.length) throw new Error(`${f} : ${manq.join(", ")}`);

  const rows = [];
  for (const l of L.slice(1)) {
    const c = l.split(";");
    const u = Date.parse(c[ix.ts_utc]) / 60000; if (!Number.isFinite(u)) continue;
    const k4 = Number(c[ix.stoch_k_h4_s0]), d4 = Number(c[ix.stoch_d_h4_s0]);
    const k1 = Number(c[ix.stoch_k_h1_s0]), d1 = Number(c[ix.stoch_d_h1_s0]);
    if (![k4, d4, k1, d1].every(Number.isFinite)) continue;
    rows.push({ u, T: c[ix.timestamp], g1: k1 - d1, g4: k4 - d4 });
  }
  rows.sort((a, b) => a.u - b.u);
  nL += rows.length;

  // ── 1. marquer les lignes MORTES et reperer les runs LONGS (panne) ──
  for (let i = 1; i < rows.length; i++) rows[i].mort = rows[i].T === rows[i - 1].T;
  if (rows.length) rows[0].mort = false;
  // ⚠ DEUX COMPTEURS DISTINCTS ET NOMMES COMME TELS : `nMort` = LIGNES mortes, `nRun` = RUNS.
  //   Les confondre (un `++` place dans la boucle des runs et etiquete « lignes ») donne un chiffre
  //   plausible et faux — 684 au lieu de 13 072. Corrige avant publication.
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].mort) continue;
    nRun++;
    let j = i; while (j < rows.length && rows[j].mort) j++;
    nMort += j - i;
    if (j - i >= MORT) { for (let k = i; k < j; k++) { rows[k].panne = true; nExcise++; } }
    i = j - 1;
  }

  // ── 2. parcourir, en fermant les episodes sur RUPTURE (saut collecteur OU panne) ──
  const cur = { H1: null, H4: null }, deb = { H1: 0, H4: 0 };
  let prev = null, prevV1 = null, h4c = null;
  const clore = (V, h, fin) => { const s = S[V][h];
    if (cur[`${V}|${h}`] != null) { const d = fin - deb[`${V}|${h}`];
      s.ep.push(d); if (cur[`${V}|${h}`] === "CONTACT") s.epC.push(d); } };
  // ⚠ deux jeux d'etat : la v1 (toutes lignes, horloge `timestamp`) tourne EN PARALLELE pour que
  //   l'ecart soit mesure sur EXACTEMENT le meme flux, jamais sur deux lectures separees.
  const cur1 = {}, deb1 = {};
  const cloreH4 = (fin) => { if (h4c) { croise.epH4++; croise.transH1.push(h4c.n); croise.duree.push(fin - h4c.deb); h4c = null; } };

  for (const r of rows) {
    // ── v1 : reproduction fidele de la version publiee (horloge timestamp, lignes mortes gardees) ──
    const t1 = (() => { const m = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(r.T);
      return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 60000 : null; })();
    if (t1 != null) {
      const rupt1 = prevV1 != null && t1 - prevV1 > TROU_MIN;
      if (prevV1 != null) minV1 += Math.min(Math.max(t1 - prevV1, 0), TROU_MIN);
      for (const [h, g] of [["H1", r.g1], ["H4", r.g4]]) {
        const k = `v1|${h}`, v = gapKdCol(g);
        if (cur1[k] == null || rupt1) { if (cur1[k] != null) { const d = prevV1 - deb1[k];
            S.v1[h].ep.push(d); if (cur1[k] === "CONTACT") S.v1[h].epC.push(d); }
          cur1[k] = v; deb1[k] = t1; continue; }
        if (v !== cur1[k]) { S.v1[h].tr++; const d = prevV1 - deb1[k];
          S.v1[h].ep.push(d); if (cur1[k] === "CONTACT") S.v1[h].epC.push(d); cur1[k] = v; deb1[k] = t1; }
      }
      prevV1 = t1;
    }

    // ── v2 : lignes de panne EXCISEES, horloge reelle, rupture a la reprise ──
    if (r.panne) { for (const h of ["H1", "H4"]) { clore("v2", h, prev ?? r.u); cur[`v2|${h}`] = null; }
                   cloreH4(prev ?? r.u); prev = null; continue; }
    const rupt = prev != null && r.u - prev > TROU_MIN;
    if (rupt) { for (const h of ["H1", "H4"]) { clore("v2", h, prev); cur[`v2|${h}`] = null; } cloreH4(prev); }
    if (prev != null && !rupt) minReelles += r.u - prev;
    for (const [h, g] of [["H1", r.g1], ["H4", r.g4]]) {
      const k = `v2|${h}`, v = gapKdCol(g);
      if (cur[k] == null) { cur[k] = v; deb[k] = r.u; continue; }
      if (v !== cur[k]) { S.v2[h].tr++; clore("v2", h, r.u); cur[k] = v; deb[k] = r.u; }
    }
    if (gapKdCol(r.g4) === "CONTACT") {
      if (!h4c) h4c = { deb: r.u, n: 0, der: gapKdCol(r.g1) };
      else { const c1 = gapKdCol(r.g1); if (c1 !== h4c.der) { h4c.n++; h4c.der = c1; } }
    } else cloreH4(prev ?? r.u);
    prev = r.u;
  }
  for (const h of ["H1", "H4"]) clore("v2", h, prev ?? 0);
  cloreH4(prev ?? 0);
}

const moy = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); const i = b.length >> 1;
  return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2; };

console.log(`\n══ PERSISTANCE DU \`K−D\` PAR HORLOGE · bande morte ±${STOCHDYN_CONTACT} ══`);
console.log(`  lignes ${nL}  ·  LIGNES mortes ${nMort} (${(100 * nMort / nL).toFixed(2)} %) en ${nRun} runs  ·  EXCISEES (runs >= ${MORT}) ${nExcise} (${(100 * nExcise / nL).toFixed(2)} %)`);
console.log(`  minutes retenues : v1 (horloge timestamp) ${minV1.toFixed(0)}   ·   v2 (horloge ts_utc) ${minReelles.toFixed(0)}`);
console.log(`\n  ${"".padEnd(8)}${"transitions / 1 000 min".padStart(26)}${"episode CONTACT moy (med)".padStart(30)}`);
console.log(`  ${"".padEnd(8)}${"v1 (fausse)".padStart(13)}${"v2 (reelle)".padStart(13)}${"v1".padStart(15)}${"v2".padStart(15)}`);
for (const h of ["H1", "H4"]) {
  const a = S.v1[h], b = S.v2[h];
  console.log(`  ${h.padEnd(8)}${(1000 * a.tr / minV1).toFixed(2).padStart(13)}${(1000 * b.tr / minReelles).toFixed(2).padStart(13)}`
    + `${`${moy(a.epC).toFixed(1)} (${med(a.epC)})`.padStart(15)}${`${moy(b.epC).toFixed(1)} (${med(b.epC)})`.padStart(15)}`);
}
const rap = (V) => ((1000 * S[V].H1.tr / (V === "v1" ? minV1 : minReelles)) / (1000 * S[V].H4.tr / (V === "v1" ? minV1 : minReelles)));
console.log(`\n  ⭐ RAPPORT H1/H4 des transitions :  v1 ${rap("v1").toFixed(2)}×   →   v2 ${rap("v2").toFixed(2)}×`);
console.log(`  ⭐ episode CONTACT H4 :  v1 ${moy(S.v1.H4.epC).toFixed(1)} min   →   v2 ${moy(S.v2.H4.epC).toFixed(1)} min`
  + `  (${(moy(S.v2.H4.epC) / BOUGIE.H4).toFixed(2)} bougie H4)`);
console.log(`  ⭐ le plus long episode CONTACT H4 : ${Math.max(...S.v2.H4.epC).toFixed(0)} min (${(Math.max(...S.v2.H4.epC) / BOUGIE.H4).toFixed(2)} bougie H4)`);

console.log(`\n  ══ DANS UN CONTACT H4, QUE FAIT LE H1 ? (v2) ══`);
console.log(`  episodes CONTACT H4 ......... ${croise.epH4}  ·  duree moy ${moy(croise.duree).toFixed(1)} min (med ${med(croise.duree)})`);
console.log(`  transitions H1 dedans ....... moy ${moy(croise.transH1).toFixed(2)}  ·  med ${med(croise.transH1)}  ·  max ${Math.max(...croise.transH1, 0)}`);
const tot = croise.duree.reduce((a, b) => a + b, 0);
const bouge = croise.duree.reduce((a, d, i) => a + (croise.transH1[i] > 0 ? d : 0), 0);
const b3 = croise.duree.reduce((a, d, i) => a + (croise.transH1[i] >= 3 ? d : 0), 0);
const nB = croise.transH1.filter((v) => v > 0).length, n3 = croise.transH1.filter((v) => v >= 3).length;
const pc = (x, t) => (t ? (100 * x / t).toFixed(2) : "0.00") + " %";
console.log(`  le H1 BOUGE ....... ${pc(nB, croise.epH4).padStart(8)} des episodes   ·   ${pc(bouge, tot).padStart(8)} des MINUTES`);
console.log(`  le H1 change >= 3 . ${pc(n3, croise.epH4).padStart(8)} des episodes   ·   ${pc(b3, tot).padStart(8)} des MINUTES`);
