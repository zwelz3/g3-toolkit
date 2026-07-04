# Audit Remediation Tracker (2026-06-10)

Source: two-pass external audit (spec-only repo, then v1.0.0-rc implementation repo).
Each item lists the fix and its validation gate. Statuses: [x] todo, [x] done.

## Release-blocking

- [x] A1. Exports map: `types` condition listed after `import`/`require` in every
      conditional export (core, react, charts). Consumers get TS7016 under both
      node16 and bundler resolution. Fix: types-first in every block.
      Validate: new `verify:types` consumer-resolution check (A2).
- [x] A2. Add `scripts/verify-types.mjs`: builds a scratch consumer against the
      packed layout, runs tsc under node16 and bundler resolution. Wire into
      `pnpm run verify` so CI catches regressions.

## Adoption-blocking docs

- [x] B1. Root README quickstart: `new SparqlAdapter({ endpoint })` does not match
      `constructor(endpointUrl: string, ...)`; missing React imports; unused
      `useSelectionStore` import. Fix snippet.
- [x] B2. packages/core/README.md: same constructor mismatch. Fix.
- [x] B3. Add `scripts/check-readme-snippets.mjs`: extract fenced ts/tsx blocks
      from READMEs and typecheck them. Wire into `verify`.

## Spec lint gate

- [x] C1. lint_specs.py: exit non-zero when warnings exist (regression from
      first audit, still unfixed).
- [x] C2. Extend linter: require status/priority/role on requirements; flag
      RFC 2119 text vs `priority` disagreement; flag missing acceptance on
      MUST requirements; resolve cross-references (R/D/OQ/P/C IDs).
- [x] C3. Restore spec linting to CI (ci.yml step; it currently runs nowhere).
- [x] C4. Relocate R1.13/R1.14 and R2.13–R2.15 out of User Stories sections
      into Requirements sections (currently masked lint warnings).

## Spec content

- [x] D1. Fix 7 MUST-text/SHOULD-priority mismatches (R1.8, R1.9, R2.15, R4.5,
      R6.2, R7.5, R7.6). Direction: align prose to the `priority` field; the
      field is the deliberate machine-readable annotation.
- [x] D2. Add acceptance criteria to the 11 requirements lacking them
      (R1.13, R1.14, R2.13–R2.15, R7.3–R7.6, R7.11, R7.12).
- [x] D3. OQ9: remove false attribution ("D5 and R2.12 specify optimistic UI");
      neither does. Re-anchor to M9 planning.
- [x] D4. Capability clusters: C1–C8 are defined in research/use-case-survey.md
      §B. Add explicit pointers where specs reference them (R7.6, D3 rationale,
      00-overview 90% claim) so the references resolve.
- [x] D5. OQ2 (spec 10) duplicates OQ5.3 (spec 05); OQ5 duplicates OQ5.1.
      Replace duplicates with cross-references; spec 10 is the register of record.
- [x] D6. Add OQ for fog-redaction export behavior gap (R8.1 vs R8.4).
- [x] D7. Spec status sweep. Policy: `implemented` if cited in a passing test
      file; `in-progress` if cited in source only; `proposed` if uncited.
      Manual exception: R5.1 capped at in-progress (in-memory adapter only;
      no Fuseki/Rdflib backend, acceptance unmet).

## Truth-in-claims

- [x] E1. PROGRESS.md: "72/72 referenced" is false (64/72) and conflates
      referenced with implemented. Correct headline; refresh test counts
      (600/52); remove stale "Next Up" (M11 done); fix section ordering.
- [x] E2. status.md: ticket totals reconciled to roadmap (139 complete;
      M9=6, M10=13 unscheduled); coverage table re-counted against 72.
- [x] E3. pixi.toml version 0.8.5 → 1.0.0-rc.
- [x] E4. HolonicAdapter: header claims R5.1/R5.5–R5.8; implementation is an
      in-memory shape with no SPARQL backend and query() ignores its argument.
      Rewrite header honestly; document the query() behavior.
- [x] E5. CHANGELOG entry for the remediation pass.

## CI and test hygiene

- [x] F1. Relocate dist-dependent public-api test out of the default `pnpm test`
      include set; run it from `verify` (after build) instead. Fresh-clone
      `pnpm test` must pass with no dist/.
- [x] F2. Add Playwright e2e job to ci.yml (currently runs in no workflow,
      contradicting PROGRESS M0.E1.T2). NOTE: cannot execute Playwright in
      this sandbox (browser CDN unreachable); job authored per Playwright CI
      docs, first CI run validates.
- [x] F3. Root package.json: remove publish-only fields (peerDependencies,
      peerDependenciesMeta, files, sideEffects) from the private root; ensure
      demo/example deps still resolve (move to devDependencies as needed);
      regenerate lockfile; full re-test.
- [x] F4. NOTICE files: referenced in every package `files` array but absent.
      Create them.

## Final validation

- [x] G1. pnpm install (fresh lockfile state) → typecheck → lint → test
      (no build) → verify → spec lint, all green.
- [x] G2. Consumer type-resolution check green under node16 and bundler.

## Completion notes (2026-06-10)

All items closed. Findings discovered during remediation, beyond the
audit inventory:

1. **A1 root cause was deeper than condition ordering.** The `types`
   targets were phantom paths: tsc emitted declarations into dist/ and
   each package's Vite build then deleted them via `emptyOutDir: true`.
   Fixed with scripts/clean-dist.mjs + emptyOutDir: false + a node16
   extension rewriter for emitted declarations
   (scripts/fix-dts-extensions.mjs).
2. **Two additional broken README snippets** (react: same constructor
   bug, missing hook imports, phantom ThemeProvider export; charts:
   string passed where a DataPipeline is required) were caught by the
   new verify:snippets gate, not by the audit.
3. **Comment-only phantom citations** inflated the first status sweep:
   R2.15 (a bare comment in WorkspaceShell with zero bookmark code),
   R3.6/R6.2/R6.3 (comments self-described as "planned"), R3.8 (generic
   property storage labeled as document linkage), R2.10/R2.11 (partial
   slivers). scripts/sync_spec_status.py now encodes the policy with a
   planned-comment guard and acceptance caps, and runs in CI.
4. **Process scar:** a DOTALL regex demotion intended for R2.12 hit
   R2.13 instead; caught by the recount cross-check. All subsequent
   status edits are line-anchored, and the sync script reports rather
   than rewrites.
5. **E2e gating decision:** no Linux screenshot baselines exist, so the
   CI e2e job gates functional assertions with --ignore-snapshots;
   bootstrap instructions are inline in ci.yml. A guaranteed-red gate
   would be ignored, which is the same failure as a gate that cannot
   fail.

Remaining queued work (not defects): typed CJS consumption via
declaration bundling; M9/M10 milestones; demo overhaul Phase 4;
templatizing planning/status.md from milestone YAML.

Final gate evidence: frozen-lockfile install, typecheck, ESLint +
Prettier, 580 unit/component tests with no dist present, full verify
chain (build, 20 dist-artifact tests, treeshake, smoke, consumer type
resolution under node16 + bundler, README snippet typecheck, bundle
budgets), spec lint, and status sync: all exit 0.
