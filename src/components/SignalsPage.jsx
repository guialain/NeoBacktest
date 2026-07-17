import { useState, useMemo } from "react";
import { T, Panel, Chip, pos, empty } from "./ui.jsx";

// SignalsPage — page « Signaux » : un trade = une ligne, avec la PHOTO des indicateurs au moment du tir
//   (cf fireSnapshot dans matrixBacktest.mjs). Objectif : répondre à « à quel ADX / RSI / theta ce trade
//   a-t-il tiré ? » sans rejouer la barre à la main.
//
// Lecture seule et 100 % frontend : elle consomme le run déjà chargé par MatrixBacktest (pas de re-run).

// ── Colonnes. group = bloc repliable ; fmt = rendu ; col = teinte optionnelle (v) => couleur.
const signed = (d = 1) => (v) => (v > 0 ? "+" : "") + v.toFixed(d);
const COLS = [
  { k: "tsMT", lbl: "Timestamp", g: "Trade", w: 132, mono: true, fmt: (v) => v },
  { k: "side", lbl: "Side", g: "Trade", fmt: (v) => v, col: (v) => (v === "BUY" ? T.green : T.red), bold: true },
  { k: "type", lbl: "Type", g: "Trade", fmt: (v) => v },
  { k: "profile", lbl: "Profil", g: "Trade", w: 96, fmt: (v) => v },
  { k: "outcome", lbl: "Out", g: "Trade", fmt: (v) => v, col: (v) => (v === "WIN" ? T.green : T.red), bold: true },
  { k: "reason", lbl: "Exit", g: "Trade", fmt: (v) => v, col: (v) => (v === "TP" ? T.green : v === "SL" ? T.red : T.amber) },
  { k: "R", lbl: "R", g: "Trade", fmt: (v) => v.toFixed(2), col: pos, bold: true },

  { k: "confidence", lbl: "Conf", g: "Décision", fmt: (v) => v.toFixed(2) },
  { k: "gap", lbl: "Gap", g: "Décision", fmt: (v) => v.toFixed(2) },
  { k: "score", lbl: "Score", g: "Décision", fmt: (v) => v.toFixed(0) },
  { k: "override", lbl: "Override", g: "Décision", w: 120, fmt: (v) => v, col: () => T.amber },

  { k: "adx", lbl: "ADX H1", g: "ADX", fmt: (v) => v.toFixed(1) },
  { k: "dAdx", lbl: "Δ₁ H1", g: "ADX", fmt: signed(1), col: pos },
  { k: "dAdx2", lbl: "Δ₂ H1", g: "ADX", fmt: signed(1), col: pos },
  { k: "adxAccel", lbl: "Δ₁−Δ₂", g: "ADX", fmt: signed(1), col: pos },
  // Régime = signe(Δ₁) vs signe(Δ₂) : même signe ⇒ force INSTALLÉE, signes opposés ⇒ INFLEXION fraîche.
  { k: "adxRegime", lbl: "Régime ADX", g: "ADX", w: 104, fmt: (v) => v,
    col: (v) => (v === "TURN_DOWN" ? T.green : v === "TURN_UP" ? T.red : v?.startsWith("FLAT") ? T.ink3 : T.ink2), bold: true },
  { k: "adxM15", lbl: "ADX M15", g: "ADX", fmt: (v) => v.toFixed(1) },
  { k: "dAdxM15", lbl: "ΔADX M15", g: "ADX", fmt: signed(1), col: pos },
  { k: "plusDi", lbl: "+DI", g: "DI", fmt: (v) => v.toFixed(1), col: () => T.green },
  { k: "dPlusDi", lbl: "Δ₁ +DI", g: "DI", fmt: signed(1), col: pos },
  { k: "dPlusDi2", lbl: "Δ₂ +DI", g: "DI", fmt: signed(1), col: pos },
  { k: "minusDi", lbl: "−DI", g: "DI", fmt: (v) => v.toFixed(1), col: () => T.red },
  { k: "dMinusDi", lbl: "Δ₁ −DI", g: "DI", fmt: signed(1), col: pos },
  { k: "dMinusDi2", lbl: "Δ₂ −DI", g: "DI", fmt: signed(1), col: pos },
  { k: "diDelta", lbl: "Spread", g: "DI", fmt: signed(1), col: pos },
  { k: "dSpread", lbl: "Δ₁ spread", g: "DI", fmt: signed(1), col: pos },
  { k: "dSpread2", lbl: "Δ₂ spread", g: "DI", fmt: signed(1), col: pos },
  // ⭐ La colonne qui porte le signal : le spread DI a un SENS → lu RELATIVEMENT au côté du trade.
  //   TURN_WITH = la pression directionnelle vient de basculer EN SENS (meilleure cohorte, toutes bandes).
  { k: "spreadRegimeRel", lbl: "DI vs trade", g: "DI", w: 116, fmt: (v) => v,
    col: (v) => (v === "TURN_WITH" ? T.green : v === "TURN_AGAINST" ? T.red : v === "FLAT" ? T.ink3 : T.ink2), bold: true },
  { k: "spreadRegime", lbl: "Régime spread", g: "DI", w: 112, fmt: (v) => v, col: () => T.ink3 },

  { k: "thetaDayDeg", lbl: "θ jour", g: "Trend", fmt: signed(1), col: pos },
  { k: "dTheta", lbl: "Δθ", g: "Trend", fmt: signed(1), col: pos },
  { k: "thetaRotation", lbl: "Rotation", g: "Trend", w: 88, fmt: (v) => v },
  { k: "angleTheta", lbl: "Angle D1", g: "Trend", fmt: signed(1), col: pos },
  { k: "forceScore", lbl: "Force", g: "Trend", fmt: (v) => v.toFixed(0) },
  { k: "slopeD1", lbl: "Slope D1", g: "Trend", fmt: signed(2), col: pos },
  { k: "intradayChange", lbl: "Intraday %", g: "Trend", fmt: signed(2), col: pos },

  { k: "rsiH1", lbl: "RSI H1", g: "RSI", fmt: (v) => v.toFixed(1), col: (v) => (v >= 70 ? T.red : v <= 30 ? T.green : T.ink2) },
  { k: "rsiH4", lbl: "RSI H4", g: "RSI", fmt: (v) => v.toFixed(1), col: (v) => (v >= 70 ? T.red : v <= 30 ? T.green : T.ink2) },
  { k: "rsiM15", lbl: "RSI M15", g: "RSI", fmt: (v) => v.toFixed(1), col: (v) => (v >= 70 ? T.red : v <= 30 ? T.green : T.ink2) },
  { k: "rsiD1", lbl: "RSI D1", g: "RSI", fmt: (v) => v.toFixed(1) },
  { k: "dRsiH1", lbl: "ΔRSI H1", g: "RSI", fmt: signed(1), col: pos },

  { k: "kH1", lbl: "%K H1", g: "Stoch", fmt: (v) => v.toFixed(1) },
  { k: "dH1", lbl: "%D H1", g: "Stoch", fmt: (v) => v.toFixed(1) },
  { k: "kdH1", lbl: "K−D H1", g: "Stoch", fmt: signed(1), col: pos },
  { k: "zoneH1", lbl: "Zone H1", g: "Stoch", w: 92, fmt: (v) => v },
  { k: "crossFreshH1", lbl: "Cross H1", g: "Stoch", fmt: (v) => (v ? "✓" : "·"), col: (v) => (v ? T.blue : T.ink3), bold: true },
  { k: "kM15", lbl: "%K M15", g: "Stoch", fmt: (v) => v.toFixed(1) },
  { k: "kdM15", lbl: "K−D M15", g: "Stoch", fmt: signed(1), col: pos },
  { k: "separation", lbl: "Sépar.", g: "Stoch", fmt: (v) => v.toFixed(1) },

  { k: "bbwH1", lbl: "BBW H1", g: "Energy", fmt: (v) => v.toFixed(1) },
  { k: "bbwM15", lbl: "BBW M15", g: "Energy", fmt: (v) => v.toFixed(1) },
  { k: "bbwDynH1", lbl: "BBW dyn", g: "Energy", w: 92, fmt: (v) => v },
  { k: "tick", lbl: "Tick", g: "Energy", fmt: (v) => v.toFixed(0) },
  { k: "zscoreH1", lbl: "Z H1", g: "Energy", fmt: signed(2), col: pos },
  { k: "wrH1", lbl: "W%R H1", g: "Energy", fmt: (v) => v.toFixed(1) },
  { k: "maturityState", lbl: "Stage", g: "Energy", w: 104, fmt: (v) => v },
  { k: "maturityScore", lbl: "Mat.", g: "Energy", fmt: (v) => v.toFixed(0) },
];
const GROUPS = [...new Set(COLS.map((c) => c.g))];
const GROUP_COL = { Trade: T.ink2, Décision: T.blue, ADX: T.amber, DI: T.amber, Trend: T.green, RSI: T.red, Stoch: T.blue, Energy: T.ink2 };

// ── Stats : médiane + quartiles, WIN vs LOSS. C'est le vrai levier — « où vivent les perdants ».
const med = (a) => (a.length ? a[Math.floor(a.length / 2)] : null);
const quant = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null);

export default function SignalsPage({ res, asset }) {
  const [outcomeF, setOutcomeF] = useState(null);
  const [sideF, setSideF] = useState(null);
  const [typeF, setTypeF] = useState(null);
  const [profileF, setProfileF] = useState(null);
  const [groupsOn, setGroupsOn] = useState(() => new Set(["Trade", "ADX", "Trend", "RSI"]));
  const [sort, setSort] = useState({ k: "tsMT", dir: 1 });
  const [sel, setSel] = useState(null);      // trade ouvert dans le tiroir de détail
  const [statCol, setStatCol] = useState("adx");

  const all = res?.signals ?? [];
  const profiles = useMemo(() => [...new Set(all.map((x) => x.profile).filter(Boolean))].sort(), [all]);
  const types = useMemo(() => [...new Set(all.map((x) => x.type).filter(Boolean))].sort(), [all]);

  const rows = useMemo(() => {
    let r = all;
    if (outcomeF) r = r.filter((x) => (outcomeF === "WIN" || outcomeF === "LOSS") ? x.outcome === outcomeF : x.reason === outcomeF);
    if (sideF) r = r.filter((x) => x.side === sideF);
    if (typeF) r = r.filter((x) => x.type === typeF);
    if (profileF) r = r.filter((x) => x.profile === profileF);
    const { k, dir } = sort;
    return [...r].sort((a, b) => {
      const va = a[k], vb = b[k];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;              // les trous toujours en bas, quel que soit le sens
      if (vb == null) return -1;
      return (typeof va === "number" && typeof vb === "number") ? (va - vb) * dir : String(va).localeCompare(String(vb)) * dir;
    });
  }, [all, outcomeF, sideF, typeF, profileF, sort]);

  const cols = COLS.filter((c) => groupsOn.has(c.g));
  const toggleGroup = (g) => setGroupsOn((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const clickSort = (k) => setSort((s) => (s.k === k ? { k, dir: -s.dir } : { k, dir: 1 }));
  const clearAll = () => { setOutcomeF(null); setSideF(null); setTypeF(null); setProfileF(null); };
  const anyFilter = outcomeF || sideF || typeF || profileF;

  // Comparaison WIN vs LOSS sur la colonne choisie, DANS la sélection courante (hors filtre outcome, sinon
  //   une des deux moitiés serait vide par construction).
  const cmp = useMemo(() => {
    let base = all;
    if (sideF) base = base.filter((x) => x.side === sideF);
    if (typeF) base = base.filter((x) => x.type === typeF);
    if (profileF) base = base.filter((x) => x.profile === profileF);
    const grab = (o) => base.filter((x) => x.outcome === o).map((x) => x[statCol]).filter((v) => typeof v === "number").sort((a, b) => a - b);
    const w = grab("WIN"), l = grab("LOSS");
    return { w, l, col: COLS.find((c) => c.k === statCol) };
  }, [all, sideF, typeF, profileF, statCol]);
  const numCols = COLS.filter((c) => c.g !== "Trade" && all.some((x) => typeof x[c.k] === "number"));

  const totR = rows.reduce((a, x) => a + (x.R ?? 0), 0);
  const wins = rows.filter((x) => x.outcome === "WIN").length;

  if (!res) return <div style={empty}>Lance un backtest pour voir les signaux</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%", minHeight: 0 }}>
      {/* ── Barre de filtres ── */}
      <Panel flex="none" bodyStyle={{ overflow: "visible", padding: "10px 14px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 11 }}>
          <FilterRow label="Résultat">
            {[["Tous", null, T.blue], ["Win", "WIN", T.green], ["Loss", "LOSS", T.red], ["TP", "TP", T.green], ["SL", "SL", T.red], ["TO", "TIMEOUT", T.amber]]
              .map(([l, v, c]) => <Chip key={l} on={outcomeF === v} col={c} onClick={() => setOutcomeF(v)}>{l}</Chip>)}
          </FilterRow>
          <FilterRow label="Side">
            {[["Tous", null, T.blue], ["BUY", "BUY", T.green], ["SELL", "SELL", T.red]]
              .map(([l, v, c]) => <Chip key={l} on={sideF === v} col={c} onClick={() => setSideF(v)}>{l}</Chip>)}
          </FilterRow>
          <FilterRow label="Type">
            <Chip on={!typeF} onClick={() => setTypeF(null)}>Tous</Chip>
            {types.map((t) => <Chip key={t} on={typeF === t} onClick={() => setTypeF(t)}>{t}</Chip>)}
          </FilterRow>
          <FilterRow label="Profil">
            <Chip on={!profileF} onClick={() => setProfileF(null)}>Tous</Chip>
            {profiles.map((p) => <Chip key={p} on={profileF === p} onClick={() => setProfileF(p)}>{p}</Chip>)}
          </FilterRow>
          {anyFilter && <Chip col={T.amber} on onClick={clearAll}>effacer ✕</Chip>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 9, paddingTop: 9, borderTop: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: T.ink3, fontWeight: 600 }}>Colonnes</span>
          {GROUPS.map((g) => <Chip key={g} on={groupsOn.has(g)} col={GROUP_COL[g]} onClick={() => toggleGroup(g)}>{g}</Chip>)}
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.ink2 }}>
            <b style={{ color: T.ink }}>{rows.length}</b> / {all.length} trades · WR{" "}
            <b style={{ color: rows.length && 100 * wins / rows.length >= 75 ? T.green : T.red }}>
              {rows.length ? (100 * wins / rows.length).toFixed(1) : "—"}%
            </b>{" "}
            · total R <b style={{ color: pos(totR) }}>{totR.toFixed(1)}</b>
            {" "}· avg R <b style={{ color: pos(totR) }}>{rows.length ? (totR / rows.length).toFixed(3) : "—"}</b>
          </span>
        </div>
      </Panel>

      {/* ── Comparaison WIN vs LOSS ── */}
      <Panel title={`Où vivent les perdants · ${asset ?? ""}`} flex="none"
        extra={<select value={statCol} onChange={(e) => setStatCol(e.target.value)}
          style={{ background: T.bg, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>
          {numCols.map((c) => <option key={c.k} value={c.k}>{c.g} · {c.lbl}</option>)}
        </select>}
        bodyStyle={{ padding: "10px 14px" }}>
        <Compare cmp={cmp} />
      </Panel>

      {/* ── Table ── */}
      <Panel title="Signaux" flex="1 1 0" bodyStyle={{ overflow: "auto" }}>
        <table className="cat" style={{ fontSize: 11.5 }}>
          <thead>
            <tr>{cols.map((c) => (
              <th key={c.k} onClick={() => clickSort(c.k)} title={`${c.g} · trier`}
                style={{ cursor: "pointer", whiteSpace: "nowrap", minWidth: c.w, color: sort.k === c.k ? T.blue : undefined,
                  borderBottom: `2px solid ${sort.k === c.k ? T.blue : "transparent"}` }}>
                {c.lbl}{sort.k === c.k ? (sort.dir > 0 ? " ↑" : " ↓") : ""}
              </th>))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0
              ? <tr><td colSpan={cols.length} style={{ color: T.ink3, textAlign: "center", padding: 30 }}>aucun trade pour ce filtre</td></tr>
              : rows.map((t, i) => (
                <tr key={i} onClick={() => setSel(t)} className="click"
                  style={sel === t ? { background: T.blue + "18" } : undefined}>
                  {cols.map((c) => {
                    const v = t[c.k];
                    // null ≠ 0 : un indicateur ABSENT s'affiche "—" (le piège num("")===0 a déjà coûté cher)
                    if (v == null || v === "") return <td key={c.k} style={{ color: T.ink3 }}>—</td>;
                    return <td key={c.k} className={c.mono ? "mono" : undefined}
                      style={{ color: c.col ? c.col(v) : T.ink2, fontWeight: c.bold ? 600 : undefined, whiteSpace: "nowrap" }}>
                      {c.fmt(v)}
                    </td>;
                  })}
                </tr>))}
          </tbody>
        </table>
      </Panel>

      {sel && <Detail t={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function FilterRow({ label, children }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: T.ink3, fontWeight: 600, marginRight: 2 }}>{label}</span>
      {children}
    </div>
  );
}

// Compare — médiane + P25/P75 WIN vs LOSS, avec l'écart. Deux barres alignées sur une échelle commune :
//   si les boîtes se chevauchent, l'indicateur ne sépare pas — c'est l'information utile.
function Compare({ cmp }) {
  const { w, l, col } = cmp;
  if (!w.length && !l.length) return <div style={{ color: T.ink3, fontSize: 12 }}>aucune donnée pour cet indicateur sur cette sélection</div>;
  const lo = Math.min(...[...w, ...l]), hi = Math.max(...[...w, ...l]);
  const span = hi - lo || 1;
  const f = (v) => (v == null ? "—" : v.toFixed(2));
  const bar = (a, color, lbl) => {
    if (!a.length) return <div style={{ color: T.ink3, fontSize: 11 }}>{lbl} : aucun</div>;
    const q1 = quant(a, 0.25), q3 = quant(a, 0.75), m = med(a);
    const x = (v) => `${(100 * (v - lo)) / span}%`;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "5px 0" }}>
        <span style={{ width: 42, fontSize: 11, fontWeight: 600, color }}>{lbl}</span>
        <span style={{ width: 34, fontSize: 10.5, color: T.ink3 }}>n={a.length}</span>
        <div style={{ position: "relative", flex: 1, height: 16, background: T.bg, borderRadius: 4, border: `1px solid ${T.border}` }}>
          <div style={{ position: "absolute", left: x(q1), width: `${(100 * (q3 - q1)) / span}%`, top: 3, bottom: 3, background: color + "44", borderRadius: 3 }} />
          <div style={{ position: "absolute", left: x(m), top: 0, bottom: 0, width: 2, background: color }} />
        </div>
        <span style={{ width: 116, fontSize: 11, color: T.ink2, textAlign: "right" }}>
          <b style={{ color }}>{f(m)}</b> <span style={{ color: T.ink3 }}>[{f(q1)}–{f(q3)}]</span>
        </span>
      </div>
    );
  };
  const mw = med(w), ml = med(l);
  const delta = (mw != null && ml != null) ? mw - ml : null;
  return (
    <div>
      {bar(w, T.green, "WIN")}
      {bar(l, T.red, "LOSS")}
      <div style={{ fontSize: 11, color: T.ink3, marginTop: 7, paddingTop: 7, borderTop: `1px solid ${T.border}` }}>
        {delta == null ? "—" : <>
          Écart des médianes sur <b style={{ color: T.ink2 }}>{col?.lbl}</b> :{" "}
          <b style={{ color: Math.abs(delta) > 0.001 ? T.ink : T.ink3 }}>{delta > 0 ? "+" : ""}{delta.toFixed(2)}</b>
          <span style={{ marginLeft: 8 }}>
            (échelle {lo.toFixed(1)} → {hi.toFixed(1)}). Boîtes = P25–P75 ; barre = médiane.
            Si elles se chevauchent largement, cet indicateur <b>ne sépare pas</b> gagnants et perdants.
          </span>
        </>}
      </div>
    </div>
  );
}

// Detail — tiroir : les 12 observables (ce que le moteur VOIT) + les raisons (pourquoi il a tiré).
function Detail({ t, onClose }) {
  const obs = t.obs ?? {};
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "92vw", background: T.surface, borderLeft: `1px solid ${T.borderHi}`, padding: 18, overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.side === "BUY" ? T.green : T.red }}>{t.side} {t.type}</div>
            <div className="mono" style={{ fontSize: 11, color: T.ink3 }}>{t.tsMT}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.ink2, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>✕</button>
        </div>

        <Kv label="Profil" v={t.profile} />
        <Kv label="Résultat" v={`${t.outcome} · ${t.reason} · R ${t.R}`} col={pos(t.R)} />
        <Kv label="Confiance / gap" v={`${t.confidence ?? "—"} / ${t.gap ?? "—"}`} />
        {t.override && <Kv label="Override" v={t.override} col={T.amber} />}
        {t.trans && <Kv label="Transition" v={JSON.stringify(t.trans)} />}

        <Section title="Les 12 observables · ce que le moteur VOIT" />
        {Object.entries(obs).map(([k, v]) => <Kv key={k} label={k} v={String(v)} />)}

        <Section title="Pourquoi il a tiré" />
        {(t.reasons ?? []).map((r, i) => (
          <div key={i} style={{ fontSize: 11.5, color: T.ink2, padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>{r}</div>
        ))}
        {!(t.reasons ?? []).length && <div style={{ fontSize: 11.5, color: T.ink3 }}>—</div>}
      </div>
    </div>
  );
}
const Section = ({ title }) => (
  <div style={{ fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: T.ink3, fontWeight: 600, margin: "16px 0 6px" }}>{title}</div>
);
const Kv = ({ label, v, col }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
    <span style={{ color: T.ink3 }}>{label}</span>
    <span style={{ color: col ?? T.ink2, fontWeight: 500, textAlign: "right" }}>{v ?? "—"}</span>
  </div>
);
