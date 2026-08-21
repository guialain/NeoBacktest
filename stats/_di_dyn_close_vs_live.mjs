// _di_dyn_close_vs_live.mjs — LE CONFLIT ②/③ : `Δ|écart DI|` LU CLOSE-À-CLOSE vs LIVE.
//
// ⭐⭐⭐ LE CONFLIT, TEL QU'IL EST ÉCRIT DANS `exhScoringV1` : l'entrée ③ (ADX 2D) lit `gapDyn` en
//   LIVE et y traite `NARROWING` comme LA colonne qui encourage le fade ; l'entrée ② le lit close à
//   close et y mesure `NARROWING` **déficitaire des deux côtés**. Deux entrées, la MÊME grandeur,
//   deux horloges, des conclusions OPPOSÉES. Il bloque l'écriture du barème PB v2, où cette grandeur
//   devient l'axe principal (« la correction mord-elle dans la tendance ? »).
//
// ⭐🔥 L'HYPOTHÈSE TESTÉE ICI EN PREMIER (owner) — « biais d'ouverture de bougie ». Elle se
//   REFORMULE, et c'est le cœur de ce script : le biais de SIGNE est **déjà corrigé**
//   (`diGapDeltaLive` soustrait `g1 × α`, ADX_EMA_ALPHA = 2/15 ; sans ça `Δ|gap|` live serait négatif
//   63,1 % du temps). Ce qui reste est un biais d'**ÉCHELLE**, et le dépôt l'a déjà écrit pour l'ADX :
//       « le rattrapage est CONSTANT dans l'heure (c'est un pas d'EMA), l'INFORMATION GRANDIT
//         (0,55 à la 5ᵉ minute → 1,36 à la 55ᵉ) »
//   ⇒ Avec une bande morte FIXE (`DI_GAP_DEADBAND_LIVE = 0,85`), une barre lue à la 5ᵉ minute n'a
//   presque rien pu accumuler et tombe en `STABLE` mécaniquement ; à la 55ᵉ elle peut être classée.
//   **La lecture live n'est donc pas la même mesure selon la minute dans la bougie.** Si c'est vrai,
//   les colonnes `NARROWING` de ② et ③ ne décrivent pas la même population, et leur désaccord est
//   en partie un ARTEFACT d'échantillonnage — pas un désaccord sur le marché.
//
// 🔴 CE QU'ON NE FAIT PAS ICI, ET POURQUOI : aucune sélection sur les TIRS. Conditionner sur le seuil
//   anti-corrèle les termes (collider) — et c'est une propriété du CAPTEUR qu'on mesure, pas de la
//   population tradée. La ventilation sur la population PB viendra APRÈS le dump row ; elle n'est pas
//   observable aujourd'hui.
// ⚠ Le moteur n'est pas lancé : on lit les colonnes brutes. C'est ce qui rend la mesure instantanée
//   ET indépendante de tout seuil de décision.
import fs from "fs";
import path from "path";

const M = "file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/opportunities/OpportunityDetector.js";
const { diGapDynamics, diGapDynamicsLive, diGapDeltaLive,
        DI_GAP_DEADBAND, DI_GAP_DEADBAND_LIVE } = await import(M);

const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (s) => { const v = Number(s); return Number.isFinite(v) ? v : null; };
const COLS = ["timestamp", "plus_di_h1_s0", "minus_di_h1_s0",
              "plus_di_h1_c1", "minus_di_h1_c1", "plus_di_h1_c2", "minus_di_h1_c2"];

const rows = [];
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const txt = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  const head = txt[0].split(";");
  const ix = Object.fromEntries(COLS.map((c) => [c, head.indexOf(c)]));
  if (Object.values(ix).some((i) => i < 0)) { console.log(`🔴 colonnes manquantes dans ${f}`); process.exit(1); }
  for (let i = 1; i < txt.length - 1; i++) {
    const p = txt[i].split(";");
    const ts = p[ix.timestamp];
    // `2026.06.28 17:44:44` → la MINUTE dans l'heure = la minute dans la bougie H1.
    const m = /\d{4}\.\d{2}\.\d{2} \d{2}:(\d{2}):/.exec(ts);
    if (!m) continue;
    rows.push({ min: +m[1],
      pS0: num(p[ix.plus_di_h1_s0]),  mS0: num(p[ix.minus_di_h1_s0]),
      pC1: num(p[ix.plus_di_h1_c1]),  mC1: num(p[ix.minus_di_h1_c1]),
      pC2: num(p[ix.plus_di_h1_c2]),  mC2: num(p[ix.minus_di_h1_c2]) });
  }
}

for (const r of rows) {
  r.live  = diGapDynamicsLive(r.pS0, r.mS0, r.pC1, r.mC1);
  r.close = diGapDynamics(r.pC1, r.mC1, r.pC2, r.mC2);
  r.dLive = diGapDeltaLive(r.pS0, r.mS0, r.pC1, r.mC1);          // corrigé de la décroissance
  const a = (p, q) => (Number.isFinite(p) && Number.isFinite(q) ? Math.abs(p - q) : null);
  const g1 = a(r.pC1, r.mC1), g2 = a(r.pC2, r.mC2);
  r.dClose = g1 != null && g2 != null ? g1 - g2 : null;
}
const ok = rows.filter((r) => r.live && r.close);
console.log(`\n═══ ②/③ — \`Δ|écart DI|\` CLOSE-À-CLOSE vs LIVE ═══`);
console.log(`  ${rows.length} barres lues · ${ok.length} avec les deux lectures` +
  `   ·  bandes mortes : close ${DI_GAP_DEADBAND} · live ${DI_GAP_DEADBAND_LIVE}`);

const C = ["NARROWING", "STABLE", "WIDENING"];
const pc = (n, d) => (100 * n / (d || 1)).toFixed(1).padStart(6) + " %";

console.log(`\n── ① DISTRIBUTION GLOBALE ──`);
for (const [nom, k] of [["close à close", "close"], ["live (corrigé)", "live"]])
  console.log(`  ${nom.padEnd(16)} ` + C.map((c) => `${c} ${pc(ok.filter((r) => r[k] === c).length, ok.length)}`).join("  ·  "));

console.log(`\n── ② L'HYPOTHÈSE : LA LECTURE LIVE DÉPEND-ELLE DE LA MINUTE DANS LA BOUGIE ? ──`);
console.log(`  ⭐ si \`STABLE\` domine en début d'heure et s'efface ensuite, la bande morte fixe`);
console.log(`     mesure le TEMPS ÉCOULÉ autant que le marché.\n`);
console.log(`  minute      n    NARROWING     STABLE    WIDENING   |Δ| live médian   |Δ| close médian`);
const med = (v) => (v.length ? v.slice().sort((a, b) => a - b)[v.length >> 1] : NaN);
for (let b = 0; b < 60; b += 10) {
  const t = ok.filter((r) => r.min >= b && r.min < b + 10);
  if (!t.length) continue;
  const ml = med(t.filter((r) => r.dLive != null).map((r) => Math.abs(r.dLive)));
  const mc = med(t.filter((r) => r.dClose != null).map((r) => Math.abs(r.dClose)));
  console.log(`  ${String(b).padStart(2)}-${String(b + 9).padStart(2)} ${String(t.length).padStart(7)} ` +
    C.map((c) => pc(t.filter((r) => r[c === "STABLE" ? "live" : "live"] === c).length, t.length)).join(" ") +
    `      ${ml.toFixed(3).padStart(7)}          ${mc.toFixed(3).padStart(7)}`);
}

console.log(`\n── ③ ACCORD ENTRE LES DEUX LECTURES ──`);
const acc = ok.filter((r) => r.live === r.close).length;
console.log(`  accord global : ${pc(acc, ok.length)}  (${acc}/${ok.length})`);
console.log(`\n  matrice   close→   ` + C.map((c) => c.padStart(11)).join(""));
for (const l of C)
  console.log(`  live ${l.padEnd(10)} ` + C.map((c) =>
    pc(ok.filter((r) => r.live === l && r.close === c).length, ok.length).padStart(11)).join(""));

console.log(`\n── ④ L'ACCORD DÉPEND-IL DE LA MINUTE ? (le test décisif) ──`);
console.log(`  minute        n   accord   dont live=STABLE & close≠STABLE`);
for (let b = 0; b < 60; b += 10) {
  const t = ok.filter((r) => r.min >= b && r.min < b + 10);
  if (!t.length) continue;
  const a = t.filter((r) => r.live === r.close).length;
  const faux = t.filter((r) => r.live === "STABLE" && r.close !== "STABLE").length;
  console.log(`  ${String(b).padStart(2)}-${String(b + 9).padStart(2)} ${String(t.length).padStart(9)}  ${pc(a, t.length)}   ${pc(faux, t.length)}`);
}
