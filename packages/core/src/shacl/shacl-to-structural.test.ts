/**
 * SHACL shape graph -> structural input (slice B3).
 *
 * @see roadmap/design/shacl-views.md
 * @see specs/01-functional-views.md R1.16
 */
import { describe, it, expect } from "vitest";
import type { ShaclShape, ShaclValidationResult } from "./shacl-validator";
import {
  shaclShapesToStructural,
  shaclRowSeverities,
  closedShapeIds,
  propertyRowText,
  cardinalitySuffix,
  valueConstraintCount,
  shaclRowId,
} from "./shacl-to-structural";

function shapeFixture(): ShaclShape[] {
  return [
    {
      id: "PersonShape",
      targetClass: "Person",
      name: "Person",
      closed: true,
      properties: [
        { path: "name", datatype: "string", minCount: 1, maxCount: 1 },
        { path: "age", datatype: "number", minInclusive: 0 },
        {
          path: "email",
          datatype: "string",
          pattern: "^.+@.+$",
          minCount: 0,
        },
      ],
    },
    {
      id: "OrgShape",
      targetClass: "Org",
      properties: [{ path: "legalName", datatype: "string", minCount: 1 }],
    },
  ];
}

describe("propertyRowText", () => {
  it("renders path : type [min..max]", () => {
    expect(
      propertyRowText({
        path: "name",
        datatype: "string",
        minCount: 1,
        maxCount: 1,
      }),
    ).toBe("name : xsd:string [1..1]");
  });

  it("uses the constraint name when present", () => {
    expect(
      propertyRowText({ path: "ex:n", name: "fullName", datatype: "string" }),
    ).toBe("fullName : xsd:string [0..*]");
  });

  it("appends a constraint chip for value constraints", () => {
    expect(
      propertyRowText({ path: "email", datatype: "string", pattern: "x" }),
    ).toBe("email : xsd:string [0..*] (+1)");
  });

  it("omits the type when there is no datatype", () => {
    expect(propertyRowText({ path: "knows", minCount: 1 })).toBe(
      "knows [1..*]",
    );
  });
});

describe("cardinalitySuffix / valueConstraintCount", () => {
  it("defaults absent counts to [0..*]", () => {
    expect(cardinalitySuffix({ path: "p" })).toBe("[0..*]");
  });
  it("renders a bounded range", () => {
    expect(cardinalitySuffix({ path: "p", minCount: 1, maxCount: 3 })).toBe(
      "[1..3]",
    );
  });
  it("counts each value constraint once", () => {
    expect(
      valueConstraintCount({
        path: "p",
        pattern: "x",
        in: [1, 2],
        minInclusive: 0,
      }),
    ).toBe(3);
  });
});

describe("shaclShapesToStructural", () => {
  it("maps each shape to a «NodeShape» container with a constraints compartment", () => {
    const input = shaclShapesToStructural(shapeFixture());
    expect(input.nodes).toHaveLength(2);
    const person = input.nodes.find((n) => n.id === "PersonShape")!;
    expect(person.header).toEqual({
      stereotype: "NodeShape",
      name: "Person",
    });
    expect(person.compartments).toHaveLength(1);
    expect(person.compartments![0]!.id).toBe("properties");
    expect(person.compartments![0]!.rows.map((r) => r.id)).toEqual([
      shaclRowId("PersonShape", "name"),
      shaclRowId("PersonShape", "age"),
      shaclRowId("PersonShape", "email"),
    ]);
  });

  it("falls back to the shape id when no name is given", () => {
    const input = shaclShapesToStructural(shapeFixture());
    const org = input.nodes.find((n) => n.id === "OrgShape")!;
    expect(org.header!.name).toBe("OrgShape");
  });

  it("emits reference edges from a references map", () => {
    const input = shaclShapesToStructural(shapeFixture(), {
      references: { "PersonShape::worksFor": "OrgShape" },
    });
    expect(input.edges).toHaveLength(1);
    expect(input.edges[0]!.source).toBe("PersonShape");
    expect(input.edges[0]!.target).toBe("OrgShape");
    // The edge is labeled with the property path carrying sh:node.
    expect(input.edges[0]!.label).toBe("worksFor");
  });

  it("emits no edges without a references map", () => {
    expect(shaclShapesToStructural(shapeFixture()).edges).toEqual([]);
  });
});

describe("closedShapeIds", () => {
  it("collects only closed shapes", () => {
    const ids = closedShapeIds(shapeFixture());
    expect([...ids]).toEqual(["PersonShape"]);
  });
});

describe("shaclRowSeverities", () => {
  it("maps results onto rows with worst-severity-wins", () => {
    const results: ShaclValidationResult[] = [
      {
        nodeId: "p1",
        shapeId: "PersonShape",
        shapeName: "Person",
        targetClass: "Person",
        valid: false,
        violations: [
          { path: "name", message: "missing", severity: "violation" },
          { path: "age", message: "low", severity: "warning" },
        ],
      },
      {
        nodeId: "p2",
        shapeId: "PersonShape",
        shapeName: "Person",
        targetClass: "Person",
        valid: false,
        violations: [
          // A second, milder result on name must NOT downgrade it.
          { path: "name", message: "info", severity: "info" },
        ],
      },
    ];
    const sev = shaclRowSeverities(results);
    expect(sev.get(shaclRowId("PersonShape", "name"))).toBe("violation");
    expect(sev.get(shaclRowId("PersonShape", "age"))).toBe("warning");
    expect(sev.has(shaclRowId("PersonShape", "email"))).toBe(false);
  });

  it("returns an empty map for no results", () => {
    expect(shaclRowSeverities([]).size).toBe(0);
  });
});
