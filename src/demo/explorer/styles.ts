/**
 * Model Explorer styles. Generated from the prototype artifact's own
 * stylesheet (scoped under .mx, variables renamed --mx-*), so the
 * playground scenario keeps visual parity with the reviewed prototype.
 * The light palette is the default; .mx-dark carries the dark one and
 * follows the toolkit theme store instead of the OS setting.
 */
export const EXPLORER_STYLES = `
.mx {
  --mx-bg: #f4f6f9;
  --mx-surface: #ffffff;
  --mx-ink: #17202c;
  --mx-muted: #5a6577;
  --mx-edge: #8f9aab;
  --mx-line: #cfd6e0;
  --mx-grid: #e6eaf0;
  --mx-hover: rgba(23, 32, 44, 0.05);
  --mx-accent: #2650c4;
  --mx-accent-ink: #ffffff;
  --mx-accent-soft: rgba(38, 80, 196, 0.11);
  --mx-warn: #b97300;
  --mx-warn-soft: rgba(185, 115, 0, 0.12);
  --mx-crit: #c03636;
  --mx-crit-soft: rgba(192, 54, 54, 0.10);
  --mx-scrim: rgba(17, 24, 34, 0.18);
  --mx-shadow: 0 10px 30px rgba(16, 24, 40, 0.16);
  --mx-sans: var(--g3t-font, 'IBM Plex Sans'), 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mx-mono: var(--g3t-font-mono, 'IBM Plex Mono'), 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.mx.mx-dark {
  --mx-bg: #0f1319;
  --mx-surface: #171c24;
  --mx-ink: #e5e9f0;
  --mx-muted: #9ba6b6;
  --mx-edge: #6d7889;
  --mx-line: #353e4b;
  --mx-grid: #252c37;
  --mx-hover: rgba(229, 233, 240, 0.06);
  --mx-accent: #86a4ff;
  --mx-accent-ink: #0f1319;
  --mx-accent-soft: rgba(134, 164, 255, 0.15);
  --mx-warn: #f0b440;
  --mx-warn-soft: rgba(240, 180, 64, 0.15);
  --mx-crit: #ff8080;
  --mx-crit-soft: rgba(255, 128, 128, 0.13);
  --mx-scrim: rgba(0, 0, 0, 0.45);
  --mx-shadow: 0 10px 30px rgba(0, 0, 0, 0.55);
  color-scheme: dark;
}
.mx { background: var(--mx-bg); color: var(--mx-ink); font-family: var(--mx-sans); font-size: 14px; padding-inline: 16px; padding-block: 0; min-height: 100vh; box-sizing: border-box; }
.mx button, .mx select, .mx input { font: inherit; color: inherit; }
.mx .mx-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.mx .app { max-width: 1440px; margin: 0 auto; padding-block: 20px 28px; display: flex; flex-direction: column; gap: 12px; }
.mx .top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; }
.mx .top h1 { font-size: 20px; font-weight: 600; margin: 0; letter-spacing: -0.01em; }
.mx .top .sample { font-size: 12.5px; color: var(--mx-muted); }
.mx .subbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 13px; color: var(--mx-muted); }
.mx .crumbs { display: flex; align-items: center; gap: 6px; color: var(--mx-ink); }
.mx .crumbs .mod { color: var(--mx-muted); }
.mx .back { border: 1px solid var(--mx-line); background: var(--mx-surface); border-radius: 6px; padding: 3px 10px; cursor: pointer; font-size: 13px; }
.mx .back:disabled { opacity: 0.45; cursor: default; }
.mx .blurb { min-width: 0; }
.mx .blurb b { color: var(--mx-ink); font-weight: 600; }
.mx .stage { position: relative; background: var(--mx-surface); border: 1px solid var(--mx-line); border-radius: 10px; min-height: 640px; overflow: hidden; }
.mx .scroller { overflow-x: auto; overflow-y: hidden; }
.mx .canvas { position: relative; }
.mx svg.diagram { display: block; }
.mx .pill { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 3; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; pointer-events: none; }
.mx .pill > * { pointer-events: auto; }
.mx .pill-box { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; background: var(--mx-surface); border: 1px solid var(--mx-line); border-radius: 10px; padding: 6px; box-shadow: 0 2px 10px rgba(16, 24, 40, 0.07); }
.mx .pill select { border: 1px solid var(--mx-line); border-radius: 6px; background: var(--mx-surface); padding: 4px 8px; font-weight: 600; cursor: pointer; }
.mx .seg { display: inline-flex; border: 1px solid var(--mx-line); border-radius: 6px; overflow: hidden; }
.mx .seg button { border: 0; background: transparent; padding: 4px 10px; cursor: pointer; font-size: 13px; }
.mx .seg button + button { border-left: 1px solid var(--mx-line); }
.mx .seg button[aria-pressed="true"] { background: var(--mx-accent); color: var(--mx-accent-ink); }
.mx .btn { border: 1px solid var(--mx-line); background: var(--mx-surface); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 13px; }
.mx .btn.primary { border-color: var(--mx-accent); color: var(--mx-accent); font-weight: 600; }
.mx .modified { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--mx-warn); padding-inline: 4px; }
.mx .modified .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mx-warn); }
.mx .linkbtn { border: 0; background: none; color: var(--mx-accent); cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 2px; font-size: inherit; }
.mx :focus-visible { outline: 2px solid var(--mx-accent); outline-offset: 2px; }
.mx .scrim { position: absolute; inset: 0; background: var(--mx-scrim); z-index: 4; }
.mx .drawer { position: absolute; top: 0; left: 0; bottom: 0; width: min(340px, 100%); background: var(--mx-surface); border-right: 1px solid var(--mx-line); box-shadow: var(--mx-shadow); z-index: 5; overflow-y: auto; transform: translateX(-104%); transition: transform 180ms ease; padding: 16px 18px 24px; display: flex; flex-direction: column; gap: 18px; }
.mx .drawer.open { transform: none; }
.mx .drawer-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mx .drawer-h h2 { margin: 0; font-size: 15px; font-weight: 600; }
.mx .grp { display: flex; flex-direction: column; gap: 6px; border: 0; padding: 0; margin: 0; min-width: 0; }
.mx .grp legend { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mx-muted); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; padding: 0; }
.mx .grp legend .chg { width: 6px; height: 6px; border-radius: 50%; background: var(--mx-warn); }
.mx .opt { display: grid; grid-template-columns: 18px 1fr auto; align-items: start; gap: 2px 8px; font-size: 13.5px; cursor: pointer; }
.mx .opt input { margin: 3px 0 0; accent-color: var(--mx-accent); }
.mx .opt .n { color: var(--mx-muted); font-variant-numeric: tabular-nums; font-size: 12.5px; }
.mx .opt .desc { grid-column: 2 / 4; font-size: 12px; color: var(--mx-muted); line-height: 1.4; }
.mx .opt.disabled { opacity: 0.45; cursor: default; }
.mx .drawer-foot { font-size: 12px; color: var(--mx-muted); line-height: 1.45; }
.mx .box { fill: var(--mx-surface); stroke: var(--mx-ink); stroke-width: 1.5; }
.mx .rule { stroke: var(--mx-grid); stroke-width: 1; }
.mx .rule.strong { stroke: var(--mx-line); }
.mx .hname { fill: var(--mx-ink); font-weight: 600; font-size: 16px; }
.mx .hname.mono { font-family: var(--mx-mono); font-size: 15px; }
.mx .hster, .mx .hmod { fill: var(--mx-muted); font-size: 12px; }
.mx .hdef { fill: var(--mx-muted); font-size: 11.5px; font-style: italic; }
.mx .sech { fill: var(--mx-muted); font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; }
.mx .comp { fill: var(--mx-muted); font-size: 11.5px; font-style: italic; }
.mx .hide { fill: var(--mx-accent); font-size: 11.5px; opacity: 0; cursor: pointer; transition: opacity 120ms; }
.mx .sec:hover .hide, .mx .hide:focus { opacity: 1; }
.mx .row, .mx .rel, .mx .stub, .mx .hid { cursor: pointer; }
.mx .hl { fill: transparent; }
.mx .row:hover .hl, .mx .rel:hover .hl { fill: var(--mx-hover); }
.mx .hl.sel, .mx .row:hover .hl.sel { fill: var(--mx-accent-soft); }
.mx .hl.rej { fill: var(--mx-crit-soft); }
.mx .nm { fill: var(--mx-ink); font-size: 13px; }
.mx .nm.mono { font-family: var(--mx-mono); font-size: 12.5px; }
.mx .nm.muted { fill: var(--mx-muted); font-style: italic; }
.mx .ty { fill: var(--mx-muted); font-family: var(--mx-mono); font-size: 12px; }
.mx .rq { fill: var(--mx-muted); font-size: 11.5px; }
.mx .rq.strong { fill: var(--mx-ink); font-weight: 500; }
.mx .vl { fill: var(--mx-ink); font-family: var(--mx-mono); font-size: 12px; }
.mx .vl.muted { fill: var(--mx-muted); font-style: italic; }
.mx .vl.bad { fill: var(--mx-crit); font-weight: 500; }
.mx .df { fill: var(--mx-muted); font-size: 11.5px; font-style: italic; }
.mx .faded .nm, .mx .faded .ty, .mx .faded .rq, .mx .faded .vl, .mx .faded .df { opacity: 0.4; }
.mx .dot-on { fill: var(--mx-muted); }
.mx .dot-off { fill: none; stroke: var(--mx-edge); stroke-width: 1.2; }
.mx .dot-warn { fill: var(--mx-warn); }
.mx .link { fill: var(--mx-accent); }
.mx .hid text { fill: var(--mx-accent); font-size: 12px; }
.mx .edge { fill: none; stroke: var(--mx-edge); stroke-width: 1.3; }
.mx .edge.dashed { stroke-dasharray: 4 4; }
.mx .mk { fill: var(--mx-edge); }
.mx .mk-hollow { fill: var(--mx-surface); stroke: var(--mx-edge); stroke-width: 1.3; }
.mx .elab { fill: var(--mx-muted); font-size: 11.5px; }
.mx .elab.mono { font-family: var(--mx-mono); font-size: 11px; }
.mx .stub rect { fill: var(--mx-surface); stroke: var(--mx-edge); stroke-width: 1.2; transition: stroke 120ms; }
.mx .stub.grp rect { stroke-dasharray: 4 4; }
.mx .stub:hover rect, .mx .stub:focus rect { stroke: var(--mx-accent); stroke-width: 1.6; }
.mx .stub:focus { outline: none; }
.mx .sttl { fill: var(--mx-ink); font-size: 13px; font-weight: 600; }
.mx .sttl.mono { font-family: var(--mx-mono); font-size: 12.5px; }
.mx .stsub { fill: var(--mx-muted); font-size: 11.5px; }
.mx .pop { position: absolute; width: 344px; max-width: calc(100% - 16px); background: var(--mx-surface); border: 1px solid var(--mx-line); border-radius: 10px; box-shadow: var(--mx-shadow); padding: 12px 14px 14px; z-index: 2; display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
.mx .pop-h { display: flex; align-items: center; gap: 8px; }
.mx .pop-h .key { font-family: var(--mx-mono); font-weight: 500; font-size: 13.5px; min-width: 0; overflow-wrap: anywhere; }
.mx .tag { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
.mx .tag.ok { background: var(--mx-accent-soft); color: var(--mx-accent); }
.mx .tag.gap, .mx .tag.conflict { background: var(--mx-warn-soft); color: var(--mx-warn); }
.mx .tag.internal { background: var(--mx-hover); color: var(--mx-muted); }
.mx .x { margin-left: auto; border: 0; background: none; cursor: pointer; font-size: 18px; line-height: 1; color: var(--mx-muted); padding: 0 2px; }
.mx .pop p { margin: 0; line-height: 1.45; }
.mx .pop .def em { color: var(--mx-muted); }
.mx table.prov { border-collapse: collapse; width: 100%; font-size: 12.5px; }
.mx table.prov th { text-align: left; font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--mx-muted); font-weight: 600; padding: 0 6px 4px 0; }
.mx table.prov td { border-top: 1px solid var(--mx-grid); padding: 5px 6px 5px 0; vertical-align: top; }
.mx table.prov td:first-child { font-weight: 500; white-space: nowrap; }
.mx table.prov td.code { font-family: var(--mx-mono); font-size: 12px; overflow-wrap: anywhere; }
.mx table.prov td.src { color: var(--mx-muted); font-size: 11.5px; }
.mx table.prov tr.abs td:nth-child(2) { color: var(--mx-muted); font-style: italic; }
.mx .note { border-radius: 6px; padding: 7px 9px; font-size: 12.5px; line-height: 1.45; }
.mx .note.warn { background: var(--mx-warn-soft); }
.mx .note.crit { background: var(--mx-crit-soft); }
.mx .note.info { background: var(--mx-hover); }
.mx .legend { position: absolute; left: 12px; bottom: 10px; display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--mx-muted); background: var(--mx-surface); padding: 4px 6px; border-radius: 6px; z-index: 1; }
.mx .legend span { display: inline-flex; align-items: center; gap: 5px; }
.mx .legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.mx .legend .on { background: var(--mx-muted); }
.mx .legend .off { border: 1.2px solid var(--mx-edge); }
.mx .legend .warn { background: var(--mx-warn); }
.mx .hints { font-size: 12.5px; color: var(--mx-muted); }
.mx .stage.is-map { height: min(80vh, 780px); min-height: 520px; }
.mx .mapwrap { position: absolute; inset: 0; overflow: hidden; touch-action: none; cursor: grab; }
.mx .mapwrap:active { cursor: grabbing; }
.mx .mapsvg { display: block; user-select: none; }
.mx .mapsvg rect, .mx .mapsvg path, .mx .mapsvg line, .mx .mapsvg circle { vector-effect: non-scaling-stroke; }
.mx .bg { fill: transparent; }
.mx .mmodbox { fill: var(--mx-hover); stroke: var(--mx-line); stroke-width: 1; }
.mx .mmodbox.l0 { fill: var(--mx-accent-soft); stroke: var(--mx-accent); stroke-width: 1.5; }
.mx .mmodname { fill: var(--mx-muted); font-weight: 600; letter-spacing: 0.08em; }
.mx .m0name { fill: var(--mx-ink); font-size: 46px; font-weight: 600; }
.mx .m0sub { fill: var(--mx-muted); font-size: 32px; }
.mx .medge { fill: none; stroke: var(--mx-edge); }
.mx .m0count { fill: var(--mx-ink); font-size: 34px; font-weight: 600; paint-order: stroke; stroke: var(--mx-surface); }
.mx .mclass { cursor: pointer; }
.mx .mbox { fill: var(--mx-surface); stroke: var(--mx-ink); stroke-width: 1.5; }
.mx .mclass:hover .mbox { stroke: var(--mx-accent); }
.mx .mclass.sel .mbox { stroke: var(--mx-accent); stroke-width: 3; }
.mx .mclass:focus { outline: none; }
.mx .mclass:focus-visible .mbox { stroke: var(--mx-accent); stroke-width: 3; }
.mx .dim { opacity: 0.22; }
.mx .m1name { fill: var(--mx-ink); font-size: 24px; font-weight: 600; }
.mx .m1name.mono { font-family: var(--mx-mono); font-size: 22px; }
.mx .m2name { fill: var(--mx-ink); font-size: 17px; font-weight: 600; }
.mx .m2row { fill: var(--mx-ink); font-size: 15px; }
.mx .m2row.mono { font-family: var(--mx-mono); font-size: 14px; }
.mx .m2row.muted { fill: var(--mx-muted); font-style: italic; }
.mx .faded .m2row { opacity: 0.4; }
.mx .m2name.mono { font-family: var(--mx-mono); font-size: 15px; }
.mx .mgap { fill: var(--mx-warn); }
.mx .mgapn { fill: var(--mx-surface); font-size: 16px; font-weight: 600; }
.mx .edge.hot { stroke: var(--mx-accent); stroke-width: 2; }
.mx .mk-hot { fill: var(--mx-accent); }
.mx .mk-hollow-hot { fill: var(--mx-surface); stroke: var(--mx-accent); stroke-width: 1.3; }
.mx .halo { paint-order: stroke; stroke: var(--mx-surface); stroke-linejoin: round; }
.mx .overlay { position: absolute; z-index: 2; background: var(--mx-surface); border: 1px solid var(--mx-line); border-radius: 10px; box-shadow: 0 2px 12px rgba(16, 24, 40, 0.09); cursor: auto; }
.mx .selcard { top: 68px; right: 12px; width: min(320px, calc(100% - 24px)); max-height: calc(100% - 170px); overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
.mx .sc-h { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.mx .sc-item { display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--mx-grid); padding-top: 8px; }
.mx .sc-item p { margin: 0; color: var(--mx-muted); line-height: 1.4; font-size: 12.5px; }
.mx .sc-row { display: flex; justify-content: space-between; gap: 8px; }
.mx .sc-name { font-weight: 600; }
.mx .sc-mod, .mx .sc-meta { color: var(--mx-muted); font-size: 12px; }
.mx .warn-t { color: var(--mx-warn); font-weight: 500; }
.mx .sc-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.mx .sc-actions .btn[aria-pressed="true"] { border-color: var(--mx-accent); color: var(--mx-accent); }
.mx .sc-sec { display: flex; flex-direction: column; gap: 5px; border-top: 1px solid var(--mx-grid); padding-top: 8px; }
.mx .sc-lbl { font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mx-muted); margin-top: 2px; }
.mx .sc-rel { font-size: 12.5px; line-height: 1.4; }
.mx .sc-none, .mx .sc-tip { color: var(--mx-muted); font-size: 12.5px; margin: 0; }
.mx .sc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mx .chip { border: 1px solid var(--mx-line); background: var(--mx-surface); border-radius: 999px; padding: 2px 10px; font-size: 12.5px; cursor: pointer; }
.mx .chip:hover { border-color: var(--mx-accent); color: var(--mx-accent); }
.mx .lodbox { right: 12px; bottom: 12px; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
.mx .lod-levels { display: flex; flex-direction: column; border: 1px solid var(--mx-line); border-radius: 6px; overflow: hidden; }
.mx .lod-levels button { border: 0; background: transparent; padding: 5px 12px; text-align: left; cursor: pointer; font-size: 13px; }
.mx .lod-levels button + button { border-top: 1px solid var(--mx-line); }
.mx .lod-levels button[aria-pressed="true"] { background: var(--mx-accent); color: var(--mx-accent-ink); font-weight: 600; }
.mx .zoomrow { display: flex; align-items: center; gap: 6px; }
.mx .zoomrow .btn { padding: 2px 9px; }
.mx .pct { min-width: 3.2em; text-align: center; font-variant-numeric: tabular-nums; font-size: 12.5px; color: var(--mx-muted); }
@media (prefers-reduced-motion: reduce) {
.mx .drawer, .mx .hide, .mx .stub rect { transition: none; }
 }

`;
