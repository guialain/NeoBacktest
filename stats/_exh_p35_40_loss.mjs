// _exh_p35_40_loss.mjs — LES PERTES DE LA BANDE P35-40, COMPOSANTE PAR COMPOSANTE.
// ⚠ MÊME PRÉPARATION QUE `_exh_wr_par_bande_0804.mjs`, à la ligne près : même filtre, même
//   conviction, même tri, même découpage en 20. Une bande recalculée autrement ne serait pas LA
//   bande observée — c'est le piège `un filtre appliqué APRÈS une dédup qui l'IGNORE`.
// 🔴 `sc.exhConviction` N'EXISTE PAS dans `sc` : `conv()` retombe TOUJOURS sur `|score|/10`, et
//   `score` est un ENTIER. La discrétisation de la bande est donc un artefact d'ARRONDI, pas une
//   propriété du barème — `sc.exh` vaut 2,91 là où le score dit 2,90. On sort LES DEUX colonnes.
// ⚠ Sortie MARKDOWN (`--md <fichier>`) pour relecture à la main, une ligne par épisode perdant.
import { writeFileSync } from "node:fs";
import { dedupeEpisodes } from "./_episodes.mjs";

const W_EXH = { di: 0.1, gap: 0.2, kd: 0.2, rsi: 0.2 };   // miroir de `SCORING_WEIGHT.EXH`
const OUT = process.argv.includes("--md")
  ? process.argv[process.argv.indexOf("--md") + 1] : null;

const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=true`)).json();
  for (const s of (j.signals || [])) all.push({ ...s, asset: a });
}

const conv = (s) => {
  const c = s?.sc?.exhConviction;
  return Number.isFinite(c) ? c : (Number.isFinite(s?.score) ? Math.abs(s.score) / 10 : null);
};
const rows = dedupeEpisodes(all, (s) => s.asset)
  .filter((s) => s.type === "EXHAUSTION")
  .map((s) => ({ s, c: conv(s), win: s.outcome === "WIN", loss: s.outcome === "LOSS" }))
  .filter((r) => Number.isFinite(r.c) && (r.win || r.loss))
  .sort((a, b) => a.c - b.c);

const N = rows.length, i = 7;                       // P35-40
const band = rows.slice(Math.floor((i * N) / 20), Math.floor(((i + 1) * N) / 20));
const loss = band.filter((r) => r.loss);

const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");
// ⭐ `null` ⇒ « muet », JAMAIS « 0 » : un expert retiré du dénominateur n'est pas un expert qui vote
//   zéro. C'est la distinction que tout le moteur tient, elle doit survivre à l'affichage.
const fx = (v) => (v == null ? "*muet*" : f(v, 2));
const contrib = (v, w) => (v == null ? "—" : f(v * w, 3));

const L = [];
L.push(`# EXH · bande P35-40 — les ${loss.length} épisodes perdants`);
L.push("");
L.push(`Dataset 2026-06-29 → 2026-07-30 · 15 actifs · spread facturé · épisodes 15 min.`);
L.push(`Bande = P35-40 des ${N} épisodes EXH triés par conviction · ${band.length} épisodes · ` +
       `WR ${((band.filter((r) => r.win).length / band.length) * 100).toFixed(1)} %.`);
L.push("");
L.push("**Poids EXH** : `di 0,10 · gap 0,20 · kd 0,20 · rsi 0,20` (Σ 0,70).");
L.push("`exhRaw` = agrégat pondéré des experts NON MUETS · `bonus` = somme des bonus · " +
       "`exh` = `exhRaw + bonus` · `score` = `exh × 10` **arrondi**.");
L.push("");
L.push("⚠ Un expert `*muet*` est **retiré du dénominateur** — il n'est pas un vote à 0, " +
       "il **amplifie** les autres.");
L.push("");

// ── TABLE 1 : le score et ses composantes ─────────────────────────────────────────────────────
L.push("## 1 · Le score et ses composantes");
L.push("");
L.push("| # | date MT | actif | côté | score | exh | exhRaw | bonus | di | gap | kd | rsi | silence |");
L.push("|--:|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|---|");
loss.forEach((r, n) => {
  const s = r.s, sc = s.sc ?? {}, e = sc.exp ?? {};
  L.push(`| ${n + 1} | ${s.tsMT ?? "—"} | ${s.asset} | ${s.side} | ` +
    `${f(s.score, 0)} | ${f(sc.exh)} | ${f(sc.exhRaw)} | ${f(sc.exhBonus)} | ` +
    `${fx(e.di)} | ${fx(e.gap)} | ${fx(e.kd)} | ${fx(e.rsi)} | ${sc.silence ?? "—"} |`);
});
L.push("");

// ── TABLE 2 : la contribution PONDÉRÉE de chaque expert ───────────────────────────────────────
// ⭐ Séparée de la table 1 : le score BRUT d'un expert et ce qu'il PÈSE sont deux lectures, et les
//   mélanger dans une colonne fait lire un poids là où il y a une magnitude.
L.push("## 2 · Contribution pondérée (score × poids)");
L.push("");
L.push("| # | actif | côté | di ×0,10 | gap ×0,20 | kd ×0,20 | rsi ×0,20 | Σ pondérée | Σ poids actifs | exhRaw |");
L.push("|--:|---|---|--:|--:|--:|--:|--:|--:|--:|");
loss.forEach((r, n) => {
  const s = r.s, sc = s.sc ?? {}, e = sc.exp ?? {};
  let num = 0, den = 0;
  for (const [id, w] of Object.entries(W_EXH)) {
    if (Number.isFinite(e[id])) { num += e[id] * w; den += w; }
  }
  L.push(`| ${n + 1} | ${s.asset} | ${s.side} | ` +
    `${contrib(e.di, W_EXH.di)} | ${contrib(e.gap, W_EXH.gap)} | ` +
    `${contrib(e.kd, W_EXH.kd)} | ${contrib(e.rsi, W_EXH.rsi)} | ` +
    `${f(num, 3)} | ${f(den, 2)} | ${f(sc.exhRaw)} |`);
});
L.push("");

// ── TABLE 3 : les bonus, en toutes lettres ────────────────────────────────────────────────────
L.push("## 3 · Bonus déclenchés");
L.push("");
L.push("| # | actif | côté | id du bonus | tf | side | valeur |");
L.push("|--:|---|---|---|---|---|--:|");
let anyBonus = false;
loss.forEach((r, n) => {
  const s = r.s, hits = s.sc?.exhBonusHits;
  if (!Array.isArray(hits) || !hits.length) return;
  anyBonus = true;
  for (const h of hits) {
    L.push(`| ${n + 1} | ${s.asset} | ${s.side} | \`${h.id}\` | ${h.tf ?? "—"} | ${h.side ?? "—"} | ${f(h.value, 2)} |`);
  }
});
if (!anyBonus) L.push("| — | — | — | *aucun bonus sur ces épisodes* | — | — | — |");
L.push("");

// ── TABLE 4 : contexte de décision et sortie ──────────────────────────────────────────────────
L.push("## 4 · Décision et sortie");
L.push("");
L.push("| # | actif | côté | regDir | expSide | rank | seuil min | minPres | raison | R | barres |");
L.push("|--:|---|---|--:|---|---|--:|--:|---|--:|--:|");
loss.forEach((r, n) => {
  const s = r.s, sc = s.sc ?? {};
  L.push(`| ${n + 1} | ${s.asset} | ${s.side} | ${sc.regDir ?? "—"} | ${sc.expSide ?? "—"} | ` +
    `${Array.isArray(sc.ranks) ? sc.ranks.join(">") : (sc.rank ?? "—")} | ${f(sc.min)} | ${f(sc.minPres)} | ` +
    `${s.reason ?? "—"} | ${f(s.R)} | ${s.barsHeld ?? "—"} |`);
});
L.push("");

const md = L.join("\n");
if (OUT) { writeFileSync(OUT, md, "utf8"); console.log(`écrit : ${OUT} (${loss.length} épisodes)`); }
else if (!process.argv.includes("--csv")) console.log(md);

// ══ SORTIE CSV — UNE SEULE TABLE LARGE, une ligne par épisode ═════════════════════════════════
// ⚠ SÉPARATEUR `;` ET DÉCIMALE `,` : convention du dépôt (le scan MT5 est en `;`) et lecture
//   directe par Excel FR. Un `.` décimal y serait lu comme du TEXTE, et la colonne deviendrait
//   inutilisable au tri — c'est le genre de détail qui fait rejouer une analyse pour rien.
// 🔴 UN EXPERT MUET SORT UNE CELLULE **VIDE**, JAMAIS `0`. C'est la distinction que tout le moteur
//   tient, et c'est en CSV qu'elle se perd le plus facilement : un `0` se moyenne, un vide s'ignore.
//   Le même piège que `num("")=0`, pris par l'autre bout.
const CSVOUT = process.argv.includes("--csv")
  ? process.argv[process.argv.indexOf("--csv") + 1] : null;
if (CSVOUT) {
  const dec = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "");
  const esc = (v) => {
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["n", "date_mt", "actif", "cote", "score", "exh", "exh_raw", "bonus",
    "di", "gap", "kd", "rsi",
    "di_pondere", "gap_pondere", "kd_pondere", "rsi_pondere",
    "somme_ponderee", "somme_poids_actifs", "experts_muets",
    "silence", "bonus_ids", "bonus_valeurs",
    "regDir", "expSide", "rang", "seuil_min", "minPres", "raison", "R", "barres"];
  const out = [head.join(";")];
  loss.forEach((r, n) => {
    const s = r.s, sc = s.sc ?? {}, e = sc.exp ?? {};
    let num = 0, den = 0, mute = 0;
    for (const [id, w] of Object.entries(W_EXH)) {
      if (Number.isFinite(e[id])) { num += e[id] * w; den += w; } else mute++;
    }
    const hits = Array.isArray(sc.exhBonusHits) ? sc.exhBonusHits : [];
    out.push([
      n + 1, s.tsMT ?? "", s.asset, s.side,
      dec(s.score, 0), dec(sc.exh), dec(sc.exhRaw), dec(sc.exhBonus),
      dec(e.di), dec(e.gap), dec(e.kd), dec(e.rsi),
      dec(Number.isFinite(e.di) ? e.di * W_EXH.di : NaN, 3),
      dec(Number.isFinite(e.gap) ? e.gap * W_EXH.gap : NaN, 3),
      dec(Number.isFinite(e.kd) ? e.kd * W_EXH.kd : NaN, 3),
      dec(Number.isFinite(e.rsi) ? e.rsi * W_EXH.rsi : NaN, 3),
      dec(num, 3), dec(den), mute,
      sc.silence ?? "",
      hits.map((h) => h.id).join(" | "),
      hits.map((h) => dec(h.value)).join(" | "),
      sc.regDir ?? "", sc.expSide ?? "",
      Array.isArray(sc.ranks) ? sc.ranks.join(">") : (sc.rank ?? ""),
      dec(sc.min), dec(sc.minPres), s.reason ?? "", dec(s.R), s.barsHeld ?? "",
    ].map(esc).join(";"));
  });
  // ⚠ BOM UTF-8 : sans lui Excel lit les accents en ANSI et « côté » devient « cÃ´tÃ© ».
  writeFileSync(CSVOUT, "﻿" + out.join("\r\n") + "\r\n", "utf8");
  console.log(`écrit : ${CSVOUT} (${loss.length} lignes · ${head.length} colonnes)`);
}
