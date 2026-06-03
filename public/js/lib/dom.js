// Tiny DOM + UX helpers shared by every module. No dependencies.

/**
 * Create an element. `attrs` may include `class`, `text`, `html`, `on` (event
 * map), `style` (object), plus any other attribute. `children` is a node/array.
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "on") for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k === "dataset") for (const [d, dv] of Object.entries(v)) node.dataset[d] = dv;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/** Shorthand `el` factories: h.div(...), h.button(...), etc. */
export const h = new Proxy({}, { get: (_, tag) => (attrs, children) => el(tag, attrs, children) });

let toastTimer;
export function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
}

/** Copy text to clipboard with a graceful fallback + toast confirmation. */
export async function copy(text, label = "Copied!") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = el("textarea", { style: { position: "fixed", opacity: "0" } });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
  }
  toast(label);
}

/** Format a number with thin-space thousands grouping. */
export function num(n) {
  return n.toLocaleString("en-US");
}

/** U+XXXX notation for a code point. */
export function codePointHex(cp) {
  return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}

/** Debounce a function by `ms`. */
export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
