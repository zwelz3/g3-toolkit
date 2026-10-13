# Derived-property expression evaluator (2026-10-13)

Resolves GHSA-mpfx-v932-r2fv: `DerivedPropertyEngine` evaluated
expressions with expr-eval 2.0.2, which has unpatched code-execution and
prototype-pollution advisories, through `new Parser()` with default
options.

## Ruling: replace the dependency, do not configure it

Configuring expr-eval (`allowMemberAccess: false`, `assignment` and
`fndef` off, scope keys checked) narrows the surface but leaves the
toolkit relying on the enforcement of a library with open advisories and
no maintained release. The engine's contract is numbers in, a finite
number out, which needs a small language and nothing more, so the
toolkit now owns it: `packages/core/src/advanced/expression.ts`, internal
to core (not exported; the public surface is unchanged and
`api-surface.json` did not move).

## What the language is

Numbers, `PI`, `E`; variables resolved from a `Map` of the node's own
numeric properties; `+ - * / % ^` (power right-associative and tighter
than unary minus, as in expr-eval); comparison; `and or not`; `?:`; calls
to an allow-list of Math functions. Bounded at 1,000 characters and 64
levels of nesting, so a hostile expression cannot exhaust the stack.
Parse errors and evaluation errors are one class, `ExpressionError`; the
engine skips an expression that fails to parse and a node that fails to
evaluate, as it did before.

## What changed for adopters

Nothing in the documented or tested range. Dropped with expr-eval:
`random()`, factorial, concatenation, `in`, strings, and functions outside
the allow-list. The CHANGELOG lists them.

## Gates and budget

`pnpm run gates` exit 0. Core's first-party bundle 164.3 to 171.2 KB;
budget 169 to 172 KB in `scripts/check-bundle-size.mjs`, recorded for
owner ratification. Headroom after the raise is 0.8 KB.

## Disclosure sequence

The fix was prepared for the advisory's temporary private fork, merged
from the advisory page, then released (1.0.1, no API change) before the
advisory is published with "Patched versions: >= 1.0.1".
