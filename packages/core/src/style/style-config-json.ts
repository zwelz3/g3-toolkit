/**
 * Style-config JSON (G3L:STY-007): rule sets, tokens, class/state
 * bundles, and LOD schedules serialize to and from a VERSIONED JSON
 * envelope with a published schema, so notation presets (UML, BPMN,
 * SysML) ship as data.
 *
 * Scope, stated honestly: the SERIALIZABLE subset is declarative
 * (literal selectors, literal attributes). Function attributes and
 * predicate selectors are code and do not round-trip; `serialize`
 * rejects them with a coded error rather than silently dropping them.
 *
 * Validation is hand-rolled and structural (no schema-library
 * dependency: the core bundle budget is a gate). The published
 * `STYLE_CONFIG_SCHEMA` is a JSON-Schema-shaped document for external
 * tooling; the validator here is the executable authority and the
 * tests hold the two together on the fixtures.
 */

import type { StyleRule } from "./style-engine";
import type { DesignTokens } from "./tokens";
import type { LodSchedule } from "./lod";
import type { VisualAttributes } from "./visual-attributes";

export interface StyleConfigDocument {
  version: 1;
  tokens?: DesignTokens;
  rules?: readonly SerializableStyleRule[];
  classDefs?: Readonly<Record<string, Partial<VisualAttributes>>>;
  stateDefs?: Readonly<Record<string, Partial<VisualAttributes>>>;
  lod?: LodSchedule;
}

/** The declarative rule subset (no functions, no predicates). */
export interface SerializableStyleRule {
  id: string;
  selector?: {
    kind?: "node" | "edge";
    dataHas?: readonly string[];
    dataEquals?: Readonly<Record<string, string | number | boolean>>;
    classAny?: readonly string[];
  };
  attributes: Readonly<Partial<VisualAttributes>>;
}

export interface StyleConfigError {
  code:
    | "CFG_NOT_OBJECT"
    | "CFG_BAD_VERSION"
    | "CFG_RULE_NOT_SERIALIZABLE"
    | "CFG_RULE_SHAPE"
    | "CFG_LOD_SHAPE";
  message: string;
  /** JSON-pointer-ish location of the offense. */
  path: string;
}

export interface StyleConfigParseResult {
  ok: boolean;
  document?: StyleConfigDocument;
  errors: readonly StyleConfigError[];
}

/**
 * Serialize engine-shaped config to the envelope. Rules carrying
 * functions (attributes or selector predicates) are rejected: a
 * preset that needs code is not a preset (G3L:STY-007's boundary).
 */
export function serializeStyleConfig(input: {
  tokens?: DesignTokens;
  rules?: readonly StyleRule[];
  classDefs?: Readonly<Record<string, Partial<VisualAttributes>>>;
  stateDefs?: Readonly<Record<string, Partial<VisualAttributes>>>;
  lod?: LodSchedule;
}): { json: string | null; errors: readonly StyleConfigError[] } {
  const errors: StyleConfigError[] = [];
  const rules: SerializableStyleRule[] = [];
  for (const [i, rule] of (input.rules ?? []).entries()) {
    if (typeof rule.attributes === "function") {
      errors.push({
        code: "CFG_RULE_NOT_SERIALIZABLE",
        message: `rule "${rule.id}" has function attributes`,
        path: `/rules/${i}/attributes`,
      });
      continue;
    }
    if (rule.selector?.predicate) {
      errors.push({
        code: "CFG_RULE_NOT_SERIALIZABLE",
        message: `rule "${rule.id}" has a predicate selector`,
        path: `/rules/${i}/selector/predicate`,
      });
      continue;
    }
    rules.push({
      id: rule.id,
      ...(rule.selector
        ? {
            selector: {
              ...(rule.selector.kind ? { kind: rule.selector.kind } : {}),
              ...(rule.selector.dataHas
                ? { dataHas: rule.selector.dataHas }
                : {}),
              ...(rule.selector.dataEquals
                ? {
                    dataEquals: rule.selector.dataEquals as Record<
                      string,
                      string | number | boolean
                    >,
                  }
                : {}),
              ...(rule.selector.classAny
                ? { classAny: rule.selector.classAny }
                : {}),
            },
          }
        : {}),
      attributes: rule.attributes,
    });
  }
  if (errors.length > 0) return { json: null, errors };
  const doc: StyleConfigDocument = {
    version: 1,
    ...(input.tokens ? { tokens: input.tokens } : {}),
    ...(rules.length > 0 ? { rules } : {}),
    ...(input.classDefs ? { classDefs: input.classDefs } : {}),
    ...(input.stateDefs ? { stateDefs: input.stateDefs } : {}),
    ...(input.lod ? { lod: input.lod } : {}),
  };
  return { json: JSON.stringify(doc, null, 2), errors: [] };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Parse + validate the envelope. Round-trip guarantee is pinned in
 *  tests: parse(serialize(x)) deep-equals x's serializable subset. */
export function parseStyleConfig(json: string): StyleConfigParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return {
      ok: false,
      errors: [
        {
          code: "CFG_NOT_OBJECT",
          message: `not JSON: ${e instanceof Error ? e.message : String(e)}`,
          path: "/",
        },
      ],
    };
  }
  const errors: StyleConfigError[] = [];
  if (!isRecord(raw)) {
    return {
      ok: false,
      errors: [
        { code: "CFG_NOT_OBJECT", message: "root is not an object", path: "/" },
      ],
    };
  }
  if (raw["version"] !== 1) {
    errors.push({
      code: "CFG_BAD_VERSION",
      message: `unsupported version ${String(raw["version"])}`,
      path: "/version",
    });
  }
  const rules = raw["rules"];
  if (rules !== undefined) {
    if (!Array.isArray(rules)) {
      errors.push({
        code: "CFG_RULE_SHAPE",
        message: "rules is not an array",
        path: "/rules",
      });
    } else {
      for (const [i, r] of rules.entries()) {
        if (!isRecord(r) || typeof r["id"] !== "string") {
          errors.push({
            code: "CFG_RULE_SHAPE",
            message: "rule needs a string id",
            path: `/rules/${i}`,
          });
          continue;
        }
        if (!isRecord(r["attributes"])) {
          errors.push({
            code: "CFG_RULE_SHAPE",
            message: `rule "${String(r["id"])}" needs literal attributes`,
            path: `/rules/${i}/attributes`,
          });
        }
        const sel = r["selector"];
        if (sel !== undefined && !isRecord(sel)) {
          errors.push({
            code: "CFG_RULE_SHAPE",
            message: "selector is not an object",
            path: `/rules/${i}/selector`,
          });
        }
      }
    }
  }
  const lod = raw["lod"];
  if (lod !== undefined) {
    const tiers = isRecord(lod) ? lod["tiers"] : undefined;
    if (!Array.isArray(tiers)) {
      errors.push({
        code: "CFG_LOD_SHAPE",
        message: "lod.tiers is not an array",
        path: "/lod/tiers",
      });
    } else {
      for (const [i, t] of tiers.entries()) {
        if (
          !isRecord(t) ||
          typeof t["tier"] !== "number" ||
          !isRecord(t["when"]) ||
          !Array.isArray(t["hide"])
        ) {
          errors.push({
            code: "CFG_LOD_SHAPE",
            message: "tier needs { tier: number, when: object, hide: array }",
            path: `/lod/tiers/${i}`,
          });
        }
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, document: raw as unknown as StyleConfigDocument, errors };
}

/**
 * The published schema (G3L:STY-007), JSON-Schema-shaped for external
 * tooling. The executable authority is `parseStyleConfig`; tests hold
 * the two together on shared fixtures.
 */
export const STYLE_CONFIG_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://g3-toolkit.dev/schemas/style-config-v1.json",
  title: "G3L style config document",
  type: "object",
  required: ["version"],
  properties: {
    version: { const: 1 },
    tokens: { type: "object" },
    rules: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "attributes"],
        properties: {
          id: { type: "string" },
          selector: {
            type: "object",
            properties: {
              kind: { enum: ["node", "edge"] },
              dataHas: { type: "array", items: { type: "string" } },
              dataEquals: { type: "object" },
              classAny: { type: "array", items: { type: "string" } },
            },
            additionalProperties: false,
          },
          attributes: { type: "object" },
        },
        additionalProperties: false,
      },
    },
    classDefs: { type: "object" },
    stateDefs: { type: "object" },
    lod: {
      type: "object",
      required: ["tiers"],
      properties: {
        tiers: {
          type: "array",
          items: {
            type: "object",
            required: ["tier", "when", "hide"],
            properties: {
              tier: { type: "number" },
              when: {
                type: "object",
                properties: {
                  maxZoom: { type: "number" },
                  minVisibleElements: { type: "number" },
                },
                additionalProperties: false,
              },
              hide: { type: "array", items: { type: "string" } },
            },
            additionalProperties: false,
          },
        },
      },
    },
  },
  additionalProperties: false,
} as const;
