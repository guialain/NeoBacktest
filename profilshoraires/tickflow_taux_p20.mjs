// tickflow_taux_p20.mjs — QUEL TAUX LE SEUIL `tf_5s.p20` PRODUIT-IL RÉELLEMENT ?
//
// Trois portes du moteur testent `meanTick5s < tf_5s.p20` : Admission Gate 3 (tick_low),
// Energy DEAD, et le régime de volatilité 'low'. Le seuil vient d'une distribution de ticks
// INDIVIDUELS, la quantité testée est une MOYENNE DE 5 — deux distributions différentes.
//
// L'étiquette dit « 20 % ». On mesure ce que ça donne vraiment, actif par actif.
// ⭐ Et surtout on calcule le seuil qui, sur la distribution de la MOYENNE, reproduit le taux
//   ACTUEL : c'est lui qui permet de corriger l'échelle SANS changer le comportement. Corriger les
//   deux à la fois (échelle ET taux) rendrait toute mesure ultérieure ininterprétable.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { computeMeanTick5s, getTickFlowConfig } from "../../Matrix-Revolution/src/config/TickFlowConfig.js";

const DIR = "data/matrix";
const OUT = path.dirname(fileURLToPath(import.meta.url));
const H_DEB = 8 * 60, H_FIN = 20 * 60;
const quant = (t, p) => t.length ? t[Math.min(t.length - 1, Math.floor(t.length * p))] : null;

const assets = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".csv"))
  .map((f) => f.replace(/\.csv$/i, "")).sort();

console.log(`${"actif".padEnd(12)}${"p20 actuel".padStart(11)}${"taux réel".padStart(11)}`
  + `${"= percentile".padStart(13)}${"p20 sur moy".padStart(12)}${"taux si p20 vrai".padStart(18)}`);
const out = [];
for (const sym of assets) {
  const L = fs.readFileSync(path.join(DIR, `${sym}.csv`), "utf8").split(/\r?\n/);
  const head = L[0].split(";");
  const iU = head.indexOf("ts_utc");
  const idx = [0, 1, 2, 3, 4].map((k) => head.indexOf(`tick_count_5s_s${k}`));
  const moy = [];
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < head.length) continue;
    const d = new Date(c[iU]); if (Number.isNaN(d.getTime())) continue;
    const js = d.getUTCDay(); if (js === 0 || js === 6) continue;
    const min = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (min < H_DEB || min >= H_FIN) continue;
    const row = {}; for (let k = 0; k < 5; k++) row[`tick_count_5s_s${k}`] = c[idx[k]];
    const m = computeMeanTick5s(row);
    if (m != null && Number.isFinite(m)) moy.push(m);
  }
  moy.sort((a, b) => a - b);
  const p20cfg = getTickFlowConfig(sym)?.tf_5s?.p20;
  const sous = moy.filter((v) => v < p20cfg).length;
  const taux = sous / moy.length * 100;            // ce que la porte bloque AUJOURD'HUI
  const p20moy = quant(moy, 0.20);                 // le vrai 20e percentile de la moyenne
  const tauxSiVrai = moy.filter((v) => v < p20moy).length / moy.length * 100;
  // seuil qui, sur la distribution de la MOYENNE, reproduit exactement le taux actuel
  const equiv = quant(moy, taux / 100);
  out.push({ sym, n: moy.length, p20cfg, taux, p20moy, tauxSiVrai, equiv });
  console.log(`${sym.padEnd(12)}${String(p20cfg).padStart(11)}${(taux.toFixed(1) + " %").padStart(11)}`
    + `${("p" + Math.round(taux)).padStart(13)}${String(p20moy).padStart(12)}${(tauxSiVrai.toFixed(1) + " %").padStart(18)}`);
}
const t = out.map((o) => o.taux);
console.log(`\n⇒ l'étiquette « p20 » produit en réalité de ${Math.min(...t).toFixed(1)} % à ${Math.max(...t).toFixed(1)} %`
  + ` selon l'actif (médiane ${[...t].sort((a, b) => a - b)[Math.floor(t.length / 2)].toFixed(1)} %).`);
console.log(`⇒ passer au vrai p20 de la moyenne porterait tous les actifs à ~20 % : `
  + `${out.filter((o) => o.tauxSiVrai > o.taux).length} actifs bloqueraient PLUS, `
  + `${out.filter((o) => o.tauxSiVrai < o.taux).length} moins.`);
console.log(`\n=== SEUIL DE REMPLACEMENT À COMPORTEMENT CONSTANT (même taux, bonne échelle) ===`);
console.log(`${"actif".padEnd(12)}${"seuil".padStart(8)}   (reproduit le taux actuel sur la distribution de la moyenne)`);
for (const o of out) console.log(`${o.sym.padEnd(12)}${String(o.equiv).padStart(8)}`);

fs.writeFileSync(path.join(OUT, "tickflow_taux_p20.csv"),
  [`Actif;n;p20_config;taux_actuel_pct;p20_sur_moyenne;taux_si_vrai_p20_pct;seuil_equivalent`,
   ...out.map((o) => `${o.sym};${o.n};${o.p20cfg};${o.taux.toFixed(2).replace(".", ",")};${o.p20moy};`
     + `${o.tauxSiVrai.toFixed(2).replace(".", ",")};${o.equiv}`)].join("\r\n") + "\r\n", "utf8");
console.log(`\nÉcrit : tickflow_taux_p20.csv`);
