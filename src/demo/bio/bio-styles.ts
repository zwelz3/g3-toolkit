/**
 * Scoped identity for the biomedical RDF shell. Distinct again (item 5): a
 * bio-informatics lab workbench. Deep plum-charcoal chrome, a violet accent,
 * class-tinted chips, and monospace throughout the SPARQL surfaces (query
 * editor, URIs, results) because this shell's subject is the query language
 * itself. Namespaced under .bio-shell.
 */
export const BIO_STYLES = `
.bio-shell {
  --bio-bg: #12101a;
  --bio-panel: #191527;
  --bio-panel-2: #14111f;
  --bio-line: #2c2740;
  --bio-ink: #ddd6ec;
  --bio-dim: #8b83a3;
  --bio-accent: #b17ef0;
  --bio-accent-dim: #6d5a94;
  --bio-ok: #34d399;
  --bio-warn: #f5b342;
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: var(--bio-bg); color: var(--bio-ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.bio-mono, .bio-editor, .bio-uri, .bio-results td, .bio-results th { font-family: ui-monospace, "SF Mono", Menlo, monospace; }

.bio-topbar {
  display: flex; align-items: center; gap: 14px;
  height: 48px; padding: 0 14px; flex: 0 0 auto;
  background: linear-gradient(180deg, #1c1730, #14101f);
  border-bottom: 1px solid var(--bio-line);
}
.bio-back {
  background: transparent; color: var(--bio-dim);
  border: 1px solid var(--bio-line); border-radius: 6px;
  padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.bio-back:hover { color: var(--bio-ink); border-color: var(--bio-accent); }
.bio-wordmark { display: flex; flex-direction: column; line-height: 1.15; }
.bio-wordmark b { font-size: 13px; letter-spacing: 0.02em; }
.bio-wordmark span { font-size: 10.5px; color: var(--bio-dim); letter-spacing: 0.14em; text-transform: uppercase; }

.bio-body { flex: 1 1 auto; display: flex; min-height: 0; }
.bio-explorer {
  flex: 0 0 232px; display: flex; flex-direction: column; min-height: 0;
  background: var(--bio-panel-2); border-right: 1px solid var(--bio-line); overflow: auto;
}
.bio-canvas-wrap { flex: 1 1 auto; position: relative; min-width: 0; min-height: 0; }
.bio-canvas-wrap > * { position: absolute; inset: 0; }
/* The view toggle must FLOAT ABOVE the canvas: the generic child rule
   stretches every child over the full wrap, and the canvas (a later
   sibling) painted over the toggle, so real pointer clicks never
   reached it (jsdom's synthetic events bypass hit-testing, which is
   why the contract test alone missed this). */
.bio-canvas-wrap > .bio-view-toggle {
  inset: auto; top: 8px; left: 8px; right: auto; z-index: 5;
  background: var(--bio-panel-2); border: 1px solid var(--bio-line);
  border-radius: 6px;
}
.bio-sparql {
  flex: 0 0 340px; display: flex; flex-direction: column; min-height: 0;
  background: var(--bio-panel-2); border-left: 1px solid var(--bio-line); overflow: auto;
}
.bio-panel-head {
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--bio-dim); padding: 12px 12px 6px; flex: 0 0 auto;
}
.bio-section { padding: 2px 12px 12px; }

/* Ontology explorer */
.bio-tabs { display: flex; gap: 2px; padding: 0 8px; }
.bio-tab {
  background: transparent; color: var(--bio-dim); border: 0;
  border-bottom: 2px solid transparent; padding: 7px 8px; font-size: 11.5px; cursor: pointer;
}
.bio-tab.is-active { color: var(--bio-ink); border-bottom-color: var(--bio-accent); }
.bio-class-row, .bio-prop-row {
  display: flex; align-items: center; gap: 7px; width: 100%;
  padding: 5px 12px; border: 0; background: transparent; text-align: left;
  color: var(--bio-ink); font-size: 12px; cursor: pointer;
}
.bio-class-row.is-sub { padding-left: 24px; }
.bio-class-row:hover, .bio-prop-row:hover { background: #1d1830; }
.bio-class-dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }
.bio-class-name { flex: 1 1 auto; }
.bio-class-count { color: var(--bio-dim); font-size: 11px; }
.bio-prop-row { display: block; cursor: default; }
.bio-prop-name { color: var(--bio-accent); font-size: 12px; }
.bio-prop-sig { color: var(--bio-dim); font-size: 11px; }

/* SPARQL panel */
.bio-query-select {
  width: 100%; background: var(--bio-panel); color: var(--bio-ink);
  border: 1px solid var(--bio-line); border-radius: 6px; padding: 6px 8px; font-size: 12px;
}
.bio-editor {
  width: 100%; box-sizing: border-box; min-height: 120px; resize: vertical;
  background: #0e0b18; color: #cbbdf0; border: 1px solid var(--bio-line);
  border-radius: 6px; padding: 9px; font-size: 12px; line-height: 1.5; margin-top: 8px;
}
.bio-run {
  margin-top: 8px; background: var(--bio-accent); color: #140a22; border: 0;
  border-radius: 6px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.bio-run:hover { filter: brightness(1.08); }
.bio-view-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
}
.bio-view-btn {
  font: inherit;
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid #b17ef0;
  background: transparent;
  color: inherit;
  border-radius: 4px;
  cursor: pointer;
}
.bio-view-btn.active {
  background: #b17ef0;
  color: #fff;
}
.bio-view-caption {
  font-size: 11px;
  opacity: 0.7;
  margin-left: 4px;
}
.bio-notice {
  margin-top: 10px; padding: 8px 10px; border-radius: 6px;
  background: rgba(245, 179, 66, 0.09); border: 1px solid rgba(245, 179, 66, 0.35);
  color: #e7cf9a; font-size: 11px; line-height: 1.5;
}
.bio-error { margin-top: 8px; color: #f19999; font-size: 11.5px; }
.bio-results { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
.bio-results th { text-align: left; color: var(--bio-dim); font-weight: 500; padding: 3px 6px; border-bottom: 1px solid var(--bio-line); }
.bio-results td { padding: 3px 6px; border-bottom: 1px solid var(--bio-line-soft, #1d1830); color: var(--bio-ink); }
.bio-results tr:hover td { background: #1a1528; }
.bio-rowcount { color: var(--bio-dim); font-size: 11px; margin-top: 6px; }

/* Chart */
.bio-chart-head { display: flex; align-items: center; justify-content: space-between; }
.bio-chart-toggle { display: flex; gap: 3px; }
.bio-chart-toggle button {
  background: transparent; color: var(--bio-dim); border: 1px solid var(--bio-line);
  border-radius: 5px; padding: 2px 8px; font-size: 10.5px; cursor: pointer;
}
.bio-chart-toggle button.is-active { color: #140a22; background: var(--bio-accent); border-color: var(--bio-accent); }
.bio-bar-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; cursor: pointer; }
.bio-bar-label { flex: 0 0 96px; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bio-bar-track { flex: 1 1 auto; height: 12px; background: #0e0b18; border-radius: 3px; overflow: hidden; }
.bio-bar-fill {
  /* 12.19 root cause: an inline span ignores width/height, so the
     fill was a zero-size box and only the near-black track showed
     (the reviewed "black bars at 100%"). */
  display: block; height: 100%; background: var(--bio-accent); border-radius: 3px;
}
.bio-bar-value { flex: 0 0 auto; font-size: 11px; color: var(--bio-dim); width: 44px; text-align: right; }
.bio-bar-row:hover .bio-bar-label { color: var(--bio-accent); }
.bio-bar-row.is-selected .bio-bar-fill { background: var(--bio-ok); }
.bio-empty { color: var(--bio-dim); font-size: 12px; padding: 6px 0; }
`;
