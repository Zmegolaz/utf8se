// Functional end-to-end tests: drive each tool and assert on real behaviour.
// Ported from the manual headless-Chrome checks used during development.
import { test, expect } from "@playwright/test";

test.describe("Character Picker", () => {
  test("name search finds the snowman", async ({ page }) => {
    await page.goto("/#/char-picker");
    const search = page.locator(".module-root input[type=text]");
    await search.fill("snowman");
    await expect(page.locator(".char-glyph").filter({ hasText: "☃" })).toHaveCount(1);
  });

  test("hex search resolves a code point", async ({ page }) => {
    await page.goto("/#/char-picker");
    await page.locator(".module-root input[type=text]").fill("1F600");
    await expect(page.locator(".char-glyph").first()).toHaveText("😀");
  });
});

test("Byte-length Calculator counts UTF-8 bytes of the sample", async ({ page }) => {
  await page.goto("/#/byte-length");
  // default sample "Héllo, 世界 👋🏽" = 23 UTF-8 bytes
  await expect(page.locator(".stat .stat-val").first()).toHaveText("23");
});

test.describe("UTF-8 Validator", () => {
  test("rejects an overlong encoding", async ({ page }) => {
    await page.goto("/#/utf8-validator");
    await page.locator(".module-root textarea").fill("C0 80");
    await expect(page.locator(".notice.err")).toContainText("Not valid UTF-8");
  });
  test("accepts a valid 4-byte sequence", async ({ page }) => {
    await page.goto("/#/utf8-validator");
    await page.locator(".module-root textarea").fill("F0 9F 98 80");
    await expect(page.locator(".notice.ok")).toContainText("Valid UTF-8");
    await expect(page.locator(".output-box")).toContainText("😀");
  });
});

test("Invisible Character Detector flags hidden characters", async ({ page }) => {
  await page.goto("/#/invisible-detector");
  // zero-width space, soft hyphen, NBSP, RLO override
  await page.locator(".module-root textarea").fill("a​b­c d‮e");
  const root = page.locator(".module-root");
  await expect(root).toContainText("Zero Width Space");
  await expect(root).toContainText("Soft Hyphen");
  await expect(root).toContainText("No-Break Space");
  await expect(root).toContainText("Right-to-Left Override");
});

test.describe("Homoglyph Finder", () => {
  test("folds a Cyrillic spoof to ASCII and warns on mixed script", async ({ page }) => {
    await page.goto("/#/homoglyph-finder");
    await page.locator(".module-root textarea").fill("ехample.com"); // Cyrillic е + х
    await expect(page.locator(".module-root .output-box")).toHaveText("example.com");
    await expect(page.locator(".notice.err")).toContainText("Mixed-script");
    await expect(page.locator(".hg-script").first()).toContainText("Cyrillic");
  });

  test("Expected-language dropdown keeps a language's own letters as legitimate", async ({ page }) => {
    await page.goto("/#/homoglyph-finder");
    const out = page.locator(".module-root .output-box");
    await page.locator(".module-root textarea").fill("ışık"); // Turkish; dotless ı is a confusable of 'i'
    await expect(out).toHaveText("işik"); // default ASCII-only folds ı -> i
    await page.locator(".module-root select").selectOption("tr");
    await expect(out).toHaveText("ışık"); // Turkish: ı kept, nothing folded
    await expect(page.locator(".notice.ok").filter({ hasText: "kept as legitimate" })).toBeVisible();
  });
});

test.describe("Homoglyph Obfuscator", () => {
  test("swaps ASCII letters for look-alikes that the Finder folds back", async ({ page }) => {
    await page.goto("/#/homoglyph-obfuscator");
    await page.locator(".module-root textarea").fill("admin");
    // Crank the substitution rate to 100% so every eligible letter is swapped.
    await page.evaluate(() => {
      const r = document.querySelector(".module-root input[type=range]");
      r.value = "100";
      r.dispatchEvent(new Event("input"));
    });
    const out = page.locator(".module-root .hob-output");
    const text = await out.textContent();
    // 'a','d','i','n' all have homoglyphs and must be gone ('m' has none, stays).
    expect(text).not.toMatch(/[adin]/);
    expect(text).toContain("m");
    expect(text).not.toBe("admin");
    await expect(page.locator(".stat .stat-val").first()).toHaveText("4");
  });
});

test.describe("Unicode Diff", () => {
  test("detects composed vs decomposed café as NFC-equal", async ({ page }) => {
    await page.goto("/#/unicode-diff");
    const root = page.locator(".module-root");
    await expect(root).toContainText("NFC normalization");
    await expect(root.locator(".norm-row").first()).toContainText("equal");
  });
  test("labels an invisible-only difference", async ({ page }) => {
    await page.goto("/#/unicode-diff");
    const tas = page.locator(".module-root textarea");
    await tas.nth(0).fill("ab");
    await tas.nth(1).fill("a​b");
    await expect(page.locator(".notice.err")).toContainText("differ");
    await expect(page.locator(".module-root")).toContainText("Zero Width Space");
  });
});

test("Look-alike Text Writer renders a style gallery", async ({ page }) => {
  await page.goto("/#/confusables");
  await expect(page.locator(".style-card")).toHaveCount(19); // 17 styles + confusable + zalgo
});

test("Ancient-Script Lorem Ipsum produces text", async ({ page }) => {
  await page.goto("/#/lorem-rare");
  const out = page.locator(".module-root .output-box");
  await expect(out).not.toBeEmpty();
  expect((await out.textContent()).length).toBeGreaterThan(20);
});

test("Unicode Art Generator converts an image to text art", async ({ page }) => {
  await page.goto("/#/unicode-art");
  // Build a PNG in-page, wrap it in a File, and feed the hidden input.
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 120; c.height = 120;
    const x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, 120, 120);
    x.fillStyle = "#000"; x.beginPath(); x.arc(60, 60, 48, 0, 7); x.fill();
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const file = new File([blob], "circle.png", { type: "image/png" });
    const input = document.querySelector(".module-root input[type=file]");
    const dt = new DataTransfer(); dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change"));
  });
  const art = page.locator(".art-output");
  await expect(art).not.toBeEmpty();
  const text = await art.textContent();
  expect(text.split("\n").length).toBeGreaterThan(10);
  // distinct glyphs => actual shading, not a blank canvas
  expect(new Set(text.replace(/\s/g, "")).size).toBeGreaterThan(2);
});

test("Flex page renders prose with no stray ASCII code-point tokens", async ({ page }) => {
  await page.goto("/#/flex");
  await expect(page.locator(".flex-title")).not.toBeEmpty();
  const body = await page.locator(".flex-body").textContent();
  expect(body).not.toMatch(/\+00\d\d/); // e.g. the old "U+0041" artifact
});
