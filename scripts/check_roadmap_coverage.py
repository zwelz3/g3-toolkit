#!/usr/bin/env python3
"""Enforce the roadmap coverage contract (roadmap/CLAUDE.md).

Rules:
  1. Every spec requirement whose status is `in-progress` or
     `proposed` is OWNED by exactly one roadmap file. Ownership is
     declared in a file's "**Owns:**" header line; mentions elsewhere
     are cross-references and do not count.
  2. No roadmap file owns an `implemented` (or `verified`)
     requirement: that is a stale roadmap, the inverse failure.
  3. The ownership index table in roadmap/CLAUDE.md agrees with the
     per-file Owns headers (the table is documentation; the headers
     are the contract; drift between them is a failure).

Exit non-zero on any violation; runs in the CI spec-lint job.
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RID = re.compile(r"\bR\d+\.\d+\b")
DONE = {"implemented", "verified"}


def spec_statuses() -> dict[str, str]:
    statuses: dict[str, str] = {}
    for spec in (ROOT / "specs").glob("*.md"):
        for block in re.split(r"\n(?=- R\d)", spec.read_text()):
            m = re.match(r"- (R\d+\.\d+) ", block)
            if not m:
                continue
            s = re.search(r"status:\s*([\w-]+)", block)
            statuses[m.group(1)] = s.group(1) if s else "(missing)"
    return statuses


def roadmap_owners() -> dict[str, list[str]]:
    owners: dict[str, list[str]] = defaultdict(list)
    for f in sorted((ROOT / "roadmap").rglob("*.md")):
        if f.name == "CLAUDE.md":
            continue
        rel = str(f.relative_to(ROOT / "roadmap"))
        text = f.read_text()
        # Owns headers may wrap; capture from "**Owns:**" to the next
        # bold field or blank line. Dedupe per file: only cross-FILE
        # double ownership violates the contract.
        file_ids: set[str] = set()
        for m in re.finditer(
            r"\*\*Owns:\*\*(.*?)(?=\n\*\*|\n\n)", text, re.S
        ):
            file_ids |= set(RID.findall(m.group(1)))
        for rid in file_ids:
            owners[rid].append(rel)
    return owners


def claude_md_index() -> set[tuple[str, str]]:
    text = (ROOT / "roadmap" / "CLAUDE.md").read_text()
    pairs: set[tuple[str, str]] = set()
    for line in text.split("\n"):
        m = re.match(r"\| (R\d+\.\d+) [^|]*\| [^|]+\| ([^|]+) \|", line)
        if m:
            pairs.add((m.group(1), m.group(2).strip()))
    return pairs


def main() -> int:
    statuses = spec_statuses()
    owners = roadmap_owners()
    problems: list[str] = []

    open_reqs = {r for r, s in statuses.items() if s not in DONE and s != "(missing)"}

    for rid in sorted(open_reqs, key=lambda x: (int(x[1:].split(".")[0]), int(x.split(".")[1]))):
        files = owners.get(rid, [])
        if len(files) == 0:
            problems.append(f"{rid} ({statuses[rid]}) is owned by no roadmap file")
        elif len(files) > 1:
            problems.append(f"{rid} is owned by multiple files: {files}")

    for rid, files in sorted(owners.items()):
        if statuses.get(rid) in DONE:
            problems.append(
                f"{rid} is '{statuses[rid]}' but still owned by {files} (stale roadmap)"
            )
        if rid not in statuses:
            problems.append(f"{rid} owned by {files} but not defined in specs/")

    index = claude_md_index()
    header_pairs = {
        (rid, files[0]) for rid, files in owners.items() if len(files) == 1
    }
    for rid, f in sorted(header_pairs - index):
        problems.append(f"CLAUDE.md index missing/mismatched for {rid} -> {f}")
    for rid, f in sorted(index - header_pairs):
        problems.append(f"CLAUDE.md index lists {rid} -> {f} but no Owns header matches")

    owned_open = len([r for r in open_reqs if len(owners.get(r, [])) == 1])
    print(
        f"roadmap coverage: {owned_open}/{len(open_reqs)} open requirements "
        f"singly owned across {len(set(sum(owners.values(), [])))} files"
    )
    if problems:
        print(f"\n{len(problems)} violation(s):")
        for p in problems:
            print(f"  {p}")
        return 1
    print("coverage contract satisfied")
    return 0


if __name__ == "__main__":
    sys.exit(main())
