// v3_eval_exh.mjs — LES CRITÈRES D'ÉVAL EXH, SUR LA POPULATION LÉGITIME DE LA FIGURE.
// ============================================================================================
// PÉRIMÈTRE : zones `XAR` + `AR` seulement (le fade lu DEPUIS l'extrême dont le prix revient).
//   `AV`/`XAV` sont exclus non parce qu'ils sont mauvais, mais parce que le garde-fou du routeur
//   les a sortis de l'EXH : ce sont des barres qu'on ne LIT plus comme un fade. Les garder ici
//   mesurerait des critères sur une population que l'éval ne verra jamais.
// ⚠ `MID` est EXCLU AUSSI, et c'est un choix à assumer : la règle ① ne le couvre pas, donc l'EXH
//   continue de l'évaluer en production. Il est écarté ICI parce que la figure « fader l'extrême »
//   ne le décrit pas — mais ça laisse le MID sans critères, et c'est une dette nommée.
//
// ⭐⭐⭐ THÈSES AVANT CHIFFRES. Chaque candidat est écrit avec la raison pour laquelle il DEVRAIT
//   séparer, avant qu'on regarde s'il le fait. Sans ça, on lit 20 contrastes et on garde les 2 qui
//   brillent — c'est-à-dire qu'on fabrique une règle avec le bruit.
// ⚠ CONTRASTE, PAS NIVEAU : aucune éval n'existe encore, donc le WR de la population n'est pas une
//   connaissance. Seul l'ÉCART entre deux classes de la MÊME population veut dire quelque chose.
// ⚠ Voix par grappe ACTIF × JOUR · n ≥ 30 des deux côtés · P1 et P2 de même signe · miroir BUY/SELL.
import fs from "fs";

const NMIN = Number(process.env.NMIN ?? 30);
const rows0 = fs.readFileSync("analyse_out/v3/tirs.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
const ZONE_TS = {
  BUY:  { EXTREME_BASSE: "XAR", BASSE: "AR", MID: "MID", HAUTE: "AV", EXTREME_HAUTE: "XAV" },
  SELL: { EXTREME_HAUTE: "XAR", HAUTE: "AR", MID: "MID", BASSE: "AV", EXTREME_BASSE: "XAV" },
};
const MIR_DK = { EXPLOSIVE_DOWN: "EXPLOSIVE_UP", FAST_DOWN: "FAST_UP", SOFT_DOWN: "SOFT_UP", FLAT: "FLAT",
                 SOFT_UP: "SOFT_DOWN", FAST_UP: "FAST_DOWN", EXPLOSIVE_UP: "EXPLOSIVE_DOWN" };
const orient = (v, side) => (v == null ? null : side === "BUY" ? v : -v);

const POP = rows0.filter((r) => Number.isFinite(r.R)).map((r) => ({
  ...r,
  z: ZONE_TS[r.side]?.[r.zone] ?? null,
  sExh: orient(r.exhRaw, r.side),
  kdPour: r.kdGap == null ? null : (orient(r.kdGap, r.side) > 0 ? "POUR" : "CONTRE"),
  dk: r.dkBand == null ? null : (r.side === "BUY" ? r.dkBand : (MIR_DK[r.dkBand] ?? r.dkBand)),
  eDi: orient(r.exp?.di, r.side), eRsi: orient(r.exp?.rsi, r.side),
  eGap: orient(r.exp?.gap, r.side), eKd: orient(r.exp?.kd, r.side),
})).filter((r) => r.z === "XAR" || r.z === "AR");

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
const L = (c) => c ? `${String(c.a.n).padStart(4)}/${String(c.b.n).padStart(4)}  Δ${((c.d >= 0 ? "+" : "") + c.d.toFixed(1)).padStart(6)} ±${c.se.toFixed(1)}  σ${((c.sigma >= 0 ? "+" : "") + c.sigma.toFixed(2)).padStart(6)}${Math.abs(c.sigma) >= 2 ? " ⭐" : ""}`
                   : "                (insuffisant)              ";

// ── LES CANDIDATS, AVEC LEUR THÈSE ÉCRITE D'ABORD ───────────────────────────────────────────
const CANDIDATS = [
  { nom: "sExh > 0 (le score de fade lui-même)", muet: (r) => r.sExh == null, f: (r) => r.sExh > 0,
    these: "Si le barème d'exhaustion vaut quelque chose, son propre score doit séparer. C'est le\n" +
           "           contrôle de base : un scoreur qui ne trie pas sa propre figure n'a pas d'éval à calibrer." },
  { nom: "expert kd > 0", muet: (r) => r.eKd == null, f: (r) => r.eKd > 0,
    these: "Le K/D décrit la géométrie du retournement — croisement, écart, sens. C'est l'expert le plus\n" +
           "           proche de la figure : si un épuisement se voit, il se voit là." },
  { nom: "expert rsi > 0", muet: (r) => r.eRsi == null, f: (r) => r.eRsi > 0,
    these: "Le RSI mesure la saturation. Fader suppose qu'il y ait quelque chose à épuiser : sans\n" +
           "           saturation, la figure est vide même si la géométrie est jolie." },
  { nom: "expert di > 0", muet: (r) => r.eDi == null, f: (r) => r.eDi > 0,
    these: "Les DI disent QUI contrôle. Un fade contre un camp qui domine encore franchement est un\n" +
           "           fade prématuré — le DI devrait donc pénaliser les entrées trop tôt." },
  { nom: "expert gap > 0", muet: (r) => r.eGap == null, f: (r) => r.eGap > 0,
    these: "Le `gap` = (P − M)/ATR : l'étirement du prix par rapport à sa moyenne. Plus le prix est\n" +
           "           tendu, plus le rappel est probable. C'est la thèse du fade la plus directe qui soit." },
  { nom: "kdPour = POUR (%K domine %D dans le sens du trade)", muet: (r) => r.kdPour == null, f: (r) => r.kdPour === "POUR",
    these: "Le retournement est CONSTATÉ plutôt qu'anticipé. Mesuré ailleurs : nul en global mais +5,8\n" +
           "           au MID et −5,6 hors MID ⇒ ici, en zone d'extrême, on attend du NÉGATIF ou rien." },
  { nom: "dk rapide DANS le sens du trade", muet: (r) => r.dk == null, f: (r) => ["FAST_UP", "EXPLOSIVE_UP"].includes(r.dk),
    these: "%K qui accélère DANS le sens du trade = le mouvement s'est déjà retourné et court. On arrive\n" +
           "           après. Mesuré ailleurs : −8,9 σ−3,49, miroir ⇒ on attend une confirmation ici." },
  { nom: "dailyForce ≥ HIGH", muet: (r) => r.force == null, f: (r) => ["HIGH", "EXTREME"].includes(r.force),
    these: "Le jour a de l'amplitude, donc il y a quelque chose à épuiser. ⚠ Fort côté BUY, nul côté\n" +
           "           SELL sur la mesure du matin — le contrôle miroir est ici l'essentiel." },
  { nom: "kdCur = CONTACT", muet: (r) => r.kdCur == null, f: (r) => r.kdCur === "CONTACT",
    these: "Les deux lignes se touchent : le retournement est au bord de se produire. Meilleure\n" +
           "           morphologie en global (74,3 %) alors que la table l'excluait partout." },
];

console.log("═".repeat(104));
console.log("  CRITÈRES D'ÉVAL EXH — population LÉGITIME de la figure (zones XAR + AR)");
console.log("═".repeat(104));
const base = grap(POP);
console.log(`  ${POP.length} tirs · ${base.n} grappes actif×jour · WR brut ${base.wr.toFixed(1)} % ±${base.se.toFixed(1)}`);
console.log("  ⚠ ce WR n'est PAS une connaissance : population non affinée. Seuls les CONTRASTES comptent.");
console.log(`  contrôles : n ≥ ${NMIN} des deux côtés · P1 et P2 de même signe · miroir BUY/SELL`);

const retenus = [];
for (const c of CANDIDATS) {
  const avec = POP.filter((r) => !c.muet(r));
  const muet = POP.length - avec.length;
  console.log(`\n── ${c.nom}`);
  console.log(`   thèse : ${c.these}`);
  if (muet) console.log(`   ⚠ MUET sur ${muet} tirs (${(100 * muet / POP.length).toFixed(0)} %) — exclus, jamais comptés 0`);
  const tout = contraste(avec, c.f);
  const p1 = contraste(avec.filter((r) => r.periode === "P1"), c.f);
  const p2 = contraste(avec.filter((r) => r.periode === "P2"), c.f);
  const buy = contraste(avec.filter((r) => r.side === "BUY"), c.f);
  const sell = contraste(avec.filter((r) => r.side === "SELL"), c.f);
  console.log(`   TOUT   ${L(tout)}`);
  console.log(`   P1     ${L(p1)}`);
  console.log(`   P2     ${L(p2)}`);
  console.log(`   BUY    ${L(buy)}`);
  console.log(`   SELL   ${L(sell)}`);
  if (!tout) { console.log("   ⇒ ❌ effectif insuffisant"); continue; }
  const okP = p1 && p2 && Math.sign(p1.d) === Math.sign(tout.d) && Math.sign(p2.d) === Math.sign(tout.d);
  const okM = buy && sell && Math.sign(buy.d) === Math.sign(sell.d);
  const okS = Math.abs(tout.sigma) >= 2;
  const verdict = okS && okP && okM ? "✅ RETENU" : "❌ écarté";
  console.log(`   ⇒ ${verdict}   σ≥2 ${okS ? "oui" : "NON"} · P1/P2 cohérents ${okP ? "oui" : "NON"} · miroir ${okM ? "oui" : "NON"}`);
  if (okS && okP && okM) retenus.push({ ...c, tout, buy, sell });
}

console.log(`\n${"═".repeat(104)}\n  BILAN — ${retenus.length} critère(s) sur ${CANDIDATS.length} candidats\n${"═".repeat(104)}`);
for (const r of retenus)
  console.log(`  ✅ ${r.nom.padEnd(48)} Δ${((r.tout.d >= 0 ? "+" : "") + r.tout.d.toFixed(1)).padStart(6)} σ${r.tout.sigma.toFixed(2).padStart(6)}   BUY ${r.buy.d.toFixed(1).padStart(6)} · SELL ${r.sell.d.toFixed(1).padStart(6)}`);
console.log(`\n  ⚠ ${CANDIDATS.length} candidats testés, tous posés AVANT lecture. À |σ| ≥ 2 on attend ≈ ${(CANDIDATS.length * 0.045).toFixed(1)} faux positif(s).`);
console.log("");
