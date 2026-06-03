// Lazy loader for the generated homoglyph dataset (public/data/homoglyphs.json,
// built by tools/gen_homoglyphs.py from Unicode UTS #39 confusables). Cached
// across mounts and shared between the Homoglyph Finder and Unicode Diff tools.

const URL = "data/homoglyphs.json";
let DATA = null;
let promise = null;

export function loadHomoglyphs() {
  if (DATA) return Promise.resolve(DATA);
  if (!promise) {
    promise = fetch(URL)
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((d) => {
        // cp -> { ascii, script, name }
        d.map = new Map();
        for (const [cp, ascii, sidx, name] of d.entries) {
          d.map.set(cp, { ascii, script: d.scripts[sidx], name });
        }
        DATA = d;
        return d;
      });
  }
  return promise;
}

// Synchronous accessor, returns the cached dataset or null if not yet loaded.
export function homoglyphsIfLoaded() {
  return DATA;
}
