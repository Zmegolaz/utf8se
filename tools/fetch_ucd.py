#!/usr/bin/env python3
"""Download (refresh) the Unicode source files the dataset generators depend on.

Maintenance helper, not a runtime backend. Fetches the three files that
`gen_chardata.py` and `gen_homoglyphs.py` read:

    tools/Blocks.txt        (UCD)
    tools/Scripts.txt       (UCD)
    tools/confusables.txt   (UTS #39 / security)

then, unless told otherwise, re-runs both generators so public/data/*.json is
refreshed in one step.

--------------------------------------------------------------------------------
THE UNICODE VERSION CAVEAT (16 vs 17)
--------------------------------------------------------------------------------
The *effective* Unicode version of the generated JSON is set by the Python
build's bundled `unicodedata`, NOT by these .txt files. The generators only emit
characters that `unicodedata.name()` knows, so anything newer than the running
Python's Unicode version is silently skipped (its block/script ranges simply go
unused).

Therefore this script DEFAULTS to the version matching the running Python
(`unicodedata.unidata_version`) so the source files and the generated data stay
in lock-step. To truly move to a newer Unicode version you must bump BOTH the
files (here) AND the Python you generate with:

    Python 3.12 -> Unicode 15.1   |   Python 3.14 -> Unicode 16.0

Examples:
    python3 tools/fetch_ucd.py                  # match this Python (recommended)
    python3 tools/fetch_ucd.py --version 16.0.0 # pin explicitly
    python3 tools/fetch_ucd.py --latest         # newest published (may outpace Python)
    python3 tools/fetch_ucd.py --dry-run        # inspect versions, write nothing
    python3 tools/fetch_ucd.py --no-generate    # refresh .txt only, don't regenerate
"""
import argparse
import os
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
TIMEOUT = 20  # seconds per download

# (filename, url-template). {ver} is the pinned version; {ucd}/{sec} switch to
# the rolling "latest" paths when --latest is used.
SOURCES = [
    ("Blocks.txt", "https://www.unicode.org/Public/{ucd}/Blocks.txt"),
    ("Scripts.txt", "https://www.unicode.org/Public/{ucd}/Scripts.txt"),
    ("confusables.txt", "https://www.unicode.org/Public/security/{sec}/confusables.txt"),
]


def resolve_paths(version, latest):
    """Return {filename: url} for the chosen version (or the latest channel)."""
    ucd = "UCD/latest/ucd" if latest else f"{version}/ucd"
    sec = "latest" if latest else version
    return {name: tmpl.format(ucd=ucd, sec=sec) for name, tmpl in SOURCES}


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": "utf8se-fetch-ucd"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status}")
        return resp.read()


def header_line(text):
    """Pull the most informative version/date line from a UCD file header,
    preferring an explicit Version, then a Date, then the `<name>.txt` line."""
    head = [ln.lstrip("# ").strip() for ln in text.splitlines()[:12]]
    head = [s for s in head if s]
    for pred in (
        lambda s: s.lower().startswith("version"),
        lambda s: s.startswith("Date:"),
        lambda s: s.endswith(".txt"),
    ):
        for s in head:
            if pred(s):
                return s
    return "(no version header found)"


def run_generators():
    for script in ("gen_chardata.py", "gen_homoglyphs.py"):
        print(f"\n$ python3 tools/{script}")
        subprocess.run([sys.executable, os.path.join(HERE, script)], check=True)


def main():
    py_ver = unicodedata.unidata_version

    parser = argparse.ArgumentParser(
        description="Refresh the Unicode source files used by the dataset generators.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="By default fetches Unicode %s (this Python's unicodedata) and regenerates the datasets." % py_ver,
    )
    g = parser.add_mutually_exclusive_group()
    g.add_argument("--version", metavar="X.Y.Z", help="pin a specific Unicode version (default: %s, matching this Python)" % py_ver)
    g.add_argument("--latest", action="store_true", help="use the rolling /latest/ release (may be newer than this Python knows)")
    parser.add_argument("--dry-run", action="store_true", help="download to a temp dir, report versions, write nothing, run no generators")
    parser.add_argument("--no-generate", action="store_true", help="refresh the .txt files but do not run the generators")
    args = parser.parse_args()

    version = args.version or py_ver
    urls = resolve_paths(version, args.latest)
    label = "latest" if args.latest else version

    print(f"Fetching Unicode source files ({label}) ...")
    print(f"This Python's unicodedata: {py_ver}\n", flush=True)

    # Download everything into memory first so a failure never leaves the
    # tools/ directory half-updated (atomic-ish).
    blobs = {}
    for name, url in urls.items():
        try:
            blobs[name] = download(url)
        except Exception as e:  # noqa: BLE001 - report any network/HTTP failure plainly
            print(f"  ERROR  {name}: {e}", file=sys.stderr)
            print(f"         {url}", file=sys.stderr)
            if name == "confusables.txt" and not args.latest:
                print(
                    "         The UTS #39 security snapshot for this version may not be\n"
                    "         published yet (it can lag the UCD). Try --latest, or pin a\n"
                    "         version that has a security release.",
                    file=sys.stderr,
                )
            print("\nAborted; tools/ left unchanged.", file=sys.stderr)
            return 1

    dest_dir = tempfile.mkdtemp(prefix="ucd-") if args.dry_run else HERE
    for name, data in blobs.items():
        text = data.decode("utf-8", errors="replace")
        with open(os.path.join(dest_dir, name), "wb") as f:
            f.write(data)
        print(f"  ok  {name:16} {len(data)//1024:>5} KB   {header_line(text)}")

    if args.dry_run:
        print(f"\n[dry-run] wrote nothing to tools/ (temp copies in {dest_dir}).")

    # Surface the caveat at runtime when the chosen version can't be fully
    # realised by this Python.
    if not args.latest and args.version and args.version != py_ver:
        print(
            f"\nWARNING: you requested Unicode {args.version}, but this Python's unicodedata is {py_ver}.\n"
            f"         The generated data will be capped at {py_ver}; characters new in {args.version}\n"
            f"         have no names here and will be skipped. Generate with a matching Python to use them.",
            file=sys.stderr,
        )
    if args.latest and not args.dry_run:
        print(
            f"\nNote: --latest may fetch a Unicode version newer than this Python ({py_ver}).\n"
            f"      Generated data stays capped at {py_ver} until you also upgrade Python.",
            file=sys.stderr,
        )

    if args.dry_run:
        return 0

    if args.no_generate:
        print("\nFiles refreshed. Skipping regeneration (--no-generate). Next:")
        print("  python3 tools/gen_chardata.py && python3 tools/gen_homoglyphs.py")
        return 0

    run_generators()
    print("\nDone. Verify with:  npm run test:unit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
