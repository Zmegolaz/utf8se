// Validates the module registry: every tool exposes a well-formed descriptor,
// ids/titles are unique, and categories are covered by CATEGORY_ORDER.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MODULES, CATEGORY_ORDER } from "../../public/js/registry.js";

test("registry is non-empty", () => {
  assert.ok(MODULES.length >= 10);
});

test("each module has the required fields", () => {
  for (const m of MODULES) {
    assert.ok(m.id, "missing id");
    assert.match(m.id, /^[a-z0-9-]+$/, `id not url-safe: ${m.id}`);
    assert.ok(m.title, `missing title: ${m.id}`);
    assert.ok(m.category, `missing category: ${m.id}`);
    assert.ok(m.description, `missing description: ${m.id}`);
    assert.equal(typeof m.mount, "function", `mount not a function: ${m.id}`);
    if ("unmount" in m) assert.equal(typeof m.unmount, "function");
    if ("tags" in m) assert.ok(Array.isArray(m.tags));
  }
});

test("ids and titles are unique", () => {
  const ids = MODULES.map((m) => m.id);
  const titles = MODULES.map((m) => m.title);
  assert.equal(new Set(ids).size, ids.length, "duplicate id");
  assert.equal(new Set(titles).size, titles.length, "duplicate title");
});

test("every module category is listed in CATEGORY_ORDER", () => {
  for (const m of MODULES) {
    assert.ok(CATEGORY_ORDER.includes(m.category), `category not ordered: ${m.category}`);
  }
});

test("no descriptions contain em/en dashes or ellipsis characters", () => {
  // Project style: plain ASCII punctuation only.
  for (const m of MODULES) {
    assert.ok(!/[–—…]/.test(m.description), `fancy punctuation in ${m.id} description`);
  }
});
