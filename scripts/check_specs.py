#!/usr/bin/env python3
"""Gate the specl specification family.

Replaces the hand-rolled lint_specs.py, which approximated what the specl
CLI now does properly. This script only orchestrates: every structural
check is delegated to `specl-translate` and `specl-validate`, and the one
thing no CLI does (checking the family as a whole rather than member by
member) is implemented here in rdflib.

Per member:
  specl-translate <root>.md <out>.ttl --fail-on-warning
  specl-validate validate <out>.ttl
  specl-validate layering <out>.ttl

Across the family, after merging every member's Turtle:
  - one component IRI per component. A local name resolving to two IRIs
    is the defect the absolute-IRI mechanism exists to prevent, and it is
    invisible to every per-member check (found once already: PresetRegistry,
    split by `constrains` minting locally while `affects` required an IRI).
  - no near-miss component names. An absolute IRI is unchecked, so a typo
    is a valid IRI naming a node nothing else references.

Working directory matters. specl resolves a peer `path:` under
`references:` against the process working directory rather than against
the file declaring it, so every specl invocation here runs from specs/ and
every declared path is written relative to that.

Exits non-zero on any failure. Never pipe this through head/tail: it masks
the exit code.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPECS = ROOT / "specs"
COMPONENT_NS = "https://w3id.org/g3t/components#"


def tool(name: str) -> str:
    """Locate a specl entry point, or explain how to get one."""
    found = shutil.which(name)
    if not found:
        sys.exit(
            f"{name} not found on PATH.\n"
            "  pip install specl==1.0.0   (or `pixi run install-specl`)\n"
            "specl is a CLI with no supported public API, so this script "
            "shells out to it rather than importing it."
        )
    return found


def members() -> list[tuple[str, Path, Path]]:
    """(name, markdown root, turtle output) for every member.

    A member is any markdown file declaring `spec_base` in front matter.
    Companion files carry no front matter by design and are pulled in by
    their root's `companion_files:`, so they are correctly skipped here.

    The member's name comes from its `spec_base`, not from its filename:
    the base is the member's identity and the filename is incidental. That
    keeps `01-functional-views.md`, whose path is load-bearing because 72
    citations point at it, translating to `functional.ttl`.
    """
    out = []
    for md in sorted(SPECS.glob("*.md")) + sorted(SPECS.glob("*/spec.md")):
        head = md.read_text(encoding="utf-8")[:2000]
        m = re.search(r"(?m)^spec_base:\s*\S+/([\w-]+)#\s*$", head)
        if not m:
            if re.search(r"(?m)^spec_base:", head):
                raise SystemExit(
                    f"{md.relative_to(ROOT)}: spec_base must end in "
                    "'/<member>#' so the member name is derivable"
                )
            continue
        name = m.group(1)
        ttl = md.with_name("spec.ttl") if md.name == "spec.md" else SPECS / f"{name}.ttl"
        out.append((name, md, ttl))
    return out


def run(args: list[str]) -> tuple[int, str]:
    p = subprocess.run(args, cwd=SPECS, capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr).strip()


def check_member(name: str, md: Path, ttl: Path, problems: list[str]) -> None:
    translate, validate = tool("specl-translate"), tool("specl-validate")
    rel_md = md.relative_to(SPECS)
    rel_ttl = ttl.relative_to(SPECS)

    # Translate to a temp file and compare, so the gate reports a stale
    # committed .ttl rather than silently rewriting it. The .ttl files are
    # committed because `layering` reads peers' Turtle from disk.
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "out.ttl"
        code, out = run([translate, str(rel_md), str(tmp), "--fail-on-warning"])
        if code != 0:
            problems.append(f"{name}: translate failed\n{out}")
            return
        if not ttl.exists():
            problems.append(f"{name}: {rel_ttl} is missing; run specl-translate")
            return
        if tmp.read_text(encoding="utf-8") != ttl.read_text(encoding="utf-8"):
            problems.append(
                f"{name}: {rel_ttl} is stale. Re-run:\n"
                f"    (cd specs && specl-translate {rel_md} {rel_ttl} --fail-on-warning)"
            )
            return

    code, out = run([validate, "validate", str(rel_ttl)])
    if code != 0:
        problems.append(f"{name}: validate failed\n{out}")

    # 0 pass, 1 references something declared downstream, 3 inconclusive.
    # 3 is work to do, not a pass.
    code, out = run([validate, "layering", str(rel_ttl)])
    if code == 1:
        problems.append(f"{name}: layering violation\n{out}")
    elif code == 3:
        problems.append(f"{name}: layering inconclusive, a peer was unreadable\n{out}")
    elif code != 0:
        problems.append(f"{name}: layering exited {code}\n{out}")


def check_family(ttls: list[Path], problems: list[str]) -> None:
    """Every member passing alone does not mean the family is coherent."""
    try:
        from rdflib import Graph, URIRef
    except ImportError:
        sys.exit("rdflib not found. pip install specl==1.0.0 pulls it in.")

    specl = "https://w3id.org/specl/ns#"
    g = Graph()
    for t in ttls:
        g.parse(t)

    comps: set[str] = set()
    for prop in ("constrains", "affects"):
        comps |= {
            str(o)
            for o in g.objects(None, URIRef(specl + prop))
            if str(o).startswith("http")
        }

    by_name: dict[str, set[str]] = defaultdict(set)
    for c in comps:
        local = re.sub(r"^component-", "", re.split(r"[#/]", c)[-1])
        by_name[local].add(c)

    for local, iris in sorted(by_name.items()):
        if len(iris) > 1:
            problems.append(
                f"family: '{local}' resolves to {len(iris)} IRIs, so one component "
                "is several nodes:\n"
                + "".join(f"        {i}\n" for i in sorted(iris))
                + "        Use the shared namespace in every key that names it."
            )

    shared = sorted(c[len(COMPONENT_NS):] for c in comps if c.startswith(COMPONENT_NS))
    for i, a in enumerate(shared):
        for b in shared[i + 1:]:
            if a.lower() == b.lower() or (
                len(a) == len(b) and sum(x != y for x, y in zip(a, b)) == 1
            ):
                problems.append(
                    f"family: '{a}' and '{b}' differ by one character. An absolute "
                    "IRI is unchecked, so a typo is a valid IRI naming nothing."
                )

    print(
        f"family: {len(g)} triples across {len(ttls)} members, "
        f"{len(shared)} shared components, "
        f"{len(comps) - len(shared)} member-local"
    )


def main() -> int:
    found = members()
    if not found:
        print("no specification members found under specs/", file=sys.stderr)
        return 1

    problems: list[str] = []
    for name, md, ttl in found:
        check_member(name, md, ttl, problems)
    print(f"members: {len(found)} checked ({', '.join(n for n, _, _ in found)})")

    existing = [t for _, _, t in found if t.exists()]
    if len(existing) == len(found):
        check_family(existing, problems)

    if problems:
        print(f"\n{len(problems)} problem(s):\n", file=sys.stderr)
        for p in problems:
            print(f"  {p}\n", file=sys.stderr)
        return 1
    print("specification family clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
