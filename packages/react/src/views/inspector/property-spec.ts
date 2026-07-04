/**
 * Property inspector spec: a declarative description of how a node's or
 * edge's properties are rendered and edited. The inspector renders from
 * this spec rather than hard-coding widget choices, so the widget per
 * property (a boolean as a checkbox vs a toggle, a string as text vs a
 * constrained select, ...) is configuration, not bespoke JSX.
 *
 * When no field is given for a property key, a widget is inferred from
 * the runtime value type. A spec is therefore optional: with none, the
 * inspector still renders every property with a sensible default widget.
 */

export type PropertyWidgetKind =
  | "text"
  | "textarea"
  | "number"
  | "checkbox" // boolean rendered as a checkbox
  | "toggle" // boolean rendered as a switch
  | "select" // string constrained to `options`
  | "readonly"; // value shown, never editable

export interface PropertyFieldSpec {
  /** Property key this field binds to. */
  key: string;
  /** Display label; defaults to the key. */
  label?: string;
  /** Widget used to render and (in edit mode) edit the value. */
  widget: PropertyWidgetKind;
  /** Allowed values for the `select` widget. */
  options?: readonly string[];
  /** Force read-only even when the inspector is in edit mode. */
  readOnly?: boolean;
}

export interface PropertyInspectorSpec {
  /** Field specs, rendered in this order ahead of any inferred fields. */
  fields: readonly PropertyFieldSpec[];
  /**
   * Render keys not covered by `fields` using an inferred widget.
   * Default true; set false to show only spec'd fields.
   */
  includeUnspecified?: boolean;
}

/** Infer a widget from a runtime value when no spec field applies. */
export function inferWidget(value: unknown): PropertyWidgetKind {
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "text";
  return "readonly"; // arrays, objects, null, undefined
}

export interface ResolvedField {
  key: string;
  label: string;
  widget: PropertyWidgetKind;
  options?: readonly string[];
  readOnly: boolean;
}

/**
 * Resolve the ordered fields to render for a property bag against an
 * optional spec. Spec'd fields (whose key is present in `properties`)
 * come first in spec order; remaining present keys follow with an
 * inferred widget unless `includeUnspecified` is false.
 */
export function resolveFields(
  properties: Record<string, unknown>,
  spec?: PropertyInspectorSpec,
): ResolvedField[] {
  const out: ResolvedField[] = [];
  const seen = new Set<string>();

  if (spec) {
    for (const f of spec.fields) {
      if (!(f.key in properties)) continue;
      seen.add(f.key);
      out.push({
        key: f.key,
        label: f.label ?? f.key,
        widget: f.widget,
        options: f.options,
        readOnly: f.readOnly ?? false,
      });
    }
  }

  const includeRest = spec?.includeUnspecified ?? true;
  if (includeRest) {
    for (const key of Object.keys(properties)) {
      if (seen.has(key)) continue;
      out.push({
        key,
        label: key,
        widget: inferWidget(properties[key]),
        readOnly: false,
      });
    }
  }

  return out;
}

/** Coerce a widget's raw input value back to the property's type. */
export function coerceWidgetValue(
  widget: PropertyWidgetKind,
  raw: string | boolean,
): unknown {
  switch (widget) {
    case "checkbox":
    case "toggle":
      return Boolean(raw);
    case "number": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    default:
      return String(raw);
  }
}
