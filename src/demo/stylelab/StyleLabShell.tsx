/**
 * Style Lab (engineering conformance surface, not a domain demo):
 * the ruled side-by-side for the style engine's surface cutover
 * (implementation plan WS-C adoption path). The ontology shell was
 * judged too narrow a styling representation, so this shell exists to
 * exercise EVERY engine layer against the legacy Cytoscape-stylesheet
 * path on one shared fixture intent.
 *
 * Left pane: the fixture styled by the legacy [field]-scoped
 * stylesheet. Right pane: the SAME fixture styled by the StyleEngine
 * (theme tokens, rules, classes, states) projected onto per-element
 * Cytoscape bypasses. Beneath: a LIVE parity table computed from the
 * two instances' cytoscape-COMPUTED styles (the same oracle the
 * headless test pins), the engine-only zone report (attributes the
 * bypass cannot express: halo, glyphs, taper: rendered when the F1
 * SVG adapter lands), and a LOD schedule probe (resolveLod on the
 * default schedule for a simulated context; display-only, honestly
 * labeled).
 *
 * Rendered-behavior claims for this surface are unverified until
 * MR-7 (planning/g3l/manual-review-log.md).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Core } from "cytoscape";
import {
  applyLod,
  DEFAULT_LOD_SCHEDULE,
  resolveLod,
  StyleEngine,
  type VisualAttributes,
} from "@g3t/core";
import {
  applyVisualAttributes,
  CanvasAdapter,
  CytoscapeCanvas,
  SvgAdapter,
} from "@g3t/react";
import type { SvgSceneEdge, SvgSceneNode } from "@g3t/react";
import type { CyStylesheet } from "@g3t/react";
import {
  buildStyleLabUgm,
  MUTED_IDS,
  PARITY_KEYS,
  SELECTED_ID,
  styleElementsFromCy,
  styleLabEngineConfig,
  styleLabLegacyStylesheet,
} from "./style-lab-fixture";
import { publishCanvas } from "../testing/e2e-hooks";

interface ParityRow {
  element: string;
  key: string;
  legacy: string;
  engine: string;
}

interface HonestyRow {
  element: string;
  unsupported: string;
}

const LOD_CONTEXTS = [
  { label: "Close-up (zoom 1.0, 40 visible)", zoom: 1.0, visibleElements: 40 },
  { label: "Mid (zoom 0.5, 400 visible)", zoom: 0.5, visibleElements: 400 },
  { label: "Far (zoom 0.3, 1,500 visible)", zoom: 0.3, visibleElements: 1500 },
  {
    label: "Hairball (zoom 0.1, 6,000 visible)",
    zoom: 0.1,
    visibleElements: 6000,
  },
] as const;

export function StyleLabShell({
  onBack,
}: {
  onBack?: () => void;
} = {}): React.JSX.Element {
  const ugm = useMemo(() => buildStyleLabUgm(), []);
  const legacyStylesheet = useMemo(
    () => styleLabLegacyStylesheet() as CyStylesheet[],
    [],
  );
  const [legacyCy, setLegacyCy] = useState<Core | null>(null);
  const [engineCy, setEngineCy] = useState<Core | null>(null);
  const baseResolvedRef = useRef<Map<string, VisualAttributes> | null>(null);
  const engineKindsRef = useRef<Map<string, "node" | "edge">>(new Map());
  const [honesty, setHonesty] = useState<HonestyRow[]>([]);
  const [lodIndex, setLodIndex] = useState(0);
  // F1 pane scene: positions HARVESTED from the engine cy at mount
  // (same grid layout, so the three panes are geometrically
  // comparable) and the tiered attribute map in state so the LOD
  // dropdown drives the SVG adapter exactly as it drives the engine
  // pane's bypasses.
  const [f1Scene, setF1Scene] = useState<{
    nodes: SvgSceneNode[];
    edges: SvgSceneEdge[];
  } | null>(null);
  // F2: the third pane can render through either headless adapter;
  // both consume the identical scene + attributes (ARC-008).
  const [f1Renderer, setF1Renderer] = useState<"svg" | "canvas">("svg");
  const [f1Resolved, setF1Resolved] = useState<Map<
    string,
    VisualAttributes
  > | null>(null);
  const labelTextRef = useRef<Map<string, string>>(new Map());
  const withLabelText = useCallback(
    (m: Map<string, VisualAttributes>): Map<string, VisualAttributes> => {
      const out = new Map(m);
      for (const [id, text] of labelTextRef.current) {
        const a = out.get(id) ?? {};
        const merged = { ...a };
        if (merged.labelText === undefined) merged.labelText = text;
        // MR-11 (owner): the pane inherits the app's DARK shell like
        // the cy panes; default label ink must be readable on it.
        if (merged.labelColor === undefined) merged.labelColor = "#e2e8f0";
        // MR-11 re-look (owner: "text a little harder to read"):
        // the cy panes outline labels via text-outline; the
        // adapters only halo when labelHalo is set. Default it.
        if (merged.labelHalo === undefined) {
          merged.labelHalo = { color: "#0b1120", width: 2.5 };
        }
        out.set(id, merged);
      }
      return out;
    },
    [],
  );

  const onLegacyReady = useCallback((cy: Core) => {
    for (const id of MUTED_IDS) cy.$id(id).addClass("lab-muted");
    cy.$id(SELECTED_ID).select();
    publishCanvas("style-lab-legacy")?.(cy);
    setLegacyCy(cy);
  }, []);

  const onEngineReady = useCallback((cy: Core) => {
    for (const id of MUTED_IDS) cy.$id(id).addClass("lab-muted");
    cy.$id(SELECTED_ID).select();
    const engine = new StyleEngine(styleLabEngineConfig());
    const elements = styleElementsFromCy(cy).map((el) => ({
      ...el,
      classes: cy.$id(el.id).hasClass("lab-muted") ? ["lab-muted"] : [],
      states: el.id === SELECTED_ID ? ["selected"] : [],
    }));
    const resolved = engine.load({ elements });
    baseResolvedRef.current = resolved;
    engineKindsRef.current = new Map(
      elements.map((el) => [el.id, el.kind] as const),
    );
    const report = applyVisualAttributes(cy, resolved);
    publishCanvas("style-lab-engine")?.(cy);
    setHonesty(
      [...report.entries()]
        .filter(([, r]) => r.unsupported.length > 0)
        .map(([element, r]) => ({
          element,
          unsupported: r.unsupported.join(", "),
        })),
    );
    // Label TEXT rides element data in the cy panes (label:
    // data(label) in the base stylesheet); the engine's resolved
    // attributes carry label STYLING channels but not text. The F1
    // adapter renders attributes only, so the shell harvests the
    // data-derived text here and merges it into the attribute maps
    // (the same division of labor cytoscape's data mapping does).
    labelTextRef.current = new Map(
      cy
        .nodes()
        .map((n) => [n.id(), String(n.data("label") ?? n.id())] as const),
    );
    setF1Scene({
      nodes: cy.nodes().map((n) => {
        const p = n.position();
        return {
          id: n.id(),
          x: p.x,
          y: p.y,
          width: n.width(),
          height: n.height(),
        };
      }),
      edges: cy.edges().map((e) => ({
        id: e.id(),
        source: e.source().id(),
        target: e.target().id(),
      })),
    });
    setF1Resolved(withLabelText(resolved));
    setEngineCy(cy);
  }, []);

  // The live parity table: same oracle as the headless test, computed
  // once both instances are mounted (a mount-time comparison, not a
  // per-frame one).
  const parity = useMemo((): { rows: ParityRow[]; checks: number } | null => {
    if (!legacyCy || !engineCy) return null;
    const rows: ParityRow[] = [];
    let checks = 0;
    legacyCy.elements().forEach((ele) => {
      const keys = ele.isNode() ? PARITY_KEYS.node : PARITY_KEYS.edge;
      const other = engineCy.$id(ele.id());
      if (other.length === 0) return;
      for (const key of keys) {
        checks++;
        const legacy = String(ele.style(key));
        const engine = String(other.style(key));
        if (legacy !== engine) {
          rows.push({ element: ele.id(), key, legacy, engine });
        }
      }
    });
    return { rows, checks };
  }, [legacyCy, engineCy]);

  const lodContext = LOD_CONTEXTS[lodIndex] ?? LOD_CONTEXTS[0];
  const lod = resolveLod(DEFAULT_LOD_SCHEDULE, {
    zoom: lodContext.zoom,
    visibleElements: lodContext.visibleElements,
  });

  // The probe APPLIES to the engine pane (MR-7 finding: a dropdown
  // that only changed a text line read as doing nothing). resolveLod
  // runs once per context; applyLod is a per-element combinator over
  // the STORED base attributes (never re-resolving the rules); the
  // projection re-applies the bypasses. The legacy pane has no LOD
  // concept: an honest capability delta, labeled in the section copy.
  useEffect(() => {
    const cy = engineCy;
    const base = baseResolvedRef.current;
    if (!cy || !base) return;
    const tiered = new Map<string, VisualAttributes>();
    for (const [id, attrs] of base) {
      const kind = engineKindsRef.current.get(id) ?? "node";
      tiered.set(id, applyLod(attrs, lod, kind));
    }
    // resetFirst: a DOWN-tier transition removes channels (the tier
    // no longer sets text-opacity/opacity); without the reset those
    // stale bypasses persist and labels never come back (caught by
    // the shell test's restore assertion before it ever reached a
    // browser).
    applyVisualAttributes(cy, tiered, { resetFirst: true });
    setF1Resolved(withLabelText(tiered));
    // lod.tier is the schedule output; lod object identity churns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineCy, lod.tier]);
  const hiddenFeatures = Object.entries(lod.features)
    .filter(([, on]) => !on)
    .map(([name]) => name);

  return (
    <div
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <header>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            data-testid="style-lab-back"
            style={{ marginBottom: 8 }}
          >
            {"\u2190"} All demos
          </button>
        )}
        <h2 style={{ margin: 0 }}>Style Lab</h2>
        <p style={{ maxWidth: 720 }}>
          Engineering conformance surface for the style engine: the same fixture
          intent rendered through the legacy stylesheet path (left) and the
          engine-plus-bypass path (right), with the parity computed live from
          cytoscape&apos;s own resolved styles.
        </p>
      </header>

      <div style={{ display: "flex", gap: 16 }}>
        <section style={{ flex: 1 }} aria-label="Legacy stylesheet pane">
          <h3>Legacy stylesheet</h3>
          {/* Fixed-height wrapper (MR-7 finding: an unbounded canvas
              container feeds the resize observer a growing box every
              frame; the page scrolled forever). The canvas fills a
              bounded box; only the box is styled here. */}
          <div
            style={{ height: 420, position: "relative", overflow: "hidden" }}
          >
            <CytoscapeCanvas
              ugm={ugm}
              stylesheet={legacyStylesheet}
              layout="grid"
              onReady={onLegacyReady}
              animate={false}
            />
          </div>
        </section>
        <section style={{ flex: 1 }} aria-label="Style engine pane">
          <h3>Style engine (bypass projection)</h3>
          <div
            style={{ height: 420, position: "relative", overflow: "hidden" }}
          >
            {/* layout="grid" on BOTH panes (MR-7 finding: default
                force layouts are stochastic, so the panes disagreed
                on positions; grid is deterministic for identical
                element order, making the panes geometrically
                identical). */}
            <CytoscapeCanvas
              ugm={ugm}
              layout="grid"
              onReady={onEngineReady}
              animate={false}
            />
          </div>
        </section>
        <section style={{ flex: 1 }} aria-label="SVG adapter pane">
          <h3>SVG adapter (F1)</h3>
          {/* Same positions (harvested from the engine cy), same
              resolved-and-tiered attributes: what the bypass
              projection reports as unsupported (halo, glyphs, donut,
              pulse, taper, gradient) renders NATIVELY here. The LOD
              dropdown drives this pane through the same tiered map
              as the engine pane. */}
          <div style={{ marginBottom: 6 }}>
            <label htmlFor="f1-renderer" style={{ marginRight: 6 }}>
              Adapter
            </label>
            <select
              id="f1-renderer"
              data-testid="style-lab-f1-renderer"
              value={f1Renderer}
              onChange={(e) =>
                setF1Renderer(e.target.value as "svg" | "canvas")
              }
            >
              <option value="svg">SVG (F1)</option>
              <option value="canvas">Canvas 2D (F2)</option>
            </select>
            {f1Renderer === "canvas" && (
              <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
                pulse renders static in Canvas stage 1 (declared capability)
              </span>
            )}
          </div>
          <div
            style={{ height: 420, position: "relative", overflow: "hidden" }}
          >
            {f1Scene && f1Resolved && f1Renderer === "canvas" ? (
              <CanvasAdapter
                nodes={f1Scene.nodes}
                edges={f1Scene.edges}
                resolved={f1Resolved}
                width={640}
                height={420}
                data-testid="style-lab-f2-canvas"
              />
            ) : f1Scene && f1Resolved ? (
              <SvgAdapter
                nodes={f1Scene.nodes}
                edges={f1Scene.edges}
                resolved={f1Resolved}
                width={640}
                height={420}
                data-testid="style-lab-f1-svg"
              />
            ) : (
              <p>Waiting for the engine pane…</p>
            )}
          </div>
        </section>
      </div>

      <section aria-label="Parity" data-testid="style-lab-parity">
        <h3>Parity</h3>
        {parity === null ? (
          <p>Comparing…</p>
        ) : parity.rows.length === 0 ? (
          <p data-testid="style-lab-parity-summary">
            0 mismatches across {parity.checks} checks.
          </p>
        ) : (
          <>
            <p data-testid="style-lab-parity-summary">
              {parity.rows.length} mismatches across {parity.checks} checks.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Element</th>
                  <th>Key</th>
                  <th>Legacy</th>
                  <th>Engine</th>
                </tr>
              </thead>
              <tbody>
                {parity.rows.map((r) => (
                  <tr key={`${r.element}-${r.key}`}>
                    <td>{r.element}</td>
                    <td>{r.key}</td>
                    <td>{r.legacy}</td>
                    <td>{r.engine}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section
        aria-label="Engine-only zone"
        data-testid="style-lab-engine-only"
      >
        <h3>Engine-only zone</h3>
        <p>
          Attributes the Cytoscape bypass cannot express, resolved by the engine
          and reported honestly instead of dropped; these render when the SVG
          adapter (F1) lands.
        </p>
        <ul>
          {honesty.map((h) => (
            <li key={h.element}>
              <code>{h.element}</code>: {h.unsupported}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="LOD probe" data-testid="style-lab-lod">
        <h3>LOD schedule probe (drives the engine pane)</h3>
        <p>
          The selected context re-applies the engine pane&apos;s attributes
          through the LOD combinator; the legacy pane has no LOD concept, so at
          far tiers the panes intentionally diverge (labels and decorations drop
          on the right only).
        </p>
        <label>
          Simulated context:{" "}
          <select
            data-testid="style-lab-lod-select"
            value={lodIndex}
            onChange={(e) => setLodIndex(Number(e.target.value))}
          >
            {LOD_CONTEXTS.map((c, i) => (
              <option key={c.label} value={i}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <p data-testid="style-lab-lod-result">
          Tier {lod.tier}
          {hiddenFeatures.length > 0
            ? `; hidden: ${hiddenFeatures.join(", ")}`
            : "; full detail"}
        </p>
      </section>
    </div>
  );
}
