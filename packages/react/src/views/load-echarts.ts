/**
 * Lazy echarts loader shared by the echarts-backed views (StatsPanel,
 * SankeyView).
 *
 * WHY a dynamic import. echarts is a required peer, so resolution is
 * not the problem; weight is. Its entry registers every chart type as
 * a side effect, so a host bundler cannot shake an unused
 * `import * as echarts`, and rollup hoists a module shared by two
 * library entries into one common chunk. While these views imported
 * echarts statically they shared a chunk with CytoscapeCanvas, and a
 * host that used only the canvas shipped all of echarts (about 1.1 MB
 * minified; issue #25). Loading it here, inside the view, keeps the
 * public import paths and lets the host code-split echarts into a
 * chunk that is fetched only when a chart actually mounts.
 * scripts/check-optional-peers.mjs fails the build if a static import
 * reaches an entry point again.
 *
 * The promise is memoized so the two views share one module load and
 * a re-render never re-imports. A rejection clears the memo so a
 * later mount can retry rather than inherit a dead promise.
 */

export type EChartsModule = typeof import("echarts");

let pending: Promise<EChartsModule> | undefined;

export function loadEcharts(): Promise<EChartsModule> {
  pending ??= import("echarts").catch((err: unknown) => {
    pending = undefined;
    throw err;
  });
  return pending;
}
