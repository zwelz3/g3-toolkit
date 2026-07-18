/**
 * Diagram projections: turn a typed SysML diagram (a VIEW over the model)
 * into a StructuralGraphInput the graph view can lay out and render. One
 * projector per diagram type. All are pure functions of (model, diagram) so
 * they are unit-testable headlessly; the shell calls projectDiagram and
 * hands the result to layoutStructural + CytoscapeCanvas.
 *
 * The four types mirror SysML: block definition (bdd), internal block (ibd),
 * parametric (par), and requirement (req). Each shows exactly the members
 * its diagram lists, the way a saved diagram in a real tool does.
 *
 * Lookups go through flatMap-with-guard rather than filter+map so element
 * types narrow under strict/noUncheckedIndexedAccess without non-null
 * assertions.
 */
import type {
  StructuralGraphInput,
  StructuralNode,
  StructuralEdge,
} from "@g3t/core";
import type {
  SysMLModel,
  Diagram,
  Block,
  Requirement,
  ValueProperty,
  Binding,
} from "./model";

const EMPTY: StructuralGraphInput = { nodes: [], edges: [] };

function valueRow(v: ValueProperty): { id: string; text: string } {
  const mult = v.multiplicity ? ` [${v.multiplicity}]` : "";
  return { id: v.id, text: `${v.name}: ${v.type}${mult}` };
}

function stereoLabel(stereotype: string): string {
  return `\u00AB${stereotype}\u00BB`;
}

/** A full block box: stereotype header + values + operations compartments. */
function blockNode(block: Block): StructuralNode {
  const stereotype =
    block.stereotype ?? (block.kind === "constraint" ? "constraint" : "block");
  return {
    id: block.id,
    header: { stereotype, name: block.name },
    compartments: [
      ...(block.values && block.values.length > 0
        ? [
            {
              id: `${block.id}.values`,
              title: "values",
              rows: block.values.map(valueRow),
            },
          ]
        : []),
      ...(block.operations && block.operations.length > 0
        ? [
            {
              id: `${block.id}.ops`,
              title: "operations",
              rows: block.operations.map((op, i) => ({
                id: `${block.id}.op${i}`,
                text: op,
              })),
            },
          ]
        : []),
    ],
  };
}

/** Block definition diagram: blocks with their compartments + relationships. */
function projectBDD(model: SysMLModel, diagram: Diagram): StructuralGraphInput {
  const nodes: StructuralNode[] = (diagram.blocks ?? []).flatMap((id) => {
    const b = model.blocks[id];
    return b ? [blockNode(b)] : [];
  });
  const present = new Set(nodes.map((n) => n.id));
  const edges: StructuralEdge[] = (diagram.relationships ?? []).flatMap(
    (rid) => {
      const r = model.relationships[rid];
      if (!r || !present.has(r.source) || !present.has(r.target)) return [];
      return [
        {
          id: r.id,
          source: r.source,
          target: r.target,
          kind: r.kind,
          label: r.stereotype ? stereoLabel(r.stereotype) : r.label,
        },
      ];
    },
  );
  return { nodes, edges };
}

/**
 * Internal block diagram: the context block's parts as boxes (role : Type),
 * each carrying its ports, wired by connectors between part ports.
 */
function projectIBD(model: SysMLModel, diagram: Diagram): StructuralGraphInput {
  const ctx = model.blocks[diagram.context];
  if (!ctx || !ctx.parts) return EMPTY;
  const nodes: StructuralNode[] = ctx.parts.map((part) => {
    const typeName = model.blocks[part.type]?.name ?? part.type;
    return {
      id: part.id,
      header: { name: `${part.name} : ${typeName}` },
      ports: part.ports.map((p) => ({ id: p.id, side: p.side })),
    };
  });
  const present = new Set(nodes.map((n) => n.id));
  const edges: StructuralEdge[] = (diagram.connectors ?? []).flatMap((cid) => {
    const c = model.connectors[cid];
    if (!c || !present.has(c.sourcePart) || !present.has(c.targetPart))
      return [];
    return [
      {
        id: c.id,
        source: c.sourcePart,
        target: c.targetPart,
        sourcePort: c.sourcePort,
        targetPort: c.targetPort,
        label: c.label,
        kind: "association" as const,
      },
    ];
  });
  return { nodes, edges };
}

/**
 * Parametric diagram: the constraint block (equation + parameter ports) and
 * the value properties bound to its parameters via binding connectors.
 */
function projectParametric(
  model: SysMLModel,
  diagram: Diagram,
): StructuralGraphInput {
  const cb = model.blocks[diagram.context];
  if (!cb || cb.kind !== "constraint") return EMPTY;
  const params = cb.parameters ?? [];
  const paramIds = new Set(params.map((p) => p.id));
  const constraintNode: StructuralNode = {
    id: cb.id,
    header: { stereotype: "constraint", name: cb.name },
    compartments: [
      ...(cb.constraint
        ? [
            {
              id: `${cb.id}.eq`,
              title: "constraints",
              rows: [{ id: `${cb.id}.eqrow`, text: `{${cb.constraint}}` }],
            },
          ]
        : []),
      {
        id: `${cb.id}.params`,
        title: "parameters",
        rows: params.map(valueRow),
      },
    ],
    ports: params.map((p) => ({ id: p.id, side: "WEST" as const })),
  };
  const bindingList: Binding[] = (diagram.bindings ?? []).flatMap((bid) => {
    const b = model.bindings[bid];
    return b ? [b] : [];
  });
  const valueNodes: StructuralNode[] = bindingList.map((b) => ({
    id: `val.${b.id}`,
    header: { name: b.value },
    width: 150,
    height: 34,
  }));
  const edges: StructuralEdge[] = bindingList.flatMap((b) =>
    paramIds.has(b.param)
      ? [
          {
            id: `bind.${b.id}`,
            source: `val.${b.id}`,
            target: cb.id,
            targetPort: b.param,
            kind: "association" as const,
          },
        ]
      : [],
  );
  return { nodes: [constraintNode, ...valueNodes], edges };
}

/**
 * Requirement diagram: the requirement tree (id + text compartments) with
 * containment, plus the blocks that satisfy leaf requirements and their
 * «satisfy» dependencies.
 */
function projectRequirements(
  model: SysMLModel,
  diagram: Diagram,
): StructuralGraphInput {
  const nodes: StructuralNode[] = [];
  const edges: StructuralEdge[] = [];
  const seen = new Set<string>();

  const walk = (req: Requirement, parentId?: string): void => {
    if (seen.has(req.id)) return;
    seen.add(req.id);
    nodes.push({
      id: req.id,
      header: { stereotype: "requirement", name: req.name },
      compartments: [
        {
          id: `${req.id}.id`,
          title: "id",
          rows: [{ id: `${req.id}.idrow`, text: req.reqId }],
        },
        {
          id: `${req.id}.txt`,
          title: "text",
          rows: [{ id: `${req.id}.txtrow`, text: req.text }],
        },
      ],
    });
    if (parentId) {
      edges.push({
        id: `ct.${parentId}.${req.id}`,
        source: parentId,
        target: req.id,
        kind: "composition",
      });
    }
    for (const child of req.children ?? []) walk(child, req.id);
  };
  for (const rid of diagram.requirements ?? []) {
    const root = model.requirements[rid];
    if (root) walk(root);
  }

  // Satisfying and verifying elements appear as compact boxes so
  // their «satisfy»/«verify» links land (review 6.5: verification
  // traces were dropped at this filter; a test case with a «verify»
  // link never rendered).
  const TRACE_STEREOTYPES = new Set(["satisfy", "verify"]);
  const satisfies = (diagram.relationships ?? []).flatMap((rid) => {
    const r = model.relationships[rid];
    return r &&
      r.stereotype !== undefined &&
      TRACE_STEREOTYPES.has(r.stereotype) &&
      seen.has(r.target)
      ? [r]
      : [];
  });
  const blockIds = new Set(satisfies.map((r) => r.source));
  for (const bid of blockIds) {
    const b = model.blocks[bid];
    if (b)
      nodes.push({
        id: b.id,
        header: {
          // 12.2: constraint blocks were falling back to "block"
          // (their kind, not a stereotype field, is what marks them).
          stereotype:
            b.stereotype ?? (b.kind === "constraint" ? "constraint" : "block"),
          name: b.name,
        },
      });
  }
  for (const r of satisfies) {
    edges.push({
      id: r.id,
      source: r.source,
      target: r.target,
      kind: "dependency",
      label: stereoLabel(r.stereotype ?? "satisfy"),
    });
  }
  return { nodes, edges };
}

/** Project a diagram (by id) into a structural graph for the linked view. */
export function projectDiagram(
  model: SysMLModel,
  diagramId: string,
): StructuralGraphInput {
  const diagram = model.diagrams[diagramId];
  if (!diagram) return EMPTY;
  switch (diagram.type) {
    case "bdd":
      return projectBDD(model, diagram);
    case "ibd":
      return projectIBD(model, diagram);
    case "par":
      return projectParametric(model, diagram);
    case "req":
      return projectRequirements(model, diagram);
    default:
      return EMPTY;
  }
}
