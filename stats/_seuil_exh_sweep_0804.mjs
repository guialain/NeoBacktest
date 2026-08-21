// _seuil_exh_sweep_0804.mjs — QUE RETIRE CHAQUE COUPE DE `SCORE_MIN_EXH` ?
// ⚠ MÉTHODE : on ne rejoue PAS le moteur à chaque seuil — on RECLASSE les fades déjà tirés par leur
//   conviction. C'est valide parce que le seuil ne fait que RETIRER : dans l'arbre binaire, un EXH
//   admis sous le seuil fait DROP et ne repart PAS en CONT. Aucune barre ne change de thèse.
// ⚠⚠ CE QUE ÇA NE MODÉLISE PAS : l'ENCOMBREMENT. Retirer des fades libère des créneaux (`maxOpen`,
//   spacing) et d'autres trades prendraient leur place. Les chiffres ci-dessous sont donc un
//   MINORANT de l'effet réel — c'est une COHORTE, pas un net. Même réserve que la méthode du fantôme.
import { dedupeEpisodes } from "./_episodes.mjs";

const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all = [];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) all.push({ ...s, asset: a });
}
const ep = dedupeEpisodes(all, (s) => s.asset);
const conv = (s) => { const c = s?.sc?.exhConviction; return Number.isFinite(c) ? c : (Number.isFinite(s?.score) ? Math.abs(s.score) / 10 : null); };
const exh  = ep.filter((s) => s.type === "EXHAUSTION").map((s) => ({ ...s, c: conv(s) })).filter((s) => Number.isFinite(s.c));
const cont = ep.filter((s) => s.type !== "EXHAUSTION");

const wr  = (v) => { const w = v.filter((x) => x.outcome === "WIN").length, l = v.filter((x) => x.outcome === "LOSS").length; return (w + l) ? (w / (w + l)) * 100 : NaN; };
const sum = (v) => v.reduce((a, x) => a + (Number.isFinite(x.R) ? x.R : 0), 0);
const mdd = (v) => { const o = [...v].sort((a, b) => String(a.exitTs || a.tsMT || "").localeCompare(String(b.exitTs || b.tsMT || ""))); let e = 0, p = 0, d = 0; for (const t of o) { e += Number.isFinite(t.R) ? t.R : 0; p = Math.max(p, e); d = Math.max(d, p - e); } return d; };

const contR = sum(cont), contN = cont.length;
console.log(`CONT (inchangée par le seuil) : ${contN} ép · WR ${wr(cont).toFixed(2)} % · R ${contR.toFixed(1)}`);
console.log(`EXH au seuil actuel 1,80      : ${exh.length} ép · WR ${wr(exh).toFixed(2)} % · R ${sum(exh).toFixed(1)}\n`);
console.log("seuil   EXH retirés (ce qu'on perd)      EXH gardés            TOTAL moteur");
console.log("        n     WR       R                 n     WR       R      n     WR      R    maxDD  ratio  R/DD");
for (const th of [1.8, 1.9, 2.0, 2.1, 2.2, 2.4, 2.6, 2.8, 3.0, 3.3, 3.6, 4.0]) {
  const out = exh.filter((s) => s.c < th), keep = exh.filter((s) => s.c >= th);
  if (!keep.length) continue;
  const tot = [...keep, ...cont];
  const line = [
    th.toFixed(2).padStart(5),
    String(out.length).padStart(5), (out.length ? wr(out).toFixed(1) : "  — ").padStart(6) + " %", sum(out).toFixed(1).padStart(7),
    "   ", String(keep.length).padStart(5), wr(keep).toFixed(1).padStart(6) + " %", sum(keep).toFixed(1).padStart(7),
    "  ", String(tot.length).padStart(5), wr(tot).toFixed(1).padStart(6) + " %", sum(tot).toFixed(1).padStart(7),
    mdd(tot).toFixed(1).padStart(7), (keep.length / tot.length * 100).toFixed(1).padStart(6) + " %",
    (sum(tot) / mdd(tot)).toFixed(2).padStart(6),
  ].join(" ");
  console.log(line);
}
console.log("\n⚠ « EXH retirés » = la COHORTE que la coupe supprime. Un WR bas et un R négatif y sont");
console.log("  la seule justification recevable d'un seuil : il doit retirer du DÉCHET, pas du volume.");
