/**
 * SPARQL tabular adapter (review 5.19). Pins: registry column order
 * follows the SELECT head even when the first row leaves a variable
 * unbound; unbound cells are empty strings, not omissions; error
 * results adapt to an empty grid rather than throwing.
 */
import { describe, it, expect } from "vitest";
import { sparqlResultUgm } from "./sparql-grid";
import type { SparqlResult } from "../bio/sparql";

function uri(value: string) {
  return { kind: "uri" as const, value };
}

describe("sparqlResultUgm", () => {
  it("keeps SELECT-clause column order despite sparse first rows", () => {
    const result: SparqlResult = {
      ok: true,
      head: ["s", "label", "mass"],
      rows: [
        { s: uri("http://x#a") }, // label and mass unbound
        { s: uri("http://x#b"), label: uri("http://x#B"), mass: uri("42") },
      ],
    };
    const ugm = sparqlResultUgm(result);
    expect([...ugm.getRegistry().nodePropertyKeys]).toEqual([
      "s",
      "label",
      "mass",
    ]);
    expect(ugm.getNode("r0")?.properties.label).toBe("");
    expect(ugm.getNode("r1")?.properties.mass).toBe("42");
  });

  it("adapts an error result to an empty grid", () => {
    const ugm = sparqlResultUgm({ ok: false, error: "parse error" });
    expect(ugm.getNodeIds()).toHaveLength(0);
  });
});
