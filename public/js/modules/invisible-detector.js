// Invisible Character Detector. Highlights every zero-width space, soft hyphen,
// bidi mark, non-standard space and control character in pasted text, the
// stuff that "looks right but breaks things". Fully client-side.
import { el, h, copy, num, debounce } from "../lib/dom.js";
import { inspect, placeholderFor, CATEGORY_META, codePointHex } from "../lib/invisibles.js";

export default {
  id: "invisible-detector",
  title: "Invisible Character Detector",
  category: "Developer Tools",
  icon: "👻",
  description: "Reveal zero-width spaces, soft hyphens, bidi marks and other hidden characters lurking in copy-pasted text.",
  tags: ["zero-width", "hidden", "whitespace", "bom", "bidi", "soft hyphen", "debug", "invisible"],

  mount(root) {
    const input = el("textarea", { spellcheck: "false", placeholder: "Paste text that looks right but misbehaves..." });
    // Default sample seeded with a zero-width space, a soft hyphen and a NBSP.
    input.value = "Hello​World  price:­ 100kr ‮RTL-override";

    const highlighted = h.div({ class: "inv-output" });
    const summary = h.div();
    const cleanBtn = h.button({ class: "btn secondary", text: "Copy cleaned text (strip hidden)" });

    function analyze() {
      const text = input.value;
      highlighted.innerHTML = "";
      const found = new Map(); // cp -> { info, count }
      let cleaned = "";

      for (const ch of text) {
        const cp = ch.codePointAt(0);
        const info = inspect(cp);
        if (!info) {
          highlighted.appendChild(document.createTextNode(ch));
          cleaned += ch;
          continue;
        }
        // Tally
        const rec = found.get(cp) || { info, count: 0 };
        rec.count++;
        found.set(cp, rec);
        // Keep real newlines flowing in the preview, but still mark them.
        if (cp === 0x0a) {
          highlighted.appendChild(mark(cp, info, "⏎"));
          highlighted.appendChild(document.createElement("br"));
        } else {
          highlighted.appendChild(mark(cp, info, placeholderFor(cp, info)));
        }
        // "Cleaned" keeps real whitespace, drops the hidden/deceptive stuff.
        if (info.category === "Whitespace") cleaned += ch;
        else if (info.category === "Space look-alike") cleaned += " ";
        // everything else (zero-width, bidi, control, tags, VS) is removed
      }

      renderSummary(found, text);
      cleanBtn.onclick = () => copy(cleaned);
    }

    function mark(cp, info, glyph) {
      const meta = CATEGORY_META[info.category] || {};
      return h.span({
        class: "inv-mark",
        style: { "--mc": meta.color || "#ff6b6b" },
        title: `${info.name}  (${codePointHex(cp)}), ${info.category}`,
        text: glyph,
      });
    }

    function renderSummary(found, text) {
      summary.innerHTML = "";
      const totalCp = [...text].length;
      const totalHidden = [...found.values()].reduce((a, r) => a + r.count, 0);

      summary.appendChild(
        h.div({ class: "stat-grid", style: { marginBottom: "16px" } }, [
          stat(num(totalCp), "Code points"),
          stat(num(totalHidden), "Hidden / suspicious", totalHidden > 0),
          stat(num(found.size), "Distinct kinds"),
        ])
      );

      if (found.size === 0) {
        summary.appendChild(h.div({ class: "notice ok", text: "✓ No invisible or deceptive characters found." }));
        return;
      }

      // Group rows by category.
      const byCat = new Map();
      for (const [cp, rec] of found) {
        if (!byCat.has(rec.info.category)) byCat.set(rec.info.category, []);
        byCat.get(rec.info.category).push([cp, rec]);
      }
      for (const [cat, rows] of byCat) {
        const meta = CATEGORY_META[cat] || {};
        const list = h.div({ class: "inv-list" });
        rows.sort((a, b) => a[0] - b[0]).forEach(([cp, rec]) => {
          list.appendChild(h.div({ class: "inv-row" }, [
            h.span({ class: "inv-dot", style: { background: meta.color || "#ff6b6b" } }),
            h.span({ class: "mono", text: codePointHex(cp) }),
            h.span({ text: rec.info.name }),
            h.span({ class: "faint", style: { marginLeft: "auto" }, text: `×${rec.count}` }),
          ]));
        });
        summary.appendChild(h.div({ class: "panel", style: { marginBottom: "12px" } }, [
          h.div({ class: "inv-cat-head" }, [
            h.span({ class: "inv-dot", style: { background: meta.color || "#ff6b6b" } }),
            h.strong({ text: cat }),
            meta.note ? h.span({ class: "faint", style: { fontSize: "0.82rem", marginLeft: "8px" }, text: meta.note }) : null,
          ]),
          list,
        ]));
      }
    }

    function stat(val, lbl, warn) {
      return h.div({ class: "stat" + (warn ? "" : ""), style: warn ? { borderColor: "var(--danger)" } : {} }, [
        h.div({ class: "stat-val", text: val, style: warn ? { color: "var(--danger)" } : {} }),
        h.div({ class: "stat-lbl", text: lbl }),
      ]);
    }

    input.addEventListener("input", debounce(analyze, 100));

    root.append(
      h.div({ class: "panel" }, [
        el("label", { class: "field", style: { marginBottom: "0" } }, [
          h.span({ class: "lbl", text: "Text to inspect" }),
          input,
        ]),
      ]),
      h.div({ class: "panel" }, [
        h.div({ class: "lbl", style: { color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "8px" }, text: "Revealed (hover a marker for details)" }),
        highlighted,
        h.div({ style: { marginTop: "12px" } }, [cleanBtn]),
      ]),
      summary,
      el("style", { text: `
        .inv-output { background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:14px; min-height:60px; white-space:pre-wrap; word-break:break-word; font-family:var(--mono); line-height:2; }
        .inv-mark { display:inline-block; background:color-mix(in srgb, var(--mc) 22%, transparent); color:var(--mc); border:1px solid var(--mc); border-radius:4px; padding:0 4px; margin:0 1px; font-size:0.85em; cursor:help; vertical-align:baseline; }
        .inv-cat-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .inv-dot { width:10px; height:10px; border-radius:50%; flex:none; display:inline-block; }
        .inv-list { display:flex; flex-direction:column; gap:6px; }
        .inv-row { display:flex; align-items:center; gap:10px; font-size:0.9rem; padding:4px 0; border-top:1px solid var(--border-soft); }
        .inv-row:first-child { border-top:none; }
      ` }),
    );

    analyze();
  },
};
