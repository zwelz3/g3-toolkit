/**
 * SchemaView: ontology class hierarchy visualization (M6.E2.T1, T2).
 *
 * Renders class hierarchy as a tree with property annotations.
 * SHACL shapes displayed as constraint badges on target classes.
 *
 * @see specs/01-functional-views.md R1.5
 */

import { useMemo } from "react";
import type { UGM } from "@g3t/core";
import type { SchemaModel, ShaclShape } from "@g3t/core";
import { EmptyState } from "../../interaction/feedback";

/**
 * The display-only shape this view reads.
 *
 * This type used to be called `ShaclShape`, which collided with
 * `@g3t/core`'s `ShaclShape` (the validator's model) under one name
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
   * SHACL shapes to badge target classes with. Accepts `@g3t/core`'s
   * `ShaclShape` (what `ShaclValidator` and `ShaclShapeBrowser` use) or
   * this view's display-only {@link SchemaViewShape}.
   */
  shapes?: Array<ShaclShape | SchemaViewShape>;
  className?: string;
}

interface ClassNode {
  name: string;
  properties: string[];
  shapeConstraints: ViewConstraints;
}

export function SchemaView({
  ugm,
  schema,
  shapes = [],
  className,
}: SchemaViewProps) {
  const classes = useMemo<ClassNode[]>(() => {
    const result: ClassNode[] = [];

    if (schema) {
      for (const nodeType of schema.nodeTypes) {
        const props = schema.nodeProperties[nodeType] ?? [];
        const matchingShape = shapes.find((s) => s.targetClass === nodeType);
        result.push({
          name: nodeType,
          properties: props,
          shapeConstraints: matchingShape ? constraintsOf(matchingShape) : [],
        });
      }
    } else if (ugm) {
      const registry = ugm.getRegistry();
      for (const nodeType of registry.nodeTypes) {
        const matchingShape = shapes.find((s) => s.targetClass === nodeType);
        result.push({
          name: nodeType,
          properties: [...registry.nodePropertyKeys],
          shapeConstraints: matchingShape ? constraintsOf(matchingShape) : [],
        });
      }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [ugm, schema, shapes]);

  if (classes.length === 0) {
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
      style={{ padding: 8, fontSize: 13, overflow: "auto" }}
    >
      {classes.map((cls) => (
        <div
          key={cls.name}
          data-testid={`schema-class-${cls.name}`}
          style={{
            border: "1px solid #ddd",
            borderRadius: 4,
            padding: 8,
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {cls.name}
            {cls.shapeConstraints.length > 0 && (
              <span
                data-testid={`shacl-badge-${cls.name}`}
                style={{
                  marginLeft: 8,
                  padding: "1px 6px",
                  fontSize: 10,
                  borderRadius: 8,
                  background: "#e0f2fe",
                  color: "#0369a1",
                }}
              >
                SHACL: {cls.shapeConstraints.length} constraints
              </span>
            )}
          </div>
          {cls.properties.length > 0 && (
            <div style={{ color: "#666", fontSize: 12 }}>
              Properties: {cls.properties.join(", ")}
            </div>
          )}
          {cls.shapeConstraints.length > 0 && (
            <div
              data-testid={`shacl-constraints-${cls.name}`}
              style={{ fontSize: 11, color: "#888", marginTop: 4 }}
            >
              {cls.shapeConstraints.map((c, i) => (
                <div key={i}>
                  {c.path}
                  {c.minCount !== undefined && ` min:${c.minCount}`}
                  {c.maxCount !== undefined && ` max:${c.maxCount}`}
                  {c.datatype && ` (${c.datatype})`}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
