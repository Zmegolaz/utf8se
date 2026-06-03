#!/usr/bin/env python3
"""Generate the character dataset used by the Character Picker module.

Runs at build time only (NOT a runtime backend). Reads the bundled Unicode
Blocks.txt / Scripts.txt and Python's own `unicodedata` to emit a compact
JSON file consumed entirely in the browser.

Output: public/data/characters.json

    {
      "unicodeVersion": "16.0.0",
      "categories": {"Lu": "Uppercase Letter", ...},
      "scripts":    ["Common", "Latin", ...],
      "blocks":     ["Basic Latin", ...],
      "chars":      [[codepoint, name, gcIdx, scriptIdx, blockIdx], ...],
      "ranges":     [[startCp, endCp, "NAME TEMPLATE-{X}", gcIdx, scriptIdx, blockIdx], ...]
    }

Formulaic mega-blocks (CJK ideographs, Hangul syllables, Tangut, ...) whose
names are just "<PREFIX>-<HEX>" are collapsed into `ranges` so the file stays
small; the client expands them on demand.
"""
import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "data", "characters.json")

# Long names for Unicode general categories (TR44).
CATEGORY_NAMES = {
    "Lu": "Uppercase Letter", "Ll": "Lowercase Letter", "Lt": "Titlecase Letter",
    "Lm": "Modifier Letter", "Lo": "Other Letter",
    "Mn": "Nonspacing Mark", "Mc": "Spacing Combining Mark", "Me": "Enclosing Mark",
    "Nd": "Decimal Number", "Nl": "Letter Number", "No": "Other Number",
    "Pc": "Connector Punctuation", "Pd": "Dash Punctuation", "Ps": "Open Punctuation",
    "Pe": "Close Punctuation", "Pi": "Initial Punctuation", "Pf": "Final Punctuation",
    "Po": "Other Punctuation",
    "Sm": "Math Symbol", "Sc": "Currency Symbol", "Sk": "Modifier Symbol", "So": "Other Symbol",
    "Zs": "Space Separator", "Zl": "Line Separator", "Zp": "Paragraph Separator",
    "Cc": "Control", "Cf": "Format", "Cs": "Surrogate", "Co": "Private Use", "Cn": "Unassigned",
}


def parse_ranges(path):
    """Parse a UCD file of `START..END; VALUE` lines into a list sorted by start."""
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
    """Binary-ish lookup of cp in a sorted (start, end, value) list."""
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


# Mega-blocks whose names are purely formulaic "<PREFIX>-<HEX>".
# We collapse these into range records instead of listing every code point.
FORMULAIC = [
    (0x3400, 0x4DBF, "CJK UNIFIED IDEOGRAPH-{X}"),
    (0x4E00, 0x9FFF, "CJK UNIFIED IDEOGRAPH-{X}"),
    (0xAC00, 0xD7A3, None),  # Hangul syllables: algorithmic name, handle specially
    (0xF900, 0xFA6D, "CJK COMPATIBILITY IDEOGRAPH-{X}"),
    (0x17000, 0x187FF, "TANGUT IDEOGRAPH-{X}"),
    (0x18D00, 0x18D08, "TANGUT IDEOGRAPH-{X}"),
    (0x1B170, 0x1B2FB, "NUSHU CHARACTER-{X}"),
    (0x20000, 0x2A6DF, "CJK UNIFIED IDEOGRAPH-{X}"),
    (0x2A700, 0x2EE5D, "CJK UNIFIED IDEOGRAPH-{X}"),
    (0x2F800, 0x2FA1D, "CJK COMPATIBILITY IDEOGRAPH-{X}"),
    (0x30000, 0x3134A, "CJK UNIFIED IDEOGRAPH-{X}"),
    (0x31350, 0x323AF, "CJK UNIFIED IDEOGRAPH-{X}"),
]


def is_formulaic(cp):
    for start, end, _ in FORMULAIC:
        if start <= cp <= end:
            return True
    return False


def main():
    blocks = parse_ranges(os.path.join(HERE, "Blocks.txt"))
    scripts = parse_ranges(os.path.join(HERE, "Scripts.txt"))

    cat_index = {}
    script_index = {}
    block_index = {}

    def idx(table, key):
        if key not in table:
            table[key] = len(table)
        return table[key]

    chars = []
    for cp in range(0, 0x110000):
        if 0xD800 <= cp <= 0xDFFF:  # surrogates
            continue
        if is_formulaic(cp):
            continue
        try:
            name = unicodedata.name(chr(cp))
        except ValueError:
            continue
        gc = unicodedata.category(chr(cp))
        sc = lookup(scripts, cp, "Unknown")
        bl = lookup(blocks, cp, "No_Block")
        chars.append([cp, name, idx(cat_index, gc), idx(script_index, sc), idx(block_index, bl)])

    ranges = []
    for start, end, template in FORMULAIC:
        # Skip ranges with no assigned/named characters in this Unicode version.
        if not any(_named(cp) for cp in (start, end, (start + end) // 2)):
            # still emit; the block exists even if our unicodedata is older
            pass
        gc = unicodedata.category(chr(start)) if _named(start) else "Lo"
        sc = lookup(scripts, start, "Unknown")
        bl = lookup(blocks, start, "No_Block")
        tmpl = template if template else "HANGUL SYLLABLE"
        ranges.append([start, end, tmpl, idx(cat_index, gc), idx(script_index, sc), idx(block_index, bl)])

    def invert(table):
        out = [None] * len(table)
        for k, v in table.items():
            out[v] = k
        return out

    categories = {gc: CATEGORY_NAMES.get(gc, gc) for gc in cat_index}

    data = {
        "unicodeVersion": unicodedata.unidata_version,
        "categories": categories,
        "categoryOrder": invert(cat_index),
        "scripts": invert(script_index),
        "blocks": invert(block_index),
        "chars": chars,
        "ranges": ranges,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    size = os.path.getsize(OUT)
    print(f"Unicode {data['unicodeVersion']}")
    print(f"  chars : {len(chars):,}")
    print(f"  ranges: {len(ranges)}")
    print(f"  scripts: {len(script_index)}  blocks: {len(block_index)}  categories: {len(cat_index)}")
    print(f"  output: {OUT} ({size/1024/1024:.2f} MB)")


def _named(cp):
    try:
        unicodedata.name(chr(cp))
        return True
    except ValueError:
        return False


if __name__ == "__main__":
    main()