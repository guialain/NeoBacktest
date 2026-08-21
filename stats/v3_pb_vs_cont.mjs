// v3_pb_vs_cont.mjs — PULLBACK CONTRE CONTINUATION, SUR LES MÊMES BARRES.
// ============================================================================================
// ⭐⭐⭐ CE QUE CE SCRIPT PEUT FAIRE ET QUE LES PRÉCÉDENTS NE POUVAIENT PAS. Le montage « moteur
//   éteint + bonus 2000 » isole une POPULATION, jamais une THÈSE : le bonus noie les deux scoreurs,
//   donc les rangs ② et ③ tirent sur exactement les mêmes barres (mesuré : 78 490 clés communes,
//   R identique à 100 %). La question « pullback ou continuation ? » ne se lit donc PAS dans deux
//   carnets — elle se lit dans les deux SCORES portés par le MÊME carnet.
//   ⇒ table du rang ② (`BONUS_TEST_RANG=2`) : elle seule porte `exhRaw` (= `sExhBySide[+regDir]`,
//   la thèse PULLBACK) ET `contRaw` (la thèse CONTINUATION) côte à côte sur chaque tir.
//
// 🔴🔥 ORIENTATION OBLIGATOIRE. Les scores sont SIGNÉS sur l'axe BUY-positif : un score favorable à
//   un SELL est NÉGATIF. Les lire bruts mélangerait « favorable » et « défavorable » selon le côté —
//   et couperait chaque classe en deux demi-échantillons de signes opposés. `orient()` remet les
//   deux côtés dans le même repère : **positif = favorable au trade qu'on prend**.
// ⚠ `exp` : `null` = expert MUET (il sort du dénominateur et AMPLIFIE les autres) · `0` = expert qui
//   a parlé pour ne rien dire. Ne jamais confondre — on compte donc les muets séparément.
// ⚠ Toute stat par grappe ACTIF × JOUR (les tirs ne sont pas indépendants : facteur ~9 sur le σ).
import fs from "fs";

const DIR = process.env.DIR ?? "analyse_out/v3pb";
const NMIN = Number(process.env.NMIN ?? 30);
const rows0 = fs.readFileSync(`${DIR}/tirs.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l));

const ZONE_TS = {
  BUY:  { EXTREME_BASSE: "XAR", BASSE: "AR", MID: "MID", HAUTE: "AV", EXTREME_HAUTE: "XAV" },
  SELL: { EXTREME_HAUTE: "XAR", HAUTE: "AR", MID: "MID", BASSE: "AV", EXTREME_BASSE: "XAV" },
};
const ZONES = ["XAR", "AR", "MID", "AV", "XAV"];
const orient = (v, side) => (v == null ? null : (side === "BUY" ? v : -v));

const rows = rows0.filter((r) => Number.isFinite(r.R)).map((r) => ({
  ...r,
  z: ZONE_TS[r.side]?.[r.zone] ?? null,
  sPB:   orient(r.exhRaw,  r.side),     // thèse PULLBACK,     positif = favorable au trade
  sCONT: orient(r.contRaw, r.side),     // thèse CONTINUATION, positif = favorable au trade
}));

const jour = (r) => new Date(r.ep * 60000).toISOString().slice(0, 10);
const grap = (t) => {
  const g = {};
  for (const r of t) { const k = r.asset + "|" + jour(r); (g[k] ??= []).push(r.win); }
  const v = Object.values(g).map((a) => a.reduce((x, y) => x + y, 0) / a.length), n = v.length;
  if (!n) return null;
  const m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1));
  return { n, wr: 100 * m, se: 100 * sd / Math.sqrt(n) };
};
const contraste = (pop, f) => {
  const a = grap(pop.filter(f)), b = grap(pop.filter((r) => !f(r)));
  if (!a || !b || a.n < NMIN || b.n < NMIN) return null;
  const d = a.wr - b.wr, se = Math.sqrt(a.se ** 2 + b.se ** 2);
  return { a, b, d, se, sigma: d / se };
};
const fmt = (c) => c ? `${String(c.a.n).padStart(4)}/${String(c.b.n).padStart(4)}  Δ${((c.d >= 0 ? "+" : "") + c.d.toFixed(1)).padStart(6)} ±${c.se.toFixed(1)}  σ${((c.sigma >= 0 ? "+" : "") + c.sigma.toFixed(2)).padStart(6)}${Math.abs(c.sigma) >= 2 ? " ⭐" : "  "}`
                    : "        (effectif insuffisant)        ";

console.log("═".repeat(106));
console.log("  PULLBACK (rang ②) CONTRE CONTINUATION (rang ③) — MÊME CARNET, DEUX SCORES");
console.log("═".repeat(106));
const dispo = rows.filter((r) => r.sPB != null && r.sCONT != null);
console.log(`  ${rows.length} tirs · ${dispo.length} portent LES DEUX scores (${(100 * dispo.length / rows.length).toFixed(1)} %)`);
const muets = { PB: rows.filter((r) => r.sPB == null).length, CONT: rows.filter((r) => r.sCONT == null).length };
console.log(`  scores absents : thèse PB ${muets.PB} · thèse CONT ${muets.CONT}   ⚠ un score ABSENT n'est pas un score NUL`);

// ── 1. LES DEUX THÈSES SONT-ELLES DES DOUBLONS ? ────────────────────────────────────────────
// ⭐ Si les deux scores disent la même chose, il n'y a pas deux thèses mais une seule écrite deux
//   fois. La corrélation le dit d'un coup ; l'accord de SIGNE le dit de façon actionnable.
const n = dispo.length;
const mx = dispo.reduce((a, b) => a + b.sPB, 0) / n, my = dispo.reduce((a, b) => a + b.sCONT, 0) / n;
const cov = dispo.reduce((a, b) => a + (b.sPB - mx) * (b.sCONT - my), 0);
const sx = Math.sqrt(dispo.reduce((a, b) => a + (b.sPB - mx) ** 2, 0)), sy = Math.sqrt(dispo.reduce((a, b) => a + (b.sCONT - my) ** 2, 0));
const memeSigne = dispo.filter((r) => Math.sign(r.sPB) === Math.sign(r.sCONT)).length;
console.log(`\n── 1. DOUBLONS OU THÈSES DISTINCTES ? ──`);
console.log(`   corrélation des deux scores orientés : ${(cov / (sx * sy)).toFixed(3)}`);
console.log(`   même SIGNE : ${memeSigne} tirs (${(100 * memeSigne / n).toFixed(1)} %) — ils se contredisent sur ${(100 - 100 * memeSigne / n).toFixed(1)} %`);
console.log(`   ⇒ ${Math.abs(cov / (sx * sy)) > 0.7 ? "🔴 fortement corrélés : une seule thèse écrite deux fois" : "deux signaux largement indépendants — les traiter séparément a un sens"}`);

// ── 2. CHAQUE THÈSE DISCRIMINE-T-ELLE, ET OÙ ? ──────────────────────────────────────────────
// ⚠ CONTRASTE, PAS NIVEAU : on ne dit pas « cette cellule vaut X % », on dit « un score favorable
//   sépare-t-il les gagnants des perdants ICI ». Le niveau serait celui d'une population non affinée.
console.log(`\n── 2. POUVOIR DISCRIMINANT DE CHAQUE THÈSE, PAR ZONE (score orienté > 0) ──`);
console.log("   zone        thèse PULLBACK  (n+/n−)                    thèse CONTINUATION (n+/n−)");
for (const z of ["TOUT", ...ZONES]) {
  const pop = z === "TOUT" ? dispo : dispo.filter((r) => r.z === z);
  if (!pop.length) continue;
  console.log(`   ${z.padEnd(10)} ${fmt(contraste(pop, (r) => r.sPB > 0))}  ${fmt(contraste(pop, (r) => r.sCONT > 0))}`);
}

// ── 3. LE MIROIR — un pouvoir discriminant qui n'existe que d'un côté n'en est pas un ───────
console.log(`\n── 3. CONTRÔLE MIROIR (le meilleur contrôle gratuit) ──`);
for (const side of ["BUY", "SELL"]) {
  const pop = dispo.filter((r) => r.side === side);
  console.log(`   ${side.padEnd(10)} PB ${fmt(contraste(pop, (r) => r.sPB > 0))}  CONT ${fmt(contraste(pop, (r) => r.sCONT > 0))}`);
}

// ── 4. QUAND LES DEUX THÈSES SE CONTREDISENT, LAQUELLE A RAISON ? ───────────────────────────
console.log(`\n── 4. DÉSACCORDS — la barre où une thèse dit oui et l'autre non ──`);
for (const z of ["TOUT", ...ZONES]) {
  const pop = z === "TOUT" ? dispo : dispo.filter((r) => r.z === z);
  const pbSeul = grap(pop.filter((r) => r.sPB > 0 && r.sCONT <= 0));
  const coSeul = grap(pop.filter((r) => r.sPB <= 0 && r.sCONT > 0));
  const deux   = grap(pop.filter((r) => r.sPB > 0 && r.sCONT > 0));
  const aucun  = grap(pop.filter((r) => r.sPB <= 0 && r.sCONT <= 0));
  const c = (g) => g && g.n >= NMIN ? `${String(g.n).padStart(4)} ${g.wr.toFixed(1)}%±${g.se.toFixed(1)}` : (g ? `${String(g.n).padStart(4)} ⚠insuf ` : "     —      ");
  console.log(`   ${z.padEnd(10)} PB seul ${c(pbSeul)}   CONT seul ${c(coSeul)}   les 2 ${c(deux)}   aucun ${c(aucun)}`);
}

// ── 5. LES EXPERTS, DANS CETTE CELLULE ──────────────────────────────────────────────────────
console.log(`\n── 5. EXPERTS (score orienté > 0) — contraste par zone ──`);
const experts = [...new Set(rows.flatMap((r) => Object.keys(r.exp ?? {})))];
console.log(`   experts présents : ${experts.join(" · ")}`);
for (const e of experts) {
  const avec = dispo.filter((r) => r.exp?.[e] != null);
  const muet = dispo.length - avec.length;
  const ligne = ["TOUT", ...ZONES].map((z) => {
    const pop = z === "TOUT" ? avec : avec.filter((r) => r.z === z);
    const c = contraste(pop, (r) => orient(r.exp[e], r.side) > 0);
    return c ? `${z}:${((c.d >= 0 ? "+" : "") + c.d.toFixed(1))}${Math.abs(c.sigma) >= 2 ? "⭐" : ""}` : `${z}:—`;
  }).join("  ");
  console.log(`   ${e.padEnd(8)} muet ${String(muet).padStart(5)}  ${ligne}`);
}
console.log("");
