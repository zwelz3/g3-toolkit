/**
 * Canvas rendering e2e.
 *
 * EMPTIED 2026-08-15, deliberately. This file held three tests
 * ("initial graph renders with nodes and edges", "node selection shows
 * blue border", "context menu appears on right-click") whose entire
 * assertion was a toHaveScreenshot call. No Linux baselines are
 * committed and playwright.config.ts sets ignoreSnapshots unless
 * PW_SNAPSHOTS=1, so all three passed without comparing anything: a
 * canvas that rendered nothing at all would have passed them too. Two
 * also right-clicked a fixed pixel and hoped to hit a node, which the
 * removed comments admitted.
 *
 * They are not rewritten as functional assertions here because canvas
 * rendering is what screenshots are FOR, and the functional part is
 * already covered: foundation.spec asserts the canvas mounts with a
 * non-zero box, selection.spec asserts selection state and the table
 * context menu against the DOM, and shells.spec counts real drawn
 * elements out of the SVG renderer.
 *
 * To restore visual coverage, land the baselines: generate on Linux
 * with PW_SNAPSHOTS=1 --update-snapshots, commit
 * tests/e2e/__screenshots__, flip ignoreSnapshots per the note in
 * playwright.config.ts, then reinstate these three. That is
 * roadmap/architecture/release-engineering.md item 2. Baselines
 * generated on any other platform cannot be compared against CI.
 */

export {};
