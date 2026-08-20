/**
 * Holonic fixture for the Ontology Workbench "Holons" tab: the
 * spacecraft domain reorganized as three holons (Space Segment,
 * Ground Segment, Mission Operations) so the three drill levels of
 * the four-graph model each show something distinct:
 *
 * - HOLARCHY (projectToLPG): three opaque holons, portals as edges;
 * - BOUNDARY (projectHolonBoundary): what a holon PUBLISHES — its
 *   exposed nodes inside the boundary ring, portal edges crossing
 *   out to stubbed neighbors (transit glyph at the crossing);
 * - INTERIOR (projectHolonInterior): the fully open flat LPG.
 *
 * Space Segment deliberately exposes only its comms + telemetry
 * nodes (the bus, propulsion, and thruster stay hidden) so the
 * boundary view is visibly smaller than the interior.
 */
import type { HolonicDataset } from "@g3t/core";

export const HOLON_FIXTURE: HolonicDataset = {
  holons: [
    {
      id: "space-segment",
      label: "Space Segment",
      types: ["Segment"],
      properties: { operator: "ExampleSat" },
      interiorNodes: [
        { id: "aquila1", types: ["Satellite"], properties: { massKg: 950 } },
        { id: "comms", types: ["CommsSubsystem"], properties: { band: "Ka" } },
        {
          id: "telemetry",
          types: ["TelemetrySubsystem"],
          properties: { rateKbps: 256 },
        },
        { id: "bus", types: ["BusSubsystem"], properties: {} },
        { id: "propulsion", types: ["PropulsionSubsystem"], properties: {} },
        { id: "thruster", types: ["Thruster"], properties: {} },
      ],
      interiorEdges: [
        { source: "aquila1", target: "comms", type: "hasSubsystem" },
        { source: "aquila1", target: "telemetry", type: "hasSubsystem" },
        { source: "aquila1", target: "bus", type: "hasSubsystem" },
        { source: "aquila1", target: "propulsion", type: "hasSubsystem" },
        { source: "propulsion", target: "thruster", type: "hasPart" },
      ],
      boundaryNodeIds: ["comms", "telemetry"],
      portals: [
        {
          id: "portal-downlink",
          label: "downlinksTo",
          sourceHolonId: "space-segment",
          targetHolonId: "ground-segment",
          boundaryNodeId: "comms",
          constructQuery:
            "CONSTRUCT { ?s ?p ?o } WHERE { ?s a ex:CommsSubsystem ; ?p ?o }",
        },
        {
          id: "portal-telemetry",
          label: "reportsTo",
          sourceHolonId: "space-segment",
          targetHolonId: "mission-ops",
          boundaryNodeId: "telemetry",
        },
      ],
    },
    {
      id: "ground-segment",
      label: "Ground Segment",
      types: ["Segment"],
      properties: { operator: "ExampleSat" },
      interiorNodes: [
        { id: "gsAlpha", types: ["GroundStation"], properties: { dishM: 13 } },
        { id: "gsBeta", types: ["GroundStation"], properties: { dishM: 9 } },
        { id: "scheduler", types: ["PassScheduler"], properties: {} },
      ],
      interiorEdges: [
        { source: "scheduler", target: "gsAlpha", type: "schedules" },
        { source: "scheduler", target: "gsBeta", type: "schedules" },
      ],
      boundaryNodeIds: ["gsAlpha", "gsBeta"],
      portals: [
        {
          id: "portal-uplink",
          label: "uplinksTo",
          sourceHolonId: "ground-segment",
          targetHolonId: "space-segment",
          boundaryNodeId: "gsAlpha",
        },
        {
          id: "portal-passes",
          label: "reportsPassesTo",
          sourceHolonId: "ground-segment",
          targetHolonId: "mission-ops",
        },
      ],
    },
    {
      id: "mission-ops",
      label: "Mission Operations",
      types: ["OpsCenter"],
      properties: {},
      interiorNodes: [
        { id: "moc", types: ["ControlRoom"], properties: {} },
        { id: "flightDyn", types: ["FlightDynamics"], properties: {} },
      ],
      interiorEdges: [{ source: "moc", target: "flightDyn", type: "consults" }],
      boundaryNodeIds: ["moc"],
      portals: [
        {
          id: "portal-commands",
          label: "commands",
          sourceHolonId: "mission-ops",
          targetHolonId: "ground-segment",
          boundaryNodeId: "moc",
        },
      ],
    },
  ],
};
