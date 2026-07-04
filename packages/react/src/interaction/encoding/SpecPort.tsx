/**
 * SpecPort: tier 3 of the disclosure model (encoding-controls.md)
 * made tangible. The spec is one versioned JSON document; this
 * surface exports the live spec and imports edited JSON, surfacing
 * every parse failure verbatim: malformed JSON, unsupported versions,
 * and ReservedChannelError (the guard that keeps workspaces from
 * smuggling mappings onto owned channels) all land in a visible
 * alert instead of a console.
 */

import { useState } from "react";
import {
  parseEncodingSpec,
  serializeEncodingSpec,
  type EncodingSpec,
} from "./encoding-spec";

export interface SpecPortProps {
  spec: EncodingSpec;
  onApply: (spec: EncodingSpec) => void;
  className?: string;
}

export function SpecPort({ spec, onApply, className }: SpecPortProps) {
  const serialized = serializeEncodingSpec(spec);
  const [draft, setDraft] = useState(serialized);
  const [base, setBase] = useState(serialized);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Follow external spec changes (panel edits) until the user starts
  // editing the JSON. Render-phase adjustment (React's sanctioned
  // derived-state pattern) rather than an effect: no extra commit,
  // no cascading-render lint hazard.
  if (!dirty && base !== serialized) {
    setBase(serialized);
    setDraft(serialized);
    setError(null);
  }

  return (
    <div className={className} data-testid="g3t-spec-port">
      <textarea
        className="g3t-input g3t-spec-port-text"
        aria-label="Encoding spec JSON"
        value={draft}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
          setError(null);
        }}
      />
      <div className="g3t-spec-port-actions">
        <button
          className="g3t-btn"
          disabled={!dirty}
          onClick={() => {
            try {
              const parsed = parseEncodingSpec(draft);
              onApply(parsed);
              setDirty(false);
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Apply JSON
        </button>
        <button
          className="g3t-btn g3t-btn-ghost"
          disabled={!dirty}
          onClick={() => {
            setDraft(serializeEncodingSpec(spec));
            setDirty(false);
            setError(null);
          }}
        >
          Reset
        </button>
      </div>
      {error ? (
        <div
          className="g3t-enc-warning"
          role="alert"
          data-testid="spec-port-error"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
