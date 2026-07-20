/**
 * Scoped identity for the supply-chain thread shell. Distinct from the MBSE
 * blueprint on purpose (item 5): where MBSE reads as a drafting workbench,
 * this reads as a logistics operations console. Deep green-charcoal chrome, a
 * signal-orange accent for the active control, and an explicit risk ramp
 * (green ok, amber warning, red violation) that matches how the gap panel
 * classifies findings. Everything is namespaced under .sc-shell.
 */
export const THREAD_STYLES = `
.sc-shell {
  --sc-bg: #0e1512;
  --sc-panel: #14201b;
  --sc-panel-2: #0f1a15;
  --sc-line: #26332c;
  --sc-ink: #d6e2da;
  --sc-dim: #7f9488;
  --sc-accent: #f4923b;
  --sc-violation: #ef4444;
  --sc-warning: #f5b342;
  --sc-ok: #34d399;
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: var(--sc-bg); color: var(--sc-ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.sc-mono, .sc-count, .sc-chip { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
.sc-chip-on { border-color: var(--sc-accent, #f4923b); background: rgba(244, 146, 59, 0.14); }

.sc-topbar {
  display: flex; align-items: center; gap: 14px;
  height: 48px; padding: 0 14px; flex: 0 0 auto;
  background: linear-gradient(180deg, #16241d, #101a15);
  border-bottom: 1px solid var(--sc-line);
}
.sc-back {
  background: transparent; color: var(--sc-dim);
  border: 1px solid var(--sc-line); border-radius: 6px;
  padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.sc-back:hover { color: var(--sc-ink); border-color: var(--sc-accent); }
.sc-wordmark { display: flex; flex-direction: column; line-height: 1.15; }
.sc-wordmark b { font-size: 13px; letter-spacing: 0.02em; }
.sc-wordmark span { font-size: 10.5px; color: var(--sc-dim); letter-spacing: 0.14em; text-transform: uppercase; }
.sc-modes { margin-left: auto; display: flex; gap: 4px; }
.sc-mode {
  background: transparent; color: var(--sc-dim);
  border: 1px solid var(--sc-line); border-radius: 5px;
  padding: 4px 9px; font-size: 11.5px; cursor: pointer;
}
.sc-mode:hover { color: var(--sc-ink); }
.sc-mode.is-active { color: #14100a; background: var(--sc-accent); border-color: var(--sc-accent); font-weight: 600; }

.sc-body { flex: 1 1 auto; display: flex; min-height: 0; }
.sc-canvas-wrap { flex: 1 1 auto; position: relative; min-width: 0; min-height: 0; }
.sc-canvas-wrap > * { position: absolute; inset: 0; }
/* Minimap floats ABOVE the canvas (same stacking lesson as the bio
   view toggle: the generic child rule stretches and the later canvas
   sibling would otherwise intercept pointer events). */
.sc-canvas-wrap > .sc-route-status {
  inset: auto; left: 10px; bottom: 10px; z-index: 5;
  font-size: 11px; padding: 4px 8px; border-radius: 4px;
  background: rgba(0,0,0,0.55); color: #fff;
}
.sc-canvas-wrap > .sc-minimap {
  inset: auto; right: 10px; bottom: 10px; z-index: 5;
}
.sc-sidebar {
  flex: 0 0 288px; display: flex; flex-direction: column; min-height: 0;
  background: var(--sc-panel-2); border-left: 1px solid var(--sc-line); overflow: auto;
}
.sc-panel-head {
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--sc-dim); padding: 12px 12px 6px; flex: 0 0 auto;
}
.sc-section { padding: 2px 12px 12px; }

.sc-src-row, .sc-cluster-row, .sc-gap-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 5px 8px; border: 0; background: transparent; text-align: left;
  color: var(--sc-ink); font-size: 12px; border-radius: 5px;
}
button.sc-cluster-row, button.sc-gap-row { cursor: pointer; }
button.sc-cluster-row:hover, button.sc-gap-row:hover { background: #16221c; }
.sc-src-name { flex: 1 1 auto; color: var(--sc-dim); }
.sc-count { color: var(--sc-accent); font-weight: 600; }

.sc-swatch { width: 11px; height: 11px; border-radius: 3px; flex: 0 0 auto; }
.sc-cluster-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-cluster-count { color: var(--sc-dim); font-size: 11px; }

.sc-gap-row { align-items: flex-start; gap: 9px; }
.sc-chip {
  flex: 0 0 auto; font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
  padding: 2px 5px; border-radius: 3px; margin-top: 1px; text-transform: uppercase;
}
.sc-chip-violation { background: var(--sc-violation); color: #1a0606; }
.sc-chip-warning { background: var(--sc-warning); color: #1a1206; }
.sc-gap-body { display: flex; flex-direction: column; gap: 1px; }
.sc-gap-kind { font-size: 11px; color: var(--sc-dim); text-transform: capitalize; }
.sc-gap-detail { font-size: 12px; line-height: 1.4; }

.sc-select {
  width: 100%; background: var(--sc-panel); color: var(--sc-ink);
  border: 1px solid var(--sc-line); border-radius: 6px; padding: 6px 8px; font-size: 12px;
}
.sc-path { margin-top: 8px; font-size: 11.5px; color: var(--sc-dim); }
.sc-path-line { padding: 2px 0; }
.sc-path-line b { color: var(--sc-ink); font-weight: 500; }
.sc-empty { color: var(--sc-dim); font-size: 12px; padding: 4px 0; }

/* 12.7: draw the eye to the reveal affordance once at load. */
@keyframes sc-notice-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(244, 146, 59, 0); }
  35% { box-shadow: 0 0 0 6px rgba(244, 146, 59, 0.35); }
}
[data-testid="hidden-suppliers"] {
  animation: sc-notice-pulse 1.1s ease-out 0.4s 2;
}
@media (prefers-reduced-motion: reduce) {
  [data-testid="hidden-suppliers"] { animation: none; }
}
`;
