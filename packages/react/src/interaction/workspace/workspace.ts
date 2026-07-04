/**
 * Workspace durability, slice 1 (Tier-1 item 3 of the roadmap
 * reassessment; rounds 12-18 made the encoding spec, position pins,
 * and theme into real state worth keeping).
 *
 * A WorkspaceSnapshot is one versioned JSON document: the encoding
 * spec, node positions, the pin state, and the theme id. capture and
 * apply are the whole API; WHERE the snapshot persists (the composite
 * dashboard's saved workspaces, the proposed investigation bookmarks,
 * a file, a URL) is the host's choice, which is why this module does
 * no storage of its own.
 *
 * Apply-order matters and is encoded here once: positions before
 * pins (locked nodes reject position writes, so we unlock, place,
 * and let the pin effect re-lock), spec and theme through their own
 * owners (setters and stores), never by poking the canvas directly.
 */

import type { Core } from "cytoscape";
import { usePositionPinStore } from "../../state/position-pin-store";
import { useThemeStore } from "../../theme/ThemeManager";
import {
  parseEncodingSpec,
  serializeEncodingSpec,
  type EncodingSpec,
} from "../encoding/encoding-spec";

export interface WorkspaceSnapshot {
  version: 1;
  encodingSpec?: EncodingSpec;
  positions: Record<string, { x: number; y: number }>;
  pinnedIds: string[];
  allPinned: boolean;
  themeId?: string;
}

export interface CaptureContext {
  cy: Core | null;
  spec?: EncodingSpec;
}

export function captureWorkspace(ctx: CaptureContext): WorkspaceSnapshot {
  const positions: Record<string, { x: number; y: number }> = {};
  ctx.cy?.nodes().forEach((n) => {
    const p = n.position();
    positions[n.id()] = { x: p.x, y: p.y };
  });
  const pins = usePositionPinStore.getState();
  return {
    version: 1,
    encodingSpec: ctx.spec,
    positions,
    pinnedIds: [...pins.pinnedIds],
    allPinned: pins.allPinned,
    themeId: useThemeStore.getState().theme.id,
  };
}

export interface ApplyContext {
  cy: Core | null;
  /** Receives the snapshot's spec (the host owns spec state). */
  setSpec?: (spec: EncodingSpec) => void;
}

export function applyWorkspace(
  snapshot: WorkspaceSnapshot,
  ctx: ApplyContext,
): void {
  if (snapshot.version !== 1) {
    throw new Error(
      `Unsupported workspace version ${String(snapshot.version)}; this build reads version 1`,
    );
  }
  const cy = ctx.cy;
  if (cy) {
    cy.batch(() => {
      for (const [id, pos] of Object.entries(snapshot.positions)) {
        const ele = cy.getElementById(id);
        if (ele.nonempty()) {
          // Locked nodes reject position writes: unlock to place; the
          // pin effect re-locks from the restored pin state below.
          ele.unlock();
          ele.position(pos);
        }
      }
    });
  }
  usePositionPinStore.setState({
    pinnedIds: [...snapshot.pinnedIds],
    allPinned: snapshot.allPinned,
  });
  if (snapshot.encodingSpec && ctx.setSpec) ctx.setSpec(snapshot.encodingSpec);
  if (snapshot.themeId) {
    const { setTheme } = useThemeStore.getState();
    setTheme(snapshot.themeId);
  }
}

/** Serialize with the spec passed through its own serializer (one
 *  formatting authority, mirroring SpecPort). */
export function serializeWorkspace(snapshot: WorkspaceSnapshot): string {
  return JSON.stringify(
    {
      ...snapshot,
      encodingSpec: snapshot.encodingSpec
        ? JSON.parse(serializeEncodingSpec(snapshot.encodingSpec))
        : undefined,
    },
    null,
    2,
  );
}

export function parseWorkspace(json: string): WorkspaceSnapshot {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (raw["version"] !== 1) {
    throw new Error(
      `Unsupported workspace version ${String(raw["version"])}; this build reads version 1`,
    );
  }
  const spec = raw["encodingSpec"]
    ? parseEncodingSpec(JSON.stringify(raw["encodingSpec"]))
    : undefined;
  return {
    version: 1,
    encodingSpec: spec,
    positions: (raw["positions"] ?? {}) as WorkspaceSnapshot["positions"],
    pinnedIds: (raw["pinnedIds"] ?? []) as string[],
    allPinned: Boolean(raw["allPinned"]),
    themeId: raw["themeId"] as string | undefined,
  };
}
