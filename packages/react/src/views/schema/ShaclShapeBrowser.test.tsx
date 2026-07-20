/**
 * ShaclShapeBrowser tests (DE.2).
 *
 * Extracted from packages/core/src/shacl/shacl.test.tsx during Phase 4:
 * the ShaclShapeBrowser is a @g3t/react UI component, so its tests
 * belong here, not in @g3t/core's test suite.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { validateShacl, type ShaclShape } from "@g3t/core";
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
