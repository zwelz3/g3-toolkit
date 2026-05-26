/**
 * F4: Annotation framework.
 *
 * Attach text notes to nodes or edges. Default store uses
 * localStorage; adopters provide a custom AnnotationStore
 * for server-side persistence.
 */

import { useState, useEffect, useCallback } from "react";

// ── Store Interface (D6-compatible) ─────────────────────────────

export interface Annotation {
  elementId: string;
  text: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationStore {
  get(elementId: string): Promise<Annotation | null>;
  set(elementId: string, annotation: Annotation): Promise<void>;
  delete(elementId: string): Promise<void>;
  list(): Promise<Annotation[]>;
}

/**
 * Default localStorage-backed annotation store.
 */
export function createLocalAnnotationStore(
  prefix = "g3t-annotations",
): AnnotationStore {
  return {
    async get(elementId: string) {
      const raw = localStorage.getItem(`${prefix}:${elementId}`);
      return raw ? JSON.parse(raw) : null;
    },
    async set(elementId: string, annotation: Annotation) {
      localStorage.setItem(
        `${prefix}:${elementId}`,
        JSON.stringify(annotation),
      );
    },
    async delete(elementId: string) {
      localStorage.removeItem(`${prefix}:${elementId}`);
    },
    async list() {
      const results: Annotation[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`${prefix}:`)) {
          const raw = localStorage.getItem(key);
          if (raw) results.push(JSON.parse(raw));
        }
      }
      return results;
    },
  };
}

// ── React Component (D13) ───────────────────────────────────────

export interface AnnotationPanelProps {
  elementId: string | null;
  store?: AnnotationStore;
  className?: string;
}

const defaultStore = createLocalAnnotationStore();

export function AnnotationPanel({
  elementId,
  store = defaultStore,
  className,
}: AnnotationPanelProps) {
  const [annotation, setAnnotation] = useState<Annotation | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!elementId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnnotation(null);
      setDraft("");
      return;
    }
    store.get(elementId).then((a) => {
      setAnnotation(a);
      setDraft(a?.text ?? "");
      setEditing(false);
    });
  }, [elementId, store]);

  const handleSave = useCallback(async () => {
    if (!elementId || !draft.trim()) return;
    const now = new Date().toISOString();
    const updated: Annotation = {
      elementId,
      text: draft.trim(),
      createdAt: annotation?.createdAt ?? now,
      updatedAt: now,
    };
    await store.set(elementId, updated);
    setAnnotation(updated);
    setEditing(false);
  }, [elementId, draft, annotation, store]);

  const handleDelete = useCallback(async () => {
    if (!elementId) return;
    await store.delete(elementId);
    setAnnotation(null);
    setDraft("");
    setEditing(false);
  }, [elementId, store]);

  if (!elementId) {
    return (
      <div
        className={className}
        style={{ fontSize: 11, color: "var(--g3t-text-muted)", padding: 8 }}
      >
        Select a node or edge to add annotations.
      </div>
    );
  }

  return (
    <div
      className={className}
      data-testid="annotation-panel"
      style={{ fontSize: 12, padding: 8 }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Notes</span>
        {annotation && !editing && (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="g3t-btn g3t-btn-ghost"
              onClick={() => setEditing(true)}
              style={{ fontSize: 10, padding: "1px 6px" }}
            >
              Edit
            </button>
            <button
              className="g3t-btn g3t-btn-ghost"
              onClick={handleDelete}
              style={{ fontSize: 10, padding: "1px 6px", color: "#ef4444" }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {annotation && !editing ? (
        <div
          style={{
            padding: "6px 8px",
            background: "var(--g3t-bg-secondary)",
            borderRadius: 4,
            whiteSpace: "pre-wrap",
            lineHeight: 1.5,
          }}
        >
          {annotation.text}
          <div
            style={{
              fontSize: 9,
              color: "var(--g3t-text-muted)",
              marginTop: 4,
            }}
          >
            Updated {new Date(annotation.updatedAt).toLocaleDateString()}
          </div>
        </div>
      ) : (
        <div>
          <textarea
            data-testid="annotation-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note..."
            style={{
              width: "100%",
              minHeight: 60,
              fontSize: 12,
              fontFamily: "inherit",
              padding: 6,
              border: "1px solid var(--g3t-border)",
              borderRadius: 4,
              resize: "vertical",
              background: "var(--g3t-bg-primary)",
              color: "var(--g3t-text-primary)",
            }}
          />
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <button
              className="g3t-btn g3t-btn-active"
              onClick={handleSave}
              style={{ fontSize: 11, padding: "3px 10px" }}
            >
              Save
            </button>
            {editing && (
              <button
                className="g3t-btn g3t-btn-ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(annotation?.text ?? "");
                }}
                style={{ fontSize: 11, padding: "3px 10px" }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
