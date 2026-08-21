// _m15_surtension_ou_meurt.mjs — LA FIGURE M15 EXISTE DANS LES DONNEES ET PAS DANS LE CARNET.
// =============================================================================================
// LE CAS OWNER : `US_TECH100 · 2026-07-20T13:45:00Z` porte `zscore_m15_s0 = 2,3205` ET
//   `stoch_k_m15_s0 = 95,52`. La figure est donc ATTEIGNABLE. Or la sonde sur les TIRS rendait
//   ZERO et le `%K M15` ORIENTE plafonnait a 85,0 au rang 3.
//   => ce n'est pas une borne hors domaine, c'est une population TUEE EN AMONT. Reste a dire OU.
//
// `perTf[tf].k` EST BIEN LE LIVE (`stoch_k_{tf}_s0`, verifie dans `OpportunityDetector`) — le
//   capteur n'est pas en cause.
//
// Usage : `node --max-old-space-size=12288 stats/_m15_surtension_ou_meurt.mjs`
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const ZB = Number(process.env.Z ?? 2.3), KB = Number(process.env.K ?? 90);
const CIBLE_TS = "2026.07.20 13:45";

const rowsOf = (f) => {
  const txt = fs.readFileSync(path.join(MATRIX, f), "utf8").split("\n");
  const h = txt[0].split(";");
  const iK = h.indexOf("stoch_k_m15_s0"), iZ = h.indexOf("zscore_m15_s0"), iT = h.indexOf("timestamp");
  const m = new Map();
  for (let n = 1; n < txt.length; n++) {
    const v = txt[n].split(";"); if (v.length < h.length) continue;
    m.set(v[iT], { k: Number(v[iK]), z: Number(v[iZ]) });
  }
  return m;
};

const OUT = [];
let rows = 0, lisibles = 0;
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const asset = f.replace(/\.csv$/i, "");
  const raw = rowsOf(f);
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllRows: true, chargeSpread: true });
  for (const x of (p.ghosts ?? []).filter((c) => c.ghost === "all-rows")) {
    rows++;
    if (!Number.isFinite(x.regDir) || x.regDir === 0) continue;
    const side = x.regDir > 0 ? "BUY" : "SELL";        // le rang 3 suit `+regDir`
    const r = raw.get(String(x.tsMT ?? ""));
    if (!r || !Number.isFinite(r.k) || !Number.isFinite(r.z)) continue;
    lisibles++;
    const S = side === "BUY" ? 1 : -1;                 // le BUY est le sens brut ici
    const zP = r.z * S, kP = S === 1 ? r.k : 100 - r.k;
    if (!(zP > ZB && kP > KB)) continue;
    const w = p.walk({ ...x, side });
    const destin = x.selStrategy === "CONT" ? "TIRE rang 3"
                 : x.selStrategy ? `pris par ${x.selStrategy}`
                 : x.waitNature === "cont-counter-cross" ? "cont-counter-cross"
                 : x.waitNature === "cont-below-min" ? "MIN_CONT (score)"
                 : x.waitNature === "cont-vetoed" ? "VETO voisin"
                 : (x.waitNature ?? "autre");
    OUT.push({ asset, ts: x.tsMT, side, z: r.z, k: r.k, zP, kP, destin,
               score: x.contScore ?? null, R: (w && typeof w.R === "number") ? w.R : null });
  }
}

const wr = (a) => { const v = a.filter((t) => t.R !== null); return v.length ? 100 * v.filter((t) => t.R > 0).length / v.length : NaN; };
const Rn = (a) => a.reduce((s, t) => s + (t.R ?? 0), 0);
const jour = (t) => `${t.asset}|${String(t.ts ?? "").slice(0, 10)}`;
const grap = (a) => new Set(a.map(jour)).size;
const L = (lbl, a) => a.length
  ? `   ${lbl.padEnd(24)}${String(a.length).padStart(7)}${String(grap(a)).padStart(6)}${wr(a).toFixed(2).padStart(9)} %${Rn(a).toFixed(1).padStart(9)}`
  : `   ${lbl.padEnd(24)}      —`;
const HEAD = `   ${"".padEnd(24)}${"barres".padStart(7)}${"grap".padStart(6)}${"WR".padStart(10)}${"R".padStart(9)}`;
const B = (a) => a.filter((t) => t.side === "BUY"), V = (a) => a.filter((t) => t.side === "SELL");

console.log(`\n== M15 EN SURTENSION — z live > ${ZB} ET %K live > ${KB} (BUY brut, SELL miroir) ==`);
console.log(`   ${rows} lignes · ${lisibles} avec cote et capteurs · ${OUT.length} portent la figure\n`);
console.log(HEAD);
console.log(L("LA FIGURE", OUT)); console.log(L("   BUY (brut)", B(OUT))); console.log(L("   SELL (miroir)", V(OUT)));
console.log(`\n   -- OU MEURT-ELLE --`); console.log(HEAD);
for (const d of [...new Set(OUT.map((t) => t.destin))].sort((a, b) => OUT.filter((t) => t.destin === b).length - OUT.filter((t) => t.destin === a).length)) {
  console.log(L(d, OUT.filter((t) => t.destin === d)));
  console.log(L("     BUY", B(OUT.filter((t) => t.destin === d))));
  console.log(L("     SELL", V(OUT.filter((t) => t.destin === d))));
}
console.log(`\n   -- LE CAS OWNER : US_TECH100 ${CIBLE_TS} --`);
const cas = OUT.filter((t) => t.asset.toUpperCase().includes("TECH") && String(t.ts).startsWith(CIBLE_TS.slice(0, 13)));
if (!cas.length) console.log(`   la barre ne porte PAS la figure cote moteur, ou son cote la retourne — voir ci-dessous`);
for (const t of cas.slice(0, 12))
  console.log(`   ${t.ts}  ${t.side}  z ${t.z.toFixed(2)} (orient ${t.zP.toFixed(2)})  %K ${t.k.toFixed(2)} (orient ${t.kP.toFixed(2)})  score ${t.score}  ${t.destin}  R ${t.R === null ? "—" : t.R.toFixed(2)}`);
console.log("");
