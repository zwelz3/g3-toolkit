/**
 * Scoped identity for the auditor shell. Distinct again (item 5): a
 * compliance ledger / control-room. Cool steel-slate chrome, a teal accent, an
 * explicit compliance ramp (red violation, amber warning, green clear), and a
 * monospace face for timestamps and ids since this shell is about the record.
 * The timeline strip and the dual-range slider sit along the bottom.
 * Namespaced under .au-shell.
 */
export const AUDIT_STYLES = `
.au-shell {
  --au-bg: #0e1319;
  --au-panel: #151c25;
  --au-panel-2: #111822;
  --au-line: #263340;
  --au-ink: #d3dde7;
  --au-dim: #7c8b9c;
  --au-accent: #2dd4bf;
  --au-violation: #f87171;
  --au-warning: #f5b342;
  --au-ok: #34d399;
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  background: var(--au-bg); color: var(--au-ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.au-mono, .au-time, .au-event-time { font-family: ui-monospace, "SF Mono", Menlo, monospace; }

.au-topbar {
  display: flex; align-items: center; gap: 14px;
  height: 48px; padding: 0 14px; flex: 0 0 auto;
  background: linear-gradient(180deg, #18212c, #121820);
  border-bottom: 1px solid var(--au-line);
}
.au-back {
  background: transparent; color: var(--au-dim);
  border: 1px solid var(--au-line); border-radius: 6px;
  padding: 5px 10px; font-size: 12px; cursor: pointer;
}
.au-back:hover { color: var(--au-ink); border-color: var(--au-accent); }
.au-wordmark { display: flex; flex-direction: column; line-height: 1.15; }
.au-wordmark b { font-size: 13px; letter-spacing: 0.02em; }
.au-wordmark span { font-size: 10.5px; color: var(--au-dim); letter-spacing: 0.14em; text-transform: uppercase; }
.au-counts { margin-left: auto; display: flex; gap: 8px; }
.au-count-chip { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--au-dim); }
.au-count-chip b { font-size: 13px; }
.au-dot { width: 8px; height: 8px; border-radius: 50%; }
.au-dot-v { background: var(--au-violation); }
.au-dot-w { background: var(--au-warning); }

.au-body { flex: 1 1 auto; display: flex; min-height: 0; }
.au-report {
  flex: 0 0 264px; display: flex; flex-direction: column; min-height: 0;
  background: var(--au-panel-2); border-right: 1px solid var(--au-line); overflow: auto;
}
.au-canvas-wrap { flex: 1 1 auto; position: relative; min-width: 0; min-height: 0; }
.au-canvas-wrap > * { position: absolute; inset: 0; }
.au-timeline {
  flex: 0 0 440px; display: flex; flex-direction: column; min-height: 0; /* 12.8 */
  background: var(--au-panel-2); border-left: 1px solid var(--au-line); overflow: auto;
}
.au-panel-head {
  font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--au-dim); padding: 12px 12px 6px; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: space-between;
}
.au-section { padding: 2px 8px 12px; }

/* SHACL report */
.au-finding {
  display: flex; gap: 8px; width: 100%; text-align: left;
  padding: 7px 8px; border: 0; background: transparent; border-radius: 6px;
  color: var(--au-ink); cursor: pointer; margin-bottom: 2px;
}
.au-finding:hover { background: #1a232e; }
.au-finding-bar { flex: 0 0 3px; border-radius: 2px; align-self: stretch; }
.au-finding.v .au-finding-bar { background: var(--au-violation); }
.au-finding.w .au-finding-bar { background: var(--au-warning); }
.au-finding-body { display: flex; flex-direction: column; gap: 2px; }
.au-finding-name { font-size: 12.5px; font-weight: 500; }
.au-finding-msg { font-size: 11px; color: var(--au-dim); line-height: 1.4; }
.au-clear { color: var(--au-ok); font-size: 12px; padding: 6px 8px; }

/* Timeline table */
.au-event {
  display: grid; grid-template-columns: 116px 74px 1fr; align-items: baseline;
  gap: 6px; width: 100%; text-align: left; border: 0; background: transparent;
  padding: 5px 8px; color: var(--au-ink); cursor: pointer; border-radius: 5px;
  border-left: 2px solid transparent;
}
.au-event:hover { background: #1a232e; }
.au-event.out { opacity: 0.32; }
.au-event-time { font-size: 10.5px; color: var(--au-dim); }
.au-event-kind {
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  padding: 1px 5px; border-radius: 3px; justify-self: start; min-width: 88px; text-align: center; /* 12.8: fits generated */
}
.au-kind-generated { background: rgba(45, 212, 191, 0.18); color: var(--au-accent); }
.au-kind-started { background: rgba(148, 163, 184, 0.18); color: #b7c4d3; }
.au-kind-ended { background: rgba(148, 163, 184, 0.1); color: #8fa0b2; }
.au-event-name { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Range slider footer */
.au-footer {
  flex: 0 0 auto; border-top: 1px solid var(--au-line);
  background: var(--au-panel); padding: 10px 16px 14px;
}
.au-range-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.au-range-label { font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--au-dim); }
.au-range-window { font-size: 12px; color: var(--au-ink); }
.au-range-window b { color: var(--au-accent); font-weight: 600; }
.au-range-reset {
  background: transparent; color: var(--au-dim); border: 1px solid var(--au-line);
  border-radius: 5px; padding: 3px 9px; font-size: 11px; cursor: pointer; margin-left: 10px;
}
.au-range-reset:hover { color: var(--au-ink); border-color: var(--au-accent); }

.au-track { position: relative; height: 34px; }
.au-track-line { position: absolute; top: 21px; left: 0; right: 0; height: 3px; background: #0c1117; border-radius: 2px; }
.au-track-fill { position: absolute; top: 21px; height: 3px; background: var(--au-accent); border-radius: 2px; }
.au-tick {
  position: absolute; top: 0; transform: translateX(-50%);
  font-size: 9px; line-height: 1; cursor: help; user-select: none;
}
.au-tick-generated { color: var(--au-accent); }
.au-tick-started { color: #8fa0b2; }
.au-tick-ended { color: #55636f; }
.au-range-input {
  position: absolute; top: 12px; left: 0; width: 100%; margin: 0;
  -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none;
}
.au-range-input::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; pointer-events: auto;
  width: 16px; height: 16px; border-radius: 50%; background: var(--au-ink);
  border: 3px solid var(--au-accent); cursor: pointer; margin-top: 0;
}
.au-range-input::-moz-range-thumb {
  pointer-events: auto; width: 16px; height: 16px; border-radius: 50%;
  background: var(--au-ink); border: 3px solid var(--au-accent); cursor: pointer;
}
.au-empty { color: var(--au-dim); font-size: 12px; padding: 6px 8px; }
.au-ov-chips { display: flex; flex-direction: column; gap: 4px; padding: 6px 8px 0; }
.au-ov-chip {
  font: inherit; font-size: 11px; text-align: left; padding: 3px 8px;
  border: 1px solid var(--au-line); border-radius: 4px; cursor: pointer;
  background: transparent; color: var(--au-ink);
}
.au-ov-chip.on { border-color: var(--au-accent); background: rgba(45, 212, 191, 0.12); }
.au-trace { position: relative; }
.au-trace-close {
  position: absolute; top: 2px; right: 2px; z-index: 2;
  font: inherit; font-size: 11px; line-height: 1; padding: 2px 5px;
  border: none; background: transparent; color: var(--au-dim); cursor: pointer;
}
.au-inspector {
  position: relative; margin-top: 8px;
  border: 1px solid var(--au-line); border-radius: 6px;
  max-height: 260px; overflow: auto;
}
.au-undated-note {
  font-size: 10px; padding: 4px 10px; color: var(--au-warning, #e3b341);
  border-bottom: 1px solid var(--au-line); opacity: 0.85;
}
`;
