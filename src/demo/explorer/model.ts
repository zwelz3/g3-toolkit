/**
 * Model Explorer sample data, held as one versioned JSON document.
 *
 * The explorer answers "what does this data model mean, and where does
 * each piece come from" for three layers of one model: the CONCEPT
 * (vocabulary: definitions, patterns, units), the CONTRACT (shapes:
 * datatype, cardinality, constraints) and the REALIZATION (the code's
 * fields). A model-trace document carries all three per property, plus
 * the relations between classes, so every view in the shell is a pure
 * projection of this one document (the toolkit's documents channel: an
 * upstream pipeline computes the trace, the UI only renders it).
 *
 * Every class name, definition and value below is ILLUSTRATIVE: a small
 * satellite-payload model shaped to exercise each view state (a full
 * trace, a property the code never built, a code list the code
 * disagrees with, a field with no concept, an internal field).
 */

/** Per-layer presence: 1 present, 0 absent, "w" present but disagreeing. */
export type LayerMark = 0 | 1 | "w";

export type Pattern =
  | "Identity"
  | "Quantity"
  | "Code"
  | "Temporal"
  | "Provenance";

export interface TraceProperty {
  key: string;
  /** Null when the property has no concept (lands in Unclassified). */
  pattern: Pattern | null;
  layers: { c: LayerMark; s: LayerMark; r: LayerMark };
  /** Contract datatype (xsd local name), JSON type, cardinality. */
  xsd?: string;
  json?: string;
  card?: string;
  constraint?: string;
  /** Realization: field name and type, plus the stored unit. */
  rust: string | null;
  rustType: string | null;
  store?: string;
  /** Concept: quantity kind and canonical unit, code list, definition. */
  unit?: string;
  qk?: string;
  codes?: string[];
  enumName?: string;
  def: string | null;
  scope?: string;
  /** Set when layers disagree; the text names the disagreement. */
  conflict?: string;
  /** Never projected to the API. */
  internal?: boolean;
  /** Example value from a conformance fixture. */
  ex: string | null;
}

export interface TraceClass {
  id: string;
  module: string;
  def: string;
  super?: string;
  props: TraceProperty[];
}

export type RelationKind = "isa" | "composition" | "reference";

export interface TraceRelation {
  from: string;
  to: string;
  kind: RelationKind;
  key: string;
  /** Multiplicity at the target end, e.g. "1..*"; empty for isa. */
  card: string;
}

export interface TraceRejection {
  value: string;
  msg: string;
}

export interface ModelTraceDocument {
  kind: "model-trace";
  version: 1;
  contract: string;
  classes: TraceClass[];
  relations: TraceRelation[];
  /** A sample rejected write per class, keyed class then property. */
  rejections: Record<string, Record<string, TraceRejection>>;
}

function P(
  key: string,
  pattern: Pattern | null,
  o: Partial<TraceProperty> & { def: string | null; ex: string | null },
): TraceProperty {
  return {
    key,
    pattern,
    layers: { c: 1, s: 1, r: 1 },
    rust: key,
    rustType: null,
    ...o,
  };
}

function ID(cls: string, ex: string, rustType: string): TraceProperty {
  return P("id", "Identity", {
    xsd: "IRI",
    json: "string (IRI)",
    rustType,
    card: "[1]",
    def: "Persistent identifier of the " + cls + ".",
    ex,
  });
}

const DT = { xsd: "dateTime", json: "string (date-time)" };

export const SAMPLE_TRACE: ModelTraceDocument = {
  kind: "model-trace",
  version: 1,
  contract: "3.2",
  classes: [
    {
      id: "PayloadComponent",
      module: "Payload",
      def: "A component of the spacecraft payload.",
      props: [
        P("serialNumber", "Identity", {
          xsd: "string",
          json: "string",
          rust: "serial_number",
          rustType: "String",
          card: "[1]",
          def: "Manufacturer serial number, unique per manufacturer.",
          ex: '"PC-0193"',
        }),
        P("mass", "Quantity", {
          xsd: "double",
          json: "number",
          rust: "mass_kg",
          rustType: "f64",
          store: "kg",
          unit: "kg",
          qk: "Mass",
          card: "[0..1]",
          constraint: "> 0",
          def: "Dry mass of the component.",
          ex: "12.4",
        }),
      ],
    },
    {
      id: "Transponder",
      module: "Payload",
      super: "PayloadComponent",
      def: "A payload component that receives an uplink signal, translates its frequency, amplifies it and retransmits it on a downlink.",
      props: [
        ID("transponder", '"urn:example:transponder:7"', "TransponderId"),
        P("instantaneousBandwidth", "Quantity", {
          xsd: "double",
          json: "number",
          rust: "bw_mhz",
          rustType: "f64",
          store: "MHz",
          unit: "MHz",
          qk: "Frequency",
          card: "[1]",
          constraint: "> 0",
          def: "The frequency span the transponder can process at one time without retuning.",
          scope: "Not occupied bandwidth, and not regulatory allocation.",
          ex: "36.0",
        }),
        P("saturationFlux", "Quantity", {
          layers: { c: 1, s: 1, r: 0 },
          xsd: "double",
          json: "number",
          rust: null,
          rustType: null,
          unit: "dBW/m²",
          qk: "Power flux density",
          card: "[0..1]",
          def: "Flux density at the satellite that drives the transponder to saturation.",
          ex: null,
        }),
        P("band", "Code", {
          layers: { c: 1, s: 1, r: "w" },
          xsd: "string",
          json: "enum",
          rust: "band",
          rustType: "Band (enum)",
          enumName: "BandKind",
          codes: ["C", "Ku", "Ka"],
          card: "[1]",
          def: "Frequency band the transponder operates in.",
          conflict:
            "The contract allows C, Ku and Ka. The Rust enum Band has C and Ku only.",
          ex: '"Ku"',
        }),
        P("commissionedAt", "Temporal", {
          ...DT,
          rust: "commissioned_at",
          rustType: "DateTime<Utc>",
          card: "[0..1]",
          def: "UTC instant at which the transponder entered service.",
          ex: '"2024-03-02T00:00Z"',
        }),
        P("legacyMode", null, {
          layers: { c: 0, s: 1, r: 1 },
          xsd: "boolean",
          json: "boolean",
          rust: "legacy_mode",
          rustType: "bool",
          card: "[0..1]",
          def: null,
          ex: "false",
        }),
        P("cache_epoch", null, {
          layers: { c: 0, s: 0, r: 1 },
          internal: true,
          rust: "cache_epoch",
          rustType: "u64",
          def: null,
          ex: null,
        }),
      ],
    },
    {
      id: "Channel",
      module: "Payload",
      def: "A contiguous frequency segment processed by exactly one transponder.",
      props: [
        ID("channel", '"urn:example:channel:71"', "ChannelId"),
        P("centerFrequency", "Quantity", {
          xsd: "double",
          json: "number",
          rust: "center_freq_hz",
          rustType: "f64",
          store: "Hz, converted",
          unit: "MHz",
          qk: "Frequency",
          card: "[1]",
          constraint: "> 0",
          def: "Center of the channel frequency segment.",
          ex: "11745.0",
        }),
        P("polarization", "Code", {
          xsd: "string",
          json: "enum",
          rustType: "Polarization (enum)",
          enumName: "PolarizationKind",
          codes: ["LHCP", "RHCP", "H", "V"],
          card: "[1]",
          def: "Polarization of the signal carried by the channel.",
          ex: '"H"',
        }),
      ],
    },
    {
      id: "Satellite",
      module: "Spacecraft",
      def: "A spacecraft in orbit that carries one or more payloads.",
      props: [
        ID("satellite", '"urn:example:satellite:3"', "SatelliteId"),
        P("noradId", "Identity", {
          xsd: "string",
          json: "string",
          rust: "norad_id",
          rustType: "String",
          card: "[0..1]",
          def: "Catalog number assigned after launch.",
          ex: '"99999"',
        }),
        P("launchDate", "Temporal", {
          xsd: "date",
          json: "string (date)",
          rust: "launch_date",
          rustType: "NaiveDate",
          card: "[0..1]",
          def: "Date of launch.",
          ex: '"2023-11-14"',
        }),
      ],
    },
    {
      id: "FrequencyPlan",
      module: "Spectrum",
      def: "An approved assignment of frequency segments to transponders and channels.",
      props: [
        ID("frequency plan", '"urn:example:plan:12"', "PlanId"),
        P("effectiveFrom", "Temporal", {
          ...DT,
          rust: "effective_from",
          rustType: "DateTime<Utc>",
          card: "[1]",
          def: "Instant from which the plan applies.",
          ex: '"2024-01-01T00:00Z"',
        }),
      ],
    },
    {
      id: "GroundStation",
      module: "Ground",
      def: "A ground facility that commands and monitors payload equipment.",
      props: [
        ID("ground station", '"urn:example:station:4"', "StationId"),
        P("latitude", "Quantity", {
          xsd: "double",
          json: "number",
          rust: "lat_deg",
          rustType: "f64",
          store: "deg",
          unit: "deg",
          qk: "Angle",
          card: "[1]",
          constraint: "-90 to 90",
          def: "Geodetic latitude of the antenna.",
          ex: "38.9",
        }),
      ],
    },
    {
      id: "LinkBudget",
      module: "Link analysis",
      def: "A calculation of signal gains and losses along one link.",
      props: [
        ID("link budget", '"urn:example:budget:88"', "BudgetId"),
        P("eirp", "Quantity", {
          xsd: "double",
          json: "number",
          rust: "eirp_dbw",
          rustType: "f64",
          store: "dBW",
          unit: "dBW",
          qk: "Power level",
          card: "[1]",
          def: "Effective isotropic radiated power assumed for the link.",
          ex: "52.0",
        }),
      ],
    },
    {
      id: "TelemetryPoint",
      module: "Operations",
      def: "One sampled measurement reported by onboard equipment.",
      props: [
        ID("telemetry point", '"urn:example:tlm:5501"', "TelemetryId"),
        P("sampledAt", "Temporal", {
          ...DT,
          rust: "sampled_at",
          rustType: "DateTime<Utc>",
          card: "[1]",
          def: "Instant the sample was taken.",
          ex: '"2024-06-01T12:00Z"',
        }),
        P("source", "Provenance", {
          xsd: "IRI",
          json: "string (IRI)",
          rust: "source",
          rustType: "SystemId",
          card: "[1]",
          def: "System that produced the sample.",
          ex: '"urn:example:system:tlm-gw"',
        }),
      ],
    },
    {
      id: "OutageRecord",
      module: "Operations",
      def: "A period during which equipment did not provide service.",
      props: [
        ID("outage record", '"urn:example:outage:31"', "OutageId"),
        P("startedAt", "Temporal", {
          ...DT,
          rust: "started_at",
          rustType: "DateTime<Utc>",
          card: "[1]",
          def: "Instant the outage began.",
          ex: '"2024-05-20T03:10Z"',
        }),
      ],
    },
    {
      id: "ConfigurationChange",
      module: "Operations",
      def: "An approved change to equipment settings.",
      props: [
        ID("configuration change", '"urn:example:change:204"', "ChangeId"),
        P("appliedAt", "Temporal", {
          ...DT,
          rust: "applied_at",
          rustType: "DateTime<Utc>",
          card: "[0..1]",
          def: "Instant the change took effect.",
          ex: '"2024-04-02T09:00Z"',
        }),
        P("approvedBy", "Provenance", {
          xsd: "IRI",
          json: "string (IRI)",
          rust: "approved_by",
          rustType: "PersonId",
          card: "[1]",
          def: "Person who approved the change.",
          ex: '"urn:example:person:17"',
        }),
      ],
    },
  ],
  relations: [
    {
      from: "Transponder",
      to: "PayloadComponent",
      kind: "isa",
      key: "subClassOf",
      card: "",
    },
    {
      from: "Satellite",
      to: "Transponder",
      kind: "composition",
      key: "hasTransponder",
      card: "1..*",
    },
    {
      from: "Transponder",
      to: "Channel",
      kind: "composition",
      key: "hasChannel",
      card: "1..*",
    },
    {
      from: "Transponder",
      to: "FrequencyPlan",
      kind: "reference",
      key: "followsPlan",
      card: "1",
    },
    {
      from: "Transponder",
      to: "GroundStation",
      kind: "reference",
      key: "controlledBy",
      card: "0..1",
    },
    {
      from: "LinkBudget",
      to: "Transponder",
      kind: "reference",
      key: "forTransponder",
      card: "1",
    },
    {
      from: "TelemetryPoint",
      to: "Transponder",
      kind: "reference",
      key: "observes",
      card: "1",
    },
    {
      from: "OutageRecord",
      to: "Transponder",
      kind: "reference",
      key: "affects",
      card: "1..*",
    },
    {
      from: "ConfigurationChange",
      to: "Transponder",
      kind: "reference",
      key: "appliesTo",
      card: "1",
    },
    {
      from: "Channel",
      to: "FrequencyPlan",
      kind: "reference",
      key: "assignedBy",
      card: "1",
    },
  ],
  rejections: {
    Transponder: {
      instantaneousBandwidth: {
        value: "-5",
        msg: "Rejected by the contract: sh:minExclusive 0 (the value must be above 0).",
      },
      band: {
        value: '"Ka"',
        msg: "The contract accepts Ka, but the Rust enum rejects it. This is the band conflict surfacing at runtime.",
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/* View options and profiles                                           */
/* ------------------------------------------------------------------ */

export const SECS = [
  "Identity",
  "Quantity",
  "Code",
  "Temporal",
  "Provenance",
  "Unclassified",
  "Internal",
  "Inherited",
] as const;
export type Section = (typeof SECS)[number];

export const SECLABEL: Record<Section, string> = {
  Identity: "Identity",
  Quantity: "Quantities",
  Code: "Codes",
  Temporal: "Temporal",
  Provenance: "Provenance",
  Unclassified: "Unclassified (no concept)",
  Internal: "Internal",
  Inherited: "Inherited",
};

export type Notation = "uml" | "api" | "onto";
export type Lens = "concept" | "contract" | "realization" | "combined";
export type LabelSource = "key" | "iri" | "rust" | "json";
export type DataOverlay = "none" | "fixture" | "rejected";
export type TraceFilter = "all" | "gaps" | "conflicts";
export type RelationToggle = "incoming" | "outgoing" | "parts" | "superclass";

export interface ExplorerOptions {
  notation: Notation;
  lens: Lens;
  label: LabelSource;
  data: DataOverlay;
  defs: boolean;
  trace: TraceFilter;
  sec: Record<Section, boolean>;
  rel: Record<RelationToggle, boolean>;
}

export type ProfileId = "app" | "sys" | "ke";

export interface Profile {
  label: string;
  blurb: string;
  opts: ExplorerOptions;
}

export const allSecs = (v: boolean): Record<Section, boolean> =>
  Object.fromEntries(SECS.map((s) => [s, v])) as Record<Section, boolean>;

export const PROFILES: Record<ProfileId, Profile> = {
  app: {
    label: "App developer",
    blurb:
      "Builds plugins against the API: payload fields, JSON types, required or optional, and example values.",
    opts: {
      notation: "api",
      lens: "contract",
      label: "key",
      data: "fixture",
      defs: false,
      trace: "all",
      sec: { ...allSecs(true), Internal: false },
      rel: { incoming: false, outgoing: true, parts: true, superclass: false },
    },
  },
  sys: {
    label: "Systems engineer",
    blurb:
      "Reads the model as SysML blocks: value properties with units and multiplicity, parts, references, generalization.",
    opts: {
      notation: "uml",
      lens: "contract",
      label: "key",
      data: "none",
      defs: false,
      trace: "all",
      sec: { ...allSecs(true), Internal: false, Inherited: false },
      rel: { incoming: true, outgoing: true, parts: true, superclass: true },
    },
  },
  ke: {
    label: "Knowledge engineer",
    blurb:
      "Curates the vocabulary: IRIs, definitions, patterns, and which layer is missing or disagrees.",
    opts: {
      notation: "onto",
      lens: "combined",
      label: "iri",
      data: "none",
      defs: true,
      trace: "all",
      sec: allSecs(true),
      rel: { incoming: true, outgoing: true, parts: true, superclass: true },
    },
  },
};

/**
 * A saved module arrangement, passed to layoutStructural as its sketch
 * (prior positions as hints). The engine keeps the ORDER these imply
 * within each layer; it does not pin coordinates. This is the reviewed
 * prototype's arrangement (sources stacked Spacecraft, Link analysis,
 * Operations; targets Spectrum above Ground). In a real deployment it
 * is a document SMEs adjust, so a model change does not reshuffle the
 * picture people have learned.
 */
export type ModuleArrangement = Record<string, { x: number; y: number }>;
export const SAMPLE_ARRANGEMENT: ModuleArrangement = {
  Spacecraft: { x: 0, y: 0 },
  "Link analysis": { x: 0, y: 300 },
  Operations: { x: 0, y: 600 },
  Payload: { x: 700, y: 300 },
  Spectrum: { x: 1400, y: 100 },
  Ground: { x: 1400, y: 500 },
};

export const cloneOptions = (o: ExplorerOptions): ExplorerOptions => ({
  ...o,
  sec: { ...o.sec },
  rel: { ...o.rel },
});
