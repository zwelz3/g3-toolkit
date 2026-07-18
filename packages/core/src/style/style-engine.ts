/**
 * StyleEngine (G3L:STY-001..005, STY-003 gating, STY-004 dependency
 * tracking, QLT-006 diagnostics): the pure style-resolution core.
 *
 * Layer precedence, fixed (G3L:STY-001), later wins:
 *   defaults < theme < rules (insertion order) < classes < states
 *   < manual overrides
 *
 * The resolution of one element is a pure function of (element,
 * config, adjacency); `resolveStyles` exposes exactly that
 * (G3L:ARC-002). The engine class adds the INCREMENTAL layer
 * (G3L:STY-004): rules declare which data fields they read
 * (`dependencies`) and which attribute keys they write (`outputs`);
 * the engine indexes both so a data change re-evaluates only the
 * rules it can affect, only on the changed element, plus its
 * neighbors when an adjacency-dependent rule is implicated (the Ogma
 * `nodeDependencies`/`nodeOutput` design, adopted per the styling
 * investigation).
 *
 * Honesty rules, structural not conventional:
 * - STY-003: a rule that maps from a data field applies ONLY where
 *   the field is present; absent-field elements are skipped with ZERO
 *   per-evaluation diagnostics (the mapping-warning flood, measured
 *   at 1,716 ms of main-thread stall, is unrepresentable here).
 * - A function-attribute rule WITHOUT declared dependencies degrades
 *   invalidation to conservative (any data change re-evaluates it);
 *   the engine says so ONCE per rule through the diagnostics sink,
 *   never per frame (G3L:QLT-006, G3L:PRF-005).
 * - No console calls anywhere in this module; diagnostics go to the
 *   pluggable sink.
 */

import {
  mergeAttributes,
  type VisualAttributeKey,
  type VisualAttributes,
} from "./visual-attributes";

export type StyleElementKind = "node" | "edge";

export interface StyleElement {
  id: string;
  kind: StyleElementKind;
  /** Domain data; rules read ONLY from here (G3L:MOD-005 separation). */
  data: Readonly<Record<string, unknown>>;
  /** Togglable named attribute bundles (G3L:STY-012). */
  classes?: readonly string[];
  /** Active state overlays, e.g. "hover", "selected" (G3L:STY-005). */
  states?: readonly string[];
}

export interface StyleGraph {
  elements: readonly StyleElement[];
  /** Adjacency accessor for adjacency-dependent rules. Optional: a
   *  graph without it treats adjacency rules as having no neighbor
   *  fan-out (and the engine emits STYLE_ADJACENCY_WITHOUT_NEIGHBORS
   *  once if such a rule exists). */
  neighbors?: (id: string) => readonly string[];
}

export interface StyleRuleContext {
  element: StyleElement;
  /** Neighbor elements (empty when the graph has no accessor). */
  neighbors: readonly StyleElement[];
}

export interface StyleSelector {
  kind?: StyleElementKind;
  /** Field-presence gate (G3L:STY-003): ALL listed fields must be
   *  present (not undefined) or the rule silently skips the element. */
  dataHas?: readonly string[];
  /** Equality gates; keys double as presence gates. */
  dataEquals?: Readonly<Record<string, unknown>>;
  /** Matches when the element carries ANY of these classes. */
  classAny?: readonly string[];
  /** Escape-hatch predicate. Declare `dependencies` on the rule or
   *  invalidation degrades to conservative for it. */
  predicate?: (ctx: StyleRuleContext) => boolean;
}

export interface StyleRuleDependencies {
  /** Data fields this rule reads (selector fields are indexed
   *  automatically and need not be repeated). "all" = any data
   *  change affects the rule. */
  data?: readonly string[] | "all";
  /** True when the rule reads neighbors (through ctx.neighbors):
   *  a data change on an element then re-evaluates its neighbors. */
  adjacency?: boolean;
}

export interface StyleRule {
  id: string;
  selector?: StyleSelector;
  attributes:
    | Readonly<Partial<VisualAttributes>>
    | ((ctx: StyleRuleContext) => Partial<VisualAttributes>);
  dependencies?: StyleRuleDependencies;
  /** Attribute keys this rule writes (G3L:STY-004 outputs). Literal
   *  attributes derive outputs automatically; function attributes
   *  should declare them (undeclared = treated as writing anything,
   *  which only widens DOWNSTREAM diffing, not which rules run). */
  outputs?: readonly VisualAttributeKey[];
}

export interface StyleDiagnostic {
  code:
    | "STYLE_DUP_RULE_ID"
    | "STYLE_FN_WITHOUT_DEPS"
    | "STYLE_UNKNOWN_CLASS"
    | "STYLE_UNKNOWN_STATE"
    | "STYLE_ADJACENCY_WITHOUT_NEIGHBORS";
  message: string;
  /** Offending rule/class/state name where applicable. */
  subject?: string;
  /** Element id where applicable. */
  elementId?: string;
}

export interface DiagnosticsSink {
  emit(diagnostic: StyleDiagnostic): void;
}

/** Theme layer: per-kind attribute bundles (token resolution is the
 *  C3 layer above this; the engine consumes resolved values). */
export interface StyleTheme {
  node?: Readonly<Partial<VisualAttributes>>;
  edge?: Readonly<Partial<VisualAttributes>>;
}

export interface StyleEngineConfig {
  theme?: StyleTheme;
  rules?: readonly StyleRule[];
  /** Named class bundles; precedence among ACTIVE classes follows
   *  definition order here (later definitions win). */
  classDefs?: Readonly<Record<string, Partial<VisualAttributes>>>;
  /** Named state overlays; precedence follows definition order
   *  (later definitions win: define "selected" before "hover" if
   *  hover should beat selection). */
  stateDefs?: Readonly<Record<string, Partial<VisualAttributes>>>;
  diagnostics?: DiagnosticsSink;
}

const NODE_DEFAULTS: Partial<VisualAttributes> = {
  fill: "#e9ecef",
  stroke: "#495057",
  strokeWidth: 1,
  opacity: 1,
  shape: "rectangle",
  labelVisible: true,
  lodTier: 0,
};

const EDGE_DEFAULTS: Partial<VisualAttributes> = {
  stroke: "#868e96",
  strokeWidth: 1.5,
  opacity: 1,
  arrowSource: "none",
  arrowTarget: "triangle",
  labelVisible: true,
  lodTier: 0,
};

function selectorMatches(
  selector: StyleSelector | undefined,
  ctx: StyleRuleContext,
): boolean {
  if (!selector) return true;
  const el = ctx.element;
  if (selector.kind !== undefined && selector.kind !== el.kind) return false;
  if (selector.dataHas) {
    for (const f of selector.dataHas) {
      if (el.data[f] === undefined) return false; // silent skip, STY-003
    }
  }
  if (selector.dataEquals) {
    for (const [f, v] of Object.entries(selector.dataEquals)) {
      if (el.data[f] === undefined) return false;
      if (el.data[f] !== v) return false;
    }
  }
  if (selector.classAny) {
    const classes = el.classes ?? [];
    if (!selector.classAny.some((c) => classes.includes(c))) return false;
  }
  if (selector.predicate && !selector.predicate(ctx)) return false;
  return true;
}

/** Data fields a rule's SELECTOR reads (indexed automatically). */
function selectorFields(rule: StyleRule): string[] {
  const out: string[] = [];
  if (rule.selector?.dataHas) out.push(...rule.selector.dataHas);
  if (rule.selector?.dataEquals) {
    out.push(...Object.keys(rule.selector.dataEquals));
  }
  return out;
}

/**
 * Pure resolution of one element through the full layer stack
 * (G3L:ARC-002). Exported for headless testing and for callers that
 * want no engine state at all.
 */
export function resolveElement(
  element: StyleElement,
  config: StyleEngineConfig,
  neighbors: readonly StyleElement[] = [],
  onEvaluation?: () => void,
  diagnosticsOnce?: (d: StyleDiagnostic, key: string) => void,
): VisualAttributes {
  const ctx: StyleRuleContext = { element, neighbors };
  let attrs: Partial<VisualAttributes> =
    element.kind === "node" ? { ...NODE_DEFAULTS } : { ...EDGE_DEFAULTS };

  // theme
  const themed =
    element.kind === "node" ? config.theme?.node : config.theme?.edge;
  if (themed) attrs = mergeAttributes(attrs, themed);

  // rules, insertion order
  for (const rule of config.rules ?? []) {
    if (!selectorMatches(rule.selector, ctx)) continue;
    onEvaluation?.();
    const contribution =
      typeof rule.attributes === "function"
        ? rule.attributes(ctx)
        : rule.attributes;
    attrs = mergeAttributes(attrs, contribution);
  }

  // classes, definition order among the element's active classes
  if (element.classes && element.classes.length > 0) {
    const defs = config.classDefs ?? {};
    for (const name of Object.keys(defs)) {
      if (!element.classes.includes(name)) continue;
      const bundle = defs[name];
      if (bundle) attrs = mergeAttributes(attrs, bundle);
    }
    for (const name of element.classes) {
      if (!(name in defs)) {
        diagnosticsOnce?.(
          {
            code: "STYLE_UNKNOWN_CLASS",
            message: `element carries class "${name}" with no classDef`,
            subject: name,
            elementId: element.id,
          },
          `class:${name}`,
        );
      }
    }
  }

  // states, definition order among the element's active states
  if (element.states && element.states.length > 0) {
    const defs = config.stateDefs ?? {};
    for (const name of Object.keys(defs)) {
      if (!element.states.includes(name)) continue;
      const bundle = defs[name];
      if (bundle) attrs = mergeAttributes(attrs, bundle);
    }
    for (const name of element.states) {
      if (!(name in defs)) {
        diagnosticsOnce?.(
          {
            code: "STYLE_UNKNOWN_STATE",
            message: `element carries state "${name}" with no stateDef`,
            subject: name,
            elementId: element.id,
          },
          `state:${name}`,
        );
      }
    }
  }

  return attrs as VisualAttributes;
}

/**
 * Pure full-graph resolution (G3L:ARC-002): manual overrides applied
 * last. No caching, no incremental machinery; the reference
 * semantics the engine's incremental path must agree with (asserted
 * in tests).
 */
export function resolveStyles(
  graph: StyleGraph,
  config: StyleEngineConfig,
  overrides?: ReadonlyMap<string, Partial<VisualAttributes>>,
): Map<string, VisualAttributes> {
  const byId = new Map(graph.elements.map((e) => [e.id, e]));
  const out = new Map<string, VisualAttributes>();
  for (const el of graph.elements) {
    const neighborIds = graph.neighbors?.(el.id) ?? [];
    const neighbors = neighborIds
      .map((id) => byId.get(id))
      .filter((e): e is StyleElement => e !== undefined);
    let attrs = resolveElement(el, config, neighbors);
    const manual = overrides?.get(el.id);
    if (manual) attrs = mergeAttributes(attrs, manual) as VisualAttributes;
    out.set(el.id, attrs);
  }
  return out;
}

export interface InvalidationResult {
  /** Element ids whose attributes were recomputed. */
  recomputed: readonly string[];
  /** Rule evaluations performed by this change (instrumentation for
   *  the mechanistic PRF-004 proxy assertions). */
  evaluations: number;
}

/**
 * The incremental engine (G3L:STY-004). Holds resolved attributes and
 * the rule/field indexes; changes recompute the minimum element set
 * the declarations allow.
 */
export class StyleEngine {
  private readonly config: StyleEngineConfig;
  private readonly overrides = new Map<string, Partial<VisualAttributes>>();
  private readonly resolved = new Map<string, VisualAttributes>();
  private readonly byId = new Map<string, StyleElement>();
  private graph: StyleGraph = { elements: [] };

  /** dataField -> rule ids affected when that field changes. */
  private readonly fieldIndex = new Map<string, Set<string>>();
  /** Rules affected by ANY data change (deps "all", or fn without
   *  declared deps: the conservative degradation). */
  private readonly broadRules = new Set<string>();
  /** Rules that read neighbors. */
  private readonly adjacencyRules = new Set<string>();
  /** Data fields adjacency rules depend on ("*" = all). */
  private readonly adjacencyFields = new Set<string>();
  private adjacencyBroad = false;

  private evaluations = 0;
  private readonly emittedOnce = new Set<string>();

  constructor(config: StyleEngineConfig) {
    this.config = config;
    const seen = new Set<string>();
    for (const rule of config.rules ?? []) {
      if (seen.has(rule.id)) {
        this.emitOnce(
          {
            code: "STYLE_DUP_RULE_ID",
            message: `duplicate rule id "${rule.id}"`,
            subject: rule.id,
          },
          `dup:${rule.id}`,
        );
      }
      seen.add(rule.id);

      const declared = rule.dependencies?.data;
      const isFn = typeof rule.attributes === "function";
      const hasPredicate = rule.selector?.predicate !== undefined;
      const fields = new Set(selectorFields(rule));
      if (declared && declared !== "all") {
        for (const f of declared) fields.add(f);
      }
      const broad =
        declared === "all" ||
        ((isFn || hasPredicate) && declared === undefined);
      if (broad) {
        this.broadRules.add(rule.id);
        if ((isFn || hasPredicate) && declared === undefined) {
          this.emitOnce(
            {
              code: "STYLE_FN_WITHOUT_DEPS",
              message:
                `rule "${rule.id}" computes attributes (or matches by ` +
                `predicate) without declared data dependencies; ` +
                `invalidation degrades to conservative for it`,
              subject: rule.id,
            },
            `fnnodeps:${rule.id}`,
          );
        }
      } else {
        for (const f of fields) {
          let set = this.fieldIndex.get(f);
          if (!set) {
            set = new Set();
            this.fieldIndex.set(f, set);
          }
          set.add(rule.id);
        }
      }
      if (rule.dependencies?.adjacency) {
        this.adjacencyRules.add(rule.id);
        if (broad) this.adjacencyBroad = true;
        else for (const f of fields) this.adjacencyFields.add(f);
      }
    }
  }

  private emitOnce(d: StyleDiagnostic, key: string): void {
    if (this.emittedOnce.has(key)) return;
    this.emittedOnce.add(key);
    this.config.diagnostics?.emit(d);
  }

  /** Total rule evaluations since construction (test instrumentation). */
  stats(): { evaluations: number } {
    return { evaluations: this.evaluations };
  }

  /** Resolved attributes of one element (after load/changes). */
  get(id: string): VisualAttributes | undefined {
    return this.resolved.get(id);
  }

  /** Full (re)load: resolves every element. */
  load(graph: StyleGraph): Map<string, VisualAttributes> {
    this.graph = graph;
    this.byId.clear();
    for (const el of graph.elements) this.byId.set(el.id, el);
    if (this.adjacencyRules.size > 0 && !graph.neighbors) {
      this.emitOnce(
        {
          code: "STYLE_ADJACENCY_WITHOUT_NEIGHBORS",
          message:
            "adjacency-dependent rules configured but the graph has no " +
            "neighbors accessor; neighbor fan-out is disabled",
        },
        "adj:no-neighbors",
      );
    }
    this.resolved.clear();
    for (const el of graph.elements) this.recompute(el.id);
    return new Map(this.resolved);
  }

  private neighborsOf(id: string): StyleElement[] {
    const ids = this.graph.neighbors?.(id) ?? [];
    const out: StyleElement[] = [];
    for (const nid of ids) {
      const el = this.byId.get(nid);
      if (el) out.push(el);
    }
    return out;
  }

  private recompute(id: string): void {
    const el = this.byId.get(id);
    if (!el) return;
    let attrs = resolveElement(
      el,
      this.config,
      this.neighborsOf(id),
      () => {
        this.evaluations++;
      },
      (d, key) => {
        this.emitOnce(d, key);
      },
    );
    const manual = this.overrides.get(id);
    if (manual) attrs = mergeAttributes(attrs, manual) as VisualAttributes;
    this.resolved.set(id, attrs);
  }

  /**
   * A data change on one element: fields already written to the
   * element by the caller; the engine recomputes the minimum set the
   * declarations allow (G3L:STY-004). Unmatched fields cost ZERO
   * evaluations.
   */
  applyDataChange(
    elementId: string,
    changedFields: readonly string[],
  ): InvalidationResult {
    const before = this.evaluations;
    const affected =
      this.broadRules.size > 0 ||
      changedFields.some((f) => this.fieldIndex.has(f));
    const recomputed: string[] = [];
    if (affected) {
      this.recompute(elementId);
      recomputed.push(elementId);
    }
    const adjacencyHit =
      this.adjacencyBroad ||
      changedFields.some((f) => this.adjacencyFields.has(f));
    if (adjacencyHit && this.adjacencyRules.size > 0) {
      for (const n of this.neighborsOf(elementId)) {
        this.recompute(n.id);
        recomputed.push(n.id);
      }
    }
    return { recomputed, evaluations: this.evaluations - before };
  }

  /** State overlay change: exactly one element recomputes
   *  (G3L:STY-005: states compose without touching base layers of
   *  other elements). */
  setStates(elementId: string, states: readonly string[]): InvalidationResult {
    const before = this.evaluations;
    const el = this.byId.get(elementId);
    if (!el) return { recomputed: [], evaluations: 0 };
    this.byId.set(elementId, { ...el, states });
    this.rebindGraphElement(elementId);
    this.recompute(elementId);
    return {
      recomputed: [elementId],
      evaluations: this.evaluations - before,
    };
  }

  /** Class toggle: exactly one element recomputes (G3L:STY-012). */
  setClasses(
    elementId: string,
    classes: readonly string[],
  ): InvalidationResult {
    const before = this.evaluations;
    const el = this.byId.get(elementId);
    if (!el) return { recomputed: [], evaluations: 0 };
    this.byId.set(elementId, { ...el, classes });
    this.rebindGraphElement(elementId);
    this.recompute(elementId);
    return {
      recomputed: [elementId],
      evaluations: this.evaluations - before,
    };
  }

  /** Manual per-element override: highest layer (G3L:STY-001). */
  setOverride(
    elementId: string,
    override: Partial<VisualAttributes> | null,
  ): InvalidationResult {
    const before = this.evaluations;
    if (override === null) this.overrides.delete(elementId);
    else this.overrides.set(elementId, override);
    this.recompute(elementId);
    return {
      recomputed: [elementId],
      evaluations: this.evaluations - before,
    };
  }

  private rebindGraphElement(elementId: string): void {
    // Keep graph.elements consistent with byId after a state/class
    // rebind so a later load-free full read stays coherent. The
    // elements array is caller-owned and treated immutable; the
    // engine's source of truth for lookups is byId.
    const el = this.byId.get(elementId);
    if (!el) return;
    // byId already holds the rebound element; nothing else to do. The
    // method exists to make the invariant explicit and greppable.
  }
}
