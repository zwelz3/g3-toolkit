/**
 * Model Explorer derivations: pure functions from the model-trace
 * document and the view options to what the shell draws.
 *
 * Two rules from the toolkit's doctrine shape this module:
 *
 * 1. GEOMETRY IS FIXED, DETAIL IS NOT. The map lays its modules out once
 *    (layoutStructural over the module graph) and gives every class a
 *    slot sized for full detail. Zoom level, lens, labels and filters
 *    only change what is drawn inside a slot, never where a slot sits,
 *    so no view change re-runs layout (camera/position stability; the
 *    removed expand/collapse feature is the cautionary tale for any
 *    level-of-detail scheme that shrinks boxes and re-lays out).
 * 2. LEVEL OF DETAIL IS DATA. The zoom thresholds are a core LodSchedule
 *    resolved with resolveLod, once per zoom change, not per element.
 */

import {
  layoutStructural,
  resolveLod,
  type LodSchedule,
  type StructuralGraphInput,
} from "@g3-toolkit/core";
import {
  SECS,
  SECLABEL,
  allSecs,
  type ExplorerOptions,
  type LabelSource,
  type Lens,
  type ModelTraceDocument,
  type ModuleArrangement,
  type Notation,
  type Section,
  type TraceClass,
  type TraceProperty,
  type TraceRelation,
} from "./model";

/* ------------------------------------------------------------------ */
/* Property-level derivations                                          */
/* ------------------------------------------------------------------ */

/** A property as shown in one class's box (own or inherited). */
export interface ViewProperty extends TraceProperty {
  inherited: boolean;
  from?: string;
}

export type TraceStatus = "ok" | "gap" | "conflict" | "internal";

const LENSKEY: Record<Exclude<Lens, "combined">, "c" | "s" | "r"> = {
  concept: "c",
  contract: "s",
  realization: "r",
};
const UMLT: Record<string, string> = {
  double: "Real",
  string: "String",
  boolean: "Boolean",
  dateTime: "DateTime",
  date: "Date",
  IRI: "URI",
};

export const secOf = (p: ViewProperty): Section =>
  p.internal
    ? "Internal"
    : p.inherited
      ? "Inherited"
      : !p.pattern
        ? "Unclassified"
        : p.pattern;

export const status = (p: TraceProperty): TraceStatus =>
  p.internal
    ? "internal"
    : p.conflict || p.layers.r === "w"
      ? "conflict"
      : !p.layers.c || !p.layers.s || !p.layers.r
        ? "gap"
        : "ok";

export const isGap = (p: TraceProperty): boolean =>
  status(p) === "gap" || status(p) === "conflict";

export const present = (p: TraceProperty, lens: Lens): boolean =>
  lens === "combined" || !!p.layers[LENSKEY[lens]];

export function nameOf(
  p: TraceProperty,
  label: LabelSource,
): { t: string; muted?: boolean } {
  if (p.internal) return { t: p.rust ?? p.key, muted: true };
  if (label === "iri") return { t: "ex:" + p.key };
  if (label === "rust")
    return p.rust ? { t: p.rust } : { t: p.key, muted: true };
  if (label === "json") return { t: "/" + p.key };
  return { t: p.key };
}

export function conceptText(p: TraceProperty): string {
  if (!p.layers.c) return "no concept";
  if (p.pattern === "Quantity") return `${p.qk ?? ""}, ${p.unit ?? ""}`;
  if (p.pattern === "Code") return "code: " + (p.codes ?? []).join(" | ");
  const words: Partial<Record<string, string>> = {
    Identity: "identifier",
    Temporal: "instant in time",
    Provenance: "source of a value",
  };
  return words[p.pattern ?? ""] ?? "";
}

export function contractText(p: TraceProperty, notation: Notation): string {
  if (!p.layers.s) return "no shape";
  const card = p.card ?? "";
  if (notation === "uml") {
    const t = p.codes ? (p.enumName ?? "") : (UMLT[p.xsd ?? ""] ?? p.xsd ?? "");
    const br = [p.constraint, p.unit && "unit = " + p.unit].filter(Boolean);
    return `${t} ${card}${br.length ? " {" + br.join(", ") + "}" : ""}`;
  }
  if (notation === "api") {
    const t = p.codes
      ? p.codes.map((c) => `"${c}"`).join(" | ")
      : (p.json ?? "");
    return t + (p.unit ? " · " + p.unit : "");
  }
  const t = p.codes ? `sh:in (${p.codes.join(" ")})` : "xsd:" + (p.xsd ?? "");
  return `${t} ${card}${p.constraint ? " " + p.constraint : ""}`;
}

export const realText = (p: TraceProperty): string =>
  !p.layers.r
    ? "no field"
    : (p.rustType ?? "") + (p.store ? ` (${p.store})` : "");

export function typeText(
  p: TraceProperty,
  lens: Lens,
  notation: Notation,
): string {
  if (lens === "concept") return conceptText(p);
  if (lens === "contract") return contractText(p, notation);
  if (lens === "realization") return realText(p);
  return p.layers.s ? contractText(p, notation) : realText(p);
}

export interface ValueCell {
  t: string;
  bad?: boolean;
  muted?: boolean;
}

export function valueOf(
  doc: ModelTraceDocument,
  p: TraceProperty,
  data: ExplorerOptions["data"],
  focus: string,
): ValueCell {
  if (p.internal) return { t: "not projected", muted: true };
  if (data === "rejected") {
    const rj = doc.rejections[focus]?.[p.key];
    if (rj) return { t: rj.value, bad: true };
  }
  if (!p.layers.r) return { t: "never sent", muted: true };
  return { t: p.ex ?? "—" };
}

/* ------------------------------------------------------------------ */
/* Class-level view model                                              */
/* ------------------------------------------------------------------ */

export interface ClassView {
  focus: string;
  C: TraceClass;
  props: ViewProperty[];
  visible: ViewProperty[];
  hidden: number;
  counts: Record<Section, number>;
  traceCounts: { all: number; gaps: number; conflicts: number };
  incoming: TraceRelation[];
  outgoing: TraceRelation[];
  parts: TraceRelation[];
  sup?: TraceRelation;
}

export function classById(doc: ModelTraceDocument, id: string): TraceClass {
  const c = doc.classes.find((k) => k.id === id);
  if (!c) throw new Error(`model-trace: no class "${id}"`);
  return c;
}

export function buildClassView(
  doc: ModelTraceDocument,
  focus: string,
  o: ExplorerOptions,
): ClassView {
  const C = classById(doc, focus);
  let props: ViewProperty[] = C.props.map((p) => ({ ...p, inherited: false }));
  if (C.super) {
    const sup = C.super;
    props = props.concat(
      classById(doc, sup).props.map((p) => ({
        ...p,
        inherited: true,
        from: sup,
      })),
    );
  }
  props.sort((a, b) => SECS.indexOf(secOf(a)) - SECS.indexOf(secOf(b)));
  const counts = allSecsCount();
  props.forEach((p) => {
    counts[secOf(p)]++;
  });
  const traceCounts = {
    all: props.length,
    gaps: props.filter(isGap).length,
    conflicts: props.filter((p) => status(p) === "conflict").length,
  };
  const visible = props.filter(
    (p) =>
      o.sec[secOf(p)] &&
      (o.trace === "all" ||
        (o.trace === "gaps" ? isGap(p) : status(p) === "conflict")),
  );
  const order: Record<TraceRelation["kind"], number> = {
    composition: 0,
    isa: 1,
    reference: 2,
  };
  const incoming = doc.relations
    .filter((r) => r.to === focus)
    .sort((a, b) => order[a.kind] - order[b.kind]);
  return {
    focus,
    C,
    props,
    visible,
    hidden: props.length - visible.length,
    counts,
    traceCounts,
    incoming,
    outgoing: doc.relations.filter(
      (r) => r.from === focus && r.kind === "reference",
    ),
    parts: doc.relations.filter(
      (r) => r.from === focus && r.kind === "composition",
    ),
    sup: doc.relations.find((r) => r.from === focus && r.kind === "isa"),
  };
}

function allSecsCount(): Record<Section, number> {
  return Object.fromEntries(SECS.map((s) => [s, 0])) as Record<Section, number>;
}

/* ------------------------------------------------------------------ */
/* Row content and column measurement                                  */
/* ------------------------------------------------------------------ */

export interface RowContent {
  p: ViewProperty;
  pres: boolean;
  name: string;
  nameMuted?: boolean;
  type: string;
  req: string | null;
  val: ValueCell | null;
  def: string | null;
}

export function rowContent(
  doc: ModelTraceDocument,
  p: ViewProperty,
  o: ExplorerOptions,
  focus: string,
): RowContent {
  const pres = present(p, o.lens);
  const nm = nameOf(p, o.label);
  let name = nm.t;
  let type = typeText(p, o.lens, o.notation);
  let req: string | null = null;
  if (o.notation === "uml") {
    const pre = p.inherited ? "^" : "";
    if (!pres) name = pre + name;
    else if (o.lens === "concept")
      name = pre + name + (p.unit ? ` {unit = ${p.unit}}` : "");
    else name = `${pre}${name} : ${type}`;
    type = "";
  } else if (o.notation === "api") {
    req = p.internal
      ? "not in API"
      : p.layers.s
        ? /^\[1/.test(p.card ?? "")
          ? "required"
          : "optional"
        : "";
  }
  return {
    p,
    pres,
    name,
    nameMuted: nm.muted,
    type,
    req,
    val: o.data !== "none" ? valueOf(doc, p, o.data, focus) : null,
    def: o.defs
      ? (p.def ?? "No definition: no concept in the vocabulary.")
      : null,
  };
}

/** Deterministic text-width estimate (the same contract as the core
 *  structural estimator: no DOM measurement, so headless tests and the
 *  browser agree on geometry). */
export const est = (
  s: string | null | undefined,
  mono: boolean,
  size: number,
): number => Math.ceil(String(s ?? "").length * size * (mono ? 0.6 : 0.55));

export const trunc = (s: string, n: number): string =>
  s.length > n ? s.slice(0, Math.max(0, n - 1)).trimEnd() + "…" : s;

export interface BoxColumns {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  BW: number;
}

export function boxColumns(
  rows: RowContent[],
  o: ExplorerOptions,
  headerName: string,
  extraNames: string[],
  extraTypes: string[],
): BoxColumns {
  const mono = o.notation !== "uml";
  const stripW = o.lens === "combined" ? 50 : 0;
  const nameW = Math.max(
    110,
    ...rows.map((r) => est(r.name, mono, 13)),
    ...extraNames.map((t) => est(t, mono, 13)),
  );
  const typeW = Math.max(
    0,
    ...rows.map((r) => est(r.type, true, 12)),
    ...extraTypes.map((t) => est(t, true, 12)),
  );
  const reqW = o.notation === "api" ? 72 : 0;
  const valW =
    o.data !== "none"
      ? Math.max(70, ...rows.map((r) => est(r.val ? r.val.t : "", true, 12)))
      : 0;
  const c1 = 16 + stripW;
  const c2 = c1 + nameW + (typeW ? 22 : 0);
  const c3 = c2 + typeW + (reqW ? 18 : 0);
  const c4 = c3 + reqW + (valW ? 18 : 0);
  const BW = Math.max(c4 + valW + 16, est(headerName, mono, 16) + 130, 300);
  return { c1, c2, c3, c4, BW };
}

/* ------------------------------------------------------------------ */
/* Entity view: a fixed placement template around one class            */
/* ------------------------------------------------------------------ */

export type StubDir = "in" | "out" | "part" | "sup";

export interface Stub {
  r?: TraceRelation;
  dir?: StubDir;
  group?: boolean;
  collapse?: boolean;
  n?: number;
  modules?: string[];
  x: number;
  y: number;
  label: { title: string; sub: string; cls?: string };
}

export interface EdgeShape {
  d: string;
  start?: "diamond";
  end?: "arrow" | "tri";
  dashed?: boolean;
  lab?: string;
  lx?: number;
  ly?: number;
  anchor?: "start" | "middle";
}

export type EntityItem =
  | { type: "section"; sec: Section | null; label: string; y: number }
  | { type: "compartment"; label: string; y: number }
  | { type: "row"; r: RowContent; y: number }
  | { type: "rel"; l: RelLine; y: number }
  | { type: "hidden"; n: number; y: number }
  | { type: "empty"; y: number };

export interface RelLine {
  r: TraceRelation;
  text: string;
  type?: string;
  req?: string;
  target: string;
}

export interface EntityGeometry {
  W: number;
  H: number;
  mono: boolean;
  showStrip: boolean;
  header: { name: string; module: string; def?: string };
  items: EntityItem[];
  box: { x: number; y: number; w: number; h: number };
  cols: BoxColumns;
  defChars: number;
  stubs: Stub[];
  stubW: number;
  stubH: number;
  edges: EdgeShape[];
}

function stubLabel(
  s: Omit<Stub, "x" | "y" | "label">,
  o: ExplorerOptions,
): Stub["label"] {
  if (s.group)
    return { title: `+${s.n} more`, sub: (s.modules ?? []).join(", ") };
  if (s.collapse) return { title: "Show fewer", sub: "collapse the group" };
  const r = s.r as TraceRelation;
  const cls = s.dir === "in" ? r.from : r.to;
  const onto = o.notation === "onto";
  const k = onto ? "ex:" + r.key : r.key;
  let sub: string;
  if (o.notation === "uml") sub = "«block»";
  else if (s.dir === "in")
    sub =
      r.kind === "composition"
        ? "owns it, " + r.card
        : r.kind === "isa"
          ? "subclass"
          : k + " → it";
  else if (s.dir === "sup") sub = "superclass";
  else sub = `${k}, ${r.card}`;
  return { title: onto ? "ex:" + cls : cls, sub, cls };
}

export function entityGeometry(
  doc: ModelTraceDocument,
  m: ClassView,
  o: ExplorerOptions,
  cw: number,
  expanded: boolean,
): EntityGeometry {
  const mono = o.notation !== "uml";
  const rows = m.visible.map((p) => rowContent(doc, p, o, m.focus));

  let relCols: { title: string; lines: RelLine[] }[] = [];
  if (o.notation === "uml") {
    relCols = [
      {
        title: "parts",
        lines: m.parts.map((r) => ({
          r,
          text: `${r.key} : ${r.to} [${r.card}]`,
          target: r.to,
        })),
      },
      {
        title: "references",
        lines: m.outgoing.map((r) => ({
          r,
          text: `${r.key} : ${r.to} [${r.card}]`,
          target: r.to,
        })),
      },
    ].filter((c) => c.lines.length);
  } else if (o.notation === "api") {
    const ls = m.parts.concat(m.outgoing).map((r) => ({
      r,
      text: r.key,
      type: r.card.includes("*") ? "string[] (IRI)" : "string (IRI)",
      req: /^1/.test(r.card) ? "required" : "optional",
      target: r.to,
    }));
    if (ls.length) relCols = [{ title: "Links", lines: ls }];
  }

  const showStrip = o.lens === "combined";
  const headerName = o.notation === "onto" ? "ex:" + m.focus : m.focus;
  const cols = boxColumns(
    rows,
    o,
    headerName,
    relCols.flatMap((c) => c.lines.map((l) => l.text)),
    relCols.flatMap((c) => c.lines.map((l) => l.type ?? "")),
  );
  const BW = cols.BW;
  const defChars = Math.floor((BW - cols.c1 - 16) / (11.5 * 0.5));

  const topPad = 76;
  const hasSup = o.rel.superclass && !!m.sup;
  const boxY = topPad + (hasSup ? 40 + 46 : 0);
  let y = boxY;
  const items: EntityItem[] = [];
  const header: EntityGeometry["header"] = {
    name: headerName,
    module: m.C.module,
  };
  y += o.notation === "uml" ? 56 : 46;
  if (o.defs && o.notation !== "uml") {
    header.def = trunc(m.C.def, Math.floor((BW - 32) / (11.5 * 0.5)));
    y += 18;
  }
  const rowStep = (r: RowContent) => 22 + (r.def ? 16 : 0);
  if (o.notation === "uml") {
    items.push({ type: "compartment", label: "values", y });
    y += 22;
    rows.forEach((r) => {
      items.push({ type: "row", r, y });
      y += rowStep(r);
    });
    if (!rows.length) {
      items.push({ type: "empty", y });
      y += 22;
    }
    relCols.forEach((c) => {
      y += 6;
      items.push({ type: "compartment", label: c.title, y });
      y += 22;
      c.lines.forEach((l) => {
        items.push({ type: "rel", l, y });
        y += 22;
      });
    });
  } else {
    let cur: Section | null = null;
    rows.forEach((r) => {
      const s = secOf(r.p);
      if (s !== cur) {
        cur = s;
        if (items.length) y += 6;
        const label =
          s === "Inherited"
            ? "Inherited from " + (m.C.super ?? "")
            : SECLABEL[s];
        items.push({ type: "section", sec: s, label, y });
        y += 22;
      }
      items.push({ type: "row", r, y });
      y += rowStep(r);
    });
    if (!rows.length) {
      items.push({ type: "empty", y });
      y += 22;
    }
    relCols.forEach((c) => {
      y += 6;
      items.push({ type: "section", sec: null, label: c.title, y });
      y += 22;
      c.lines.forEach((l) => {
        items.push({ type: "rel", l, y });
        y += 22;
      });
    });
  }
  if (m.hidden) {
    y += 4;
    items.push({ type: "hidden", n: m.hidden, y });
    y += 24;
  }
  y += 10;
  const boxH = y - boxY;

  type Pending = Omit<Stub, "x" | "y" | "label">;
  let left: Pending[] = [];
  if (o.rel.incoming) {
    const inc = m.incoming;
    if (inc.length > 3 && !expanded) {
      left = inc.slice(0, 2).map((r) => ({ r, dir: "in" as const }));
      const rest = inc.slice(2);
      left.push({
        group: true,
        n: rest.length,
        modules: Array.from(
          new Set(rest.map((r) => classById(doc, r.from).module)),
        ),
      });
    } else {
      left = inc.map((r) => ({ r, dir: "in" as const }));
      if (inc.length > 3) left.push({ collapse: true });
    }
  }
  const right: Pending[] = o.rel.outgoing
    ? m.outgoing.map((r) => ({ r, dir: "out" as const }))
    : [];
  const below: Pending[] = o.rel.parts
    ? m.parts.map((r) => ({ r, dir: "part" as const }))
    : [];
  const supP: Pending | null =
    hasSup && m.sup ? { r: m.sup, dir: "sup" } : null;
  const withLabel = (s: Pending): Stub => ({
    ...s,
    x: 0,
    y: 0,
    label: stubLabel(s, o),
  });
  const L = left.map(withLabel);
  const R = right.map(withLabel);
  const B = below.map(withLabel);
  const S = supP ? withLabel(supP) : null;
  const all = L.concat(R, B, S ? [S] : []);
  const stubW = Math.min(
    240,
    Math.max(
      150,
      ...all.map(
        (s) =>
          Math.max(
            est(s.label.title, o.notation === "onto", 13),
            est(s.label.sub, false, 11.5),
          ) + 28,
      ),
    ),
  );
  const stubH = 46;
  const sideLabels =
    o.notation === "uml"
      ? L.concat(R)
          .filter((s) => s.r && s.r.kind !== "isa")
          .map((s) => `${s.r?.key} [${s.r?.card}]`)
      : [];
  const gapX = Math.max(92, ...sideLabels.map((t) => est(t, false, 11.5) + 36));
  const sideNeed = L.length || R.length ? 2 * (stubW + gapX) : 0;
  const W = Math.max(cw, BW + sideNeed + 32, B.length * (stubW + 24) + 32);
  const boxX = Math.round((W - BW) / 2);
  const leftX = boxX - gapX - stubW;
  const rightX = boxX + BW + gapX;
  L.forEach((s, i) => {
    s.x = leftX;
    s.y = boxY + 4 + i * 60;
  });
  R.forEach((s, i) => {
    s.x = rightX;
    s.y = boxY + 4 + i * 60;
  });
  const sideBottom = Math.max(
    boxY + boxH,
    ...L.map((s) => s.y + stubH),
    ...R.map((s) => s.y + stubH),
  );
  const partsY = sideBottom + 66;
  const totalPW = B.length * stubW + Math.max(0, B.length - 1) * 24;
  B.forEach((s, i) => {
    s.x = Math.round((W - totalPW) / 2) + i * (stubW + 24);
    s.y = partsY;
  });
  if (S) {
    S.x = Math.round((W - stubW) / 2);
    S.y = topPad;
  }
  const H = (B.length ? partsY + stubH : sideBottom) + 48;

  const edges: EdgeShape[] = [];
  const clampY = (v: number) =>
    Math.max(boxY + 18, Math.min(boxY + boxH - 14, v));
  const uml = o.notation === "uml";
  L.forEach((s) => {
    if (s.collapse) return;
    const sy = s.y + stubH / 2;
    const ty = clampY(sy);
    const x1 = s.x + stubW;
    const x2 = boxX;
    const d = `M${x1} ${sy}L${x2} ${ty}`;
    const lab =
      uml && s.r && s.r.kind !== "isa" ? `${s.r.key} [${s.r.card}]` : "";
    const at = { lx: (x1 + x2) / 2, ly: Math.min(sy, ty) - 8 };
    if (s.group) edges.push({ d, end: "arrow", dashed: true });
    else if (s.r?.kind === "composition")
      edges.push({ d, start: "diamond", lab, ...at });
    else if (s.r?.kind === "isa") edges.push({ d, end: uml ? "tri" : "arrow" });
    else edges.push({ d, end: "arrow", lab, ...at });
  });
  R.forEach((s) => {
    const sy = s.y + stubH / 2;
    const ty = clampY(sy);
    const x1 = boxX + BW;
    const x2 = s.x;
    edges.push({
      d: `M${x1} ${ty}L${x2} ${sy}`,
      end: "arrow",
      lab: uml && s.r ? `${s.r.key} [${s.r.card}]` : "",
      lx: (x1 + x2) / 2,
      ly: Math.min(sy, ty) - 8,
    });
  });
  B.forEach((s, i) => {
    const bx = Math.round(boxX + (BW * (i + 1)) / (B.length + 1));
    const cx = s.x + stubW / 2;
    edges.push({
      d: `M${bx} ${boxY + boxH}L${cx} ${s.y}`,
      start: "diamond",
      lab: uml && s.r ? `${s.r.key} [${s.r.card}]` : "",
      lx: (bx + cx) / 2 + 8,
      ly: (boxY + boxH + s.y) / 2 + 4,
      anchor: "start",
    });
  });
  if (S) {
    const x = boxX + BW / 2;
    edges.push({
      d: `M${x} ${boxY}L${W / 2} ${S.y + stubH}`,
      end: uml ? "tri" : "arrow",
      lab: uml ? "" : "is a",
      lx: x + 8,
      ly: (boxY + S.y + stubH) / 2 + 4,
      anchor: "start",
    });
  }

  return {
    W,
    H,
    mono,
    showStrip,
    header,
    items,
    box: { x: boxX, y: boxY, w: BW, h: boxH },
    cols,
    defChars,
    stubs: all,
    stubW,
    stubH,
    edges,
  };
}

/* ------------------------------------------------------------------ */
/* Map view: module layout by the toolkit, class slots by template      */
/* ------------------------------------------------------------------ */

export const SLOT_W = 440;
export const MOD_PAD = 28;
export const MOD_HEAD = 52;
const CLS_GAP = 40;

export const slotH = (c: TraceClass): number => 70 + c.props.length * 22;

export interface MapModule {
  name: string;
  classes: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapSlot {
  cls: string;
  module: string;
  cx: number;
  cy: number;
  h: number;
}

export interface MapLayout {
  mods: MapModule[];
  slots: Record<string, MapSlot>;
}

/** Classes of one module in a stable order: a superclass before its
 *  subclasses, otherwise document order. */
export function moduleClasses(
  doc: ModelTraceDocument,
  module: string,
): string[] {
  const ids = doc.classes.filter((c) => c.module === module).map((c) => c.id);
  const supers = new Set(
    doc.relations
      .filter((r) => r.kind === "isa" && ids.includes(r.to))
      .map((r) => r.to),
  );
  return ids
    .filter((i) => supers.has(i))
    .concat(ids.filter((i) => !supers.has(i)));
}

export function moduleSize(
  doc: ModelTraceDocument,
  module: string,
): { w: number; h: number } {
  const hs = moduleClasses(doc, module).map((id) => slotH(classById(doc, id)));
  const h =
    MOD_HEAD +
    hs.reduce((a, b) => a + b, 0) +
    Math.max(0, hs.length - 1) * CLS_GAP +
    MOD_PAD;
  return { w: SLOT_W + 2 * MOD_PAD, h };
}

/** The module graph handed to the toolkit layout: one fixed-size plain
 *  node per module, one edge per related module pair (direction follows
 *  the first relation seen, which sets the layered flow). */
export function moduleGraphInput(
  doc: ModelTraceDocument,
): StructuralGraphInput {
  const modules = Array.from(new Set(doc.classes.map((c) => c.module)));
  const modOf = (id: string) => classById(doc, id).module;
  const seen = new Set<string>();
  const edges: StructuralGraphInput["edges"] = [];
  for (const r of doc.relations) {
    if (r.kind === "isa") continue;
    const a = modOf(r.from);
    const b = modOf(r.to);
    if (a === b) continue;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ id: `mod:${a}->${b}`, source: a, target: b });
  }
  return {
    nodes: modules.map((name) => ({
      id: name,
      ...sizeAsNode(moduleSize(doc, name)),
    })),
    edges,
  };
}

function sizeAsNode(s: { w: number; h: number }) {
  return { width: s.w, height: s.h };
}

const MOD_GAP = 80;

/** Re-stack the modules of each layer (same x) in the arrangement's
 *  vertical order, keeping the layer's vertical centre. Modules the
 *  arrangement does not name keep their computed order, after it. */
export function orderWithinLayers(
  mods: MapModule[],
  arrangement: ModuleArrangement,
): void {
  const layers = new Map<number, MapModule[]>();
  for (const m of mods) {
    const key = Math.round(m.x);
    layers.set(key, (layers.get(key) ?? []).concat(m));
  }
  for (const layer of layers.values()) {
    const top = Math.min(...layer.map((m) => m.y));
    const bottom = Math.max(...layer.map((m) => m.y + m.h));
    const rank = (m: MapModule) => arrangement[m.name]?.y ?? Infinity;
    layer.sort((a, b) => rank(a) - rank(b) || a.y - b.y);
    const total =
      layer.reduce((acc, m) => acc + m.h, 0) + (layer.length - 1) * MOD_GAP;
    let y = (top + bottom) / 2 - total / 2;
    for (const m of layer) {
      m.y = y;
      y += m.h + MOD_GAP;
    }
  }
}

/** Lay the modules out with the toolkit (once per document), then stack
 *  each module's class slots inside it. */
export async function computeMapLayout(
  doc: ModelTraceDocument,
  arrangement?: ModuleArrangement,
): Promise<MapLayout> {
  const input = moduleGraphInput(doc);
  // The toolkit decides each module's LAYER (its column, from relation
  // flow). It does not take a sketch as an ordering instruction (probed:
  // identical output with and without one), so the saved arrangement
  // orders modules WITHIN each layer afterwards.
  const geo = await layoutStructural(input, {
    direction: "RIGHT",
    spacing: 80,
    layerSpacing: 240,
    routeEdges: false,
  });
  const mods: MapModule[] = [];
  for (const n of input.nodes) {
    const g = geo.nodes[n.id];
    if (!g) continue;
    mods.push({
      name: n.id,
      classes: moduleClasses(doc, n.id),
      x: g.x,
      y: g.y,
      w: g.width,
      h: g.height,
    });
  }
  if (arrangement) orderWithinLayers(mods, arrangement);
  const slots: Record<string, MapSlot> = {};
  for (const mod of mods) {
    let cy = mod.y + MOD_HEAD;
    mod.classes.forEach((c, i) => {
      if (i) cy += CLS_GAP;
      const h = slotH(classById(doc, c));
      slots[c] = {
        cls: c,
        module: mod.name,
        cx: mod.x + mod.w / 2,
        cy: cy + h / 2,
        h,
      };
      cy += h;
    });
  }
  return { mods, slots };
}

/** Zoom thresholds as a core LOD schedule: tier 3 (coarsest) is the
 *  module overview, tier 0 is full detail. Edge labels appear from the
 *  Properties level in, matching the schedule's feature flags. */
export const MAP_LOD_SCHEDULE: LodSchedule = {
  tiers: [
    {
      tier: 3,
      when: { maxZoom: 0.38 },
      hide: ["nodeLabels", "edgeLabels", "glyphs"],
    },
    { tier: 2, when: { maxZoom: 0.7 }, hide: ["edgeLabels", "glyphs"] },
    { tier: 1, when: { maxZoom: 1.0 }, hide: ["glyphs"] },
  ],
};

export const LOD_NAMES = [
  "Modules",
  "Classes",
  "Properties",
  "Full detail",
] as const;
/** A representative zoom inside each level, for the level buttons. */
export const LOD_K = [0.28, 0.55, 0.85, 1.15] as const;

/** 0 = Modules, 1 = Classes, 2 = Properties, 3 = Full detail. */
export function mapLevel(zoom: number): {
  level: 0 | 1 | 2 | 3;
  edgeLabels: boolean;
} {
  const r = resolveLod(MAP_LOD_SCHEDULE, { zoom, visibleElements: 0 });
  return {
    level: (3 - r.tier) as 0 | 1 | 2 | 3,
    edgeLabels: r.features.edgeLabels,
  };
}

export interface MapBox {
  cls: string;
  lod: 1 | 2 | 3;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  rows?: RowContent[];
  cols?: BoxColumns;
  head?: number;
}

export const titleOf = (cls: string, o: ExplorerOptions): string =>
  o.notation === "onto" ? "ex:" + cls : cls;

/** One class drawn at one level of detail, centred in its fixed slot. */
export function classBox(
  doc: ModelTraceDocument,
  layout: MapLayout,
  cls: string,
  lod: 1 | 2 | 3,
  o: ExplorerOptions,
): MapBox {
  const sl = layout.slots[cls];
  if (!sl) throw new Error(`map layout: no slot for "${cls}"`);
  const title = titleOf(cls, o);
  if (lod === 1) {
    const w = Math.min(
      SLOT_W,
      Math.max(190, est(title, o.notation === "onto", 24) + 80),
    );
    return { cls, lod: 1, x: sl.cx - w / 2, y: sl.cy - 31, w, h: 62, title };
  }
  const m = buildClassView(doc, cls, {
    ...o,
    trace: "all",
    sec: { ...o.sec, Inherited: false },
  });
  const rows = m.visible.map((p) => rowContent(doc, p, o, cls));
  if (lod === 2) {
    const strip = o.lens === "combined" ? 50 : 0;
    const nameW = Math.max(
      100,
      ...rows.map((r) => est(nameOf(r.p, o.label).t, o.notation !== "uml", 15)),
    );
    const w = Math.max(
      nameW + strip + 32,
      est(title, o.notation === "onto", 17) + 48,
      200,
    );
    const h = 46 + rows.length * 21 + 10;
    return {
      cls,
      lod: 2,
      x: sl.cx - w / 2,
      y: sl.cy - h / 2,
      w,
      h,
      title,
      rows,
    };
  }
  const cols = boxColumns(rows, o, title, [], []);
  const head = o.notation === "uml" ? 54 : 44;
  const h = head + rows.length * 21 + 12;
  return {
    cls,
    lod: 3,
    x: sl.cx - cols.BW / 2,
    y: sl.cy - h / 2,
    w: cols.BW,
    h,
    title,
    rows,
    cols,
    head,
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoutedPair<T> {
  a: string;
  b: string;
  data: T;
  pa: { x: number; y: number };
  pb: { x: number; y: number };
}

/** Straight edges whose ends spread along each box side, sorted by the
 *  far end so neighbouring edges do not cross at the box. */
export function routeEdges<T>(
  pairs: { a: string; b: string; data: T }[],
  boxes: Record<string, Rect>,
): RoutedPair<T>[] {
  type End = {
    e: RoutedPair<T>;
    which: "pa" | "pb";
    id: string;
    side: string;
    other: number;
  };
  const ends: End[] = [];
  const edges = pairs.flatMap((pr) => {
    const a = boxes[pr.a];
    const b = boxes[pr.b];
    if (!a || !b) return [];
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const horiz = Math.abs(bx - ax) > (a.w + b.w) / 2;
    const e: RoutedPair<T> = {
      ...pr,
      pa: { x: ax, y: ay },
      pb: { x: bx, y: by },
    };
    ends.push({
      e,
      which: "pa",
      id: pr.a,
      side: horiz ? (bx > ax ? "R" : "L") : by > ay ? "B" : "T",
      other: horiz ? by : bx,
    });
    ends.push({
      e,
      which: "pb",
      id: pr.b,
      side: horiz ? (bx > ax ? "L" : "R") : by > ay ? "T" : "B",
      other: horiz ? ay : ax,
    });
    return [e];
  });
  const groups = new Map<string, End[]>();
  for (const en of ends) {
    const k = en.id + "\u0000" + en.side;
    const g = groups.get(k) ?? [];
    g.push(en);
    groups.set(k, g);
  }
  for (const g of groups.values()) {
    g.sort((p, q) => p.other - q.other);
    g.forEach((en, i) => {
      const bx = boxes[en.id] as Rect;
      const f = (i + 1) / (g.length + 1);
      en.e[en.which] =
        en.side === "L"
          ? { x: bx.x, y: bx.y + bx.h * f }
          : en.side === "R"
            ? { x: bx.x + bx.w, y: bx.y + bx.h * f }
            : en.side === "T"
              ? { x: bx.x + bx.w * f, y: bx.y }
              : { x: bx.x + bx.w * f, y: bx.y + bx.h };
    });
  }
  return edges;
}

export const gapsOf = (doc: ModelTraceDocument, cls: string): number =>
  classById(doc, cls).props.filter(isGap).length;

export const neighborsOf = (doc: ModelTraceDocument, c: string): Set<string> =>
  new Set(
    doc.relations.flatMap((r) =>
      r.from === c ? [r.to] : r.to === c ? [r.from] : [],
    ),
  );

/** Relations among a selection, and the neighbours every selected class
 *  shares (the answer to "how do these 2..n classes relate"). */
export function selectionSummary(
  doc: ModelTraceDocument,
  sel: string[],
): { among: TraceRelation[]; shared: string[] } {
  const set = new Set(sel);
  const among = doc.relations.filter((r) => set.has(r.from) && set.has(r.to));
  let shared: string[] = [];
  if (sel.length > 1) {
    const sets = sel.map((c) => neighborsOf(doc, c));
    shared = Array.from(sets[0] ?? []).filter(
      (n) => !set.has(n) && sets.every((s) => s.has(n)),
    );
  }
  return { among, shared };
}

export { allSecs };
