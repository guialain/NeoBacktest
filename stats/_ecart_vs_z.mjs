// _ecart_vs_z.mjs — COMPARAISON CÔTE À CÔTE : z / Δz  contre  Ecart / ΔEcart.
//
//   Ecart  = (Prix − Moyenne) / ATR_H1_P50        étalon FIXE par actif, indépendant de la bougie
//          = z_s0 × sigma_h1 / ATR_P50_prix        (car Prix − Moyenne ≡ z·σ par définition)
//   ATR_P50_prix = getATRConfig(sym,"H1").p50 / 100000 × prix
//     ⚠ ATRConfig est en ATR_PCT_X1000 = (atr/close)×100000, PAS en unités de prix. Le fichier
//       l'écrit en capitales : ne jamais comparer sans convertir.
//
// ANCRAGE : Δz de l'expert = z_s0 − zscore_h1, donc « depuis la dernière clôture H1 ». On ancre
//   ΔEcart EXACTEMENT pareil, sinon la comparaison ne veut rien dire. Dans une même heure les deux
//   ancres (`close_h1_s1`, `zscore_h1`) sont constantes — vérifié — donc les 20 minutes affichées
//   partagent le même point de départ et les deux deltas s'accumulent depuis le même instant.
// ⚠ σ à la clôture n'est pas une colonne : on prend σ de la PREMIÈRE ligne de l'heure. Approximation
//   assumée et signalée — elle ne touche que l'ancre d'Ecart, pas les valeurs courantes.
//
// Sélection de la fenêtre : l'heure qui MAXIMISE |ΔP| en ATR tout en gardant |Δz| faible. C'est le
//   cas que la thèse décrit — le prix parcourt du chemin pendant que z ne bouge pas.
import fs from "fs";
import { getATRConfig } from "../../Matrix-Revolution/src/components/robot/engines/config/ATRConfig.js";

const ASSETS = process.argv.slice(2).length ? process.argv.slice(2) : ["US_30", "EURUSD", "GOLD"];

for (const sym of ASSETS) {
  const p50 = getATRConfig(sym, "H1")?.p50;
  if (!p50) { console.log(`${sym} : pas d'ATRConfig H1`); continue; }
  const L = fs.readFileSync(`data/matrix/${sym}.csv`, "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const I = Object.fromEntries(h.map((c, i) => [c, i]));
  const R = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const o = { t: c[I.ts_utc], p: +c[I.price], s: +c[I.sigma_h1], z0: +c[I.zscore_h1_s0],
                zc: +c[I.zscore_h1], p0: +c[I.close_h1_s1], atr: +c[I.atr_h1] };
    if (![o.p, o.s, o.z0, o.zc, o.p0, o.atr].every(Number.isFinite) || !(o.atr > 0)) continue;
    R.push(o);
  }
  // regroupe par heure
  const heures = new Map();
  for (const r of R) (heures.get(r.t.slice(0, 13)) ?? heures.set(r.t.slice(0, 13), []).get(r.t.slice(0, 13))).push(r);

  // ⚠ CONTRÔLE D'INTÉGRITÉ : `zscore_h1` et `close_h1_s1` sont l'ANCRE de Δz — ils doivent être
  //   CONSTANTS dans l'heure. S'ils bougent, l'axe compare deux instants différents et la fenêtre
  //   est inexploitable. On compte, et on écarte.
  let hAnc = 0, hFige = 0, hOk = 0;
  for (const [, rows] of heures) {
    const bouge = rows.some((r) => Math.abs(r.zc - rows[0].zc) > 1e-9 || Math.abs(r.p0 - rows[0].p0) > 1e-9);
    const fige = rows.length > 4 && rows.slice(0, 5).every((r) => r.p === rows[0].p && r.z0 === rows[0].z0);
    if (bouge) hAnc++; else if (fige) hFige++; else hOk++;
  }
  console.log(`
${sym} — intégrité : ${hOk} heures saines · ${hAnc} avec ANCRE MOBILE (Δz invalide) · ${hFige} à flux figé`);

  // l'heure la plus démonstrative : beaucoup de prix parcouru, peu de z
  let best = null;
  for (const [k, rows] of heures) {
    if (rows.length < 20) continue;
    if (rows.some((r) => Math.abs(r.zc - rows[0].zc) > 1e-9 || Math.abs(r.p0 - rows[0].p0) > 1e-9)) continue;
    if (rows.slice(0, 5).every((r) => r.p === rows[0].p && r.z0 === rows[0].z0)) continue;
    const a = rows[0], b = rows[rows.length - 1];
    const dP = Math.abs(b.p - a.p) / a.atr, dZ = Math.abs(b.z0 - a.z0);
    const score = dP - 2 * dZ;
    if (dP < 0.4) continue;
    if (!best || score > best.score) best = { k, rows, score, dP, dZ };
  }
  if (!best) { console.log(`${sym} : aucune heure exploitable`); continue; }

  const rows = best.rows.slice(0, 20);
  const anc = best.rows[0];                       // σ d'ancrage (1re ligne de l'heure)
  const atrP50 = (px) => p50 / 100000 * px;
  const dec = anc.p < 10 ? 5 : anc.p < 1000 ? 3 : 2;   // FX vs indices
  const ds  = anc.s < 0.01 ? 6 : 2;
  const ecart = (r) => r.z0 * r.s / atrP50(r.p);
  const ecartAnc = anc.zc * anc.s / atrP50(anc.p0);

  console.log(`\n${"═".repeat(112)}`);
  console.log(`${sym}  —  heure ${best.k}Z   ·   ATRConfig H1 p50 = ${p50} (x1000) ⇒ ${atrP50(anc.p).toFixed(dec)} en prix`);
  console.log(`ancre (dernière clôture H1) : prix ${anc.p0}  ·  z ${anc.zc.toFixed(4)}  ·  Ecart ${ecartAnc.toFixed(3)}`);
  console.log(`${"═".repeat(112)}`);
  console.log(`${"heure".padEnd(7)}${"prix".padStart(11)}${"ΔP/ATR".padStart(9)}${"sigma".padStart(11)}`
    + `${"z_s0".padStart(9)}${"Δz".padStart(9)}${"Ecart".padStart(9)}${"ΔEcart".padStart(9)}   lecture`);
  for (const r of rows) {
    const dz = r.z0 - r.zc, de = ecart(r) - ecartAnc, dp = (r.p - anc.p0) / r.atr;
    // désaccord = le prix a bougé franchement mais Δz dit ~rien, ou les deux deltas divergent en signe
    const flag = (Math.abs(dp) > 0.25 && Math.abs(dz) < 0.15) ? "  ⚠ prix bouge, Δz muet"
               : (dz !== 0 && de !== 0 && Math.sign(dz) !== Math.sign(de)) ? "  🔴 deltas de SIGNE OPPOSÉ" : "";
    console.log(`${r.t.slice(11, 16).padEnd(7)}${r.p.toFixed(dec).padStart(11)}${dp.toFixed(2).padStart(9)}`
      + `${r.s.toFixed(ds).padStart(11)}${r.z0.toFixed(3).padStart(9)}${(dz >= 0 ? "+" : "") + dz.toFixed(3).padStart(8)}`
      + `${ecart(r).toFixed(3).padStart(9)}${((de >= 0 ? "+" : "") + de.toFixed(3)).padStart(9)}${flag}`);
  }
  const f = rows[rows.length - 1];
  console.log(`${"─".repeat(112)}`);
  console.log(`sur ces ${rows.length} minutes : le prix a fait ${((f.p - anc.p0) / f.atr).toFixed(2)} ATR`
    + `  ·  Δz = ${(f.z0 - f.zc).toFixed(3)}  ·  ΔEcart = ${(ecart(f) - ecartAnc).toFixed(3)}`
    + `  ·  σ est passé de ${anc.s.toFixed(ds)} à ${f.s.toFixed(ds)} (${((f.s / anc.s - 1) * 100).toFixed(1)} %)`);
}
