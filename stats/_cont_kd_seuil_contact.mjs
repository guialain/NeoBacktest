// _cont_kd_seuil_contact.mjs — LA PERSISTANCE DEPEND-ELLE DU CAPTEUR, OU DU BARREAU ?
// ⚠ DESCRIPTIF SEUL.
//
// 🔴🔥⭐⭐⭐ OBJECTION OWNER (16/08) — ET ELLE EST JUSTE : « la definition de contact fait que les
//   chiffres ne le disent pas. J'aurais peut-etre dit contact c'est |K−D| < 5,5 et ca change tout ;
//   dans MT5 je vois parfois h4 rester au plafond sur plus de 4 barres. »
//   ⇒ `_cont_gapkd_h4_persistance.mjs` a mesure la persistance de la COLONNE, c'est-a-dire d'un
//   etat defini par `STOCHDYN_CONTACT = 2,1`. Conclure « le K−D H4 ne tient pas » etait une
//   propriete du BARREAU presentee comme une propriete du CAPTEUR.
//   ⭐⭐⭐ **UN SEUIL ETROIT FABRIQUE DES EPISODES COURTS.** Elargir la bande morte allonge
//   mecaniquement les episodes ET en reduit le nombre — c'est la meme identite qu'au §1 de la fiche
//   (`part = frequence x duree`), prise par le troisieme cote.
//
// ⚠⚠ ET « AU PLAFOND » N'EST PAS « EN CONTACT » — deux observables distincts qu'il ne faut pas
//   confondre : `%K H4` colle a 100 (un NIVEAU) contre `|K−D|` petit (un ECART). Le second peut
//   s'ouvrir et se refermer pendant que le premier ne bouge pas. La fenetre US_500 est donc dumpee
//   avec LES DEUX, sinon on repond a cote de ce que l'oeil voit sur MT5.
//
//   usage : node stats/_cont_kd_seuil_contact.mjs
//           node stats/_cont_kd_seuil_contact.mjs dump      (la seule fenetre US_500)
import fs from "fs"; import path from "path";
const R = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines";
const { STOCHDYN_CONTACT } = await import(`${R}/opportunities/OpportunityDetector.js`);

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const TROU_MIN = 5;
const SEUILS = [STOCHDYN_CONTACT, 3, 4, 5.5, 7, 10];
const ts2min = (s) => { const m = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 60000 : null; };
const col = (v, s) => (v > s ? "POS" : v < -s ? "NEG" : "CONTACT");
const lire = (f, champs) => {
  const L = fs.readFileSync(path.join(DIR, f), "utf8").trim().split(/\r?\n/);
  const head = L[0].split(";"); const ix = {}; for (const n of champs) ix[n] = head.indexOf(n);
  const manq = champs.filter((n) => ix[n] < 0); if (manq.length) throw new Error(`${f} : ${manq.join(", ")}`);
  return { L, ix };
};
// ⚠ LE %K H4 N'A PAS DE FORME NUE dans ce scan (seulement `_s0.._s3`) ⇒ la CLOTURE est `_s1`, la
//   bougie H4 precedente. C'est elle qui est CONSTANTE pendant 240 lignes — donc elle seule peut
//   repondre a « rester au plafond sur 4 barres ». Le barème ne lit QUE `_s0`.
const CH = ["timestamp", "stoch_k_h1_s0", "stoch_d_h1_s0", "stoch_k_h4_s0", "stoch_d_h4_s0",
            "stoch_k_h4_s1", "stoch_d_h4_s1"];

// ══════════ MODE `dump` — LA FENETRE NOMMEE PAR L'OWNER ══════════
if (process.argv[2] === "dump") {
  const DEB = "2026.08.03 08:00", FIN = "2026.08.04 20:00";
  const { L, ix } = lire("US_500.csv", CH);
  console.log(`\n══ US_500 · ${DEB} → ${FIN} (UTC) · echantillon 20 min ══`);
  console.log(`  bande morte du depot : ±${STOCHDYN_CONTACT}\n`);
  console.log("  horodatage         %K_H4  %D_H4   K−D_H4 │ " + SEUILS.map((s) => `±${s}`.padStart(8)).join("")
    + " │  %K_H1   K−D_H1 │ CLOTURE H4: %K   K−D");
  let n = 0, prev = null;
  const ep = {}; for (const s of SEUILS) ep[s] = { cur: null, deb: null, out: [] };
  for (const l of L.slice(1)) {
    const c = l.split(";"); const t = c[ix.timestamp];
    if (t < DEB || t > FIN) continue;
    const k4 = Number(c[ix.stoch_k_h4_s0]), d4 = Number(c[ix.stoch_d_h4_s0]);
    const k1 = Number(c[ix.stoch_k_h1_s0]), d1 = Number(c[ix.stoch_d_h1_s0]);
    if (![k4, d4, k1, d1].every(Number.isFinite)) continue;
    const g4 = k4 - d4, g1 = k1 - d1, tm = ts2min(t);
    for (const s of SEUILS) { const e = ep[s], v = col(g4, s);
      if (e.cur !== v || (prev != null && tm - prev > TROU_MIN)) {
        if (e.cur != null) e.out.push([e.cur, e.deb, prev]); e.cur = v; e.deb = tm; } }
    prev = tm;
    if (n++ % 20) continue;
    const kc = Number(c[ix.stoch_k_h4_s1]), dc = Number(c[ix.stoch_d_h4_s1]);
    console.log(`  ${t.slice(5, 16)}  ${k4.toFixed(1).padStart(7)}${d4.toFixed(1).padStart(7)}${g4.toFixed(2).padStart(9)} │ `
      + SEUILS.map((s) => col(g4, s).padStart(8)).join("") + ` │ ${k1.toFixed(1).padStart(6)}${g1.toFixed(2).padStart(9)}`
      + ` │ ${(Number.isFinite(kc) ? kc.toFixed(1) : "—").padStart(13)}${(Number.isFinite(kc) && Number.isFinite(dc) ? (kc - dc).toFixed(2) : "—").padStart(8)}`);
  }
  for (const s of SEUILS) if (ep[s].cur != null) ep[s].out.push([ep[s].cur, ep[s].deb, prev]);
  console.log(`\n  ── LES EPISODES DU \`K−D\` H4 SUR CETTE FENETRE, PAR SEUIL ──`);
  for (const s of SEUILS) {
    const o = ep[s].out, c = o.filter((x) => x[0] === "CONTACT");
    const plus = c.length ? Math.max(...c.map((x) => x[2] - x[1] + 1)) : 0;
    console.log(`  ±${String(s).padEnd(5)} ${String(o.length).padStart(3)} episodes  ·  ${String(c.length).padStart(3)} en CONTACT`
      + `  ·  le plus long : ${plus.toFixed(0).padStart(4)} min (${(plus / 240).toFixed(2)} bougie H4)`);
  }
  process.exit(0);
}

// ══════════ MODE PAR DEFAUT — LE BALAYAGE DU SEUIL SUR TOUT LE FLUX ══════════
const S = {}; for (const s of SEUILS) S[s] = { H1: { tr: 0, ep: [], epC: [], nC: 0 }, H4: { tr: 0, ep: [], epC: [], nC: 0 } };
let nL = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const { L, ix } = lire(f, CH);
  const rows = [];
  for (const l of L.slice(1)) {
    const c = l.split(";"); const t = ts2min(c[ix.timestamp]); if (t == null) continue;
    const k4 = Number(c[ix.stoch_k_h4_s0]), d4 = Number(c[ix.stoch_d_h4_s0]);
    const k1 = Number(c[ix.stoch_k_h1_s0]), d1 = Number(c[ix.stoch_d_h1_s0]);
    if (![k4, d4, k1, d1].every(Number.isFinite)) continue;
    rows.push([t, k1 - d1, k4 - d4]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  const cur = {}, deb = {};
  for (const s of SEUILS) for (const h of ["H1", "H4"]) { cur[`${s}|${h}`] = null; deb[`${s}|${h}`] = 0; }
  let prev = null;
  for (const [t, g1, g4] of rows) {
    const rupt = prev != null && t - prev > TROU_MIN;
    nL++;
    for (const s of SEUILS) for (const [h, g] of [["H1", g1], ["H4", g4]]) {
      const k = `${s}|${h}`, v = col(g, s), st = S[s][h];
      if (v === "CONTACT") st.nC++;
      if (cur[k] == null) { cur[k] = v; deb[k] = t; continue; }
      if (rupt || v !== cur[k]) {
        if (!rupt) st.tr++;
        const d = prev - deb[k] + 1; st.ep.push(d); if (cur[k] === "CONTACT") st.epC.push(d);
        cur[k] = v; deb[k] = t;
      }
    }
    prev = t;
  }
}
const moy = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); const i = b.length >> 1;
  return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2; };
console.log(`\n══ BALAYAGE DU SEUIL DE CONTACT · flux complet (${nL} lignes) · cadence 1 min ══`);
console.log(`  ⚠ le seuil du depot est ±${STOCHDYN_CONTACT} — les autres colonnes sont des HYPOTHESES, rien n'est dicte.\n`);
console.log("  seuil │ part CONTACT      │ transitions / 1 000 min │  episode CONTACT moy (med)   │ rapport");
console.log("        │   H1        H4    │    H1        H4         │     H1            H4        │  H1/H4");
for (const s of SEUILS) {
  const a = S[s].H1, b = S[s].H4;
  const tr = (x) => (1000 * x.tr / nL);
  console.log(`  ±${String(s).padEnd(4)} │ ${(100 * a.nC / nL).toFixed(1).padStart(5)}%  ${(100 * b.nC / nL).toFixed(1).padStart(6)}%  │`
    + `${tr(a).toFixed(2).padStart(9)}${tr(b).toFixed(2).padStart(10)}         │`
    + `${moy(a.epC).toFixed(1).padStart(8)} (${med(a.epC)})${moy(b.epC).toFixed(1).padStart(10)} (${med(b.epC)})`.padEnd(30)
    + `│ ${(tr(a) / tr(b)).toFixed(2)}×`);
}
console.log(`\n  ⭐ colonne « rapport » = ce que le H4 apporte VRAIMENT en persistance, seuil par seuil.`);
