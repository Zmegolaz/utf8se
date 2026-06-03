// Curated table of invisible / deceptive / formatting characters, used by the
// Invisible Character Detector and the Unicode Diff tool. No external data:
// the set is small and stable, so names live here directly.
//
// `inspect(cp)` returns null for an ordinary visible character, or
// { name, category } for anything zero-width, control, bidi, spacey, etc.

import { codePointHex } from "./dom.js";

// Explicitly named singletons (the ones people actually hit).
const NAMED = {
  0x0009: ["Character Tabulation (Tab)", "Whitespace"],
  0x000a: ["Line Feed", "Whitespace"],
  0x000b: ["Line Tabulation", "Whitespace"],
  0x000c: ["Form Feed", "Whitespace"],
  0x000d: ["Carriage Return", "Whitespace"],
  0x00a0: ["No-Break Space", "Space look-alike"],
  0x00ad: ["Soft Hyphen", "Zero-width / hidden"],
  0x034f: ["Combining Grapheme Joiner", "Zero-width / hidden"],
  0x061c: ["Arabic Letter Mark", "Bidirectional control"],
  0x115f: ["Hangul Choseong Filler", "Zero-width / hidden"],
  0x1160: ["Hangul Jungseong Filler", "Zero-width / hidden"],
  0x1680: ["Ogham Space Mark", "Space look-alike"],
  0x180e: ["Mongolian Vowel Separator", "Zero-width / hidden"],
  0x2000: ["En Quad", "Space look-alike"],
  0x2001: ["Em Quad", "Space look-alike"],
  0x2002: ["En Space", "Space look-alike"],
  0x2003: ["Em Space", "Space look-alike"],
  0x2004: ["Three-Per-Em Space", "Space look-alike"],
  0x2005: ["Four-Per-Em Space", "Space look-alike"],
  0x2006: ["Six-Per-Em Space", "Space look-alike"],
  0x2007: ["Figure Space", "Space look-alike"],
  0x2008: ["Punctuation Space", "Space look-alike"],
  0x2009: ["Thin Space", "Space look-alike"],
  0x200a: ["Hair Space", "Space look-alike"],
  0x200b: ["Zero Width Space", "Zero-width / hidden"],
  0x200c: ["Zero Width Non-Joiner", "Zero-width / hidden"],
  0x200d: ["Zero Width Joiner", "Zero-width / hidden"],
  0x200e: ["Left-to-Right Mark", "Bidirectional control"],
  0x200f: ["Right-to-Left Mark", "Bidirectional control"],
  0x202a: ["Left-to-Right Embedding", "Bidirectional control"],
  0x202b: ["Right-to-Left Embedding", "Bidirectional control"],
  0x202c: ["Pop Directional Formatting", "Bidirectional control"],
  0x202d: ["Left-to-Right Override", "Bidirectional control"],
  0x202e: ["Right-to-Left Override", "Bidirectional control"],
  0x202f: ["Narrow No-Break Space", "Space look-alike"],
  0x205f: ["Medium Mathematical Space", "Space look-alike"],
  0x2060: ["Word Joiner", "Zero-width / hidden"],
  0x2061: ["Function Application", "Zero-width / hidden"],
  0x2062: ["Invisible Times", "Zero-width / hidden"],
  0x2063: ["Invisible Separator", "Zero-width / hidden"],
  0x2064: ["Invisible Plus", "Zero-width / hidden"],
  0x2066: ["Left-to-Right Isolate", "Bidirectional control"],
  0x2067: ["Right-to-Left Isolate", "Bidirectional control"],
  0x2068: ["First Strong Isolate", "Bidirectional control"],
  0x2069: ["Pop Directional Isolate", "Bidirectional control"],
  0x3000: ["Ideographic Space", "Space look-alike"],
  0x3164: ["Hangul Filler", "Zero-width / hidden"],
  0xfeff: ["Zero Width No-Break Space (BOM)", "Zero-width / hidden"],
  0xffa0: ["Halfwidth Hangul Filler", "Zero-width / hidden"],
};

// Range-based classification for families with many members.
function rangeCategory(cp) {
  if (cp <= 0x0008 || (cp >= 0x000e && cp <= 0x001f)) return ["Control character (C0)", "Control"];
  if (cp === 0x007f) return ["Delete", "Control"];
  if (cp >= 0x0080 && cp <= 0x009f) return ["Control character (C1)", "Control"];
  if (cp >= 0x206a && cp <= 0x206f) return ["Deprecated format character", "Zero-width / hidden"];
  if (cp >= 0xfe00 && cp <= 0xfe0f) return ["Variation Selector", "Variation selector"];
  if (cp >= 0xe0100 && cp <= 0xe01ef) return ["Variation Selector Supplement", "Variation selector"];
  if (cp >= 0xfff9 && cp <= 0xfffb) return ["Interlinear Annotation", "Zero-width / hidden"];
  if (cp >= 0x1d173 && cp <= 0x1d17a) return ["Musical Formatting", "Zero-width / hidden"];
  if (cp === 0xe0001) return ["Language Tag", "Tag character"];
  if (cp >= 0xe0020 && cp <= 0xe007f) return ["Tag character", "Tag character"];
  return null;
}

export const CATEGORY_META = {
  "Zero-width / hidden": { color: "#ff6b6b", note: "Takes up no space; invisible to the eye." },
  "Bidirectional control": { color: "#ffb86b", note: "Reorders text direction; can disguise the real order (Trojan Source)." },
  "Space look-alike": { color: "#7c9eff", note: "Looks like a normal space but isn't U+0020." },
  "Control": { color: "#c77dff", note: "ASCII/C1 control character." },
  "Variation selector": { color: "#62d6c4", note: "Modifies the previous character's appearance; invisible alone." },
  "Tag character": { color: "#f178b6", note: "Invisible tag; can smuggle hidden data into text." },
  "Whitespace": { color: "#6b7682", note: "Ordinary but non-printing whitespace." },
};

export function inspect(cp) {
  if (cp === 0x20) return null; // ordinary space is fine
  if (NAMED[cp]) return { name: NAMED[cp][0], category: NAMED[cp][1] };
  const r = rangeCategory(cp);
  if (r) return { name: r[0], category: r[1] };
  return null;
}

// A short visible glyph to stand in for an invisible character in highlighted output.
export function placeholderFor(cp, info) {
  switch (info.category) {
    case "Bidirectional control": return "↹";
    case "Space look-alike": return "␣";
    case "Variation selector": return "◌";
    case "Tag character": return "🏷";
    case "Whitespace": return cp === 0x09 ? "⇥" : cp === 0x0a ? "⏎" : "·";
    default: return "∅";
  }
}

export { codePointHex };
