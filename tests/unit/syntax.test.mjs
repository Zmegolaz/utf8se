// Syntax-checks every browser JS file with `node --check`. Mirrors the manual
// `node --check` sweeps used during development.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const JS_DIR = join(ROOT, "public", "js");

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

const files = walk(JS_DIR);

test("there are JS files to check", () => {
  assert.ok(files.length >= 10, `expected the source tree, found ${files.length} files`);
});

for (const file of files) {
  test(`node --check ${file.slice(ROOT.length + 1)}`, () => {
    // throws (non-zero exit) on a syntax error
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  });
}
