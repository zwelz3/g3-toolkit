/**
 * F4 Annotation tests.
 *
 * Moved from packages/core/src/combo/f1-f8.test.tsx during Phase 4:
 * AnnotationPanel and createLocalAnnotationStore both live in
 * @g3t/react/interaction/annotations/, so their tests belong here,
 * not in @g3t/core's test suite.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnnotationPanel } from "./AnnotationPanel";
import { createLocalAnnotationStore } from "./AnnotationPanel";

describe("AnnotationPanel (F4)", () => {
  it("shows empty state when no element selected", () => {
    render(<AnnotationPanel elementId={null} />);
    expect(screen.getByText(/Select a node/i)).toBeInTheDocument();
  });

  it("renders text input when element is selected", () => {
    render(<AnnotationPanel elementId="test-node" />);
    expect(screen.getByTestId("annotation-input")).toBeInTheDocument();
  });
});

describe("createLocalAnnotationStore (F4)", () => {
  it("stores and retrieves annotations", async () => {
    const store = createLocalAnnotationStore("test-annot");
    await store.set("n1", {
      elementId: "n1",
      text: "Test note",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const result = await store.get("n1");
    expect(result?.text).toBe("Test note");

    await store.delete("n1");
    const deleted = await store.get("n1");
    expect(deleted).toBeNull();
  });
});
