/**
 * Containment tree for the MBSE workbench: the model browser you'd see on the
 * left of a tool like Cameo. Packages own model elements (blocks, constraint
 * blocks, requirements) and diagrams; a diagram row is the actionable leaf
 * that loads its typed view into the linked graph canvas. The shared
 * TreeView is UGM-derived (it builds a tree from graph edges), so the
 * containment structure needs its own small component; it is demo-local for
 * now but has no MBSE-specific coupling beyond the model shape and could be
 * promoted if other shells want a containment browser.
 */
import { useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import type { SysMLModel, Package, DiagramType } from "./model";

const DIAGRAM_BADGE: Record<DiagramType, { label: string; hint: string }> = {
  bdd: { label: "BDD", hint: "Block Definition Diagram" },
  ibd: { label: "IBD", hint: "Internal Block Diagram" },
  par: { label: "PAR", hint: "Parametric Diagram" },
  req: { label: "REQ", hint: "Requirement Diagram" },
};

/** Small monochrome glyph per node kind; color comes from the parent style. */
function Glyph({
  kind,
}: {
  kind: "package" | "block" | "constraint" | "requirement";
}) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 14 14",
    fill: "none",
    "aria-hidden": true,
  } as const;
  if (kind === "package") {
    return (
      <svg {...common}>
        <path
          d="M1 3.5 5 3.5 6.2 5 13 5 13 11.5 1 11.5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "requirement") {
    return (
      <svg {...common}>
        <rect
          x="2.5"
          y="1.5"
          width="9"
          height="11"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <path
          d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // block / constraint: a compartmented box; constraint gets a brace mark.
  return (
    <svg {...common}>
      <rect
        x="1.5"
        y="2.5"
        width="11"
        height="9"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M1.5 6h11" stroke="currentColor" strokeWidth="1.1" />
      {kind === "constraint" ? (
        <path
          d="M6 7.5c-1 0-1 1-1 1.5s0 1.5 1 1.5M8 7.5c1 0 1 1 1 1.5s0 1.5-1 1.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      style={{
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform 120ms",
      }}
    >
      <path
        d="M3.5 2.5 6.5 5 3.5 7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function indent(depth: number): CSSProperties {
  return { paddingLeft: 8 + depth * 14 };
}

export interface ContainmentTreeProps {
  model: SysMLModel;
  activeDiagramId: string | null;
  onOpenDiagram: (id: string) => void;
}

export function ContainmentTree({
  model,
  activeDiagramId,
  onOpenDiagram,
}: ContainmentTreeProps) {
  // Packages and the requirement subtree expand by default so the diagrams
  // are visible without hunting; collapse is available for large models.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderPackage = (pkg: Package, depth: number): ReactNode => {
    const open = !collapsed.has(pkg.id);
    return (
      <div key={pkg.id}>
        <button
          type="button"
          className="mbse-tree-row mbse-tree-pkg"
          style={indent(depth)}
          aria-expanded={open}
          onClick={() => toggle(pkg.id)}
        >
          <span className="mbse-tree-caret">
            <Chevron open={open} />
          </span>
          <span className="mbse-tree-icon">
            <Glyph kind="package" />
          </span>
          <span className="mbse-tree-label">{pkg.name}</span>
        </button>
        {open ? (
          <div>
            {(pkg.packages ?? []).map((sub) => renderPackage(sub, depth + 1))}
            {(pkg.blocks ?? []).map((id) => {
              const b = model.blocks[id];
              if (!b) return null;
              const kind = b.kind === "constraint" ? "constraint" : "block";
              return (
                <div
                  key={id}
                  className="mbse-tree-row mbse-tree-el"
                  style={indent(depth + 1)}
                >
                  <span className="mbse-tree-icon" data-kind={kind}>
                    <Glyph kind={kind} />
                  </span>
                  <span className="mbse-tree-label">{b.name}</span>
                  <span className="mbse-tree-stereo">
                    {"\u00AB"}
                    {b.stereotype ?? kind}
                    {"\u00BB"}
                  </span>
                </div>
              );
            })}
            {(pkg.requirements ?? []).map((id) => {
              const r = model.requirements[id];
              if (!r) return null;
              return (
                <div
                  key={id}
                  className="mbse-tree-row mbse-tree-el"
                  style={indent(depth + 1)}
                >
                  <span className="mbse-tree-icon" data-kind="requirement">
                    <Glyph kind="requirement" />
                  </span>
                  <span className="mbse-tree-label">{r.name}</span>
                  <span className="mbse-tree-stereo mbse-mono">{r.reqId}</span>
                </div>
              );
            })}
            {(pkg.diagrams ?? []).map((id) => {
              const d = model.diagrams[id];
              if (!d) return null;
              const badge = DIAGRAM_BADGE[d.type];
              const active = d.id === activeDiagramId;
              return (
                <button
                  key={id}
                  type="button"
                  className={`mbse-tree-row mbse-tree-diagram${active ? " is-active" : ""}`}
                  style={indent(depth + 1)}
                  onClick={() => onOpenDiagram(d.id)}
                  title={badge.hint}
                >
                  <span className={`mbse-diagram-badge mbse-badge-${d.type}`}>
                    {badge.label}
                  </span>
                  <span className="mbse-tree-label">{d.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <nav className="mbse-tree" aria-label="Model browser">
      {renderPackage(model.root, 0)}
    </nav>
  );
}
