// Confusable / similar-looking text writer. Rewrites input using look-alike
// Unicode characters and a gallery of styled "fonts".
import { el, h, copy } from "../lib/dom.js";
import { ALL_STYLES, zalgo } from "../lib/fancy-text.js";

export default {
  id: "confusables",
  title: "Look-alike Text Writer",
  category: "Generators",
  icon: "🪞",
  description: "Rewrite text with similar-looking Unicode characters, mathematical fonts, full-width, small caps, mirror text, and deceptive mixed-script homoglyphs.",
  tags: ["homoglyph", "confusable", "fancy", "fonts", "spoof", "stylish", "zalgo"],

  mount(root) {
    const input = el("textarea", { spellcheck: "false", placeholder: "Type something..." });
    input.value = "The quick brown fox";

    const gallery = h.div({ class: "style-gallery" });

    function render() {
      const text = input.value || "";
      gallery.innerHTML = "";

      for (const style of ALL_STYLES) {
        const out = style.convert(text);
        gallery.appendChild(row(style.label, out, style.id === "confusable"));
      }

      // Zalgo gets its own intensity control, so render it separately.
      gallery.appendChild(zalgoRow(text));
    }

    function row(label, value, warn) {
      const sample = h.div({ class: "style-sample", text: value || " " });
      const card = h.div({ class: "style-card" }, [
        h.div({ class: "style-meta" }, [
          h.span({ class: "style-label", text: label }),
          warn ? h.span({ class: "style-warn", text: "spoofy", title: "Mixed-script, looks like Latin but isn't. Used in phishing." }) : null,
        ]),
        sample,
      ]);
      card.addEventListener("click", () => { if (value) copy(value); });
      card.title = "Click to copy";
      return card;
    }

    function zalgoRow(text) {
      let intensity = 4;
      const sample = h.div({ class: "style-sample" });
      const paint = () => { sample.textContent = zalgo(text, intensity) || " "; };
      const range = el("input", { type: "range", min: "1", max: "12", value: String(intensity), style: { width: "120px" } });
      range.addEventListener("input", () => { intensity = +range.value; paint(); });
      const card = h.div({ class: "style-card" }, [
        h.div({ class: "style-meta" }, [
          h.span({ class: "style-label", text: "Z̸a̷l̴g̵o̴ glitch" }),
          range,
        ]),
        sample,
      ]);
      sample.addEventListener("click", () => { if (sample.textContent.trim()) copy(sample.textContent); });
      sample.style.cursor = "pointer";
      sample.title = "Click to copy";
      paint();
      return card;
    }

    input.addEventListener("input", render);

    root.append(
      h.div({ class: "panel" }, [
        el("label", { class: "field", style: { marginBottom: "0" } }, [
          h.span({ class: "lbl", text: "Your text" }),
          input,
        ]),
      ]),
      h.div({ class: "notice info", style: { marginBottom: "18px" } }, [
        "Click any sample to copy it. The ",
        h.strong({ text: "mixed-script" }),
        " variant uses Cyrillic/Greek look-alikes, visually almost identical to Latin, which is exactly how homograph phishing domains work.",
      ]),
      gallery,
      el("style", { text: `
        .style-gallery { display:grid; grid-template-columns: 1fr; gap:10px; }
        .style-card { background:var(--bg-elev); border:1px solid var(--border-soft); border-radius:var(--radius-sm); padding:12px 14px; cursor:pointer; transition:border-color .15s; }
        .style-card:hover { border-color: var(--accent); }
        .style-meta { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
        .style-label { font-size:0.82rem; color:var(--text-dim); }
        .style-warn { font-size:0.68rem; background:rgba(255,184,107,0.16); color:var(--accent-warm); border:1px solid rgba(255,184,107,0.4); padding:1px 7px; border-radius:999px; }
        .style-sample { font-size:1.3rem; line-height:1.5; word-break:break-word; min-height:1.6em; }
      ` }),
    );

    render();
  },
};
