/**
 * Derive Vite/Rollup externals from a package.json.
 *
 * A library build should NOT bundle anything declared in `dependencies`,
 * `peerDependencies`, or `optionalDependencies`. The consumer is expected
 * to provide those at install time (peer/optional) or they're resolved
 * at runtime through node_modules (dependencies).
 *
 * Returns an array suitable for Rollup's `external` field, including both
 * exact package names AND subpath patterns (so `lodash/get` is external
 * if `lodash` is).
 */

import { readFileSync } from "fs";

export function externalsFromPackageJson(packageJsonPath) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const names = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);

  // Node built-ins are always external
  const nodeBuiltins = [
    "fs",
    "path",
    "url",
    "stream",
    "buffer",
    "util",
    "events",
  ];
  for (const b of nodeBuiltins) names.add(b);
  // React JSX runtime is its own subpath external
  if (names.has("react")) names.add("react/jsx-runtime");
  // Zustand middleware is a subpath
  if (names.has("zustand")) names.add("zustand/middleware");

  // Return a function: matches exact names AND any deep import of those names
  // (e.g. "lodash" matches "lodash" and "lodash/get").
  const exactNames = Array.from(names);
  return (id) => {
    if (exactNames.includes(id)) return true;
    return exactNames.some((n) => id === n || id.startsWith(n + "/"));
  };
}
