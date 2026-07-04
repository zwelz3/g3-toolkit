/**
 * Icon sets: bulk registration with sanitize-by-default and optional
 * pre-mappings (review request, 2026-06-11).
 *
 * Safety model: Icon renders markup via dangerouslySetInnerHTML, which
 * is fine for the first-party default set and for sets an ADOPTER
 * compiles in (trust: "trusted"). Sets loaded from END USERS at
 * runtime (pasted, uploaded, fetched) are an XSS surface: SVG carries
 * script elements, event-handler attributes, and foreignObject. The
 * default trust level ("sanitize") accepts only a geometry allowlist
 * and reports every rejection by name, so a hostile glyph is skipped
 * loudly instead of registered quietly.
 */

import { registerIcon } from "./registry";

// ── Sanitizer ────────────────────────────────────────────────────────

const ALLOWED_ELEMENTS = new Set([
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "ellipse",
  "g",
]);

const ALLOWED_ATTRS = new Set([
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "points",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "transform",
  "opacity",
]);

export interface IconSanitizeIssue {
  icon: string;
  reason: string;
}

/**
 * Validate one glyph's markup against the geometry allowlist. Returns
 * the serialized clean markup, or null with reasons when ANY part is
 * disallowed: rejection over silent stripping, so a hostile glyph
 * cannot launder itself into a partial render.
 */
export function sanitizeIconMarkup(
  name: string,
  markup: string,
): { clean: string | null; issues: IconSanitizeIssue[] } {
  const issues: IconSanitizeIssue[] = [];
  if (typeof DOMParser === "undefined") {
    return {
      clean: null,
      issues: [{ icon: name, reason: "no DOM available to sanitize" }],
    };
  }
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
    "image/svg+xml",
  );
  if (doc.querySelector("parsererror")) {
    return {
      clean: null,
      issues: [{ icon: name, reason: "markup is not well-formed SVG" }],
    };
  }
  const root = doc.documentElement;
  const walk = (el: Element): void => {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_ELEMENTS.has(tag)) {
      issues.push({ icon: name, reason: `element <${tag}> not allowed` });
      return;
    }
    for (const attr of [...el.attributes]) {
      const a = attr.name.toLowerCase();
      if (a.startsWith("on")) {
        issues.push({ icon: name, reason: `event handler "${attr.name}"` });
      } else if (!ALLOWED_ATTRS.has(a)) {
        issues.push({
          icon: name,
          reason: `attribute "${attr.name}" not allowed`,
        });
      } else if (/url\s*\(|javascript:/i.test(attr.value)) {
        issues.push({
          icon: name,
          reason: `attribute "${attr.name}" carries a url()/javascript: value`,
        });
      }
    }
    for (const child of [...el.children]) walk(child);
  };
  for (const child of [...root.children]) walk(child);
  if (issues.length > 0) return { clean: null, issues };
  return { clean: root.innerHTML, issues: [] };
}

// ── Icon sets ────────────────────────────────────────────────────────

export interface IconSetDefinition {
  /** Semantic icon name -> 24x24-viewBox markup (sans <svg>). */
  icons: Record<string, string>;
  /**
   * Optional pre-mappings: driver values -> icon names, ready to drop
   * into an encoding spec's icon channel (e.g. { driver: "types",
   * values: { Person: "agent" } }).
   */
  mappings?: {
    driver: string;
    values: Record<string, string>;
  };
}

export interface IconSetResult {
  /** Names actually registered. */
  registered: string[];
  /** Glyphs rejected by the sanitizer, with reasons. */
  rejected: IconSanitizeIssue[];
  /** Restores every replaced/added registration. */
  unregister: () => void;
  /** The set's pre-mappings, filtered to registered icons only. */
  mappings?: IconSetDefinition["mappings"];
}

/**
 * Register a whole icon set. trust:
 *  - "sanitize" (default): each glyph passes the geometry allowlist or
 *    is rejected with reasons; for end-user-loaded sets.
 *  - "trusted": registered verbatim; for adopter-compiled sets only.
 */
export function registerIconSet(
  set: IconSetDefinition,
  options: { trust?: "sanitize" | "trusted" } = {},
): IconSetResult {
  const trust = options.trust ?? "sanitize";
  const registered: string[] = [];
  const rejected: IconSanitizeIssue[] = [];
  const restores: Array<() => void> = [];

  for (const [name, markup] of Object.entries(set.icons)) {
    if (trust === "trusted") {
      restores.push(registerIcon(name, markup));
      registered.push(name);
      continue;
    }
    const { clean, issues } = sanitizeIconMarkup(name, markup);
    if (clean === null) {
      rejected.push(...issues);
    } else {
      restores.push(registerIcon(name, clean));
      registered.push(name);
    }
  }

  const mappings = set.mappings
    ? {
        driver: set.mappings.driver,
        values: Object.fromEntries(
          Object.entries(set.mappings.values).filter(([, icon]) =>
            registered.includes(icon),
          ),
        ),
      }
    : undefined;

  return {
    registered,
    rejected,
    mappings,
    unregister: () => {
      for (const restore of restores.reverse()) restore();
    },
  };
}
