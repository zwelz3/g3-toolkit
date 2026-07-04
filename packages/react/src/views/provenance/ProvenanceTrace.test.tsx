/** ProvenanceTrace tests (flagship §2d). Render-level, jsdom. */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProvenanceTrace, type ProvenanceChain } from "./ProvenanceTrace";

const chain: ProvenanceChain = [
  {
    id: "act.disc.c.digital-thread",
    tier: "action",
    label: "Discriminator: Digital Thread",
    depth: 0,
  },
  {
    id: "c.digital-thread",
    tier: "meaning",
    label: "Digital Thread",
    detail: "discriminator",
    depth: 1,
    parentId: "act.disc.c.digital-thread",
  },
  {
    id: "a.helios",
    tier: "raw",
    label: "HELIOS",
    depth: 2,
    parentId: "c.digital-thread",
  },
  {
    id: "e.helios",
    tier: "evidence",
    label: "Exceptional (5/5)",
    depth: 3,
    parentId: "a.helios",
    leaf: true,
  },
];

const exposedChain: ProvenanceChain = [
  {
    id: "c.sustainment",
    tier: "meaning",
    label: "Sustainment Modeling",
    depth: 0,
  },
  {
    id: "absence:c.sustainment",
    tier: "evidence",
    label: "Substantiation thin / contested",
    depth: 1,
    parentId: "c.sustainment",
    leaf: true,
    absence: true,
  },
];

describe("ProvenanceTrace", () => {
  it("renders one hop per chain entry with the title", () => {
    render(<ProvenanceTrace chain={chain} title="Trace" />);
    expect(screen.getByTestId("g3t-provenance-trace")).toBeDefined();
    expect(screen.getAllByTestId("g3t-provenance-hop").length).toBe(4);
    expect(screen.getByText("Trace")).toBeDefined();
  });

  it("indents hops by depth", () => {
    render(<ProvenanceTrace chain={chain} indentPx={16} />);
    const hops = screen.getAllByTestId("g3t-provenance-hop");
    expect(hops[0]!.style.marginLeft).toBe("0px");
    expect(hops[2]!.style.marginLeft).toBe("32px"); // depth 2 * 16
  });

  it("marks the leaf and exposes its tier", () => {
    render(<ProvenanceTrace chain={chain} />);
    const leaf = screen
      .getAllByTestId("g3t-provenance-hop")
      .find((h) => h.getAttribute("data-leaf") === "true");
    expect(leaf).toBeDefined();
    expect(leaf!.getAttribute("data-tier")).toBe("evidence");
    expect(leaf!.textContent).toContain("Exceptional");
  });

  it("renders an absence leaf distinctly", () => {
    render(<ProvenanceTrace chain={exposedChain} />);
    const absence = screen
      .getAllByTestId("g3t-provenance-hop")
      .find((h) => h.getAttribute("data-absence") === "true");
    expect(absence).toBeDefined();
    expect(absence!.textContent?.toLowerCase()).toContain("absence");
  });

  it("calls onSelectHop with the hop id when activated", () => {
    const onSelect = vi.fn();
    render(<ProvenanceTrace chain={chain} onSelectHop={onSelect} />);
    fireEvent.click(screen.getByText("HELIOS"));
    expect(onSelect).toHaveBeenCalledWith("a.helios");
  });

  it("highlights the selected hop", () => {
    render(<ProvenanceTrace chain={chain} selectedId="c.digital-thread" />);
    const selected = screen
      .getAllByTestId("g3t-provenance-hop")
      .find((h) => h.getAttribute("aria-selected") === "true");
    expect(selected!.textContent).toContain("Digital Thread");
  });

  it("shows an empty state for an empty chain", () => {
    render(<ProvenanceTrace chain={[]} />);
    expect(screen.getByTestId("g3t-provenance-empty")).toBeDefined();
  });
});
