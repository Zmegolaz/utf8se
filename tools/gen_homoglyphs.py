#!/usr/bin/env python3
"""Generate the homoglyph dataset used by the Homoglyph Finder module.

Build-time only (NOT a runtime backend). Reads Unicode's UTS #39
`confusables.txt` plus the bundled `Scripts.txt`, and emits a compact JSON map
of *non-ASCII characters that look like ASCII* → the ASCII they imitate. Used in
the browser to detect and optionally fold spoofed text.

Output: public/data/homoglyphs.json

    {
      "confusablesVersion": "17.0.0",
      "unicodeVersion": "16.0.0",
      "scripts": ["Cyrillic", "Greek", ...],
      "entries": [[srcCodePoint, "asciiSkeleton", scriptIdx, "SOURCE NAME", semantic], ...]
    }

`asciiSkeleton` is the printable-ASCII string the source folds to per UTS #39
(usually one char, occasionally several, e.g. the ﬁ ligature -> "fi"). This is
a *visual/security* mapping: chosen by the Unicode Consortium for what a
character could be mistaken for, not what it "is". Only sources whose
fully-resolved skeleton is pure printable ASCII are included, which keeps the
file to the security-relevant subset and the size small.

`semantic` is a second, independent mapping: the character's own NFKC
compatibility decomposition, when that decomposition is itself pure printable
ASCII, else null. This captures "what the character actually represents" for
styled/compatibility variants (e.g. MATHEMATICAL MONOSPACE DIGIT ONE -> "1",
not the visual-collision "l" that UTS #39 uses), and is null for characters
with no such identity, e.g. genuine other-script letters like Cyrillic а,
which don't decompose to "a", they're just a different letter that looks
alike.
"""
import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "data", "homoglyphs.json")

ASCII_LO, ASCII_HI = 0x21, 0x7E  # printable ASCII, excluding space


def parse_ranges(path):
    """Parse a UCD `START..END; VALUE` file into a sorted (start, end, value) list."""
    out = []
    line_re = re.compile(r"^([0-9A-Fa-f]+)(?:\.\.([0-9A-Fa-f]+))?\s*;\s*([^#]+)")
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = line_re.match(line)
            if not m:
                continue
            start = int(m.group(1), 16)
            end = int(m.group(2), 16) if m.group(2) else start
            out.append((start, end, m.group(3).strip()))
    out.sort()
    return out


def lookup(ranges, cp, default):
    lo, hi = 0, len(ranges) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        start, end, val = ranges[mid]
        if cp < start:
            hi = mid - 1
        elif cp > end:
            lo = mid + 1
        else:
            return val
    return default


def parse_confusables(path):
    """source codepoint -> list of target codepoints (its prototype sequence)."""
    mapping = {}
    version = "unknown"
    line_re = re.compile(r"^([0-9A-Fa-f]+)\s*;\s*([0-9A-Fa-f ]+);")
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("# Version:"):
                version = line.split(":", 1)[1].strip()
            if not line or line.startswith("#"):
                continue
            m = line_re.match(line)
            if not m:
                continue
            src = int(m.group(1), 16)
            targets = [int(t, 16) for t in m.group(2).split()]
            mapping[src] = targets
    return mapping, version


def resolve_skeleton(cp, mapping, cache, stack):
    """Fully resolve a code point to its skeleton string (following the mapping
    transitively). Guards against cycles."""
    if cp in cache:
        return cache[cp]
    if cp in stack:  # cycle: treat as itself
        return chr(cp)
    if cp not in mapping:
        return chr(cp)
    stack.add(cp)
    out = "".join(resolve_skeleton(t, mapping, cache, stack) for t in mapping[cp])
    stack.discard(cp)
    cache[cp] = out
    return out


def main():
    mapping, conf_version = parse_confusables(os.path.join(HERE, "confusables.txt"))
    scripts = parse_ranges(os.path.join(HERE, "Scripts.txt"))

    cache = {}
    script_index = {}

    def sidx(name):
        if name not in script_index:
            script_index[name] = len(script_index)
        return script_index[name]

    entries = []
    for src in sorted(mapping):
        if ASCII_LO <= src <= ASCII_HI or src < 0x80:
            continue  # source is already ASCII; nothing to fold
        skel = resolve_skeleton(src, mapping, cache, set())
        if not skel:
            continue
        if not all(ASCII_LO <= ord(c) <= ASCII_HI for c in skel):
            continue  # doesn't fold to pure printable ASCII
        try:
            name = unicodedata.name(chr(src))
        except ValueError:
            continue  # skip unnamed/unassigned in our Unicode version
        script = lookup(scripts, src, "Unknown")
        nfkc = unicodedata.normalize("NFKC", chr(src))
        semantic = nfkc if nfkc != chr(src) and all(ASCII_LO <= ord(c) <= ASCII_HI for c in nfkc) else None
        entries.append([src, skel, sidx(script), name, semantic])

    def invert(table):
        out = [None] * len(table)
        for k, v in table.items():
            out[v] = k
        return out

    data = {
        "confusablesVersion": conf_version,
        "unicodeVersion": unicodedata.unidata_version,
        "scripts": invert(script_index),
        "entries": entries,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    size = os.path.getsize(OUT)
    by_script = {}
    for e in entries:
        by_script[data["scripts"][e[2]]] = by_script.get(data["scripts"][e[2]], 0) + 1
    top = sorted(by_script.items(), key=lambda kv: -kv[1])[:8]
    print(f"confusables {conf_version} / Unicode {data['unicodeVersion']}")
    print(f"  entries: {len(entries):,}  scripts: {len(script_index)}")
    print(f"  top scripts: {', '.join(f'{k}={v}' for k, v in top)}")
    print(f"  output: {OUT} ({size/1024:.1f} KB)")


if __name__ == "__main__":
    main()
