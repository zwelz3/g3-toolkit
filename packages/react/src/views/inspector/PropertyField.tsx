/**
 * PropertyField: renders one property as the widget its spec selects
 * (text, number, checkbox, toggle, select, textarea, or read-only),
 * honoring an editable flag. In preview (non-editable) mode, value
 * widgets render as plain values and the boolean widgets render their
 * control in a non-interactive state so the control type stays legible.
 *
 * The component is controlled: it renders `value` and emits coerced
 * changes via `onChange`; it never mutates the source itself.
 */

import { type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import "./PropertyField.css";
import { coerceWidgetValue, type PropertyWidgetKind } from "./property-spec";

export interface PropertyFieldProps {
  /** Property key (also used for the test id). */
  fieldKey: string;
  /** Display label. */
  label: string;
  /** Widget to render. */
  widget: PropertyWidgetKind;
  /** Current value. */
  value: unknown;
  /** Options for the `select` widget. */
  options?: readonly string[];
  /** When true the widget is interactive; otherwise it is preview-only. */
  editable: boolean;
  /** Theme accent, applied to interactive controls. */
  accent: string;
  /** Called with the coerced new value when an editable widget changes. */
  onChange?: (value: unknown) => void;
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.map(asText).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function PropertyField({
  fieldKey,
  label,
  widget,
  value,
  options,
  editable,
  accent,
  onChange,
}: PropertyFieldProps): ReactNode {
  const emit = (raw: string | boolean) =>
    onChange?.(coerceWidgetValue(widget, raw));

  let control: ReactNode;
  switch (widget) {
    case "checkbox":
      control = (
        <input
          type="checkbox"
          className="g3t-prop-checkbox"
          checked={Boolean(value)}
          disabled={!editable}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            emit(e.target.checked)
          }
          style={{ accentColor: accent }}
        />
      );
      break;
    case "toggle":
      control = (
        <span
          className="g3t-toggle"
          data-on={Boolean(value)}
          data-disabled={!editable}
          style={{ "--g3t-toggle-accent": accent } as CSSProperties}
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={!editable}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              emit(e.target.checked)
            }
          />
          <span className="g3t-toggle-track" aria-hidden="true">
            <span className="g3t-toggle-knob" />
          </span>
        </span>
      );
      break;
    case "number":
      control = editable ? (
        <input
          type="number"
          className="g3t-prop-input"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => emit(e.target.value)}
        />
      ) : (
        <span className="g3t-prop-value">{asText(value)}</span>
      );
      break;
    case "select":
      control = editable ? (
        <select
          className="g3t-prop-input"
          value={String(value ?? "")}
          onChange={(e) => emit(e.target.value)}
        >
          {(options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <span className="g3t-prop-value">{asText(value)}</span>
      );
      break;
    case "textarea":
      control = editable ? (
        <textarea
          className="g3t-prop-input g3t-prop-textarea"
          rows={2}
          value={String(value ?? "")}
          onChange={(e) => emit(e.target.value)}
        />
      ) : (
        <span className="g3t-prop-value">{asText(value)}</span>
      );
      break;
    case "readonly":
      control = <span className="g3t-prop-value">{asText(value)}</span>;
      break;
    case "text":
    default:
      control = editable ? (
        <input
          type="text"
          className="g3t-prop-input"
          value={String(value ?? "")}
          onChange={(e) => emit(e.target.value)}
        />
      ) : (
        <span className="g3t-prop-value">{asText(value)}</span>
      );
      break;
  }

  return (
    <div
      className="g3t-prop-field"
      data-testid={`inspector-prop-${fieldKey}`}
      data-widget={widget}
    >
      <span className="g3t-prop-label" title={label}>
        {label}
      </span>
      <span className="g3t-prop-control">{control}</span>
    </div>
  );
}
