// WITHDRAWN 2026-08-15: defaultFetch, retryOnError, requestLogger and
// RetryExhaustedError. None was named in any adopter document or used
// anywhere in this repository. RetryExhaustedError left with
// retryOnError rather than on its own merits: it is that middleware's
// error type, and an error nothing reachable can throw is dead surface.
// The modules and their tests remain in the tree, so the code cannot
// rot; see packages/core/ARCHIVE.md for the restore procedure.
//
// createDefaultFetch is what makes dropping defaultFetch safe: it is
// the documented way to obtain a base fetch for composeMiddleware, and
// it takes the timeout that defaultFetch fixed at 30 s.
export {
  composeMiddleware,
  createDefaultFetch,
  DEFAULT_TIMEOUT_MS,
  AdapterTimeoutError,
  bearerAuth,
  apiKeyHeader,
} from "./middleware";
export type { AdapterRequest, AdapterResponse, Middleware } from "./middleware";
