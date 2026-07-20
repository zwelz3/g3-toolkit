/**
 * Fixture coherence invariants (review 6.7). The MBSE fixture is a
 * web of string references (diagram membership, relationship
 * endpoints, connector part/port pairs, parametric bindings,
 * requirement children); a dangling reference renders as a silent
 * gap on whichever diagram consumed it, which is exactly how the
 * reviewed payload.powerDraw suspicion arose. This suite formalizes
 * the resolution rules and cross-references EVERY reference in the
 * fixture against a declaration, so fixture edits fail here instead
 * of rendering holes.
 *
 * Resolution rules pinned:
 * - Binding value "x.y": x is a block id OR a part name declared on
 *   some block (the part's type resolves the block); y is a value
 *   property NAME on the resolved block.
 * - Binding param "c.p": c is a constraint block; p is a declared
 *   parameter name on it.
 * - Connector ends: sourcePart/targetPart are part IDS (the IBD
 *   projection builds nodes with id = part.id and gates connectors
 *   on those ids); each port id exists on that part.
 * - Relationship endpoints: block ids or requirement ids, where
 *   requirements close over the NESTED tree (the record keys roots;
 *   projections walk children).
 * - Diagram member lists and package trees: ids exist in their
 *   records.
 * - Requirement children close over the requirements record.
 */
import { describe, it, expect } from "vitest";
import { satelliteModel, type Block, type Package } from "./model";

const m = satelliteModel;
const blocks = Object.values(m.blocks);

function blockByPartName(partName: string): Block | undefined {
  for (const b of blocks) {
    const part = b.parts?.find((p) => p.name === partName);
    if (part) return m.blocks[part.type];
  }
  return undefined;
}

/** All requirement ids, nested children included. */
function allRequirementIds(): Set<string> {
  const out = new Set<string>();
  const walk = (r: { id: string; children?: Array<never> | unknown[] }) => {
    out.add(r.id);
    for (const c of (r.children ?? []) as Array<{
      id: string;
      children?: unknown[];
    }>)
      walk(c);
  };
  for (const r of Object.values(m.requirements)) walk(r);
  return out;
}

function resolveValueRef(ref: string): boolean {
  const [head, attr] = ref.split(".");
  if (head === undefined || attr === undefined) return false;
  const block = m.blocks[head] ?? blockByPartName(head);
  if (!block) return false;
  return (block.values ?? []).some((v) => v.name === attr);
}

describe("MBSE fixture coherence (6.7)", () => {
  it("every binding value resolves to a declared value property (payload.powerDraw included)", () => {
    for (const b of Object.values(m.bindings)) {
      expect(resolveValueRef(b.value), `binding ${b.id} value ${b.value}`).toBe(
        true,
      );
    }
  });

  it("every binding param resolves to a declared constraint parameter", () => {
    for (const b of Object.values(m.bindings)) {
      const [cid, pname] = b.param.split(".");
      const cb = m.blocks[cid ?? ""];
      expect(cb?.kind, `binding ${b.id} param ${b.param}`).toBe("constraint");
      expect(
        (cb?.parameters ?? []).some((p) => p.name === pname),
        `binding ${b.id} param ${b.param}`,
      ).toBe(true);
    }
  });

  it("every IBD connector end names a real part and a real port on it", () => {
    for (const c of Object.values(m.connectors)) {
      for (const [partId, portId] of [
        [c.sourcePart, c.sourcePort],
        [c.targetPart, c.targetPort],
      ] as const) {
        const owner = blocks.find((b) => b.parts?.some((p) => p.id === partId));
        const part = owner?.parts?.find((p) => p.id === partId);
        expect(part, `connector ${c.id} part ${partId}`).toBeDefined();
        expect(
          part!.ports.some((p) => p.id === portId),
          `connector ${c.id} port ${portId} on ${partId}`,
        ).toBe(true);
      }
    }
  });

  it("every relationship endpoint is a declared block or a (nested) requirement", () => {
    const reqIds = allRequirementIds();
    for (const r of Object.values(m.relationships)) {
      for (const end of [r.source, r.target]) {
        expect(
          m.blocks[end] !== undefined || reqIds.has(end),
          `relationship ${r.id} endpoint ${end}`,
        ).toBe(true);
      }
    }
  });

  it("every diagram member id exists in its record", () => {
    for (const d of Object.values(m.diagrams)) {
      for (const id of d.blocks ?? [])
        expect(m.blocks[id], `${d.id} block ${id}`).toBeDefined();
      for (const id of d.relationships ?? [])
        expect(m.relationships[id], `${d.id} rel ${id}`).toBeDefined();
      for (const id of d.connectors ?? [])
        expect(m.connectors[id], `${d.id} connector ${id}`).toBeDefined();
      for (const id of d.bindings ?? [])
        expect(m.bindings[id], `${d.id} binding ${id}`).toBeDefined();
      for (const id of d.requirements ?? [])
        expect(m.requirements[id], `${d.id} req ${id}`).toBeDefined();
    }
  });

  it("the package tree and requirement children close over their records", () => {
    const visit = (p: Package) => {
      for (const id of p.blocks ?? [])
        expect(m.blocks[id], `pkg ${p.id} block ${id}`).toBeDefined();
      for (const id of p.requirements ?? [])
        expect(m.requirements[id], `pkg ${p.id} req ${id}`).toBeDefined();
      for (const id of p.diagrams ?? [])
        expect(m.diagrams[id], `pkg ${p.id} diagram ${id}`).toBeDefined();
      for (const child of p.packages ?? []) visit(child);
    };
    visit(m.root);
    for (const r of Object.values(m.requirements)) {
      for (const child of r.children ?? []) {
        expect(
          m.requirements[child.id] ?? child,
          `req ${r.id} child ${child.id}`,
        ).toBeDefined();
      }
    }
  });
});
