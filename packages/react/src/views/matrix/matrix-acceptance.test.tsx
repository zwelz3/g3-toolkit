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
 *  - Limit behavior (R7.3): MET as of issue #6. A 350x350 request
 *    renders a 200x200 window and pages rows and columns
 *    independently through two PaginationControls, so every cell is
 *    reachable; the earlier truncation notice is gone. Verified by
 *    the "350x350" test below, which restates R7.3's acceptance.
 *  - "For two selected node types": NOT met. The view renders all
 *    types up to the page size; there is no type-pair selection
 *    input.
 * R1.4 therefore stays in-progress on the type-pair gap alone, scoped
 * in roadmap/verification/view-acceptance.md.
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { UGM, SEQUENTIAL_SCALE } from "@g3-toolkit/core";

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

  it("pages rows and columns independently past maxSize, with a count in place of the old truncation notice", () => {
    // The matrix derives its type set from EDGES, so every type must
    // participate in one (a typed but unconnected node never reaches
    // the grid). A chain n0-n1-...-n5 gives one edge per adjacent
    // type pair, including T2->T3 which straddles the page boundary.
    const ugm = new UGM();
    for (let i = 0; i < 6; i++) {
      ugm.addNode(`n${i}`, { types: [`T${i}`], properties: {} });
    }
    for (let i = 0; i < 5; i++) {
      ugm.addEdge(`n${i}`, `n${i + 1}`, { type: "rel", properties: {} });
    }
    render(<MatrixView ugm={ugm} maxSize={3} />);
    expect(screen.queryByTestId("matrix-truncation-notice")).toBeNull();
    expect(
      screen.getByTestId("matrix-rows-pagination-summary").textContent,
    ).toBe("rows 1 to 3 of 6");
    expect(
      screen.getByTestId("matrix-columns-pagination-summary").textContent,
    ).toBe("columns 1 to 3 of 6");
    expect(screen.queryByTestId("matrix-cell-T2-T3")).toBeNull();
    // Column page 2 alone: the T2 row stays, the T3 column arrives.
    fireEvent.click(screen.getByTestId("matrix-columns-pagination-next"));
    expect(screen.getByTestId("matrix-cell-T2-T3").textContent).toBe("1");
    expect(screen.queryByTestId("matrix-cell-T3-T3")).toBeNull();
    expect(
      screen.getByTestId("matrix-columns-pagination-summary").textContent,
    ).toBe("columns 4 to 6 of 6");
    // Row page 2: the far corner is reachable.
    fireEvent.click(screen.getByTestId("matrix-rows-pagination-next"));
    expect(screen.getByTestId("matrix-cell-T4-T5").textContent).toBe("1");
    expect(screen.getByTestId("matrix-cell-T5-T5")).toBeDefined();
  });

  it("R7.3: a 350x350 request opens within the 200x200 default, with the controls that reach the remainder", () => {
    // 350 types, each on at least one edge (a chain), so the full
    // matrix is 350x350. The view must open at 200x200 WITHOUT a
    // maxSize prop (the default is the requirement's number).
    // Rendered to static markup rather than jsdom: 40,000 inline-styled
    // cells cost about 6 s per jsdom commit (measured 2026-10-13), and
    // the paging clicks themselves are exercised on the 6-type fixture
    // above, where the mechanics are the same and the render is cheap.
    const ugm = new UGM();
    const N = 350;
    for (let i = 0; i < N; i++) {
      ugm.addNode(`n${i}`, {
        types: [`T${String(i).padStart(3, "0")}`],
        properties: {},
      });
    }
    for (let i = 0; i < N - 1; i++) {
      ugm.addEdge(`n${i}`, `n${i + 1}`, { type: "rel", properties: {} });
    }
    const html = renderToStaticMarkup(<MatrixView ugm={ugm} />);
    // String counts, not a DOMParser: parsing 40,000 style attributes
    // is the same jsdom cost the static render avoids.
    const body = html.slice(html.indexOf("<tbody>"));
    const count = (hay: string, needle: string): number =>
      hay.split(needle).length - 1;
    expect(count(body, "<tr")).toBe(200);
    expect(count(html, 'scope="col"')).toBe(200);
    expect(count(body, "<td")).toBe(200 * 200);
    const summary = (axis: string): string | undefined =>
      new RegExp(
        `data-testid="matrix-${axis}-pagination-summary"[^>]*>([^<]*)<`,
      ).exec(html)?.[1];
    expect(summary("rows")).toBe("rows 1 to 200 of 350");
    expect(summary("columns")).toBe("columns 1 to 200 of 350");
    // The last type is on page 2 of both axes, and both Next buttons
    // are enabled: the remainder is one click away per axis.
    expect(html).not.toContain('data-testid="matrix-cell-T349-T349"');
    expect(html).toContain('data-testid="matrix-cell-T199-T199"');
    for (const axis of ["rows", "columns"]) {
      const tag = new RegExp(
        `<button[^>]*data-testid="matrix-${axis}-pagination-next"[^>]*>`,
      ).exec(html)?.[0];
      expect(tag).toBeDefined();
      expect(tag).not.toContain("disabled");
    }
  }, 15_000);

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
