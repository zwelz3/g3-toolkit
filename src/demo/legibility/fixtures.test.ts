/**
 * Legibility Lab fixture invariants: the shell's pedagogy depends on
 * these exact shapes, so pin them here before the transforms can mask
 * a regression in the visible panels.
 */
import { describe, expect, it } from "vitest";
import { busCollapse, HolonicAdapter, hubBurst, isPseudoNode } from "@g3t/core";
import {
  buildBusFixture,
  buildHubFixture,
  LEGIBILITY_HOLONS,
} from "./fixtures";

describe("Legibility Lab fixtures", () => {
  it("hub fixture: one 14-degree hub, hubBurst(k=6) fans to two satellites", () => {
    const ugm = buildHubFixture();
    expect(ugm.getNodeEdges("ops")).toHaveLength(14);
    const spread = hubBurst(ugm, { k: 6 });
    const satellites = [...spread.satellites.keys()];
    expect(satellites).toHaveLength(2);
    // Every original edge (14) got assigned; all are burst.
    expect(spread.invert.size).toBe(14);
    for (const a of spread.invert.values()) expect(a.burst).toBe(true);
  });

  it("bus fixture: 6 feeds collapse, 2 calibrates stay (below kBus=3)", () => {
    const ugm = buildBusFixture();
    const spread = busCollapse(ugm, { kBus: 3 });
    // Exactly one junction (the feeds group). Calibrates stays direct.
    expect(spread.junctions.size).toBe(1);
    const [collapsedIds] = [...spread.invert.values()];
    expect(collapsedIds).toHaveLength(6);
    // The two calibrates edges are still present verbatim on the output.
    const calibrates = spread.ugm
      .getNodeEdges("tech")
      .map((eid) => spread.ugm.getEdge(eid)!)
      .filter((attrs) => attrs.type === "calibrates");
    expect(calibrates).toHaveLength(2);
    // And pseudo nodes carry the pseudo flag (attribute-mapper contract).
    for (const [id] of spread.junctions) {
      const attrs = spread.ugm.getNode(id)!;
      expect(isPseudoNode(attrs)).toBe(true);
    }
  });

  it("holon boundary exposes exactly ONE boundary node with a portal transit", () => {
    const adapter = new HolonicAdapter(LEGIBILITY_HOLONS);
    const flightDeck = adapter.dataset.holons[0]!;
    expect(flightDeck.id).toBe("flight-deck");
    const ugm = adapter.projectHolonBoundary(flightDeck);
    const exposed: string[] = [];
    ugm.forEachNode((id, attrs) => {
      if (attrs.properties._exposed === true) exposed.push(id);
    });
    expect(exposed).toEqual(["radio"]);
    // Portal transit edges out of the exposed node.
    const portalEdges = ugm
      .getNodeEdges("radio")
      .map((eid) => ugm.getEdge(eid)!)
      .filter((attrs) => attrs.properties._portalTransit === true);
    expect(portalEdges).toHaveLength(1);
  });
});
