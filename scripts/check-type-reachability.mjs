#!/usr/bin/env node
/**
 * Release gate: every type NAMED in a public prop interface must be
 * nameable from the package entry.
 *
 * Motivated by R-15 (register, 2026-08-06): SvgViewTransform was
 * declared, used as the type of a documented prop, and not
 * re-exported, so a consumer wiring the documented recipe could not
 * name the value it was holding. The consumer's own diagnosis was
 * that the existing export gate checks VALUE exports more
 * thoroughly than type exports, and they were right: verify:package
 * checks that entry points resolve, and verify:types checks that
 * the entry resolves under both module modes, but neither asks
 * whether a type a consumer must write down is reachable.
 *
 * Method: for each `*Props` interface exported from the built entry
 * declarations, collect the identifiers used in its property type
 * positions, keep those DECLARED somewhere in this package's own
 * declarations, and require each to be exported from the entry.
 * Types from node_modules and TypeScript built-ins are ignored,
 * since a consumer names those from their own dependencies.
 *
 * Every declared type entry is walked, not just the root one, and each
 * is judged against its OWN namespace. An adopter importing
 * `@g3t/react/timeline` sees that entry's exports; a prop type of
 * theirs that is only nameable from the root barrel is the same hole
 * this gate exists to catch.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");

const BUILTINS = new Set([
  "Array",
  "ReadonlyArray",
  "Readonly",
  "Record",
  "Map",
  "ReadonlyMap",
  "Set",
  "ReadonlySet",
  "Partial",
  "Required",
  "Pick",
  "Omit",
  "Promise",
  "Date",
  "Error",
  "RegExp",
  "Function",
  "Object",
  "String",
  "Number",
  "Boolean",
  "NonNullable",
  "Exclude",
  "Extract",
  "Parameters",
  "ReturnType",
  "Iterable",
  "Element",
  "HTMLElement",
  "SVGSVGElement",
  "ReactNode",
  "ReactElement",
  "CSSProperties",
  "Ref",
  "RefObject",
  "Core",
  "NodeSingular",
  "EdgeSingular",
]);

function declaredNames(text) {
  const out = new Set();
  const re =
    /(?:^|\n)\s*(?:export\s+)?(?:declare\s+)?(interface|type|class|enum)\s+([A-Z]\w*)/g;
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[2]);
  return out;
}

function exportedNames(text) {
  const out = new Set();
  for (const m of text.matchAll(
    /export\s+(?:declare\s+)?(?:interface|type|class|enum|const|function)\s+([A-Za-z_]\w*)/g,
  )) {
    out.add(m[1]);
  }
  for (const m of text.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) out.add(name.replace(/^type\s+/, ""));
    }
  }
  return out;
}

const failures = [];
let checked = 0;

for (const dir of readdirSync(packagesDir)) {
  const pkgDir = join(packagesDir, dir);
  const manifestPath = join(pkgDir, "package.json");
  if (!existsSync(manifestPath)) continue;
  const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (pkg.private === true || !pkg.types) continue;

  // Every declared type entry, not just the root one. A symbol that
  // ships only on a subpath (`@g3t/react/timeline`) is still public
  // surface, and walking only pkg.types silently drops it from this
  // gate the moment a component moves off the root barrel.
  const entryPaths = [
    join(pkgDir, pkg.types),
    ...Object.values(pkg.exports ?? {})
      .filter((t) => t && typeof t === "object" && typeof t.types === "string")
      .map((t) => join(pkgDir, t.types)),
  ].filter((p) => existsSync(p));
  if (entryPaths.length === 0) continue;

  // Every declaration file the package ships, for "is it ours?".
  const distDir = join(pkgDir, "dist");
  const declFiles = readdirSync(distDir, { recursive: true })
    .filter((f) => typeof f === "string" && f.endsWith(".d.ts"))
    .map((f) => join(distDir, f));

  const allText = declFiles.map((f) => readFileSync(f, "utf8")).join("\n");
  const ours = declaredNames(allText);
  // Reachable names: what the entry exports directly, PLUS
  // everything reachable through `export * from` chains. Star
  // re-exports make a name nameable without ever writing it down,
  // so a gate that ignores them reports false positives.
  //
  // Computed PER ENTRY, not once for the union. An adopter who imports
  // `@g3t/react/timeline` gets that entry's namespace; a prop type of
  // theirs that is only nameable from the root barrel is still a hole.
  const checkedInPkg = new Set();
  for (const entryPath of entryPaths) {
    const exported = new Set();
    const seen = new Set();
    const visit = (filePath) => {
      if (seen.has(filePath) || !existsSync(filePath)) return;
      seen.add(filePath);
      const text = readFileSync(filePath, "utf8");
      for (const n of exportedNames(text)) exported.add(n);
      for (const m of text.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g)) {
        const spec = m[1];
        if (!spec.startsWith(".")) continue;
        const base = join(dirname(filePath), spec);
        for (const cand of [
          base.endsWith(".d.ts") ? base : `${base}.d.ts`,
          join(base, "index.d.ts"),
          base.replace(/\.js$/, ".d.ts"),
        ]) {
          if (existsSync(cand)) {
            visit(cand);
            break;
          }
        }
      }
      // Named re-exports point at modules too; their targets may
      // themselves star-export the type we are looking for.
      for (const m of text.matchAll(
        /export\s*(?:type\s*)?\{[^}]*\}\s*from\s*["']([^"']+)["']/g,
      )) {
        const spec = m[1];
        if (!spec.startsWith(".")) continue;
        const base = join(dirname(filePath), spec);
        for (const cand of [
          base.endsWith(".d.ts") ? base : `${base}.d.ts`,
          join(base, "index.d.ts"),
        ]) {
          if (existsSync(cand)) {
            visit(cand);
            break;
          }
        }
      }
    };
    visit(entryPath);

    // Prop interfaces and the identifiers their members reference.
    for (const m of allText.matchAll(
      /interface\s+(\w*Props)\s*(?:extends[^{]*)?\{([\s\S]*?)\n\}/g,
    )) {
      const [, propsName, body] = m;
      if (!exported.has(propsName)) continue; // not public surface
      checkedInPkg.add(propsName);
      for (const idm of body.matchAll(/\b([A-Z]\w*)\b/g)) {
        const name = idm[1];
        if (BUILTINS.has(name) || !ours.has(name) || exported.has(name))
          continue;
        failures.push(
          `${pkg.name}: ${propsName} references ${name}, which is declared in this package but NOT exported from ${relative(pkgDir, entryPath)}`,
        );
      }
    }
  }
  checked += checkedInPkg.size;
}

const unique = [...new Set(failures)];
if (unique.length > 0) {
  console.error("Type reachability check FAILED:");
  for (const f of unique) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `Type reachability: ${checked} public prop interface(s) checked, every referenced type is nameable.`,
);
