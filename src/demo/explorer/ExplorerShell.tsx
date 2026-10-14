/**
 * Model Explorer shell: one data model read through three layers
 * (concept, contract, realization), in an entity view and a zoomable
 * map whose level of detail follows zoom.
 *
 * This is the playground port of the reviewed single-file prototype,
 * kept at visual parity with it (styles.ts is generated from the
 * prototype's stylesheet). What changed is where things come from:
 * - the data is one versioned model-trace document (model.ts);
 * - map modules are placed by the toolkit's layoutStructural;
 * - map zoom levels are a core LodSchedule resolved with resolveLod;
 * - map selection lives in the exported useSelectionStore, and the
 *   light/dark palette follows useThemeStore.
 * The SVG drawing itself stays scenario-local: the toolkit's structural
 * SVG view draws one text run per row, and this view needs columns,
 * per-layer marks and per-level content (see the round log).
 */

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSelectionStore, useThemeStore } from "@g3-toolkit/react";
import {
  LENSES,
  PROFILES,
  SECLABEL,
  SECS,
  SAMPLE_ARRANGEMENT,
  SAMPLE_TRACE,
  allSecs,
  cloneOptions,
  type ExplorerOptions,
  type Lens,
  type ModelTraceDocument,
  type ProfileId,
  type RelationToggle,
  type Section,
  type TraceProperty,
  type TraceRelation,
} from "./model";
import {
  LOD_K,
  LOD_NAMES,
  MOD_HEAD,
  MOD_PAD,
  SLOT_W,
  buildClassView,
  classBox,
  classById,
  computeMapLayout,
  conceptText,
  contractText,
  entityGeometry,
  gapsOf,
  mapLevel,
  nameOf,
  neighborsOf,
  realText,
  routeEdges,
  selectionSummary,
  status,
  trunc,
  type EntityGeometry,
  type MapBox,
  type MapLayout,
  type RoutedPair,
  type ViewProperty,
} from "./derive";
import { EXPLORER_STYLES } from "./styles";
import { CapabilityBubble } from "../components/CapabilityCallout";

const DOC: ModelTraceDocument = SAMPLE_TRACE;
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap";

type Act = {
  onClick: (e: ReactMouseEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
};
function act(fn: (e?: ReactMouseEvent | KeyboardEvent) => void): Act {
  return {
    onClick: (e) => fn(e),
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fn(e);
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Strip({ p, x, y }: { p: TraceProperty; x: number; y: number }) {
  const cls = (v: TraceProperty["layers"]["c"]) =>
    v === "w" ? "dot-warn" : v ? "dot-on" : "dot-off";
  return (
    <g aria-hidden="true">
      <circle cx={x + 5} cy={y} r="4" className={cls(p.layers.c)} />
      <circle cx={x + 19} cy={y} r="4" className={cls(p.layers.s)} />
      <circle cx={x + 33} cy={y} r="4" className={cls(p.layers.r)} />
    </g>
  );
}

function Markers({ prefix, k = 1 }: { prefix: string; k?: number }) {
  const mk = (
    id: string,
    cls: string,
    vb: string,
    w: number,
    h: number,
    refX: number,
    refY: number,
    d: string,
  ) => (
    <marker
      key={id}
      id={prefix + id}
      viewBox={vb}
      refX={refX}
      refY={refY}
      markerWidth={w / k}
      markerHeight={h / k}
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path d={d} className={cls} />
    </marker>
  );
  return (
    <defs>
      {mk("arrow", "mk", "0 0 10 10", 10, 10, 10, 5, "M0 0L10 5L0 10z")}
      {mk("tri", "mk-hollow", "0 0 14 14", 14, 14, 13, 7, "M1 1L13 7L1 13z")}
      {mk("diamond", "mk", "0 0 18 10", 18, 10, 0, 5, "M0 5L9 0L18 5L9 10z")}
      {mk("h-arrow", "mk-hot", "0 0 10 10", 10, 10, 10, 5, "M0 0L10 5L0 10z")}
      {mk(
        "h-tri",
        "mk-hollow-hot",
        "0 0 14 14",
        14,
        14,
        13,
        7,
        "M1 1L13 7L1 13z",
      )}
      {mk(
        "h-diamond",
        "mk-hot",
        "0 0 18 10",
        18,
        10,
        0,
        5,
        "M0 5L9 0L18 5L9 10z",
      )}
    </defs>
  );
}

/* ------------------------------------------------------------------ */
/* Entity view                                                         */
/* ------------------------------------------------------------------ */

function EntityDiagram({
  g,
  o,
  sel,
  onSel,
  go,
  setSec,
  showAll,
  setExpanded,
}: {
  g: EntityGeometry;
  o: ExplorerOptions;
  sel: string | null;
  onSel: (key: string | null) => void;
  go: (cls: string) => void;
  setSec: (s: Section, v: boolean) => void;
  showAll: () => void;
  setExpanded: (v: boolean) => void;
}) {
  const X = g.box.x;
  return (
    <svg
      className="diagram"
      width={g.W}
      height={g.H}
      viewBox={`0 0 ${g.W} ${g.H}`}
      aria-label={"Entity view of " + g.header.name}
      data-testid="mx-entity-svg"
    >
      <Markers prefix="me-" />
      {g.edges.map((e, i) => (
        <g key={"e" + i}>
          <path
            d={e.d}
            className={"edge" + (e.dashed ? " dashed" : "")}
            markerEnd={e.end ? `url(#me-${e.end})` : undefined}
            markerStart={e.start ? `url(#me-${e.start})` : undefined}
          />
          {e.lab ? (
            <text
              x={e.lx}
              y={e.ly}
              textAnchor={e.anchor ?? "middle"}
              className="elab"
            >
              {e.lab}
            </text>
          ) : null}
        </g>
      ))}

      {g.stubs.map((s, i) => {
        const L = s.label;
        const plain = !s.group && !s.collapse;
        const uml = o.notation === "uml" && plain;
        const fn = s.group
          ? () => setExpanded(true)
          : s.collapse
            ? () => setExpanded(false)
            : () => go(L.cls ?? "");
        const tip = s.group
          ? `Show ${s.n} more related classes`
          : s.collapse
            ? "Collapse the group"
            : "Re-center on " + (L.cls ?? "");
        return (
          <g
            key={"s" + i}
            className={"stub" + (plain ? "" : " grp")}
            role="button"
            tabIndex={0}
            aria-label={tip}
            data-testid={plain ? `mx-stub-${L.cls}` : "mx-stub-group"}
            {...act(fn)}
          >
            <title>{tip}</title>
            <rect x={s.x} y={s.y} width={g.stubW} height={g.stubH} rx="8" />
            {uml ? (
              <g>
                <text
                  x={s.x + g.stubW / 2}
                  y={s.y + 18}
                  textAnchor="middle"
                  className="stsub"
                >
                  {L.sub}
                </text>
                <text
                  x={s.x + g.stubW / 2}
                  y={s.y + 35}
                  textAnchor="middle"
                  className="sttl"
                >
                  {L.title}
                </text>
              </g>
            ) : (
              <g>
                <text
                  x={s.x + 12}
                  y={s.y + 20}
                  className={
                    "sttl" + (o.notation === "onto" && plain ? " mono" : "")
                  }
                >
                  {L.title}
                </text>
                <text x={s.x + 12} y={s.y + 36} className="stsub">
                  {L.sub}
                </text>
              </g>
            )}
          </g>
        );
      })}

      <rect
        x={X}
        y={g.box.y}
        width={g.box.w}
        height={g.box.h}
        rx="8"
        className="box"
      />
      {o.notation === "uml" ? (
        <g>
          <text
            x={X + g.box.w / 2}
            y={g.box.y + 20}
            textAnchor="middle"
            className="hster"
          >
            «block»
          </text>
          <text
            x={X + g.box.w / 2}
            y={g.box.y + 40}
            textAnchor="middle"
            className="hname"
          >
            {g.header.name}
          </text>
        </g>
      ) : (
        <g>
          <text
            x={X + 16}
            y={g.box.y + 29}
            className={"hname" + (o.notation === "onto" ? " mono" : "")}
          >
            {g.header.name}
          </text>
          <text
            x={X + g.box.w - 16}
            y={g.box.y + 29}
            textAnchor="end"
            className="hmod"
          >
            {g.header.module}
          </text>
          {g.header.def ? (
            <text x={X + 16} y={g.box.y + 49} className="hdef">
              {g.header.def}
            </text>
          ) : null}
        </g>
      )}

      {g.items.map((it, i) => {
        if (it.type === "section")
          return (
            <g key={"i" + i} className="sec">
              <line
                x1={X + 12}
                x2={X + g.box.w - 12}
                y1={it.y + 2}
                y2={it.y + 2}
                className="rule"
              />
              {g.showStrip && it.sec ? (
                <g aria-hidden="true">
                  <text
                    x={X + 21}
                    y={it.y + 16}
                    textAnchor="middle"
                    className="sech"
                  >
                    C
                  </text>
                  <text
                    x={X + 35}
                    y={it.y + 16}
                    textAnchor="middle"
                    className="sech"
                  >
                    S
                  </text>
                  <text
                    x={X + 49}
                    y={it.y + 16}
                    textAnchor="middle"
                    className="sech"
                  >
                    R
                  </text>
                </g>
              ) : null}
              <text
                x={X + (g.showStrip ? 66 : 16)}
                y={it.y + 16}
                className="sech"
              >
                {it.label.toUpperCase()}
              </text>
              {it.sec ? (
                <text
                  x={X + g.box.w - 16}
                  y={it.y + 16}
                  textAnchor="end"
                  className="hide"
                  role="button"
                  tabIndex={0}
                  aria-label={"Hide " + it.label}
                  {...act(() => setSec(it.sec as Section, false))}
                >
                  Hide
                </text>
              ) : null}
            </g>
          );
        if (it.type === "compartment")
          return (
            <g key={"i" + i}>
              <line
                x1={X}
                x2={X + g.box.w}
                y1={it.y}
                y2={it.y}
                className="rule strong"
              />
              <text
                x={X + g.box.w / 2}
                y={it.y + 16}
                textAnchor="middle"
                className="comp"
              >
                {it.label}
              </text>
            </g>
          );
        if (it.type === "empty")
          return (
            <text key={"i" + i} x={X + 16} y={it.y + 15} className="df">
              No rows match the current filters
            </text>
          );
        if (it.type === "hidden")
          return (
            <g
              key={"i" + i}
              className="hid"
              role="button"
              tabIndex={0}
              data-testid="mx-hidden-rows"
              {...act(showAll)}
            >
              <text x={X + 16} y={it.y + 15}>
                {it.n} {it.n === 1 ? "row" : "rows"} hidden by filters · Show
                all
              </text>
            </g>
          );
        if (it.type === "rel") {
          const l = it.l;
          const base = it.y + 15;
          return (
            <g
              key={"i" + i}
              className="rel"
              role="button"
              tabIndex={0}
              aria-label={"Re-center on " + l.target}
              {...act(() => go(l.target))}
            >
              <rect
                x={X + 6}
                y={it.y + 1}
                width={g.box.w - 12}
                height="20"
                rx="4"
                className="hl"
              />
              <text
                x={X + g.cols.c1}
                y={base}
                className={"nm link" + (g.mono ? " mono" : "")}
              >
                {l.text}
              </text>
              {l.type ? (
                <text x={X + g.cols.c2} y={base} className="ty">
                  {l.type}
                </text>
              ) : null}
              {l.req ? (
                <text
                  x={X + g.cols.c3}
                  y={base}
                  className={"rq" + (l.req === "required" ? " strong" : "")}
                >
                  {l.req}
                </text>
              ) : null}
            </g>
          );
        }
        const r = it.r;
        const p = r.p;
        const base = it.y + 15;
        const isSel = sel === p.key;
        const hlCls = "hl" + (isSel ? " sel" : r.val?.bad ? " rej" : "");
        return (
          <g
            key={"r" + p.key}
            className={"row" + (r.pres ? "" : " faded")}
            role="button"
            tabIndex={0}
            aria-label={"Details for " + p.key}
            data-testid={`mx-row-${p.key}`}
            {...act(() => onSel(isSel ? null : p.key))}
          >
            <rect
              x={X + 6}
              y={it.y + 1}
              width={g.box.w - 12}
              height={r.def ? 36 : 20}
              rx="4"
              className={hlCls}
            />
            {g.showStrip ? <Strip p={p} x={X + 16} y={base - 4} /> : null}
            <text
              x={X + g.cols.c1}
              y={base}
              className={
                "nm" + (g.mono ? " mono" : "") + (r.nameMuted ? " muted" : "")
              }
            >
              {r.name}
            </text>
            {r.type ? (
              <text x={X + g.cols.c2} y={base} className="ty">
                {r.type}
              </text>
            ) : null}
            {r.req ? (
              <text
                x={X + g.cols.c3}
                y={base}
                className={"rq" + (r.req === "required" ? " strong" : "")}
              >
                {r.req}
              </text>
            ) : null}
            {r.val ? (
              <text
                x={X + g.cols.c4}
                y={base}
                className={
                  "vl" +
                  (r.val.bad ? " bad" : "") +
                  (r.val.muted ? " muted" : "")
                }
              >
                {r.val.t}
              </text>
            ) : null}
            {r.def ? (
              <text x={X + g.cols.c1} y={base + 16} className="df">
                {trunc(r.def, g.defChars)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function Detail({
  p,
  focus,
  o,
  x,
  y,
  onClose,
  go,
}: {
  p: ViewProperty;
  focus: string;
  o: ExplorerOptions;
  x: number;
  y: number;
  onClose: () => void;
  go: (cls: string) => void;
}) {
  const st = status(p);
  const stLabel = {
    ok: "Full trace",
    gap: "Gap",
    conflict: "Layers disagree",
    internal: "Internal",
  }[st];
  const rej =
    o.data === "rejected" ? DOC.rejections[focus]?.[p.key] : undefined;
  const wire = p.internal
    ? "not projected"
    : !p.layers.s
      ? "absent"
      : !p.layers.r
        ? `"${p.key}" (never sent)`
        : `"${p.key}"`;
  let gapNote: string | null = null;
  if (st === "gap" && !p.layers.c)
    gapNote =
      "No concept. SMEs write a definition and pattern; until then it lands in Unclassified and the SDK has nothing to say about it.";
  else if (st === "gap" && !p.layers.r)
    gapNote =
      "In the contract but not built. Engineers implement it, or SMEs mark it notRealized.";
  return (
    <div
      className="pop"
      style={{ left: x, top: y }}
      role="dialog"
      aria-label={"Provenance of " + p.key}
      data-testid="mx-detail"
    >
      <div className="pop-h">
        <span className="key">{p.key}</span>
        <span className={"tag " + st}>{stLabel}</span>
        <button
          type="button"
          className="x"
          onClick={onClose}
          aria-label="Close details"
        >
          ×
        </button>
      </div>
      <p className="def">
        {p.def ??
          "No definition: this property has no concept in the vocabulary."}
        {p.scope ? (
          <>
            {" "}
            <em>{p.scope}</em>
          </>
        ) : null}
      </p>
      {p.inherited && p.from ? (
        <p>
          Inherited from{" "}
          <button
            type="button"
            className="linkbtn"
            onClick={() => go(p.from as string)}
          >
            {p.from}
          </button>
          .
        </p>
      ) : null}
      <table className="prov">
        <thead>
          <tr>
            <th>Layer</th>
            <th>States</th>
            <th>From</th>
          </tr>
        </thead>
        <tbody>
          <tr className={p.layers.c ? "" : "abs"}>
            <td>Concept (C)</td>
            <td>{p.layers.c ? conceptText(p) : "absent"}</td>
            <td className="src">vocabulary, SME</td>
          </tr>
          <tr className={p.layers.s ? "" : "abs"}>
            <td>Shape / Contract (S)</td>
            <td className="code">
              {p.layers.s ? contractText(p, "onto") : "absent"}
            </td>
            <td className="src">shapes, SME</td>
          </tr>
          <tr className={p.layers.r ? "" : "abs"}>
            <td>Realization (R)</td>
            <td className="code">
              {p.layers.r ? `${p.rust}: ${realText(p)}` : "absent"}
            </td>
            <td className="src">manifest, engineer</td>
          </tr>
          <tr className={p.internal || !p.layers.s ? "abs" : ""}>
            <td>Wire</td>
            <td className="code">{wire}</td>
            <td className="src">JSON-LD context, generated</td>
          </tr>
        </tbody>
      </table>
      {p.conflict ? (
        <div className="note warn">
          {p.conflict} The conformance gate fails until engineers add the code
          or SMEs mark it notRealized.
        </div>
      ) : null}
      {gapNote ? <div className="note warn">{gapNote}</div> : null}
      {p.internal ? (
        <div className="note info">
          Internal field: never projected to the API and never documented.
          Correct as long as it stays marked internal.
        </div>
      ) : null}
      {rej ? (
        <div className="note crit">
          Write sent {rej.value}. {rej.msg}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Customize drawer                                                    */
/* ------------------------------------------------------------------ */

function Opt({
  id,
  type,
  name,
  checked,
  onChange,
  label,
  n,
  desc,
  disabled,
}: {
  id: string;
  type: "radio" | "checkbox";
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  n?: number | null;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <label className={"opt" + (disabled ? " disabled" : "")} htmlFor={id}>
      <input
        id={id}
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
      <span className="n">{n ?? ""}</span>
      {desc ? <span className="desc">{desc}</span> : null}
    </label>
  );
}

function Leg({ t, changed }: { t: string; changed?: boolean }) {
  return (
    <legend>
      {t}
      {changed ? (
        <span className="chg" title="Differs from the profile default" />
      ) : null}
    </legend>
  );
}

function Drawer({
  open,
  onClose,
  profile,
  applyProfile,
  o,
  d,
  counts,
  traceCounts,
  relCounts,
  set,
  setSec,
  setRel,
}: {
  open: boolean;
  onClose: () => void;
  profile: ProfileId;
  applyProfile: (k: ProfileId) => void;
  o: ExplorerOptions;
  d: ExplorerOptions;
  counts: Record<Section, number>;
  traceCounts: { all: number; gaps: number; conflicts: number };
  relCounts: Record<RelationToggle, number>;
  set: (patch: Partial<ExplorerOptions>) => void;
  setSec: (s: Section, v: boolean) => void;
  setRel: (k: RelationToggle, v: boolean) => void;
}) {
  const chg = (a: unknown, b: unknown) =>
    JSON.stringify(a) !== JSON.stringify(b);
  function radios<K extends "notation" | "lens" | "label" | "trace" | "data">(
    key: K,
    choices: [ExplorerOptions[K], string, (number | null)?, string?][],
  ) {
    return choices.map(([v, label, n, desc]) => (
      <Opt
        key={String(v)}
        id={`mx-o-${key}-${String(v)}`}
        type="radio"
        name={`mx-${key}`}
        checked={o[key] === v}
        onChange={() => set({ [key]: v } as Partial<ExplorerOptions>)}
        label={label}
        n={n}
        desc={desc}
      />
    ));
  }
  return (
    <aside
      className={"drawer" + (open ? " open" : "")}
      aria-hidden={!open}
      aria-label="Customize the view"
      data-testid="mx-drawer"
    >
      <div className="drawer-h">
        <h2>Customize view</h2>
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </div>
      <fieldset className="grp">
        <Leg t="Profile" />
        {(Object.keys(PROFILES) as ProfileId[]).map((k) => (
          <Opt
            key={k}
            id={"mx-o-profile-" + k}
            type="radio"
            name="mx-profile"
            checked={profile === k}
            onChange={() => applyProfile(k)}
            label={PROFILES[k].label}
            desc={PROFILES[k].blurb}
          />
        ))}
      </fieldset>
      <fieldset className="grp">
        <Leg t="Notation" changed={o.notation !== d.notation} />
        {radios("notation", [
          ["uml", "SysML block (UML)"],
          ["api", "API card"],
          ["onto", "Ontology"],
        ])}
      </fieldset>
      <fieldset className="grp">
        <Leg t="Lens" changed={o.lens !== d.lens} />
        {radios("lens", [
          ...LENSES.map(
            (l) =>
              [l.id, `${l.name} (${l.letter})`, null, l.desc] as [
                Lens,
                string,
                null,
                string,
              ],
          ),
        ])}
      </fieldset>
      <fieldset className="grp">
        <Leg t="Label rows by" changed={o.label !== d.label} />
        {radios("label", [
          ["key", "Contract key"],
          ["iri", "IRI"],
          ["rust", "Rust field"],
          ["json", "JSON pointer"],
        ])}
      </fieldset>
      <fieldset className="grp">
        <Leg t="Rows" changed={chg(o.sec, d.sec)} />
        {SECS.map((s) => (
          <Opt
            key={s}
            id={"mx-o-sec-" + s}
            type="checkbox"
            checked={!!o.sec[s]}
            disabled={!counts[s]}
            onChange={(v) => setSec(s, v)}
            label={SECLABEL[s]}
            n={counts[s]}
          />
        ))}
      </fieldset>
      <fieldset className="grp">
        <Leg t="Trace status" changed={o.trace !== d.trace} />
        {radios("trace", [
          ["all", "All rows", traceCounts.all],
          ["gaps", "Gaps and conflicts", traceCounts.gaps],
          ["conflicts", "Conflicts only", traceCounts.conflicts],
        ])}
      </fieldset>
      <fieldset className="grp">
        <Leg t="Relations" changed={chg(o.rel, d.rel)} />
        {(
          [
            ["incoming", "Incoming"],
            ["outgoing", "Outgoing references"],
            ["parts", "Parts"],
            ["superclass", "Superclass"],
          ] as [RelationToggle, string][]
        ).map(([k, label]) => (
          <Opt
            key={k}
            id={"mx-o-rel-" + k}
            type="checkbox"
            checked={!!o.rel[k]}
            disabled={!relCounts[k]}
            onChange={(v) => setRel(k, v)}
            label={label}
            n={relCounts[k]}
          />
        ))}
      </fieldset>
      <fieldset className="grp">
        <Leg t="Text" changed={o.defs !== d.defs} />
        <Opt
          id="mx-o-defs"
          type="checkbox"
          checked={o.defs}
          onChange={(v) => set({ defs: v })}
          label="Show definitions inline"
          desc="Otherwise they appear when a row is clicked."
        />
      </fieldset>
      <fieldset className="grp">
        <Leg t="Data overlay" changed={o.data !== d.data} />
        {radios("data", [
          ["none", "None"],
          ["fixture", "Conformance fixture"],
          ["rejected", "Rejected write", null, "Sample only for Transponder"],
        ])}
      </fieldset>
      <p className="drawer-foot">
        A dot next to a group means it differs from the{" "}
        {PROFILES[profile].label} defaults. Esc closes this panel.
      </p>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Map view                                                            */
/* ------------------------------------------------------------------ */

type ViewT = { k: number; tx: number; ty: number };
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function MapClass({
  b,
  o,
  state,
  onClick,
  onDbl,
}: {
  b: MapBox;
  o: ExplorerOptions;
  state: "sel" | "dim" | "";
  onClick: (e?: ReactMouseEvent | KeyboardEvent) => void;
  onDbl: () => void;
}) {
  const cls =
    "mclass" + (state === "sel" ? " sel" : state === "dim" ? " dim" : "");
  const X = b.x;
  const Y = b.y;
  const common = {
    className: cls,
    role: "button",
    tabIndex: 0,
    "aria-label": b.cls + ": click to select, double-click to open",
    "data-testid": "mx-class-" + b.cls,
    onClick: (e: ReactMouseEvent) => onClick(e),
    onDoubleClick: onDbl,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter") onDbl();
      else if (e.key === " ") {
        e.preventDefault();
        onClick(e);
      }
    },
  };
  const onto = o.notation === "onto";
  const strip = o.lens === "combined";
  if (b.lod === 1) {
    const gaps = strip ? gapsOf(DOC, b.cls) : 0;
    return (
      <g {...common}>
        <rect x={X} y={Y} width={b.w} height={b.h} rx="12" className="mbox" />
        <text
          x={X + 22}
          y={Y + 39}
          className={"m1name" + (onto ? " mono" : "")}
        >
          {b.title}
        </text>
        {gaps ? (
          <g>
            <circle
              cx={X + b.w - 26}
              cy={Y + b.h / 2}
              r="14"
              className="mgap"
            />
            <text
              x={X + b.w - 26}
              y={Y + b.h / 2 + 6}
              textAnchor="middle"
              className="mgapn"
            >
              {gaps}
            </text>
          </g>
        ) : null}
      </g>
    );
  }
  const rows = b.rows ?? [];
  if (b.lod === 2) {
    return (
      <g {...common}>
        <rect x={X} y={Y} width={b.w} height={b.h} rx="8" className="mbox" />
        <text
          x={X + 16}
          y={Y + 28}
          className={"m2name" + (onto ? " mono" : "")}
        >
          {b.title}
        </text>
        <line
          x1={X}
          x2={X + b.w}
          y1={Y + 40}
          y2={Y + 40}
          className="rule strong"
        />
        {rows.map((r, i) => {
          const nm = nameOf(r.p, o.label);
          return (
            <g key={r.p.key} className={r.pres ? "" : "faded"}>
              {strip ? <Strip p={r.p} x={X + 16} y={Y + 53 + i * 21} /> : null}
              <text
                x={X + 16 + (strip ? 50 : 0)}
                y={Y + 58 + i * 21}
                className={
                  "m2row" +
                  (o.notation !== "uml" ? " mono" : "") +
                  (nm.muted ? " muted" : "")
                }
              >
                {nm.t}
              </text>
            </g>
          );
        })}
      </g>
    );
  }
  const c = b.cols as NonNullable<MapBox["cols"]>;
  const head = b.head ?? 44;
  return (
    <g {...common}>
      <rect x={X} y={Y} width={b.w} height={b.h} rx="8" className="mbox" />
      {o.notation === "uml" ? (
        <g>
          <text
            x={X + b.w / 2}
            y={Y + 20}
            textAnchor="middle"
            className="hster"
          >
            «block»
          </text>
          <text
            x={X + b.w / 2}
            y={Y + 40}
            textAnchor="middle"
            className="hname"
          >
            {b.title}
          </text>
        </g>
      ) : (
        <text x={X + 16} y={Y + 28} className={"hname" + (onto ? " mono" : "")}>
          {b.title}
        </text>
      )}
      <line
        x1={X}
        x2={X + b.w}
        y1={Y + head - 4}
        y2={Y + head - 4}
        className="rule strong"
      />
      {rows.map((r, i) => {
        const base = Y + head + 12 + i * 21;
        return (
          <g key={r.p.key} className={r.pres ? "" : "faded"}>
            {strip ? <Strip p={r.p} x={X + 16} y={base - 4} /> : null}
            <text
              x={X + c.c1}
              y={base}
              className={
                "nm" +
                (o.notation !== "uml" ? " mono" : "") +
                (r.nameMuted ? " muted" : "")
              }
            >
              {r.name}
            </text>
            {r.type ? (
              <text x={X + c.c2} y={base} className="ty">
                {r.type}
              </text>
            ) : null}
            {r.req ? (
              <text
                x={X + c.c3}
                y={base}
                className={"rq" + (r.req === "required" ? " strong" : "")}
              >
                {r.req}
              </text>
            ) : null}
            {r.val ? (
              <text
                x={X + c.c4}
                y={base}
                className={
                  "vl" +
                  (r.val.bad ? " bad" : "") +
                  (r.val.muted ? " muted" : "")
                }
              >
                {r.val.t}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function MapView({
  o,
  focus,
  openEntity,
}: {
  o: ExplorerOptions;
  focus: string;
  openEntity: (cls: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [t, setT] = useState<ViewT | null>(null);
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const tRef = useRef<ViewT | null>(null);
  const vpRef = useRef(vp);
  const moved = useRef(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const [scope, setScope] = useState<"all" | "focus">("all");
  const selIds = useSelectionStore((s) => s.selectedNodeIds);
  const sel = useMemo(
    () =>
      Array.from(selIds).filter((id) => DOC.classes.some((c) => c.id === id)),
    [selIds],
  );

  useLayoutEffect(() => {
    tRef.current = t;
    vpRef.current = vp;
  });

  // The map opens with the entity view's class selected (selection is
  // the toolkit's exported store, so any other view could read it).
  useEffect(() => {
    useSelectionStore.getState().selectNodes([focus]);
  }, [focus]);

  // Module placement is computed ONCE per document by the toolkit's
  // structural layout; nothing below ever re-runs it.
  useEffect(() => {
    let live = true;
    void computeMapLayout(DOC, SAMPLE_ARRANGEMENT).then((l) => {
      if (live) setLayout(l);
    });
    return () => {
      live = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setVp({ w: el.clientWidth, h: el.clientHeight });
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visible = useMemo(() => {
    const all = new Set(DOC.classes.map((c) => c.id));
    if (scope !== "focus" || !sel.length) return all;
    const v = new Set(sel);
    sel.forEach((c) => neighborsOf(DOC, c).forEach((n) => v.add(n)));
    return v;
  }, [scope, sel]);

  const fitTo = (classes: string[], lay: MapLayout | null = layout) => {
    const v = vpRef.current;
    if (!v.w || !lay || !classes.length) return;
    const sl = classes.flatMap((c) => (lay.slots[c] ? [lay.slots[c]] : []));
    if (!sl.length) return;
    const x0 = Math.min(...sl.map((s) => s.cx - SLOT_W / 2)) - MOD_PAD;
    const x1 = Math.max(...sl.map((s) => s.cx + SLOT_W / 2)) + MOD_PAD;
    const y0 = Math.min(...sl.map((s) => s.cy - s.h / 2)) - MOD_HEAD;
    const y1 = Math.max(...sl.map((s) => s.cy + s.h / 2)) + MOD_PAD;
    const k = clampN(
      Math.min((v.w - 60) / (x1 - x0), (v.h - 130) / (y1 - y0)),
      0.15,
      2.4,
    );
    setT({
      k,
      tx: v.w / 2 - ((x0 + x1) / 2) * k,
      ty: v.h / 2 + 30 - ((y0 + y1) / 2) * k,
    });
  };
  const fitRef = useRef(fitTo);
  useLayoutEffect(() => {
    fitRef.current = fitTo;
  });
  useEffect(() => {
    if (!tRef.current && vp.w && layout)
      fitRef.current(
        DOC.classes.map((c) => c.id),
        layout,
      );
  }, [vp.w, layout]);
  useEffect(() => {
    if (tRef.current) fitRef.current(Array.from(visible));
    // Refit only when the scope toggles, not on every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element).closest?.(".overlay")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setT((t0) => {
        if (!t0) return t0;
        const k = clampN(t0.k * Math.exp(-e.deltaY * 0.0015), 0.15, 3);
        return {
          k,
          tx: mx - ((mx - t0.tx) * k) / t0.k,
          ty: my - ((my - t0.ty) * k) / t0.k,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t0 = tRef.current;
    if (e.button !== 0 || !t0) return;
    if ((e.target as Element).closest?.(".overlay")) return;
    const d = {
      x: e.clientX,
      y: e.clientY,
      tx: t0.tx,
      ty: t0.ty,
      moved: false,
    };
    moved.current = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - d.x;
      const dy = ev.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved)
        setT((tt) => (tt ? { k: tt.k, tx: d.tx + dx, ty: d.ty + dy } : tt));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      moved.current = d.moved;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const zoomAt = (k2: number) =>
    setT((t0) => {
      if (!t0) return t0;
      const v = vpRef.current;
      const cx = v.w / 2;
      const cy = v.h / 2;
      const k = clampN(k2, 0.15, 3);
      return {
        k,
        tx: cx - ((cx - t0.tx) * k) / t0.k,
        ty: cy - ((cy - t0.ty) * k) / t0.k,
      };
    });

  const k = t ? t.k : 1;
  const { level: lod, edgeLabels } = mapLevel(k);
  const boxes = useMemo(() => {
    const out: Record<string, MapBox> = {};
    if (!layout) return out;
    Array.from(visible).forEach((c) => {
      const l = pinned.includes(c) ? Math.min(3, Math.max(1, lod + 1)) : lod;
      if (l >= 1) out[c] = classBox(DOC, layout, c, l as 1 | 2 | 3, o);
    });
    return out;
  }, [visible, pinned, lod, o, layout]);

  const selSet = new Set(sel);
  const hot = new Set(sel);
  sel.forEach((c) => neighborsOf(DOC, c).forEach((n) => hot.add(n)));
  const classState = (c: string): "sel" | "dim" | "" =>
    selSet.has(c) ? "sel" : sel.length && !hot.has(c) ? "dim" : "";

  const relEdges = routeEdges(
    DOC.relations
      .filter((r) => boxes[r.from] && boxes[r.to])
      .map((r) => ({ a: r.from, b: r.to, data: r })),
    boxes,
  );
  let modEdges: RoutedPair<number>[] = [];
  if (lod === 0 && layout) {
    const counts = new Map<string, number>();
    DOC.relations.forEach((r) => {
      const ma = layout.slots[r.from]?.module;
      const mb = layout.slots[r.to]?.module;
      if (!ma || !mb || ma === mb || !visible.has(r.from) || !visible.has(r.to))
        return;
      const key = [ma, mb].sort().join("|");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const mboxes = Object.fromEntries(
      layout.mods.map((m) => [m.name, { x: m.x, y: m.y, w: m.w, h: m.h }]),
    );
    modEdges = routeEdges(
      Array.from(counts.entries()).map(([key, n]) => {
        const [a = "", b = ""] = key.split("|");
        return { a, b, data: n };
      }),
      mboxes,
    );
  }

  const store = useSelectionStore.getState;
  const clickClass = (c: string) => (e?: ReactMouseEvent | KeyboardEvent) => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    if (e && "shiftKey" in e && e.shiftKey) store().toggleNodeSelection(c);
    else store().selectNodes([c]);
  };
  const bgClick = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    store().clearSelection();
  };
  const togglePin = (c: string) =>
    setPinned((pp) =>
      pp.includes(c) ? pp.filter((x) => x !== c) : pp.concat(c),
    );
  const { among, shared } = selectionSummary(DOC, sel);
  const relLabel = (r: TraceRelation) =>
    r.kind === "isa"
      ? "is a kind of"
      : (o.notation === "onto" ? "ex:" : "") +
        r.key +
        (r.card ? ` [${r.card}]` : "");

  return (
    <div
      className="mapwrap"
      ref={wrapRef}
      onPointerDown={onDown}
      data-testid="mx-map"
    >
      {t && layout ? (
        <svg
          className="mapsvg"
          width={vp.w}
          height={vp.h}
          aria-label="Map of all classes"
        >
          <Markers prefix="mm-" k={k} />
          <rect
            className="bg"
            x="0"
            y="0"
            width={vp.w}
            height={vp.h}
            onClick={bgClick}
          />
          <g transform={`translate(${t.tx} ${t.ty}) scale(${k})`}>
            {layout.mods
              .filter((m) => m.classes.some((c) => visible.has(c)))
              .map((m) => {
                const dim = sel.length && !m.classes.some((c) => hot.has(c));
                return (
                  <g
                    key={"m" + m.name}
                    className={"mmod" + (dim ? " dim" : "")}
                  >
                    <rect
                      x={m.x}
                      y={m.y}
                      width={m.w}
                      height={m.h}
                      rx="18"
                      className={lod === 0 ? "mmodbox l0" : "mmodbox"}
                    />
                    {lod === 0 ? (
                      <g>
                        <text
                          x={m.x + m.w / 2}
                          y={m.y + m.h / 2 - 6}
                          textAnchor="middle"
                          className="m0name"
                        >
                          {m.name}
                        </text>
                        <text
                          x={m.x + m.w / 2}
                          y={m.y + m.h / 2 + 38}
                          textAnchor="middle"
                          className="m0sub"
                        >
                          {m.classes.length}{" "}
                          {m.classes.length === 1 ? "class" : "classes"}
                        </text>
                      </g>
                    ) : (
                      <text
                        x={m.x + 20}
                        y={m.y + 34}
                        className="mmodname"
                        style={{ fontSize: [0, 20, 15, 14][lod] + "px" }}
                      >
                        {m.name.toUpperCase()}
                      </text>
                    )}
                  </g>
                );
              })}
            {modEdges.map((e, i) => (
              <g key={"me" + i}>
                <path
                  d={`M${e.pa.x} ${e.pa.y}L${e.pb.x} ${e.pb.y}`}
                  className="medge"
                  style={{ strokeWidth: 1.5 + e.data * 1.5 }}
                />
                <text
                  x={(e.pa.x + e.pb.x) / 2}
                  y={(e.pa.y + e.pb.y) / 2 + 12}
                  textAnchor="middle"
                  className="m0count"
                  style={{ strokeWidth: 8 }}
                >
                  {e.data}
                </text>
              </g>
            ))}
            {relEdges.map((e, i) => {
              const r = e.data;
              const h = sel.length
                ? selSet.has(r.from) || selSet.has(r.to)
                : false;
              const dim = sel.length && !h;
              const pre = h ? "mm-h-" : "mm-";
              const showLab =
                edgeLabels &&
                (boxes[r.from]?.lod ?? 0) >= 2 &&
                (boxes[r.to]?.lod ?? 0) >= 2 &&
                r.kind !== "isa";
              const endM =
                r.kind === "reference"
                  ? `url(#${pre}arrow)`
                  : r.kind === "isa"
                    ? `url(#${pre}${o.notation === "uml" ? "tri" : "arrow"})`
                    : undefined;
              return (
                <g key={"e" + i} className={dim ? "dim" : ""}>
                  <path
                    d={`M${e.pa.x} ${e.pa.y}L${e.pb.x} ${e.pb.y}`}
                    className={"edge" + (h ? " hot" : "")}
                    markerStart={
                      r.kind === "composition"
                        ? `url(#${pre}diamond)`
                        : undefined
                    }
                    markerEnd={endM}
                  />
                  {showLab ? (
                    <text
                      x={(e.pa.x + e.pb.x) / 2}
                      y={(e.pa.y + e.pb.y) / 2 - 6}
                      textAnchor="middle"
                      className="elab halo"
                      style={{ strokeWidth: 4 / k }}
                    >
                      {relLabel(r)}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {Object.values(boxes).map((b) => (
              <MapClass
                key={b.cls}
                b={b}
                o={o}
                state={classState(b.cls)}
                onClick={clickClass(b.cls)}
                onDbl={() => openEntity(b.cls)}
              />
            ))}
          </g>
        </svg>
      ) : (
        <p className="hints" style={{ padding: 16 }}>
          Laying out modules…
        </p>
      )}

      {sel.length ? (
        <div
          className="overlay selcard"
          role="region"
          aria-label="Selection"
          data-testid="mx-selcard"
        >
          <div className="sc-h">
            <b>
              {sel.length === 1 ? sel[0] : `${sel.length} classes selected`}
            </b>
            <button
              type="button"
              className="x"
              onClick={() => store().clearSelection()}
              aria-label="Clear selection"
            >
              ×
            </button>
          </div>
          {sel.map((c) => {
            const C = classById(DOC, c);
            const gaps = gapsOf(DOC, c);
            return (
              <div key={c} className="sc-item">
                <div className="sc-row">
                  <span className="sc-name">{c}</span>
                  <span className="sc-mod">{C.module}</span>
                </div>
                <p>{C.def}</p>
                <div className="sc-meta">
                  {C.props.length} properties
                  {gaps ? (
                    <>
                      , <span className="warn-t">{gaps} with gaps</span>
                    </>
                  ) : null}
                </div>
                <div className="sc-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => openEntity(c)}
                  >
                    Open entity view
                  </button>
                  <button
                    type="button"
                    className="btn"
                    aria-pressed={pinned.includes(c)}
                    onClick={() => togglePin(c)}
                  >
                    {pinned.includes(c) ? "Unpin detail" : "Pin more detail"}
                  </button>
                </div>
              </div>
            );
          })}
          {sel.length > 1 ? (
            <div className="sc-sec">
              <div className="sc-lbl">Direct relations</div>
              {among.length ? (
                among.map((r, i) => (
                  <div key={i} className="sc-rel">
                    <b>{r.from}</b> {relLabel(r)} <b>{r.to}</b>
                  </div>
                ))
              ) : (
                <div className="sc-none">
                  None between the selected classes.
                </div>
              )}
              <div className="sc-lbl">Shared neighbors</div>
              {shared.length ? (
                <div className="sc-chips">
                  {shared.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="chip"
                      onClick={() => store().addNodesToSelection([n])}
                    >
                      + {n}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="sc-none">None.</div>
              )}
            </div>
          ) : (
            <p className="sc-tip">
              Shift-click another class to compare relations.
            </p>
          )}
          <label className="opt" htmlFor="mx-o-scope">
            <input
              id="mx-o-scope"
              type="checkbox"
              checked={scope === "focus"}
              onChange={(e) => setScope(e.target.checked ? "focus" : "all")}
            />
            <span>Show only these and their neighbors</span>
            <span />
          </label>
          <button type="button" className="btn" onClick={() => fitTo(sel)}>
            Zoom to selection
          </button>
        </div>
      ) : null}

      {t ? (
        <div
          className="overlay lodbox"
          role="group"
          aria-label="Zoom and detail"
        >
          <div className="lod-levels">
            {LOD_NAMES.map((n, i) => (
              <button
                key={n}
                type="button"
                aria-pressed={lod === i}
                data-testid={"mx-lod-" + i}
                onClick={() => zoomAt(LOD_K[i] ?? 1)}
              >
                {n}
              </button>
            )).reverse()}
          </div>
          <div className="zoomrow">
            <button
              type="button"
              className="btn"
              onClick={() => zoomAt(k / 1.25)}
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="pct">{Math.round(k * 100)}%</span>
            <button
              type="button"
              className="btn"
              onClick={() => zoomAt(k * 1.25)}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => fitTo(Array.from(visible))}
            >
              Fit
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export function ExplorerShell({ onBack }: { onBack: () => void }) {
  const dark = useThemeStore((s) => s.theme.id === "dark");
  const [profile, setProfile] = useState<ProfileId>("sys");
  const [opts, setOpts] = useState<ExplorerOptions>(() =>
    cloneOptions(PROFILES.sys.opts),
  );
  const [focus, setFocus] = useState("Transponder");
  const [history, setHistory] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [view, setView] = useState<"entity" | "map">("entity");
  const [cw, setCw] = useState(1000);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load the prototype's typefaces once (the design tokens already name
  // IBM Plex; this makes the webfont actually present).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const update = () => setCw(el.clientWidth || 1000);
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  useEffect(() => {
    const k = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        setSel(null);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const m = useMemo(() => buildClassView(DOC, focus, opts), [focus, opts]);
  const g = useMemo(
    () => entityGeometry(DOC, m, opts, cw, expanded),
    [m, opts, cw, expanded],
  );
  const d = PROFILES[profile].opts;
  const modified = JSON.stringify(opts) !== JSON.stringify(d);

  const set = (patch: Partial<ExplorerOptions>) =>
    setOpts((o) => ({ ...o, ...patch }));
  const setSec = (k: Section, v: boolean) =>
    setOpts((o) => ({ ...o, sec: { ...o.sec, [k]: v } }));
  const setRel = (k: RelationToggle, v: boolean) =>
    setOpts((o) => ({ ...o, rel: { ...o.rel, [k]: v } }));
  const showAll = () =>
    setOpts((o) => ({ ...o, sec: allSecs(true), trace: "all" }));
  const applyProfile = (k: ProfileId) => {
    setProfile(k);
    setOpts(cloneOptions(PROFILES[k].opts));
    setSel(null);
  };
  const go = (cls: string) => {
    if (!cls || cls === focus) return;
    setHistory((h) => h.concat(focus));
    setFocus(cls);
    setSel(null);
    setExpanded(false);
  };
  const back = () => {
    const prev = history[history.length - 1];
    if (prev === undefined) return;
    setFocus(prev);
    setHistory(history.slice(0, -1));
    setSel(null);
    setExpanded(false);
  };
  const openEntity = (cls: string) => {
    if (cls !== focus) {
      setHistory((h) => h.concat(focus));
      setFocus(cls);
      setExpanded(false);
    }
    setSel(null);
    setView("entity");
  };

  const selRow = sel
    ? g.items.find(
        (it): it is Extract<(typeof g.items)[number], { type: "row" }> =>
          it.type === "row" && it.r.p.key === sel,
      )
    : undefined;
  const popX = selRow
    ? Math.max(8, Math.min(g.box.x + g.box.w + 16, g.W - 360))
    : 0;
  const popY = selRow ? Math.max(8, selRow.y - 12) : 0;

  const relCounts: Record<RelationToggle, number> = {
    incoming: m.incoming.length,
    outgoing: m.outgoing.length,
    parts: m.parts.length,
    superclass: m.sup ? 1 : 0,
  };
  const modules = new Set(DOC.classes.map((c) => c.module)).size;

  return (
    <div className={"mx" + (dark ? " mx-dark" : "")} data-testid="mx-shell">
      <style>{EXPLORER_STYLES}</style>
      <div className="app">
        <header className="top">
          <button type="button" className="back" onClick={onBack}>
            ← Scenarios
          </button>
          <h1>Model Explorer</h1>
          <span className="sample">
            Prototype. Sample satellite payload model: class names, definitions
            and values are illustrative.
          </span>
          <div className="seg theme" role="group" aria-label="Theme">
            {(
              [
                ["light", "Light"],
                ["dark", "Dark"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={(v === "dark") === dark}
                data-testid={"mx-theme-" + v}
                onClick={() => useThemeStore.getState().setTheme(v)}
              >
                {l}
              </button>
            ))}
          </div>
        </header>
        <div className="subbar">
          {view === "entity" ? (
            <Fragment>
              <button
                type="button"
                className="back"
                onClick={back}
                disabled={!history.length}
              >
                ← {history.length ? history[history.length - 1] : "Back"}
              </button>
              <span className="crumbs">
                <span className="mod">{m.C.module}</span>
                <span aria-hidden="true">›</span>
                <b>{focus}</b>
              </span>
            </Fragment>
          ) : (
            <span className="crumbs">
              <b>Whole model</b>
              <span className="mod">
                {DOC.classes.length} classes in {modules} modules
              </span>
            </span>
          )}
          <span className="blurb">
            <b>{PROFILES[profile].label}:</b> {PROFILES[profile].blurb}
          </span>
        </div>
        <div className={"stage" + (view === "map" ? " is-map" : "")}>
          {view === "entity" ? (
            <div
              className="scroller"
              ref={scrollRef}
              onClick={(e) => {
                if ((e.target as Element).tagName === "svg") setSel(null);
              }}
            >
              <div className="canvas" style={{ width: g.W, height: g.H }}>
                <EntityDiagram
                  g={g}
                  o={opts}
                  sel={sel}
                  onSel={setSel}
                  go={go}
                  setSec={setSec}
                  showAll={showAll}
                  setExpanded={setExpanded}
                />
                {selRow ? (
                  <Detail
                    p={selRow.r.p}
                    focus={focus}
                    o={opts}
                    x={popX}
                    y={popY}
                    onClose={() => setSel(null)}
                    go={go}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <MapView o={opts} focus={focus} openEntity={openEntity} />
          )}

          <div className="pill">
            <div className="pill-box">
              <div className="seg" role="group" aria-label="View">
                {(
                  [
                    ["entity", "Entity"],
                    ["map", "Map"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    data-testid={"mx-view-" + v}
                    onClick={() => {
                      setView(v);
                      setSel(null);
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <label htmlFor="mx-profile-select" className="mx-sr">
                Profile
              </label>
              <select
                id="mx-profile-select"
                data-testid="mx-profile-select"
                value={profile}
                onChange={(e) => applyProfile(e.target.value as ProfileId)}
              >
                {(Object.keys(PROFILES) as ProfileId[]).map((k) => (
                  <option key={k} value={k}>
                    {PROFILES[k].label}
                  </option>
                ))}
              </select>
              <div className="seg" role="group" aria-label="Lens">
                {LENSES.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={opts.lens === l.id}
                    title={l.desc}
                    data-testid={"mx-lens-" + l.id}
                    onClick={() => set({ lens: l.id })}
                  >
                    <b className="lk">{l.letter}</b>
                    {l.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn primary"
                onClick={() => setDrawer(true)}
                aria-expanded={drawer}
                data-testid="mx-customize"
              >
                Customize
              </button>
              {modified ? (
                <span className="modified" data-testid="mx-modified">
                  <span className="dot" />
                  Modified{" "}
                  <button
                    type="button"
                    className="linkbtn"
                    onClick={() => applyProfile(profile)}
                  >
                    Reset
                  </button>
                </span>
              ) : null}
            </div>
          </div>

          {opts.lens === "combined" ? (
            <div className="legend" aria-label="Legend">
              <span>
                <i className="on" />
                in this layer
              </span>
              <span>
                <i className="off" />
                absent
              </span>
              <span>
                <i className="warn" />
                layers disagree
              </span>
              <span>C concept · S shape / contract · R realization</span>
            </div>
          ) : null}

          {drawer ? (
            <div className="scrim" onClick={() => setDrawer(false)} />
          ) : null}
          <Drawer
            open={drawer}
            onClose={() => setDrawer(false)}
            profile={profile}
            applyProfile={applyProfile}
            o={opts}
            d={d}
            counts={m.counts}
            traceCounts={m.traceCounts}
            relCounts={relCounts}
            set={set}
            setSec={setSec}
            setRel={setRel}
          />
        </div>
        {view === "map" ? (
          <p className="hints">
            Scroll or use the buttons to zoom; the detail level changes with
            zoom (Modules, Classes, Properties, Full detail). Drag to pan. Click
            a class to select it, Shift-click to add more, double-click to open
            it in the entity view. Pinning a class shows it one level more
            detailed than its neighbors.
          </p>
        ) : (
          <p className="hints">
            Click a row to see where each value comes from. Click a related
            class to re-center on it. Hover a section title to hide that
            section. Customize opens every option; the lens buttons cover the
            most common change.
          </p>
        )}
      </div>
      <CapabilityBubble
        accent="#2650c4"
        items={[
          {
            mechanism: "layoutStructural",
            anchor: "lay-out-a-structural-uml-style-view",
            how: "places the map's modules from the module relation graph, once per document.",
          },
          {
            mechanism: "resolveLod",
            how: "turns zoom into the map's four detail levels from a declarative LodSchedule.",
          },
          {
            mechanism: "useSelectionStore",
            how: "holds the map's multi-class selection, so any other view can read it.",
          },
          {
            mechanism: "useThemeStore",
            anchor: "theme-from-your-apps-settings",
            how: "switches the explorer between its light and dark palettes.",
          },
          {
            mechanism: "model-trace document (demo-local)",
            how: "one versioned JSON document carries concept, contract and realization per property.",
          },
        ]}
      />
    </div>
  );
}
