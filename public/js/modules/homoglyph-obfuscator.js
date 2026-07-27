// Homoglyph Obfuscator. The exact reverse of the Homoglyph Finder: takes plain
// text and swaps characters for look-alike Unicode confusables (Latin 'a' ->
// Cyrillic 'а'), so the result reads the same but is a different byte sequence.
// Driven by the same UTS #39 dataset the Finder folds away. Useful for testing
// spoof detectors, leetspeak-style handles, and seeing how homograph attacks
// are built. Paste the output back into the Homoglyph Finder to undo it.
import { el, h, copy, num, codePointHex, debounce } from "../lib/dom.js";
import { loadHomoglyphs } from "../lib/homoglyphs.js";

// Substitution strategies. `scripts: null` means "any script in the dataset";
// otherwise only homoglyphs from the listed scripts are eligible. Latin/Greek/
// Cyrillic look-alikes are the most convincing, so they are the default.
const STRATEGIES = [
  { id: "stealth", label: "Stealthy (Latin / Greek / Cyrillic look-alikes)", scripts: new Set(["Latin", "Greek", "Cyrillic", "Common"]) },
  { id: "cyrillic", label: "Cyrillic only", scripts: new Set(["Cyrillic"]) },
  { id: "greek", label: "Greek only", scripts: new Set(["Greek"]) },
  { id: "all", label: "Anything goes (every script)", scripts: null },
];

// Small seeded PRNG so a single render produces a stable result: the highlighted
// preview and the copied text always match, and "Re-roll" just bumps the seed.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default {
  id: "homoglyph-obfuscator",
  title: "Homoglyph Obfuscator",
  category: "Text Tools",
  icon: "🥸",
  description: "The reverse of the Homoglyph Finder: swap letters for look-alike Unicode confusables so text reads the same but is a different byte sequence. Tune the substitution rate and script, then paste the result into the Finder to undo it.",
  tags: ["homoglyph", "confusable", "obfuscate", "spoof", "phishing", "security", "unicode", "lookalike", "idn", "punycode", "test"],

  async mount(root) {
    const loading = h.div({ class: "notice info", text: "Loading the homoglyph database..." });
    root.appendChild(loading);
    let data;
    try {
      data = await loadHomoglyphs();
    } catch (e) {
      loading.className = "notice err";
      loading.textContent = "Could not load the homoglyph database: " + e.message + " (serve over HTTP).";
      return;
    }
    loading.remove();

    // Reverse map: ascii char -> [{ cp, script, name }]. Only single-character
    // foldings can be substituted back into a single look-alike code point.
    const reverse = new Map();
    for (const [cp, ascii, sidx, name] of data.entries) {
      if (ascii.length !== 1) continue;
      const list = reverse.get(ascii) || [];
      list.push({ cp, script: data.scripts[sidx], name });
      reverse.set(ascii, list);
    }

    let strategyId = "stealth";
    let rate = 0.8;        // probability an eligible character gets swapped
    let seed = 1;          // bumped by "Re-roll" to get a fresh random pick
    const strategy = () => STRATEGIES.find((s) => s.id === strategyId);

    function candidates(ch) {
      const all = reverse.get(ch);
      if (!all) return null;
      const scripts = strategy().scripts;
      if (!scripts) return all;
      const filtered = all.filter((c) => scripts.has(c.script));
      return filtered.length ? filtered : null;
    }

    const output = h.div({ class: "hob-output" });
    const stats = h.div();
    const actions = h.div({ style: { marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" } });

    // Compute one obfuscation pass into a list of cells, so the preview and the
    // copy button read from the exact same result.
    function build() {
      const text = input.value;
      const rng = mulberry32(seed);
      const cells = [];
      let replaced = 0;
      const scriptsUsed = new Set();
      for (const ch of text) {
        const cands = candidates(ch);
        if (cands && rng() < rate) {
          const pick = cands[Math.floor(rng() * cands.length)];
          cells.push({ ch: String.fromCodePoint(pick.cp), original: ch, info: pick });
          scriptsUsed.add(pick.script);
          replaced++;
        } else {
          // Consume an rng value even when skipping so the per-character stream
          // stays aligned and toggling rate feels stable, then keep the original.
          if (cands) rng();
          cells.push({ ch, original: ch, info: null });
        }
      }
      return { cells, replaced, scriptsUsed };
    }

    function render() {
      const { cells, replaced, scriptsUsed } = build();

      output.innerHTML = "";
      let out = "";
      for (const c of cells) {
        out += c.ch;
        if (c.info) {
          output.appendChild(h.span({
            class: "hob-swap",
            title: `${c.original} -> ${c.info.name} (${codePointHex(c.info.cp)}), ${c.info.script}`,
            text: c.ch,
          }));
        } else {
          output.appendChild(document.createTextNode(c.ch === "\n" ? "\n" : c.ch));
        }
      }

      stats.innerHTML = "";
      stats.appendChild(h.div({ class: "stat-grid" }, [
        statBox(num(replaced), "Characters swapped", replaced > 0),
        statBox(num(scriptsUsed.size), "Scripts used"),
        statBox(out.length === input.value.length ? "same" : "diff", "Visual vs bytes"),
      ]));

      actions.innerHTML = "";
      const copyBtn = h.button({ class: "btn", text: "Copy obfuscated text" });
      copyBtn.addEventListener("click", () => copy(out));
      const rerollBtn = h.button({ class: "btn btn-ghost", text: "Re-roll" });
      rerollBtn.addEventListener("click", () => { seed = (seed + 1) | 0; render(); });
      actions.append(copyBtn, rerollBtn);
    }

    function statBox(val, lbl, warn) {
      return h.div({ class: "stat" }, [
        h.div({ class: "stat-val", text: val, style: warn ? { color: "var(--accent-warm)" } : {} }),
        h.div({ class: "stat-lbl", text: lbl }),
      ]);
    }

    const input = el("textarea", { spellcheck: "false", placeholder: "Type the text to obfuscate..." });
    input.value = "admin@example.com";
    input.addEventListener("input", debounce(render, 100));

    const strategySelect = el("select");
    for (const s of STRATEGIES) strategySelect.appendChild(el("option", { value: s.id, text: s.label }));
    strategySelect.value = strategyId;
    strategySelect.addEventListener("change", () => { strategyId = strategySelect.value; render(); });

    const rateLabel = h.span({ class: "lbl", text: `Substitution rate: ${Math.round(rate * 100)}%` });
    const rateInput = el("input", { type: "range", min: "0", max: "100", value: String(Math.round(rate * 100)), style: { width: "100%" } });
    rateInput.addEventListener("input", () => {
      rate = +rateInput.value / 100;
      rateLabel.textContent = `Substitution rate: ${rateInput.value}%`;
      render();
    });

    root.append(
      h.div({ class: "panel" }, [
        el("label", { class: "field" }, [
          h.span({ class: "lbl", text: "Text to obfuscate" }),
          input,
        ]),
        el("div", { class: "field-row", style: { display: "flex", gap: "18px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0" } }, [
          el("label", { class: "field", style: { marginBottom: "0", maxWidth: "360px", flex: "1 1 240px" } }, [
            h.span({ class: "lbl", text: "Look-alike source" }),
            strategySelect,
          ]),
          el("label", { class: "field", style: { marginBottom: "0", flex: "1 1 220px" } }, [
            rateLabel,
            rateInput,
          ]),
        ]),
      ]),
      h.div({ class: "panel" }, [
        h.div({ class: "lbl", style: { color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "8px" }, text: "Obfuscated (hover a highlighted character to see the original)" }),
        output,
        actions,
      ]),
      stats,
      h.div({ class: "notice info", style: { marginTop: "16px" } }, [
        "This reads like the original but is a different byte sequence. Paste it into the ",
        h.strong({ text: "Homoglyph Finder" }),
        " to fold it back to ASCII. Real-world rendering depends on your fonts.",
      ]),
      h.p({ class: "copy-hint", text: `Homoglyph data: Unicode UTS #39 confusables ${data.confusablesVersion}.` }),
      el("style", { text: `
        .hob-output { background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:14px; min-height:48px; white-space:pre-wrap; word-break:break-word; font-size:1.25rem; line-height:1.8; }
        .hob-swap { background:rgba(255,184,107,0.18); color:var(--accent-warm); border-radius:3px; cursor:help; }
      ` }),
    );

    render();
  },
};
