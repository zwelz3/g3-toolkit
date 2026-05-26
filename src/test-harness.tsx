/**
 * TestHarness: combined view layout for e2e and acceptance testing.
 *
 * Renders all M0-M4 components in a predictable layout:
 * - Left sidebar: filter, search, tag/group actions
 * - Center top: canvas with layout switcher
 * - Center bottom: table
 * - Right sidebar: inspector
 *
 * Activated by appending ?test-harness to the URL.
 * Deterministic data: 20 nodes, 30 edges, 3 types.
 */

import { useState, useCallback } from "react";
import { UGM } from "@g3t/core";
import { CytoscapeCanvas } from "@g3t/react";
import { TableView } from "@g3t/react";
import { DetailInspector } from "@g3t/react";
import { FacetFilter } from "@g3t/react";
import { SearchBar } from "@g3t/react";
import { TagManager } from "@g3t/react";
import { GroupingManager } from "@g3t/react";
import { LayoutSwitcher } from "@g3t/react";
import { createDefaultMenuManager, type ContextMenuManager } from "@g3t/react";
import { useSelectionStore } from "@g3t/react";
import {
  ForceLayout,
  HierarchyLayout,
  DagreLayout,
  ElkLayout,
} from "@g3t/core";
import type { LayoutEngine } from "@g3t/core";

// ── Deterministic test data ─────────────────────────────────────────

function buildTestUGM(): UGM {
  const ugm = new UGM();
  const types = ["Person", "Organization", "Location"];

  for (let i = 0; i < 20; i++) {
    ugm.addNode(`n${i}`, {
      types: [types[i % 3] ?? "Unknown"],
      properties: { name: `Node ${i}`, score: +(i * 0.05).toFixed(2) },
    });
  }

  for (let i = 0; i < 30; i++) {
    const s = `n${i % 20}`;
    const t = `n${(i * 3 + 7) % 20}`;
    if (s !== t) {
      ugm.addEdge(s, t, {
        type: i % 2 === 0 ? "knows" : "relatedTo",
        confidence: +(0.5 + (i % 10) * 0.05).toFixed(2),
        asserted: i % 5 !== 0,
      });
    }
  }

  return ugm;
}

const engines: LayoutEngine[] = [
  new ForceLayout(),
  new HierarchyLayout(),
  new DagreLayout(),
  new ElkLayout(),
];

// ── Component ───────────────────────────────────────────────────────

export function TestHarness() {
  const [ugm] = useState(buildTestUGM);
  const selection = useSelectionStore();
  const selectedId = [...selection.selectedNodeIds][0] ?? null;
  const [activeLayout, setActiveLayout] = useState("force");
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [searchInfo, setSearchInfo] = useState("");
  const [tagManager] = useState(() => new TagManager(ugm));
  const [groupingManager] = useState(() => new GroupingManager(ugm));

  const [menuManager] = useState<ContextMenuManager>(() =>
    createDefaultMenuManager({
      onInspect: (t) => {
        if (t.id) selection.selectNodes([t.id]);
      },
    }),
  );

  const handleLayoutSwitch = useCallback(
    async (engineId: string) => {
      setActiveLayout(engineId);
      const engine = engines.find((e) => e.id === engineId);
      if (engine) {
        await engine.compute(ugm);
      }
    },
    [ugm],
  );

  return (
    <div
      data-testid="test-harness"
      style={{ display: "flex", height: "100vh", fontFamily: "system-ui" }}
    >
      {/* Left sidebar */}
      <div
        data-testid="sidebar-left"
        style={{
          width: 220,
          borderRight: "1px solid #ccc",
          padding: 8,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <SearchBar
          ugm={ugm}
          onSearchChange={(r) =>
            setSearchInfo(r.query ? `${r.matchingIds.length} matches` : "")
          }
        />
        {searchInfo && (
          <div
            data-testid="search-info"
            style={{ fontSize: 12, color: "#666" }}
          >
            {searchInfo}
          </div>
        )}
        <FacetFilter ugm={ugm} onFilterChange={setHiddenTypes} />
        <div data-testid="hidden-types" style={{ fontSize: 12, color: "#888" }}>
          Hidden: {[...hiddenTypes].join(", ") || "none"}
        </div>
        <hr />
        <button
          data-testid="btn-tag"
          onClick={() => {
            const ids = [...selection.selectedNodeIds];
            if (ids.length > 0) tagManager.addTag(ids, "TestTag");
          }}
        >
          Tag Selected
        </button>
        <button
          data-testid="btn-group"
          onClick={() => {
            const ids = [...selection.selectedNodeIds];
            if (ids.length > 1) groupingManager.createGroup(ids, "TestGroup");
          }}
        >
          Group Selected
        </button>
        <div
          data-testid="selection-info"
          style={{ fontSize: 12, color: "#666" }}
        >
          Selected: {selection.selectedNodeIds.size} nodes
        </div>
      </div>

      {/* Center */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <LayoutSwitcher
          engines={engines}
          activeId={activeLayout}
          onSwitch={handleLayoutSwitch}
        />
        <div data-testid="canvas-container" style={{ flex: 1 }}>
          <CytoscapeCanvas ugm={ugm} menuManager={menuManager} />
        </div>
        <div
          data-testid="table-container"
          style={{ height: 220, borderTop: "1px solid #ccc", overflow: "auto" }}
        >
          <TableView ugm={ugm} menuManager={menuManager} pageSize={10} />
        </div>
      </div>

      {/* Right sidebar */}
      <div
        data-testid="sidebar-right"
        style={{ width: 280, borderLeft: "1px solid #ccc", overflow: "auto" }}
      >
        <DetailInspector
          ugm={ugm}
          selection={selectedId ? { type: "node", id: selectedId } : null}
        />
      </div>
    </div>
  );
}
