/**
 * NodeEditorModal: a modal that composes the two per-node panels as
 * tabs. "Properties" hosts NodePropertyInspector (spec-driven property
 * view/edit); "Style" hosts NodeStyleEditor (per-node visual override).
 * Both panels render their own card chrome, so the modal supplies only
 * the backdrop and the tab strip above the active panel; the active
 * panel's own close control closes the modal.
 *
 * The modal is open while `nodeId` is non-null and closed otherwise, so
 * a host can drive it directly from a selection (open on node select,
 * `onClose` clears the selection). The backdrop fills its nearest
 * positioned ancestor, so place it inside a `position: relative`
 * container (e.g. the canvas wrapper) to scope the overlay to that area.
 */

import { useEffect, useState, type ReactNode } from "react";
import type { UGM } from "@g3t/core";
import { NodeStyleEditor } from "../../interaction/encoding/NodeStyleEditor";
import { NodePropertyInspector } from "./NodePropertyInspector";
import type { PropertyInspectorSpec } from "./property-spec";
import "./NodeEditorModal.css";

export type NodeEditorTab = "properties" | "style";

export interface NodeEditorModalProps {
  /** UGM instance the panels read from. */
  ugm: UGM;
  /** Open for this node id; closed (renders nothing) when null. */
  nodeId: string | null;
  /** Close handler (e.g. clears the selection that opened the modal). */
  onClose: () => void;
  /** Property tab mode; defaults to "edit" since the modal is a workspace. */
  mode?: "preview" | "edit";
  /** Property spec passthrough for the Properties tab. */
  spec?: PropertyInspectorSpec;
  /** Property change passthrough (edit mode). */
  onPropertyChange?: (key: string, value: unknown) => void;
  /** Tab shown first when the modal opens; defaults to "properties". */
  defaultTab?: NodeEditorTab;
  /** CSS class for the backdrop. */
  className?: string;
}

export function NodeEditorModal({
  ugm,
  nodeId,
  onClose,
  mode = "edit",
  spec,
  onPropertyChange,
  defaultTab = "properties",
  className,
}: NodeEditorModalProps): ReactNode {
  const [tab, setTab] = useState<NodeEditorTab>(defaultTab);

  // Start each newly-opened node on the default tab. Adjusting state
  // during render (rather than in an effect) is the supported pattern for
  // resetting state when an input changes, and avoids a cascading render.
  const [openedNode, setOpenedNode] = useState<string | null>(nodeId);
  if (nodeId !== openedNode) {
    setOpenedNode(nodeId);
    setTab(defaultTab);
  }

  // Escape closes while open.
  useEffect(() => {
    if (!nodeId) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodeId, onClose]);

  if (!nodeId) return null;

  return (
    <div
      className={`g3t-node-editor-backdrop${className ? ` ${className}` : ""}`}
      data-testid="node-editor-modal"
      onClick={onClose}
    >
      <div
        className="g3t-node-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Node editor"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="g3t-node-editor-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            data-testid="tab-properties"
            className="g3t-node-editor-tab"
            data-active={tab === "properties"}
            aria-selected={tab === "properties"}
            onClick={() => setTab("properties")}
          >
            Properties
          </button>
          <button
            type="button"
            role="tab"
            data-testid="tab-style"
            className="g3t-node-editor-tab"
            data-active={tab === "style"}
            aria-selected={tab === "style"}
            onClick={() => setTab("style")}
          >
            Style
          </button>
        </div>
        <div className="g3t-node-editor-body">
          {tab === "properties" ? (
            <NodePropertyInspector
              ugm={ugm}
              selection={{ type: "node", id: nodeId }}
              mode={mode}
              spec={spec}
              onPropertyChange={onPropertyChange}
              onClose={onClose}
            />
          ) : (
            <NodeStyleEditor ugm={ugm} nodeId={nodeId} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
