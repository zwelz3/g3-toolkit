#!/usr/bin/env python3
"""Cross-platform Sphinx build script.

Copies specs/, research/, and planning/ into docs/source/ so Sphinx can
find them (symlinks don't work on Windows), runs sphinx-build, then
cleans up the copies.

Usage:
    python scripts/build_docs.py [sphinx-build args...]
    python scripts/build_docs.py                        # defaults to: -b html docs/source docs/build/html
    python scripts/build_docs.py -b singlehtml docs/source docs/build/singlehtml
"""

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "source"

COPY_DIRS = ["specs", "research", "planning"]


def main():
    copies = []

    try:
        # Copy content directories into docs/source/
        for name in COPY_DIRS:
            src = ROOT / name
            dst = SOURCE / name
            if src.is_dir():
                if dst.exists():
                    shutil.rmtree(dst)
                shutil.copytree(src, dst)
                copies.append(dst)

        # Run sphinx-build with provided args or defaults
        if len(sys.argv) > 1:
            cmd = ["sphinx-build"] + sys.argv[1:]
        else:
            cmd = [
                "sphinx-build",
                "-b", "html",
                str(SOURCE),
                str(ROOT / "docs" / "build" / "html"),
            ]

        result = subprocess.run(cmd, cwd=str(ROOT))
        sys.exit(result.returncode)

    finally:
        # Clean up copies so they don't pollute the repo
        for dst in copies:
            if dst.exists():
                shutil.rmtree(dst)


if __name__ == "__main__":
    main()
