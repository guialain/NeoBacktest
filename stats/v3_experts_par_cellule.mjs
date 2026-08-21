// v3_experts_par_cellule.mjs — QUELS DISCRIMINANTS VIVENT DANS CHAQUE CELLULE ?
// ============================================================================================
// ⭐⭐⭐ LE CHANGEMENT DE QUESTION. Jusqu'ici : « quelles zones trader ? ». Désormais : « chaque
//   cellule évalue, avec quoi ? ». Un axe NUL EN GLOBAL peut être le meilleur expert d'UNE cellule
//   — c'est déjà mesuré : la relation K/D vaut +1,9/+1,1 sur toute la population et **+6,6 au MID**.
//   Chercher les discriminants globalement, c'est moyenner des cellules qui ne se ressemblent pas.
//
// ⚠⚠ CE QUE CE SCRIPT NE PEUT PAS ENCORE FAIRE, ET IL FAUT LE SAVOIR EN LISANT SA SORTIE :
//   les tables figées portent les CINQ AXES GÉOMÉTRIQUES (zone · kdCur · kdGap · dailyForce ·
//   ΔK band), PAS les scores des experts du moteur (`di`, `rsi`, `gap`, `kd`, `zscore`, qui vivent
//   dans `sc.exp` de la fiche et n'ont pas été extraits). ⇒ ce qui suit propose des CANDIDATS
//   géométriques ; la liste « experts × cellule » au sens du moteur demande une extraction de plus.
//
// ── DISCIPLINE ANTI-CUEILLETTE, APPLIQUÉE PAR LE CODE ────────────────────────────────────────
//   ① une voix par grappe ACTIF × JOUR (les tirs ne sont pas indépendants : facteur ~9 sur le σ)
//   ② n ≥ NMIN grappes DANS la classe ET dans son complément
//   ③ Δ de MÊME SIGNE en P1 et en P2 — un discriminant qui change de camp entre les moitiés n'en
//      est pas un
//   ④ le Δ est calculé contre la baseline DE SA CELLULE × SA ZONE, jamais contre un agrégat
// ⚠ MULTIPLICITÉ ASSUMÉE ET AFFICHÉE : 20 cellules × 4 axes × leurs classes, c'est ~200 tests. À
//   2 σ on attend ~10 faux positifs par pur hasard. Le script COMPTE les tests et le rappelle —
//   un σ isolé dans cette sortie ne vaut rien, seul un motif répété entre cellules voisines compte.
import fs from "fs";

const NMIN = Number(process.env.NMIN ?? 30);
const SIG  = Number(process.env.SIG ?? 2);
const lire = (d) => fs.readFileSync(`${d}/tirs.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l));

const ZONE_TS = {
  BUY:  { EXTREME_BASSE: "XAR", BASSE: "AR", MID: "MID", HAUTE: "AV", EXTREME_HAUTE: "XAV" },
  SELL: { EXTREME_HAUTE: "XAR", HAUTE: "AR", MID: "MID", BASSE: "AV", EXTREME_BASSE: "XAV" },
};
const ZONES_TS = ["XAR", "AR", "MID", "AV", "XAV"];
const MIR_DK = { EXPLOSIVE_DOWN: "EXPLOSIVE_UP", FAST_DOWN: "FAST_UP", SOFT_DOWN: "SOFT_UP", FLAT: "FLAT",
                 SOFT_UP: "SOFT_DOWN", FAST_UP: "FAST_DOWN", EXPLOSIVE_UP: "EXPLOSIVE_DOWN" };

const prep = (rows) => rows.filter((r) => Number.isFinite(r.R)).map((r) => ({
  ...r,
  z: ZONE_TS[r.side]?.[r.zone] ?? null,
  // orientés par le côté du TRADE — une seule convention pour les deux branches
  kdPour: r.kdGap == null ? null : ((r.side === "BUY" ? r.kdGap : -r.kdGap) > 0 ? "POUR" : "CONTRE"),
  dk: r.dkBand == null ? null : (r.side === "BUY" ? r.dkBand : (MIR_DK[r.dkBand] ?? r.dkBand)),
}));

const POP = { EXH: prep(lire("analyse_out/v3")), CONT: prep(lire("analyse_out/v3c")) };
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

const AXES = {
  kdPour: ["POUR", "CONTRE"],
  kdCur:  ["CROSS", "DIVERGING", "STABLE", "CONTACT", "CONVERGING"],
  force:  ["LOW", "MEDIUM", "HIGH", "EXTREME"],
  dk:     ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"],
};

let tests = 0;
const retenus = [];
console.log("═".repeat(104));
console.log("  CANDIDATS-EXPERTS PAR CELLULE — Δ contre la baseline de SA cellule × SA zone");
console.log("═".repeat(104));
console.log(`  ① voix par grappe actif×jour  ② n ≥ ${NMIN} des deux côtés du split  ③ P1 et P2 de même signe  ④ |σ| ≥ ${SIG}`);

for (const strategy of ["EXH", "CONT"]) for (const side of ["BUY", "SELL"]) {
  const cellule = `${strategy}_${side}`;
  for (const z of ZONES_TS) {
    const pop = POP[strategy].filter((r) => r.side === side && r.z === z);
    const base = grap(pop);
    if (!base || base.n < NMIN) {
      console.log(`\n── ${cellule} · ${z}  —  ${base ? base.n : 0} grappes : SOUS LE SEUIL, aucune conclusion (la cellule évalue quand même, en TRÈS EXIGEANTE)`);
      continue;
    }
    console.log(`\n── ${cellule} · ${z}   base ${base.n} grappes · ${base.wr.toFixed(1)} % ±${base.se.toFixed(1)}   (${pop.length} tirs)`);
    const lignes = [];
    for (const [axe, classes] of Object.entries(AXES)) for (const v of classes) {
      const dans = pop.filter((r) => r[axe] === v), hors = pop.filter((r) => r[axe] != null && r[axe] !== v);
      const a = grap(dans), b = grap(hors);
      if (!a || !b || a.n < NMIN || b.n < NMIN) continue;
      tests++;
      const d = a.wr - b.wr, se = Math.sqrt(a.se ** 2 + b.se ** 2), sigma = d / se;
      if (Math.abs(sigma) < SIG) continue;
      // ③ cohérence P1/P2 — mesurée sur le MÊME split
      const p = ["P1", "P2"].map((P) => {
        const x = grap(dans.filter((r) => r.periode === P)), y = grap(hors.filter((r) => r.periode === P));
        return (x && y) ? x.wr - y.wr : null;
      });
      const coherent = p[0] != null && p[1] != null && Math.sign(p[0]) === Math.sign(d) && Math.sign(p[1]) === Math.sign(d);
      lignes.push({ axe, v, a, d, se, sigma, p, coherent });
      if (coherent) retenus.push({ cellule, z, axe, v, d, sigma, n: a.n, p });
    }
    if (!lignes.length) { console.log("     (aucun axe ne dépasse le seuil sur cette cellule)"); continue; }
    for (const L of lignes.sort((x, y) => Math.abs(y.sigma) - Math.abs(x.sigma)))
      console.log(`     ${L.coherent ? "✅" : "❌"} ${(L.axe + " = " + L.v).padEnd(28)} n=${String(L.a.n).padStart(3)} ` +
        `${L.a.wr.toFixed(1).padStart(5)}%  Δ${((L.d >= 0 ? "+" : "") + L.d.toFixed(1)).padStart(6)} ±${L.se.toFixed(1)} ` +
        `σ${((L.sigma >= 0 ? "+" : "") + L.sigma.toFixed(2)).padStart(6)}   P1 ${L.p[0] == null ? "—" : L.p[0].toFixed(1)} · P2 ${L.p[1] == null ? "—" : L.p[1].toFixed(1)}` +
        `${L.coherent ? "" : "   ❌ ③ P1/P2 discordants"}`);
  }
}

console.log(`\n${"═".repeat(104)}`);
console.log(`  BILAN — ${tests} tests effectués, ${retenus.length} retenus (les 4 contrôles passés).`);
console.log(`  ⚠ À |σ| ≥ ${SIG} sur ${tests} tests, on attend ≈ ${(tests * 0.045).toFixed(0)} faux positifs par pur HASARD.`);
console.log("  ⇒ NE RIEN RETENIR SUR UN σ ISOLÉ. Seul compte un MOTIF qui se répète entre cellules voisines,");
console.log("     ou entre les deux côtés d'une même stratégie (le miroir est le meilleur contrôle gratuit).");
console.log("═".repeat(104));
console.log("\n  MOTIFS RÉPÉTÉS — un même (axe, classe) retenu dans PLUSIEURS cellules :");
const parMotif = {};
for (const r of retenus) (parMotif[`${r.axe}=${r.v}`] ??= []).push(r);
for (const [m, rs] of Object.entries(parMotif).sort((a, b) => b[1].length - a[1].length)) {
  if (rs.length < 2) continue;
  console.log(`\n   ${m}  —  ${rs.length} cellules`);
  for (const r of rs) console.log(`      ${r.cellule.padEnd(10)} ${r.z.padEnd(4)} Δ${((r.d >= 0 ? "+" : "") + r.d.toFixed(1)).padStart(6)} σ${r.sigma.toFixed(2).padStart(6)} n=${r.n}`);
}
const seuls = Object.entries(parMotif).filter(([, rs]) => rs.length === 1);
if (seuls.length) {
  console.log(`\n  ISOLÉS (une seule cellule — à traiter comme du bruit tant qu'ils ne se répètent pas) :`);
  for (const [m, rs] of seuls) console.log(`      ${m.padEnd(28)} ${rs[0].cellule} · ${rs[0].z}  σ${rs[0].sigma.toFixed(2)}`);
}
console.log("");
