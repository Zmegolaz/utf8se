// "Lorem ipsum" generator using ancient & rare scripts. Builds plausible-looking
// pseudo-words by sampling assigned code points from each script's letter range.
// Output is decorative, these are not real words in any language.
import { el, h, copy, num } from "../lib/dom.js";

// Inclusive code-point range → array of single-char strings.
function range(start, end) {
  const out = [];
  for (let cp = start; cp <= end; cp++) out.push(String.fromCodePoint(cp));
  return out;
}

// Each script: a pool of "letters" to sample from. Ranges chosen to stay within
// contiguous assigned letters. `note` is shown to the user. `wordLen` tunes the
// look (some scripts read better as short clusters).
const SCRIPTS = [
  { id: "cuneiform", name: "Cuneiform", sample: "𒀭𒈨𒌍𒁹", note: "Sumero-Akkadian, c. 3200 BCE", pool: range(0x12000, 0x1216f), wordLen: [2, 5] },
  { id: "linearb", name: "Linear B", sample: "𐀀𐀁𐀂𐀃", note: "Mycenaean Greek, c. 1450 BCE", pool: range(0x10000, 0x1004d), wordLen: [2, 4] },
  { id: "ogham", name: "Ogham", sample: "᚛ᚐᚁᚉᚇ᚜", note: "Early Irish, c. 4th century CE", pool: range(0x1681, 0x169a), wordLen: [3, 6] },
  { id: "egyptian", name: "Egyptian Hieroglyphs", sample: "𓀀𓁐𓂀𓃭", note: "c. 3200 BCE", pool: range(0x13000, 0x1306f), wordLen: [2, 5] },
  { id: "phoenician", name: "Phoenician", sample: "𐤀𐤁𐤂𐤃", note: "c. 1050 BCE", pool: range(0x10900, 0x10915), wordLen: [3, 6] },
  { id: "runic", name: "Runic", sample: "ᚠᚢᚦᚨ", note: "Elder Futhark & later", pool: range(0x16a0, 0x16ea), wordLen: [3, 7] },
  { id: "gothic", name: "Gothic", sample: "𐌰𐌱𐌲𐌳", note: "Wulfila's alphabet, 4th century CE", pool: range(0x10330, 0x10349), wordLen: [3, 7] },
  { id: "olditalic", name: "Old Italic", sample: "𐌀𐌁𐌂𐌃", note: "Etruscan & relatives", pool: range(0x10300, 0x1031f), wordLen: [3, 6] },
  { id: "glagolitic", name: "Glagolitic", sample: "ⰀⰁⰂⰃ", note: "Oldest Slavic alphabet, 9th century", pool: range(0x2c00, 0x2c2e), wordLen: [3, 7] },
  { id: "linearA", name: "Linear A", sample: "𐘀𐘁𐘂𐘃", note: "Minoan, undeciphered", pool: range(0x10600, 0x1063f), wordLen: [2, 5] },
];

function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeWord(pool, [lo, hi]) {
  let w = "";
  const n = randInt(lo, hi);
  for (let i = 0; i < n; i++) w += pick(pool);
  return w;
}

function makeText(script, paragraphs, sentencesPer, wordsPer) {
  const paras = [];
  for (let p = 0; p < paragraphs; p++) {
    const sentences = [];
    const sCount = randInt(Math.max(1, sentencesPer - 1), sentencesPer + 1);
    for (let s = 0; s < sCount; s++) {
      const wCount = randInt(Math.max(2, wordsPer - 2), wordsPer + 2);
      const words = [];
      for (let w = 0; w < wCount; w++) words.push(makeWord(script.pool, script.wordLen));
      sentences.push(words.join(" "));
    }
    paras.push(sentences.join("  "));
  }
  return paras.join("\n\n");
}

export default {
  id: "lorem-rare",
  title: "Ancient-Script Lorem Ipsum",
  category: "Generators",
  icon: "📜",
  description: "Placeholder text rendered in Cuneiform, Linear B, Ogham and other ancient or rare scripts. Purely decorative, not real words.",
  tags: ["lorem", "ipsum", "placeholder", "cuneiform", "linear b", "ogham", "runic", "ancient"],

  mount(root) {
    let scriptId = SCRIPTS[0].id;

    const chips = h.div({ class: "chip-row", style: { marginBottom: "16px" } });
    SCRIPTS.forEach((s) => {
      const c = h.button({ class: "chip" + (s.id === scriptId ? " active" : "") }, [
        h.span({ text: s.sample + "  " }),
        h.span({ text: s.name }),
      ]);
      c.addEventListener("click", () => {
        scriptId = s.id;
        chips.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        generate();
      });
      chips.appendChild(c);
    });

    const paraInput = el("input", { type: "number", min: "1", max: "20", value: "3" });
    const sentInput = el("input", { type: "number", min: "1", max: "12", value: "4" });
    const wordInput = el("input", { type: "number", min: "2", max: "20", value: "7" });

    const note = h.div({ class: "faint", style: { fontSize: "0.82rem", marginBottom: "10px" } });
    const output = h.div({ class: "output-box", style: { fontSize: "1.4rem", lineHeight: "1.9" } });
    const fallback = h.div({ class: "notice info", style: { marginTop: "10px" } }, [
      "If you see boxes (□) or question marks, your device lacks a font for this script, the characters are still valid and will copy correctly.",
    ]);

    function generate() {
      const script = SCRIPTS.find((s) => s.id === scriptId);
      const text = makeText(
        script,
        Math.min(20, Math.max(1, +paraInput.value || 1)),
        Math.min(12, Math.max(1, +sentInput.value || 1)),
        Math.min(20, Math.max(2, +wordInput.value || 2)),
      );
      note.textContent = `${script.name}, ${script.note}. Sampling ${num(script.pool.length)} code points.`;
      output.textContent = text;
      output._text = text;
    }

    const regen = h.button({ class: "btn", text: "↻ Regenerate" });
    regen.addEventListener("click", generate);
    const copyBtn = h.button({ class: "btn secondary", text: "Copy" });
    copyBtn.addEventListener("click", () => copy(output._text || ""));

    [paraInput, sentInput, wordInput].forEach((i) => i.addEventListener("input", generate));

    root.append(
      h.div({ class: "panel" }, [
        h.div({ class: "lbl", style: { marginBottom: "8px", color: "var(--text-dim)", fontSize: "0.82rem" }, text: "Script" }),
        chips,
        h.div({ class: "row" }, [
          el("label", { class: "field" }, [h.span({ class: "lbl", text: "Paragraphs" }), paraInput]),
          el("label", { class: "field" }, [h.span({ class: "lbl", text: "Sentences / paragraph" }), sentInput]),
          el("label", { class: "field" }, [h.span({ class: "lbl", text: "Words / sentence" }), wordInput]),
        ]),
        h.div({ class: "btn-group" }, [regen, copyBtn]),
      ]),
      h.div({ class: "panel" }, [note, output, fallback]),
    );

    generate();
  },
};
