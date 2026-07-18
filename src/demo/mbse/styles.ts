/**
 * Scoped visual identity for the MBSE workbench. Everything is namespaced
 * under .mbse-shell so it cannot leak into other shells: the point (item 5)
 * is that opening this shell feels like a different application. The
 * direction is an engineering "blueprint workbench": a cool graphite-navy
 * chrome, a blueprint-cyan structural accent, a signal-amber for the open
 * diagram, and a monospace utility face for stereotypes and requirement ids
 * (the vernacular of a SysML tool). The model browser sits first (left),
 * which is itself distinguishing: the other shells lead with the graph, this
 * one leads with the containment tree, the way a modeling tool does.
 */
export const MBSE_STYLES = `
.mbse-shell {
  --mb-bg: #0d131e;
  --mb-panel: #131c2b;
  --mb-panel-2: #0f1725;
  --mb-line: #243349;
  --mb-line-soft: #1b2636;
  --mb-ink: #d3dcea;
  --mb-ink-dim: #7d8da5;
  --mb-cyan: #38bdf8;
  --mb-amber: #f5b342;
  --mb-teal: #2dd4bf;
  --mb-violet: #a78bfa;
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--mb-bg);
  color: var(--mb-ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.mbse-mono, .mbse-tree-stereo, .mbse-diagram-badge, .mbse-kbd {
  font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
}

/* Top bar */
.mbse-topbar {
  display: flex; align-items: center; gap: 16px;
  height: 48px; padding: 0 14px; flex: 0 0 auto;
  background: linear-gradient(180deg, #16202f, #101825);
  border-bottom: 1px solid var(--mb-line);
}
.mbse-back {
  background: transparent; color: var(--mb-ink-dim);
  border: 1px solid var(--mb-line); border-radius: 6px;
  padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.mbse-back:hover { color: var(--mb-ink); border-color: var(--mb-cyan); }
.mbse-wordmark { display: flex; flex-direction: column; line-height: 1.15; }
.mbse-wordmark b { font-size: 13px; letter-spacing: 0.02em; }
.mbse-wordmark span { font-size: 10.5px; color: var(--mb-ink-dim); letter-spacing: 0.14em; text-transform: uppercase; }
.mbse-diagram-title { margin-left: auto; display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--mb-ink); }

/* Body: browser | canvas | inspector */
.mbse-body { flex: 1 1 auto; display: flex; min-height: 0; }
.mbse-browser {
  flex: 0 0 262px; display: flex; flex-direction: column; min-height: 0;
  background: var(--mb-panel-2); border-right: 1px solid var(--mb-line);
}
.mbse-inspector {
  flex: 0 0 230px; display: flex; flex-direction: column; gap: 2px; min-height: 0;
  background: var(--mb-panel-2); border-left: 1px solid var(--mb-line);
  overflow: auto;
}
.mbse-panel-head {
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--mb-ink-dim); padding: 11px 12px 7px; flex: 0 0 auto;
}

/* Model browser tree */
.mbse-tree { overflow: auto; padding-bottom: 12px; flex: 1 1 auto; }
.mbse-tree-row {
  display: flex; align-items: center; gap: 7px; width: 100%;
  padding: 4px 10px 4px 0; border: 0; background: transparent;
  color: var(--mb-ink); font-size: 12.5px; text-align: left; cursor: default;
  border-left: 2px solid transparent;
}
button.mbse-tree-row { cursor: pointer; }
.mbse-tree-pkg { color: var(--mb-ink); font-weight: 600; }
.mbse-tree-pkg:hover, .mbse-tree-diagram:hover { background: #17202f; }
.mbse-tree-caret { width: 12px; color: var(--mb-ink-dim); display: inline-flex; }
.mbse-tree-icon { display: inline-flex; color: var(--mb-cyan); }
.mbse-tree-icon[data-kind="requirement"] { color: var(--mb-amber); }
.mbse-tree-icon[data-kind="constraint"] { color: var(--mb-violet); }
.mbse-tree-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mbse-tree-el .mbse-tree-label { color: var(--mb-ink); font-weight: 400; }
.mbse-tree-stereo { color: var(--mb-ink-dim); font-size: 11px; flex: 0 0 auto; }
.mbse-tree-diagram.is-active { background: #1b2740; border-left-color: var(--mb-amber); }
.mbse-tree-diagram.is-active .mbse-tree-label { color: #fff; }

/* Diagram type badge */
.mbse-diagram-badge {
  flex: 0 0 auto; font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em;
  padding: 2px 5px; border-radius: 3px; color: #05121c;
}
.mbse-badge-bdd { background: var(--mb-cyan); }
.mbse-badge-ibd { background: var(--mb-teal); }
.mbse-badge-par { background: var(--mb-violet); color: #140c25; }
.mbse-badge-req { background: var(--mb-amber); }

/* Canvas (blueprint grid backdrop) */
.mbse-canvas-wrap {
  flex: 1 1 auto; display: flex; flex-direction: column;
  min-width: 0; min-height: 0;
  background:
    linear-gradient(var(--mb-line-soft) 1px, transparent 1px) 0 0 / 26px 26px,
    linear-gradient(90deg, var(--mb-line-soft) 1px, transparent 1px) 0 0 / 26px 26px,
    radial-gradient(1200px 600px at 30% 0%, #12203300, #0b111c);
}
.mbse-canvas-toolbar {
  flex: 0 0 auto; padding: 6px 10px; display: flex; gap: 6px;
  align-items: center; color: var(--mb-ink-dim); font-size: 12px;
}
.mbse-canvas-host { flex: 1 1 auto; position: relative; min-height: 0; }
.mbse-canvas-host > * { position: absolute; inset: 0; }
.mbse-empty {
  display: flex; align-items: center; justify-content: center;
  color: var(--mb-ink-dim); font-size: 13px;
}

/* Inspector content */
.mbse-insp-section { padding: 4px 12px 12px; }
.mbse-insp-title { font-size: 12.5px; font-weight: 600; margin: 6px 0 4px; }
.mbse-insp-text { font-size: 11.5px; line-height: 1.5; color: var(--mb-ink-dim); }
.mbse-legend-row { display: flex; align-items: center; gap: 8px; font-size: 11.5px; padding: 3px 0; color: var(--mb-ink); }
.mbse-legend-mark { flex: 0 0 34px; color: var(--mb-ink-dim); }
.mbse-count { color: var(--mb-cyan); font-weight: 600; }
`;
