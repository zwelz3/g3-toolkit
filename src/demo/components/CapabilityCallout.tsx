/**
 * CapabilityCallout: the adoptability panel each demo shell carries.
 *
 * Every shell is a sales narrative twice over: the domain story on the
 * surface, and underneath it the claim that an adopter could build the same
 * thing. This callout makes the second claim explicit by mapping each
 * visible feature to the exact public toolkit mechanism behind it, and
 * naming the three integration channels (stores, props/callbacks, versioned
 * JSON documents) so a reviewer can go from "that looks good" to "I see how
 * I would wire that" without leaving the demo.
 *
 * Rendered as a <details> element: closed by default so it never crowds a
 * shell's working panels, headless-testable (no state, no effects), and
 * styled inline so nothing leaks across shell identities.
 */

/**
 * Base URL for deep links into the wiring guide. GitHub blob anchors
 * are used (rather than the Pages-rendered typedoc document) because
 * they resolve the moment the repo is pushed, with well-defined
 * heading-slug rules; the Pages site's liveness is a deployment
 * concern this component should not depend on.
 */
export const WIRING_GUIDE_URL =
  "https://github.com/zwelz3/g3-toolkit/blob/main/docs/wiring-guide.md";

export interface CapabilityItem {
  /** The public mechanism (component, store, function, or prop). */
  mechanism: string;
  /** What the shell does with it, in one clause. */
  how: string;
  /**
   * Wiring-guide heading anchor (the part after #) documenting this
   * exact mechanism with a runnable snippet. OMITTED for demo-local
   * helpers (e.g. a shell's own projection function): linking those to
   * the guide would misattribute them as toolkit surface.
   */
  anchor?: string;
}

export function CapabilityCallout({
  accent,
  items,
}: {
  /** The owning shell's accent color; keeps the callout on-identity. */
  accent: string;
  items: CapabilityItem[];
}) {
  return (
    <details
      data-testid="capability-callout"
      style={{
        margin: "10px 12px 12px",
        padding: "8px 10px",
        border: `1px solid ${accent}`,
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.5,
        opacity: 0.92,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: accent,
        }}
      >
        Built on the toolkit
      </summary>
      <ul style={{ margin: "8px 0 0", paddingLeft: 16 }}>
        {items.map((i) => (
          <li key={i.mechanism} style={{ marginBottom: 4 }}>
            {i.anchor !== undefined ? (
              <a
                href={`${WIRING_GUIDE_URL}#${i.anchor}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: accent, textDecoration: "none" }}
              >
                <code
                  style={{
                    fontSize: 11,
                    padding: "0 3px",
                    borderRadius: 3,
                    background: "rgba(127,127,127,0.15)",
                    textDecoration: "underline",
                    textDecorationStyle: "dotted",
                  }}
                >
                  {i.mechanism}
                </code>
              </a>
            ) : (
              <code
                style={{
                  fontSize: 11,
                  padding: "0 3px",
                  borderRadius: 3,
                  background: "rgba(127,127,127,0.15)",
                }}
              >
                {i.mechanism}
              </code>
            )}{" "}
            {i.how}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 8, opacity: 0.8 }}>
        Everything above reaches the toolkit through its three public
        integration channels (exported stores, props and callbacks, and
        versioned JSON documents); the{" "}
        <a
          href={WIRING_GUIDE_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: accent }}
        >
          wiring guide
        </a>{" "}
        carries a runnable snippet for each, and linked mechanisms above jump
        straight to theirs.
      </div>
    </details>
  );
}
