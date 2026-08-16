/**
 * ViewErrorBoundary: the one thing a React library cannot leave to the
 * host, because there is no hook form of it.
 *
 * A render-phase throw anywhere under a view (a code-split chunk that
 * fails to fetch, a malformed document reaching a renderer, an adapter
 * result with a shape nobody anticipated) unmounts the whole React
 * tree above it. The user gets a blank white page: no message, no
 * reload, nothing in the UI to act on. Every view in this package sits
 * under whatever boundary the host provides, and the toolkit shipped
 * none, so the demo shells had exactly that failure mode.
 *
 * This is a class because `getDerivedStateFromError` and
 * `componentDidCatch` have no hook equivalent in React 19. It is the
 * only class component in the package, deliberately.
 *
 * It does not swallow: the default fallback prints the message and
 * offers a retry, and `onError` hands the error and the component
 * stack to the host's reporting.
 *
 * ```tsx
 * <ViewErrorBoundary onError={(e) => report(e)}>
 *   <Suspense fallback={<Spinner />}>
 *     <LazyView />
 *   </Suspense>
 * </ViewErrorBoundary>
 * ```
 *
 * Retry remounts the subtree. That is enough for a transient render
 * failure, but NOT for a `React.lazy` whose import rejected: lazy
 * caches its rejection permanently, so a host that wants retry to
 * re-fetch the chunk must build a NEW lazy from the loader when
 * `retry` fires (see src/demo/Demo.tsx for that pattern).
 */
import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";

export interface ViewErrorFallbackArgs {
  /** What was thrown, normalized: a non-Error throw arrives wrapped. */
  error: Error;
  /** Clear the error and remount the children. */
  retry: () => void;
}

export interface ViewErrorBoundaryProps {
  children: ReactNode;
  /**
   * Replacement UI. Receives the error and a retry callback; return
   * whatever the host's error presentation is. Omit for the built-in
   * message-plus-retry fallback.
   */
  fallback?: (args: ViewErrorFallbackArgs) => ReactNode;
  /**
   * Called once per caught error, with React's component stack. Use it
   * to report; the boundary renders the fallback either way.
   */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ViewErrorBoundaryState {
  error: Error | null;
  /** Bumped by retry; keys the subtree so children genuinely remount. */
  attempt: number;
}

export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  override state: ViewErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(
    error: unknown,
  ): Pick<ViewErrorBoundaryState, "error"> {
    // Anything can be thrown; the fallback contract promises an Error.
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private readonly retry = (): void => {
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
  };

  override render(): ReactNode {
    const { error, attempt } = this.state;
    if (error === null) {
      return <Fragment key={attempt}>{this.props.children}</Fragment>;
    }
    if (this.props.fallback) {
      return this.props.fallback({ error, retry: this.retry });
    }
    // Inline styles, not a stylesheet rule: one of the failures this
    // catches is "the app never got its CSS", and the fallback has to
    // be legible in that case. The class names are still there for a
    // host that wants to restyle it.
    return (
      <div
        role="alert"
        className="g3t-view-error"
        style={{ padding: 16, font: "14px/1.5 system-ui, sans-serif" }}
      >
        <p className="g3t-view-error__message" style={{ margin: "0 0 8px" }}>
          This view failed to render: {error.message}
        </p>
        <button type="button" onClick={this.retry}>
          Retry
        </button>
      </div>
    );
  }
}
