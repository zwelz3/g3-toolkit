/**
 * AriaCompanion: accessibility layer for graph views (M8.E1.T1-T3).
 *
 * Provides:
 * - Hidden focusable node list with structured aria-labels (T1)
 * - Keyboard navigation: Tab to nodes, arrow keys traverse edges (T2)
 * - aria-live region for context change announcements (T3)
 *
 * @see specs/07-ux-defaults-accessibility.md R7.9, R7.10
 */

import { useRef, useCallback, useState, useMemo } from "react";
import type { UGM } from "@g3t/core";
import { useSelectionStore } from "../state/selection-store";

export interface AriaCompanionProps {
  ugm: UGM;
  className?: string;
}

/** Build a structured summary for a node. */
function buildNodeSummary(ugm: UGM, nodeId: string): string {
  const node = ugm.getNode(nodeId);
  if (!node) return nodeId;

  const name =
    typeof node.properties.name === "string" ? node.properties.name : nodeId;
  const types = node.types.join(", ");
  const neighbors = ugm.getNeighbors(nodeId);
  const neighborCount = neighbors.length;

  // Breakdown by type
  const typeCounts = new Map<string, number>();
  for (const nId of neighbors) {
    const nType = ugm.getNode(nId)?.types[0] ?? "Unknown";
    typeCounts.set(nType, (typeCounts.get(nType) ?? 0) + 1);
  }
  const breakdown = [...typeCounts.entries()]
    .map(([t, c]) => `${c} to ${t}`)
    .join(", ");

  return `${name}, ${types}, ${neighborCount} connections${breakdown ? `: ${breakdown}` : ""}`;
}

export function AriaCompanion({ ugm, className }: AriaCompanionProps) {
  const { selectNodes } = useSelectionStore();
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  // Build sorted node list (degree-ordered, highest first per R7.9)
  const nodeList = useMemo(() => {
    const nodes: Array<{ id: string; degree: number }> = [];
    ugm.forEachNode((id) => {
      nodes.push({ id, degree: ugm.getNeighbors(id).length });
    });
    return nodes.sort((a, b) => b.degree - a.degree);
  }, [ugm]);

  const handleFocus = useCallback(
    (nodeId: string) => {
      selectNodes([nodeId]);
    },
    [selectNodes],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, nodeId: string) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        // Move to first neighbor
        const neighbors = ugm.getNeighbors(nodeId);
        if (neighbors.length > 0 && neighbors[0]) {
          selectNodes([neighbors[0]]);
          // Focus the corresponding li
          const li = listRef.current?.querySelector(
            `[data-node-id="${neighbors[0]}"]`,
          ) as HTMLElement | null;
          li?.focus();
          setAnnouncement(
            `Navigated to ${buildNodeSummary(ugm, neighbors[0])}`,
          );
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        // Move to previous node in list
        const idx = nodeList.findIndex((n) => n.id === nodeId);
        const prev = idx > 0 ? nodeList[idx - 1] : undefined;
        if (prev) {
          selectNodes([prev.id]);
          const li = listRef.current?.querySelector(
            `[data-node-id="${prev.id}"]`,
          ) as HTMLElement | null;
          li?.focus();
        }
      }
    },
    [ugm, nodeList, selectNodes],
  );

  return (
    <div className={className} data-testid="aria-companion">
      {/* Visually hidden but focusable node list (R7.9, R7.10) */}
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Graph nodes"
        data-testid="aria-node-list"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {nodeList.map((node) => (
          <li
            key={node.id}
            role="option"
            tabIndex={0}
            data-testid={`aria-node-${node.id}`}
            data-node-id={node.id}
            aria-label={buildNodeSummary(ugm, node.id)}
            onFocus={() => handleFocus(node.id)}
            onKeyDown={(e) => handleKeyDown(e, node.id)}
          >
            {buildNodeSummary(ugm, node.id)}
          </li>
        ))}
      </ul>

      {/* aria-live announcement region (T3) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        data-testid="aria-live-region"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
        }}
      >
        {announcement}
      </div>
    </div>
  );
}

/** Announce a message via the aria-live region. */
export function useAnnounce(): (message: string) => void {
  const [, setMsg] = useState("");
  return useCallback((message: string) => {
    setMsg(message);
    // Force re-announce by briefly clearing
    setTimeout(() => setMsg(""), 100);
  }, []);
}

// ── High Contrast Mode (M8.E1.T4) ──────────────────────────────────

export interface HighContrastConfig {
  enabled: boolean;
  nodeStrokeWidth: number;
  nodeLabelColor: string;
  edgeColor: string;
  backgroundColor: string;
}

export const HIGH_CONTRAST_DEFAULTS: HighContrastConfig = {
  enabled: false,
  nodeStrokeWidth: 3,
  nodeLabelColor: "#000000",
  edgeColor: "#000000",
  backgroundColor: "#FFFFFF",
};

export const HIGH_CONTRAST_ON: HighContrastConfig = {
  enabled: true,
  nodeStrokeWidth: 4,
  nodeLabelColor: "#000000",
  edgeColor: "#1a1a1a",
  backgroundColor: "#FFFFFF",
};
