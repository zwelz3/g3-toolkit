/**
 * Seeded ontology for the Ontology Workbench: a small spacecraft
 * domain with enough OWL structure to exercise every workbench
 * surface. Deliberate demo gaps (things the reasoner must supply):
 *
 * - ex:aquila2 is typed ONLY ex:Satellite; Spacecraft/System/Artifact
 *   arrive via subclass inference.
 * - ex:gsAlpha is never typed at all; ex:uplinksTo range entailment
 *   types it GroundStation.
 * - ex:communicatesWith is symmetric and asserted one direction only.
 * - ex:partOf is transitive; thruster -> propulsion -> aquila1 gives
 *   an inferred thruster partOf aquila1.
 * - ex:hasSubsystem / ex:subsystemOf are inverses; only one direction
 *   is asserted per pair.
 * - ex:CommsSubsystem is equivalentClass ex:CommSubsystem, so members
 *   of one are inferred members of the other.
 *
 * SHACL shapes are provided as core ShaclShape structures (the
 * lightweight model the validator and structural converter consume),
 * not as shape triples; the workbench states this in its UI copy.
 */
import type { RDFGraph, RDFTriple, ShaclShape } from "@g3t/core";

export const NS = {
  ex: "http://example.org/sat#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  dc: "http://purl.org/dc/elements/1.1/",
} as const;

export const RDF_TYPE = `${NS.rdf}type`;
export const RDFS_SUBCLASS = `${NS.rdfs}subClassOf`;
export const RDFS_SUBPROP = `${NS.rdfs}subPropertyOf`;
export const RDFS_DOMAIN = `${NS.rdfs}domain`;
export const RDFS_RANGE = `${NS.rdfs}range`;
export const RDFS_LABEL = `${NS.rdfs}label`;
export const RDFS_COMMENT = `${NS.rdfs}comment`;
export const OWL_CLASS = `${NS.owl}Class`;
export const OWL_OBJECT_PROP = `${NS.owl}ObjectProperty`;
export const OWL_DATA_PROP = `${NS.owl}DatatypeProperty`;
export const OWL_ANN_PROP = `${NS.owl}AnnotationProperty`;
export const OWL_INVERSE = `${NS.owl}inverseOf`;
export const OWL_SYMMETRIC = `${NS.owl}SymmetricProperty`;
export const OWL_TRANSITIVE = `${NS.owl}TransitiveProperty`;
export const OWL_EQUIVALENT = `${NS.owl}equivalentClass`;
export const OWL_DISJOINT = `${NS.owl}disjointWith`;
export const OWL_ONTOLOGY = `${NS.owl}Ontology`;

const PREFIX_ORDER: Array<[string, string]> = [
  ["ex", NS.ex],
  ["rdf", NS.rdf],
  ["rdfs", NS.rdfs],
  ["owl", NS.owl],
  ["xsd", NS.xsd],
  ["dc", NS.dc],
];

/** Shorten a full IRI to prefix:local for display. */
export function shorten(iri: string): string {
  for (const [p, ns] of PREFIX_ORDER) {
    if (iri.startsWith(ns)) return `${p}:${iri.slice(ns.length)}`;
  }
  return iri;
}

const u = (s: string, p: string, o: string): RDFTriple => ({
  subject: s,
  predicate: p,
  object: o,
  objectType: "uri",
});
const lit = (
  s: string,
  p: string,
  o: string,
  datatype?: string,
): RDFTriple => ({
  subject: s,
  predicate: p,
  object: o,
  objectType: "literal",
  ...(datatype !== undefined ? { datatype } : {}),
});
const ex = (local: string) => `${NS.ex}${local}`;

function cls(
  id: string,
  parent: string | null,
  label: string,
  comment: string,
): RDFTriple[] {
  const iri = ex(id);
  const out = [
    u(iri, RDF_TYPE, OWL_CLASS),
    lit(iri, RDFS_LABEL, label),
    lit(iri, RDFS_COMMENT, comment),
  ];
  if (parent !== null) out.push(u(iri, RDFS_SUBCLASS, ex(parent)));
  return out;
}

function objProp(
  id: string,
  label: string,
  domain: string,
  range: string,
  extras: RDFTriple[] = [],
): RDFTriple[] {
  const iri = ex(id);
  return [
    u(iri, RDF_TYPE, OWL_OBJECT_PROP),
    lit(iri, RDFS_LABEL, label),
    u(iri, RDFS_DOMAIN, ex(domain)),
    u(iri, RDFS_RANGE, ex(range)),
    ...extras,
  ];
}

function dataProp(
  id: string,
  label: string,
  domain: string,
  range: string,
): RDFTriple[] {
  const iri = ex(id);
  return [
    u(iri, RDF_TYPE, OWL_DATA_PROP),
    lit(iri, RDFS_LABEL, label),
    u(iri, RDFS_DOMAIN, ex(domain)),
    u(iri, RDFS_RANGE, `${NS.xsd}${range}`),
  ];
}

export function buildOntologyGraph(): RDFGraph {
  const t: RDFTriple[] = [];

  // Ontology header (requirement 9's annotation source).
  t.push(
    u(NS.ex, RDF_TYPE, OWL_ONTOLOGY),
    lit(NS.ex, RDFS_LABEL, "Spacecraft demo ontology"),
    lit(
      NS.ex,
      RDFS_COMMENT,
      "Seeded demo ontology for the g3-toolkit Ontology Workbench: a small spacecraft domain with subclass, inverse, symmetric, transitive, and equivalent-class axioms the demo reasoner materializes.",
    ),
    lit(NS.ex, `${NS.owl}versionInfo`, "1.0.0"),
    lit(NS.ex, `${NS.dc}creator`, "g3-toolkit demo"),
  );

  // ── TBox: classes ────────────────────────────────────────────────
  t.push(
    ...cls("Artifact", null, "Artifact", "Anything engineered."),
    ...cls(
      "System",
      "Artifact",
      "System",
      "An assembled artifact with subsystems.",
    ),
    ...cls(
      "Spacecraft",
      "System",
      "Spacecraft",
      "A system that operates in space.",
    ),
    ...cls("Satellite", "Spacecraft", "Satellite", "An orbiting spacecraft."),
    ...cls(
      "Probe",
      "Spacecraft",
      "Probe",
      "A spacecraft on an escape or transfer trajectory.",
    ),
    ...cls(
      "GroundStation",
      "System",
      "Ground station",
      "A terrestrial communication system.",
    ),
    ...cls(
      "Subsystem",
      "Artifact",
      "Subsystem",
      "A functional slice of a system.",
    ),
    ...cls(
      "PowerSubsystem",
      "Subsystem",
      "Power subsystem",
      "Generation, storage, distribution.",
    ),
    ...cls(
      "PropulsionSubsystem",
      "Subsystem",
      "Propulsion subsystem",
      "Thrust and attitude authority.",
    ),
    ...cls(
      "CommSubsystem",
      "Subsystem",
      "Comm subsystem",
      "RF communication chain.",
    ),
    ...cls(
      "CommsSubsystem",
      "Subsystem",
      "Comms subsystem (alias)",
      "Equivalent alias class, for the equivalence demo.",
    ),
    ...cls(
      "Component",
      "Artifact",
      "Component",
      "A replaceable engineered part.",
    ),
    ...cls(
      "SolarPanel",
      "Component",
      "Solar panel",
      "Photovoltaic generation.",
    ),
    ...cls("Battery", "Component", "Battery", "Energy storage."),
    ...cls("Thruster", "Component", "Thruster", "Reaction thrust device."),
    ...cls("Antenna", "Component", "Antenna", "RF aperture."),
    ...cls("Document", "Artifact", "Document", "Engineering documentation."),
    ...cls("Requirement", "Document", "Requirement", "A shall-statement."),
    ...cls("TestReport", "Document", "Test report", "Verification evidence."),
    ...cls("Mission", null, "Mission", "An operational undertaking."),
    ...cls("Orbit", null, "Orbit", "An orbital regime."),
    ...cls("Organization", null, "Organization", "An operating entity."),
  );
  t.push(u(ex("CommsSubsystem"), OWL_EQUIVALENT, ex("CommSubsystem")));
  t.push(u(ex("Spacecraft"), OWL_DISJOINT, ex("GroundStation")));

  // ── TBox: properties ─────────────────────────────────────────────
  t.push(
    ...objProp("hasSubsystem", "has subsystem", "System", "Subsystem", [
      u(ex("hasSubsystem"), OWL_INVERSE, ex("subsystemOf")),
    ]),
    ...objProp("subsystemOf", "subsystem of", "Subsystem", "System"),
    // OW-F1: hasComponent was declared inverseOf partOf, pairing a
    // specific property (Subsystem -> Component) with the generic
    // transitive mereology (Artifact -> Artifact). Any asserted
    // "X partOf aquila1" materialized "aquila1 hasComponent X", and
    // hasComponent's domain then entailed aquila1 rdf:type Subsystem
    // (a Satellite typed as a Subsystem). Even ignoring the domain
    // clash, partOf's inverse is hasPart, not hasComponent. No demo
    // rode this inverse: transitivity rides partOf itself, the
    // subproperty demo rides hasPrimaryAntenna, and the
    // inverse-entailment demo rides hasSubsystem/subsystemOf.
    ...objProp("hasComponent", "has component", "Subsystem", "Component"),
    ...objProp("partOf", "part of", "Artifact", "Artifact", [
      u(ex("partOf"), RDF_TYPE, OWL_TRANSITIVE),
    ]),
    // Symmetric properties must have symmetric domain/range: the
    // original draft gave communicatesWith range GroundStation, and
    // the reasoner faithfully typed satellites as GroundStations via
    // the materialized reverse (with Spacecraft disjointWith
    // GroundStation, a DL reasoner would call the ontology
    // inconsistent; the demo reasoner does no consistency checking,
    // so the flaw surfaced as spurious closed-shape violations).
    ...objProp("communicatesWith", "communicates with", "System", "System", [
      u(ex("communicatesWith"), RDF_TYPE, OWL_SYMMETRIC),
    ]),
    // Non-symmetric link carrying the range-entailment demo: gsAlpha
    // is typed GroundStation only because something uplinksTo it.
    ...objProp("uplinksTo", "uplinks to", "Spacecraft", "GroundStation"),
    ...objProp("operates", "operates", "Organization", "Spacecraft"),
    ...objProp("inOrbit", "in orbit", "Satellite", "Orbit"),
    ...objProp("verifies", "verifies", "TestReport", "Requirement"),
    ...objProp("specifies", "specifies", "Requirement", "System"),
    ...objProp("flownOn", "flown on", "Spacecraft", "Mission"),
    ...dataProp("mass", "mass (kg)", "Artifact", "decimal"),
    ...dataProp("launchDate", "launch date", "Spacecraft", "date"),
    ...dataProp("powerOutput", "power output (W)", "SolarPanel", "decimal"),
    ...dataProp("callSign", "call sign", "GroundStation", "string"),
  );
  // Annotation property (requirement 1: annotation properties browsable).
  t.push(
    u(ex("reviewStatus"), RDF_TYPE, OWL_ANN_PROP),
    lit(ex("reviewStatus"), RDFS_LABEL, "review status"),
    u(`${NS.dc}creator`, RDF_TYPE, OWL_ANN_PROP),
  );
  // subPropertyOf demo: hasPrimaryAntenna sub hasComponent.
  t.push(
    u(ex("hasPrimaryAntenna"), RDF_TYPE, OWL_OBJECT_PROP),
    lit(ex("hasPrimaryAntenna"), RDFS_LABEL, "has primary antenna"),
    u(ex("hasPrimaryAntenna"), RDFS_SUBPROP, ex("hasComponent")),
  );

  // ── ABox: individuals ────────────────────────────────────────────
  const ind = (id: string, type: string, label: string): RDFTriple[] => [
    u(ex(id), RDF_TYPE, ex(type)),
    lit(ex(id), RDFS_LABEL, label),
  ];
  t.push(
    ...ind("aquila1", "Satellite", "Aquila-1"),
    ...ind("aquila2", "Satellite", "Aquila-2"), // Spacecraft only via inference
    ...ind("borealis", "Probe", "Borealis"),
    ...ind("gsBravo", "GroundStation", "GS Bravo"),
    // gsAlpha: NO asserted type; range entailment must supply it.
    lit(ex("gsAlpha"), RDFS_LABEL, "GS Alpha"),
    ...ind("pwr1", "PowerSubsystem", "Aquila-1 power"),
    ...ind("prop1", "PropulsionSubsystem", "Aquila-1 propulsion"),
    ...ind("comm1", "CommsSubsystem", "Aquila-1 comms"), // alias class
    ...ind("pwr2", "PowerSubsystem", "Aquila-2 power"),
    ...ind("panelA", "SolarPanel", "Panel A"),
    ...ind("panelB", "SolarPanel", "Panel B"),
    ...ind("batt1", "Battery", "Battery 1"),
    ...ind("thr1", "Thruster", "Thruster 1"),
    ...ind("ant1", "Antenna", "High-gain antenna"),
    ...ind("leo1", "Orbit", "LEO 550km"),
    ...ind("geo1", "Orbit", "GEO slot 12"),
    ...ind("acme", "Organization", "ACME Orbital"),
    ...ind("m1", "Mission", "Mission Skylark"),
    ...ind("req1", "Requirement", "REQ-001 Power margin"),
    ...ind("req2", "Requirement", "REQ-002 Link budget"),
    ...ind("tr1", "TestReport", "TR-045 Power soak"),
  );
  t.push(
    u(ex("aquila1"), ex("hasSubsystem"), ex("pwr1")),
    u(ex("aquila1"), ex("hasSubsystem"), ex("prop1")),
    u(ex("aquila1"), ex("hasSubsystem"), ex("comm1")),
    // Inverse-only assertion: pwr2 subsystemOf aquila2 (hasSubsystem inferred).
    u(ex("pwr2"), ex("subsystemOf"), ex("aquila2")),
    u(ex("pwr1"), ex("hasComponent"), ex("panelA")),
    u(ex("pwr1"), ex("hasComponent"), ex("batt1")),
    u(ex("pwr2"), ex("hasComponent"), ex("panelB")),
    u(ex("comm1"), ex("hasPrimaryAntenna"), ex("ant1")), // subPropertyOf demo
    // Transitive chain: thr1 partOf prop1 partOf aquila1.
    u(ex("thr1"), ex("partOf"), ex("prop1")),
    u(ex("prop1"), ex("partOf"), ex("aquila1")),
    // Symmetric, one direction; range entailment types gsAlpha.
    u(ex("aquila1"), ex("communicatesWith"), ex("gsAlpha")),
    u(ex("aquila1"), ex("uplinksTo"), ex("gsAlpha")),
    u(ex("aquila2"), ex("communicatesWith"), ex("gsBravo")),
    u(ex("acme"), ex("operates"), ex("aquila1")),
    u(ex("acme"), ex("operates"), ex("aquila2")),
    u(ex("aquila1"), ex("inOrbit"), ex("leo1")),
    u(ex("aquila2"), ex("inOrbit"), ex("geo1")),
    u(ex("aquila1"), ex("flownOn"), ex("m1")),
    u(ex("req1"), ex("specifies"), ex("aquila1")),
    u(ex("req2"), ex("specifies"), ex("aquila1")),
    u(ex("tr1"), ex("verifies"), ex("req1")),
    lit(ex("aquila1"), ex("mass"), "412.5", `${NS.xsd}decimal`),
    lit(ex("aquila2"), ex("mass"), "398.0", `${NS.xsd}decimal`),
    lit(ex("aquila1"), ex("launchDate"), "2024-03-18", `${NS.xsd}date`),
    lit(ex("panelA"), ex("powerOutput"), "1200", `${NS.xsd}decimal`),
    lit(ex("panelB"), ex("powerOutput"), "1150", `${NS.xsd}decimal`),
    lit(ex("gsBravo"), ex("callSign"), "BRAVO-7"),
    lit(ex("req1"), ex("reviewStatus"), "approved"),
    lit(ex("req2"), ex("reviewStatus"), "draft"),
  );
  // Note: gsAlpha has NO callSign; GroundStationShape flags it once
  // range entailment brings it into the target class.

  return { triples: t };
}

/** SHACL shapes as core structures (validator + structural converter). */
export function buildShapes(): ShaclShape[] {
  return [
    {
      id: ex("SatelliteShape"),
      name: "SatelliteShape",
      targetClass: ex("Satellite"),
      properties: [
        {
          path: ex("mass"),
          name: "mass",
          datatype: "number",
          minCount: 1,
          maxCount: 1,
        },
        {
          path: ex("hasSubsystem"),
          name: "hasSubsystem",
          minCount: 1,
          maxCount: 8,
        },
        {
          path: ex("launchDate"),
          name: "launchDate",
          datatype: "date",
          maxCount: 1,
        },
        { path: ex("inOrbit"), name: "inOrbit", minCount: 1, maxCount: 1 },
      ],
    },
    {
      id: ex("SubsystemShape"),
      name: "SubsystemShape",
      targetClass: ex("Subsystem"),
      properties: [
        { path: ex("hasComponent"), name: "hasComponent", minCount: 1 },
      ],
    },
    {
      id: ex("GroundStationShape"),
      name: "GroundStationShape",
      targetClass: ex("GroundStation"),
      closed: true,
      // Checklist 7b question (answered 2026-07-07): the reviewed
      // name/kind closed violations on gsBravo were the PRE-round-1
      // behavior; the display/validation projection split (3.1) fixed
      // them (see project.test.ts), and gsBravo conforming on
      // asserted data is the pinned contract. No fixture change
      // needed; browser re-verify.
      ignoredProperties: [RDF_TYPE, RDFS_LABEL, ex("communicatesWith")],
      properties: [
        {
          path: ex("callSign"),
          name: "callSign",
          datatype: "string",
          minCount: 1,
          maxCount: 1,
        },
      ],
    },
    {
      id: ex("RequirementShape"),
      name: "RequirementShape",
      targetClass: ex("Requirement"),
      properties: [
        { path: ex("specifies"), name: "specifies", minCount: 1 },
        {
          path: ex("reviewStatus"),
          name: "reviewStatus",
          in: ["approved", "draft"],
        },
      ],
    },
  ];
}

/** Reference edges for the structural view: shape property -> target shape. */
export function shapeReferences(): Record<string, string> {
  return {
    [`${ex("SatelliteShape")}::${ex("hasSubsystem")}`]: ex("SubsystemShape"),
    [`${ex("SubsystemShape")}::${ex("hasComponent")}`]: ex("SatelliteShape"),
  };
}
