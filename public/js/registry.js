// Central module registry.
//
// To add a new tool: create js/modules/<your-module>.js that default-exports a
// module descriptor, import it here, and add it to the MODULES array below.
// Everything else (menu entry, routing, home-page card) is automatic.
//
// A module descriptor looks like:
//   export default {
//     id:          "byte-length",        // unique, used in the URL hash (#/byte-length)
//     title:       "Byte-length Calculator",
//     category:    "Developer Tools",    // groups it in the menu + home page
//     icon:        "📏",                  // emoji shown in menu/cards
//     description: "One-line summary shown on cards and the view header.",
//     tags:        ["bytes", "length"],  // optional, improves menu search
//     mount(root) { ... },               // render UI into `root` (may be async)
//     unmount() { ... },                 // optional cleanup when navigating away
//   }

import charPicker from "./modules/char-picker.js";
import byteLength from "./modules/byte-length.js";
import utf8Validator from "./modules/utf8-validator.js";
import invisibleDetector from "./modules/invisible-detector.js";
import homoglyphFinder from "./modules/homoglyph-finder.js";
import unicodeDiff from "./modules/unicode-diff.js";
import confusables from "./modules/confusables.js";
import loremRare from "./modules/lorem-rare.js";
import unicodeArt from "./modules/unicode-art.js";
import flex from "./modules/flex.js";

export const MODULES = [
  charPicker,
  byteLength,
  utf8Validator,
  invisibleDetector,
  homoglyphFinder,
  unicodeDiff,
  confusables,
  loremRare,
  unicodeArt,
  flex,
];

// Display order of categories in the menu and on the home page.
export const CATEGORY_ORDER = [
  "Developer Tools",
  "Generators",
  "Fun & Quirky",
];
