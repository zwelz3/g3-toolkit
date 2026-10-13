/**
 * AriaCompanion: accessibility layer for graph views (M8.E1.T1-T3).
 *
 * Provides:
 * - Hidden focusable node list with structured aria-labels (T1)
 * - Keyboard navigation: Tab to nodes, arrow keys traverse edges (T2)
 * - aria-live region for context change announcements (T3)
 *
 * The live region is shared between the companion's own navigation
 * announcements and the host's: a shell passes `announcement` (what a
 * screen-reader user needs that only the shell knows, such as the
 * current lineage step or a filter change) and the latest message wins.
 * `announceDebounceMs` coalesces rapid changes (a slider drag, arrowing
 * through a chain) into one utterance; `muted` holds the region still
 * while the shell plays an animation and commits the latest message when
 * it stops. All of this landed from the first shell integration (issue
 * #16, the Provenance Auditor): before it, `useAnnounce` set state that
 * no region rendered, so host announcements were silently dropped.
 *
 * @see specs/07-ux-defaults-accessibility.md R7.9, R7.10
 */

import {
  useRef,
  useCallback,
  useState,
  useMemo,
  useEffect,
  useId,
} from "react";
import type { UGM } from "@g3-toolkit/core";
import { useSelectionStore } from "../state/selection-store";
import { viewClass } from "../theme/view-class";

export interface AriaCompanionProps {
  ugm: UGM;
  className?: string;
  /**
   * Host-driven message for the live region. Every change is announced
   * (identical consecutive values are not: a live region only speaks on
   * a DOM change, which is also what keeps an unchanged re-render
   * silent). Shares the region with the companion's own navigation
   * announcements; the most recent of the two wins.
   */
  announcement?: string;
  /**
   * Milliseconds to wait after the last message change before the live
   * region updates, so rapid changes (a slider drag, fast arrowing)
   * collapse to the final one. 0 (default) updates on the same render.
   */
  announceDebounceMs?: number;
  /**
   * While true the live region is not updated; the latest pending
   * message commits once this flips back to false. Use it to keep a
   * playing animation (a time sweep, a chain walk) from narrating every
   * frame.
   */
  muted?: boolean;
  /** Accessible name of the node list. Default: "Graph nodes". */
  label?: string;
  /**
   * One-line usage instructions (how to reach and drive the list),
   * rendered visually hidden and wired as the list's accessible
   * description.
   */
  instructions?: string;
  /**
   * Formatter for a node's summary: each option's label and the text of
   * the companion's "Navigated to" announcement. The default follows
   * R7.10 (label, types, connection count, breakdown by neighbor type);
   * a host with directed or typed edges supplies the wording its users
   * need, such as incoming/outgoing provenance counts.
   */
  summarizeNode?: (ugm: UGM, nodeId: string) => string;
  /**
   * Node ids hidden on the canvas (the same set a host passes to
   * CytoscapeCanvas `hidden`). Hidden nodes leave the list and arrow
   * navigation skips them, so the accessible view and the visible one
   * agree.
   */
  hidden?: ReadonlySet<string>;
}

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/** Build a structured summary for a node (R7.10 wording). */
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

export function AriaCompanion({
  ugm,
  className,
  announcement,
  announceDebounceMs = 0,
  muted = false,
  label = "Graph nodes",
  instructions,
  summarizeNode = buildNodeSummary,
  hidden,
}: AriaCompanionProps) {
  const { selectNodes } = useSelectionStore();
  const listRef = useRef<HTMLUListElement>(null);
  const instructionsId = useId();

  // Latest message from either source (host prop or own navigation).
  // The prop is folded in with the adjust-state-on-render pattern rather
  // than an effect, so a host message and a navigation message that
  // land in the same render resolve in a defined order (the render's
  // prop wins) and nothing waits a frame.
  const [pending, setPending] = useState(announcement ?? "");
  const [seenAnnouncement, setSeenAnnouncement] = useState(announcement);
  if (announcement !== seenAnnouncement) {
    setSeenAnnouncement(announcement);
    if (announcement !== undefined) setPending(announcement);
  }

  // What the live region shows. Immediate mode commits during render
  // (same pattern); the debounced path commits from its timer, and a
  // muted region keeps whatever it last said.
  const [committed, setCommitted] = useState("");
  const immediate = !muted && announceDebounceMs <= 0;
  if (immediate && committed !== pending) setCommitted(pending);
  useEffect(() => {
    if (muted || announceDebounceMs <= 0) return;
    const t = setTimeout(() => setCommitted(pending), announceDebounceMs);
    return () => clearTimeout(t);
  }, [pending, muted, announceDebounceMs]);

  // Build sorted node list (degree-ordered, highest first per R7.9),
  // minus whatever the canvas hides.
  const nodeList = useMemo(() => {
    const nodes: Array<{ id: string; degree: number }> = [];
    ugm.forEachNode((id) => {
      if (hidden?.has(id)) return;
      nodes.push({ id, degree: ugm.getNeighbors(id).length });
    });
    return nodes.sort((a, b) => b.degree - a.degree);
  }, [ugm, hidden]);

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
        // Move to the first VISIBLE neighbor
        const next = ugm
          .getNeighbors(nodeId)
          .find((id) => !(hidden?.has(id) ?? false));
        if (next !== undefined) {
          selectNodes([next]);
          // Focus the corresponding li
          const li = listRef.current?.querySelector(
            `[data-node-id="${next}"]`,
          ) as HTMLElement | null;
          li?.focus();
          setPending(`Navigated to ${summarizeNode(ugm, next)}`);
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
    [ugm, nodeList, selectNodes, hidden, summarizeNode],
  );

  return (
    <div className={viewClass(className)} data-testid="aria-companion">
      {instructions !== undefined && (
        <p
          id={instructionsId}
          data-testid="aria-instructions"
          style={VISUALLY_HIDDEN}
        >
          {instructions}
        </p>
      )}
      {/* Visually hidden but focusable node list (R7.9, R7.10) */}
      <ul
        ref={listRef}
        role="listbox"
        aria-label={label}
        aria-describedby={
          instructions !== undefined ? instructionsId : undefined
        }
        data-testid="aria-node-list"
        style={VISUALLY_HIDDEN}
      >
        {nodeList.map((node) => {
          const summary = summarizeNode(ugm, node.id);
          return (
            <li
              key={node.id}
              role="option"
              tabIndex={0}
              data-testid={`aria-node-${node.id}`}
              data-node-id={node.id}
              aria-label={summary}
              onFocus={() => handleFocus(node.id)}
              onKeyDown={(e) => handleKeyDown(e, node.id)}
            >
              {summary}
            </li>
          );
        })}
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
        {committed}
      </div>
    </div>
  );
}

/**
 * Host-side announcer: the current message to pass as AriaCompanion's
 * `announcement`, and the setter to call from the event sites the host
 * owns (a trace step, a filter change). Debounce and muting live on the
 * component, so every host gets them with the same two props.
 */
export function useAnnouncer(): {
  announcement: string;
  announce: (message: string) => void;
} {
  const [announcement, announce] = useState("");
  return { announcement, announce };
}

/**
 * @deprecated Never reached a live region: it set component-local state
 * that nothing rendered, so every message was dropped (found by the
 * first shell integration, issue #16). Use {@link useAnnouncer} and pass
 * its `announcement` to {@link AriaCompanion}. Kept, unchanged, so a
 * call site that compiled before still compiles.
 */
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
