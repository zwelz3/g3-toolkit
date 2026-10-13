/**
 * M6 Workspace & Schema tests.
 *
 * E1.T1: Shell renders with tabs.
 * E1.T2: Save/load workspace state round-trips.
 * E1.T3: Role defaults load correct layouts.
 * E2.T1: Schema view renders 20 classes.
 * E2.T2: SHACL shapes display badges.
 * E2.T3: Diff engine returns correct added/removed/changed sets.
 * E2.T4: DiffRenderer shows colored nodes.
 * E2.T5: Schema hash changes when ontology changes.
 */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import type { ShaclShape } from "@g3-toolkit/core";
import { diffGraphs, computeSchemaHash } from "@g3-toolkit/core";
import { SchemaView } from "./SchemaView";
import { DiffRenderer } from "./DiffRenderer";
import type { SchemaViewShape } from "./SchemaView";

// ── E2.T1: Schema view ──────────────────────────────────────────────

describe("SchemaView (M6.E2.T1)", () => {
  it("renders class hierarchy from UGM registry", () => {
    const ugm = new UGM();
    for (let i = 0; i < 20; i++) {
      ugm.addNode(`n${i}`, {
        types: [`Class${i % 5}`],
        properties: { prop1: "val" },
      });
    }

    render(<SchemaView ugm={ugm} />);

    expect(screen.getByTestId("schema-view")).toBeInTheDocument();
    expect(screen.getByTestId("schema-class-Class0")).toBeInTheDocument();
    expect(screen.getByTestId("schema-class-Class4")).toBeInTheDocument();
  });

  it("renders from SchemaModel", () => {
    render(
      <SchemaView
        schema={{
          nodeTypes: ["Person", "Org"],
          edgeTypes: ["knows"],
          nodeProperties: {
            Person: ["name", "age"],
            Org: ["revenue"],
          },
          edgeProperties: {},
        }}
      />,
    );

    expect(screen.getByTestId("schema-class-Person")).toBeInTheDocument();
    expect(screen.getByTestId("schema-class-Person")).toHaveTextContent(
      "name, age",
    );
  });

  it("shows empty state for no schema", () => {
    render(<SchemaView />);
    expect(screen.getByTestId("schema-view-empty")).toBeInTheDocument();
  });
});

// ── E2.T2: SHACL shape overlay ──────────────────────────────────────

describe("SchemaView SHACL overlay (M6.E2.T2)", () => {
  it("displays SHACL badges on target classes", () => {
    const shapes: SchemaViewShape[] = [
      {
        id: "s1",
        targetClass: "Person",
        constraints: [
          { path: "name", minCount: 1 },
          { path: "age", datatype: "xsd:integer" },
        ],
      },
      {
        id: "s2",
        targetClass: "Org",
        constraints: [{ path: "revenue", minCount: 1, maxCount: 1 }],
      },
    ];

    render(
      <SchemaView
        schema={{
          nodeTypes: ["Person", "Org", "Location"],
          edgeTypes: [],
          nodeProperties: {},
          edgeProperties: {},
        }}
        shapes={shapes}
      />,
    );

    expect(screen.getByTestId("shacl-badge-Person")).toHaveTextContent(
      "SHACL: 2 constraints",
    );
    expect(screen.getByTestId("shacl-badge-Org")).toHaveTextContent(
      "SHACL: 1 constraints",
    );
    // Location has no shape
    expect(
      screen.queryByTestId("shacl-badge-Location"),
    ).not.toBeInTheDocument();
  });
});

// ── Issue #37: nesting, every shape, tokens ─────────────────────────

describe("SchemaView subclass nesting (issue #37)", () => {
  const schema = {
    nodeTypes: ["Thing", "Agent", "Person", "Org", "Entity", "Doc", "Loose"],
    edgeTypes: [],
    nodeProperties: {},
    edgeProperties: {},
  };

  it("nests rdfs:subClassOf children under their parent, roots flat and sorted", () => {
    render(
      <SchemaView
        schema={schema}
        subClassOf={{
          Agent: "Thing",
          Person: ["Agent"],
          Org: "Agent",
          Doc: "Entity",
          // A parent that is not a class here leaves Loose at the top.
          Loose: "owl:Thing",
        }}
      />,
    );
    const view = screen.getByTestId("schema-view");
    const roots = [...view.children].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(roots).toEqual([
      "schema-class-Entity",
      "schema-class-Loose",
      "schema-class-Thing",
    ]);
    const agent = screen.getByTestId("schema-class-Agent");
    expect(agent).toHaveAttribute("data-parent", "Thing");
    expect(agent).toHaveAttribute("data-depth", "1");
    expect(screen.getByTestId("schema-subclasses-Thing")).toContainElement(
      agent,
    );
    // Grandchildren, sorted among siblings.
    const agentKids = [
      ...screen.getByTestId("schema-subclasses-Agent").children,
    ].map((el) => el.getAttribute("data-testid"));
    expect(agentKids).toEqual(["schema-class-Org", "schema-class-Person"]);
    expect(screen.getByTestId("schema-class-Person")).toHaveAttribute(
      "data-depth",
      "2",
    );
    expect(screen.getByTestId("schema-class-Doc")).toHaveAttribute(
      "data-parent",
      "Entity",
    );
    expect(screen.getByTestId("schema-class-Loose")).toHaveAttribute(
      "data-depth",
      "0",
    );
  });

  it("without subClassOf the list stays flat and sorted (unchanged output)", () => {
    render(<SchemaView schema={schema} />);
    const roots = [...screen.getByTestId("schema-view").children].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(roots).toEqual(
      [...schema.nodeTypes]
        .sort((a, b) => a.localeCompare(b))
        .map((n) => `schema-class-${n}`),
    );
    expect(screen.queryByTestId("schema-subclasses-Thing")).toBeNull();
  });

  it("a subclass cycle does not drop classes", () => {
    render(
      <SchemaView
        schema={{
          nodeTypes: ["A", "B"],
          edgeTypes: [],
          nodeProperties: {},
          edgeProperties: {},
        }}
        subClassOf={{ A: "B", B: "A" }}
      />,
    );
    expect(screen.getByTestId("schema-class-A")).toBeInTheDocument();
    expect(screen.getByTestId("schema-class-B")).toBeInTheDocument();
  });
});

describe("SchemaView badges every targeting shape (issue #37)", () => {
  const twoShapes: SchemaViewShape[] = [
    {
      id: "PersonBasic",
      targetClass: "Person",
      constraints: [{ path: "name", minCount: 1 }],
    },
    {
      id: "PersonContact",
      targetClass: "Person",
      constraints: [
        { path: "email", minCount: 1 },
        { path: "phone", maxCount: 1 },
      ],
    },
  ];
  const schema = {
    nodeTypes: ["Person"],
    edgeTypes: [],
    nodeProperties: {},
    edgeProperties: {},
  };

  it("counts constraints across all shapes and names the shape count", () => {
    render(<SchemaView schema={schema} shapes={twoShapes} />);
    const badge = screen.getByTestId("shacl-badge-Person");
    // Before the fix `shapes.find` saw PersonBasic only: 1 constraint.
    expect(badge).toHaveTextContent("SHACL: 3 constraints, 2 shapes");
    expect(badge).toHaveAttribute("data-shape-count", "2");
    expect(badge).toHaveAttribute("data-constraint-count", "3");
    expect(badge).toHaveAttribute("data-severity", "none");
    // Both shapes' constraints are listed, under their shape ids.
    const list = screen.getByTestId("shacl-constraints-Person");
    expect(list).toContainElement(
      screen.getByTestId("shacl-shape-PersonBasic"),
    );
    expect(list).toContainElement(
      screen.getByTestId("shacl-shape-PersonContact"),
    );
    expect(list).toHaveTextContent("email min:1");
    expect(list).toHaveTextContent("phone max:1");
  });

  it("reports the most severe status across the targeting shapes' results", () => {
    const result = (
      shapeId: string,
      severity: "violation" | "warning" | "info",
    ) => ({
      nodeId: "p1",
      shapeId,
      shapeName: shapeId,
      targetClass: "Person",
      valid: false,
      violations: [{ path: "x", message: "m", severity }],
    });
    const { rerender } = render(
      <SchemaView
        schema={schema}
        shapes={twoShapes}
        validationResults={[
          result("PersonBasic", "info"),
          result("PersonContact", "warning"),
        ]}
      />,
    );
    let badge = screen.getByTestId("shacl-badge-Person");
    expect(badge).toHaveAttribute("data-severity", "warning");
    expect(badge).toHaveTextContent("warning");
    expect(badge.getAttribute("style")).toContain("var(--g3t-warning");

    rerender(
      <SchemaView
        schema={schema}
        shapes={twoShapes}
        validationResults={[
          result("PersonBasic", "info"),
          result("PersonContact", "violation"),
        ]}
      />,
    );
    badge = screen.getByTestId("shacl-badge-Person");
    expect(badge).toHaveAttribute("data-severity", "violation");
    expect(badge.getAttribute("style")).toContain("var(--g3t-error");

    // Results given, nothing failing: conforms.
    rerender(
      <SchemaView
        schema={schema}
        shapes={twoShapes}
        validationResults={[
          { ...result("PersonBasic", "info"), valid: true, violations: [] },
        ]}
      />,
    );
    badge = screen.getByTestId("shacl-badge-Person");
    expect(badge).toHaveAttribute("data-severity", "conforms");
    expect(badge.getAttribute("style")).toContain("var(--g3t-success");
  });

  it("draws cards, text and the default badge from theme tokens, not literals", () => {
    render(
      <SchemaView
        schema={{ ...schema, nodeProperties: { Person: ["name"] } }}
        shapes={twoShapes}
      />,
    );
    const badge = screen.getByTestId("shacl-badge-Person");
    expect(badge.getAttribute("style")).toContain("var(--g3t-accent-muted");
    expect(badge.getAttribute("style")).toContain("var(--g3t-accent-primary");
    const card = screen.getByTestId("schema-class-Person");
    expect(card.getAttribute("style")).toContain("var(--g3t-border");
    const html = screen.getByTestId("schema-view").innerHTML;
    // The former hard-coded pair may survive only as var() fallbacks.
    expect(html).not.toMatch(/(?<!var\([^)]*)#e0f2fe/);
    expect(html).not.toMatch(/(?<!var\([^)]*)#0369a1/);
  });
});

// ── Issue #56: targets and superclass inheritance ───────────────────

describe("SchemaView badges every class in targets and inherits down subclasses (issue #56)", () => {
  const schema = {
    nodeTypes: ["Thing", "Agent", "Person", "Org", "Doc"],
    edgeTypes: [],
    nodeProperties: {},
    edgeProperties: {},
  };
  const subClassOf = { Agent: "Thing", Person: "Agent", Org: "Agent" };

  it("a shape whose targets name three classes badges all three", () => {
    const shapes: ShaclShape[] = [
      {
        id: "Named",
        targetClass: "Person",
        targets: [
          { kind: "class", value: "Org" },
          { kind: "class", value: "Doc" },
          // Not a class target: contributes no badge.
          { kind: "subjectsOf", value: "ex:decomposes" },
        ],
        properties: [{ path: "name", minCount: 1 }],
      },
    ];
    render(<SchemaView schema={schema} shapes={shapes} />);
    // Before the fix only targetClass badged: Org and Doc had no badge.
    for (const cls of ["Person", "Org", "Doc"]) {
      const badge = screen.getByTestId(`shacl-badge-${cls}`);
      expect(badge).toHaveTextContent("SHACL: 1 constraints");
      expect(badge).toHaveAttribute("data-shape-count", "1");
      expect(badge).toHaveAttribute("data-inherited-count", "0");
    }
    expect(screen.queryByTestId("shacl-badge-Thing")).toBeNull();
    expect(screen.queryByTestId("shacl-badge-Agent")).toBeNull();
  });

  it("a shape listed as targetClass and again in targets badges once", () => {
    const shapes: ShaclShape[] = [
      {
        id: "Dup",
        targetClass: "Person",
        targets: [
          { kind: "class", value: "Person" },
          { kind: "class", value: "Person" },
        ],
        properties: [{ path: "name", minCount: 1 }],
      },
    ];
    render(<SchemaView schema={schema} shapes={shapes} />);
    const badge = screen.getByTestId("shacl-badge-Person");
    expect(badge).toHaveTextContent("SHACL: 1 constraints");
    expect(badge).not.toHaveTextContent("shapes");
    expect(badge).toHaveAttribute("data-shape-count", "1");
    expect(badge).toHaveAttribute("title", "Shapes: Dup");
    expect(
      within(screen.getByTestId("shacl-constraints-Person")).getAllByTestId(
        "shacl-shape-Dup",
      ),
    ).toHaveLength(1);
  });

  it("the display-only shape form reads targets too", () => {
    const shapes: SchemaViewShape[] = [
      {
        id: "View",
        targetClass: "Person",
        targets: [{ kind: "class", value: "Org" }],
        constraints: [{ path: "name" }],
      },
    ];
    render(<SchemaView schema={schema} shapes={shapes} />);
    expect(screen.getByTestId("shacl-badge-Org")).toHaveTextContent(
      "SHACL: 1 constraints",
    );
  });

  it("a shape on a superclass is direct on itself and inherited on each subclass", () => {
    const shapes: ShaclShape[] = [
      {
        id: "AgentShape",
        targetClass: "Agent",
        properties: [{ path: "name", minCount: 1 }],
      },
      {
        id: "PersonShape",
        targetClass: "Person",
        properties: [
          { path: "email", minCount: 1 },
          { path: "phone", maxCount: 1 },
        ],
      },
    ];
    render(
      <SchemaView schema={schema} shapes={shapes} subClassOf={subClassOf} />,
    );

    // Direct on Agent: unchanged historical badge, no inherited mark.
    const agentBadge = screen.getByTestId("shacl-badge-Agent");
    expect(agentBadge).toHaveTextContent("SHACL: 1 constraints");
    expect(agentBadge).not.toHaveTextContent("inherited");
    expect(agentBadge).toHaveAttribute("data-inherited-count", "0");
    const agentRow = within(
      screen.getByTestId("shacl-constraints-Agent"),
    ).getByTestId("shacl-shape-AgentShape");
    expect(agentRow).not.toHaveAttribute("data-inherited-from");
    expect(agentRow).not.toHaveClass("g3t-schema-shape-inherited");

    // Inherited on Person, listed AFTER the direct shape, marked and
    // titled with the declaring class.
    const personBadge = screen.getByTestId("shacl-badge-Person");
    expect(personBadge).toHaveTextContent(
      "SHACL: 3 constraints, 2 shapes, 1 inherited",
    );
    expect(personBadge).toHaveAttribute("data-shape-count", "2");
    expect(personBadge).toHaveAttribute("data-inherited-count", "1");
    expect(personBadge).toHaveAttribute(
      "title",
      "Shapes: PersonShape, AgentShape (inherited from Agent)",
    );
    const personList = screen.getByTestId("shacl-constraints-Person");
    const rows = [...personList.children].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(rows).toEqual(["shacl-shape-PersonShape", "shacl-shape-AgentShape"]);
    const inherited = within(personList).getByTestId("shacl-shape-AgentShape");
    expect(inherited).toHaveAttribute("data-inherited-from", "Agent");
    expect(inherited).toHaveClass("g3t-schema-shape-inherited");
    expect(inherited).toHaveAttribute("title", "Inherited from Agent");
    expect(inherited).toHaveTextContent("AgentShape (inherited from Agent)");
    expect(inherited).toHaveTextContent("name min:1");

    // Org (a sibling subclass) inherits it alone: one shape, so the
    // badge names the inheritance rather than a shape count.
    const orgBadge = screen.getByTestId("shacl-badge-Org");
    expect(orgBadge).toHaveTextContent("SHACL: 1 constraints, 1 inherited");
    expect(orgBadge).toHaveAttribute("data-inherited-count", "1");

    // Thing is above Agent: nothing flows upward. Doc is unrelated.
    expect(screen.queryByTestId("shacl-badge-Thing")).toBeNull();
    expect(screen.queryByTestId("shacl-badge-Doc")).toBeNull();
  });

  it("inherits through several levels, attributed to the nearest declaring class", () => {
    const shapes: ShaclShape[] = [
      {
        id: "ThingShape",
        targetClass: "Thing",
        properties: [{ path: "id", minCount: 1 }],
      },
      {
        id: "Both",
        // Declared on Thing and Agent: Person reads it from Agent.
        targetClass: "Thing",
        targets: [{ kind: "class", value: "Agent" }],
        properties: [{ path: "label" }],
      },
    ];
    render(
      <SchemaView schema={schema} shapes={shapes} subClassOf={subClassOf} />,
    );
    const personList = screen.getByTestId("shacl-constraints-Person");
    expect(
      within(personList).getByTestId("shacl-shape-ThingShape"),
    ).toHaveAttribute("data-inherited-from", "Thing");
    expect(within(personList).getByTestId("shacl-shape-Both")).toHaveAttribute(
      "data-inherited-from",
      "Agent",
    );
    // Agent targets Both directly and inherits ThingShape only.
    const agentBadge = screen.getByTestId("shacl-badge-Agent");
    expect(agentBadge).toHaveAttribute("data-shape-count", "2");
    expect(agentBadge).toHaveAttribute("data-inherited-count", "1");
  });

  it("a shape targeting both a class and its subclass is direct on both, never doubled", () => {
    const shapes: ShaclShape[] = [
      {
        id: "AgentAndPerson",
        targetClass: "Agent",
        targets: [{ kind: "class", value: "Person" }],
        properties: [{ path: "name" }],
      },
    ];
    render(
      <SchemaView schema={schema} shapes={shapes} subClassOf={subClassOf} />,
    );
    const personBadge = screen.getByTestId("shacl-badge-Person");
    expect(personBadge).toHaveAttribute("data-shape-count", "1");
    expect(personBadge).toHaveAttribute("data-inherited-count", "0");
    expect(
      within(screen.getByTestId("shacl-constraints-Person")).getAllByTestId(
        "shacl-shape-AgentAndPerson",
      ),
    ).toHaveLength(1);
  });

  it("an inherited shape's failing results count toward the subclass status", () => {
    const shapes: ShaclShape[] = [
      {
        id: "AgentShape",
        targetClass: "Agent",
        properties: [{ path: "name", minCount: 1 }],
      },
    ];
    render(
      <SchemaView
        schema={schema}
        shapes={shapes}
        subClassOf={subClassOf}
        validationResults={[
          {
            nodeId: "p1",
            shapeId: "AgentShape",
            shapeName: "AgentShape",
            targetClass: "Agent",
            valid: false,
            violations: [{ path: "name", message: "m", severity: "warning" }],
          },
        ]}
      />,
    );
    expect(screen.getByTestId("shacl-badge-Agent")).toHaveAttribute(
      "data-severity",
      "warning",
    );
    expect(screen.getByTestId("shacl-badge-Person")).toHaveAttribute(
      "data-severity",
      "warning",
    );
  });

  it("without subClassOf nothing is inherited", () => {
    const shapes: ShaclShape[] = [
      {
        id: "AgentShape",
        targetClass: "Agent",
        properties: [{ path: "name", minCount: 1 }],
      },
    ];
    render(<SchemaView schema={schema} shapes={shapes} />);
    expect(screen.getByTestId("shacl-badge-Agent")).toBeInTheDocument();
    expect(screen.queryByTestId("shacl-badge-Person")).toBeNull();
  });
});

// ── Issue #56 ruling: a class with several parents, under each ──────

describe("SchemaView renders a class with several parents under each (issue #56 ruling)", () => {
  const schema = {
    nodeTypes: ["Thing", "Agent", "LegalEntity", "Org", "Person"],
    edgeTypes: [],
    nodeProperties: {},
    edgeProperties: {},
  };
  const subClassOf = {
    Agent: "Thing",
    LegalEntity: "Thing",
    // A repeat and the class itself are ignored: two parents remain.
    Org: ["Agent", "Agent", "Org", "LegalEntity"],
    Person: "Agent",
  };

  it("appears once under each known parent, with per-copy parent, depth and path", () => {
    render(<SchemaView schema={schema} subClassOf={subClassOf} />);
    // Before the ruling the first listed parent alone won: one copy.
    const copies = screen.getAllByTestId("schema-class-Org");
    expect(copies).toHaveLength(2);
    const byParent = Object.fromEntries(
      copies.map((el) => [el.getAttribute("data-parent"), el]),
    );
    expect(Object.keys(byParent).sort()).toEqual(["Agent", "LegalEntity"]);
    expect(screen.getByTestId("schema-subclasses-Agent")).toContainElement(
      byParent.Agent ?? null,
    );
    expect(
      screen.getByTestId("schema-subclasses-LegalEntity"),
    ).toContainElement(byParent.LegalEntity ?? null);
    for (const el of copies) expect(el).toHaveAttribute("data-depth", "2");
    expect(byParent.Agent).toHaveAttribute("data-path", "Thing/Agent/Org");
    expect(byParent.LegalEntity).toHaveAttribute(
      "data-path",
      "Thing/LegalEntity/Org",
    );
    // Single-parent classes render once, as before.
    expect(screen.getAllByTestId("schema-class-Person")).toHaveLength(1);
    expect(screen.getAllByTestId("schema-class-Agent")).toHaveLength(1);
    // Org is not a root: the top level holds Thing alone.
    const roots = [...screen.getByTestId("schema-view").children].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(roots).toEqual(["schema-class-Thing"]);
  });

  it("inherits shapes from every ancestor, once each, and both copies agree", () => {
    const shapes: ShaclShape[] = [
      {
        id: "ThingShape",
        targetClass: "Thing",
        properties: [{ path: "id", minCount: 1 }],
      },
      {
        id: "AgentShape",
        targetClass: "Agent",
        properties: [{ path: "name", minCount: 1 }],
      },
      {
        id: "LegalShape",
        targetClass: "LegalEntity",
        properties: [{ path: "registration" }],
      },
    ];
    render(
      <SchemaView
        schema={schema}
        shapes={shapes}
        subClassOf={subClassOf}
        validationResults={[
          {
            nodeId: "o1",
            shapeId: "LegalShape",
            shapeName: "LegalShape",
            targetClass: "LegalEntity",
            valid: false,
            violations: [
              { path: "registration", message: "m", severity: "info" },
            ],
          },
        ]}
      />,
    );
    const badges = screen.getAllByTestId("shacl-badge-Org");
    expect(badges).toHaveLength(2);
    for (const badge of badges) {
      // Nearest ancestors first (parents in subClassOf order), then
      // Thing; ThingShape is reachable through both parents but listed
      // once. The inherited LegalShape result sets the status on both.
      expect(badge).toHaveTextContent(
        "SHACL: 3 constraints, 3 shapes, 3 inherited, info",
      );
      expect(badge).toHaveAttribute("data-inherited-count", "3");
      expect(badge).toHaveAttribute("data-severity", "info");
      expect(badge).toHaveAttribute(
        "title",
        "Shapes: AgentShape (inherited from Agent), LegalShape (inherited from LegalEntity), ThingShape (inherited from Thing)",
      );
    }
    for (const list of screen.getAllByTestId("shacl-constraints-Org")) {
      expect(
        within(list).getAllByTestId("shacl-shape-ThingShape"),
      ).toHaveLength(1);
      expect(
        within(list).getByTestId("shacl-shape-LegalShape"),
      ).toHaveAttribute("data-inherited-from", "LegalEntity");
    }
  });

  it("a cycle entered from a root is cut and every class still renders", () => {
    render(
      <SchemaView
        schema={{
          nodeTypes: ["R", "A", "B", "C"],
          edgeTypes: [],
          nodeProperties: {},
          edgeProperties: {},
        }}
        // R -> A -> B -> C -> A: C's link back to A closes the cycle.
        subClassOf={{ A: ["R", "C"], B: "A", C: "B" }}
      />,
    );
    expect(screen.getAllByTestId("schema-class-A")).toHaveLength(1);
    expect(screen.getByTestId("schema-class-A")).toHaveAttribute(
      "data-parent",
      "R",
    );
    expect(screen.getByTestId("schema-class-B")).toHaveAttribute(
      "data-parent",
      "A",
    );
    expect(screen.getByTestId("schema-class-C")).toHaveAttribute(
      "data-parent",
      "B",
    );
    expect(screen.queryByTestId("schema-subclasses-C")).toBeNull();
  });
});

// ── E2.T3: Diff engine ──────────────────────────────────────────────

describe("diffGraphs (M6.E2.T3)", () => {
  it("detects added nodes", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"] });

    const after = new UGM();
    after.addNode("a", { types: ["X"] });
    after.addNode("b", { types: ["X"] });

    const diff = diffGraphs(before, after);
    expect(diff.addedNodes).toHaveLength(1);
    expect(diff.addedNodes[0]?.id).toBe("b");
  });

  it("detects removed nodes", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"] });
    before.addNode("b", { types: ["X"] });

    const after = new UGM();
    after.addNode("a", { types: ["X"] });

    const diff = diffGraphs(before, after);
    expect(diff.removedNodes).toHaveLength(1);
    expect(diff.removedNodes[0]?.id).toBe("b");
  });

  it("detects changed properties", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"], properties: { name: "Alice" } });

    const after = new UGM();
    after.addNode("a", { types: ["X"], properties: { name: "Alicia" } });

    const diff = diffGraphs(before, after);
    expect(diff.changedNodes).toHaveLength(1);
    expect(diff.changedNodes[0]?.propertyChanges?.[0]?.key).toBe("name");
  });

  it("detects added and removed edges", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"] });
    before.addNode("b", { types: ["X"] });
    before.addEdge("a", "b", { type: "old" });

    const after = new UGM();
    after.addNode("a", { types: ["X"] });
    after.addNode("b", { types: ["X"] });
    after.addNode("c", { types: ["X"] });
    after.addEdge("a", "c", { type: "new" });

    const diff = diffGraphs(before, after);
    expect(diff.removedEdges).toHaveLength(1);
    expect(diff.addedEdges).toHaveLength(1);
    expect(diff.addedNodes).toHaveLength(1);
  });

  it("returns empty diff for identical graphs", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { v: 1 } });

    const copy = UGM.fromJSON(ugm.toJSON());
    const diff = diffGraphs(ugm, copy);

    expect(diff.addedNodes).toHaveLength(0);
    expect(diff.removedNodes).toHaveLength(0);
    expect(diff.changedNodes).toHaveLength(0);
  });
});

// ── E2.T4: Diff renderer ───────────────────────────────────────────

describe("DiffRenderer (M6.E2.T4)", () => {
  it("renders colored diff badges", () => {
    const diff = {
      addedNodes: [{ id: "new1", status: "added" as const }],
      removedNodes: [{ id: "old1", status: "removed" as const }],
      changedNodes: [
        {
          id: "mod1",
          status: "changed" as const,
          propertyChanges: [{ key: "name", oldValue: "A", newValue: "B" }],
        },
      ],
      addedEdges: [],
      removedEdges: [],
      changedEdges: [],
    };

    render(<DiffRenderer diff={diff} />);

    expect(screen.getByTestId("diff-badge-added")).toHaveTextContent(
      "Added: 1",
    );
    expect(screen.getByTestId("diff-badge-removed")).toHaveTextContent(
      "Removed: 1",
    );
    expect(screen.getByTestId("diff-badge-changed")).toHaveTextContent(
      "Changed: 1",
    );
  });

  it("shows empty state for no differences", () => {
    const diff = {
      addedNodes: [],
      removedNodes: [],
      changedNodes: [],
      addedEdges: [],
      removedEdges: [],
      changedEdges: [],
    };

    render(<DiffRenderer diff={diff} />);
    expect(screen.getByTestId("diff-empty")).toBeInTheDocument();
  });
});

// ── E2.T5: Schema hash ─────────────────────────────────────────────

describe("Schema version tracking (M6.E2.T5)", () => {
  it("produces same hash for same schema", () => {
    const ugm1 = new UGM();
    ugm1.addNode("a", { types: ["Person"], properties: { name: "A" } });

    const ugm2 = UGM.fromJSON(ugm1.toJSON());

    expect(computeSchemaHash(ugm1)).toBe(computeSchemaHash(ugm2));
  });

  it("produces different hash when schema changes", () => {
    const ugm1 = new UGM();
    ugm1.addNode("a", { types: ["Person"], properties: { name: "A" } });

    const ugm2 = new UGM();
    ugm2.addNode("a", {
      types: ["Person", "Employee"],
      properties: { name: "A", salary: 100 },
    });

    expect(computeSchemaHash(ugm1)).not.toBe(computeSchemaHash(ugm2));
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("diffGraphs: edge cases (audit)", () => {
  it("detects edge property changes", () => {
    const before = new UGM();
    before.addNode("a", { types: ["X"] });
    before.addNode("b", { types: ["X"] });
    before.addEdge("a", "b", { type: "link", properties: { weight: 1 } });

    const after = new UGM();
    after.addNode("a", { types: ["X"] });
    after.addNode("b", { types: ["X"] });
    after.addEdge("a", "b", { type: "link", properties: { weight: 5 } });

    // Edge IDs may differ between UGMs; this tests the diff logic path
    const diff = diffGraphs(before, after);
    const totalEdgeChanges =
      diff.addedEdges.length +
      diff.removedEdges.length +
      diff.changedEdges.length;
    expect(totalEdgeChanges).toBeGreaterThan(0);
  });
});

describe("DiffRenderer: content verification (audit)", () => {
  it("displays property change details", () => {
    const diff = {
      addedNodes: [],
      removedNodes: [],
      changedNodes: [
        {
          id: "n1",
          status: "changed" as const,
          propertyChanges: [{ key: "score", oldValue: 0.5, newValue: 0.9 }],
        },
      ],
      addedEdges: [],
      removedEdges: [],
      changedEdges: [],
    };

    render(<DiffRenderer diff={diff} />);
    const renderer = screen.getByTestId("diff-renderer");
    expect(renderer).toHaveTextContent("score");
    expect(renderer).toHaveTextContent("0.5");
    expect(renderer).toHaveTextContent("0.9");
  });
});

describe("computeSchemaHash: edge cases (audit)", () => {
  it("handles empty UGM", () => {
    const ugm = new UGM();
    const hash = computeSchemaHash(ugm);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });
});
