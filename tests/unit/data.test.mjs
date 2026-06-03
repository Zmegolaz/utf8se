// Validates the generated datasets shipped under public/data/. These guard the
// build output regardless of which machine produced it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "data");
const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

test("characters.json has the expected shape", () => {
  const d = load("characters.json");
  for (const key of ["unicodeVersion", "categories", "categoryOrder", "scripts", "blocks", "chars", "ranges"]) {
    assert.ok(key in d, `missing ${key}`);
  }
  assert.match(d.unicodeVersion, /^\d+\.\d+\.\d+$/);
  assert.ok(d.chars.length > 30000, `surprisingly few chars: ${d.chars.length}`);
});

test("characters.json entries are well-formed", () => {
  const d = load("characters.json");
  const nCat = d.categoryOrder.length, nScript = d.scripts.length, nBlock = d.blocks.length;
  for (const [cp, name, gc, sc, bl] of d.chars) {
    assert.ok(Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff, `bad cp ${cp}`);
    assert.ok(!(cp >= 0xd800 && cp <= 0xdfff), `surrogate leaked: ${cp}`);
    assert.ok(typeof name === "string" && name.length > 0);
    assert.ok(gc >= 0 && gc < nCat && sc >= 0 && sc < nScript && bl >= 0 && bl < nBlock, `index out of range for ${name}`);
  }
});

test("characters.json category indices resolve to long names", () => {
  const d = load("characters.json");
  for (const code of d.categoryOrder) assert.ok(code in d.categories, `category ${code} missing long name`);
});

test("characters.json formulaic ranges are valid and not double-listed", () => {
  const d = load("characters.json");
  const single = new Set(d.chars.map((c) => c[0]));
  for (const [start, end, template, gc, sc, bl] of d.ranges) {
    assert.ok(start <= end && typeof template === "string");
    assert.ok(gc >= 0 && sc >= 0 && bl >= 0);
    assert.ok(!single.has(start), `range start ${start} also listed individually`);
  }
  // CJU ideograph block start should be covered by a range, not the flat list
  assert.ok(!single.has(0x4e00), "U+4E00 should be in a range");
});

test("homoglyphs.json has the expected shape", () => {
  const d = load("homoglyphs.json");
  for (const key of ["confusablesVersion", "unicodeVersion", "scripts", "entries"]) {
    assert.ok(key in d, `missing ${key}`);
  }
  assert.ok(d.entries.length > 1000, `surprisingly few entries: ${d.entries.length}`);
});

test("every homoglyph folds a non-ASCII source to printable ASCII", () => {
  const d = load("homoglyphs.json");
  const seen = new Set();
  for (const [cp, ascii, sidx, name] of d.entries) {
    assert.ok(cp >= 0x80, `source ${cp} is ASCII, should not be a homoglyph entry`);
    assert.ok(ascii.length >= 1, `empty skeleton for ${name}`);
    for (const c of ascii) {
      const o = c.codePointAt(0);
      assert.ok(o >= 0x21 && o <= 0x7e, `skeleton "${ascii}" not printable ASCII (${name})`);
    }
    assert.ok(sidx >= 0 && sidx < d.scripts.length, `bad script index for ${name}`);
    assert.ok(typeof name === "string" && name.length > 0);
    assert.ok(!seen.has(cp), `duplicate source codepoint ${cp}`);
    seen.add(cp);
  }
});

test("homoglyph dataset includes the classic Cyrillic spoofs", () => {
  const d = load("homoglyphs.json");
  const map = new Map(d.entries.map((e) => [e[0], e[1]]));
  assert.equal(map.get(0x0430), "a", "Cyrillic а should fold to a");
  assert.equal(map.get(0x0440), "p", "Cyrillic р should fold to p");
  assert.equal(map.get(0x03bf), "o", "Greek ο should fold to o");
});
