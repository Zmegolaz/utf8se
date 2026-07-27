// Glyph Shelf: a curated, clickable reference of commonly-needed symbols and
// sequences (arrows, math, currency, typography, kaomoji, ...). No search
// engine or dataset fetch needed, this is a small hand-picked list, click any
// tile to copy it.
import { el, h, copy } from "../lib/dom.js";

// Each category: a name and a list of [glyph, label] pairs. `glyph` is what
// gets copied; `label` is shown as the tile's title/caption.
const CATEGORIES = [
  {
    name: "Arrows",
    items: [
      ["←", "left"], ["→", "right"], ["↑", "up"], ["↓", "down"],
      ["↔", "left-right"], ["↕", "up-down"], ["↖", "up-left"], ["↗", "up-right"],
      ["↘", "down-right"], ["↙", "down-left"], ["⇐", "double left"], ["⇒", "double right"],
      ["⇑", "double up"], ["⇓", "double down"], ["⇔", "double left-right"], ["⇕", "double up-down"],
      ["↩", "undo"], ["↪", "redo"], ["↺", "counterclockwise"], ["↻", "clockwise"],
      ["➜", "heavy right"], ["➤", "arrowhead right"], ["⇢", "dashed right"], ["↦", "maps to"],
    ],
  },
  {
    name: "Math & Units",
    items: [
      ["±", "plus-minus"], ["×", "times"], ["÷", "divide"], ["=", "equals"],
      ["≠", "not equal"], ["≈", "approximately"], ["≡", "identical to"], ["≤", "less or equal"],
      ["≥", "greater or equal"], ["∞", "infinity"], ["√", "square root"], ["∛", "cube root"],
      ["∑", "sum"], ["∏", "product"], ["∫", "integral"], ["∂", "partial"],
      ["∆", "delta"], ["∅", "empty set"], ["∈", "element of"], ["∉", "not element of"],
      ["⊂", "subset"], ["∪", "union"], ["∩", "intersection"], ["∴", "therefore"],
      ["°", "degree"], ["′", "prime (feet/minutes)"], ["″", "double prime (inches/seconds)"],
      ["℃", "celsius"], ["℉", "fahrenheit"], ["%", "percent"], ["‰", "per mille"],
    ],
  },
  {
    name: "Fractions & Sub/Superscript",
    items: [
      ["½", "half"], ["⅓", "third"], ["⅔", "two thirds"], ["¼", "quarter"],
      ["¾", "three quarters"], ["⅕", "fifth"], ["⅛", "eighth"], ["⅜", "three eighths"],
      ["⅝", "five eighths"], ["⅞", "seven eighths"],
      ["¹", "sup 1"], ["²", "sup 2"], ["³", "sup 3"], ["ⁿ", "sup n"],
      ["₀", "sub 0"], ["₁", "sub 1"], ["₂", "sub 2"], ["ₓ", "sub x"],
    ],
  },
  {
    name: "Currency",
    items: [
      ["$", "dollar"], ["€", "euro"], ["£", "pound"], ["¥", "yen/yuan"],
      ["¢", "cent"], ["₹", "rupee"], ["₩", "won"], ["₽", "ruble"],
      ["₿", "bitcoin"], ["₺", "lira"], ["₴", "hryvnia"], ["₦", "naira"],
    ],
  },
  {
    name: "Punctuation & Typography",
    items: [
      ["—", "em dash"], ["–", "en dash"], ["…", "ellipsis"], ["“", "left double quote"],
      ["”", "right double quote"], ["‘", "left single quote"], ["’", "right single quote"],
      ["«", "left guillemet"], ["»", "right guillemet"], ["§", "section"], ["¶", "pilcrow"],
      ["©", "copyright"], ["®", "registered"], ["™", "trademark"], ["№", "numero"],
      ["•", "bullet"], ["‣", "triangular bullet"], ["‽", "interrobang"], ["·", "middle dot"],
    ],
  },
  {
    name: "Stars, Shapes & Checks",
    items: [
      ["★", "star"], ["☆", "star outline"], ["●", "circle"], ["○", "circle outline"],
      ["◆", "diamond"], ["◇", "diamond outline"], ["■", "square"], ["□", "square outline"],
      ["▲", "triangle up"], ["▼", "triangle down"], ["▶", "triangle right"], ["◀", "triangle left"],
      ["♦", "diamond suit"], ["♥", "heart suit"], ["♠", "spade suit"], ["♣", "club suit"],
      ["✓", "check"], ["✔", "heavy check"], ["✗", "x"], ["✘", "heavy x"],
      ["☑", "checked box"], ["☒", "crossed box"],
    ],
  },
  {
    name: "Weather & Misc Symbols",
    items: [
      ["☀", "sun"], ["☁", "cloud"], ["☂", "umbrella"], ["☃", "snowman"],
      ["⚡", "lightning"], ["☯", "yin yang"], ["⚠", "warning"], ["⚙", "gear"],
      ["⚓", "anchor"], ["✈", "airplane"], ["⌛", "hourglass"], ["☎", "telephone"],
      ["✉", "envelope"], ["⚐", "flag"], ["☕", "coffee"], ["✂", "scissors"],
    ],
  },
  {
    name: "Kaomoji & Text Faces",
    items: [
      ["ಠ_ಠ", "disapproval"], ["( ͡° ͜ʖ ͡°)", "lenny face"], ["( ͡ᵔ ͜ʖ ͡ᵔ)", "lenny (happy)"],
      ["(☞ﾟヮﾟ)☞", "finger guns"], ["(╯°□°)╯︵ ┻━┻", "table flip"], ["┻━┻︵ \\(°□°)/ ︵ ┻━┻", "flip both ways"],
      ["¯\\_(ツ)_/¯", "shrug"], ["(っ◕‿◕)っ", "hug"], ["ヽ(´▽`)/", "happy"],
      ["(๑•̀ㅂ•́)و", "determined"], ["(⌐■_■)", "deal with it"], ["٩(◕‿◕)۶", "excited"],
      ["(づ๑•ᴗ•๑)づ", "hug 2"], ["ʕ•ᴥ•ʔ", "bear"], ["(¬‿¬)", "smirk"],
      ["(ノಠ益ಠ)ノ彡┻━┻", "angry flip"], ["(ㆆ_ㆆ)", "suspicious"], ["(╥﹏╥)", "crying"],
      ["(´・ω・`)", "neutral"], ["(≧◡≦)", "happy squint"], ["( ˘ ³˘)♥", "kiss"],
    ],
  },
];

export default {
  id: "glyph-shelf",
  title: "Glyph Shelf",
  category: "Developer Tools",
  icon: "🔣",
  description: "A shelf of commonly-needed symbols, arrows, currency signs and kaomoji. Click any tile to copy it.",
  tags: ["arrows", "symbols", "degree", "currency", "kaomoji", "emoticon", "punctuation", "fraction", "copy", "reference"],

  mount(root) {
    const search = el("input", { type: "text", placeholder: "Filter glyphs... (e.g. \u201carrow\u201d, \u201cdegree\u201d, \u201cshrug\u201d)", spellcheck: "false" });
    const sections = h.div({});

    function buildSections() {
      sections.innerHTML = "";
      const q = search.value.trim().toLowerCase();
      let any = false;
      for (const cat of CATEGORIES) {
        const items = q
          ? cat.items.filter(([g, label]) => label.toLowerCase().includes(q) || g === q)
          : cat.items;
        if (!items.length) continue;
        any = true;
        const wide = cat.items.some(([g]) => g.length > 6);
        const grid = h.div({ class: "glyph-grid" + (wide ? " glyph-grid--wide" : "") });
        for (const [glyph, label] of items) {
          const sizeClass =
            glyph.length > 15 ? " glyph-char--xs" :
            glyph.length > 10 ? " glyph-char--sm" :
            glyph.length > 6 ? " glyph-char--md" : "";
          const cell = h.button({ class: "glyph-cell", title: label }, [
            h.div({ class: "glyph-char" + sizeClass, text: glyph }),
            h.div({ class: "glyph-label", text: label }),
          ]);
          cell.addEventListener("click", () => copy(glyph, `Copied ${label}`));
          grid.appendChild(cell);
        }
        sections.appendChild(
          h.div({ class: "glyph-section" }, [
            h.h3({ class: "glyph-section-title", text: cat.name }),
            grid,
          ])
        );
      }
      if (!any) sections.appendChild(h.div({ class: "notice info", text: "No glyphs match." }));
    }

    search.addEventListener("input", buildSections);

    root.append(
      h.div({ class: "panel" }, [
        el("label", { class: "field", style: { marginBottom: 0 } }, [h.span({ class: "lbl", text: "Filter" }), search]),
      ]),
      sections,
      el("style", { text: `
        .glyph-section { margin-bottom: 26px; }
        .glyph-section-title { font-size: 0.95rem; color: var(--text-dim); margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.04em; }
        .glyph-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap:8px; }
        .glyph-grid--wide { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
        .glyph-cell { background:var(--bg-elev); border:1px solid var(--border-soft); border-radius:var(--radius-sm); padding:12px 6px 8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:6px; transition:border-color .12s, transform .05s; }
        .glyph-cell:hover { border-color:var(--accent); }
        .glyph-cell:active { transform:scale(0.96); }
        .glyph-char { font-size:1.6rem; line-height:1.2; min-height:1.7rem; display:flex; align-items:center; justify-content:center; text-align:center; white-space:nowrap; }
        .glyph-char--md { font-size:1.15rem; }
        .glyph-char--sm { font-size:0.95rem; }
        .glyph-char--xs { font-size:0.8rem; }
        .glyph-label { font-size:0.68rem; color: var(--text-faint); text-align:center; }
      ` }),
    );

    buildSections();
  },
};
