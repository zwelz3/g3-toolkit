/**
 * R1.4 acceptance verification (verification/view-acceptance.md, item 3).
 *
 * Spec acceptance (specs/01, R1.4): "Given a graph with typed nodes,
 * when the matrix view is opened for two selected node types, then
 * the grid renders co-occurrence counts with a color gradient."
 * Boundary (specs/07, R7.3): matrices beyond 200x200 are aggregated
 * or paginated before rendering.
 *
 * VERIFICATION OUTCOME, recorded per the roadmap's honesty rule:
 *  - Co-occurrence counts with a color gradient: VERIFIED below
 *    (sequential viridis scale, monotonic with count).
 *  - Limit behavior: PARTIALLY met. The view truncates to maxSize and
 *    now announces it (truncation notice, R7.7's no-silent-limits
 *    principle); true aggregation/pagination per R7.3's letter does
 *    not exist.
 *  - "For two selected node types": NOT met. The view renders all
 *    types up to the limit; there is no type-pair selection input.
 * R1.4 therefore stays in-progress; the two gaps are scoped in
 * roadmap/verification/view-acceptance.md.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UGM, SEQUENTIAL_SCALE } from "@g3t/core";

/** jsdom normalizes hex backgrounds to rgb(); compare in that space. */
function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
import { MatrixView } from "./MatrixView";

function makeTypedGraph(): UGM {
  const ugm = new UGM();
  // Two Person-Org edges, one Person-Person edge: distinct counts so
  // the gradient assertion compares two real intensities.
  ugm.addNode("p1", { types: ["Person"], properties: { label: "P1" } });
  ugm.addNode("p2", { types: ["Person"], properties: { label: "P2" } });
  ugm.addNode("o1", { types: ["Org"], properties: { label: "O1" } });
  ugm.addEdge("p1", "o1", { type: "worksAt", properties: {} });
  ugm.addEdge("p2", "o1", { type: "worksAt", properties: {} });
  ugm.addEdge("p1", "p2", { type: "knows", properties: {} });
  return ugm;
}

describe("MatrixView acceptance (R1.4, R7.3 boundary)", () => {
  it("renders co-occurrence counts with a monotonic color gradient", () => {
    render(<MatrixView ugm={makeTypedGraph()} />);
    // Highest count (Person->Org = 2) takes the scale's top step;
    // lower counts take lower steps: the gradient encodes magnitude.
    const hi = screen.getByTestId("matrix-cell-Person-Org");
    expect(hi.textContent).toBe("2");
    expect(hi.style.background).toBe(
      hexToRgb(SEQUENTIAL_SCALE[SEQUENTIAL_SCALE.length - 1] ?? "#000000"),
    );
    const lo = screen.getByTestId("matrix-cell-Person-Person");
    expect(lo.textContent).toBe("1");
    expect(lo.style.background).not.toBe(hi.style.background);
  });

  it("announces the working-set limit instead of truncating silently", () => {
    // The matrix derives its type set from EDGES, so every type must
    // participate in one (a typed but unconnected node never reaches
    // the grid).
    const ugm = new UGM();
    for (let i = 0; i < 6; i++) {
      ugm.addNode(`n${i}`, { types: [`T${i}`], properties: {} });
    }
    for (let i = 0; i < 5; i++) {
      ugm.addEdge(`n${i}`, `n${i + 1}`, { type: "rel", properties: {} });
    }
    render(<MatrixView ugm={ugm} maxSize={3} />);
    const notice = screen.getByTestId("matrix-truncation-notice");
    expect(notice.textContent).toContain("3 of 6");
  });

  it("documents the type-pair selection gap (R1.4 stays in-progress)", () => {
    // The acceptance phrase "for two selected node types" has no
    // corresponding input on MatrixView; this assertion exists so the
    // gap is executable documentation: when a typeFilter (or similar)
    // prop lands, this test gets rewritten to exercise it and R1.4
    // can advance.
    render(<MatrixView ugm={makeTypedGraph()} />);
    expect(
      "typeFilter" in (MatrixView as { propTypes?: unknown }) ||
        screen.queryByTestId("matrix-type-selector"),
    ).toBeFalsy();
  });
});
