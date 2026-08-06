// _wr_par_champ.mjs — WR DE LA POPULATION COURANTE PAR N'IMPORTE QUEL CHAMP DE LA FICHE DE TRADE.
//   usage : node stats/_wr_par_champ.mjs drsiH4S0 [nbBandes]
// ⭐ Generalise `_wr_par_kd.mjs` : le champ est un ARGUMENT, plus une ligne a editer. Sert au
//   protocole « on eteint tout, le bonus de test rallume une population, on la decrit ».
// ⚠ Le point mort effectif est **75 % DANS LES DEUX MODES DE SPREAD** — le peage ronge le WR, il ne
//   touche pas le R nominal de chaque issue, donc le seuil de rentabilite ne bouge pas. C'est LUI la
//   reference, jamais 50 %.
// ⚠ Nombre de bandes ADAPTATIF : sur une petite population, 20 bandes de 5 percentiles donnent des
//   cases de 10 lignes ou tout est du bruit. On coupe a ~25 episodes par bande minimum.
import { dedupeEpisodes } from "./_episodes.mjs";
// ⭐ CLASSIFICATEUR DU MOTEUR EN OPTION (3e argument `rsidelta`). Les tranches de Δ RSI sont DEJA
//   calibrees — `RSI_DELTA_CUTS = [0,95 · 3,09 · 6,00]`, « mesurees et symetrisees, memes valeurs
//   pour h1 et h4 ». Les recouper en percentiles fabriquerait un SECOND vocabulaire pour la meme
//   grandeur, exactement ce que ce depot refuse partout ailleurs.
// ⚠ VERIFIE AVANT USAGE : `drsi_h4_s0` (colonne du scan) et `rsi_h4_s0 − rsi_h4` (calcule) sont la
//   MEME serie — distributions identiques au centieme, ecart max 0,010, soit l'arrondi a 2 decimales.
//   Sans cette verification on aurait plaque un bareme sur un alias, la faute `dslope_h1_s0`.
import { rsiDeltaCol, RSI_DELTA_COLS }
  from "../../Matrix-Revolution/src/components/robot/engines/scoring/experts/rsiExpert.js";

const CHAMP = process.argv[2];
if (!CHAMP) { console.log("usage : node stats/_wr_par_champ.mjs <champ> [nbBandes]"); process.exit(1); }
const SPREAD = String(process.env.CHARGE_SPREAD ?? "true") !== "false";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2&chargeSpread=${SPREAD}`)).json();
  for (const s of (j.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
// ⚠⚠ `PAR_TIR=1` — COMPTAGE PAR TIR, choix owner du 06/08 « pour faire simple ». Ce qu'il faut
//   savoir en lisant la sortie, et que le bandeau rappelle :
//   ✅ CE QU'ON GAGNE : ~2,2x plus de lignes (398 contre 181 sur la population de test), donc σ par
//      bande divise par ~1,5. C'est ce qui rendait les percentiles illisibles.
//   🔴 CE QU'ON PERD : le nombre de clones DEPEND DE L'ISSUE, donc le WR par tir est BIAISE — mesure
//      sur cette meme population, **73,1 % par tir contre 76,2 % par episode**, 3,1 points d'ecart.
//   ⇒ EN MODE TIR, LA COMPARAISON AU POINT MORT 75 % N'EST PLUS VALIDE EN ABSOLU. Les ecarts ENTRE
//      BANDES restent lisibles — c'est pour ca qu'on l'utilise — mais un « au-dessus du point mort »
//      lu par tir ne veut rien dire. Revenir aux episodes pour trancher.
const PAR_TIR = String(process.env.PAR_TIR ?? "0") === "1";
const base = all.filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");
const ep = PAR_TIR ? base
                   : dedupeEpisodes(all, (s) => s.asset)
                       .filter((s) => s.outcome === "WIN" || s.outcome === "LOSS");
const avec = ep.filter((s) => Number.isFinite(s[CHAMP]));

const BE = 75;
const st = (t) => {
  const w = t.filter((x) => x.outcome === "WIN").length, n = t.length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const s0 = n ? Math.sqrt(0.75 * 0.25 / n) * 100 : NaN;
  return { n, w, l: n - w, wr: n ? 100 * w / n : NaN, R, sig: (100 * w / n - BE) / s0 };
};
const line = (lbl, t) => {
  if (!t.length) return;
  const s = st(t);
  console.log(lbl.padEnd(30) + `n=${String(s.n).padStart(4)}  W=${String(s.w).padStart(3)} L=${String(s.l).padStart(3)}  ` +
    `WR ${s.wr.toFixed(1).padStart(5)} %  ${(s.sig >= 0 ? "+" : "") + s.sig.toFixed(2)} σ${Math.abs(s.sig) >= 2 ? " ⭐" : "  "}  ` +
    `R ${(s.R >= 0 ? "+" : "") + s.R.toFixed(1)}`);
};

console.log((SPREAD ? "[spread FACTURÉ]" : "[HORS SPREAD]  ⚠ non comparable aux baselines") +
  (PAR_TIR ? "  [PAR TIR ⚠ WR BIAISÉ — comparer les bandes ENTRE ELLES, pas au point mort]"
           : "  [PAR ÉPISODE]"));
console.log(`champ « ${CHAMP} »   ·   σ calculé contre le point mort 75 %\n`);
line("POPULATION ENTIÈRE", ep);
line(`  dont ${CHAMP} présent`, avec);
const abs = ep.length - avec.length;
if (abs) console.log(`  ⚠ ${abs} épisode(s) sans ce champ — EXCLUS des bandes, pas comptés 0`);

// ── LE SIGNE, d'abord : c'est la coupure la plus simple et souvent la seule actionnable ──────
console.log("\n── PAR SIGNE ──");
line("  < 0", avec.filter((s) => s[CHAMP] < 0));
line("  = 0", avec.filter((s) => s[CHAMP] === 0));
line("  > 0", avec.filter((s) => s[CHAMP] > 0));

// ── PUIS LES BANDES DE PERCENTILES ───────────────────────────────────────────────────────────
// ── SOIT LES TRANCHES DU MOTEUR, SOIT DES PERCENTILES ────────────────────────────────────────
if (String(process.argv[3] ?? "") === "rsidelta") {
  console.log("\n── TRANCHES `rsiDeltaCol` DU MOTEUR — cuts [0,95 · 3,09 · 6,00], calibrées, h1 ET h4 ──");
  let vus = 0;
  for (const col of RSI_DELTA_COLS) {
    const v = avec.filter((s) => rsiDeltaCol(s[CHAMP]) === col);
    vus += v.length;
    line(`  ${col}`, v);
  }
  const orph = avec.length - vus;
  if (orph) console.log(`  ⚠ ${orph} ligne(s) non classées — à expliquer avant de lire le reste`);
  process.exit(0);
}
const NB = Number(process.argv[3]) || Math.max(4, Math.min(20, Math.floor(avec.length / 25)));
console.log(`\n── ${NB} BANDES DE PERCENTILES (≈${Math.round(avec.length / NB)} épisodes/bande) ──`);
const tri = [...avec].sort((a, b) => a[CHAMP] - b[CHAMP]);
const N = tri.length, pas = 100 / NB;
for (let i = 0; i < NB; i++) {
  const a = Math.floor(i * N / NB), b = Math.floor((i + 1) * N / NB);
  const v = tri.slice(a, b); if (!v.length) continue;
  line(`  P${String(Math.round(i * pas)).padStart(2)}-${String(Math.round((i + 1) * pas)).padStart(3)} ` +
       `[${v[0][CHAMP].toFixed(2)} · ${v[v.length - 1][CHAMP].toFixed(2)}]`, v);
}
