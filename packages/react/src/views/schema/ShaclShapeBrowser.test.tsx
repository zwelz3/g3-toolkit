/**
 * ShaclShapeBrowser tests (DE.2).
 *
 * Extracted from packages/core/src/shacl/shacl.test.tsx during Phase 4:
 * the ShaclShapeBrowser is a @g3-toolkit/react UI component, so its tests
 * belong here, not in @g3-toolkit/core's test suite.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import {
  validateShacl,
  type ShaclShape,
  type ShaclValidationResult,
} from "@g3-toolkit/core";
import { ShaclShapeBrowser } from "./ShaclShapeBrowser";

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("d1", {
    types: ["Disease"],
    properties: { name: "Hypertension", icd10: "I10", severity: "high" },
  });
  ugm.addNode("d2", {
    types: ["Disease"],
    properties: { name: "Diabetes", icd10: "E11" },
  });
  ugm.addNode("d3", {
    types: ["Disease"],
    properties: { name: "" }, // missing icd10 (violation)
  });
  ugm.addNode("p1", {
    types: ["Drug"],
    properties: { name: "Metformin", phase: 4 },
  });
  ugm.addNode("p2", {
    types: ["Drug"],
    properties: { phase: 3 }, // missing name (violation)
  });
  return ugm;
}

const SHAPES: ShaclShape[] = [
  {
    id: "disease-shape",
    name: "Disease Shape",
    targetClass: "Disease",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      {
        path: "icd10",
        name: "ICD-10 Code",
        datatype: "string",
        minCount: 1,
        pattern: "^[A-Z]\\d",
      },
    ],
  },
  {
    id: "drug-shape",
    name: "Drug Shape",
    targetClass: "Drug",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      {
        path: "phase",
        name: "Trial Phase",
        datatype: "number",
        minInclusive: 1,
        maxInclusive: 4,
      },
    ],
  },
];

describe("ShaclShapeBrowser", () => {
  it("renders all shapes", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    render(<ShaclShapeBrowser shapes={SHAPES} validationResults={results} />);

    expect(screen.getByTestId("shacl-shape-browser")).toBeInTheDocument();
    expect(screen.getByTestId("shape-disease-shape")).toBeInTheDocument();
    expect(screen.getByTestId("shape-drug-shape")).toBeInTheDocument();
  });

  it("shows validation badge", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    render(<ShaclShapeBrowser shapes={SHAPES} validationResults={results} />);

    const diseaseBadge = screen.getByTestId("shape-badge-disease-shape");
    expect(
      diseaseBadge.querySelector('[data-testid="g3t-icon-close"]'),
    ).not.toBeNull(); // failure glyph (shape-redundant, not color-only)
  });

  it("expands shape to show violations", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    render(<ShaclShapeBrowser shapes={SHAPES} validationResults={results} />);

    fireEvent.click(screen.getByTestId("shape-toggle-disease-shape"));
    expect(screen.getByTestId("violation-d3")).toBeInTheDocument();
  });

  it("calls onSelectShape when shape is expanded", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    const onSelect = vi.fn();
    render(
      <ShaclShapeBrowser
        shapes={SHAPES}
        validationResults={results}
        onSelectShape={onSelect}
      />,
    );

    fireEvent.click(screen.getByTestId("shape-toggle-drug-shape"));
    expect(onSelect).toHaveBeenCalledWith("drug-shape");
  });
});

describe("sh:closed indicator", () => {
  it("shows a lock on closed shapes and none on open shapes", () => {
    render(
      <ShaclShapeBrowser
        shapes={[
          {
            id: "Closed",
            targetClass: "A",
            closed: true,
            properties: [],
          },
          { id: "Open", targetClass: "B", properties: [] },
        ]}
        validationResults={[]}
      />,
    );
    const lock = screen.getByTestId("shape-closed-Closed");
    expect(lock.querySelector('[data-testid="g3t-icon-lock"]')).not.toBeNull();
    expect(screen.getByTestId("g3t-icon-lock").getAttribute("aria-label")).toBe(
      "Closed shape",
    );
    expect(screen.queryByTestId("shape-closed-Open")).toBeNull();
  });
});

describe("badge states are always visible (review 3.6)", () => {
  const shapes = [
    {
      id: "http://x.org/sat#PassShape",
      name: "PassShape",
      targetClass: "http://x.org/sat#Pass",
      properties: [{ path: "http://x.org/sat#p", minCount: 1 }],
    },
    {
      id: "http://x.org/sat#FailShape",
      name: "FailShape",
      targetClass: "http://x.org/sat#Fail",
      properties: [{ path: "http://x.org/sat#q", minCount: 1 }],
    },
    {
      id: "http://x.org/sat#IdleShape",
      name: "IdleShape",
      targetClass: "http://x.org/sat#Idle",
      properties: [],
    },
  ];
  const results = [
    {
      nodeId: "n1",
      shapeId: "http://x.org/sat#PassShape",
      shapeName: "PassShape",
      targetClass: "http://x.org/sat#Pass",
      valid: true,
      violations: [],
    },
    {
      nodeId: "n2",
      shapeId: "http://x.org/sat#FailShape",
      shapeName: "FailShape",
      targetClass: "http://x.org/sat#Fail",
      valid: false,
      violations: [
        {
          path: "http://x.org/sat#q",
          message: "missing",
          severity: "violation" as const,
        },
      ],
    },
  ];

  it("renders check, X-with-count, and an explicit not-validated glyph", () => {
    render(<ShaclShapeBrowser shapes={shapes} validationResults={results} />);
    expect(
      screen
        .getByTestId("shape-badge-http://x.org/sat#PassShape")
        .getAttribute("aria-label"),
    ).toBe("All nodes pass");
    const fail = screen.getByTestId("shape-badge-http://x.org/sat#FailShape");
    expect(fail.getAttribute("aria-label")).toBe("1 failing");
    expect(fail.textContent).toContain("1");
    const idle = screen.getByTestId("shape-badge-http://x.org/sat#IdleShape");
    expect(idle.getAttribute("aria-label")).toBe("Not validated");
    expect((idle.textContent ?? "").length).toBeGreaterThan(0);
  });

  it("badges cannot be shrunk out of the row; target IRIs display as local names", () => {
    render(<ShaclShapeBrowser shapes={shapes} validationResults={results} />);
    const fail = screen.getByTestId("shape-badge-http://x.org/sat#FailShape");
    expect(fail.style.flexShrink).toBe("0");
    const header = screen.getByTestId(
      "shape-toggle-http://x.org/sat#FailShape",
    );
    expect(header.textContent).toContain("Fail");
    expect(header.textContent).not.toContain("http://x.org/sat#Fail");
  });
});

// ── Issue #34: keys, theme tokens, severity-aware badge ────────────

function result(
  nodeId: string,
  shapeId: string,
  violations: ShaclValidationResult["violations"],
): ShaclValidationResult {
  return {
    nodeId,
    shapeId,
    shapeName: shapeId,
    targetClass: "T",
    valid: violations.length === 0,
    violations,
  };
}

describe("constraint rows are keyed uniquely (#34.1)", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => errorSpy.mockClear());

  it("renders two constraints on one path without a duplicate-key warning", () => {
    const shape: ShaclShape = {
      id: "QuoteShape",
      targetClass: "Quote",
      properties: [
        { id: "QuoteShape-verified-min", path: "quoteVerified", minCount: 1 },
        {
          path: "quoteVerified",
          datatype: "boolean",
        },
        { path: "quoteVerified", in: [true] },
      ],
    };
    render(<ShaclShapeBrowser shapes={[shape]} validationResults={[]} />);
    fireEvent.click(screen.getByTestId("shape-toggle-QuoteShape"));
    // The id keys the first row; the two id-less rows key by path plus
    // position, so all three render.
    expect(
      screen.getByTestId("constraint-QuoteShape-QuoteShape-verified-min"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("constraint-QuoteShape-quoteVerified#1"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("constraint-QuoteShape-quoteVerified#2"),
    ).toBeInTheDocument();
    const keyWarnings = errorSpy.mock.calls.filter((c) =>
      String(c[0]).includes("same key"),
    );
    expect(keyWarnings).toHaveLength(0);
  });
});

describe("failing-node rows use theme tokens, not light-theme literals (#34.2)", () => {
  it("tints the row by severity through --g3t-* tokens", () => {
    const shape: ShaclShape = { id: "S", targetClass: "T", properties: [] };
    const results = [
      result("n-violation", "S", [
        { path: "p", message: "missing", severity: "violation" },
      ]),
      result("n-warning", "S", [
        { path: "p", message: "odd", severity: "warning" },
      ]),
    ];
    render(<ShaclShapeBrowser shapes={[shape]} validationResults={results} />);
    fireEvent.click(screen.getByTestId("shape-toggle-S"));

    const violationRow = screen.getByTestId("violation-n-violation");
    expect(violationRow.style.background).toContain("var(--g3t-error-muted");
    expect(violationRow.getAttribute("data-severity")).toBe("violation");
    expect(
      (violationRow.firstElementChild as HTMLElement).style.color,
    ).toContain("var(--g3t-error");

    const warningRow = screen.getByTestId("violation-n-warning");
    expect(warningRow.style.background).toContain("var(--g3t-warning-muted");
    expect(warningRow.getAttribute("data-severity")).toBe("warning");

    // No literal from the old palette survives anywhere in the browser.
    const html = screen.getByTestId("shacl-shape-browser").innerHTML;
    for (const literal of ["#fef2f2", "#991b1b", "#b91c1c"]) {
      expect(html).not.toContain(literal);
    }
  });
});

describe("badge color follows the most severe result (#34.3)", () => {
  const shapes: ShaclShape[] = ["V", "W", "I", "M", "P"].map((id) => ({
    id,
    targetClass: "T",
    properties: [],
  }));
  const results = [
    result("v1", "V", [{ path: "p", message: "m", severity: "violation" }]),
    result("w1", "W", [{ path: "p", message: "m", severity: "warning" }]),
    result("w2", "W", [{ path: "p", message: "m", severity: "warning" }]),
    result("i1", "I", [{ path: "p", message: "m", severity: "info" }]),
    // Mixed: one warning node and one violation node -> violation.
    result("m1", "M", [{ path: "p", message: "m", severity: "warning" }]),
    result("m2", "M", [
      { path: "p", message: "m", severity: "info" },
      { path: "q", message: "m", severity: "violation" },
    ]),
    result("p1", "P", []),
  ];

  it("exposes data-severity and uses the matching token and glyph", () => {
    render(<ShaclShapeBrowser shapes={shapes} validationResults={results} />);
    const v = screen.getByTestId("shape-badge-V");
    expect(v.getAttribute("data-severity")).toBe("violation");
    expect(v.style.color).toContain("var(--g3t-error");
    expect(v.querySelector('[data-testid="g3t-icon-close"]')).not.toBeNull();

    const w = screen.getByTestId("shape-badge-W");
    expect(w.getAttribute("data-severity")).toBe("warning");
    expect(w.style.color).toContain("var(--g3t-warning");
    expect(w.style.color).not.toContain("--g3t-error");
    expect(w.querySelector('[data-testid="g3t-icon-warning"]')).not.toBeNull();
    expect(w.getAttribute("aria-label")).toBe("2 failing");

    const i = screen.getByTestId("shape-badge-I");
    expect(i.getAttribute("data-severity")).toBe("info");
    expect(i.style.color).toContain("var(--g3t-accent-primary");
    expect(i.querySelector('[data-testid="g3t-icon-info"]')).not.toBeNull();

    expect(
      screen.getByTestId("shape-badge-M").getAttribute("data-severity"),
    ).toBe("violation");
    // Passing and not-validated badges carry no severity.
    expect(
      screen.getByTestId("shape-badge-P").hasAttribute("data-severity"),
    ).toBe(false);
  });
});

// ── Issue #35: summary, controlled selection, several targets ──────

describe("summary prop takes precedence over counted results (#35)", () => {
  const shape: ShaclShape = { id: "S", targetClass: "T", properties: [] };

  it("uses host focus/failing totals and bySeverity for the badge", () => {
    // Only the one failing result is handed over; the passing focus
    // nodes are NOT materialized as placeholder results.
    const results = [
      result("n1", "S", [{ path: "p", message: "m", severity: "violation" }]),
    ];
    render(
      <ShaclShapeBrowser
        shapes={[shape]}
        validationResults={results}
        summary={{ S: { focus: 10, failing: 2, bySeverity: { warning: 2 } } }}
      />,
    );
    expect(screen.getByTestId("shape-S").textContent).toContain("8/10 pass");
    const badge = screen.getByTestId("shape-badge-S");
    expect(badge.getAttribute("aria-label")).toBe("2 failing");
    expect(badge.textContent).toContain("2");
    // bySeverity wins over the violation in the results.
    expect(badge.getAttribute("data-severity")).toBe("warning");
  });

  it("falls back to the results' severity when bySeverity is absent, and to violation when nothing says", () => {
    const results = [
      result("n1", "S", [{ path: "p", message: "m", severity: "info" }]),
    ];
    const { unmount } = render(
      <ShaclShapeBrowser
        shapes={[shape]}
        validationResults={results}
        summary={{ S: { focus: 3, failing: 1 } }}
      />,
    );
    expect(
      screen.getByTestId("shape-badge-S").getAttribute("data-severity"),
    ).toBe("info");
    unmount();
    render(
      <ShaclShapeBrowser
        shapes={[shape]}
        validationResults={[]}
        summary={{ S: { focus: 3, failing: 1 } }}
      />,
    );
    expect(
      screen.getByTestId("shape-badge-S").getAttribute("data-severity"),
    ).toBe("violation");
  });

  it("shapes without a summary entry still count their results", () => {
    const other: ShaclShape = { id: "O", targetClass: "T", properties: [] };
    const results = [result("o1", "O", []), result("o2", "O", [])];
    render(
      <ShaclShapeBrowser
        shapes={[shape, other]}
        validationResults={results}
        summary={{ S: { focus: 0, failing: 0 } }}
      />,
    );
    // S has a summary entry, so it was validated (0 focus nodes, #55);
    // before #55 this read "Not validated".
    expect(screen.getByTestId("shape-badge-S").getAttribute("aria-label")).toBe(
      "No focus nodes",
    );
    expect(screen.getByTestId("shape-badge-O").getAttribute("aria-label")).toBe(
      "All nodes pass",
    );
    expect(screen.getByTestId("shape-O").textContent).toContain("2/2 pass");
  });
});

// ── Issue #55: a summary entry with 0 focus nodes is validated ─────

describe("badge distinguishes not validated, no focus nodes, and validated (#55)", () => {
  const shapes: ShaclShape[] = ["Idle", "Empty", "Ran"].map((id) => ({
    id,
    targetClass: "T",
    properties: [],
  }));

  it("reads the state from the summary entry when there is one", () => {
    render(
      <ShaclShapeBrowser
        shapes={shapes}
        validationResults={[]}
        summary={{
          Empty: { focus: 0, failing: 0 },
          Ran: { focus: 4, failing: 0 },
        }}
      />,
    );
    // No summary entry and no results: nothing ran.
    const idle = screen.getByTestId("shape-badge-Idle");
    expect(idle.getAttribute("aria-label")).toBe("Not validated");
    expect(idle.getAttribute("data-state")).toBe("not-validated");
    expect(idle.textContent).toBe("—");
    expect(screen.getByTestId("shape-Idle").textContent).not.toContain(
      "focus nodes",
    );

    // Summary says it ran and its targets matched nothing: neutral,
    // with its own glyph, and neither the pass tone nor idle wording.
    const empty = screen.getByTestId("shape-badge-Empty");
    expect(empty.getAttribute("aria-label")).toBe("No focus nodes");
    expect(empty.getAttribute("data-state")).toBe("no-focus-nodes");
    expect(empty.hasAttribute("data-severity")).toBe(false);
    expect(
      empty.querySelector('[data-testid="g3t-icon-minus"]'),
    ).not.toBeNull();
    expect(empty.querySelector('[data-testid="g3t-icon-check"]')).toBeNull();
    expect(empty.style.color).toContain("var(--g3t-text-muted");
    expect(screen.getByTestId("shape-Empty").textContent).toContain(
      "0 focus nodes",
    );

    // Summary with focus nodes and no failures: validated, all pass.
    const ran = screen.getByTestId("shape-badge-Ran");
    expect(ran.getAttribute("aria-label")).toBe("All nodes pass");
    expect(ran.getAttribute("data-state")).toBe("pass");
    expect(ran.querySelector('[data-testid="g3t-icon-check"]')).not.toBeNull();
    expect(screen.getByTestId("shape-Ran").textContent).toContain("4/4 pass");
  });

  it("the expanded panel of a 0-focus shape does not claim a pass", () => {
    render(
      <ShaclShapeBrowser
        shapes={shapes}
        validationResults={[]}
        summary={{ Empty: { focus: 0, failing: 0 } }}
      />,
    );
    fireEvent.click(screen.getByTestId("shape-toggle-Empty"));
    const row = screen.getByTestId("shape-Empty");
    expect(row.textContent).toContain("No focus nodes: the shape's targets");
    expect(row.textContent).not.toContain("pass validation");
  });

  it("the failing badge carries data-state=fail", () => {
    render(
      <ShaclShapeBrowser
        shapes={shapes}
        validationResults={[]}
        summary={{ Ran: { focus: 4, failing: 1 } }}
      />,
    );
    expect(
      screen.getByTestId("shape-badge-Ran").getAttribute("data-state"),
    ).toBe("fail");
  });
});

describe("controlled selection (#35)", () => {
  it("a deep-linked selectedShape renders expanded, and toggles report through onSelectShape", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    const onSelect = vi.fn();
    render(
      <ShaclShapeBrowser
        shapes={SHAPES}
        validationResults={results}
        selectedShape="drug-shape"
        onSelectShape={onSelect}
      />,
    );
    // Expanded without a click: the failing drug node is visible.
    expect(screen.getByTestId("violation-p2")).toBeInTheDocument();
    expect(screen.queryByTestId("violation-d3")).toBeNull();
    expect(
      screen
        .getByTestId("shape-toggle-drug-shape")
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen.getByTestId("shape-drug-shape").getAttribute("data-selected"),
    ).toBe("true");

    // Collapsing the selected shape asks the host to clear; the browser
    // itself does not change until the host does.
    fireEvent.click(screen.getByTestId("shape-toggle-drug-shape"));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("violation-p2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("shape-toggle-disease-shape"));
    expect(onSelect).toHaveBeenLastCalledWith("disease-shape");
    expect(screen.queryByTestId("violation-d3")).toBeNull();
  });

  it("a host that feeds the id back drives expansion", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    function Host() {
      const [sel, setSel] = useState<string | null>(null);
      return (
        <ShaclShapeBrowser
          shapes={SHAPES}
          validationResults={results}
          selectedShape={sel}
          onSelectShape={setSel}
        />
      );
    }
    render(<Host />);
    expect(screen.queryByTestId("violation-d3")).toBeNull();
    fireEvent.click(screen.getByTestId("shape-toggle-disease-shape"));
    expect(screen.getByTestId("violation-d3")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("shape-toggle-drug-shape"));
    expect(screen.queryByTestId("violation-d3")).toBeNull();
    expect(screen.getByTestId("violation-p2")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("shape-toggle-drug-shape"));
    expect(screen.queryByTestId("violation-p2")).toBeNull();
  });

  it("uncontrolled: the original contract holds, no null on collapse", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    const onSelect = vi.fn();
    render(
      <ShaclShapeBrowser
        shapes={SHAPES}
        validationResults={results}
        onSelectShape={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("shape-toggle-drug-shape"));
    fireEvent.click(screen.getByTestId("shape-toggle-drug-shape"));
    expect(screen.queryByTestId("violation-p2")).toBeNull();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("drug-shape");
  });
});

describe("several targets per shape (#35)", () => {
  it("renders every declared target once, targetClass first", () => {
    const shape: ShaclShape = {
      id: "S",
      targetClass: "http://x.org/v#Disease",
      targets: [
        { kind: "class", value: "http://x.org/v#Disease" }, // duplicate
        { kind: "class", value: "http://x.org/v#Disorder" },
        { kind: "subjectsOf", value: "http://x.org/v#icd10" },
        { kind: "objectsOf", value: "http://x.org/v#treats" },
        { kind: "node", value: "http://x.org/v#d1" },
        { kind: "sparql", value: "SELECT ?this WHERE { ?this a ex:X }" },
      ],
      properties: [],
    };
    render(<ShaclShapeBrowser shapes={[shape]} validationResults={[]} />);
    const targets = screen.getByTestId("shape-targets-S");
    expect(targets.textContent).toBe(
      "→ Disease, Disorder, subjects of icd10, objects of treats, node d1, SPARQL target",
    );
    expect(targets.querySelectorAll("[data-target-kind]")).toHaveLength(6);
    expect(targets.querySelectorAll('[data-target-kind="class"]')).toHaveLength(
      2,
    );
    // Full IRIs and the SPARQL body stay reachable on hover.
    expect(targets.getAttribute("title")).toContain(
      "sh:targetClass http://x.org/v#Disease",
    );
    expect(targets.getAttribute("title")).toContain("SELECT ?this");
  });

  it("a shape with only targetClass renders as before", () => {
    render(
      <ShaclShapeBrowser
        shapes={[
          { id: "S", targetClass: "http://x.org/v#Drug", properties: [] },
        ]}
        validationResults={[]}
      />,
    );
    expect(screen.getByTestId("shape-targets-S").textContent).toBe("→ Drug");
  });
});

// ── Issue #54: an empty targetClass is not a target ────────────────

describe("an empty targetClass contributes no target entry (#54)", () => {
  it("a shape targeted only by subjectsOf lists that target alone", () => {
    const shape: ShaclShape = {
      id: "S",
      targetClass: "",
      targets: [{ kind: "subjectsOf", value: "http://x.org/v#decomposes" }],
      properties: [],
    };
    render(<ShaclShapeBrowser shapes={[shape]} validationResults={[]} />);
    const targets = screen.getByTestId("shape-targets-S");
    // Before #54: "→ , subjects of decomposes".
    expect(targets.textContent).toBe("→ subjects of decomposes");
    expect(targets.querySelectorAll("[data-target-kind]")).toHaveLength(1);
    expect(targets.querySelector('[data-target-kind="class"]')).toBeNull();
    expect(targets.getAttribute("title")).toBe(
      "sh:targetSubjectsOf http://x.org/v#decomposes",
    );
  });

  it("a shape with only a SPARQL target reads as that target", () => {
    const shape: ShaclShape = {
      id: "S",
      targetClass: "",
      targets: [
        { kind: "sparql", value: "SELECT ?this WHERE { ?this a ex:X }" },
      ],
      properties: [],
    };
    render(<ShaclShapeBrowser shapes={[shape]} validationResults={[]} />);
    expect(screen.getByTestId("shape-targets-S").textContent).toBe(
      "→ SPARQL target",
    );
  });

  it("a shape with no target at all shows no arrow or separator", () => {
    const shape: ShaclShape = {
      id: "S",
      name: "Untargeted",
      targetClass: "",
      properties: [],
    };
    render(<ShaclShapeBrowser shapes={[shape]} validationResults={[]} />);
    expect(screen.queryByTestId("shape-targets-S")).toBeNull();
    const header = screen.getByTestId("shape-toggle-S");
    expect(header.textContent).not.toContain("→");
    expect(header.textContent).not.toContain(",");
    // The name and the badge still render.
    expect(header.textContent).toContain("Untargeted");
    expect(screen.getByTestId("shape-badge-S")).toBeInTheDocument();
  });
});

// ── Issue #67: an absent targetClass reads like an empty one ────────

describe("an absent targetClass behaves like an empty one (#67)", () => {
  it("a subjectsOf-only shape without targetClass lists that target alone", () => {
    const shape: ShaclShape = {
      id: "S",
      targets: [{ kind: "subjectsOf", value: "http://x.org/v#decomposes" }],
      properties: [],
    };
    render(<ShaclShapeBrowser shapes={[shape]} validationResults={[]} />);
    const targets = screen.getByTestId("shape-targets-S");
    expect(targets.textContent).toBe("→ subjects of decomposes");
    expect(targets.querySelectorAll("[data-target-kind]")).toHaveLength(1);
    expect(targets.querySelector('[data-target-kind="class"]')).toBeNull();
  });

  it("a shape with no target at all shows no arrow, and validates nothing", () => {
    const shape: ShaclShape = { id: "S", name: "Untargeted", properties: [] };
    const ugm = new UGM();
    ugm.addNode("n", { types: ["T"], properties: {} });
    render(
      <ShaclShapeBrowser
        shapes={[shape]}
        validationResults={validateShacl(ugm, [shape])}
      />,
    );
    expect(screen.queryByTestId("shape-targets-S")).toBeNull();
    const header = screen.getByTestId("shape-toggle-S");
    expect(header.textContent).not.toContain("→");
    expect(header.textContent).toContain("Untargeted");
    expect(screen.getByTestId("shape-badge-S")).toBeInTheDocument();
  });
});
