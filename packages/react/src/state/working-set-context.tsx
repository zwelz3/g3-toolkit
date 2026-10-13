/**
 * WorkingSetProvider / useWorkingSetManager (issue #5).
 *
 * `WorkingSetManager` was exported from both packages while nothing
 * in production instantiated it: TreeView took one as a prop and
 * every other view carried its own literal, so a deployment override
 * reached nothing. This context is the single injection point. A view
 * resolves its limit through `useWorkingSetManager(prop)`: an
 * explicit prop wins (the TreeView contract is kept), then the
 * nearest provider, then a module default instance so a host that
 * mounts no provider keeps today's behavior exactly.
 *
 * The module default is the one place a module-level instance is
 * tolerated here. It carries the same identity hazard the stores do
 * (a host that duplicates the package duplicates the instance), but
 * the alternative, a required provider, would break every existing
 * host for the benefit of the ones that configure limits, who mount
 * the provider anyway.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { WorkingSetManager } from "@g3-toolkit/core";
import type { ViewType, WorkingSetConfig } from "@g3-toolkit/core";

const WorkingSetContext = createContext<WorkingSetManager | null>(null);

let defaultManager: WorkingSetManager | null = null;

/**
 * The fallback manager views use when no provider is mounted and no
 * prop is passed. Built-in defaults, no ceilings. Lazy so a host that
 * always mounts a provider never allocates it.
 */
export function getDefaultWorkingSetManager(): WorkingSetManager {
  defaultManager ??= new WorkingSetManager();
  return defaultManager;
}

export interface WorkingSetProviderProps {
  /** A manager the host built (for example `WorkingSetManager.fromConfig`). */
  manager?: WorkingSetManager;
  /**
   * Or the deployment document itself; the provider builds the
   * manager. `manager` wins when both are given. The document is
   * validated, so a malformed one throws at mount.
   */
  config?: WorkingSetConfig;
  children?: ReactNode;
}

/**
 * Carry one `WorkingSetManager` to every view beneath it. Build the
 * manager (or the config object) once at the host's setup, outside
 * render, so its identity is stable; a fresh document literal on each
 * render would rebuild the manager and drop any user override.
 */
export function WorkingSetProvider({
  manager,
  config,
  children,
}: WorkingSetProviderProps) {
  const resolved = useMemo(
    () =>
      manager ??
      (config !== undefined
        ? WorkingSetManager.fromConfig(config)
        : getDefaultWorkingSetManager()),
    [manager, config],
  );
  return (
    <WorkingSetContext.Provider value={resolved}>
      {children}
    </WorkingSetContext.Provider>
  );
}

/**
 * The manager a view should enforce with. Precedence: the explicit
 * prop, then the nearest `WorkingSetProvider`, then the module
 * default.
 */
export function useWorkingSetManager(
  explicit?: WorkingSetManager,
): WorkingSetManager {
  const fromContext = useContext(WorkingSetContext);
  return explicit ?? fromContext ?? getDefaultWorkingSetManager();
}

/** What a view should say when a request is over its limit. */
export interface WorkingSetLimitMessage {
  /**
   * `within`: no message needed. `prompt`: the limit is soft here and
   * the view may offer an explicit "Show all" action with the
   * performance warning. `refused`: the request is above the
   * administrator ceiling; offer no prompt, state the refusal.
   */
  kind: "within" | "prompt" | "refused";
  message: string;
  limit: number;
  requested: number;
  ceiling?: number;
}

const VIEW_NOUN: Record<ViewType, string> = {
  canvas: "nodes",
  table: "rows",
  tree: "nodes",
  matrix: "categories",
  sankey: "flows",
  streaming: "events",
};

/**
 * The smallest UI for the "explicit user action to exceed" rule: one
 * string a view can render verbatim. Routes through `canRaise`, so a
 * ceiling produces a refusal message instead of a prompt the manager
 * would refuse anyway. Pure; call it after `checkLimit` says no.
 */
export function workingSetLimitMessage(
  manager: WorkingSetManager,
  viewType: ViewType,
  requested: number,
): WorkingSetLimitMessage {
  const check = manager.checkLimit(viewType, requested);
  const noun = VIEW_NOUN[viewType];
  if (check.allowed) {
    return {
      kind: "within",
      message: "",
      limit: check.limit,
      requested,
    };
  }
  const raise = manager.canRaise(viewType, requested);
  if (raise.ok) {
    return {
      kind: "prompt",
      message:
        `${requested.toLocaleString()} ${noun} exceeds the ${viewType} limit of ` +
        `${check.limit.toLocaleString()} and may slow this view. Show all?`,
      limit: check.limit,
      requested,
      ceiling: raise.ceiling,
    };
  }
  return {
    kind: "refused",
    message:
      `${requested.toLocaleString()} ${noun} exceeds this deployment's ${viewType} ` +
      `ceiling of ${(raise.ceiling ?? check.limit).toLocaleString()}; ` +
      `showing the first ${check.limit.toLocaleString()}.`,
    limit: check.limit,
    requested,
    ceiling: raise.ceiling,
  };
}
