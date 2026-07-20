/**
 * A small SysML-flavored model for the satellite MBSE shell, structured the
 * way Cameo/MagicDraw organizes a project: a containment tree of packages
 * that own model elements (blocks, constraint blocks, requirements) and
 * diagrams. A diagram is a typed VIEW (bdd / ibd / par / req) over a subset
 * of the model; selecting it in the tree projects that subset into a
 * StructuralGraphInput (see diagrams.ts) and loads it into the linked graph
 * view. Membership is explicit per diagram (not inferred) so a diagram shows
 * exactly what its author put on it, as in a real tool.
 *
 * This is example data, not a general SysML metamodel: it carries only the
 * fields the four diagram projections need.
 */

export type DiagramType = "bdd" | "ibd" | "par" | "req";

/** A value property (attribute) on a block: `name: Type [mult]`. */
export interface ValueProperty {
  id: string;
  name: string;
  type: string;
  multiplicity?: string;
}

/** A flow/standard port on a block or part. */
export interface FlowPort {
  id: string;
  name: string;
  direction: "in" | "out" | "inout";
  /** Carried item (e.g. "Power", "TelemetryFrame"). */
  type?: string;
  /** Preferred side on the owning box; the router still owns final routing. */
  side?: "NORTH" | "SOUTH" | "EAST" | "WEST";
}

/** A part property inside an IBD: an instance role typed by a block. */
export interface PartProperty {
  id: string;
  name: string;
  /** Block id this part is typed by. */
  type: string;
  ports: FlowPort[];
}

export interface Block {
  id: string;
  kind: "block" | "constraint";
  name: string;
  /** Overrides the default stereotype («block» / «constraint»). */
  stereotype?: string;
  values?: ValueProperty[];
  operations?: string[];
  /** IBD context blocks own parts (typed by other blocks). */
  parts?: PartProperty[];
  /** Boundary ports (BDD flow ports, IBD delegation). */
  ports?: FlowPort[];
  /** Constraint blocks own parameters and an equation. */
  parameters?: ValueProperty[];
  constraint?: string;
}

export interface Requirement {
  id: string;
  reqId: string;
  name: string;
  text: string;
  children?: Requirement[];
}

export type RelationshipKind =
  | "composition"
  | "aggregation"
  | "generalization"
  | "dependency"
  | "association";

export interface Relationship {
  id: string;
  kind: RelationshipKind;
  source: string;
  target: string;
  /** e.g. «satisfy», «deriveReqt», «verify»; drives the edge label. */
  stereotype?: string;
  label?: string;
}

/** An IBD connector between two part ports. */
export interface Connector {
  id: string;
  sourcePart: string;
  sourcePort: string;
  targetPart: string;
  targetPort: string;
  label?: string;
}

/** A parametric binding: a value property bound to a constraint parameter. */
export interface Binding {
  id: string;
  /** Display label of the bound value ("PowerSubsystem.solarArrayPower"). */
  value: string;
  /** "constraintBlockId.parameterId". */
  param: string;
}

export interface Diagram {
  id: string;
  name: string;
  type: DiagramType;
  /** Owning element: a block id (bdd/ibd/par) or the requirements package. */
  context: string;
  blocks?: string[];
  relationships?: string[];
  connectors?: string[];
  bindings?: string[];
  /** Root requirement ids (req diagrams). */
  requirements?: string[];
}

export interface Package {
  id: string;
  name: string;
  packages?: Package[];
  blocks?: string[];
  requirements?: string[];
  diagrams?: string[];
}

export interface SysMLModel {
  root: Package;
  blocks: Record<string, Block>;
  requirements: Record<string, Requirement>;
  relationships: Record<string, Relationship>;
  connectors: Record<string, Connector>;
  bindings: Record<string, Binding>;
  diagrams: Record<string, Diagram>;
}

// ── Satellite fixture ────────────────────────────────────────────────────
// A small Earth-observation smallsat: five subsystems, an internal block
// diagram of power/data/RF flow, a power-budget parametric, and a mission
// requirement breakdown with satisfy links.

const blocks: Record<string, Block> = {
  smallsat: {
    id: "smallsat",
    kind: "block",
    name: "SmallSat",
    values: [
      { id: "smallsat.mass", name: "mass", type: "kg", multiplicity: "1" },
      { id: "smallsat.orbit", name: "orbitAltitude", type: "km" },
    ],
    parts: [
      {
        id: "p.power",
        name: "power",
        type: "eps",
        ports: [
          {
            id: "p.power.pout",
            name: "pwrOut",
            direction: "out",
            type: "Power",
            side: "EAST",
          },
        ],
      },
      {
        id: "p.adcs",
        name: "adcs",
        type: "adcs",
        ports: [
          {
            id: "p.adcs.din",
            name: "dataIn",
            direction: "in",
            type: "Cmd",
            side: "WEST",
          },
          {
            id: "p.adcs.pin",
            name: "pwrIn",
            direction: "in",
            type: "Power",
            side: "SOUTH",
          },
        ],
      },
      {
        id: "p.obc",
        name: "obc",
        type: "obc",
        ports: [
          {
            id: "p.obc.bus",
            name: "dataBus",
            direction: "inout",
            type: "Data",
            side: "EAST",
          },
          {
            id: "p.obc.pin",
            name: "pwrIn",
            direction: "in",
            type: "Power",
            side: "SOUTH",
          },
        ],
      },
      {
        id: "p.comms",
        name: "comms",
        type: "comms",
        ports: [
          {
            id: "p.comms.din",
            name: "dataIn",
            direction: "in",
            type: "Data",
            side: "WEST",
          },
          {
            id: "p.comms.rf",
            name: "rfOut",
            direction: "out",
            type: "RF",
            side: "EAST",
          },
          {
            id: "p.comms.pin",
            name: "pwrIn",
            direction: "in",
            type: "Power",
            side: "SOUTH",
          },
        ],
      },
      {
        id: "p.payload",
        name: "payload",
        type: "imager",
        ports: [
          {
            id: "p.payload.dout",
            name: "imgOut",
            direction: "out",
            type: "Data",
            side: "WEST",
          },
          {
            id: "p.payload.pin",
            name: "pwrIn",
            direction: "in",
            type: "Power",
            side: "SOUTH",
          },
        ],
      },
    ],
  },
  eps: {
    id: "eps",
    kind: "block",
    name: "PowerSubsystem",
    stereotype: "block",
    values: [
      { id: "eps.cap", name: "batteryCapacity", type: "Wh" },
      { id: "eps.gen", name: "solarArrayPower", type: "W" },
    ],
    ports: [
      {
        id: "eps.pout",
        name: "pwrOut",
        direction: "out",
        type: "Power",
        side: "EAST",
      },
    ],
  },
  adcs: {
    id: "adcs",
    kind: "block",
    name: "ADCS",
    values: [{ id: "adcs.point", name: "pointingError", type: "deg" }],
    operations: ["detumble()", "pointAt(target)"],
    ports: [
      {
        id: "adcs.din",
        name: "cmdIn",
        direction: "in",
        type: "Cmd",
        side: "WEST",
      },
    ],
  },
  obc: {
    id: "obc",
    kind: "block",
    name: "OBC",
    values: [{ id: "obc.cpu", name: "throughput", type: "MIPS" }],
    ports: [
      {
        id: "obc.bus",
        name: "dataBus",
        direction: "inout",
        type: "Data",
        side: "EAST",
      },
    ],
  },
  comms: {
    id: "comms",
    kind: "block",
    name: "CommsSubsystem",
    values: [
      { id: "comms.eirp", name: "eirp", type: "dBW" },
      { id: "comms.rate", name: "downlinkRate", type: "Mbps" },
    ],
    ports: [
      {
        id: "comms.rf",
        name: "rfOut",
        direction: "out",
        type: "RF",
        side: "EAST",
      },
    ],
  },
  imager: {
    id: "imager",
    kind: "block",
    name: "Payload",
    stereotype: "block",
    values: [
      { id: "imager.gsd", name: "groundSampleDist", type: "m" },
      { id: "imager.draw", name: "powerDraw", type: "W" },
    ],
    ports: [
      {
        id: "imager.dout",
        name: "imgOut",
        direction: "out",
        type: "Data",
        side: "WEST",
      },
    ],
  },
  powerBudget: {
    id: "powerBudget",
    kind: "constraint",
    name: "PowerBudget",
    constraint: "margin = generated - consumed",
    parameters: [
      { id: "powerBudget.generated", name: "generated", type: "W" },
      { id: "powerBudget.consumed", name: "consumed", type: "W" },
      { id: "powerBudget.margin", name: "margin", type: "W" },
    ],
  },
};

const testCases: Record<string, Block> = {
  "tc.imaging": {
    id: "tc.imaging",
    kind: "block",
    name: "ImagingAcceptanceTest",
    stereotype: "testCase",
    operations: ["captureReferenceScene()", "assessGSD()"],
  },
};

const requirements: Record<string, Requirement> = {
  mission: {
    id: "mission",
    reqId: "R1",
    name: "Mission",
    text: "The satellite shall image designated ground targets and downlink imagery.",
    children: [
      {
        id: "req.power",
        reqId: "R1.1",
        name: "Power",
        text: "The EPS shall supply positive power margin across all mission modes.",
      },
      {
        id: "req.point",
        reqId: "R1.2",
        name: "Pointing",
        text: "The ADCS shall hold pointing error below 0.1 deg during imaging.",
      },
      {
        id: "req.downlink",
        reqId: "R1.3",
        name: "Downlink",
        text: "The comms subsystem shall downlink at >= 50 Mbps to a ground station.",
      },
      {
        id: "req.image",
        reqId: "R1.4",
        name: "Imaging",
        text: "The payload shall achieve <= 3 m ground sample distance.",
      },
    ],
  },
};

const relationships: Record<string, Relationship> = {
  // BDD composition: SmallSat is composed of its five subsystems.
  "c.power": {
    id: "c.power",
    kind: "composition",
    source: "smallsat",
    target: "eps",
  },
  "c.adcs": {
    id: "c.adcs",
    kind: "composition",
    source: "smallsat",
    target: "adcs",
  },
  "c.obc": {
    id: "c.obc",
    kind: "composition",
    source: "smallsat",
    target: "obc",
  },
  "c.comms": {
    id: "c.comms",
    kind: "composition",
    source: "smallsat",
    target: "comms",
  },
  "c.payload": {
    id: "c.payload",
    kind: "composition",
    source: "smallsat",
    target: "imager",
  },
  // Requirement satisfy links: subsystem blocks satisfy leaf requirements.
  "s.power": {
    id: "s.power",
    kind: "dependency",
    source: "eps",
    target: "req.power",
    stereotype: "satisfy",
  },
  "s.point": {
    id: "s.point",
    kind: "dependency",
    source: "adcs",
    target: "req.point",
    stereotype: "satisfy",
  },
  "s.downlink": {
    id: "s.downlink",
    kind: "dependency",
    source: "comms",
    target: "req.downlink",
    stereotype: "satisfy",
  },
  "s.image": {
    id: "s.image",
    kind: "dependency",
    source: "imager",
    target: "req.image",
    stereotype: "satisfy",
  },
  // Review 6.5: verification traceability. The imaging acceptance
  // test VERIFIES the imaging requirement; the power-budget
  // constraint block SATISFIES the power requirement analytically
  // (its binding is the satisfaction argument).
  "v.image": {
    id: "v.image",
    kind: "dependency",
    source: "tc.imaging",
    target: "req.image",
    stereotype: "verify",
  },
  "s.budget": {
    id: "s.budget",
    kind: "dependency",
    source: "powerBudget",
    target: "req.power",
    stereotype: "satisfy",
  },
};

const connectors: Record<string, Connector> = {
  // IBD: power distribution + data path + RF downlink.
  "n.pwr.adcs": {
    id: "n.pwr.adcs",
    sourcePart: "p.power",
    sourcePort: "p.power.pout",
    targetPart: "p.adcs",
    targetPort: "p.adcs.pin",
    label: "Power",
  },
  "n.pwr.obc": {
    id: "n.pwr.obc",
    sourcePart: "p.power",
    sourcePort: "p.power.pout",
    targetPart: "p.obc",
    targetPort: "p.obc.pin",
    label: "Power",
  },
  "n.pwr.comms": {
    id: "n.pwr.comms",
    sourcePart: "p.power",
    sourcePort: "p.power.pout",
    targetPart: "p.comms",
    targetPort: "p.comms.pin",
    label: "Power",
  },
  "n.pwr.payload": {
    id: "n.pwr.payload",
    sourcePart: "p.power",
    sourcePort: "p.power.pout",
    targetPart: "p.payload",
    targetPort: "p.payload.pin",
    label: "Power",
  },
  "n.img.obc": {
    id: "n.img.obc",
    sourcePart: "p.payload",
    sourcePort: "p.payload.dout",
    targetPart: "p.obc",
    targetPort: "p.obc.bus",
    label: "Imagery",
  },
  "n.data.comms": {
    id: "n.data.comms",
    sourcePart: "p.obc",
    sourcePort: "p.obc.bus",
    targetPart: "p.comms",
    targetPort: "p.comms.din",
    label: "Frames",
  },
  "n.cmd.adcs": {
    id: "n.cmd.adcs",
    sourcePart: "p.obc",
    sourcePort: "p.obc.bus",
    targetPart: "p.adcs",
    targetPort: "p.adcs.din",
    label: "Cmd",
  },
};

const bindings: Record<string, Binding> = {
  "b.gen": {
    id: "b.gen",
    value: "power.solarArrayPower",
    param: "powerBudget.generated",
  },
  "b.con": {
    id: "b.con",
    value: "payload.powerDraw",
    param: "powerBudget.consumed",
  },
};

const diagrams: Record<string, Diagram> = {
  "dg.bdd": {
    id: "dg.bdd",
    name: "SmallSat Structure",
    type: "bdd",
    context: "smallsat",
    blocks: ["smallsat", "eps", "adcs", "obc", "comms", "imager"],
    relationships: ["c.power", "c.adcs", "c.obc", "c.comms", "c.payload"],
  },
  "dg.ibd": {
    id: "dg.ibd",
    name: "SmallSat Internal",
    type: "ibd",
    context: "smallsat",
    connectors: [
      "n.pwr.adcs",
      "n.pwr.obc",
      "n.pwr.comms",
      "n.pwr.payload",
      "n.img.obc",
      "n.data.comms",
      "n.cmd.adcs",
    ],
  },
  "dg.par": {
    id: "dg.par",
    name: "Power Budget",
    type: "par",
    context: "powerBudget",
    bindings: ["b.gen", "b.con"],
  },
  "dg.req": {
    id: "dg.req",
    name: "Requirements",
    type: "req",
    context: "requirements",
    requirements: ["mission"],
    relationships: [
      "s.power",
      "s.point",
      "s.downlink",
      "s.image",
      "v.image",
      "s.budget",
    ],
  },
};

const root: Package = {
  id: "pkg.root",
  name: "Satellite System",
  packages: [
    {
      id: "pkg.structure",
      name: "Structure",
      blocks: ["smallsat", "eps", "adcs", "obc", "comms", "imager"],
      diagrams: ["dg.bdd", "dg.ibd"],
    },
    {
      id: "pkg.analysis",
      name: "Analysis",
      blocks: ["powerBudget"],
      diagrams: ["dg.par"],
    },
    {
      id: "pkg.requirements",
      name: "Requirements",
      requirements: ["mission"],
      diagrams: ["dg.req"],
    },
  ],
};

export const satelliteModel: SysMLModel = {
  root,
  blocks: { ...blocks, ...testCases },
  requirements,
  relationships,
  connectors,
  bindings,
  diagrams,
};
