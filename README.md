# utf8.se, the UTF-8 toolbox

A modular collection of browser-based UTF-8 / Unicode tools, generators and
quirky experiments. **Everything runs client-side**, no backend, no network
calls, no tracking. The only server-side code is a build-time Python script that
generates the character database from Python's `unicodedata`.

Everything a browser needs lives in **`public/`**, point any static web server
at that folder and you're done. The repo root holds only things clients never
see (the build script, source data, docs).

## Tools

**Developer Tools**
- **Character Picker**, search 150k+ characters by name, filter by general
  category, or browse by script ("language"). Click to copy. Shows UTF-8 bytes,
  HTML entity and JS escape for each character.
- **Byte-length Calculator**, UTF-8 / UTF-16 / UTF-32 byte counts, code points
  and grapheme clusters, plus a VARCHAR / byte-budget field-limit checker.
- **UTF-8 Validator**, paste hex, base64 or text and get a byte-level verdict,
  pinpointing the first invalid byte (overlong, truncated, surrogate, ...).
- **Invisible Character Detector**, reveal zero-width spaces, soft hyphens, bidi
  marks, BOMs and other hidden characters in copy-pasted text, with a one-click
  "strip hidden" cleanup.
- **Homoglyph Finder**, detect look-alike characters used to spoof URLs and
  usernames (Cyrillic 'а' posing as Latin 'a'), warn on mixed-script strings, and
  fold the text back to ASCII. Pick an expected language so its own letters
  (e.g. Swedish å ä ö, Turkish ı) are kept as legitimate, or filter per script.
- **Unicode Diff**, compare two strings that look identical but aren't; shows a
  code-point diff, normalization equivalence (NFC/NFD/NFKC/NFKD), and labels each
  difference (invisible? homoglyph? combining mark?).

**Generators**
- **Look-alike Text Writer**, rewrite text with mathematical "fonts",
  full-width, small caps, mirror text, Zalgo, and deceptive mixed-script
  homoglyphs.
- **Ancient-Script Lorem Ipsum**, placeholder text in Cuneiform, Linear B,
  Ogham, Runic, Egyptian Hieroglyphs and other rare scripts.
- **Unicode Art Generator**, turn an uploaded image into ASCII / shading-block /
  Braille art entirely on a `<canvas>`; the image never leaves the browser.

**Fun & Quirky**
- **Written in the Old Tongues**, a page rendered entirely in unusual Unicode
  scripts, with a live style switcher.

## Architecture

No build step, no framework. Plain ES modules + hash-based routing.

```
public/                 ← the web root; serve THIS folder
  index.html            app shell
  css/main.css          single global stylesheet (CSS variables, dark theme)
  js/
    app.js              router, categorized menu, home page
    registry.js         the list of modules + category order   ← edit to add tools
    lib/
      dom.js            tiny DOM/clipboard/format helpers
      fancy-text.js     Unicode "styled text" transforms (shared)
      invisibles.js     curated invisible/format/bidi character table (shared)
      homoglyphs.js     lazy loader for the homoglyph dataset (shared)
    modules/            one file per tool, each default-exports a descriptor
  data/
    characters.json     generated Unicode dataset (see below)
    homoglyphs.json     generated UTS #39 homoglyph map (see below)

tools/                  ← build-time only, never served
  fetch_ucd.py          download/refresh the source files below + regenerate
  gen_chardata.py       Unicode dataset generator (Python)
  gen_homoglyphs.py     homoglyph dataset generator (Python)
  Blocks.txt, Scripts.txt, confusables.txt   UCD / UTS #39 source data

tests/
  unit/                 Node test-runner: syntax, transforms, data, registry
  e2e/                  Playwright: route smoke tests + per-tool behaviour
  python/               unittest: generator helper functions
.github/workflows/ci.yml   GitHub Actions: unit + python + e2e jobs
package.json            dev dependency (@playwright/test) + test scripts
README.md
```

### Adding a new tool

1. Create `public/js/modules/my-tool.js` that default-exports a descriptor:

   ```js
   import { el, h } from "../lib/dom.js";

   export default {
     id: "my-tool",                 // unique; becomes the URL hash #/my-tool
     title: "My Tool",
     category: "Developer Tools",   // groups it in the menu + home page
     icon: "🛠️",
     description: "One-line summary.",
     tags: ["keyword", "search"],   // optional, improves menu search
     mount(root) {                  // render your UI into `root` (may be async)
       root.appendChild(h.p({ text: "Hello!" }));
     },
     unmount() {},                  // optional cleanup on navigation
   };
   ```

2. Import it in `public/js/registry.js` and add it to the `MODULES` array.

That's it, the menu entry, routing and home-page card are automatic. New
categories appear automatically; add them to `CATEGORY_ORDER` in `registry.js`
to control ordering.

## Running locally

`fetch()` is blocked on `file://`, so serve over HTTP:

```sh
python3 -m http.server 8765 --directory public
# open http://localhost:8765/
```

## Testing

Three suites, all run in CI (`.github/workflows/ci.yml`) on every push and pull
request:

| Suite | Runner | Covers |
|-------|--------|--------|
| `tests/unit/` | Node's built-in test runner | `node --check` syntax of every browser JS file, fancy-text transforms (incl. the Letterlike-Symbols holes), dataset invariants, registry/module descriptor validity |
| `tests/e2e/` | [Playwright](https://playwright.dev) (Chromium) | every route renders with no console errors (routes derived from the registry), plus per-tool behaviour (search, validation, homoglyph folding, NFC diff, image -> art, ...) |
| `tests/python/` | Python `unittest` | the generators' helper logic (range parsing, skeleton resolution, confusables parsing) |

Requirements: **Node 20+** and **Python 3.11+**. Then:

```sh
npm install                      # installs @playwright/test
npx playwright install chromium  # one-time, downloads an isolated browser

npm run test:unit   # Node unit tests (no browser)
npm run test:py     # Python generator tests
npm run test:e2e    # Playwright e2e (auto-starts the static server)
npm run test:all    # all three
```

`pip install -r requirements.txt` is a no-op (the Python code is standard-library
only) but is included so the documented/CI steps are uniform.

## Regenerating the datasets

Both JSON files under `public/data/` are produced by build-time Python scripts
(not a runtime backend). Rebuild them after a Unicode version bump:

```sh
python3 tools/gen_chardata.py     # -> public/data/characters.json
python3 tools/gen_homoglyphs.py   # -> public/data/homoglyphs.json
```

**`characters.json`** comes from Python's bundled Unicode data plus the UCD
`Blocks.txt` / `Scripts.txt`. Formulaic mega-blocks (CJK ideographs, Hangul
syllables, Tangut, ...) are stored as ranges and expanded in the browser,
keeping the file at ~1.7 MB (~0.25 MB gzipped) for ~38.7k named characters.

**`homoglyphs.json`** comes from Unicode UTS #39 `confusables.txt`. The script
resolves each confusable's skeleton and keeps only those that fold to printable
ASCII, annotating each with its script (for per-language filtering) and name.
That security-relevant subset is ~1,837 entries (~83 KB, ~17 KB gzipped).

### Updating the Unicode source data

The generators read three committed snapshots in `tools/` (`Blocks.txt`,
`Scripts.txt`, `confusables.txt`) so builds are offline and deterministic.
`tools/fetch_ucd.py` refreshes them and regenerates the datasets in one step:

```sh
python3 tools/fetch_ucd.py                  # match this Python's Unicode version (recommended)
python3 tools/fetch_ucd.py --version 16.0.0 # pin a specific version
python3 tools/fetch_ucd.py --latest         # newest published (may outpace Python; see below)
python3 tools/fetch_ucd.py --dry-run        # inspect versions, write nothing
python3 tools/fetch_ucd.py --no-generate    # refresh .txt only, skip regeneration
```

Note: the UTS #39 security file (`confusables.txt`) is versioned separately from
the UCD and its per-version snapshot can lag, so a pinned `--version` newer than
the latest security release may 404 on that one file (use `--latest`).

### Unicode version: the 16 vs 17 caveat

The **effective Unicode version of the generated data is set by the Python
build's bundled `unicodedata`, not by the `.txt` files.** The generators only
emit characters that `unicodedata.name()` knows, so anything newer than the
running Python's Unicode version is silently skipped (its block/script ranges go
unused). To genuinely move to a newer Unicode version you must bump **both** the
source files and the Python you generate with:

| Python | bundled `unicodedata` |
|--------|-----------------------|
| 3.12   | Unicode 15.1          |
| 3.14   | Unicode 16.0          |

`fetch_ucd.py` therefore defaults to your Python's version so the two stay
consistent, and warns if you pin a version your Python can't fully realise.

Current committed state: the `.txt` files are **17.0.0** (fetched from
`/latest/`), but the data was generated with Python 3.14 (`unicodedata` 16.0.0),
so `characters.json` / `homoglyphs.json` are effectively **Unicode 16.0.0**.
Running `python3 tools/fetch_ucd.py` with no arguments would re-pin everything to
a consistent 16.0.0.

## Privacy

There are no analytics, cookies, or outbound requests. Uploaded images are
processed in-memory on a canvas and never transmitted.
