// String byte-length calculator, encoding sizes for DB field limits etc.
import { el, h, num, debounce } from "../lib/dom.js";

const encoder = new TextEncoder(); // always UTF-8

function utf16Units(str) {
  return str.length; // JS strings are UTF-16; .length == code unit count
}
function codePointCount(str) {
  return [...str].length;
}
function graphemeCount(str) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let n = 0;
    for (const _ of seg.segment(str)) n++;
    return n;
  }
  return null;
}

export default {
  id: "byte-length",
  title: "Byte-length Calculator",
  category: "Developer Tools",
  icon: "📏",
  description: "Measure a string across UTF-8 / UTF-16 / UTF-32, code points and graphemes, handy when fitting text into DB column limits.",
  tags: ["bytes", "length", "varchar", "size", "encoding", "database"],

  mount(root) {
    const input = el("textarea", {
      placeholder: "Type or paste text...",
      spellcheck: "false",
    });
    input.value = "Héllo, 世界 👋🏽";

    const stats = h.div({ class: "stat-grid" });
    const limitNote = h.div({ style: { marginTop: "14px" } });

    const limitInput = el("input", { type: "number", min: "1", placeholder: "e.g. 255", value: "255" });

    function stat(val, lbl, accent) {
      return h.div({ class: "stat" + (accent ? " accent" : "") }, [
        h.div({ class: "stat-val", text: val }),
        h.div({ class: "stat-lbl", text: lbl }),
      ]);
    }

    function update() {
      const str = input.value;
      const utf8 = encoder.encode(str).length;
      const u16 = utf16Units(str);
      const cps = codePointCount(str);
      const graph = graphemeCount(str);

      stats.innerHTML = "";
      stats.append(
        stat(num(utf8), "UTF-8 bytes", true),
        stat(num(u16 * 2), "UTF-16 bytes"),
        stat(num(cps * 4), "UTF-32 bytes"),
        stat(num(cps), "Code points"),
        stat(graph == null ? "-" : num(graph), "Graphemes (visible)"),
        stat(num(u16), "UTF-16 units (JS .length)"),
      );

      // Field-limit helper
      const limit = parseInt(limitInput.value, 10);
      limitNote.innerHTML = "";
      if (limit > 0) {
        const fitsBytes = utf8 <= limit;
        const fitsChars = cps <= limit;
        limitNote.append(
          h.div({ class: "notice " + (fitsBytes ? "ok" : "err") }, [
            `As ${num(limit)} UTF-8 bytes (e.g. PostgreSQL/MySQL utf8mb4 byte budget): `,
            h.strong({ text: fitsBytes ? `fits (${num(limit - utf8)} bytes spare)` : `over by ${num(utf8 - limit)} bytes` }),
          ]),
          h.div({ class: "notice " + (fitsChars ? "ok" : "err"), style: { marginTop: "8px" } }, [
            `As ${num(limit)} characters (e.g. VARCHAR(${num(limit)}) counted in code points): `,
            h.strong({ text: fitsChars ? `fits (${num(limit - cps)} chars spare)` : `over by ${num(cps - limit)} chars` }),
          ]),
        );
      }
    }

    const debounced = debounce(update, 80);
    input.addEventListener("input", debounced);
    limitInput.addEventListener("input", debounced);

    root.append(
      h.div({ class: "panel" }, [
        el("label", { class: "field" }, [
          h.span({ class: "lbl", text: "Input text" }),
          input,
        ]),
        stats,
      ]),
      h.div({ class: "panel" }, [
        h.h2({ text: "Field-limit check" }),
        el("label", { class: "field", style: { maxWidth: "220px" } }, [
          h.span({ class: "lbl", text: "Limit" }),
          limitInput,
        ]),
        limitNote,
      ]),
      h.p({ class: "copy-hint" }, [
        "Tip: UTF-8 uses 1-4 bytes per character. Many databases count VARCHAR length in characters, but impose a byte limit on the underlying storage, both are shown above.",
      ]),
    );

    update();
  },
};
