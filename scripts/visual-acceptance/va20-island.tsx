/**
 * VA-20 client island (VA20_ISLAND_MOUNTED marker for the page
 * self-check). Mounts the SAME Va20Live component the generator
 * SSR'd, replacing the static fallback with the live one: tier-2
 * edits drive the preview and the spec JSON in real time through the
 * shipped resolvers.
 */
import type React from "react";
import { createRoot } from "react-dom/client";
import { Va27Structural, Va31Routing } from "./va20-shared";
import { ThemeSwitcher } from "../../packages/react/src/theme/ThemeSwitcher";

function mount(id: string, node: React.ReactElement): void {
  const host = document.getElementById(id);
  if (!host) return;
  host.innerHTML = "";
  createRoot(host).render(node);
  host.dataset["live"] = "true";
}
mount("va27-root", <Va27Structural live />);
mount("va31-root", <Va31Routing live />);
mount(
  "va-theme-root",
  <ThemeSwitcher
    onSelect={(id) => {
      document.documentElement.dataset["theme"] = id;
    }}
  />,
);
console.info("VA20_ISLAND_MOUNTED");
