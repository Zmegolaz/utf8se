// Unicode "styled text" transforms, shared by the Confusable Writer tool and
// the all-unusual-scripts flex page.
//
// Two kinds of styles:
//   1. Algorithmic ranges (Mathematical Alphanumeric Symbols) computed from a
//      base offset, with explicit exception tables for the "holes" that the
//      Unicode standard fills from the Letterlike Symbols block.
//   2. Map-based styles (small caps, upside-down, confusable homoglyphs, ...)
//      where the substitutions are irregular and listed character by character.
//
// Each style exposes `convert(text) -> string`. Characters with no mapping are
// passed through unchanged.

const A = "A".charCodeAt(0);
const Z = "Z".charCodeAt(0);
const a = "a".charCodeAt(0);
const z = "z".charCodeAt(0);
const ZERO = "0".charCodeAt(0);
const NINE = "9".charCodeAt(0);

// Build an algorithmic transform over A-Z / a-z / 0-9 from base code points.
// `exceptions` maps a source char to a fixed output code point (the holes).
function mathStyle({ upper, lower, digit, exceptions = {} }) {
  return (text) =>
    [...text]
      .map((ch) => {
        if (exceptions[ch] != null) return String.fromCodePoint(exceptions[ch]);
        const c = ch.codePointAt(0);
        if (upper != null && c >= A && c <= Z) return String.fromCodePoint(upper + (c - A));
        if (lower != null && c >= a && c <= z) return String.fromCodePoint(lower + (c - a));
        if (digit != null && c >= ZERO && c <= NINE) return String.fromCodePoint(digit + (c - ZERO));
        return ch;
      })
      .join("");
}

// Build a transform from an explicit "abc..." -> "..." mapping string pair.
function mapStyle(from, to) {
  const fromArr = [...from];
  const toArr = [...to];
  const map = new Map();
  fromArr.forEach((c, i) => map.set(c, toArr[i]));
  return (text) => [...text].map((ch) => map.get(ch) ?? ch).join("");
}

// Exception tables for the Letterlike-Symbols holes.
const SCRIPT_EX = {
  B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112,
  M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134,
};
const FRAKTUR_EX = { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 };
const DBL_EX = {
  C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124,
};
const ITALIC_EX = { h: 0x210e }; // Planck constant fills the italic-h hole

// Ordered list of styles. `id` is stable; `label` is shown to users.
export const STYLES = [
  { id: "bold",        label: "𝐁𝐨𝐥𝐝",            convert: mathStyle({ upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce }) },
  { id: "italic",      label: "𝐼𝑡𝑎𝑙𝑖𝑐",          convert: mathStyle({ upper: 0x1d434, lower: 0x1d44e, exceptions: ITALIC_EX }) },
  { id: "bolditalic",  label: "𝑩𝒐𝒍𝒅 𝑰𝒕𝒂𝒍𝒊𝒄",     convert: mathStyle({ upper: 0x1d468, lower: 0x1d482 }) },
  { id: "script",      label: "𝒮𝒸𝓇𝒾𝓅𝓉",          convert: mathStyle({ upper: 0x1d49c, lower: 0x1d4b6, exceptions: SCRIPT_EX }) },
  { id: "boldscript",  label: "𝓑𝓸𝓵𝓭 𝓼𝓬𝓻𝓲𝓹𝓽",     convert: mathStyle({ upper: 0x1d4d0, lower: 0x1d4ea }) },
  { id: "fraktur",     label: "𝔉𝔯𝔞𝔨𝔱𝔲𝔯",          convert: mathStyle({ upper: 0x1d504, lower: 0x1d51e, exceptions: FRAKTUR_EX }) },
  { id: "boldfraktur", label: "𝕭𝖔𝖑𝖉 𝖋𝖗𝖆𝖐𝖙𝖚𝖗",     convert: mathStyle({ upper: 0x1d56c, lower: 0x1d586 }) },
  { id: "double",      label: "𝔻𝕠𝕦𝕓𝕝𝕖-𝕤𝕥𝕣𝕦𝕔𝕜",     convert: mathStyle({ upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8, exceptions: DBL_EX }) },
  { id: "sans",        label: "𝖲𝖺𝗇𝗌-𝗌𝖾𝗋𝗂𝖿",       convert: mathStyle({ upper: 0x1d5a0, lower: 0x1d5ba, digit: 0x1d7e2 }) },
  { id: "sansbold",    label: "𝗦𝗮𝗻𝘀 𝗯𝗼𝗹𝗱",        convert: mathStyle({ upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec }) },
  { id: "sansitalic",  label: "𝘚𝘢𝘯𝘴 𝘪𝘵𝘢𝘭𝘪𝘤",       convert: mathStyle({ upper: 0x1d608, lower: 0x1d622 }) },
  { id: "monospace",   label: "𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎",        convert: mathStyle({ upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 }) },
  {
    id: "fullwidth",
    label: "Ｆｕｌｌｗｉｄｔｈ",
    convert: (text) =>
      [...text]
        .map((ch) => {
          const c = ch.codePointAt(0);
          if (c === 0x20) return "　";
          if (c >= 0x21 && c <= 0x7e) return String.fromCodePoint(c - 0x21 + 0xff01);
          return ch;
        })
        .join(""),
  },
  {
    id: "circled",
    label: "Ⓒⓘⓡⓒⓛⓔⓓ",
    convert: (text) =>
      [...text]
        .map((ch) => {
          const c = ch.codePointAt(0);
          if (c >= A && c <= Z) return String.fromCodePoint(0x24b6 + (c - A));
          if (c >= a && c <= z) return String.fromCodePoint(0x24d0 + (c - a));
          if (c === ZERO) return "⓪";
          if (c >= ZERO + 1 && c <= NINE) return String.fromCodePoint(0x2460 + (c - ZERO - 1));
          return ch;
        })
        .join(""),
  },
  {
    id: "squared",
    label: "🅂🅀🅄🄰🅁🄴🄳",
    convert: (text) =>
      [...text]
        .map((ch) => {
          const c = ch.toUpperCase().codePointAt(0);
          if (c >= A && c <= Z) return String.fromCodePoint(0x1f130 + (c - A));
          return ch;
        })
        .join(""),
  },
  {
    id: "smallcaps",
    label: "Sᴍᴀʟʟ Cᴀᴘs",
    convert: mapStyle(
      "abcdefghijklmnopqrstuvwxyz",
      "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘQʀsᴛᴜᴠᴡxʏᴢ"
    ),
  },
  {
    id: "flipped",
    label: "ɟlᴉddǝp",
    convert: mapStyle(
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!'\"()[]{}<>&_",
      "ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz∀ᗺƆᗡƎℲפHIſʞ˥WNOԀὉᴚS┴∩ΛMX⅄Z0ƖᘔƐㄣϛ9ㄥ86˙'¿¡,„)(][}{><⅋‾"
    ),
  },
  {
    id: "upsidedown",
    label: "uʍop ǝpᴉsd∩",
    convert: (() => {
      const flip = mapStyle(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!'\"()[]{}<>&_",
        "ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz∀ᗺƆᗡƎℲפHIſʞ˥WNOԀὉᴚS┴∩ΛMX⅄Z0ƖᘔƐㄣϛ9ㄥ86˙'¿¡,„)(][}{><⅋‾"
      );
      return (text) => [...flip(text)].reverse().join("");
    })(),
  },
];

// Confusable homoglyphs: visually near-identical characters drawn from other
// scripts (Cyrillic, Greek, ...). This is the classic "spoofy" look, great as a
// demo of why mixed-script detection matters. Latin → look-alike.
const CONFUSABLE_MAP = {
  a: "а", c: "с", e: "е", i: "і", j: "ј", o: "о", p: "р", s: "ѕ", x: "х", y: "у",
  A: "А", B: "В", C: "С", E: "Е", H: "Н", I: "І", J: "Ј", K: "К", M: "М",
  O: "О", P: "Р", S: "Ѕ", T: "Т", X: "Х", Y: "Ү",
  d: "ԁ", h: "һ", g: "ɡ", n: "ո", l: "ӏ",
};

export const CONFUSABLE = {
  id: "confusable",
  label: "Confusable (mixed-script look-alikes)",
  convert: (text) => [...text].map((ch) => CONFUSABLE_MAP[ch] ?? ch).join(""),
};

// Combining-mark "zalgo" / glitch text, parameterised by intensity.
const ZALGO_MARKS = [];
for (let cp = 0x0300; cp <= 0x036f; cp++) ZALGO_MARKS.push(String.fromCodePoint(cp));
export function zalgo(text, intensity = 3) {
  return [...text]
    .map((ch) => {
      if (/\s/.test(ch)) return ch;
      let out = ch;
      const n = Math.floor(Math.random() * intensity) + 1;
      for (let i = 0; i < n; i++) out += ZALGO_MARKS[Math.floor(Math.random() * ZALGO_MARKS.length)];
      return out;
    })
    .join("");
}

export const ALL_STYLES = [...STYLES, CONFUSABLE];
export function styleById(id) {
  return ALL_STYLES.find((s) => s.id === id);
}
