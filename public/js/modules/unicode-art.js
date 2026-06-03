// Unicode art generator. Converts an uploaded image into text art using a
// brightness ramp, shading blocks, or high-resolution Braille dots. All
// processing happens on a <canvas> in the browser, the image never leaves it.
import { el, h, copy, toast, num } from "../lib/dom.js";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB upload cap
const ACCEPT = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"];

const RAMPS = {
  ascii: " .:-=+*#%@",
  detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks: " ░▒▓█",
};

export default {
  id: "unicode-art",
  title: "Unicode Art Generator",
  category: "Generators",
  icon: "🖼️",
  description: "Turn an image into text art, ASCII ramp, shading blocks, or high-density Braille. Everything is processed locally in your browser.",
  tags: ["ascii", "art", "image", "braille", "picture", "convert"],

  mount(root) {
    let imageBitmap = null;
    let charset = "ascii";
    let width = 100;
    let invert = false;

    const canvas = document.createElement("canvas"); // offscreen work canvas
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const drop = h.div({ class: "dropzone" }, [
      h.div({ class: "dz-icon", text: "🖼️" }),
      h.div({ html: "<strong>Drop an image here</strong> or click to choose" }),
      h.div({ class: "faint", style: { fontSize: "0.8rem", marginTop: "4px" }, text: "PNG · JPEG · GIF · WebP · BMP, up to 8 MB" }),
    ]);
    const fileInput = el("input", { type: "file", accept: ACCEPT.join(","), style: { display: "none" } });

    const status = h.div({ style: { margin: "12px 0" } });
    const output = el("pre", { class: "art-output" });
    const controls = h.div({ class: "panel", style: { display: "none" } });

    // ---- File handling ----
    async function handleFile(file) {
      if (!file) return;
      if (!ACCEPT.includes(file.type)) {
        showError(`Unsupported type “${file.type || "unknown"}”. Allowed: PNG, JPEG, GIF, WebP, BMP.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        showError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB, the limit is 8 MB.`);
        return;
      }
      try {
        if (imageBitmap && imageBitmap.close) imageBitmap.close();
        imageBitmap = await createImageBitmap(file);
        status.innerHTML = "";
        controls.style.display = "";
        render();
        toast(`Loaded ${file.name} (${imageBitmap.width}×${imageBitmap.height})`);
      } catch (e) {
        showError("Could not read that image: " + e.message);
      }
    }
    function showError(msg) {
      status.innerHTML = "";
      status.appendChild(h.div({ class: "notice err", text: msg }));
    }

    drop.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
    ["dragover", "dragenter"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); })
    );
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); })
    );
    drop.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));

    // ---- Rendering ----
    function render() {
      if (!imageBitmap) return;
      const text = charset === "braille" ? toBraille() : toRamp(RAMPS[charset]);
      output.textContent = text;
      output._text = text;
    }

    // Sample the image at the requested character grid. Returns {data, cols, rows}
    // where each pixel is averaged luminance 0..255.
    function sampleGrid(cols, rows) {
      canvas.width = cols;
      canvas.height = rows;
      ctx.drawImage(imageBitmap, 0, 0, cols, rows);
      const px = ctx.getImageData(0, 0, cols, rows).data;
      const lum = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], al = px[i * 4 + 3];
        // luminance, blended toward white where transparent
        let v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        v = v * (al / 255) + 255 * (1 - al / 255);
        lum[i] = v;
      }
      return lum;
    }

    function toRamp(ramp) {
      const cols = width;
      // characters are ~2x taller than wide → halve row count to keep aspect
      const rows = Math.max(1, Math.round((cols * imageBitmap.height / imageBitmap.width) * 0.5));
      const lum = sampleGrid(cols, rows);
      const last = ramp.length - 1;
      let out = "";
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let v = lum[y * cols + x] / 255; // 0 dark .. 1 light
          if (!invert) v = 1 - v; // by default dark pixels → dense glyphs
          out += ramp[Math.round(v * last)];
        }
        out += "\n";
      }
      return out;
    }

    // Braille: each character is a 2-wide × 4-tall dot matrix (8 dots).
    function toBraille() {
      const cols = width * 2;
      const rows = Math.max(4, Math.round((cols * imageBitmap.height / imageBitmap.width) * (4 / 2) * 0.5) * 1);
      const r4 = Math.ceil(rows / 4) * 4;
      const lum = sampleGrid(cols, r4);
      // dot bit positions per Unicode Braille: (x,y)->bit
      const DOT = [[0x01, 0x08], [0x02, 0x10], [0x04, 0x20], [0x40, 0x80]];
      const threshold = 128;
      let out = "";
      for (let cy = 0; cy < r4; cy += 4) {
        for (let cx = 0; cx < cols; cx += 2) {
          let bits = 0;
          for (let dy = 0; dy < 4; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const v = lum[(cy + dy) * cols + (cx + dx)];
              const dark = invert ? v >= threshold : v < threshold;
              if (dark) bits |= DOT[dy][dx];
            }
          }
          out += String.fromCodePoint(0x2800 + bits);
        }
        out += "\n";
      }
      return out;
    }

    // ---- Controls UI ----
    const charsetChips = h.div({ class: "chip-row" });
    [["ascii", "ASCII ramp"], ["detailed", "Detailed ASCII"], ["blocks", "Shading blocks"], ["braille", "Braille (hi-res)"]].forEach(([id, label]) => {
      const c = h.button({ class: "chip" + (id === charset ? " active" : ""), text: label });
      c.addEventListener("click", () => {
        charset = id;
        charsetChips.querySelectorAll(".chip").forEach((x) => x.classList.remove("active"));
        c.classList.add("active");
        render();
      });
      charsetChips.appendChild(c);
    });

    const widthRange = el("input", { type: "range", min: "30", max: "220", value: String(width) });
    const widthVal = h.span({ class: "mono", text: String(width) });
    widthRange.addEventListener("input", () => { width = +widthRange.value; widthVal.textContent = String(width); render(); });

    const invertBox = el("input", { type: "checkbox" });
    invertBox.addEventListener("change", () => { invert = invertBox.checked; render(); });

    const copyBtn = h.button({ class: "btn", text: "Copy text" });
    copyBtn.addEventListener("click", () => output._text && copy(output._text));
    const dlBtn = h.button({ class: "btn secondary", text: "Download .txt" });
    dlBtn.addEventListener("click", () => {
      if (!output._text) return;
      const blob = new Blob([output._text], { type: "text/plain" });
      const a = el("a", { href: URL.createObjectURL(blob), download: "unicode-art.txt" });
      a.click();
      URL.revokeObjectURL(a.href);
    });

    controls.append(
      el("label", { class: "field" }, [h.span({ class: "lbl", text: "Character set" }), charsetChips]),
      el("label", { class: "field" }, [
        h.span({ class: "lbl" }, ["Width (characters): ", widthVal]),
        widthRange,
      ]),
      el("label", { class: "field", style: { display: "flex", gap: "8px", alignItems: "center" } }, [
        invertBox, h.span({ text: " Invert (light background)" }),
      ]),
      h.div({ class: "btn-group" }, [copyBtn, dlBtn]),
    );

    root.append(
      h.div({ class: "panel" }, [drop, fileInput, status]),
      controls,
      h.div({ class: "panel" }, [output]),
      el("style", { text: `
        .dropzone { border:2px dashed var(--border); border-radius:var(--radius); padding:34px; text-align:center; cursor:pointer; transition:border-color .15s, background .15s; color:var(--text-dim); }
        .dropzone:hover, .dropzone.over { border-color:var(--accent); background:var(--bg-elev-2); color:var(--text); }
        .dz-icon { font-size:2rem; margin-bottom:8px; }
        .art-output { font-family: var(--mono); font-size:7px; line-height:7px; letter-spacing:0; white-space:pre; overflow:auto; background:#fff; color:#000; padding:14px; border-radius:var(--radius-sm); margin:0; max-height:70vh; }
      ` }),
    );
  },

  unmount() { /* canvas + bitmap are GC'd with the closure */ },
};
