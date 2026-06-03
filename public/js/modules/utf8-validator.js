// "Is this valid UTF-8?" validator. Accepts hex, base64 or text and reports
// validity with a byte-by-byte breakdown of the first error.
import { el, h, num, codePointHex } from "../lib/dom.js";

// Parse the chosen input mode into a Uint8Array (throws on malformed input).
function parseInput(mode, text) {
  if (mode === "text") return new TextEncoder().encode(text);
  if (mode === "base64") {
    const clean = text.replace(/\s+/g, "");
    const bin = atob(clean); // throws on invalid base64
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // hex
  const clean = text.replace(/0x/gi, "").replace(/[\s,;:]+/g, "");
  if (clean.length % 2 !== 0) throw new Error("Hex input has an odd number of digits.");
  if (/[^0-9a-fA-F]/.test(clean)) throw new Error("Hex input contains non-hex characters.");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

// Manual UTF-8 walk so we can pinpoint the exact failing byte and reason.
function analyzeUtf8(bytes) {
  const errors = [];
  let i = 0;
  let cpCount = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let len, min, cp;
    if (b <= 0x7f) { len = 1; min = 0x00; cp = b; }
    else if (b >= 0xc0 && b <= 0xdf) { len = 2; min = 0x80; cp = b & 0x1f; }
    else if (b >= 0xe0 && b <= 0xef) { len = 3; min = 0x800; cp = b & 0x0f; }
    else if (b >= 0xf0 && b <= 0xf7) { len = 4; min = 0x10000; cp = b & 0x07; }
    else {
      errors.push({ at: i, msg: b >= 0x80 && b <= 0xbf ? "Unexpected continuation byte (0x80-0xBF) with no leading byte." : "Invalid leading byte (0xF8-0xFF are not valid in UTF-8)." });
      i++; continue;
    }
    if (i + len > bytes.length) {
      errors.push({ at: i, msg: `Truncated ${len}-byte sequence: needs ${len} bytes but only ${bytes.length - i} remain.` });
      break;
    }
    let ok = true;
    for (let k = 1; k < len; k++) {
      const cb = bytes[i + k];
      if (cb < 0x80 || cb > 0xbf) {
        errors.push({ at: i + k, msg: `Expected continuation byte (0x80-0xBF) at position ${i + k}, got 0x${cb.toString(16).padStart(2, "0").toUpperCase()}.` });
        ok = false;
        break;
      }
      cp = (cp << 6) | (cb & 0x3f);
    }
    if (!ok) { i++; continue; }
    if (cp < min) errors.push({ at: i, msg: `Overlong encoding: U+${cp.toString(16).toUpperCase()} should use fewer than ${len} bytes.` });
    else if (cp >= 0xd800 && cp <= 0xdfff) errors.push({ at: i, msg: `Encodes a UTF-16 surrogate (${codePointHex(cp)}), which is not a valid scalar value.` });
    else if (cp > 0x10ffff) errors.push({ at: i, msg: `Code point ${codePointHex(cp)} is beyond the Unicode maximum (U+10FFFF).` });
    cpCount++;
    i += len;
  }
  return { valid: errors.length === 0, errors, cpCount };
}

export default {
  id: "utf8-validator",
  title: "UTF-8 Validator",
  category: "Developer Tools",
  icon: "✅",
  description: "Check whether a sequence of bytes is valid UTF-8. Paste hex, base64 or text and get a byte-level verdict.",
  tags: ["validate", "decode", "bytes", "hex", "base64", "verify"],

  mount(root) {
    let mode = "hex";
    const input = el("textarea", { spellcheck: "false", placeholder: "e.g. E2 9C 93  F0 9F 91 8B" });
    input.value = "48 65 6C 6C 6F 20 E2 9C 93";
    const result = h.div();
    const breakdown = h.div({ style: { marginTop: "14px" } });

    const modes = [
      ["hex", "Hex bytes"],
      ["base64", "Base64"],
      ["text", "Plain text → its UTF-8 bytes"],
    ];
    const chips = h.div({ class: "chip-row" });
    modes.forEach(([id, label]) => {
      const c = h.button({ class: "chip" + (id === mode ? " active" : ""), text: label });
      c.addEventListener("click", () => {
        mode = id;
        chips.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        input.placeholder = id === "hex" ? "e.g. E2 9C 93  F0 9F 91 8B" : id === "base64" ? "e.g. SGVsbG8=" : "Type any text...";
        run();
      });
      chips.appendChild(c);
    });

    function hexCell(byte, state) {
      const cls = state === "err" ? "err" : state === "ctx" ? "ctx" : "ok";
      return h.span({
        class: "byte " + cls,
        text: byte.toString(16).padStart(2, "0").toUpperCase(),
      });
    }

    function run() {
      result.innerHTML = "";
      breakdown.innerHTML = "";
      let bytes;
      try {
        bytes = parseInput(mode, input.value);
      } catch (e) {
        result.append(h.div({ class: "notice err", text: "Could not parse input: " + e.message }));
        return;
      }
      if (bytes.length === 0) {
        result.append(h.div({ class: "notice info", text: "Empty input, technically valid UTF-8 (zero bytes)." }));
        return;
      }

      const { valid, errors, cpCount } = analyzeUtf8(bytes);

      if (valid) {
        let decoded = "";
        try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { /* shouldn't happen */ }
        result.append(
          h.div({ class: "notice ok" }, [
            h.strong({ text: "✓ Valid UTF-8. " }),
            `${num(bytes.length)} bytes encode ${num(cpCount)} code point${cpCount === 1 ? "" : "s"}.`,
          ]),
          h.div({ class: "output-box", style: { marginTop: "12px" }, text: decoded || "(no printable output)" }),
        );
      } else {
        const first = errors[0];
        result.append(
          h.div({ class: "notice err" }, [
            h.strong({ text: "✗ Not valid UTF-8. " }),
            `Problem at byte offset ${num(first.at)}: ${first.msg}`,
            errors.length > 1 ? h.div({ class: "faint", style: { marginTop: "6px", fontSize: "0.85rem" }, text: `(+${errors.length - 1} more issue${errors.length - 1 === 1 ? "" : "s"})` }) : null,
          ]),
        );
      }

      // Byte breakdown (cap to keep the DOM light).
      const cap = 512;
      const errSet = new Set(errors.map((e) => e.at));
      const cells = h.div({ class: "byte-grid" });
      const show = Math.min(bytes.length, cap);
      for (let i = 0; i < show; i++) cells.appendChild(hexCell(bytes[i], errSet.has(i) ? "err" : "ok"));
      breakdown.append(
        h.div({ class: "faint", style: { fontSize: "0.82rem", marginBottom: "8px" }, text: `Byte breakdown (${num(bytes.length)} bytes${bytes.length > cap ? `, showing first ${cap}` : ""}):` }),
        cells,
      );
    }

    input.addEventListener("input", run);

    root.append(
      h.div({ class: "panel" }, [
        h.div({ style: { marginBottom: "14px" } }, [chips]),
        el("label", { class: "field" }, [h.span({ class: "lbl", text: "Input" }), input]),
        result,
        breakdown,
      ]),
      // scoped styles for byte cells
      el("style", { text: `
        .byte-grid { display:flex; flex-wrap:wrap; gap:4px; font-family: var(--mono); }
        .byte { padding:3px 6px; border-radius:5px; font-size:0.8rem; border:1px solid var(--border-soft); }
        .byte.ok { background: var(--bg); color: var(--text-dim); }
        .byte.err { background: rgba(255,107,107,0.18); color:#ffd0d0; border-color: var(--danger); }
      ` }),
    );

    run();
  },
};
