/**
 * ViewErrorBoundary: a render-phase throw must become a message and a
 * retry, never a blank page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewErrorBoundary } from "./ViewErrorBoundary";

/**
 * Throws while `fail()` says so. Deliberately NOT a render counter:
 * React retries a failed concurrent render once on its own before
 * handing the error to a boundary, so a counter would "recover" without
 * anyone clicking anything.
 */
function Flaky({ fail }: { fail: () => boolean }) {
  if (fail()) throw new Error("chunk fetch failed");
  return <p>loaded</p>;
}
const always = () => true;

// React logs every caught error itself; the noise is not the subject.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("ViewErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <ViewErrorBoundary>
        <p>fine</p>
      </ViewErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeInTheDocument();
  });

  it("reports the message and offers a retry instead of unmounting the tree", () => {
    const onError = vi.fn();
    render(
      <ViewErrorBoundary onError={onError}>
        <Flaky fail={always} />
      </ViewErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("chunk fetch failed");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    // The component stack goes to the host too; a bare message is not
    // enough to locate the throw in a production build.
    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0]![1]).toHaveProperty("componentStack");
  });

  it("retry remounts the subtree, so a transient failure recovers", () => {
    let broken = true;
    render(
      <ViewErrorBoundary>
        <Flaky fail={() => broken} />
      </ViewErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    broken = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("loaded")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hands a custom fallback the error and the retry", () => {
    let broken = true;
    render(
      <ViewErrorBoundary
        fallback={({ error, retry }) => (
          <button type="button" onClick={retry}>
            recover from {error.message}
          </button>
        )}
      >
        <Flaky fail={() => broken} />
      </ViewErrorBoundary>,
    );
    const button = screen.getByRole("button", {
      name: "recover from chunk fetch failed",
    });
    broken = false;
    fireEvent.click(button);
    expect(screen.getByText("loaded")).toBeInTheDocument();
  });

  it("wraps a non-Error throw, since the fallback contract promises an Error", () => {
    function Rude(): React.ReactNode {
      throw "just a string";
    }
    const seen: unknown[] = [];
    render(
      <ViewErrorBoundary
        fallback={({ error }) => {
          seen.push(error);
          return <p>{error.message}</p>;
        }}
      >
        <Rude />
      </ViewErrorBoundary>,
    );
    expect(seen[0]).toBeInstanceOf(Error);
    expect(screen.getByText("just a string")).toBeInTheDocument();
  });
});
