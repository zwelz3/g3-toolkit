import { useState } from "react";
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
  defaultOpen = false,
  staticHeader = false,
}: {
  /** The owning shell's accent color; keeps the callout on-identity. */
  accent: string;
  items: CapabilityItem[];
  /** Render expanded (the floating bubble opens it pre-expanded). */
  defaultOpen?: boolean;
  /** 9.24: inside the floating bubble the FAB already opens and
   *  closes the panel, so the inner disclosure toggle was a second,
   *  pointless collapse control. Static header instead. Inline
   *  usages keep the disclosure. */
  staticHeader?: boolean;
}) {
  const Root = (staticHeader ? "div" : "details") as "details";
  const Head = (staticHeader ? "div" : "summary") as "summary";
  return (
    <Root
      data-testid="capability-callout"
      open={staticHeader ? undefined : defaultOpen || undefined}
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
      <Head
        style={{
          cursor: staticHeader ? "default" : "pointer",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: accent,
        }}
      >
        Built on the toolkit
      </Head>
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
    </Root>
  );
}

/**
 * Floating variant (review 4.9): a fixed bottom-right button that
 * opens the callout in a popover card. The in-rail placement kept
 * getting pushed below the fold when rails filled up; a floating
 * bubble is reachable regardless of rail content. Same {accent,
 * items} contract, so shells swap placement without rewriting their
 * item lists. The popover carries the same data-testid as the inline
 * callout; tests open the bubble first.
 */
export function CapabilityBubble({
  accent,
  items,
  bottomOffset = 16,
}: {
  accent: string;
  items: CapabilityItem[];
  /** 9.24: shells with bottom chrome (the auditor's timeline strip)
   *  lift the bubble above it. */
  bottomOffset?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: bottomOffset,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      {open && (
        <div
          style={{
            width: 340,
            maxWidth: "calc(100vw - 48px)",
            maxHeight: "min(420px, calc(100vh - 96px))",
            overflow: "auto",
            background: "var(--g3t-bg-primary, #fff)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          }}
        >
          <CapabilityCallout
            accent={accent}
            items={items}
            defaultOpen
            staticHeader
          />
        </div>
      )}
      <button
        type="button"
        data-testid="capability-bubble"
        aria-expanded={open}
        aria-label="Built on the toolkit"
        title="Built on the toolkit"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          background: accent,
          color: "#fff",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      >
        {open ? "\u00d7" : "g3t"}
      </button>
    </div>
  );
}
