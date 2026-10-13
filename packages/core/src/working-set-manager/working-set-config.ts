/**
 * WorkingSetConfig: the versioned deployment document for working-set
 * limits (issue #5).
 *
 * A deployment's hardware, not the toolkit, decides how many nodes a
 * view can carry, so the limits are configuration. This document is
 * what a platform administrator writes once per deployment and a host
 * resolves at setup into `WorkingSetManager.fromConfig`. It is one of
 * the versioned JSON documents of the integration channel and is
 * validated like the others: it is a single hand-authored object with
 * no partial reading worth having, so it follows the throwing
 * convention (model/document-errors.ts, case 3) rather than returning
 * diagnostics.
 *
 * Two numbers per view (specs/09 D5): a soft `default` the analyst
 * may raise with an explicit acknowledgment, and a hard `ceiling` the
 * analyst cannot exceed. Both are optional per view and every view is
 * optional; what is absent falls through to the built-in default and
 * to "no ceiling". A `default` above its own `ceiling` is rejected at
 * validation rather than silently clamped, because a document that
 * contradicts itself is a mistake the administrator should see.
 *
 * Framework-agnostic (D6).
 */

import {
  MalformedDocumentError,
  parseJsonObject,
  requireVersion,
} from "../model/document-errors";

import type { ViewType } from "./working-set-manager";

/** Per-view entry: a soft default and/or a hard ceiling. */
export interface WorkingSetViewLimit {
  /** Soft limit a user may raise (with acknowledgment) up to the ceiling. */
  default?: number;
  /** Hard limit no user override may exceed. Absent means unbounded. */
  ceiling?: number;
}

/** Deployment configuration document for working-set limits (version 1). */
export interface WorkingSetConfig {
  version: 1;
  limits?: Partial<Record<ViewType, WorkingSetViewLimit>>;
}

const VIEW_TYPES: readonly ViewType[] = [
  "canvas",
  "table",
  "tree",
  "matrix",
  "sankey",
  "streaming",
];

const KIND = "working-set-config" as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkCount(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new MalformedDocumentError({
      documentKind: KIND,
      message: `${path} must be a positive integer, got ${JSON.stringify(value)}`,
      path,
    });
  }
  return value;
}

/**
 * Validate an already-parsed object as a working-set configuration.
 *
 * Throws a {@link MalformedDocumentError} (or an
 * `UnsupportedVersionError` for a version this build does not read).
 * Unknown view names are rejected rather than ignored: a deployment
 * document is typed by hand, and `"canvass": { ceiling: 300 }`
 * silently configuring nothing is the failure mode that matters.
 */
export function validateWorkingSetConfig(raw: unknown): WorkingSetConfig {
  if (!isPlainObject(raw)) {
    throw new MalformedDocumentError({
      documentKind: KIND,
      code: "NOT_OBJECT",
      message: `root is ${Array.isArray(raw) ? "an array" : String(raw)}, expected an object`,
    });
  }
  requireVersion(KIND, raw);

  const limitsRaw = raw["limits"];
  if (limitsRaw === undefined) return { version: 1 };
  if (!isPlainObject(limitsRaw)) {
    throw new MalformedDocumentError({
      documentKind: KIND,
      message: "limits must be an object keyed by view type",
      path: "/limits",
    });
  }

  const limits: Partial<Record<ViewType, WorkingSetViewLimit>> = {};
  for (const [view, entry] of Object.entries(limitsRaw)) {
    const path = `/limits/${view}`;
    if (!(VIEW_TYPES as readonly string[]).includes(view)) {
      throw new MalformedDocumentError({
        documentKind: KIND,
        message: `unknown view type "${view}"; expected one of ${VIEW_TYPES.join(", ")}`,
        path,
      });
    }
    if (!isPlainObject(entry)) {
      throw new MalformedDocumentError({
        documentKind: KIND,
        message: `${path} must be an object with optional default and ceiling`,
        path,
      });
    }
    const def = checkCount(entry["default"], `${path}/default`);
    const ceiling = checkCount(entry["ceiling"], `${path}/ceiling`);
    if (def !== undefined && ceiling !== undefined && def > ceiling) {
      throw new MalformedDocumentError({
        documentKind: KIND,
        message: `${path}/default (${def}) exceeds ${path}/ceiling (${ceiling})`,
        path: `${path}/default`,
      });
    }
    const out: WorkingSetViewLimit = {};
    if (def !== undefined) out.default = def;
    if (ceiling !== undefined) out.ceiling = ceiling;
    limits[view as ViewType] = out;
  }
  return { version: 1, limits };
}

/**
 * Parse working-set configuration text. Throws a typed
 * `DocumentParseError` subclass on invalid JSON, an unsupported
 * version, or a malformed body.
 */
export function parseWorkingSetConfig(text: string): WorkingSetConfig {
  return validateWorkingSetConfig(parseJsonObject(KIND, text));
}
