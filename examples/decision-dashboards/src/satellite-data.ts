/**
 * Data layer for the conformance dashboard (the INGEST BOUNDARY).
 *
 * In a real application this is where you would load your graph from
 * its system of record: a SPARQL endpoint, an RDF file via the core
 * RDF adapters, a CSV export via parseCSV/virtualizeRelationalData, or
 * a REST API. Everything below the toolkit treats the UGM as the
 * single source of truth, so the ONLY thing an integrator changes to
 * point at real data is this module: the dashboard component does not
 * change at all.
 *
 * Here the source is a synthetic-but-realistically-scaled satellite
 * model (~40 components across six subsystems) built programmatically,
 * which stands in for "rows returned from a query." A handful of
 * components carry deliberate data-quality problems so the conformance
 * review has something to find.
 *
 * @see examples/decision-dashboards/README.md (architecture)
 */

import { UGM, type ShaclShape } from "@g3t/core";

export interface ComponentRow {
  id: string;
  name: string;
  subsystem: string;
  partNumber?: string;
  massKg?: number;
  /** Power draw in watts; some components leave it unset (a gap). */
  powerW?: number;
}

/** Edges in the model: power and data/command connections. */
export interface ConnectionRow {
  from: string;
  to: string;
  kind: "powers" | "commands" | "data";
}

/**
 * The "query result": component rows for a small spacecraft. Generated
 * across six subsystems so the graph has real structure (clusters,
 * cross-subsystem links) rather than a toy shape. Three rows have
 * deliberate defects: a missing part number, an out-of-range mass, and
 * a second missing part number deeper in the tree.
 */
export function fetchComponentRows(): ComponentRow[] {
  const rows: ComponentRow[] = [];
  const add = (
    id: string,
    name: string,
    subsystem: string,
    massKg: number,
    powerW: number | undefined,
    partNumber: string | undefined,
  ) => rows.push({ id, name, subsystem, massKg, powerW, partNumber });

  // EPS — electrical power
  add("eps.array.p", "Solar Array +Y", "EPS", 12, undefined, "SA-100");
  add("eps.array.m", "Solar Array -Y", "EPS", 12, undefined, "SA-101");
  add("eps.battery.a", "Battery Pack A", "EPS", 18, undefined, "BP-220");
  add("eps.battery.b", "Battery Pack B", "EPS", 18, undefined, "BP-221");
  // PDU: missing part number -> violation.
  add("eps.pdu", "Power Distribution Unit", "EPS", 6, 14, undefined);
  add("eps.harness", "Main Harness", "EPS", 4, undefined, "WH-009");
  add("eps.shunt", "Shunt Regulator", "EPS", 2, 8, "SR-040");

  // ADCS — attitude determination & control
  add("adcs.imu", "Inertial Measurement Unit", "ADCS", 3, 9, "IMU-7");
  add("adcs.star", "Star Tracker", "ADCS", 4, 11, "ST-3");
  add("adcs.wheel.x", "Reaction Wheel X", "ADCS", 5, 22, "RW-1");
  add("adcs.wheel.y", "Reaction Wheel Y", "ADCS", 5, 22, "RW-1");
  add("adcs.wheel.z", "Reaction Wheel Z", "ADCS", 5, 22, "RW-1");
  add("adcs.mag", "Magnetorquer Set", "ADCS", 2, 6, "MT-2");
  add("adcs.sun", "Sun Sensor", "ADCS", 1, 2, "SS-5");

  // OBC — on-board computing. Flight computer mass is implausible.
  add("obc.fc", "Flight Computer", "OBC", 240, 18, "FC-7");
  add("obc.mem", "Mass Memory Unit", "OBC", 3, 7, "MM-12");
  add("obc.io", "I/O Board", "OBC", 1, 4, "IO-8");
  add("obc.watchdog", "Watchdog Timer", "OBC", 1, 1, "WD-1");

  // COMM — communications
  add("comm.txrx", "S-Band Transceiver", "COMM", 4, 26, "TX-30");
  add("comm.amp", "Power Amplifier", "COMM", 3, 40, "PA-9");
  add("comm.ant.hi", "High-Gain Antenna", "COMM", 6, undefined, "AN-14");
  add("comm.ant.lo", "Low-Gain Antenna", "COMM", 1, undefined, "AN-2");
  add("comm.diplexer", "Diplexer", "COMM", 1, undefined, "DP-3");

  // THERM — thermal
  add("therm.htr.a", "Heater Zone A", "THERM", 1, 12, "HT-1");
  add("therm.htr.b", "Heater Zone B", "THERM", 1, 12, "HT-1");
  add("therm.sensor.a", "Thermistor A", "THERM", 1, 1, "TH-5");
  add("therm.sensor.b", "Thermistor B", "THERM", 1, 1, "TH-5");
  // Radiator: missing part number -> a second violation, in THERM.
  add("therm.rad", "Radiator Panel", "THERM", 5, undefined, undefined);
  add("therm.mli", "MLI Blanket", "THERM", 2, undefined, "ML-1");

  // PAYLOAD — imaging
  add("pl.optics", "Telescope Optics", "PAYLOAD", 30, undefined, "OP-1");
  add("pl.focal", "Focal Plane Array", "PAYLOAD", 4, 15, "FP-2");
  add("pl.elec", "Payload Electronics", "PAYLOAD", 6, 24, "PE-3");
  add("pl.cooler", "Detector Cooler", "PAYLOAD", 3, 30, "DC-4");
  add("pl.shutter", "Shutter Mechanism", "PAYLOAD", 1, 5, "SH-6");
  add("pl.cal", "Calibration Source", "PAYLOAD", 1, 3, "CS-7");
  return rows;
}

/** The "query result" for connections (power, data, command links). */
export function fetchConnectionRows(): ConnectionRow[] {
  const c = (
    from: string,
    to: string,
    kind: ConnectionRow["kind"],
  ): ConnectionRow => ({ from, to, kind });
  return [
    // Power distribution from arrays/batteries through the PDU.
    c("eps.array.p", "eps.pdu", "powers"),
    c("eps.array.m", "eps.pdu", "powers"),
    c("eps.battery.a", "eps.pdu", "powers"),
    c("eps.battery.b", "eps.pdu", "powers"),
    c("eps.shunt", "eps.pdu", "powers"),
    c("eps.pdu", "eps.harness", "powers"),
    // Harness feeds every other subsystem's primary box.
    c("eps.harness", "obc.fc", "powers"),
    c("eps.harness", "adcs.imu", "powers"),
    c("eps.harness", "comm.txrx", "powers"),
    c("eps.harness", "therm.htr.a", "powers"),
    c("eps.harness", "therm.htr.b", "powers"),
    c("eps.harness", "pl.elec", "powers"),
    // OBC commands the subsystems (data/command bus).
    c("obc.fc", "obc.mem", "data"),
    c("obc.fc", "obc.io", "data"),
    c("obc.fc", "obc.watchdog", "data"),
    c("obc.io", "adcs.imu", "commands"),
    c("obc.io", "adcs.star", "commands"),
    c("obc.io", "comm.txrx", "commands"),
    c("obc.io", "pl.elec", "commands"),
    c("obc.io", "therm.sensor.a", "data"),
    c("obc.io", "therm.sensor.b", "data"),
    // ADCS internal: sensors and actuators.
    c("adcs.imu", "adcs.wheel.x", "commands"),
    c("adcs.imu", "adcs.wheel.y", "commands"),
    c("adcs.imu", "adcs.wheel.z", "commands"),
    c("adcs.imu", "adcs.mag", "commands"),
    c("adcs.star", "adcs.imu", "data"),
    c("adcs.sun", "adcs.imu", "data"),
    // COMM chain.
    c("comm.txrx", "comm.amp", "data"),
    c("comm.amp", "comm.diplexer", "data"),
    c("comm.diplexer", "comm.ant.hi", "data"),
    c("comm.diplexer", "comm.ant.lo", "data"),
    // THERM control loops.
    c("therm.sensor.a", "therm.htr.a", "data"),
    c("therm.sensor.b", "therm.htr.b", "data"),
    c("therm.rad", "therm.mli", "data"),
    // PAYLOAD internal.
    c("pl.optics", "pl.focal", "data"),
    c("pl.focal", "pl.elec", "data"),
    c("pl.elec", "pl.cooler", "commands"),
    c("pl.elec", "pl.shutter", "commands"),
    c("pl.cal", "pl.focal", "data"),
    // Payload streams to comm for downlink.
    c("pl.elec", "comm.txrx", "data"),
  ];
}

/**
 * Build the UGM from the "query results". THIS is the ingest step an
 * integrator owns: map your rows onto nodes and edges. Components are
 * typed by subsystem (so the encoding can color by subsystem), and
 * every domain property travels on the node so SHACL and the inspector
 * can read it.
 */
export function buildSatelliteModel(): UGM {
  const g = new UGM();
  for (const row of fetchComponentRows()) {
    g.addNode(row.id, {
      types: ["Component", row.subsystem],
      properties: {
        name: row.name,
        subsystem: row.subsystem,
        ...(row.partNumber !== undefined ? { partNumber: row.partNumber } : {}),
        ...(row.massKg !== undefined ? { massKg: row.massKg } : {}),
        ...(row.powerW !== undefined ? { powerW: row.powerW } : {}),
      },
    });
  }
  for (const conn of fetchConnectionRows()) {
    g.addEdge(conn.from, conn.to, { type: conn.kind, properties: {} });
  }
  return g;
}

/**
 * The design rules, as SHACL shapes. In production these would more
 * likely be authored RDF loaded alongside the data; here they are
 * hand-built ShaclShape objects (the same structure the validator and
 * the shape view consume).
 */
export function designRules(): ShaclShape[] {
  return [
    {
      id: "ComponentShape",
      targetClass: "Component",
      name: "Component",
      properties: [
        { path: "name", datatype: "string", minCount: 1 },
        // Every flight component must carry a part number.
        { path: "partNumber", datatype: "string", minCount: 1 },
        // Per-component mass ceiling: over it is a warning, not a hard
        // failure (sh:severity).
        {
          path: "massKg",
          datatype: "number",
          maxInclusive: 100,
          severity: "warning",
        },
        // Power budget should be recorded; missing it is informational.
        {
          path: "powerW",
          datatype: "number",
          minCount: 1,
          severity: "info",
        },
      ],
    },
  ];
}
