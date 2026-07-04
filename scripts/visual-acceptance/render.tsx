/**
 * Visual acceptance page generator (planning/visual-acceptance-1.md).
 *
 * SSRs the REAL toolkit components and tokens into one self-contained
 * HTML file. Anything shown here is the shipped source rendering
 * itself; the only hand-written parts are page chrome, fixtures, and
 * the check descriptions.
 */
import { createElement as h, type ReactNode } from "react";
import {
  UGM,
  DESIGN_TOKENS,
  SEQUENTIAL_SCALE,
  DIVERGING_SCALE,
} from "@g3t/core";
import {
  LIGHT_THEME,
  DARK_THEME,
  HIGH_CONTRAST_THEME,
  deriveCytoscapeStyle,
  type G3tTheme,
} from "../../packages/react/src/theme/ThemeManager";
import { Icon } from "../../packages/react/src/icons/Icon";
import { DEFAULT_ICON_PATHS } from "../../packages/react/src/icons/default-icons";
import { EmptyState } from "../../packages/react/src/interaction/feedback/EmptyState";
import { Skeleton } from "../../packages/react/src/interaction/feedback/Skeleton";
import { SearchBar } from "../../packages/react/src/interaction/search/SearchBar";
import { TreeView } from "../../packages/react/src/views/tree/TreeView";
import { MatrixView } from "../../packages/react/src/views/matrix/MatrixView";
import { TableView } from "../../packages/react/src/views/table/TableView";
import { MapView } from "../../packages/react/src/views/map/MapView";
import { DetailInspector } from "../../packages/react/src/views/inspector/DetailInspector";
import { ShaclShapeBrowser } from "../../packages/react/src/views/schema/ShaclShapeBrowser";
import { AnnotationPanel } from "../../packages/react/src/interaction/annotations/AnnotationPanel";
import { EncodingSpecPanel } from "../../packages/react/src/interaction/encoding/EncodingSpecPanel";
import {
  Va20Live,
  Va21IconSets,
  Va22CanvasLoop,
  Va23Toolbar,
  Va24Containers,
  Va27Structural,
  Va28ShaclShapes,
  Va29ShaclReport,
  Va30LinkedShacl,
  Va25Workspace,
  Va26Algorithms,
  Va31Routing,
  VA20_SPEC,
} from "./va20-shared";
import { ThemeSwitcher } from "../../packages/react/src/theme/ThemeSwitcher";
import { useSelectionStore } from "../../packages/react/src/state/selection-store";
// Vite inlines the stylesheet text; the page carries the real base CSS.
import baseCss from "../../packages/react/src/theme/g3t-base.css?raw";

// ── Fixtures ─────────────────────────────────────────────────────────

function gradientGraph(): UGM {
  const ugm = new UGM();
  const add = (id: string, type: string, label: string) =>
    ugm.addNode(id, { types: [type], properties: { label } });
  add("p1", "Person", "Aris Quill");
  add("p2", "Person", "Bea Marlow");
  add("p3", "Person", "Cole Veras");
  add("o1", "Org", "Helix Labs");
  add("o2", "Org", "Northbeam");
  add("d1", "Document", "Site survey");
  const e = (s: string, t: string, type: string) =>
    ugm.addEdge(s, t, { type, properties: {} });
  e("p1", "o1", "worksAt");
  e("p2", "o1", "worksAt");
  e("p3", "o1", "worksAt");
  e("p3", "o2", "worksAt");
  e("p1", "p2", "knows");
  e("p1", "d1", "authored");
  return ugm;
}

function truncationGraph(): UGM {
  const ugm = new UGM();
  for (let i = 0; i < 6; i++)
    ugm.addNode(`n${i}`, { types: [`Type${i}`], properties: {} });
  for (let i = 0; i < 5; i++)
    ugm.addEdge(`n${i}`, `n${i + 1}`, { type: "rel", properties: {} });
  return ugm;
}

function geoGraph(): UGM {
  const ugm = new UGM();
  const sites: Array<[string, string, number, number]> = [
    ["g1", "Alpha Station", 39.1, -84.5],
    ["g2", "Bravo Depot", 40.7, -74.0],
    ["g3", "Carlow Array", 47.6, -122.3],
    ["g4", "Delta Yard", 33.7, -84.4],
  ];
  for (const [id, name, lat, lon] of sites)
    ugm.addNode(id, {
      types: ["Site"],
      properties: { label: name, name, lat, lon },
    });
  return ugm;
}

function containmentGraph(): UGM {
  const ugm = new UGM();
  const add = (id: string, type: string, label: string) =>
    ugm.addNode(id, { types: [type], properties: { label } });
  add("sys", "System", "Sensor Suite");
  add("a", "Assembly", "Optical Bench");
  add("b", "Assembly", "Power Module");
  add("a1", "Part", "Lens Stack");
  add("a2", "Part", "Focal Array");
  const c = (s: string, t2: string) =>
    ugm.addEdge(s, t2, { type: "contains", properties: {} });
  c("sys", "a");
  c("sys", "b");
  c("a", "a1");
  c("a", "a2");
  return ugm;
}

function tableGraph(): UGM {
  const ugm = new UGM();
  const rows: Array<[string, string, string, string]> = [
    ["n1", "Person", "Aris Quill", "Helix Labs"],
    ["n2", "Person", "Bea Marlow", "Helix Labs"],
    ["n3", "Org", "Helix Labs", "—"],
    ["n4", "Document", "Site survey", "—"],
    ["n5", "Person", "Cole Veras", "Northbeam"],
  ];
  for (const [id, type, label, org] of rows)
    ugm.addNode(id, { types: [type], properties: { label, org } });
  return ugm;
}

// ── Theme CSS generation (same property names ThemeManager injects) ──

function themeVars(t: G3tTheme): string {
  const pairs: Array<[string, string]> = [
    ["color-scheme", t.colorScheme],
    ["--g3t-accent-color-controls", t.accentPrimary],
    ["--g3t-bg-primary", t.bgPrimary],
    ["--g3t-bg-secondary", t.bgSecondary],
    ["--g3t-bg-tertiary", t.bgTertiary],
    ["--g3t-border", t.border],
    ["--g3t-text-primary", t.textPrimary],
    ["--g3t-text-secondary", t.textSecondary],
    ["--g3t-text-muted", t.textMuted],
    ["--g3t-accent-primary", t.accentPrimary],
    ["--g3t-accent-hover", t.accentHover],
    ["--g3t-accent-muted", t.accentMuted],
    ["--g3t-success", t.success],
    ["--g3t-warning", t.warning],
    ["--g3t-error", t.error],
    ["--g3t-canvas-bg", t.canvasBg],
    ["--g3t-selection-highlight", t.selectionHighlight],
  ];
  t.typePalette.forEach((c, i) => pairs.push([`--g3t-type-${i}`, c]));
  return pairs.map(([k, v]) => `${k}: ${v};`).join("\n  ");
}

function tokenVars(): string {
  const d = DESIGN_TOKENS;
  const pairs: Array<[string, string]> = [
    ["--g3t-font", d.fontFamily],
    ["--g3t-font-mono", d.fontMono],
    ["--g3t-font-sm", d.fontSizeSm],
    ["--g3t-font-md", d.fontSizeMd],
    ["--g3t-radius-sm", d.radiusSm],
    ["--g3t-radius-md", d.radiusMd],
    ["--g3t-space-2", d.space2],
    ["--g3t-space-4", d.space4],
    ["--g3t-space-6", d.space6],
    ["--g3t-transition-fast", d.transitionFast],
    ["--g3t-transition-base", d.transitionBase],
    ["--g3t-focus-ring-width", d.focusRingWidth],
    ["--g3t-focus-ring-offset", d.focusRingOffset],
    ["--g3t-selection-bar-width", d.selectionBarWidth],
    ["--g3t-selection-halo-width", d.selectionHaloWidth],
    ["--g3t-deemphasized-opacity", d.deemphasizedOpacity],
  ];
  SEQUENTIAL_SCALE.forEach((c, i) => pairs.push([`--g3t-seq-${i}`, c]));
  DIVERGING_SCALE.forEach((c, i) => pairs.push([`--g3t-div-${i}`, c]));
  return pairs.map(([k, v]) => `${k}: ${v};`).join("\n  ");
}

// ── Page sections ────────────────────────────────────────────────────

function check(id: string, title: string, pass: string, body: ReactNode) {
  return h(
    "section",
    { className: "va-check", id },
    h(
      "header",
      null,
      h("span", { className: "va-id" }, id.toUpperCase()),
      h("h2", null, title),
    ),
    h("p", { className: "va-pass" }, h("strong", null, "Pass when: "), pass),
    h("div", { className: "va-body" }, body),
  );
}

function iconGrid() {
  const names = Object.keys(DEFAULT_ICON_PATHS);
  return h(
    "div",
    { className: "va-icon-grid" },
    ...names.map((n) =>
      h(
        "figure",
        { key: n },
        h(Icon, { name: n, size: 16 }),
        h("figcaption", null, n),
      ),
    ),
  );
}

function ramp(scale: readonly string[], label: string) {
  return h(
    "div",
    { className: "va-ramp-row" },
    h("span", { className: "va-ramp-label" }, label),
    h(
      "div",
      { className: "va-ramp" },
      ...scale.map((c, i) => h("span", { key: i, style: { background: c } })),
    ),
  );
}

/** Pre-populate the selection the page's table demonstrates. */
export function initFixtureState(): void {
  useSelectionStore.getState().selectNodes(["n2", "n5", "g2"]);
}

/** The page body as a component; rendered client-side under jsdom so
 *  hooks (selection store) behave exactly as in a browser. */
// Focused, current-work page emitted by default: this artifact is the
// INTERMEDIATE review surface (the comprehensive suite is the Storybook
// pre-merge-request check). FullPageBody below retains the full gallery
// and can be wired back in when the comprehensive set is needed.
export function PageBody() {
  return h(
    "main",
    null,
    h(
      "header",
      { className: "va-header" },
      h("h1", null, "g3-toolkit visual acceptance: intermediate review"),
      h(
        "p",
        null,
        "Just the work currently in flight. The comprehensive component ",
        "suite is the Storybook pre-merge check; this page is for quick ",
        "intermediate review on device. Use the theme switcher on each check.",
      ),
    ),
    h(
      "div",
      { className: "va-sticky-bar" },
      h("div", { id: "va-theme-root" }, h(ThemeSwitcher)),
    ),
    check(
      "va-31",
      "Obstacle-aware edge routing: segments vs taxi (LIVE)",
      "the edge-routing change under test, shown as before/after on ONE fixture (Source \\u2192 Relay \\u2192 Sink in a row, with skip edges that must pass the Relay block between their endpoints). On a phone the two canvases stack; compare them. BEFORE (taxi): the bypass edge (Source to Sink) and the ack edge (Sink back to Source) head straight across and cut THROUGH or behind the Relay block. AFTER (routed, the new default): those same skip edges BEND AROUND Relay in right-angle (orthogonal) segments, never crossing the block; the bends are clean 90-degree corners, not diagonals. Both canvases agree on everything else: feed/drain run port-to-port along the top flow, the note is a DASHED dependency reaching Relay, and every arrowhead lands on the correct block (the bypass arrow on Sink's left edge, the ack arrow on Source). CRITICAL for the backward edge: ack must route cleanly around Relay and arrive at Source without the bend mirroring to the wrong side or detaching from the endpoint. If the routed side looks identical to taxi (edges still cross Relay), the segments path is not taking effect; if bends jump to the wrong side of an edge, the perpendicular sign is flipped.",
      h("div", { id: "va31-root" }, h(Va31Routing, { live: false })),
    ),
    check(
      "collapse",
      "Structural collapse: on-container toggle (LIVE)",
      "each container shows a \u2212 chip at the right of its header when expanded and a + chip when collapsed; the glyph is centered in the chip. Tap it (or right-click the header) to collapse/expand all of that container's compartments. The container shrinks (collapse is a layout-time input, so other blocks may shift). Tapping a row still selects only that row; the chip itself never selects. CAMERA: pan/zoom into a container, then toggle its chip (or collapse a single compartment); the viewport should hold, not refit. ACCENT SYNC: the chip's border and glyph use the toolkit accent (the swatch below); switch themes and confirm the chip color tracks the swatch.",
      h(
        "div",
        null,
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              fontSize: 12,
              color: "var(--g3t-text-secondary)",
            },
          },
          h("span", null, "Toolkit accent"),
          h("span", {
            style: {
              display: "inline-block",
              width: 16,
              height: 16,
              borderRadius: 3,
              background: "var(--g3t-accent-primary)",
              border: "1px solid var(--g3t-border)",
            },
          }),
          h(
            "span",
            null,
            "the chip border and glyph should match this in every theme.",
          ),
        ),
        h("div", { id: "va27-root" }, h(Va27Structural, { live: false })),
      ),
    ),
    check(
      "atom-emptystate",
      "EmptyState (atom)",
      "one shared anatomy; copy says what the view is, why it is empty, and what fills it; the error variant reads as an error without shouting.",
      h(
        "div",
        { className: "va-split" },
        h(EmptyState, {
          title: "No temporal data",
          description:
            "The timeline reads temporal_start and temporal_end properties. Load time-stamped elements to populate it.",
          icon: "info",
        }),
        h(EmptyState, {
          variant: "error",
          title: "Endpoint unreachable",
          description:
            "The SPARQL endpoint did not respond. Check the URL in the adapter configuration and retry.",
        }),
      ),
    ),
    check(
      "atom-skeleton",
      "Skeleton (atom)",
      "the shimmer is subtle (surface tones, not attention-grabbing); text lines read as a paragraph placeholder; the block reads as a pending panel. With OS reduce-motion the shimmer freezes to a static block.",
      h(
        "div",
        { className: "va-split" },
        h(Skeleton, { lines: 4 }),
        h(Skeleton, { variant: "block", height: 96 }),
      ),
    ),
    check(
      "molecule-searchbar",
      "SearchBar (molecule)",
      "fuzzy node search over a UGM; the input shows the placeholder and the search affordance. Full keystroke interaction is exercised in the Storybook story; this is an appearance check.",
      h(
        "div",
        { id: "searchbar-root", style: { maxWidth: 360 } },
        h(SearchBar, {
          ugm: tableGraph(),
          onSearchChange: () => {},
          placeholder: "Search nodes...",
        }),
      ),
    ),
  );
}

export function FullPageBody() {
  return h(
    "main",
    null,
    h(
      "header",
      { className: "va-header" },
      h("h1", null, "g3-toolkit visual acceptance: design pass 2"),
      h(
        "p",
        null,
        "Every component below is the shipped source rendering itself. ",
        "Work through VA-1 to VA-10; report each as pass, or fail with ",
        "what looked wrong. Use the theme switcher on every check.",
      ),
    ),
    h(
      "div",
      { className: "va-sticky-bar" },
      h("div", { id: "va-theme-root" }, h(ThemeSwitcher)),
    ),
    check(
      "va-1",
      "Icon set (24 glyphs at 16px)",
      "uniform stroke weight, nothing clipped, each recognizable at a glance.",
      iconGrid(),
    ),
    check(
      "va-2",
      "Icon sizing and currentColor",
      "crisp at 12/16/20px; all recolor when you switch theme (they inherit text color).",
      h(
        "div",
        { className: "va-row" },
        ...[12, 16, 20].map((s) =>
          h(
            "span",
            { key: s, className: "va-iconsize" },
            h(Icon, { name: "filter", size: s }),
            ` ${s}px`,
          ),
        ),
        h(
          "span",
          { className: "va-accent-text" },
          h(Icon, { name: "pin", size: 16 }),
          " inherits accent",
        ),
      ),
    ),
    check(
      "va-3",
      "EmptyState and ErrorState",
      "one shared anatomy; copy says what the view is, why it is empty, and what fills it; the error variant reads as an error without shouting.",
      h(
        "div",
        { className: "va-split" },
        h(EmptyState, {
          title: "No temporal data",
          description:
            "The timeline reads temporal_start and temporal_end properties. Load time-stamped elements to populate it.",
          icon: "info",
        }),
        h(EmptyState, {
          variant: "error",
          title: "Endpoint unreachable",
          description:
            "The SPARQL endpoint did not respond. Check the URL in the adapter configuration and retry.",
        }),
      ),
    ),
    check(
      "va-4",
      "Matrix co-occurrence gradient (viridis)",
      "cell color ordering tracks the counts; numbers stay legible on the darkest and brightest cells; switch to dark theme and confirm nothing washes out.",
      h(
        "div",
        { className: "va-scroll" },
        h(MatrixView, { ugm: gradientGraph() }),
      ),
    ),
    check(
      "va-5",
      "Matrix truncation notice",
      "a plain, non-alarming notice reports 3 of 6 types and says how to see the rest.",
      h(
        "div",
        { className: "va-scroll" },
        h(MatrixView, { ugm: truncationGraph(), maxSize: 3 }),
      ),
    ),
    check(
      "va-6",
      "Table selection signature",
      "rows 2 and 5 carry the accent bar plus a faint tint; the bar follows the accent in all three themes; unselected rows are untouched.",
      h(
        "div",
        { className: "va-scroll" },
        h(TableView, { ugm: tableGraph(), pageSize: 10 }),
      ),
    ),
    check(
      "va-7",
      "Data scales",
      "the sequential ramp progresses smoothly dark-to-bright with no banding jumps; the diverging ramp's center swatch reads neutral.",
      h(
        "div",
        null,
        ramp(SEQUENTIAL_SCALE, "sequential (viridis)"),
        ramp(DIVERGING_SCALE, "diverging (PuOr)"),
      ),
    ),
    check(
      "va-8",
      "Focus ring (keyboard only)",
      "press Tab repeatedly: every control gets the same accent ring with a small offset; click the same controls with the mouse: no ring.",
      h(
        "div",
        { className: "va-row" },
        h("button", { className: "g3t-btn" }, "Run query"),
        h("button", { className: "g3t-btn" }, "Save changes"),
        h("input", {
          className: "g3t-input",
          placeholder: "Filter nodes",
          "aria-label": "Filter nodes",
        }),
        h(
          "select",
          { className: "g3t-select", "aria-label": "Layout" },
          h("option", null, "Force-directed"),
          h("option", null, "Hierarchical"),
        ),
      ),
    ),
    check(
      "va-9",
      "Reduced motion (simulated)",
      "the swatch pulses; ticking the box freezes it instantly. This simulates the OS setting by zeroing the duration tokens; the real check is enabling reduce-motion in the OS and reloading.",
      h(
        "div",
        { className: "va-row" },
        h("span", { className: "va-pulse", "aria-hidden": true }),
        h(
          "label",
          { className: "va-motion-toggle" },
          h("input", {
            type: "checkbox",
            id: "va-reduce",
            className: "g3t-checkbox",
          }),
          " simulate prefers-reduced-motion",
        ),
      ),
    ),
    check(
      "va-11",
      "Canvas selection halo (derived swatch)",
      "the selected mock node's halo is the accent at the shared token width; the selected swatch shows the gasket halo: a thin surface-colored gap, then the accent ring, so the ring is separated from the node fill by the canvas itself. Verify in HIGH CONTRAST against the black node, and in dark mode: the ring should be unmistakable in all three. The printed border-width still derives from deriveCytoscapeStyle (now outline-width).",
      (() => {
        const styles = deriveCytoscapeStyle(LIGHT_THEME) as Array<{
          selector: string;
          style: Record<string, unknown>;
        }>;
        const selected = styles.find((s) => s.selector === "node.g3t-selected");
        const width = Number(selected?.style["outline-width"] ?? 0);
        return h(
          "div",
          { className: "va-row" },
          h("span", {
            className: "va-node",
            "aria-hidden": true,
          }),
          h("span", {
            className: "va-node va-node-selected",
            style: {
              // Mirror the canvas gasket: gap (surface color) then ring.
              boxShadow:
                "0 0 0 var(--g3t-selection-gap-width, 2px) var(--g3t-bg-primary), " +
                `0 0 0 calc(var(--g3t-selection-gap-width, 2px) + ${width}px) var(--g3t-accent-primary)`,
            },
            "aria-hidden": true,
          }),
          h(
            "code",
            { className: "va-derived" },
            `deriveCytoscapeStyle \u2192 outline ${width}px + gap ${DESIGN_TOKENS.selectionGapWidth} (gasket halo)`,
          ),
        );
      })(),
    ),
    check(
      "va-20",
      "Encoding grammar: channel \u2190 driver via scale (LIVE)",
      "this check is interactive: the real components are mounted in the page. Pin a different color for Person (and reset it), clamp the size domain, open node.icon and remap Org: the preview nodes and the spec JSON update as you do, because both render through the shipped resolvers. Reserved rows (effects.accent, canvas.background) stay theme-delegated. Then drag the window narrower: the panes shrink instead of escaping the check's border.",
      h("div", { id: "va20-root" }, h(Va20Live)),
    ),
    check(
      "va-21",
      "Custom icon sets (sanitized, with pre-mappings)",
      "LIVE: 'Load brand icon set' registers three custom glyphs through the sanitizer and applies the set's pre-mappings (Person\u2192agent, Org\u2192building, Document\u2192doc): the preview's icons change in place; Unload restores the defaults and the spec. 'Try hostile set' runs a deliberately malicious set through the sanitizer: only the clean glyph registers (and is immediately unregistered); the report names each rejected glyph and the exact reason (onclick handler, <script>, foreignObject). Trusted mode exists for adopter-compiled sets only; end-user paths default to sanitize.",
      h("div", { id: "va21-root" }, h(Va21IconSets)),
    ),
    check(
      "va-22",
      "Spec drives the canvas (LIVE: the application milestone)",
      "the first live-canvas check in this harness. The panel, the REAL Cytoscape canvas, and the legend share one spec: pin Person to a new color and the canvas nodes recolor with the legend swatch; switch node.color's driver to pagerank and the canvas shifts to the viridis ramp with the legend showing it; clamp the size domain and node sizes follow; set edge.width fixed and drag the slider. Channels the spec does not claim keep their legacy style (edges stay gray until you map edge.color). CRITICALLY: node POSITIONS must not move during any of those edits: visual changes restyle only; layout reruns only when the graph itself changes. Selection still owns the accent: click a node; the gasket halo is untouched by any of it. NEW this round: node glyphs render ON the canvas (SVG data URIs from the registry: Org carries layers, Document carries copy), and node.shape is live as the paired-redundancy channel (Person ellipse, Org round-rectangle, Document auto-cycles to diamond; the legend's shape section mirrors it). In the panel, point node.shape's driver at label to see the unpaired-redundancy warning, then back to types to clear it. THEMES (round 20): flip the theme bar and the CANVAS follows: edge and label colors, the selection ring, all restyled in place with positions held. PRECEDENCE (round 14): 'Pin Helix gold' applies a per-instance override ABOVE the spec: Helix turns gold with a heavy border, STAYS gold while you recolor or re-drive the spec, and rejoins the spec on Clear. TIER 3: the spec JSON box follows your panel edits live; edit the JSON and Apply to drive everything the other direction; paste a mapping onto effects.accent to see the reserved-channel rejection by name.",
      h("div", { id: "va22-root" }, h(Va22CanvasLoop, { live: false })),
    ),
    check(
      "va-26",
      "Algorithm overlays + results as drivers (LIVE)",
      "the algorithm story over a fixture built for it: three DISCONNECTED satellite subsystems (Power: star around the PDU; Comms chain; GNC hub on the FlightComputer) plus an unintegrated SpareUnit. The arc: 1) Connected components: the canvas recolors IMMEDIATELY by subsystem (four components, SpareUnit alone in its own) and the legend names the partition: the runner's keys auto-wire into the spec's color channel (the host-side pattern from the wiring guide). 2) Degree centrality: node SIZE scales by connectivity at once: the PDU and FlightComputer read as the integration hotspots they are. 3) Shortest path: Battery to Bus threads the power star as an overlay (members emphasized, the rest dimmed); Battery to Antenna honestly reports no path: the subsystems really are disconnected. 4) The seeded EXTERNAL document is a narrative now: a Python service's critical-power-path analysis (graphblas bfs over the power chain): Apply document and the canvas becomes a triage view of Battery-PDU-Bus against everything else dimmed; toggle it together with the path overlay for union semantics. 5) Paste a bad version to see verbatim rejection. LAYOUT NOTE (round 24): this section is constant-height by construction: the control column scrolls internally and the canvas pane is clipped, so nothing here can change the page height while you review.",
      h("div", { id: "va26-root" }, h(Va26Algorithms, { live: false })),
    ),
    check(
      "va-25",
      "Workspace durability: capture / restore (LIVE)",
      "slice 1 of Tier-1 item 3: the whole working state as one versioned JSON document. EXERCISE: drag a few nodes somewhere deliberate, pin one (Pin all works too), recolor the spec in VA-22's panel style by editing here via the toolbar, switch the theme, then Capture workspace: the snapshot lists positions, pins, and theme. Now wreck everything: Shuffle the layout, unpin, change theme again. Restore: positions return EXACTLY (pinned nodes re-lock through the pin store), the spec re-applies, and the theme flips back. The snapshot textarea shows the document itself: this is what saved workspaces and investigation bookmarks will persist; storage is deliberately the host's choice. The reserved-channel guard rides along: a snapshot smuggling a mapping onto effects.accent is rejected by name on restore. Also NEW this round: SHUFFLE on the toolbar (re-runs force from randomized positions: the deliberate escape hatch when incremental convergence traps a layout; Re-run stays incremental), and node GLYPHS are fixed: explicit intrinsic size so they rasterize crisply, and glyph color now picks dark-vs-white by contrast ratio against each node's resolved fill (white glyphs vanished on okabe's light yellow and blue: check Document nodes and the panel preview agree).",
      h("div", { id: "va25-root" }, h(Va25Workspace, { live: false })),
    ),
    check(
      "va-27",
      "Structural rendering: ELK compartments + ports (LIVE, round 32)",
      "Group A: the structural view with rounds 32-34 review applied, and the dagre verdict's visual surface. THE LOOK: three \u00ABBlock\u00BB containers render UML-style as ROUNDED rectangles: header strip, italic divider rows, attribute/operation rows stacked ZERO-GAP at one shared width, the bottom row's corners matching the container; the border hugs the rows exactly. PORTS (round-35 fix): larger OPEN squares (border, no fill: the canvas for future direction glyphs) now sit COMPLETELY OUTSIDE the container, flush against its edge: they are top-level siblings, not children (a child cannot escape a compound parent\u2019s bounds, which is why rounds 33-34 kept them partly inside); drag a container and its ports follow; feeds/streams route port-to-port (now labeled optical/frames). A3 UML EDGE VOCABULARY (round 45): the edges carry relationship symbols: composes is a COMPOSITION (filled diamond at the FlightComputer whole-end), generalizes is a GENERALIZATION (hollow triangle at the parent end), and annotates from the note is a DEPENDENCY (dashed line, open arrow). Plain data-flow edges stay simple arrows. ROWS ARE REAL: click calibrationDate: the full accent ring shows on exactly that row; container, header, dividers, and ports do NOT select; rows never drag alone; the container drags as a unit. COLLAPSE (rounds 34-36): both toggle surfaces from the design are wired through the real toolkit store now. RIGHT-CLICK behavior is now compartment-aware (round 40): right-click the container HEADER for 'Collapse / expand compartments' (toggles all), or right-click a specific compartment (the attributes or operations divider/rows) for 'Collapse / expand this compartment' (toggles only that one); the 'Toggle ALL operations' button is the COMPONENT-CONFIG surface (a global default a host sets, e.g. a data-properties-only view). Either way the content rows vanish, a divider notes the hidden count, and the container SHRINKS: collapse is a layout-time input, not a style hide, so toggling re-lays-out (positions of other blocks may shift, by design: this is a structure change, not a restyle). Collapsing the compartment of a selected row clears that row from selection (the element is gone). THE DAGRE VERDICT: this is elk.layered: Sensor\u2192Lens\u2192FlightComputer should read as clean layers; press Re-layout DOWN and the DAG restacks vertically with ports following the flow (SOUTH/NORTH under DOWN). If this layering quality satisfies you, dagre stays unbundled permanently.",
      h("div", { id: "va27-root" }, h(Va27Structural, { live: false })),
    ),
    check(
      "va-28",
      "SHACL shape view through the compartment API (LIVE, round 37)",
      "Group A's EXIT CRITERION and the appropriate-reuse proof: the SHACL Shape view renders through the SAME compartment API the UML views use (shaclShapesToStructural -> the identical StructuralGraphInput -> layoutStructural -> the same canvas converter), with NO parallel rendering engine. THE LOOK: two \u00ABNodeShape\u00BB containers, PersonShape and Organization, each a header over a 'properties' compartment (SHACL sh:property shapes) whose rows are in the UML-attribute form 'path : xsd:type [min..max]', with a (+n) chip where value constraints (sh:pattern, sh:minInclusive, sh:in) exist; a LABELED reference edge runs Person -> Organization carrying the 'worksFor' property path (the sh:node on that property: the worksFor : IRI row and the edge are the same fact). CLOSED vs OPEN: PersonShape is sh:closed and takes a SOLID heavier border; Organization is open and DASHED. VALIDATION BADGES (per-row, the B3 payoff): press 'Load validation report' and the 'name' row turns violation-red and 'age' turns warning-amber, because rows are REAL elements so a report badges the exact failing constraint, not just the shape. Press again to clear. This is the same severity/overlay vocabulary the report tiers use, applied at row granularity. COVERAGE NOTE: shapes are hand-authored against the lightweight in-core model (datatype/cardinality/pattern/range/in + sh:closed); the broader SHACL spec (sh:class/sh:node as parsed structure, logical operators, path expressions, sh:severity/sh:order, targets) is documented follow-on work in roadmap/design/shacl-views.md and needs an RDF shapes parser first.",
      h("div", { id: "va28-root" }, h(Va28ShaclShapes, { live: false })),
    ),
    check(
      "va-29",
      "SHACL validation report over the data graph (LIVE, round 39)",
      "B1, the report half of the SHACL story, and a pure REUSE slice: a validation report renders over the DATA graph (the satellite fixture, already reviewed) with no new rendering engine, only the shipped overlay + encoding machinery. ComponentShape now exercises ALL THREE tiers (round 40): partNumber missing is a VIOLATION (red), a malformed serial trips sh:pattern as a WARNING (amber), and a missing reviewStatus carries sh:severity Info so it reads as INFO (blue). Press 'Load validation report': (1) SEVERITY TIERS AS OVERLAYS: failing nodes emphasize and conforming ones dim, with a toggle per tier (the same union/dim overlay semantics the algorithm story uses); (2) COUNT + SEVERITY AS DRIVERS: node color comes from _shacl_maxSeverity (red/amber/blue) and size from _shacl_resultCount through the ordinary encoding grammar, legend included (clustering-is-a-driver applied to conformance: NOT bespoke SHACL canvas code). Clear restores exactly, by construction. SCOPING FIX (round 40): the overlay store is a global singleton shared by every canvas on this page, so toggling a report tier here used to dim the OTHER live canvases (VA-26 especially) wholesale; the canvas now ignores overlays that reference none of its own elements, so each view is isolated. A single-canvas app was never affected. DOCTRINE: reports, not validation: conformance ran in the in-core validator here, but the toolkit consumes a versioned report document identical in spirit to the algorithm-result document, so a pyshacl or Jena report drops in via a host adapter. NOTE: color is driven by the encoding spec rather than dedicated per-tier overlay classes (a deliberate deviation from the design's phrasing, recorded in shacl-views.md: the driver path reuses the legend and restyle semantics and avoids forking overlay membership).",
      h("div", { id: "va29-root" }, h(Va29ShaclReport, { live: false })),
    ),
    check(
      "va-30",
      "Linked SHACL shape + data views (LIVE, round 44)",
      "B4, the acceptance bar that makes the shape view and the report a genuinely useful PAIR rather than two disconnected pictures, and the completion of R1.17. Three panels: a validation-result list (left), the SHAPE view (middle), and the DATA graph (right). Click any result in the list: it selects, ACROSS BOTH CANVASES AT ONCE, the focus node in the data graph AND the source shape's container plus the offending property-shape ROW in the shape view (a property-scoped result lands on the row; a node-level result stops at the container). This cross-link is pure selection-store reuse: resultSelectionIds() returns the element ids and the shared store highlights them in every canvas subscribed to it, NO new linking machinery. The shape view also carries the closed/open borders and per-row severity badges from VA-28/B3, so the selected row and its severity coincide. NOTE: the shared selection store linking BOTH canvases is the DESIRED behavior here (unlike the round-40 overlay isolation, which was about independent views); selection is intentionally global so the pair stays in lockstep.",
      h("div", { id: "va30-root" }, h(Va30LinkedShacl, { live: false })),
    ),
    check(
      "va-24",
      "Compound containers + per-node pinning (LIVE)",
      "Tier-1 milestone, slice 1. CONTAINERS: a SysML-flavored model (Surveyor System containing Navigation and Power blocks, each containing parts) renders containment as UML element containers: light-filled rounded rectangles with the \u00ABBlock\u00BB + name label pinned top; children lay out INSIDE their container (fcose is compound-aware), and cross-links (powers, feeds) route between members of different containers. Containment edges themselves do NOT render as edges. PER-NODE PINNING: right-click the IMU part, choose 'Pin / unpin position': an amber disc behind the node marks it pinned, visible on every theme (distinct from the selection gasket, which is an offset ring: select it to see both compose). Now Run layout: everything re-flows EXCEPT the pinned part. COMPOSITION: Pin all locks everything; releasing Pin all returns to exactly your hand-pinned set (the IMU stays pinned and marked). THEMES (round 20): the canvas itself now follows the theme: switch themes and the containers re-tint (surface + border), edges and labels recolor, and the selection ring takes each theme's highlight, all WITHOUT re-layout (restyle-in-place; node positions hold through the switch). The context menu here is deliberately minimal: the pin action under test plus a selection wiring check.",
      h("div", { id: "va24-root" }, h(Va24Containers, { live: false })),
    ),
    check(
      "va-23",
      "Graph toolbar: search, layouts, force controls (LIVE)",
      "REBUILT after round-15 review. One 26px row: search, layout select, an options popover with an explicit Run layout commit (drag repulsion or edge length: NOTHING re-runs until you press Run; the old live-commit fired a layout per slider tick), Re-run, Pin all, and zoom/fit. SEARCH: type Juno, press Enter: selected and centered. LAYOUTS: Force / Hierarchy / Circle / Grid / Concentric: every run deliberate. PIN ALL locks every position and DISABLES layout controls with an explanatory tooltip, never silently swallowing a click; per-node pinning is roadmapped. There is no animate toggle: the engine always runs; watching the motion follows your reduced-motion preference. THEME: the context menu sample below the canvas (and the real right-click menu) must follow all three themes. NEW this round: the toolbar gained EXPORT (JSON / Turtle / CSV of the selection or whole graph, plus a 2x PNG of the canvas), and the pin indicator is now a FILLED theme-accent badge with a canvas-colored halo, fixed-size on every element including containers. Right-click a node for the LIVE menu: a CURATED trio (Pin / unpin position, Select node, Center here): hosts register exactly the actions they want, per the wiring guide; the static sample remains the styling reference.",
      h("div", { id: "va23-root" }, h(Va23Toolbar, { live: false })),
    ),
    check(
      "va-18",
      "Panel chrome (one anatomy)",
      "the Detail Inspector and the SHACL Shape Browser share the same section-header grammar: weight, size, chevron, spacing, and hover accent all match; expanded content indents identically. All four panels (inspector, shape browser, annotations, visual encoding) should read as siblings of one product. NEW: SiteShape carries a small muted lock (sh:closed); PersonShape, open, carries none. The lock should read as metadata, not as an alarm.",
      h(
        "div",
        { className: "va-split" },
        h(
          "div",
          { className: "g3t-panel" },
          h(DetailInspector, {
            ugm: tableGraph(),
            selection: { type: "node", id: "n2" },
          }),
        ),
        h(
          "div",
          { className: "g3t-panel" },
          h(ShaclShapeBrowser, {
            shapes: [
              {
                id: "PersonShape",
                name: "PersonShape",
                targetClass: "Person",
                properties: [
                  { path: "label", minCount: 1 },
                  { path: "org", minCount: 0 },
                ],
              },
              {
                id: "SiteShape",
                name: "SiteShape",
                targetClass: "Site",
                closed: true,
                ignoredProperties: ["label", "name"],
                properties: [
                  { path: "lat", minCount: 1 },
                  { path: "lon", minCount: 1 },
                ],
              },
            ],
            validationResults: [
              {
                nodeId: "g3",
                shapeId: "SiteShape",
                shapeName: "SiteShape",
                targetClass: "Site",
                valid: false,
                violations: [
                  {
                    path: "lat",
                    message: "lat is required",
                    severity: "violation",
                  },
                ],
              },
              {
                nodeId: "n2",
                shapeId: "PersonShape",
                shapeName: "PersonShape",
                targetClass: "Person",
                valid: true,
                violations: [],
              },
            ],
          }),
        ),
        h(
          "div",
          { className: "g3t-panel" },
          h(AnnotationPanel, { elementId: "n2" }),
        ),
        h(
          "div",
          { className: "g3t-panel" },
          h(EncodingSpecPanel, {
            ugm: tableGraph(),
            spec: VA20_SPEC,
            onChange: () => {},
          }),
        ),
      ),
    ),
    check(
      "va-19",
      "Brand accent in one variable (customization layer 2)",
      "pick any color: every accent surface follows live, with no reload: buttons (hover too), badges, the table selection bar, the VA-11 halo ring, and the focus ring (Tab somewhere after picking). Reset restores the preset. This demonstrates the scoped token-override layer; the programmatic layer is createTheme(), which additionally warns when a chosen accent fails WCAG contrast against the background.",
      h(
        "div",
        { className: "va-row" },
        h(
          "label",
          { className: "va-motion-toggle", htmlFor: "va-accent" },
          "accent",
        ),
        h("input", {
          type: "color",
          id: "va-accent",
          defaultValue: "#0072b2",
          "aria-label": "Override accent color",
        }),
        h("button", { className: "g3t-btn", id: "va-accent-reset" }, "Reset"),
        h("button", { className: "g3t-btn" }, "Sample button"),
        h(
          "span",
          {
            className: "va-badge",
            style: { color: "var(--g3t-accent-primary)" },
          },
          h(Icon, { name: "pin", size: 12 }),
          " accent badge",
        ),
      ),
    ),
    check(
      "va-16",
      "Loading skeletons",
      "the shimmer is subtle (surface tones, not attention-grabbing); text lines read as a paragraph placeholder; the block reads as a pending panel. With OS reduce-motion the shimmer freezes to a static block.",
      h(
        "div",
        { className: "va-split" },
        h(Skeleton, { lines: 4 }),
        h(Skeleton, { variant: "block", height: 96 }),
      ),
    ),
    check(
      "va-17",
      "Tree density variants",
      "compact tightens vertical rhythm without the disclosure chevrons or type tags colliding; indentation still reads clearly.",
      h(
        "div",
        { className: "va-split" },
        h(
          "div",
          null,
          h("p", { className: "va-derived" }, "comfortable (default)"),
          h(TreeView, {
            ugm: containmentGraph(),
            rootId: "sys",
            initialDepth: 3,
          }),
        ),
        h(
          "div",
          null,
          h("p", { className: "va-derived" }, 'density="compact"'),
          h(TreeView, {
            ugm: containmentGraph(),
            rootId: "sys",
            initialDepth: 3,
            density: "compact",
          }),
        ),
      ),
    ),
    check(
      "va-12",
      "Type scale in rem (raised floor)",
      "every size is crisp; xs (now 11px-equivalent) is small but comfortably readable; nothing across the whole page looks broken by the px-to-rem conversion. Bonus: browser-zoom text-only scaling now works; try Ctrl+Plus.",
      h(
        "div",
        null,
        ...(
          [
            ["xs", DESIGN_TOKENS.fontSizeXs],
            ["sm", DESIGN_TOKENS.fontSizeSm],
            ["md", DESIGN_TOKENS.fontSizeMd],
            ["lg", DESIGN_TOKENS.fontSizeLg],
            ["xl", DESIGN_TOKENS.fontSizeXl],
          ] as const
        ).map(([name, size]) =>
          h(
            "div",
            { key: name, className: "va-type-row" },
            h("code", { className: "va-derived" }, `${name} (${size})`),
            h(
              "span",
              { style: { fontSize: size } },
              "Provenance-preserving projection of qualified edges",
            ),
          ),
        ),
      ),
    ),
    check(
      "va-13",
      "Button states",
      "hover any enabled button: surface shifts to the tertiary background; the active (pressed) class reads as engaged; the disabled button is visibly inert, ignores hover, and shows a not-allowed cursor.",
      h(
        "div",
        { className: "va-row" },
        h("button", { className: "g3t-btn" }, "Default"),
        h("button", { className: "g3t-btn g3t-btn-active" }, "Active"),
        h("button", { className: "g3t-btn", disabled: true }, "Disabled"),
      ),
    ),
    check(
      "va-14",
      "Table density variants",
      "compact visibly tightens row rhythm without clipping text or icons; the selection signature survives in both densities.",
      h(
        "div",
        { className: "va-split" },
        h(
          "div",
          { className: "va-scroll" },
          h("p", { className: "va-derived" }, "comfortable (default)"),
          h(TableView, { ugm: tableGraph(), pageSize: 10 }),
        ),
        h(
          "div",
          { className: "va-scroll" },
          h("p", { className: "va-derived" }, 'density="compact"'),
          h(TableView, {
            ugm: tableGraph(),
            pageSize: 10,
            density: "compact",
          }),
        ),
      ),
    ),
    check(
      "va-15",
      "Map selection signature",
      "the selected site (Bravo Depot) carries the accent halo while keeping its categorical marker color; unselected markers have no halo; labels stay legible in dark theme.",
      h("div", { className: "va-scroll" }, h(MapView, { ugm: geoGraph() })),
    ),
    check(
      "va-10",
      "Validation badges (shape-redundant)",
      "pass and fail differ by glyph as well as color; the failing badge carries its count; both recolor sensibly per theme.",
      h(
        "div",
        { className: "va-row" },
        h(
          "span",
          { className: "va-badge", style: { color: "var(--g3t-success)" } },
          h(Icon, { name: "check", size: 12 }),
          " all nodes pass",
        ),
        h(
          "span",
          { className: "va-badge", style: { color: "var(--g3t-error)" } },
          h(Icon, { name: "close", size: 12 }),
          " 4 failing",
        ),
      ),
    ),
  );
}

export const PAGE_CSS = `
:root { ${tokenVars()} }
:root, [data-theme="light"] { ${themeVars(LIGHT_THEME)} }
[data-theme="dark"] { ${themeVars(DARK_THEME)} }
[data-theme="high-contrast"] { ${themeVars(HIGH_CONTRAST_THEME)} }

${baseCss}

/* page chrome (not toolkit code) */
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  font-family: var(--g3t-font);
  font-size: 14px; line-height: 1.5;
  background: var(--g3t-bg-primary); color: var(--g3t-text-primary);
  transition: background var(--g3t-transition-base), color var(--g3t-transition-base);
}
main { max-width: 1320px; margin: 0 auto; }
/* Wide container serves the multi-pane checks; PROSE keeps a readable
   measure (long lines hurt the criteria text more than narrow panes
   hurt the panels: cap text, not the container). */
.va-pass, .va-header p, .va-derived { max-width: 78ch; }
.va-header h1 { font-size: 20px; margin: 0 0 4px; }
.va-header p { color: var(--g3t-text-secondary); max-width: 64ch; }
.va-sticky-bar { position: sticky; top: 0; z-index: var(--g3t-z-sticky, 100); background: var(--g3t-bg-primary); border-bottom: 1px solid var(--g3t-border); padding: 8px 0; margin-bottom: 12px; }
.va-sticky-bar [data-testid="g3t-theme-switcher"] { display: flex; gap: 8px; }
.va-check { border: 1px solid var(--g3t-border); border-radius: var(--g3t-radius-md); padding: 16px; margin: 20px 0; background: var(--g3t-bg-primary); }
.va-check header { display: flex; align-items: baseline; gap: 10px; }
.va-check h2 { font-size: 15px; margin: 0; }
.va-id { font-family: var(--g3t-font-mono); font-size: 11px; color: var(--g3t-accent-primary); border: 1px solid var(--g3t-accent-primary); border-radius: 999px; padding: 1px 8px; }
.va-pass { color: var(--g3t-text-secondary); font-size: 13px; margin: 6px 0 14px; }
/* Focus rings render OUTSIDE the element (width + offset = 4px), so
   containers must pad by at least that before clipping; the original
   overflow-x here occluded the input's ring (VA-8 finding). */
.va-body { padding: 6px 4px; }
.va-body .va-scroll { overflow-x: auto; }
.va-icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 10px; }
.va-icon-grid figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 2px; border: 1px solid var(--g3t-border); border-radius: var(--g3t-radius-sm); }
.va-icon-grid figcaption { font-family: var(--g3t-font-mono); font-size: 10px; color: var(--g3t-text-muted); }
.va-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.va-iconsize { display: inline-flex; align-items: center; gap: 6px; color: var(--g3t-text-secondary); font-size: 12px; }
.va-accent-text { color: var(--g3t-accent-primary); display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.va-loop { display: grid; grid-template-columns: minmax(240px, 0.9fr) minmax(0, 1.4fr) minmax(150px, 0.55fr); gap: 12px; align-items: start; }
@media (max-width: 860px) { .va-loop { grid-template-columns: minmax(0, 1fr); } }
.va-loop > * { min-width: 0; }
.va-canvas-host { height: 360px; overflow: hidden; }
/* Round-26 finding 3: the width cap moved UP a level. Capping the
   canvas host (round 25) left whitespace inside its panel that the
   graph could not use; capping the PANEL keeps the canvas filling
   its container edge-to-edge while still bounding overall width. */
.g3t-panel:has(> .va-canvas-host),
.g3t-panel:has(> .va-canvas-host + *),
.va26-right { max-width: 762px; }
/* VA-26 growth fix (round 24): the section is constant-height BY
   CONSTRUCTION. The left column scrolls internally (overlay rows,
   status lines, and the resizable textarea can no longer change
   section height); the right panel is capped and clipped, so no
   browser layout feedback (resize-observer or otherwise) can grow
   the page. Review ergonomics first: the page must hold still. */
.va26-left { max-height: 460px; overflow-y: auto; min-width: 0; }
.va26-right { height: 400px; overflow: hidden; min-width: 0; }
.va-loop-canvas { padding: 4px; }
.va-live { display: grid; grid-template-columns: minmax(280px, 1.2fr) minmax(0, 1fr); gap: 14px; align-items: start; }
@media (max-width: 720px) { .va-live { grid-template-columns: minmax(0, 1fr); } }
/* Grid/flex children default to min-width:auto and refuse to shrink
   below content width: that is how the round-7 panes escaped their
   container. Every layout child here opts into shrinking. */
.va-live > *, .va-split > *, .va-body > * { min-width: 0; }
.g3t-enc-row { flex-wrap: wrap; }
.g3t-enc-row .g3t-select { min-width: 0; max-width: 160px; }
.va-reasons { font-size: var(--g3t-font-xs, 0.6875rem); color: var(--g3t-text-secondary); margin: 4px 0 0; padding-left: 18px; }
.va-reasons code { color: var(--g3t-error); }
.va-spec { font-size: 9px; line-height: 1.35; color: var(--g3t-text-muted); max-height: 220px; overflow: auto; border-top: 1px dashed var(--g3t-border); margin-top: 8px; padding-top: 6px; }
.va-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.va-split > div { border: 1px dashed var(--g3t-border); border-radius: var(--g3t-radius-sm); }
.va-ramp-row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.va-ramp-label { width: 160px; font-size: 12px; color: var(--g3t-text-secondary); font-family: var(--g3t-font-mono); }
.va-ramp { display: flex; flex: 1; height: 28px; border-radius: var(--g3t-radius-sm); overflow: hidden; border: 1px solid var(--g3t-border); }
.va-ramp span { flex: 1; }
.va-node { display: inline-block; width: 30px; height: 30px; border-radius: 50%; background: var(--g3t-type-0); border: 2px solid var(--g3t-node-stroke, #94a3b8); }
.va-node-selected { /* gasket via box-shadow set inline from derived width */ }
.va-derived { font-family: var(--g3t-font-mono); font-size: 11px; color: var(--g3t-text-secondary); }
.va-type-row { display: flex; align-items: baseline; gap: 16px; margin: 6px 0; }
.va-type-row code { width: 110px; }
.va-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; }
.va-pulse { width: 22px; height: 22px; border-radius: 50%; background: var(--g3t-accent-primary); animation: va-pulse calc(var(--g3t-transition-slow, 300ms) * 4) ease-in-out infinite; }
@keyframes va-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.55); opacity: 0.35; } }
.va-motion-toggle { font-size: 12px; color: var(--g3t-text-secondary); display: inline-flex; align-items: center; gap: 6px; }
@media (prefers-reduced-motion: reduce) { :root { --g3t-transition-fast: 0ms; --g3t-transition-base: 0ms; --g3t-transition-slow: 0ms; } .va-pulse { animation: none; } }
[data-reduce-motion="true"] { --g3t-transition-fast: 0ms; --g3t-transition-base: 0ms; --g3t-transition-slow: 0ms; }
[data-reduce-motion="true"] .va-pulse { animation: none; }
table { border-collapse: collapse; }
`;

export const PAGE_JS = `
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-theme-option]");
  if (btn) document.documentElement.dataset.theme = btn.dataset.themeOption;
});
const vaAccent = document.getElementById("va-accent");
const setAccent = (v) => {
  const r = document.documentElement.style;
  r.setProperty("--g3t-accent-primary", v);
  r.setProperty("--g3t-accent-hover", v);
  r.setProperty("--g3t-accent-color-controls", v);
};
vaAccent.addEventListener("input", (e) => setAccent(e.target.value));
document.getElementById("va-accent-reset").addEventListener("click", () => {
  ["--g3t-accent-primary", "--g3t-accent-hover", "--g3t-accent-color-controls"].forEach(
    (k) => document.documentElement.style.removeProperty(k),
  );
  vaAccent.value = "#0072b2";
});
document.getElementById("va-reduce").addEventListener("change", (e) => {
  document.documentElement.dataset.reduceMotion = e.target.checked ? "true" : "false";
});
`;

export function wrapDocument(bodyHtml: string): string {
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>g3-toolkit visual acceptance: design pass 2</title>
<style>${PAGE_CSS}</style>
</head>
<body>
${bodyHtml}
<script>${PAGE_JS}</script>
</body>
</html>
`;
}
