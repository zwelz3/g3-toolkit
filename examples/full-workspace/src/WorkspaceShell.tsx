/**
 * WorkspaceShell: FlexLayout-based multi-view workspace (M6.E1.T1-T3).
 *
 * Hosts multiple view components in tabbed/split panes. Supports
 * save/load of workspace state and role-based defaults.
 *
 * @see specs/01-functional-views.md R1.12
 */

import { useState, useCallback } from "react";
import { Layout, Model, type IJsonModel, type TabNode } from "flexlayout-react";
import "flexlayout-react/style/light.css";

// ── View Registry ───────────────────────────────────────────────────

export type ViewFactory = (node: TabNode) => React.ReactNode;

// ── Workspace Save/Load (M6.E1.T2) ─────────────────────────────────

export interface WorkspaceState {
  name: string;
  layoutModel: IJsonModel;
  /** Hash of the ontology version at save time (D12). */
  schemaHash?: string;
  savedAt: string;
}

// @see R2.15: investigation bookmarks
export function saveWorkspace(
  name: string,
  model: Model,
  schemaHash?: string,
): WorkspaceState {
  return {
    name,
    layoutModel: model.toJson(),
    schemaHash,
    savedAt: new Date().toISOString(),
  };
}

export function loadWorkspace(state: WorkspaceState): Model {
  return Model.fromJson(state.layoutModel);
}

// ── Role-Based Defaults (M6.E1.T3) ─────────────────────────────────

export type RoleName = string;

const DEFAULT_LAYOUT: IJsonModel = {
  global: { tabEnableClose: true, tabEnableRename: true },
  borders: [],
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "tabset",
        weight: 60,
        children: [{ type: "tab", name: "Canvas", component: "canvas" }],
      },
      {
        type: "tabset",
        weight: 40,
        children: [
          { type: "tab", name: "Table", component: "table" },
          { type: "tab", name: "Inspector", component: "inspector" },
        ],
      },
    ],
  },
};

const ROLE_DEFAULTS: Record<string, IJsonModel> = {
  analyst: {
    ...DEFAULT_LAYOUT,
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "row",
          weight: 70,
          children: [
            {
              type: "tabset",
              weight: 60,
              children: [
                { type: "tab", name: "Canvas", component: "canvas" },
                { type: "tab", name: "Timeline", component: "timeline" },
              ],
            },
            {
              type: "tabset",
              weight: 40,
              children: [{ type: "tab", name: "Table", component: "table" }],
            },
          ],
        },
        {
          type: "tabset",
          weight: 30,
          children: [
            { type: "tab", name: "Inspector", component: "inspector" },
            { type: "tab", name: "Stats", component: "stats" },
          ],
        },
      ],
    },
  },
  engineer: {
    ...DEFAULT_LAYOUT,
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          weight: 50,
          children: [
            { type: "tab", name: "Schema", component: "schema" },
            { type: "tab", name: "Canvas", component: "canvas" },
          ],
        },
        {
          type: "tabset",
          weight: 50,
          children: [
            { type: "tab", name: "Tree", component: "tree" },
            { type: "tab", name: "Inspector", component: "inspector" },
          ],
        },
      ],
    },
  },
};

export function getDefaultLayoutForRole(role: RoleName): IJsonModel {
  return ROLE_DEFAULTS[role] ?? DEFAULT_LAYOUT;
}

// ── Component ───────────────────────────────────────────────────────

export interface WorkspaceShellProps {
  /** Initial layout model (overrides role-based default). */
  initialModel?: IJsonModel;
  /** Role for loading default workspace layout. */
  role?: RoleName;
  /** Factory function that maps component names to React elements. */
  viewFactory: ViewFactory;
  className?: string;
}

export function WorkspaceShell({
  initialModel,
  role,
  viewFactory,
  className,
}: WorkspaceShellProps) {
  const layout = initialModel ?? getDefaultLayoutForRole(role ?? "default");
  const [model] = useState(() => Model.fromJson(layout));

  const factory = useCallback(
    (node: TabNode): React.ReactNode => {
      return viewFactory(node);
    },
    [viewFactory],
  );

  return (
    <div
      data-testid="workspace-shell"
      className={className}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <Layout model={model} factory={factory} />
    </div>
  );
}

// ── Utility ─────────────────────────────────────────────────────────

/** Get the current model from a WorkspaceShell for save operations. */
export function getModelFromRef(
  ref: React.RefObject<{ getModel: () => Model } | null>,
): Model | null {
  return ref.current?.getModel() ?? null;
}
