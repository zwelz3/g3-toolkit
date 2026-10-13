/**
 * SchemaView: ontology class hierarchy visualization (M6.E2.T1, T2).
 *
 * Renders the class hierarchy as nested cards (rdfs:subClassOf via the
 * `subClassOf` prop; classes without a parent keep the flat sorted
 * order) with property annotations. SHACL shapes display as one
 * constraint badge per target class, covering EVERY shape that targets
 * it, with the most severe validation status when results are given.
 *
 * @see specs/01-functional-views.md R1.5
 */

import { useMemo, type ReactNode } from "react";
import type { UGM } from "@g3-toolkit/core";
import type {
  SchemaModel,
  ShaclShape,
  ShaclValidationResult,
} from "@g3-toolkit/core";
import { EmptyState } from "../../interaction/feedback";

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
  targetClass: string;
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

export interface SchemaViewProps {
  ugm?: UGM;
  schema?: SchemaModel;
  /**
   * SHACL shapes to badge target classes with. Accepts `@g3-toolkit/core`'s
   * `ShaclShape` (what `ShaclValidator` and `ShaclShapeBrowser` use) or
   * this view's display-only {@link SchemaViewShape}. Every shape whose
   * `targetClass` matches a class counts toward that class's badge
   * (issue #37: the first match alone used to win).
   */
  shapes?: Array<ShaclShape | SchemaViewShape>;
  /**
   * rdfs:subClassOf as `class -> parent class(es)`, keyed by the same
   * names `schema.nodeTypes` / the registry use. A class nests under
   * the first listed parent that is itself a class here; a parent that
   * is not (say `owl:Thing` when it is not in the list) leaves the
   * class at the top level, where the flat sorted order still applies.
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

interface ClassNode {
  name: string;
  properties: string[];
  /** Every shape targeting this class, in `shapes` order. */
  shapes: Array<{ id: string; constraints: ViewConstraints }>;
  status: ShapeStatus;
  children: ClassNode[];
  depth: number;
  parent: string | null;
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
    // 1. Flat class list, each with every targeting shape.
    const flat = new Map<string, ClassNode>();
    const add = (name: string, properties: string[]): void => {
      if (flat.has(name)) return;
      const targeting = shapes
        .filter((s) => s.targetClass === name)
        .map((s) => ({ id: s.id, constraints: constraintsOf(s) }));
      flat.set(name, {
        name,
        properties,
        shapes: targeting,
        status: "none",
        children: [],
        depth: 0,
        parent: null,
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

    // 2. Status: worst failing result over the shapes targeting the
    //    class (by shape id, or by target class for results whose
    //    shape is not in `shapes`); conforms when results were given
    //    and none failed. Mirrors shaclRowSeverities' worst-wins rank.
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

    // 3. Nesting. First listed parent that is a known class wins;
    //    anything unreachable from a root (a subclass cycle) is
    //    promoted to a root rather than dropped.
    const byName = (a: ClassNode, b: ClassNode) => a.name.localeCompare(b.name);
    if (subClassOf) {
      for (const cls of flat.values()) {
        const declared = subClassOf[cls.name];
        const parents =
          declared === undefined
            ? []
            : Array.isArray(declared)
              ? declared
              : [declared];
        const parent = parents.find((p) => p !== cls.name && flat.has(p));
        if (parent !== undefined) cls.parent = parent;
      }
    }
    const rootList = [...flat.values()].filter((c) => c.parent === null);
    for (const cls of flat.values()) {
      if (cls.parent !== null) flat.get(cls.parent)?.children.push(cls);
    }
    const reached = new Set<string>();
    const setDepth = (node: ClassNode, depth: number): void => {
      reached.add(node.name);
      node.depth = depth;
      node.children.sort(byName);
      for (const child of node.children) setDepth(child, depth + 1);
    };
    for (const root of rootList) setDepth(root, 0);
    for (const cls of flat.values()) {
      if (reached.has(cls.name)) continue;
      // Cycle member: cut its parent link and treat it as a root; its
      // own subtree then gets depths from here.
      const former = cls.parent === null ? undefined : flat.get(cls.parent);
      if (former) {
        former.children = former.children.filter((c) => c !== cls);
      }
      cls.parent = null;
      rootList.push(cls);
      setDepth(cls, 0);
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
      className={className}
      style={{
        padding: 8,
        fontSize: 13,
        overflow: "auto",
        color: "var(--g3t-text-primary, inherit)",
      }}
    >
      {roots.map((cls) => (
        <ClassCard key={cls.name} cls={cls} />
      ))}
    </div>
  );
}

// ── Class card ──────────────────────────────────────────────────────

function ClassCard({ cls }: { cls: ClassNode }): ReactNode {
  const constraintCount = cls.shapes.reduce(
    (n, s) => n + s.constraints.length,
    0,
  );
  const tone = STATUS_TONE[cls.status];
  // "SHACL: N constraints" stays contiguous: it is the badge's
  // historical text and what hosts' tests match on.
  const badgeText =
    `SHACL: ${constraintCount} constraints` +
    (cls.shapes.length > 1 ? `, ${cls.shapes.length} shapes` : "") +
    (cls.status === "none" ? "" : `, ${cls.status}`);

  return (
    <div
      data-testid={`schema-class-${cls.name}`}
      data-depth={cls.depth}
      data-parent={cls.parent ?? undefined}
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
            data-constraint-count={constraintCount}
            data-severity={cls.status}
            title={`Shapes: ${cls.shapes.map((s) => s.id).join(", ")}`}
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
            <div key={shape.id} data-testid={`shacl-shape-${shape.id}`}>
              {/* One shape: the historical flat list. Several: each
                  list under its shape id so a reader can tell which
                  shape asks for what. */}
              {cls.shapes.length > 1 && (
                <div style={{ fontWeight: 600 }}>{shape.id}</div>
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
            <ClassCard key={child.name} cls={child} />
          ))}
        </div>
      )}
    </div>
  );
}
