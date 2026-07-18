/**
 * Scale surface (plan P2.1; implements the demo path over Approach 1
 * of planning/large-graph-design.md).
 *
 * A seeded planted-partition graph of 8,000 nodes is generated
 * in-browser, collapsed by collapseByCluster (Louvain with a seeded
 * rng, so every visitor sees the same clustering), and rendered as
 * supernodes sized by member count. Clicking a cluster in the rail
 * (or selecting its supernode on the canvas) drills into the induced
 * member subgraph via buildSubgraph, working-set capped. The header
 * reports the real measured generate and collapse times, because the
 * first question about any graph library is whether it survives
 * contact with a big graph; the numbers on screen are the answer, not
 * copy.
 *
 * Pure stages (generation, collapse, drill) are budget-tested in
 * @g3t/core (collapse-by-cluster.test.ts); this surface's contract
 * tests pin the wiring with the canvas stubbed. Rendering performance
 * at this scale remains browser-verified.
 */
import { useEffect, useMemo, useState } from "react";
import {
  createDefaultMenuManager,
  CytoscapeCanvas,
  GraphToolbar,
  useSelectionStore,
  type EncodingSpec,
} from "@g3t/react";
import type { Core } from "cytoscape";
import { collapseByCluster, buildSubgraph, UGM } from "@g3t/core";
import { SurfaceFrame } from "../surfaces/DashboardSurfaces";
import { CapabilityBubble } from "../components/CapabilityCallout";
import { usePrefersReducedMotion } from "../components/usePrefersReducedMotion";
import { generateScaleGraph, SCALE_SEED } from "./generate";

/** Color driver switches between the type channel (uniform in the
 *  clusters view: every supernode is a Cluster) and the dominant
 *  member type stamped by collapseByCluster (review 5.14: an encoding
 *  change AT scale; spec changes restyle in place, no re-layout). */
function makeSpec(colorDriver: "types" | "dominantType"): EncodingSpec {
  return {
    version: 1,
    node: {
      color: {
        driver: colorDriver,
        scale: { kind: "categorical", palette: "okabe-ito" },
      },
      size: {
        driver: "memberCount",
        scale: { kind: "sequential", domain: "auto", range: [14, 56] },
      },
    },
    edge: {},
  };
}

/** Deterministic RNG (mulberry32), shared with the generator module. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Model {
  full: UGM;
  clustered: UGM;
  members: Map<string, string[]>;
  genMs: number;
  collapseMs: number;
  edgeCount: number;
}

function buildModel(): Model {
  const t0 = performance.now();
  const full = generateScaleGraph();
  const genMs = performance.now() - t0;
  const seen = new Set<string>();
  full.forEachNode((id) => {
    for (const e of full.getNodeEdges(id)) seen.add(e);
  });
  const edgeCount = seen.size;
  const t1 = performance.now();
  const { ugm: clustered, members } = collapseByCluster(full, {
    threshold: 2000,
    rng: mulberry32(SCALE_SEED),
  });
  const collapseMs = performance.now() - t1;
  return { full, clustered, members, genMs, collapseMs, edgeCount };
}

type View = { kind: "clusters" } | { kind: "drill"; superId: string };

// 12.4 instrumentation: three lag suspects were eliminated by code
// audit (Louvain memoized once; super-edges aggregate; instances
// destroy per switch), so the remaining initiation lag needs a
// measurement, not another theory. Every view switch logs
// click -> canvas-ready to the console; Zach's next pass reports
// the numbers per direction.
let switchStart = 0;
function markSwitch(label: string) {
  switchStart = performance.now();
  console.info(`[scale] switch -> ${label}`);
}
function markReady(label: string) {
  if (switchStart > 0) {
    console.info(
      `[scale] ${label} ready in ${(performance.now() - switchStart).toFixed(0)}ms`,
    );
    switchStart = 0;
  }
}

export function ScaleSurface({ onBack }: { onBack: () => void }) {
  const model = useMemo(() => buildModel(), []);
  const reducedMotion = usePrefersReducedMotion();
  // Live instance for the GraphToolbar (review 4.1; also the 5.14
  // preview: layout switching and search AT scale, against whatever
  // view is mounted, supernodes or a drilled cluster).
  const [core, setCore] = useState<Core | null>(null);
  const [view, setViewRaw] = useState<View>({ kind: "clusters" });
  const setView = (v: View) => {
    markSwitch(v.kind === "clusters" ? "clusters" : `drill:${v.superId}`);
    setViewRaw(v);
  };
  // Review 5.14: recolor the 40 supernodes by dominant member type
  // with one spec swap. Only meaningful in the clusters view (member
  // nodes carry no dominantType), so drill always colors by type.
  const [colorByDominant, setColorByDominant] = useState(false);
  // 12.5: cluster-link labels are visual clutter at 40 supernodes;
  // OFF by default, a chip re-enables.
  const [edgeLabels, setEdgeLabels] = useState(false);
  const spec = useMemo(
    () =>
      makeSpec(
        colorByDominant && view.kind === "clusters" ? "dominantType" : "types",
      ),
    [colorByDominant, view.kind],
  );
  // Review 5.11: the built-in fcose numbers cram both views. The
  // clusters view holds a few dozen 14-56px supernodes (long ideal
  // edges, strong repulsion); a drilled community holds up to the
  // working-set cap of 30px nodes (tighter but still padded). The
  // padding also addresses the odd fit: supernodes no longer touch
  // the viewport edges. Numbers are browser-verify items; the
  // passthrough mechanism is the tested part.
  // 9.8 experiment: fcose's animate:true renders EVERY layout tick;
  // drill and return both re-init and re-run layout, so per-tick
  // rendering presents as selection lag (console was clean, killing
  // the warning-flood theory). "end" animates once to final
  // positions; reduced-motion still suppresses via the canvas's
  // animate=false, which layoutOptions must not override, hence the
  // conditional spread.
  const layoutOptions = useMemo<Record<string, unknown>>(
    () => ({
      ...(view.kind === "clusters"
        ? // 12.5: Zach's ruling from the pass.
          { idealEdgeLength: 300, nodeRepulsion: 50000, padding: 60 }
        : { idealEdgeLength: 55, nodeRepulsion: 15000, padding: 50 }),
      ...(reducedMotion ? {} : { animate: "end" }),
    }),
    [view.kind, reducedMotion],
  );

  // Context menu: the base copy item plus an app-registered
  // "Drill into cluster" on supernodes (the wiring-guide custom-action
  // recipe, live). No Inspect: this surface has no property panel, and
  // the base contract omits unwired items rather than rendering them
  // dead.
  const menuManager = useMemo(() => {
    const manager = createDefaultMenuManager();
    manager.register("scale-demo", [
      {
        id: "drill-into-cluster",
        label: "Drill into cluster",
        icon: "\u2b22",
        filter: (t) => t.id !== undefined && model.members.has(t.id),
        action: (t) => {
          if (t.id !== undefined) setView({ kind: "drill", superId: t.id });
        },
      },
    ]);
    return manager;
  }, [model]);

  const drill = useMemo(() => {
    if (view.kind !== "drill") return null;
    const ids = model.members.get(view.superId) ?? [];
    return { superId: view.superId, ...buildSubgraph(model.full, ids) };
  }, [view, model]);

  const canvasUgm = drill ? drill.ugm : model.clustered;

  // Selecting a supernode on the canvas drills in, same as the rail.
  // A store change is an EVENT: react to it inside the subscription
  // callback, not synchronously in an effect body (the shells'
  // setState-in-effect lesson). Member ids never collide with
  // supernode ids, so no view gating is needed.
  useEffect(() => {
    return useSelectionStore.subscribe((state) => {
      const first = [...state.selectedNodeIds][0];
      if (first !== undefined && model.members.has(first)) {
        setView({ kind: "drill", superId: first });
        useSelectionStore.getState().selectNodes([]);
      }
    });
  }, [model]);

  const totalNodes = model.full.getNodeIds().length;
  const supernodes = [...model.members.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );

  return (
    <SurfaceFrame
      title="Scale"
      subtitle={`${totalNodes.toLocaleString()} nodes clustered to ${supernodes.length} supernodes`}
      accent="#7ee081"
      onBack={onBack}
    >
      <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
        <aside
          style={{
            flex: "0 0 280px",
            overflow: "auto",
            padding: "8px 0",
            borderRight: "1px solid rgba(127,127,127,0.3)",
          }}
        >
          <div style={{ padding: "0 12px", fontSize: 12, opacity: 0.75 }}>
            <div data-testid="scale-status">
              {view.kind === "clusters"
                ? `${totalNodes.toLocaleString()} nodes / ${model.edgeCount.toLocaleString()} edges in the UGM; rendering ${supernodes.length} supernodes. Generated in ${Math.round(model.genMs)} ms, clustered in ${Math.round(model.collapseMs)} ms (measured live).`
                : `Showing ${drill?.ugm.getNodeIds().length.toLocaleString()} of ${totalNodes.toLocaleString()} nodes (${labelFor(model, drill?.superId)}).${drill?.truncated ? " Working set capped; the cluster has more members." : ""}`}
            </div>
            {view.kind === "drill" && (
              <button
                type="button"
                onClick={() => setView({ kind: "clusters" })}
                style={{
                  font: "inherit",
                  fontSize: 12,
                  marginTop: 8,
                  padding: "3px 10px",
                  border: "1px solid #7ee081",
                  borderRadius: 4,
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                {"\u2190"} Back to clusters
              </button>
            )}
          </div>
          <div
            style={{ padding: "8px 12px 0", fontSize: 11, opacity: 0.65 }}
            data-testid="scale-cluster-explainer"
          >
            Clusters are Louvain communities detected in-browser; each is named
            by its dominant member type and its most-connected member.
          </div>
          {view.kind === "clusters" && (
            <div style={{ padding: "6px 12px 0" }}>
              <button
                type="button"
                data-testid="scale-color-toggle"
                onClick={() => setColorByDominant((v) => !v)}
                style={{
                  font: "inherit",
                  fontSize: 11,
                  padding: "3px 10px",
                  border: "1px solid #7ee081",
                  borderRadius: 4,
                  background: colorByDominant
                    ? "rgba(126,224,129,0.18)"
                    : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                {colorByDominant
                  ? "Color: dominant member type"
                  : "Color by dominant member type"}
              </button>
              <div style={{ fontSize: 10, opacity: 0.55, marginTop: 3 }}>
                Recolors every supernode in place; no re-layout.
              </div>
              <button
                type="button"
                data-testid="scale-edge-labels"
                onClick={() => setEdgeLabels((v) => !v)}
                style={{
                  font: "inherit",
                  fontSize: 11,
                  marginTop: 6,
                  padding: "3px 10px",
                  border: "1px solid #7ee081",
                  borderRadius: 4,
                  background: edgeLabels
                    ? "rgba(126,224,129,0.18)"
                    : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                {edgeLabels ? "Hide edge labels" : "Show edge labels"}
              </button>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            {supernodes.map(([superId, ids]) => (
              <button
                key={superId}
                type="button"
                onClick={() => setView({ kind: "drill", superId })}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  font: "inherit",
                  fontSize: 12,
                  padding: "4px 12px",
                  border: "none",
                  background:
                    view.kind === "drill" && view.superId === superId
                      ? "rgba(126,224,129,0.18)"
                      : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                {labelFor(model, superId)}{" "}
                <span style={{ opacity: 0.6 }}>({ids.length})</span>
              </button>
            ))}
          </div>
          <CapabilityBubble
            accent="#7ee081"
            items={[
              {
                mechanism: "collapseByCluster",
                anchor: "scaling-collapse-large-graphs-to-clusters",
                how: "Louvain communities become supernodes; the renderer sees dozens of nodes while the UGM holds thousands.",
              },
              {
                mechanism: "buildSubgraph",
                anchor: "scaling-collapse-large-graphs-to-clusters",
                how: "drill-in returns the induced member subgraph, working-set capped so a huge cluster cannot overwhelm the canvas.",
              },
              {
                mechanism: "menuManager.register",
                anchor: "add-your-action-to-the-canvas-context-menu",
                how: "right-click a supernode: the base copy item plus an app-registered Drill into cluster action.",
              },
              {
                mechanism: "encodingSpec",
                anchor: "drive-the-encoding-from-app-state",
                how: "supernode size rides the memberCount property through the sequential size channel.",
              },
            ]}
          />
        </aside>
        <main style={{ flex: "1 1 auto", position: "relative", minWidth: 0 }}>
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              right: 6,
              zIndex: 5,
            }}
          >
            <GraphToolbar ugm={canvasUgm} cy={core} />
          </div>
          <CytoscapeCanvas
            ugm={canvasUgm}
            encodingSpec={spec}
            stylesheet={
              edgeLabels
                ? undefined
                : [{ selector: "edge", style: { label: "" } }]
            }
            layoutOptions={layoutOptions}
            onReady={(c) => {
              markReady(view.kind);
              setCore(c);
            }}
            animate={!reducedMotion}
            menuManager={menuManager}
          />
        </main>
      </div>
    </SurfaceFrame>
  );
}

function labelFor(model: Model, superId: string | undefined): string {
  if (superId === undefined) return "";
  const name = model.clustered.getNode(superId)?.properties.name;
  return typeof name === "string" ? name : superId;
}
