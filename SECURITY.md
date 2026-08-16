# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |
| < 1.0 | No |

Fixes land on the current minor. There is no long-term-support branch.

## Reporting a vulnerability

Report privately through GitHub's security advisory form:
<https://github.com/zwelz3/g3-toolkit/security/advisories/new>.

Do not open a public issue for a suspected vulnerability. Public issues
are the right place for everything else, including hardening ideas that
do not describe an exploitable path.

Please include the affected package and version, what an attacker
controls, and what they gain. A reproduction against one of the four
dev-server shells (`pnpm run dev`) or a failing test is worth more than
a description.

You should get an acknowledgement within a week. If the report is
valid, the advisory tracks the fix and you are credited unless you ask
otherwise.

## What this library is, for threat-modeling purposes

g3-toolkit renders graphs in a browser. It is a component library, not
a server and not a security boundary. It has no authentication, no
authorization, and no session of its own. Everything it does happens
inside the host application's origin, with the host application's
privileges.

That shapes what a report can usefully be about. In scope:

- A path where graph data, a workspace snapshot, an algorithm result
  document, or an encoding spec can execute script in the host page.
- A path where an adapter argument escapes the query it is placed in.
- An export that produces a file which attacks whatever opens it.
- A denial of service reachable from a document a host would plausibly
  load, distinct from "a large graph is slow", which is a performance
  issue.

Out of scope, because the library never had the property:

- Anything about credentials being visible in the browser. See below;
  this is a property of client-side code, not a defect.
- Anything requiring the host application to already be compromised, or
  requiring an adopter to have deliberately passed hostile input to a
  trusted-by-contract entry point.

## Credentials in the browser

**Anything your bundle can read, your user can read.** `bearerAuth` and
`apiKeyHeader` in `@g3t/core` attach a credential to an adapter request
from code running in the page. That credential is visible in devtools,
in the network tab, in the bundle if it was hardcoded, and to any script
already running in the origin. No amount of care inside this library
changes that, and the middleware is not a secret store.

The middleware exists for credentials that are legitimately the user's
own and legitimately short-lived: a token the host already obtained
through its own auth flow, scoped to that user, with an expiry. It is
not a way to ship a service account to the client.

If your graph store cannot issue per-user, short-lived, least-privilege
credentials, do not connect the browser to it directly. Put an endpoint
in your own application in front of it, let the browser talk to that,
and keep the store's credential on the server. The adapters are
constructed with a URL, so pointing them at your own proxy instead of at
the store is a one-line change.

Concretely, when you do connect directly:

- Prefer a token the host fetches per session over anything in an env
  var that gets inlined at build time. `import.meta.env` values end up
  in the bundle in plain text.
- `bearerAuth` takes a function, not a string, so the token can be read
  fresh on every request and can be rotated without rebuilding.
- Scope the credential to read-only where the store supports it. The
  adapters only read.
- Set an explicit `timeoutMs` if your store is slow; the default is 30
  seconds, and requests that exceed it are aborted rather than left
  pending.

## Untrusted input

Some entry points are hardened against hostile input and some are
trusted by contract. The difference is deliberate and worth knowing
before you wire something up.

Hardened:

- **Adapter arguments.** `nodeId`, `depth`, and `edgeTypes` reach query
  text in positions where the wire protocol has no binding mechanism.
  Those positions are validated in `adapter/query-safety.ts` and a value
  that cannot be proven safe is rejected rather than escaped. Where the
  protocol does bind (Gremlin bindings, Cypher parameters), the adapter
  binds.
- **Versioned JSON documents.** The graph-document parse boundary checks
  element shape and drops bad elements with diagnostics naming the
  subject, rather than throwing a raw `TypeError` or accepting a
  malformed id.
- **Icon sets loaded at runtime.** Registered SVG is sanitized against a
  geometry allowlist by default, because SVG carries script elements,
  event-handler attributes, and `foreignObject`. Only pass
  `trust: "trusted"` for markup you compiled in yourself.
- **Exports.** Turtle output rejects IRIs it cannot encode safely and
  reports the drop as a comment; CSV output guards formula-injection
  prefixes while exempting plain numbers, so a negative measurement
  stays a number.

Trusted by contract, meaning: do not feed these from end users without
validating first.

- Encoding specs and theme objects. These are configuration authored by
  the adopter, and they can name arbitrary style properties.
- `mapResponse` on `RestAdapter`, and any middleware you supply. They
  are your code running in your page.
- Icon sets registered with `trust: "trusted"`.

## Dependencies

There is no automated dependency-advisory gate in CI today. Run
`pnpm audit` yourself before adopting a version if that matters to you,
and treat this paragraph as the honest answer rather than an aspiration:
a gate that does not exist should not be described as if it does.

When an advisory is reported here, an advisory in a transitive
dependency that is not reachable from any exported entry point is
triaged rather than patched immediately; a reachable one is treated as
a defect in this package.
