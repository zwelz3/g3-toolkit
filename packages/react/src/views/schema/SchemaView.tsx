/**
 * SchemaView: ontology class hierarchy visualization (M6.E2.T1, T2).
 *
 * Renders the class hierarchy as nested cards (rdfs:subClassOf via the
 * `subClassOf` prop; classes without a parent keep the flat sorted
 * order, and a class with several parents renders once under each)
 * with property annotations. SHACL shapes display as one
 * constraint badge per target class, covering EVERY shape that targets
 * it (by `targetClass` or any `targets` entry of kind `class`, issue
 * #56) and every shape declared on one of its superclasses (marked as
 * inherited: `sh:targetClass` selects subclass instances too), with the
 * most severe validation status when results are given.
 *
 * @see specs/01-functional-views.md R1.5
 */

import { useMemo, type ReactNode } from "react";
import type { UGM } from "@g3-toolkit/core";
import type {
  SchemaModel,
  ShaclShape,
  ShaclShapeTarget,
  ShaclValidationResult,
} from "@g3-toolkit/core";
import { EmptyState } from "../../interaction/feedback";
import { viewClass } from "../../theme/view-class";

/**
 * The display-only shape this view reads.
 *
 * This type used to be called `ShaclShape`, which collided with
 * `@g3-toolkit/core`'s `ShaclShape` (the validator's model) under one name
 * across two packages. The two are structurally different: core keys
 * its constraint list `properties`, this one keys it `constraints`, so
 * the natural import built an array the component rejected. Renamed so
 * `ShaclShape` means one thing everywhere; `shapes` accepts either
 * form, so no runtime value that worked before stops working.
 */
export interface SchemaViewShape {
  id: string;
  /** Optional as on core's `ShaclShape` (#67): absent or `""` means
   *  the shape names no class target and badges only through
   *  `targets`. */
  targetClass?: string;
  /** Further targets, as on core's `ShaclShape`; entries of kind
   *  `class` badge their class too (other kinds are not classes and
   *  are ignored here). Optional so existing values keep working. */
  targets?: ShaclShapeTarget[];
  constraints: Array<{
    path: string;
    minCount?: number;
    maxCount?: number;
    datatype?: string;
  }>;
}

type ShaclSeverityLevel = "violation" | "warning" | "info";

/** Constraint list as this view reads it, from either shape form. */
type ViewConstraints = SchemaViewShape["constraints"];

/**
 * Read the constraint list off either shape form.
 *
 * Core's `ShaclPropertyConstraint` is a superset of what this view
 * renders (it adds pattern, ranges, severity), and its narrower
 * `datatype` union is assignable to the string this view expects, so
 * the projection is a field rename and nothing is lost that is drawn.
 */
function constraintsOf(shape: ShaclShape | SchemaViewShape): ViewConstraints {
  return "properties" in shape ? shape.properties : shape.constraints;
}

/**
 * Every class a shape targets directly: `targetClass` plus each
 * `targets` entry of kind `class`, deduplicated so a class named both
 * ways badges once (issue #56: the view used to read `targetClass`
 * alone, so a shape targeting 13 classes badged one). An absent (#67)
 * or empty (#54) `targetClass` (a shape targeted only by subjects-of
 * or SPARQL) names no class and is dropped.
 */
function targetClassesOf(shape: ShaclShape | SchemaViewShape): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (name: string): void => {
    if (name === "" || seen.has(name)) return;
    seen.add(name);
    out.push(name);
  };
  push(shape.targetClass ?? "");
  for (const t of shape.targets ?? []) {
    if (t.kind === "class") push(t.value);
  }
  return out;
}

export interface SchemaViewProps {
  ugm?: UGM;
  schema?: SchemaModel;
  /**
   * SHACL shapes to badge target classes with. Accepts `@g3-toolkit/core`'s
   * `ShaclShape` (what `ShaclValidator` and `ShaclShapeBrowser` use) or
   * this view's display-only {@link SchemaViewShape}. Every shape whose
   * `targetClass` or `targets` (kind `class`) names a class counts
   * toward that class's badge (issue #37: the first match alone used to
   * win; issue #56: `targets` was ignored). With `subClassOf`, a shape
   * declared on a superclass also counts toward each subclass, listed
   * after the direct shapes and marked inherited, because SHACL's
   * `sh:targetClass` selects instances of subclasses as well.
   */
  shapes?: Array<ShaclShape | SchemaViewShape>;
  /**
   * rdfs:subClassOf as `class -> parent class(es)`, keyed by the same
   * names `schema.nodeTypes` / the registry use. A class nests under
   * every listed parent that is itself a class here (issue #56: the
   * first used to win), as one card per parent that agree on shapes,
   * inheritance and status; a parent that is not a class here (say
   * `owl:Thing` when it is not in the list), the class itself, and a
   * repeat are ignored, and a class with no usable parent stays at the
   * top level, where the flat sorted order still applies.
   * Neither `SchemaModel` nor the UGM registry carries subclass edges,
   * so the host derives this from its ontology (the SHACL shapes
   * parser, R1.16, would supply it once it lands).
   */
  subClassOf?: Record<string, string | string[]>;
  /**
   * Validation results (from `validateShacl` or `ShaclValidator`).
   * When given, each class badge also reports the most severe status
   * across every shape targeting it: `violation` > `warning` > `info`,
   * or `conforms` when nothing targeting the class failed.
   */
  validationResults?: ShaclValidationResult[];
  className?: string;
}

/** Badge status: the three SHACL tiers, a clean pass, or no results. */
type ShapeStatus = ShaclSeverityLevel | "conforms" | "none";

/** One shape as a class card lists it. */
interface ClassShape {
  id: string;
  constraints: ViewConstraints;
  /** The superclass the shape was declared on when the class only
   *  inherits it; absent for a shape that targets the class itself. */
  inheritedFrom?: string;
}

interface ClassNode {
  name: string;
  properties: string[];
  /** Every shape applying to this class: direct targets first, in
   *  `shapes` order, then inherited ones, nearest superclass first. */
  shapes: ClassShape[];
  status: ShapeStatus;
  /** Every known superclass, in `subClassOf` order, each once. The
   *  class renders once under each; depth and parent are properties of
   *  a rendered copy, not of the class, so they live on the card. */
  parents: string[];
  children: ClassNode[];
}

const SEVERITY_RANK: Record<ShaclSeverityLevel, number> = {
  info: 1,
  warning: 2,
  violation: 3,
};

/** Badge tones. Muted tokens are optional on a theme, so each carries
 *  a fallback (docs/design-tokens.md). */
const STATUS_TONE: Record<ShapeStatus, { background: string; color: string }> =
  {
    none: {
      background: "var(--g3t-accent-muted, #e0f2fe)",
      color: "var(--g3t-accent-primary, #0369a1)",
    },
    conforms: {
      background: "var(--g3t-success-muted, #dcfce7)",
      color: "var(--g3t-success, #16a34a)",
    },
    info: {
      background: "var(--g3t-accent-muted, #e0f2fe)",
      color: "var(--g3t-accent-primary, #0369a1)",
    },
    warning: {
      background: "var(--g3t-warning-muted, #fef3c7)",
      color: "var(--g3t-warning, #d97706)",
    },
    violation: {
      background: "var(--g3t-error-muted, #fee2e2)",
      color: "var(--g3t-error, #dc2626)",
    },
  };

export function SchemaView({
  ugm,
  schema,
  shapes = [],
  subClassOf,
  validationResults,
  className,
}: SchemaViewProps) {
  const roots = useMemo<ClassNode[]>(() => {
    // 1. Flat class list, each with every shape targeting it directly
    //    (targetClass or a class entry in targets).
    const flat = new Map<string, ClassNode>();
    const add = (name: string, properties: string[]): void => {
      if (flat.has(name)) return;
      const targeting = shapes
        .filter((s) => targetClassesOf(s).includes(name))
        .map((s) => ({ id: s.id, constraints: constraintsOf(s) }));
      flat.set(name, {
        name,
        properties,
        shapes: targeting,
        status: "none",
        parents: [],
        children: [],
      });
    };
    if (schema) {
      for (const nodeType of schema.nodeTypes) {
        add(nodeType, schema.nodeProperties[nodeType] ?? []);
      }
    } else if (ugm) {
      const registry = ugm.getRegistry();
      for (const nodeType of registry.nodeTypes) {
        add(nodeType, [...registry.nodePropertyKeys]);
      }
    }

    // 2. Nesting. Every listed parent that is a known class, each
    //    once and never the class itself (a class with several parents
    //    renders under each; the maintainer ruling on issue #56). The
    //    result is a DAG the cards walk, so cycles must be cut: a link
    //    that closes a cycle reached from a root is dropped, and
    //    anything still unreachable from a root (a cycle with no entry)
    //    is promoted to a root rather than dropped, as before.
    const byName = (a: ClassNode, b: ClassNode) => a.name.localeCompare(b.name);
    if (subClassOf) {
      for (const cls of flat.values()) {
        const declared = subClassOf[cls.name];
        const listed =
          declared === undefined
            ? []
            : Array.isArray(declared)
              ? declared
              : [declared];
        for (const p of listed) {
          if (p === cls.name || !flat.has(p) || cls.parents.includes(p)) {
            continue;
          }
          cls.parents.push(p);
        }
      }
    }
    for (const cls of flat.values()) {
      for (const p of cls.parents) flat.get(p)?.children.push(cls);
    }
    const unlink = (parent: ClassNode, child: ClassNode): void => {
      parent.children = parent.children.filter((c) => c !== child);
      child.parents = child.parents.filter((p) => p !== parent.name);
    };
    const rootList = [...flat.values()].filter((c) => c.parents.length === 0);
    const reached = new Set<string>();
    const onPath = new Set<string>();
    const visit = (node: ClassNode): void => {
      reached.add(node.name);
      onPath.add(node.name);
      for (const child of [...node.children]) {
        // A child already on the path from the root is a back edge:
        // only possible with several parents (a single-parent cycle has
        // no entry from a root). Cut it so the card recursion ends.
        if (onPath.has(child.name)) {
          unlink(node, child);
          continue;
        }
        // Reached by another path (a diamond): keep the link, the
        // card renders there too, and do not walk it twice.
        if (!reached.has(child.name)) visit(child);
      }
      onPath.delete(node.name);
    };
    for (const root of rootList) visit(root);
    for (const cls of flat.values()) {
      if (reached.has(cls.name)) continue;
      // Cycle member with no entry: cut its parent links and treat it
      // as a root; the rest of the cycle is then reached from it.
      for (const p of [...cls.parents]) {
        const parent = flat.get(p);
        if (parent) unlink(parent, cls);
      }
      rootList.push(cls);
      visit(cls);
    }
    for (const cls of flat.values()) cls.children.sort(byName);

    // 3. Inheritance: a shape declared on a superclass applies to the
    //    subclass too (sh:targetClass selects subclass instances), so
    //    each class also lists the shapes of its ancestors, nearest
    //    first, marked with the class they were declared on. A shape
    //    the class already targets directly is not listed twice, and
    //    one declared on two ancestors is attributed to the nearest.
    //    The walk is through `parentsOf`, the one place a class's
    //    superclasses are read; with several parents it collects from
    //    every ancestor, so each rendered copy of a class agrees.
    const parentsOf = (node: ClassNode): string[] => node.parents;
    for (const cls of flat.values()) {
      const have = new Set(cls.shapes.map((s) => s.id));
      const visited = new Set<string>([cls.name]);
      // Breadth-first so a nearer ancestor's declaration wins.
      let frontier = parentsOf(cls);
      while (frontier.length > 0) {
        const next: string[] = [];
        for (const name of frontier) {
          if (visited.has(name)) continue;
          visited.add(name);
          const ancestor = flat.get(name);
          if (!ancestor) continue;
          for (const shape of ancestor.shapes) {
            if (shape.inheritedFrom !== undefined || have.has(shape.id)) {
              continue;
            }
            have.add(shape.id);
            cls.shapes.push({ ...shape, inheritedFrom: ancestor.name });
          }
          next.push(...parentsOf(ancestor));
        }
        frontier = next;
      }
    }

    // 4. Status: worst failing result over the shapes applying to the
    //    class, inherited included (by shape id, or by target class for
    //    results whose shape is not in `shapes`); conforms when results
    //    were given and none failed. Mirrors shaclRowSeverities'
    //    worst-wins rank.
    if (validationResults) {
      for (const cls of flat.values()) {
        const shapeIds = new Set(cls.shapes.map((s) => s.id));
        let worst: ShaclSeverityLevel | null = null;
        for (const r of validationResults) {
          if (r.valid) continue;
          if (r.targetClass !== cls.name && !shapeIds.has(r.shapeId)) continue;
          for (const v of r.violations) {
            if (!worst || SEVERITY_RANK[v.severity] > SEVERITY_RANK[worst]) {
              worst = v.severity;
            }
          }
        }
        cls.status = worst ?? "conforms";
      }
    }

    return rootList.sort(byName);
  }, [ugm, schema, shapes, subClassOf, validationResults]);

  if (roots.length === 0) {
    return (
      <EmptyState
        testId="schema-view-empty"
        icon="layers"
        title="No schema loaded"
        description="The schema view renders the adapter's class hierarchy. Connect a source whose getSchema() returns node types to populate it."
      />
    );
  }

  return (
    <div
      data-testid="schema-view"
      className={viewClass(className)}
      style={{
        padding: 8,
        fontSize: 13,
        overflow: "auto",
        color: "var(--g3t-text-primary, inherit)",
      }}
    >
      {roots.map((cls) => (
        <ClassCard
          key={cls.name}
          cls={cls}
          parent={null}
          depth={0}
          path={cls.name}
        />
      ))}
    </div>
  );
}

// ── Class card ──────────────────────────────────────────────────────

/**
 * One rendered copy of a class. A class with several parents renders
 * once under each, sharing the `ClassNode` (so shapes, inheritance and
 * status agree across copies); `parent`, `depth` and `path` belong to
 * the copy. `path` (root to here, slash-joined) keys the copy and is
 * exposed as `data-path` so a host or test can address one copy where
 * `schema-class-<name>` repeats.
 */
function ClassCard({
  cls,
  parent,
  depth,
  path,
}: {
  cls: ClassNode;
  parent: string | null;
  depth: number;
  path: string;
}): ReactNode {
  const constraintCount = cls.shapes.reduce(
    (n, s) => n + s.constraints.length,
    0,
  );
  const inheritedCount = cls.shapes.filter(
    (s) => s.inheritedFrom !== undefined,
  ).length;
  const tone = STATUS_TONE[cls.status];
  // "SHACL: N constraints" stays contiguous: it is the badge's
  // historical text and what hosts' tests match on.
  const badgeText =
    `SHACL: ${constraintCount} constraints` +
    (cls.shapes.length > 1 ? `, ${cls.shapes.length} shapes` : "") +
    (inheritedCount > 0 ? `, ${inheritedCount} inherited` : "") +
    (cls.status === "none" ? "" : `, ${cls.status}`);
  const shapeTitle = (s: ClassShape): string =>
    s.inheritedFrom === undefined
      ? s.id
      : `${s.id} (inherited from ${s.inheritedFrom})`;

  return (
    <div
      data-testid={`schema-class-${cls.name}`}
      data-depth={depth}
      data-parent={parent ?? undefined}
      data-path={path}
      style={{
        border: "1px solid var(--g3t-border, #ddd)",
        borderRadius: 4,
        padding: 8,
        marginBottom: 8,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        {cls.name}
        {cls.shapes.length > 0 && (
          <span
            data-testid={`shacl-badge-${cls.name}`}
            data-shape-count={cls.shapes.length}
            data-inherited-count={inheritedCount}
            data-constraint-count={constraintCount}
            data-severity={cls.status}
            title={`Shapes: ${cls.shapes.map(shapeTitle).join(", ")}`}
            style={{
              marginLeft: 8,
              padding: "1px 6px",
              fontSize: 10,
              borderRadius: 8,
              background: tone.background,
              color: tone.color,
            }}
          >
            {badgeText}
          </span>
        )}
      </div>
      {cls.properties.length > 0 && (
        <div style={{ color: "var(--g3t-text-muted, #666)", fontSize: 12 }}>
          Properties: {cls.properties.join(", ")}
        </div>
      )}
      {constraintCount > 0 && (
        <div
          data-testid={`shacl-constraints-${cls.name}`}
          style={{
            fontSize: 11,
            color: "var(--g3t-text-muted, #888)",
            marginTop: 4,
          }}
        >
          {cls.shapes.map((shape) => (
            <div
              key={shape.id}
              data-testid={`shacl-shape-${shape.id}`}
              data-inherited-from={shape.inheritedFrom}
              className={
                shape.inheritedFrom === undefined
                  ? undefined
                  : "g3t-schema-shape-inherited"
              }
              title={
                shape.inheritedFrom === undefined
                  ? undefined
                  : `Inherited from ${shape.inheritedFrom}`
              }
              style={
                shape.inheritedFrom === undefined
                  ? undefined
                  : { fontStyle: "italic" }
              }
            >
              {/* One direct shape: the historical flat list. Several,
                  or an inherited one: each list under its shape id so
                  a reader can tell which shape asks for what and
                  where it was declared. */}
              {(cls.shapes.length > 1 || shape.inheritedFrom !== undefined) && (
                <div style={{ fontWeight: 600 }}>{shapeTitle(shape)}</div>
              )}
              {shape.constraints.map((c, i) => (
                <div key={i}>
                  {c.path}
                  {c.minCount !== undefined && ` min:${c.minCount}`}
                  {c.maxCount !== undefined && ` max:${c.maxCount}`}
                  {c.datatype && ` (${c.datatype})`}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {cls.children.length > 0 && (
        <div
          data-testid={`schema-subclasses-${cls.name}`}
          style={{
            marginTop: 8,
            marginLeft: 8,
            paddingLeft: 8,
            borderLeft: "2px solid var(--g3t-border, #ddd)",
          }}
        >
          {cls.children.map((child) => (
            <ClassCard
              key={`${path}/${child.name}`}
              cls={child}
              parent={cls.name}
              depth={depth + 1}
              path={`${path}/${child.name}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
