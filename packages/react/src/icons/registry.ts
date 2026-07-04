/**
 * IconRegistry (B1, design-system roadmap).
 *
 * The adopter customization contract for iconography: components ask
 * the registry for a semantic name; deployments override any subset
 * with their brand's glyphs (markup string or a React component)
 * without forking the components that use them.
 *
 * Deliberately not a peer dependency on an icon library: shipping
 * lucide (or any set) would impose an aesthetic and a package on
 * every adopter. The default set costs a few KB and stays swappable.
 */

import type { ComponentType, SVGProps } from "react";
import { DEFAULT_ICON_PATHS } from "./default-icons";

export type IconRenderer =
  | { kind: "paths"; markup: string }
  | { kind: "component"; Component: ComponentType<SVGProps<SVGSVGElement>> };

const registry = new Map<string, IconRenderer>();
for (const [name, markup] of Object.entries(DEFAULT_ICON_PATHS)) {
  registry.set(name, { kind: "paths", markup });
}

/** Resolve an icon by semantic name. Undefined when unregistered. */
export function getIcon(name: string): IconRenderer | undefined {
  return registry.get(name);
}

/**
 * Register or override an icon. Pass a 24x24-viewBox path markup
 * string, or a React SVG component for full control. Returns an
 * unregister function restoring the previous renderer (or removal),
 * so scoped overrides (tests, themed sub-trees) can clean up.
 */
export function registerIcon(
  name: string,
  renderer: IconRenderer | string,
): () => void {
  const previous = registry.get(name);
  registry.set(
    name,
    typeof renderer === "string"
      ? { kind: "paths", markup: renderer }
      : renderer,
  );
  return () => {
    if (previous) registry.set(name, previous);
    else registry.delete(name);
  };
}

/** Registered icon names (defaults plus overrides). */
export function listIcons(): string[] {
  return [...registry.keys()].sort();
}
