// The flex: a page whose entire content is rendered in unusual Unicode scripts.
// A style picker re-renders every word live. Pure decoration / showing off.
import { el, h, copy } from "../lib/dom.js";
import { STYLES, CONFUSABLE, zalgo } from "../lib/fancy-text.js";

// The (plain) source text. Everything here gets transformed before display.
const MANIFESTO = {
  title: "We speak in code points",
  paras: [
    "Every glyph you see is a number wearing a costume. The letter A is just a code point that learned to stand up straight.",
    "There are over a hundred and fifty thousand characters in Unicode, and most of them never get invited to parties. This page is for them.",
    "Below: the same sentence, rendered in scripts your operating system probably forgot it could draw.",
  ],
  closing: "Normalise your strings. Validate your bytes. Be excellent to your encodings.",
};

const SHOWCASE = "The quick brown fox jumps over the lazy dog, 0123456789";

export default {
  id: "flex",
  title: "Written in the Old Tongues",
  category: "Fun & Quirky",
  icon: "🪄",
  description: "A page rendered entirely in unusual Unicode scripts. Pick a style and watch every word transform. Just a flex.",
  tags: ["fancy", "showcase", "fraktur", "demo", "fun"],

  mount(root) {
    let styleId = "fraktur";

    const picker = h.div({ class: "chip-row", style: { marginBottom: "24px" } });
    const allStyles = [...STYLES, CONFUSABLE, { id: "zalgo", label: "Z̸a̸l̸g̸o̸", convert: (t) => zalgo(t, 5) }];
    allStyles.forEach((s) => {
      const c = h.button({ class: "chip" + (s.id === styleId ? " active" : ""), text: s.label });
      c.addEventListener("click", () => {
        styleId = s.id;
        picker.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        repaint();
      });
      picker.appendChild(c);
    });

    const titleEl = h.h2({ class: "flex-title" });
    const bodyEl = h.div({ class: "flex-body" });
    const showcaseEl = h.div({ class: "flex-showcase" });
    const closingEl = h.div({ class: "flex-closing" });

    function conv(text) {
      const s = allStyles.find((x) => x.id === styleId);
      return s ? s.convert(text) : text;
    }

    function repaint() {
      titleEl.textContent = conv(MANIFESTO.title);
      bodyEl.innerHTML = "";
      MANIFESTO.paras.forEach((p) => bodyEl.appendChild(h.p({ text: conv(p) })));

      // The showcase block lists the sentence in EVERY style at once, the
      // proper flex. Each line is independently styled regardless of picker.
      showcaseEl.innerHTML = "";
      [...STYLES, CONFUSABLE].forEach((s) => {
        const line = h.div({ class: "flex-line", text: s.convert(SHOWCASE), title: "Click to copy" });
        line.addEventListener("click", () => copy(s.convert(SHOWCASE)));
        showcaseEl.appendChild(line);
      });

      closingEl.textContent = conv(MANIFESTO.closing);
    }

    root.append(
      h.div({ class: "notice info", style: { marginBottom: "18px" } }, [
        "Everything below is real Unicode text, select it, copy it, paste it anywhere. Pick a script to transform the prose:",
      ]),
      picker,
      h.div({ class: "panel flex-stage" }, [
        titleEl,
        bodyEl,
        h.div({ class: "flex-showcase-wrap" }, [
          h.div({ class: "faint", style: { fontSize: "0.8rem", marginBottom: "10px" }, text: "· the same line, every style (click to copy) ·" }),
          showcaseEl,
        ]),
        closingEl,
      ]),
      el("style", { text: `
        .flex-stage { padding: 30px 32px; }
        .flex-title { font-size: 2rem; margin: 0 0 18px; line-height: 1.3; word-break: break-word; }
        .flex-body p { font-size: 1.2rem; line-height: 1.8; word-break: break-word; color: var(--text); }
        .flex-showcase-wrap { margin: 28px 0; padding: 20px 0; border-top: 1px solid var(--border-soft); border-bottom: 1px solid var(--border-soft); }
        .flex-line { font-size: 1.15rem; padding: 5px 0; cursor: pointer; word-break: break-word; }
        .flex-line:hover { color: var(--accent-2); }
        .flex-closing { font-size: 1.25rem; margin-top: 20px; color: var(--accent-2); word-break: break-word; }
      ` }),
    );

    repaint();
  },
};
