/**
 * F5: Inline property editor for nodes and edges.
 *
 * Renders property values as editable inputs. Changes are
 * written to the UGM in memory. An optional callback lets
 * the adopter persist or reject changes.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { UGM } from "@g3t/core";

export interface PropertyEditCallback {
  onPropertyChange(
    elementType: "node" | "edge",
    elementId: string,
    key: string,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<boolean>; // return false to reject
}

export interface PropertyEditorProps {
  ugm: UGM;
  elementType: "node" | "edge";
  elementId: string;
  onEdit?: PropertyEditCallback;
  className?: string;
}

export function PropertyEditor({
  ugm,
  elementType,
  elementId,
  onEdit,
  className,
}: PropertyEditorProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const properties =
    elementType === "node" ? (ugm.getNode(elementId)?.properties ?? {}) : {};

  useEffect(() => {
    if (editingKey && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingKey]);

  const startEdit = useCallback((key: string, value: unknown) => {
    setEditingKey(key);
    setEditValue(String(value ?? ""));
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingKey(null);
    setEditValue("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingKey) return;
    setSaving(true);

    const oldValue = properties[editingKey];
    let newValue: unknown = editValue;

    // Infer type from old value
    if (typeof oldValue === "number") {
      const parsed = parseFloat(editValue);
      newValue = isNaN(parsed) ? editValue : parsed;
    } else if (typeof oldValue === "boolean") {
      newValue = editValue === "true" || editValue === "1";
    }

    // Callback for adopter validation/persistence
    if (onEdit) {
      const accepted = await onEdit.onPropertyChange(
        elementType,
        elementId,
        editingKey,
        oldValue,
        newValue,
      );
      if (!accepted) {
        setSaving(false);
        cancelEdit();
        return;
      }
    }

    // Apply to UGM
    if (elementType === "node") {
      ugm.updateNodeProperties(elementId, { [editingKey]: newValue });
    }

    setSaving(false);
    cancelEdit();
  }, [
    editingKey,
    editValue,
    properties,
    onEdit,
    elementType,
    elementId,
    ugm,
    cancelEdit,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") saveEdit();
      if (e.key === "Escape") cancelEdit();
    },
    [saveEdit, cancelEdit],
  );

  const entries = Object.entries(properties).filter(
    ([k]) => !k.startsWith("_"),
  );

  return (
    <div
      className={className}
      data-testid="property-editor"
      style={{ fontSize: 12 }}
    >
      {entries.map(([key, value]) => (
        <div
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "3px 0",
            borderBottom: "1px solid var(--g3t-border)",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 80,
              flexShrink: 0,
              fontSize: 11,
              color: "var(--g3t-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {key}
          </span>

          {editingKey === key ? (
            <input
              ref={inputRef}
              data-testid={`edit-${key}`}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveEdit}
              disabled={saving}
              style={{
                flex: 1,
                fontSize: 12,
                fontFamily: "inherit",
                padding: "2px 4px",
                border: "1px solid var(--g3t-accent, #2563eb)",
                borderRadius: 3,
                outline: "none",
                background: "var(--g3t-bg-primary)",
                color: "var(--g3t-text-primary)",
              }}
            />
          ) : (
            <span
              onClick={() => startEdit(key, value)}
              style={{
                flex: 1,
                cursor: "pointer",
                padding: "2px 4px",
                borderRadius: 3,
              }}
              title="Click to edit"
            >
              {typeof value === "boolean"
                ? value
                  ? "true"
                  : "false"
                : String(value ?? "")}
            </span>
          )}
        </div>
      ))}
      {entries.length === 0 && (
        <div style={{ color: "var(--g3t-text-muted)", padding: 8 }}>
          No editable properties.
        </div>
      )}
    </div>
  );
}
