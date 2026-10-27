"""Build the static site uploaded to GitHub Pages."""

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build_pages(output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / "templates" / "index.html", output / "index.html")
    shutil.copytree(
        ROOT / "static",
        output / "static",
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(".DS_Store"),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "site")
    build_pages(parser.parse_args().output)
