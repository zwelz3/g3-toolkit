import { describe, it, expect } from "vitest";
import { bioGraph, EX } from "./rdf";
import { executeSparql } from "./sparql";
import { defaultQueries } from "./queries";
import { resultToChartData, ontologySummary } from "./derive";

describe("resultToChartData", () => {
  it("turns a numeric SELECT into id/label/value data in row order", () => {
    const q = defaultQueries.find((x) => x.id === "q.protein-mw");
    if (!q) throw new Error("query missing");
    const data = resultToChartData(executeSparql(bioGraph, q.sparql), q.chart);
    expect(data.length).toBe(4);
    expect(data[0]).toEqual({
      id: EX + "BRCA1p",
      label: "BRCA1p",
      value: 207.7,
    });
    expect(data.every((d) => typeof d.value === "number")).toBe(true);
  });

  it("drops rows with no numeric value or missing chart hint", () => {
    const q = defaultQueries.find((x) => x.id === "q.gene-disease");
    if (!q) throw new Error("query missing");
    // gene-disease has no chart hint -> empty
    expect(
      resultToChartData(executeSparql(bioGraph, q.sparql), q.chart).length,
    ).toBe(0);
  });
});

describe("ontologySummary", () => {
  const summary = ontologySummary(bioGraph);

  it("lists domain classes with subclass links and instance counts", () => {
    const gene = summary.classes.find((c) => c.iri === EX + "Gene");
    expect(gene?.instances).toBe(4);
    expect(gene?.subClassOf).toBe(EX + "BiologicalEntity");
    const protein = summary.classes.find((c) => c.iri === EX + "Protein");
    expect(protein?.instances).toBe(4);
  });

  it("infers object properties with domain and range from usage", () => {
    const encodes = summary.objectProperties.find((p) => p.label === "encodes");
    expect(encodes?.domain).toEqual(["Gene"]);
    expect(encodes?.range).toEqual(["Protein"]);
    expect(summary.objectProperties.some((p) => p.label === "targets")).toBe(
      true,
    );
  });

  it("infers data properties, excluding rdfs:label", () => {
    const mw = summary.dataProperties.find(
      (p) => p.label === "molecularWeight",
    );
    expect(mw?.domain).toEqual(["Protein"]);
    expect(summary.dataProperties.some((p) => p.label === "label")).toBe(false);
  });
});
