#!/usr/bin/env python3
"""Lint specl-format markdown files for structural issues.

Usage:
    python lint_specs.py specs/
    python lint_specs.py specs/01-functional-views.md

Checks:
- YAML front-matter presence and required fields
- Section headings match recognized specl sections
- Bullet ID prefixes match their parent section
- Sub-bullet keys are recognized annotation keys
- Status values are from allowed enums
"""

from __future__ import annotations

import re
import sys
import yaml
from pathlib import Path

REQUIRED_FRONTMATTER = {"spec_id", "title", "version", "status"}
VALID_SPEC_STATUS = {"draft", "prototype", "review", "production"}

SECTION_PREFIXES = {
    "Requirements": "R",
    "User Stories": "US",
    "Open Issues": "OQ",
    "Open Questions": "OQ",
    "Decisions": "D",
    "Design Considerations": None,
    "Comments": None,
    "Intent": None,
    "Purpose": None,
}

RECOGNIZED_KEYS = {
    "priority", "acceptance", "verifiedBy", "constrains",
    "asA", "soThat", "owner", "recommendation", "status",
    "rationale", "affects", "role",
}

VALID_REQ_STATUS = {"proposed", "accepted", "in-progress", "implemented", "verified"}
VALID_DECISION_STATUS = {"considering", "accepted", "deferred", "rejected"}
VALID_OQ_STATUS = {"open", "in-review", "resolved", "deferred"}


def lint_file(path: Path) -> list[str]:
    """Lint a single specl markdown file. Returns a list of warnings."""
    warnings: list[str] = []
    text = path.read_text(encoding="utf-8")

    # Check front-matter
    fm_match = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not fm_match:
        warnings.append(f"{path}:1: missing YAML front-matter")
        return warnings

    try:
        fm = yaml.safe_load(fm_match.group(1))
    except yaml.YAMLError as e:
        warnings.append(f"{path}:1: invalid YAML front-matter: {e}")
        return warnings

    if not isinstance(fm, dict):
        warnings.append(f"{path}:1: front-matter is not a mapping")
        return warnings

    missing = REQUIRED_FRONTMATTER - set(fm.keys())
    if missing:
        warnings.append(f"{path}:1: missing front-matter fields: {missing}")

    if fm.get("status") and fm["status"] not in VALID_SPEC_STATUS:
        warnings.append(
            f"{path}:1: invalid spec status '{fm['status']}'; "
            f"expected one of {VALID_SPEC_STATUS}"
        )

    # Parse lines for section and bullet checks
    lines = text.split("\n")
    current_section = None
    current_bullet_prefix = None
    last_bullet_line = None

    for i, line in enumerate(lines, 1):
        # Specl section (H1 or H2)
        h_match = re.match(r"^#{1,2} (.+)$", line)
        if h_match:
            section_name = h_match.group(1).strip()
            if section_name in SECTION_PREFIXES:
                current_section = section_name
                current_bullet_prefix = SECTION_PREFIXES.get(section_name)
            continue

        # Top-level bullet
        bullet = re.match(r"^- (\S+)", line)
        if bullet:
            bullet_id = bullet.group(1)
            last_bullet_line = i
            if current_bullet_prefix:
                if not bullet_id.startswith(current_bullet_prefix):
                    warnings.append(
                        f"{path}:{i}: bullet '{bullet_id}' does not match "
                        f"expected prefix '{current_bullet_prefix}' for "
                        f"section '{current_section}'"
                    )
            continue

        # Sub-bullet
        sub = re.match(r"^\s+- (\w+):\s*(.*)$", line)
        if sub:
            key = sub.group(1)
            value = sub.group(2).strip()
            if key not in RECOGNIZED_KEYS:
                warnings.append(
                    f"{path}:{i}: unrecognized annotation key '{key}'"
                )
            # Validate status values
            if key == "status" and current_section == "Requirements":
                if value and value not in VALID_REQ_STATUS:
                    warnings.append(
                        f"{path}:{i}: invalid requirement status '{value}'; "
                        f"expected one of {VALID_REQ_STATUS}"
                    )
            if key == "status" and current_section == "Decisions":
                if value and value not in VALID_DECISION_STATUS:
                    warnings.append(
                        f"{path}:{i}: invalid decision status '{value}'; "
                        f"expected one of {VALID_DECISION_STATUS}"
                    )
            if key == "status" and current_section in ("Open Issues", "Open Questions"):
                if value and value not in VALID_OQ_STATUS:
                    warnings.append(
                        f"{path}:{i}: invalid open-issue status '{value}'; "
                        f"expected one of {VALID_OQ_STATUS}"
                    )
            if last_bullet_line is None:
                warnings.append(
                    f"{path}:{i}: sub-bullet without parent bullet"
                )

    return warnings


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: lint_specs.py <path-or-directory> [...]", file=sys.stderr)
        return 1

    all_warnings: list[str] = []

    for arg in sys.argv[1:]:
        p = Path(arg)
        if p.is_dir():
            files = sorted(p.glob("*.md"))
        elif p.is_file():
            files = [p]
        else:
            print(f"Warning: '{arg}' not found, skipping", file=sys.stderr)
            continue

        for f in files:
            all_warnings.extend(lint_file(f))

    for w in all_warnings:
        print(w, file=sys.stderr)

    if all_warnings:
        print(f"\n{len(all_warnings)} warning(s) found.", file=sys.stderr)
    else:
        print("All specs clean.", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
