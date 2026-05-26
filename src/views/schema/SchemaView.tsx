/**
 * SchemaView: ontology class hierarchy visualization (M6.E2.T1, T2).
 *
 * Renders class hierarchy as a tree with property annotations.
 * SHACL shapes displayed as constraint badges on target classes.
 *
 * @see specs/01-functional-views.md R1.5
 */

import { useMemo } from "react";
import type { UGM } from "@core/ugm";
import type { SchemaModel } from "@core/adapter";

export interface ShaclShape {
  id: string;
  targetClass: string;
  constraints: Array<{
    path: string;
    minCount?: number;
    maxCount?: number;
    datatype?: string;
  }>;
}

export interface SchemaViewProps {
  ugm?: UGM;
  schema?: SchemaModel;
  shapes?: ShaclShape[];
  className?: string;
}

interface ClassNode {
  name: string;
  properties: string[];
  shapeConstraints: ShaclShape["constraints"];
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
          shapeConstraints: matchingShape?.constraints ?? [],
        });
      }
    } else if (ugm) {
      const registry = ugm.getRegistry();
      for (const nodeType of registry.nodeTypes) {
        result.push({
          name: nodeType,
          properties: [...registry.nodePropertyKeys],
          shapeConstraints:
            shapes.find((s) => s.targetClass === nodeType)?.constraints ?? [],
        });
      }
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [ugm, schema, shapes]);

  if (classes.length === 0) {
    return (
      <div
        data-testid="schema-view-empty"
        style={{ padding: 16, color: "#888" }}
      >
        No schema data available.
      </div>
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
