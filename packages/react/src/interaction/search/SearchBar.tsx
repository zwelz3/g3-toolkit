/**
 * SearchBar: fuzzy multi-field search across graph nodes (upgraded M1.E3.T5).
 *
 * Uses Fuse.js for typo-tolerant, weighted field search.
 * Searches across all string properties (name, label, type, etc.).
 * Reports matching IDs so the canvas can highlight/dim nodes.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Fuse from "fuse.js";
import type { FuseResult } from "fuse.js";
import type { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";

export interface SearchResult {
  matchingIds: string[];
  nonMatchingIds: string[];
  query: string;
}

export interface SearchBarProps {
  ugm: UGM;
  onSearchChange: (result: SearchResult) => void;
  placeholder?: string;
  className?: string;
  /** Auto-select first result on Enter. Default true. */
  selectOnEnter?: boolean;
}

interface SearchRecord {
  id: string;
  name: string;
  type: string;
  properties: string; // flattened property values for full-text
}

export function SearchBar({
  ugm,
  onSearchChange,
  placeholder = "Search nodes...",
  className,
  selectOnEnter = true,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FuseResult<SearchRecord>[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { selectNodes } = useSelectionStore();

  // Build Fuse.js index from UGM
  const fuse = useMemo(() => {
    const records: SearchRecord[] = [];
    ugm.forEachNode((id, attrs) => {
      const propValues = Object.values(attrs.properties)
        .filter((v) => typeof v === "string" || typeof v === "number")
        .map(String)
        .join(" ");
      records.push({
        id,
        name: String(attrs.properties.name ?? attrs.properties.label ?? id),
        type: attrs.types[0] ?? "",
        properties: propValues,
      });
    });
    return new Fuse(records, {
      keys: [
        { name: "name", weight: 3 },
        { name: "type", weight: 2 },
        { name: "id", weight: 1 },
        { name: "properties", weight: 1 },
      ],
      threshold: 0.35,
      includeMatches: true,
      minMatchCharLength: 2,
    });
  }, [ugm]);

  // Search on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      onSearchChange({ matchingIds: [], nonMatchingIds: [], query: "" });
      return;
    }

    const fuseResults = fuse.search(query, { limit: 20 });
    setResults(fuseResults);
    setSelectedIndex(-1);
    setShowDropdown(fuseResults.length > 0);

    const matchingIds = fuseResults.map((r) => r.item.id);
    const allIds: string[] = [];
    ugm.forEachNode((id) => allIds.push(id));
    const nonMatchingIds = allIds.filter((id) => !matchingIds.includes(id));
    onSearchChange({ matchingIds, nonMatchingIds, query });
  }, [query, fuse, ugm, onSearchChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && selectOnEnter) {
        e.preventDefault();
        const idx = selectedIndex >= 0 ? selectedIndex : 0;
        const item = results[idx]?.item;
        if (item) {
          selectNodes([item.id]);
          setShowDropdown(false);
        }
      } else if (e.key === "Escape") {
        setShowDropdown(false);
        setQuery("");
      }
    },
    [results, selectedIndex, selectOnEnter, selectNodes],
  );

  const handleSelect = useCallback(
    (id: string) => {
      selectNodes([id]);
      setShowDropdown(false);
    },
    [selectNodes],
  );

  return (
    <div
      data-testid="search-bar"
      className={className}
      style={{ position: "relative" }}
    >
      <input
        ref={inputRef}
        data-testid="search-input"
        className="g3t-input"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          width: "100%",
          fontSize: "var(--g3t-font-sm, 12px)",
          padding: "var(--g3t-space-2, 8px)",
        }}
      />

      {/* Result count badge */}
      {query && (
        <span
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 10,
            color: "var(--g3t-text-muted)",
          }}
        >
          {results.length > 0 ? `${results.length} found` : "no match"}
        </span>
      )}

      {/* Dropdown results */}
      {showDropdown && (
        <div
          data-testid="search-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 200,
            background: "var(--g3t-bg-primary)",
            border: "1px solid var(--g3t-border)",
            borderRadius: "var(--g3t-radius-sm, 4px)",
            boxShadow: "var(--g3t-shadow-lg)",
            maxHeight: 240,
            overflow: "auto",
          }}
        >
          {results.map((r, i) => (
            <button
              key={r.item.id}
              data-testid={`search-result-${r.item.id}`}
              onClick={() => handleSelect(r.item.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 10px",
                border: "none",
                borderBottom: "1px solid var(--g3t-border)",
                background:
                  i === selectedIndex
                    ? "var(--g3t-accent-muted)"
                    : "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12,
                color: "var(--g3t-text-primary)",
              }}
            >
              <div style={{ fontWeight: 500 }}>{r.item.name}</div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--g3t-text-muted)",
                  display: "flex",
                  gap: 8,
                }}
              >
                <span>{r.item.type}</span>
                <span style={{ opacity: 0.6 }}>{r.item.id}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
