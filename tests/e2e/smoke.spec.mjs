// Smoke test: every route renders its header and produces no console errors or
// uncaught exceptions. Routes are derived from the real registry, so a new tool
// is covered automatically.
import { test, expect } from "@playwright/test";
import { MODULES } from "../../public/js/registry.js";

function trackErrors(page) {
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push("console: " + msg.text()); });
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  return errors;
}

test("home page renders the hero and a card per module", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/");
  await expect(page.locator(".hero h1")).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(MODULES.length);
  expect(errors, errors.join("\n")).toEqual([]);
});

for (const m of MODULES) {
  test(`#/${m.id} renders "${m.title}" with no console errors`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/#/${m.id}`);
    await expect(page.locator(".view-head h1")).toContainText(m.title);
    // Data-backed tools (char-picker, homoglyph-finder, unicode-diff) fetch JSON
    // on mount; wait for the network to settle so late errors are caught too.
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".module-root")).not.toBeEmpty();
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("unknown route shows a not-found view", async ({ page }) => {
  await page.goto("/#/this-tool-does-not-exist");
  await expect(page.locator(".view-head h1")).toContainText("Not found");
});
