/**
 * A compact ontology explorer over the biomedical TBox: a class tree with
 * instance counts (clicking a class selects its instances in the graph), and
 * tabs listing the object and data properties with the domain and range
 * inferred from usage. Driven by the pure ontologySummary.
 */
import { useState } from "react";
import type { OntologySummary } from "./derive";

interface OntologyExplorerProps {
  summary: OntologySummary;
  classColor: (classLocalName: string) => string;
  onSelectClass: (classIri: string) => void;
}

type Tab = "classes" | "object" | "data";

export function OntologyExplorer({
  summary,
  classColor,
  onSelectClass,
}: OntologyExplorerProps) {
  const [tab, setTab] = useState<Tab>("classes");

  const roots = summary.classes.filter((c) => !c.subClassOf);
  const childrenOf = (iri: string) =>
    summary.classes.filter((c) => c.subClassOf === iri);

  return (
    <div>
      <div className="bio-tabs" role="tablist">
        <button
          type="button"
          className={`bio-tab${tab === "classes" ? " is-active" : ""}`}
          onClick={() => setTab("classes")}
        >
          Classes
        </button>
        <button
          type="button"
          className={`bio-tab${tab === "object" ? " is-active" : ""}`}
          onClick={() => setTab("object")}
        >
          Object
        </button>
        <button
          type="button"
          className={`bio-tab${tab === "data" ? " is-active" : ""}`}
          onClick={() => setTab("data")}
        >
          Data
        </button>
      </div>

      {tab === "classes" ? (
        <div>
          {roots.map((root) => (
            <div key={root.iri}>
              <div className="bio-class-row" style={{ cursor: "default" }}>
                <span
                  className="bio-class-dot"
                  style={{ background: "#3a3352" }}
                />
                <span className="bio-class-name">{root.label}</span>
              </div>
              {childrenOf(root.iri).map((c) => (
                <button
                  key={c.iri}
                  type="button"
                  className="bio-class-row is-sub"
                  onClick={() => onSelectClass(c.iri)}
                  title={`Select ${c.instances} ${c.label} instance(s)`}
                >
                  <span
                    className="bio-class-dot"
                    style={{ background: classColor(c.label) }}
                  />
                  <span className="bio-class-name">{c.label}</span>
                  <span className="bio-class-count">{c.instances}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {tab === "object" ? (
        <div className="bio-section">
          {summary.objectProperties.map((p) => (
            <div className="bio-prop-row" key={p.iri}>
              <span className="bio-prop-name">{p.label}</span>
              <div className="bio-prop-sig">
                {p.domain.join(", ") || "?"} {"\u2192"}{" "}
                {p.range.join(", ") || "?"}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "data" ? (
        <div className="bio-section">
          {summary.dataProperties.map((p) => (
            <div className="bio-prop-row" key={p.iri}>
              <span className="bio-prop-name">{p.label}</span>
              <div className="bio-prop-sig">{p.domain.join(", ") || "?"}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
