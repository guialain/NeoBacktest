// _theta_relatif.mjs — LEADER OU SUIVEUR ? Le theta RELATIF gradue-t-il la case « passager » ?
//
// Idée owner : « passager » implique un conducteur. Un actif peut PORTER le mouvement du marché ou
// être TRAÎNÉ par lui. Si c'est un vrai observable, il doit graduer la case où on l'a rencontré.
//
// ⚠ ON NE MESURE PAS DU TIMING. Une corrélation croisée décalée classerait les actifs par DÉBIT DE
//   TICKS (92× d'écart entre US_TECH100 et COCOA) : celui qui se met à jour le plus souvent paraît
//   toujours mener. Et une avance de quelques minutes n'est pas exploitable sur des trades de
//   48–129 min. On mesure donc une AMPLITUDE RELATIVE, insensible au débit.
//
//   rel = (vote_actif × signe(M)) / |M|      avec M = consensus du marché SANS cet actif
//     rel > 1   l'actif bouge PLUS que le consensus, dans son sens  → il PORTE
//     rel ≈ 1   il participe
//     0 < rel < 1  il bouge MOINS que le consensus                  → il est TRAÎNÉ (passager)
//     rel < 0   il va contre                                        → il RÉSISTE
//
// ⭐ LEAVE-ONE-OUT OBLIGATOIRE : l'actif contribue à son propre consensus (jusqu'à 12,5 % pour un
//   CRYPTO, 2 actifs dans la famille). Sans l'exclure, `rel` serait corrélé à lui-même par
//   construction et la table montrerait un effet qui n'est qu'un artefact d'algèbre.
// ⚠ GOLD / SILVER / COCOA EXCLUS : ils ne votent pas (l'or a deux rôles), donc pas de `riskDir`,
//   donc pas de theta orienté. 16 actifs sur 19.
// ⚠ |M| ≥ 0,30 dans la case étudiée (c'est sa définition) : le dénominateur est borné loin de zéro,
//   le ratio est stable. Ce ne serait PAS vrai hors de la case.
import fs from "fs";
import path from "path";
import { computeThetaVector } from "../../Matrix-Revolution/src/components/robot/engines/config/ThetaConfig.js";

const API = "http://localhost:3001/api/matrix";
const DIR = "data/matrix";
const IN_END = "2026-07-24", OOS_START = "2026-07-27";
const GAP = 240, BE = 75, COH_SEUIL = 0.30, ADX_SEUIL = 33;

const RISK_DIR = { EURUSD: +1, GBPUSD: +1, AUDUSD: +1, USDCAD: -1, USDCHF: -1, USDJPY: -1,
  GERMANY_40: +1, UK_100: +1, US_30: +1, US_500: +1, US_TECH100: +1,
  BTCUSD: +1, ETHUSD: +1, BRENT_OIL: +1, CrudeOIL: +1, GASOLINE: +1 };
const FAM = { EURUSD: "FX", GBPUSD: "FX", AUDUSD: "FX", USDCAD: "FX", USDCHF: "FX", USDJPY: "FX",
  GERMANY_40: "INDEX", UK_100: "INDEX", US_30: "INDEX", US_500: "INDEX", US_TECH100: "INDEX",
  BTCUSD: "CRYPTO", ETHUSD: "CRYPTO", BRENT_OIL: "ENERGY", CrudeOIL: "ENERGY", GASOLINE: "ENERGY" };

// ── votes par ep : somme et effectif PAR FAMILLE (pour pouvoir retirer un actif ensuite) ────────
const famSum = new Map(), famCnt = new Map(), voteOf = {};
for (const f of fs.readdirSync(DIR).filter((x) => x.toLowerCase().endsWith(".csv"))) {
  const asset = f.replace(/\.csv$/i, ""); if (!FAM[asset]) continue;
  const L = fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/);
  const h = L[0].split(";"); const idx = Object.fromEntries(h.map((c, i) => [c, i]));
  const cols = ["intraday_change", "timestamp", "ts_utc", "open_d1_s0", "is_active"];
  const mine = new Map();
  for (let i = 1; i < L.length; i++) {
    const c = L[i].split(";"); if (c.length < h.length) continue;
    const row = {}; for (const k of cols) if (idx[k] != null) row[k] = c[idx[k]];
    if (row.is_active != null && row.is_active !== "" && Number(row.is_active) === 0) continue;
    const ep = Math.round(Date.parse(row.ts_utc) / 60000); if (!Number.isFinite(ep)) continue;
    const tv = computeThetaVector(row, asset); if (tv.thetaDayDeg == null) continue;
    const v = (tv.thetaDayDeg / 90) * RISK_DIR[asset];
    mine.set(ep, v);
    const s = famSum.get(ep) ?? famSum.set(ep, {}).get(ep);
    const n = famCnt.get(ep) ?? famCnt.set(ep, {}).get(ep);
    s[FAM[asset]] = (s[FAM[asset]] ?? 0) + v; n[FAM[asset]] = (n[FAM[asset]] ?? 0) + 1;
  }
  voteOf[asset] = mine;
}
// consensus COMPLET (pour la cohérence, comme dans _coherence_v1) et consensus SANS un actif donné.
const cohOf = new Map();
for (const [ep, s] of famSum) {
  const n = famCnt.get(ep);
  const vf = Object.keys(s).map((k) => s[k] / n[k]);
  if (vf.length >= 3) cohOf.set(ep, Math.abs(vf.reduce((a, b) => a + b, 0) / vf.length));
}
const mSans = (ep, asset) => {
  const s = famSum.get(ep), n = famCnt.get(ep); if (!s) return null;
  const fa = FAM[asset], v = voteOf[asset]?.get(ep);
  const vf = [];
  for (const k of Object.keys(s)) {
    if (k === fa && v != null) { if (n[k] <= 1) continue; vf.push((s[k] - v) / (n[k] - 1)); }
    else vf.push(s[k] / n[k]);
  }
  return vf.length >= 3 ? vf.reduce((a, b) => a + b, 0) / vf.length : null;
};

// ── trades ────────────────────────────────────────────────────────────────────────────────────
const assets = await (await fetch(`${API}/assets`)).json();
const all = [];
for (const a of assets) {
  if (!FAM[a]) continue;                                    // GOLD/SILVER/COCOA hors test
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const mine = (j.signals || []).filter((s) => typeof s.R === "number").map((s) => {
    const ep = s.openEp ?? s.ep;
    const M = mSans(ep, a), v = voteOf[a]?.get(ep);
    const rel = (M == null || v == null || Math.abs(M) < 1e-6) ? null : (v * Math.sign(M)) / Math.abs(M);
    return { R: s.R, out: s.outcome, asset: a, exh: s.type === "EXHAUSTION", ep, adx: s.adx,
             d: new Date(ep * 60000).toISOString().slice(0, 10), coh: cohOf.get(ep) ?? null, rel };
  }).sort((x, y) => x.ep - y.ep);
  let epi = 0, prev = -Infinity;
  for (const t of mine) { if (t.ep - prev > GAP) epi++; prev = t.ep; t.epi = `${a}|${epi}`; }
  all.push(...mine);
}

const stat = (s) => {
  const w = s.filter((x) => x.out === "WIN").length, l = s.filter((x) => x.out === "LOSS").length;
  return { n: s.length, ep: new Set(s.map((x) => x.epi)).size, j: new Set(s.map((x) => x.d)).size,
           m: (w + l) ? w / (w + l) * 100 - BE : null };
};
const fmt = (t) => t.n === 0 ? "       —        "
  : `${String(t.j).padStart(2)}j ${String(t.ep).padStart(3)}ép ${String(t.n).padStart(4)}tr ${((t.m >= 0 ? "+" : "") + t.m.toFixed(2)).padStart(6)}${t.j < 8 ? "⚠" : " "}`;

const BANDES = [[-99, 0, "RÉSISTE      rel < 0"], [0, 0.5, "TRAÎNÉ fort  0–0,5"],
                [0.5, 1, "traîné       0,5–1"], [1, 2, "participe    1–2"],
                [2, 999, "PORTE        rel > 2"]];

const OK = all.filter((x) => x.rel != null && x.coh != null && Number.isFinite(x.adx));
const PASS = OK.filter((x) => x.adx < ADX_SEUIL && x.coh >= COH_SEUIL);
console.log(`16 actifs votants · ${OK.length} trades exploitables · case passager : ${PASS.length}`);

console.log(`\n${"=".repeat(74)}\n=== ⭐ LE TEST — theta relatif DANS la case passager (ADX H1 < ${ADX_SEUIL} · coh ≥ ${COH_SEUIL})\n${"=".repeat(74)}`);
console.log(`bande de theta relatif        EXH                        CONT`);
for (const [lo, hi, lbl] of BANDES) {
  const s = PASS.filter((x) => x.rel >= lo && x.rel < hi);
  console.log(`${lbl.padEnd(26)} ${fmt(stat(s.filter((x) => x.exh)))}   ${fmt(stat(s.filter((x) => !x.exh)))}`);
}
console.log(`${"— toute la case —".padEnd(26)} ${fmt(stat(PASS.filter((x) => x.exh)))}   ${fmt(stat(PASS.filter((x) => !x.exh)))}`);

// CONTRÔLE : `rel` agit-il PARTOUT, ou seulement dans la case ? Si partout, ce n'est pas un
//   graduateur du passager, c'est un observable indépendant — autre conclusion, autre suite.
console.log(`\n=== CONTRÔLE — la même table HORS de la case (le reste du carnet) ===`);
const HORS = OK.filter((x) => !(x.adx < ADX_SEUIL && x.coh >= COH_SEUIL));
console.log(`bande de theta relatif        EXH                        CONT`);
for (const [lo, hi, lbl] of BANDES) {
  const s = HORS.filter((x) => x.rel >= lo && x.rel < hi);
  console.log(`${lbl.padEnd(26)} ${fmt(stat(s.filter((x) => x.exh)))}   ${fmt(stat(s.filter((x) => !x.exh)))}`);
}

console.log(`\n=== STABILITÉ dans la case — EXH, par fenêtre ===`);
for (const [lo, hi, lbl] of BANDES) {
  const s = PASS.filter((x) => x.rel >= lo && x.rel < hi && x.exh);
  console.log(`${lbl.padEnd(26)} calib ${fmt(stat(s.filter((x) => x.d <= IN_END)))}   vérif ${fmt(stat(s.filter((x) => x.d >= OOS_START)))}`);
}

// Le test tient-il si on compte les SIGNES par actif plutôt que les amplitudes ?
console.log(`\n=== SIGNES PAR ACTIF — « traîné (rel<1) » vs « porte (rel≥1) », marge EXH ===`);
let plusBas = 0, plusHaut = 0, ex = 0;
for (const a of [...new Set(PASS.map((x) => x.asset))].sort()) {
  const b = stat(PASS.filter((x) => x.asset === a && x.exh && x.rel < 1));
  const h = stat(PASS.filter((x) => x.asset === a && x.exh && x.rel >= 1));
  if (b.m == null || h.m == null) { ex++; continue; }
  b.m < h.m ? plusBas++ : plusHaut++;
  console.log(`${a.padEnd(12)} traîné ${fmt(b)}   porte ${fmt(h)}   ${b.m < h.m ? "✓ traîné pire" : "✗ traîné mieux"}`);
}
console.log(`\n⇒ « traîné pire que portant » sur ${plusBas}/${plusBas + plusHaut} actifs (${ex} sans données)`);
