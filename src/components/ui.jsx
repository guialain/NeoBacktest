// ui.jsx — tokens + primitives partagés par les pages du backtest.
// EXTRAIT de MatrixBacktest.jsx (owner 2026-07-17) au moment d'ajouter la page Signaux : les deux pages ont
//   besoin des mêmes tokens, et un import croisé MatrixBacktest ↔ SignalsPage serait circulaire.
//   Source unique : ne PAS redéclarer T/pos ailleurs — deux palettes qui divergent, c'est le début de la fin.

export const T = {
  bg: "#0d1117", surface: "#161b22", border: "#21262d", borderHi: "#30363d",
  ink: "#e6edf3", ink2: "#8b949e", ink3: "#6e7681",
  blue: "#4493f8", green: "#3fb950", red: "#f85149", amber: "#d29922",
};

export const pos = (v) => (Number(v) >= 0 ? T.green : T.red);
export const empty = { color: T.ink3, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" };
export const N = (v) => (Number.isFinite(Number(v)) ? Number(v) : "—");

export function Panel({ title, extra, banner, children, flex, bodyStyle }) {
  return (
    <div style={{ flex, minHeight: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {title && (
        <div style={{ flex: "none", padding: "11px 16px 9px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", color: T.ink3, fontWeight: 600 }}>{title}</span>
          {extra}
        </div>
      )}
      {banner}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", ...bodyStyle }}>{children}</div>
    </div>
  );
}

// Bouton de filtre/onglet — même grammaire visuelle partout (actif = teinte de sa couleur).
export function Chip({ on, col = T.blue, onClick, children, title }) {
  return (
    <button type="button" onClick={onClick} title={title}
      style={{ background: on ? col + "22" : "transparent", color: on ? col : T.ink3,
        border: `1px solid ${on ? col + "66" : T.border}`, borderRadius: 6, padding: "3px 9px",
        fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none" }}>{children}</button>
  );
}
