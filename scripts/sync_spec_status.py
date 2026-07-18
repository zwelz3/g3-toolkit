#!/usr/bin/env python3
"""Report drift between spec requirement statuses and code citations.

Policy (planning/audit-remediation.md, D7):
  - implemented: the R-ID is cited in a test file, or in a source module
    whose directory contains a colocated test file
  - in-progress: cited in source only (no colocated test)
  - proposed: uncited

Guards learned from the v1.0.0-rc audit's phantom-citation findings:
  - citation lines containing "planned", "not yet", or "NOT implemented"
    are excluded; a comment announcing future work is not evidence
  - CAPS pins requirements whose acceptance criteria cannot be met by
    the current implementation regardless of citations
  - this script REPORTS drift and exits 1; it does not rewrite specs.
    Status changes are deliberate edits, reviewed against the actual
    code, because comment-based traceability over-credits (see the
    R2.15/R3.6/R3.8/R6.2 phantoms removed in the remediation pass).

Usage: python scripts/sync_spec_status.py
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Acceptance-criteria caps (manual, with reasons):
CAPS = {
    "R1.2": "in-progress",  # aspect-test cap no. 4 (policy note below):
    # the vendored-CSS sync test colocated with TimelineView is what
    # upgraded its citation, and R1.2's own acceptance (scrubbing,
    # animation, canvas filtered by temporal range) is not met; the
    # playback gap matches R2.10's cap
    "R5.1": "in-progress",  # in-memory adapter; no Fuseki/Rdflib backend
    "R1.8": "in-progress",  # histogram + brush tested (review 3.5); embedding scatter plots absent
    "R2.12": "in-progress",  # validation callback only; no commit-time SHACL
    "R2.10": "in-progress",  # timeline renders; playback animation absent
    "R2.11": "in-progress",  # serialization only; export formats absent (M10)
    "R1.4": "in-progress",  # gradient + limit-notice verified; type-pair
    # selection absent and R7.3 aggregation is truncation-with-notice
    # (matrix-acceptance.test documents both gaps)
    "R1.3": "in-progress",  # colocated map-selection.test verifies the C1
    # signature only; R1.3's own acceptance (tiled basemap, region
    # drawing, measurement) remains unverified per view-acceptance.md
    "R1.6": "in-progress",  # colocated tree-density.test verifies the B3
    # density prop, not R1.6's acceptance (5,000-node fixture,
    # two-level initial render, lazy expand)
    "R1.18": "in-progress",  # A1 geometry + A2 canvas application
    # shipped (structural.test, structural-to-cytoscape.test, canvas
    # row-selection test); held until the VA-27 fixture passes
    # visual acceptance (rows/ports/layering quality is a browser
    # judgment jsdom cannot make)
    "R1.16": "in-progress",  # SHACL shapes render through the
    # compartment API (shacl-to-structural.test: «NodeShape»
    # containers, property-shape rows, closed/open borders, per-row
    # severity badges) and VA-28; the full shape-graph semantics
    # (blank-node vs IRI-named property shapes, sh:node/sh:target
    # edges) need a richer parse than the lightweight in-core model
    # carries, and stay open
    "R1.17": "in-progress",  # report document + adapter
    # (shacl-report.test) + severity overlays + count/severity drivers
    # + VA-29; and the cross-link/filter/detail logic (shacl-links.test:
    # resultSelectionIds, resultsForShape, resultDetail) with VA-30
    # demonstrating result->shape+data cross-selection live. What
    # remains: wiring resultDetail into the production DetailInspector
    # component (the data shaping is built and tested; the inspector
    # does not yet render it)
}

# POLICY NOTE (after FOUR aspect-test caps: R1.4, R1.3, R1.6, R1.2): tests
# colocated with a view but verifying a cross-cutting aspect (density,
# selection signature) trigger drift suggestions their requirement has
# not earned. The caps valve handles this at review time and keeps the
# colocated heuristic's 40+ legitimate credits. Decision rule: if this
# CAPS dict exceeds six aspect-test entries, retire the colocated
# heuristic and require the R-ID to appear in a test file's text for
# `implemented` credit.

ORDER = ["proposed", "accepted", "in-progress", "implemented", "verified"]
# reqId: excludes FIXTURE DATA (the MBSE satellite model carries
# requirement nodes with reqId: "R1.x" fields; model content is not
# traceability, and the mbse directory has colocated tests, so every
# fixture id was earning implemented-grade credit).
EXCLUDE_LINE = re.compile(
    r"planned|not yet|NOT implemented|reqId\s*:", re.IGNORECASE
)
RID = re.compile(r"\bR\d+\.\d+\b")


def collect_citations() -> tuple[set[str], set[str]]:
    test_cited: set[str] = set()
    src_cited: set[str] = set()
    for root in ["packages", "src", "tests", "examples"]:
        base = ROOT / root
        if not base.exists():
            continue
        for f in base.rglob("*.*"):
            if "dist" in f.parts or "node_modules" in f.parts:
                continue
            if f.suffix not in {".ts", ".tsx", ".mjs"}:
                continue
            is_test = ".test." in f.name or ".spec." in f.name
            has_colocated_test = any(
                ".test." in s.name for s in f.parent.iterdir() if s.is_file()
            )
            for line in f.read_text(encoding="utf-8", errors="ignore").split("\n"):
                if EXCLUDE_LINE.search(line):
                    continue
                for rid in RID.findall(line):
                    if is_test or has_colocated_test:
                        test_cited.add(rid)
                    else:
                        src_cited.add(rid)
    return test_cited, src_cited


def expected_status(rid: str, test_cited: set[str], src_cited: set[str]) -> str:
    if rid in test_cited:
        target = "implemented"
    elif rid in src_cited:
        target = "in-progress"
    else:
        target = "proposed"
    cap = CAPS.get(rid)
    if cap and ORDER.index(target) > ORDER.index(cap):
        target = cap
    return target


def main() -> int:
    test_cited, src_cited = collect_citations()
    drift: list[str] = []
    counts: dict[str, int] = defaultdict(int)
    for spec in sorted((ROOT / "specs").glob("*.md")):
        text = spec.read_text(encoding="utf-8")
        for block in re.split(r"\n(?=- R\d)", text):
            m = re.match(r"- (R\d+\.\d+) ", block)
            if not m:
                continue
            rid = m.group(1)
            status_m = re.search(r"status:\s*([\w-]+)", block)
            current = status_m.group(1) if status_m else "(missing)"
            counts[current] += 1
            expected = expected_status(rid, test_cited, src_cited)
            if current != expected:
                drift.append(
                    f"  {spec.name} {rid}: status is '{current}', "
                    f"citations suggest '{expected}'"
                )
    print("Requirement status distribution:", dict(counts))
    if drift:
        print(f"\n{len(drift)} status/citation drift item(s):")
        for d in drift:
            print(d)
        print(
            "\nReview each item against the actual code before editing the "
            "spec; comment-only citations over-credit."
        )
        return 1
    print("Spec statuses consistent with code citations.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
