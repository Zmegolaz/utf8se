// Kaomoji Shelf: a curated, clickable reference of Japanese-style text
// emoticons (kaomoji) built from Unicode letters and punctuation. Click any
// tile to copy it.
import { el, h, copy } from "../lib/dom.js";

const KAOMOJI = [
  ["ಠ_ಠ", "disapproval"], ["( ͡° ͜ʖ ͡°)", "lenny face"], ["( ͡ᵔ ͜ʖ ͡ᵔ)", "lenny (happy)"],
  ["(☞ﾟヮﾟ)☞", "finger guns"], ["(╯°□°)╯︵ ┻━┻", "table flip"], ["┻━┻︵ \\(°□°)/ ︵ ┻━┻", "flip both ways"],
  ["¯\\_(ツ)_/¯", "shrug"], ["(っ◕‿◕)っ", "hug"], ["ヽ(´▽`)/", "happy"],
  ["(๑•̀ㅂ•́)و", "determined"], ["(⌐■_■)", "deal with it"], ["٩(◕‿◕)۶", "excited"],
  ["(づ๑•ᴗ•๑)づ", "hug 2"], ["ʕ•ᴥ•ʔ", "bear"], ["(¬‿¬)", "smirk"],
  ["(ノಠ益ಠ)ノ彡┻━┻", "angry flip"], ["(ㆆ_ㆆ)", "suspicious"], ["(╥﹏╥)", "crying"],
  ["(´・ω・`)", "neutral"], ["(≧◡≦)", "happy squint"], ["( ˘ ³˘)♥", "kiss"],
  ["(>_<)", "frustrated"], ["(^_^)", "content"], ["(T_T)", "sobbing"],
  ["m(_ _)m", "bow / apology"], ["ヽ(`Д´)ﾉ", "rage"], ["(⊙_⊙)", "surprised"],
  ["＼(^o^)／", "celebrate"], ["(¬_¬)", "annoyed"], ["(｡♥‿♥｡)", "in love"],
  ["(ง'̀-'́)ง", "fighting spirit"], ["ᕕ( ᐛ )ᕗ", "running"], ["¯\\(°_o)/¯", "confused shrug"],
];

export default {
  id: "kaomoji",
  title: "Kaomoji Shelf",
  category: "Fun & Quirky",
  icon: "🙂",
  description: "A shelf of Japanese-style text emoticons (kaomoji) built from ordinary Unicode letters and punctuation. Click any tile to copy it.",
  tags: ["kaomoji", "emoticon", "text face", "emoji", "fun", "copy", "reference"],

  mount(root) {
    const search = el("input", { type: "text", placeholder: "Filter kaomoji... (e.g. \u201cshrug\u201d, \u201cangry\u201d, \u201chug\u201d)", spellcheck: "false" });
    const grid = h.div({ class: "glyph-grid glyph-grid--wide" });
    const empty = h.div({ class: "notice info", text: "No kaomoji match." });

    function build() {
      grid.innerHTML = "";
      const q = search.value.trim().toLowerCase();
      const items = q ? KAOMOJI.filter(([g, label]) => label.toLowerCase().includes(q) || g === q) : KAOMOJI;
      empty.style.display = items.length ? "none" : "";
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
    }

    search.addEventListener("input", build);

    root.append(
      h.div({ class: "panel" }, [
        el("label", { class: "field", style: { marginBottom: 0 } }, [h.span({ class: "lbl", text: "Filter" }), search]),
      ]),
      empty,
      grid,
      el("style", { text: `
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

    build();
  },
};
