/**
 * QueryEditor: SPARQL/Cypher/GQL query input (M7.E0.T2, R1.13).
 *
 * Text area with language selector and execute button. Sends the
 * query to a GraphAdapter and returns the result UGM.
 *
 * @see specs/01-functional-views.md R1.13
 */

import { useState, useCallback } from "react";
import type { UGM } from "@g3t/core";
import type { GraphAdapter } from "@g3t/core";

export type QueryLanguage = "sparql" | "cypher" | "gql";

export interface QueryEditorProps {
  /** The adapter to execute queries against. */
  adapter?: GraphAdapter;
  /** Callback when a query produces results. */
  onResult?: (ugm: UGM) => void;
  /** Callback when a query fails. */
  onError?: (error: Error) => void;
  /** Default query language. */
  defaultLanguage?: QueryLanguage;
  className?: string;
}

export function QueryEditor({
  adapter,
  onResult,
  onError,
  defaultLanguage = "sparql",
  className,
}: QueryEditorProps) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<QueryLanguage>(defaultLanguage);
  const [running, setRunning] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleExecute = useCallback(async () => {
    if (!adapter || !query.trim()) return;

    setRunning(true);
    setLastError(null);

    try {
      const result = await adapter.query(query);
      onResult?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setLastError(error.message);
      onError?.(error);
    } finally {
      setRunning(false);
    }
  }, [adapter, query, onResult, onError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to execute
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleExecute();
      }
    },
    [handleExecute],
  );

  return (
    <div
      data-testid="query-editor"
      className={className}
      style={{ display: "flex", flexDirection: "column", gap: 4, padding: 8 }}
    >
      {/* Language selector */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          data-testid="query-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as QueryLanguage)}
          style={{ fontSize: 12, padding: "2px 4px" }}
        >
          <option value="sparql">SPARQL</option>
          <option value="cypher">Cypher</option>
          <option value="gql">GQL</option>
        </select>
        <button
          data-testid="query-execute"
          onClick={handleExecute}
          disabled={running || !adapter || !query.trim()}
          style={{
            padding: "4px 12px",
            fontSize: 12,
            background: running ? "#ccc" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: running ? "wait" : "pointer",
          }}
        >
          {running ? "Running..." : "Execute (Ctrl+Enter)"}
        </button>
      </div>

      {/* Query input */}
      <textarea
        data-testid="query-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          language === "sparql"
            ? "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 100"
            : language === "cypher"
              ? "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100"
              : "MATCH (n) RETURN n LIMIT 100"
        }
        style={{
          width: "100%",
          minHeight: 120,
          fontFamily: "monospace",
          fontSize: 13,
          padding: 8,
          border: "1px solid #ccc",
          borderRadius: 4,
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />

      {/* Error display */}
      {lastError && (
        <div
          data-testid="query-error"
          style={{
            padding: "4px 8px",
            fontSize: 12,
            color: "#dc2626",
            background: "#fef2f2",
            borderRadius: 4,
          }}
        >
          {lastError}
        </div>
      )}

      {/* Status bar */}
      {!adapter && (
        <div style={{ fontSize: 11, color: "#888" }}>
          No adapter connected. Provide a GraphAdapter to execute queries.
        </div>
      )}
    </div>
  );
}
