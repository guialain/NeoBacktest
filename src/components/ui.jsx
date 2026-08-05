// ui.jsx — tokens + primitives partagés par les pages du backtest.
// EXTRAIT de MatrixBacktest.jsx (owner 2026-07-17) au moment d'ajouter la page Signaux : les deux pages ont
//   besoin des mêmes tokens, et un import croisé MatrixBacktest ↔ SignalsPage serait circulaire.
//   Source unique : ne PAS redéclarer T/pos ailleurs — deux palettes qui divergent, c'est le début de la fin.

export const T = {
  bg: "#0d1117", surface: "#161b22", border: "#21262d", borderHi: "#30363d",
  ink: "#e6edf3", ink2: "#8b949e", ink3: "#6e7681",
  blue: "#4493f8", green: "#3fb950", red: "#f85149", amber: "#d29922",
  // ⭐ Le CIRCUIT COURT (2026-07-30). Il porte `strategy: "EXH"`, donc sans couleur propre il se
  //   confondait avec le fade scoré — or c'est une DÉCISION D'UNE AUTRE NATURE : un événement H4 qui
  //   court-circuite les deux scorers. Une cohorte qu'on ne distingue pas est une cohorte qu'on ne
  //   mesure pas. Violet Primer, cohérent avec le reste de la palette.
  violet: "#a371f7",
  // ⭐ LE RANG ② PULLBACK (2026-08-05, phase C). Même raison que le violet ci-dessus : sans couleur
  //   propre il retombait dans le bleu de la CONTINUATION — or c'est un rang DISTINCT, avec son
  //   propre seuil (`MIN_PB`) et sa propre figure. Le rang le plus neuf du moteur était le seul
  //   illisible dans la seule fenêtre qui sert à le juger.
  // ⚠ Vert et rouge sont pris (issues FIRE_ / pertes), bleu est la continuation, ambre l'exhaustion,
  //   violet le circuit court : le cyan Primer est la seule teinte encore franchement distincte.
  cyan: "#39c5cf",
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

// Cellules de table — EXTRAITES d'IndicatorsPage (owner 2026-07-26) au moment d'ajouter la table de
//   scoring : les deux tables doivent se ressembler AU PIXEL, et deux jeux de styles copiés divergent
//   toujours. Même raison que T/pos plus haut.
//   `dense` — compacte en HAUTEUR **et en LARGEUR** (owner 2026-07-26). La largeur compte autant :
//   la table des indicateurs porte 14 colonnes et doit tenir sans défilement horizontal. Le padding
//   latéral est le premier poste — 14 colonnes × 2 × 5 px économisés = 140 px gagnés.
export const TH = ({ children, w, dense }) => (
  <th style={{ textAlign: "left", padding: dense ? "5px 9px" : "10px 14px", fontSize: dense ? 10.5 : 12,
    fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: T.ink3,
    borderBottom: `1px solid ${T.border}`, width: w, whiteSpace: "nowrap" }}>{children}</th>
);
export const TD = ({ children, dense }) => (
  <td style={{ padding: dense ? "5px 9px" : "15px 14px", borderBottom: `1px solid #1a2029`,
    fontSize: dense ? 13 : 15, whiteSpace: "nowrap" }}>{children}</td>
);

// Bouton de filtre/onglet — même grammaire visuelle partout (actif = teinte de sa couleur).
export function Chip({ on, col = T.blue, onClick, children, title }) {
  return (
    <button type="button" onClick={onClick} title={title}
      style={{ background: on ? col + "22" : "transparent", color: on ? col : T.ink3,
        border: `1px solid ${on ? col + "66" : T.border}`, borderRadius: 6, padding: "3px 9px",
        fontSize: 11, fontWeight: 600, cursor: "pointer", outline: "none" }}>{children}</button>
  );
}
