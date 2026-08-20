/**
 * Legibility Lab fixtures: the SMALLEST graphs that make each
 * spreading device readable at a glance.
 *
 * - Hub fixture: one 14-degree hub (8 outgoing `monitors`, 6 incoming
 *   `reportsTo`). Under hubBurst(k=6) the mat of 14 direct edges
 *   regroups into exactly two satellites, one per (type, direction).
 * - Bus fixture: six `feeds` edges converging on one aggregator, plus
 *   a 2-edge `calibrates` group that stays below kBus and therefore
 *   must NOT collapse (the visible control case).
 * - Holon fixture: a two-holon dataset whose boundary projection shows
 *   exactly ONE exposed boundary node (the radio) inside the ring,
 *   with the portal transiting out through it to a stubbed neighbor.
 */
import { UGM } from "@g3t/core";
import type { HolonicDataset } from "@g3t/core";

/** One hub, 8 services it monitors, 6 teams reporting to it. */
export function buildHubFixture(): UGM {
  const ugm = new UGM();
  ugm.addNode("ops", {
    types: ["Hub"],
    properties: { name: "Ops Hub" },
  });
  for (let i = 1; i <= 8; i++) {
    ugm.addNode(`svc${i}`, {
      types: ["Service"],
      properties: { name: `Service ${i}` },
    });
    ugm.addEdge("ops", `svc${i}`, { type: "monitors" });
  }
  for (let i = 1; i <= 6; i++) {
    ugm.addNode(`team${i}`, {
      types: ["Team"],
      properties: { name: `Team ${i}` },
    });
    ugm.addEdge(`team${i}`, "ops", { type: "reportsTo" });
  }
  return ugm;
}

/** Six sensors feeding one aggregator (collapses), two calibration
 *  edges from one technician (stays: below kBus, distinct targets). */
export function buildBusFixture(): UGM {
  const ugm = new UGM();
  ugm.addNode("agg", {
    types: ["Aggregator"],
    properties: { name: "Aggregator" },
  });
  for (let i = 1; i <= 6; i++) {
    ugm.addNode(`sensor${i}`, {
      types: ["Sensor"],
      properties: { name: `Sensor ${i}` },
    });
    ugm.addEdge(`sensor${i}`, "agg", { type: "feeds" });
  }
  ugm.addNode("tech", {
    types: ["Technician"],
    properties: { name: "Technician" },
  });
  ugm.addEdge("tech", "sensor1", { type: "calibrates" });
  ugm.addEdge("tech", "sensor2", { type: "calibrates" });
  return ugm;
}

/** Flight deck exposing ONE boundary node (the radio); its portal
 *  transits through it to ground control. */
export const LEGIBILITY_HOLONS: HolonicDataset = {
  holons: [
    {
      id: "flight-deck",
      label: "Flight Deck",
      types: ["Holon"],
      properties: { crew: 2 },
      interiorNodes: [
        { id: "radio", types: ["Radio"], properties: { band: "VHF" } },
        { id: "nav", types: ["NavComputer"], properties: {} },
        { id: "autopilot", types: ["Autopilot"], properties: {} },
        { id: "blackbox", types: ["Recorder"], properties: {} },
      ],
      interiorEdges: [
        { source: "nav", target: "autopilot", type: "drives" },
        { source: "nav", target: "radio", type: "feeds" },
        { source: "autopilot", target: "blackbox", type: "logs" },
        { source: "radio", target: "blackbox", type: "logs" },
      ],
      boundaryNodeIds: ["radio"],
      portals: [
        {
          id: "portal-atc",
          label: "transmitsTo",
          sourceHolonId: "flight-deck",
          targetHolonId: "ground-control",
          boundaryNodeId: "radio",
        },
      ],
    },
    {
      id: "ground-control",
      label: "Ground Control",
      types: ["Holon"],
      properties: {},
      interiorNodes: [{ id: "tower", types: ["Tower"], properties: {} }],
      interiorEdges: [],
      boundaryNodeIds: ["tower"],
      portals: [
        {
          id: "portal-clearance",
          label: "clears",
          sourceHolonId: "ground-control",
          targetHolonId: "flight-deck",
          boundaryNodeId: "tower",
        },
      ],
    },
  ],
};
