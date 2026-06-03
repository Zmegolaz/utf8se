// Unit tests for the shared fancy-text transforms, including the tricky
// Letterlike-Symbols "holes" in the mathematical alphabets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { STYLES, CONFUSABLE, ALL_STYLES, styleById, zalgo } from "../../public/js/lib/fancy-text.js";

test("bold maps letters and digits algorithmically", () => {
  assert.equal(styleById("bold").convert("AB ab 09"), "𝐀𝐁 𝐚𝐛 𝟎𝟗");
});

test("script fills its Letterlike-Symbols holes", () => {
  // B,E,F,H,I,L,M,R,e,g,o are reserved and filled from U+21xx
  assert.equal(styleById("script").convert("BEFHILMRego"), "ℬℰℱℋℐℒℳℛℯℊℴ");
});

test("fraktur fills its holes", () => {
  assert.equal(styleById("fraktur").convert("CHIRZ"), "ℭℌℑℜℨ");
});

test("double-struck fills its holes", () => {
  assert.equal(styleById("double").convert("CHNPQRZ"), "ℂℍℕℙℚℝℤ");
});

test("italic h uses the Planck-constant hole", () => {
  assert.equal(styleById("italic").convert("h"), "ℎ");
});

test("fullwidth converts ascii and space", () => {
  assert.equal(styleById("fullwidth").convert("A 1"), "Ａ　１");
});

test("confusable maps latin to look-alikes and is reversible-ish in shape", () => {
  const out = CONFUSABLE.convert("cap");
  assert.notEqual(out, "cap", "should substitute look-alikes");
  // 'a' -> Cyrillic а (U+0430), 'p' -> Cyrillic р (U+0440)
  assert.ok(out.includes("а"));
  assert.ok(out.includes("р"));
});

test("unmapped characters pass through unchanged", () => {
  assert.equal(styleById("bold").convert("!@#"), "!@#");
});

test("every style has id, label and a working convert()", () => {
  for (const s of ALL_STYLES) {
    assert.ok(s.id && s.label, `style missing id/label: ${JSON.stringify(s)}`);
    assert.equal(typeof s.convert, "function");
    assert.equal(typeof s.convert("Test 1"), "string");
  }
});

test("style ids are unique", () => {
  const ids = ALL_STYLES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("zalgo adds combining marks but keeps base characters", () => {
  const z = zalgo("hi", 5);
  assert.ok(z.length > 2, "should add marks");
  assert.ok(/[̀-ͯ]/.test(z), "should contain combining diacritics");
  assert.equal([...z].filter((c) => c === "h" || c === "i").join(""), "hi");
});

test("STYLES is non-empty and excludes CONFUSABLE", () => {
  assert.ok(STYLES.length >= 12);
  assert.ok(!STYLES.some((s) => s.id === "confusable"));
});
