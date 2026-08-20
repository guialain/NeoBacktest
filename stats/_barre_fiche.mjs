// _barre_fiche.mjs — LA FICHE COMPLETE D'UNE BARRE NOMMEE : qui a tire, avec quel score, et de
//   quoi ce score est fait — a cote des indicateurs BRUTS de la meme ligne CSV.
// ============================================================================================
// ⚠ POURQUOI LES INDICATEURS BRUTS A COTE : la question posee sur une barre est toujours « le
//   bareme voit-il ce que je vois ». Sans la ligne CSV en face, on relit le bareme s'expliquer
//   lui-meme. ⭐ `bare = CLOTURE, _s0 = LIVE` — les DEUX sont affichees, la table decide de
//   l'horloge et le lecteur doit pouvoir constater laquelle a servi.
// ⚠ `Σ familles = |sc.exh|` (reconcilie le 20/08) — `parts` est un DIAGNOSTIC, `gapM15` y figure
//   encore alors qu'elle est RETIREE du bareme depuis le 19/08. Ne pas la lire comme un terme.
// ⚙ Usage : `MIN_EXH=15 TS="2026.07.30 16:31" node stats/_barre_fiche.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = "1";
const { runMatrixPortfolio } = await import("file:///C:/Users/Public/Neo-Backtest/src/components/simulations/matrixBacktest.mjs");
const { MIN_EXH, MIN_PRES, MIN_PB, MIN_CONT } = await import("file:///C:/Users/Public/Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";

const envNum = (k, def) => {
  const raw = process.env[k];
  if (raw === undefined || raw === "") return def;
  const v = Number(raw);
  return Number.isFinite(v) ? v : def;
};
const TS = process.env.TS ?? "2026.07.30 16:31";
const MAXOPEN = envNum("MAXOPEN", 100), MAXPERSYMBOL = envNum("MAXPERSYMBOL", 100);

const paths = fs.readdirSync(DIR).filter((x) => x.endsWith(".csv")).map((f) => path.join(DIR, f));
const RUN = runMatrixPortfolio(paths, { maxOpen: MAXOPEN, maxPerSymbol: MAXPERSYMBOL,
  cadenceMin: 2, chargeSpread: true, initialEquity: 10000, riskPct: 1.0 });

// ⭐ FILTRE D'ACTIF OPTIONNEL — sans lui, une plage horaire sort les 19 actifs et la fiche devient
//   illisible. `ASSET=""` (ou absent) = tous.
const ASSET = process.env.ASSET ?? "";
const sig = (RUN.signals ?? []).filter((t) => String(t.tsMT ?? "").startsWith(TS)
  && (!ASSET || String(t.asset ?? t.symbol ?? "") === ASSET));
console.log(`\n══ FICHE DE BARRE — tsMT commence par « ${TS} » ══`);
console.log(`   MIN_EXH ${MIN_EXH} · MIN_PRES ${MIN_PRES} · MIN_PB ${MIN_PB} · MIN_CONT ${MIN_CONT} · capacite ${MAXOPEN}/${MAXPERSYMBOL}`);
console.log(`   tirs trouves : ${sig.length}`);
if (!sig.length) {
  // ⚠ UN RESULTAT VIDE NE SE SIGNALE PAS TOUT SEUL. On dit POURQUOI il peut etre vide.
  console.log(`\n   ⛔ AUCUN TIR sur cette barre. Trois causes possibles, et elles ne se confondent pas :`);
  console.log(`      · la barre n'a produit AUCUN cote (WAIT) ;`);
  console.log(`      · elle a tire mais a une AUTRE minute (elargir TS) ;`);
  console.log(`      · elle a ete refusee par le SPACING (TOO_CLOSE) — elle voulait tirer et n'a pas pu.`);
  const proches = (RUN.signals ?? []).filter((t) => String(t.tsMT ?? "").startsWith(TS.slice(0, 13)));
  console.log(`\n   Tirs dans l'HEURE « ${TS.slice(0, 13)} » : ${proches.length}`);
  for (const t of proches) console.log(`      ${t.tsMT}  ${String(t.asset ?? t.symbol ?? "?").padEnd(12)} ${t.strategy}/${t.side}  score ${t.sc?.exh ?? "—"}  ${t.outcome} ${(t.R ?? 0).toFixed(2)} R`);
  process.exit(0);
}

// ── LA LIGNE CSV BRUTE DE LA MEME BARRE ───────────────────────────────────────────────────────
const ligneCsv = (asset, ts) => {
  const p = path.join(DIR, `${asset}.csv`);
  if (!fs.existsSync(p)) return null;
  const txt = fs.readFileSync(p, "utf8").split(/\r?\n/);
  const head = txt[0].split(";");
  const l = txt.find((x) => x.startsWith(ts));
  if (!l) return null;
  const v = l.split(";");
  return Object.fromEntries(head.map((h, i) => [h, v[i]]));
};
const n = (x) => { const v = Number(x); return Number.isFinite(v) ? v : null; };
const f2 = (x) => (n(x) == null ? "—" : n(x).toFixed(2));

for (const t of sig) {
  const asset = t.asset ?? t.symbol ?? "?";
  console.log(`\n${"═".repeat(92)}`);
  console.log(`  ${t.tsMT}   ${asset}   ${t.strategy} / ${t.side}   →  ${t.outcome}  ${(t.R ?? 0).toFixed(2)} R`);
  console.log(`  entree ${t.entry} · atr ${t.atr} · profil ${t.profile ?? "—"} · regime ${t.regime ?? "—"}`);
  const bx = t.sc?.boxes?.exh;
  console.log(`\n  ── SCORES DES TROIS BOITES ──`);
  console.log(`     ① EXH   ${String(t.sc?.exh ?? "—").padStart(8)}  (seuil ${MIN_EXH})   cote ${bx?.side ?? "—"}  verdict ${bx?.verdict ?? "—"}${bx?.blocked ? `  ⛔ VETO ${(bx.vetoIds ?? []).join(",")}` : ""}`);
  console.log(`     ② PB    ${String(t.sc?.boxes?.pb?.conviction ?? "—").padStart(8)}  (seuil ${MIN_PB})`);
  console.log(`     ③ CONT  ${String(t.sc?.cont ?? "—").padStart(8)}  (seuil ${MIN_CONT})`);
  if (bx?.familles) {
    const som = Object.values(bx.familles).reduce((a, b) => a + b, 0);
    console.log(`\n  ── ① LES 4 FAMILLES (c'est CA qui se somme) ──   Σ = ${som.toFixed(3)}  ${Math.abs(Math.abs(som) - Math.abs(t.sc.exh)) < 0.02 ? "✅ = |score|" : "⚠⚠ NE RECONCILIE PAS"}`);
    for (const [k, v] of Object.entries(bx.familles).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])))
      console.log(`     ${k.padEnd(10)} ${String(v).padStart(9)}   ${(100 * Math.abs(v) / Math.abs(som)).toFixed(1).padStart(5)} % du score`);
    console.log(`\n  ── ① LES ENTREES (\`parts\`, DIAGNOSTIC — ne se somment PAS) ──`);
    for (const [k, v] of Object.entries(bx.parts ?? {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])))
      console.log(`     ${k.padEnd(14)} ${String(v).padStart(9)}`);
    console.log(`     muettes : ${(bx.muets ?? []).join(" · ") || "(aucune)"}`);
  }
  const r = ligneCsv(asset, t.tsMT);
  if (!r) { console.log(`\n  ⚠ ligne CSV introuvable pour ${asset} @ ${t.tsMT}`); continue; }
  console.log(`\n  ── LES INDICATEURS BRUTS DE LA MEME LIGNE  (bare = CLOTURE · _s0 = LIVE) ──`);
  console.log(`     RSI    H4 ${f2(r.rsi_h4).padStart(6)} (live ${f2(r.rsi_h4_s0)})   H1 ${f2(r.rsi_h1).padStart(6)} (live ${f2(r.rsi_h1_s0)})   M15 ${f2(r.rsi_m15).padStart(6)} (live ${f2(r.rsi_m15_s0)})`);
  console.log(`     RSI H1 closes    s1 ${f2(r.rsi_h1_s1)}  s2 ${f2(r.rsi_h1_s2)}  s3 ${f2(r.rsi_h1_s3)}      dRSI h1 ${f2(r.drsi_h1)} / h4 ${f2(r.drsi_h4)}`);
  console.log(`     STOCH  H4  %K ${f2(r.stoch_k_h4_s0).padStart(6)}  %D ${f2(r.stoch_d_h4_s0).padStart(6)}   (K−D ${(n(r.stoch_k_h4_s0) != null && n(r.stoch_d_h4_s0) != null ? (n(r.stoch_k_h4_s0) - n(r.stoch_d_h4_s0)).toFixed(2) : "—")})   K closes s1 ${f2(r.stoch_k_h4_s1)} s2 ${f2(r.stoch_k_h4_s2)} s3 ${f2(r.stoch_k_h4_s3)}`);
  console.log(`     STOCH  H1  %K ${f2(r.stoch_k_h1_s0).padStart(6)}  %D ${f2(r.stoch_d_h1_s0).padStart(6)}   (K−D ${(n(r.stoch_k_h1_s0) != null && n(r.stoch_d_h1_s0) != null ? (n(r.stoch_k_h1_s0) - n(r.stoch_d_h1_s0)).toFixed(2) : "—")})   K closes s1 ${f2(r.stoch_k_h1_s1)} s2 ${f2(r.stoch_k_h1_s2)} s3 ${f2(r.stoch_k_h1_s3)}`);
  console.log(`     STOCH M15  %K ${f2(r.stoch_k_m15_s0).padStart(6)}  %D ${f2(r.stoch_d_m15_s0).padStart(6)}`);
  console.log(`     ADX H1  live ${f2(r.adx14_h1_s0).padStart(6)}   closes c1 ${f2(r.adx14_h1_c1)} c2 ${f2(r.adx14_h1_c2)} c3 ${f2(r.adx14_h1_c3)}      ADX M15 c1 ${f2(r.adx14_m15_c1)}`);
  console.log(`     DI  H1  +DI c1 ${f2(r.plus_di_h1_c1).padStart(6)} c2 ${f2(r.plus_di_h1_c2)} c3 ${f2(r.plus_di_h1_c3)}   |  −DI c1 ${f2(r.minus_di_h1_c1).padStart(6)} c2 ${f2(r.minus_di_h1_c2)} c3 ${f2(r.minus_di_h1_c3)}`);
  console.log(`     Z      H4 ${f2(r.zscore_h4).padStart(6)} (live ${f2(r.zscore_h4_s0)})   H1 ${f2(r.zscore_h1).padStart(6)} (live ${f2(r.zscore_h1_s0)})   M15 ${f2(r.zscore_m15).padStart(6)}   dz_h1 ${f2(r.dz_h1)}`);
  console.log(`     SLOPE  H4 ${f2(r.slope_h4).padStart(6)} (live ${f2(r.slope_h4_s0)})   H1 ${f2(r.slope_h1).padStart(6)} (live ${f2(r.slope_h1_s0)})   dslope h4 ${f2(r.dslope_h4)} / h1 ${f2(r.dslope_h1)}`);
  console.log(`     CLOSES H4  s0 ${r.close_h4_s0} s1 ${r.close_h4_s1} s3 ${r.close_h4_s3}   |  H1  s0 ${r.close_h1_s0} s1 ${r.close_h1_s1} s3 ${r.close_h1_s3}`);
}
console.log("");
