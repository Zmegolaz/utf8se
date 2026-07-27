// Character picker / search. Loads the generated Unicode dataset on demand and
// lets you search by name, filter by general category, and browse by script
// ("language"). Click a character to copy it.
import { el, h, copy, num, codePointHex, debounce } from "../lib/dom.js";

const DATA_URL = "data/characters.json";
const CAP = 500; // max cells rendered per query, to keep the DOM responsive

let DATA = null; // cached across mounts
let loadPromise = null;

function loadData() {
  if (DATA) return Promise.resolve(DATA);
  if (!loadPromise) {
    loadPromise = fetch(DATA_URL)
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((d) => { DATA = d; return d; });
  }
  return loadPromise;
}

// A hand-picked starter set shown when nothing is searched, so the default
// view isn't just the first few hundred code points in Unicode order (mostly
// controls and Latin punctuation). Grouped here only for readability; display
// order follows this same flat order. Actual name/category/script/block for
// each is looked up from the loaded dataset, so it always matches the rest of
// the picker.
const QUICK_PICKS = [
  // Arrows
  0x2190, 0x2192, 0x2191, 0x2193, 0x2194, 0x2195, 0x2196, 0x2197, 0x2198, 0x2199,
  0x21d0, 0x21d2, 0x21d1, 0x21d3, 0x21d4, 0x21d5, 0x21a9, 0x21aa, 0x21ba, 0x21bb,
  0x279c, 0x27a4, 0x21e2, 0x21a6,
  // Math & units
  0xb1, 0xd7, 0xf7, 0x3d, 0x2260, 0x2248, 0x2261, 0x2264, 0x2265, 0x221e,
  0x221a, 0x221b, 0x2211, 0x220f, 0x222b, 0x2202, 0x2206, 0x2205, 0x2208, 0x2209,
  0x2282, 0x222a, 0x2229, 0x2234, 0xb0, 0x2032, 0x2033, 0x2103, 0x2109, 0x25, 0x2030,
  // Fractions & sub/superscript
  0xbd, 0x2153, 0x2154, 0xbc, 0xbe, 0x2155, 0x215b, 0x215c, 0x215d, 0x215e,
  0xb9, 0xb2, 0xb3, 0x207f, 0x2080, 0x2081, 0x2082, 0x2093,
  // Currency
  0x24, 0x20ac, 0xa3, 0xa5, 0xa2, 0x20b9, 0x20a9, 0x20bd, 0x20bf, 0x20ba, 0x20b4, 0x20a6,
  // Punctuation & typography
  0x2014, 0x2013, 0x2026, 0x201c, 0x201d, 0x2018, 0x2019, 0xab, 0xbb, 0xa7,
  0xb6, 0xa9, 0xae, 0x2122, 0x2116, 0x2022, 0x2023, 0x203d, 0xb7,
  // Stars, shapes & checks
  0x2605, 0x2606, 0x25cf, 0x25cb, 0x25c6, 0x25c7, 0x25a0, 0x25a1, 0x25b2, 0x25bc,
  0x25b6, 0x25c0, 0x2666, 0x2665, 0x2660, 0x2663, 0x2713, 0x2714, 0x2717, 0x2718,
  0x2611, 0x2612,
  // Weather & misc symbols
  0x2600, 0x2601, 0x2602, 0x2603, 0x26a1, 0x262f, 0x26a0, 0x2699, 0x2693, 0x2708,
  0x231b, 0x260e, 0x2709, 0x2690, 0x2615, 0x2702,
];

// Expand a formulaic range [start,end,template,...] into entry objects, lazily
// and capped. Template "{X}" is replaced by the hex code point.
function* expandRange(range, limit) {
  const [start, end, template] = range;
  let count = 0;
  for (let cp = start; cp <= end && count < limit; cp++) {
    // skip surrogates (none in these ranges, but defensive)
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    const hex = cp.toString(16).toUpperCase();
    const name = template.includes("{X}") ? template.replace("{X}", hex) : `${template} ${hex}`;
    yield { cp, name, gc: range[3], sc: range[4], bl: range[5] };
    count++;
  }
}

export default {
  id: "char-picker",
  title: "Character Picker",
  category: "Text Tools",
  icon: "🔎",
  description: "Search 150,000+ Unicode characters by name, filter by category, or browse by script. Click to copy.",
  tags: ["search", "find", "character", "emoji", "symbol", "unicode", "name", "script"],

  async mount(root, params) {
    const loading = h.div({ class: "notice info", text: "Loading the Unicode database..." });
    root.appendChild(loading);

    let data;
    try {
      data = await loadData();
    } catch (e) {
      loading.className = "notice err";
      loading.textContent = "Could not load the character database: " + e.message + ". (Serve the site over HTTP, file:// blocks fetch.)";
      return;
    }
    loading.remove();

    // Update the sidebar version label now that we know it.
    const verEl = document.getElementById("ucdVersion");
    if (verEl) verEl.textContent = data.unicodeVersion;

    const catIndexByCode = Object.fromEntries(data.categoryOrder.map((c, i) => [c, i]));
    const scriptIndexByName = Object.fromEntries(data.scripts.map((s, i) => [s, i]));
    const cpIndex = new Map(data.chars.map((c) => [c[0], c]));

    // ---- Controls ----
    const searchBox = el("input", { type: "text", placeholder: "Search by name... (e.g. “heart”, “arrow”, “snowman”)", spellcheck: "false" });

    const catSelect = el("select");
    catSelect.appendChild(el("option", { value: "", text: "All categories" }));
    // Group selectable categories present in the data, with long names.
    [...new Set(data.chars.map((c) => c[2]))].sort((a, b) => a - b).forEach((gi) => {
      const code = data.categoryOrder[gi];
      catSelect.appendChild(el("option", { value: code, text: `${data.categories[code] || code} (${code})` }));
    });

    const scriptSelect = el("select");
    scriptSelect.appendChild(el("option", { value: "", text: "All scripts" }));
    [...data.scripts].sort().forEach((s) => scriptSelect.appendChild(el("option", { value: s, text: s })));

    // Restore a shared search from the URL, e.g. #/char-picker?q=heart&cat=So
    if (params) {
      if (params.get("q")) searchBox.value = params.get("q");
      if (params.get("cat")) catSelect.value = params.get("cat");
      if (params.get("script")) scriptSelect.value = params.get("script");
    }

    const count = h.div({ class: "faint", style: { fontSize: "0.85rem", margin: "4px 0 12px" } });
    const grid = h.div({ class: "char-grid" });
    const detail = h.div({ class: "char-detail" });

    // ---- Search ----
    function runSearch() {
      const q = searchBox.value.trim().toLowerCase();
      const catCode = catSelect.value;
      const scriptName = scriptSelect.value;

      if (!q && !catCode && !scriptName) {
        const picks = QUICK_PICKS
          .map((cp) => cpIndex.get(cp))
          .filter(Boolean)
          .map((c) => ({ cp: c[0], name: c[1], gc: c[2], sc: c[3], bl: c[4] }));
        renderResults(picks, false);
        syncUrl();
        return;
      }

      const catIdx = catCode ? catIndexByCode[catCode] : null;
      const scIdx = scriptName ? scriptIndexByName[scriptName] : null;
      const hexQuery = /^(u\+)?[0-9a-f]{2,6}$/i.test(q) ? parseInt(q.replace(/^u\+/i, ""), 16) : null;

      const results = [];
      const passFilters = (gc, sc) =>
        (catIdx == null || gc === catIdx) && (scIdx == null || sc === scIdx);

      for (let i = 0; i < data.chars.length && results.length < CAP; i++) {
        const c = data.chars[i];
        if (!passFilters(c[2], c[3])) continue;
        if (q) {
          if (hexQuery != null) { if (c[0] !== hexQuery) continue; }
          else if (!c[1].toLowerCase().includes(q)) continue;
        }
        results.push({ cp: c[0], name: c[1], gc: c[2], sc: c[3], bl: c[4] });
      }

      // Formulaic ranges (CJK, Hangul, Tangut, ...)
      for (const range of data.ranges) {
        if (results.length >= CAP) break;
        if (!passFilters(range[3], range[4])) continue;
        if (hexQuery != null) {
          if (hexQuery >= range[0] && hexQuery <= range[1]) {
            const hex = hexQuery.toString(16).toUpperCase();
            const name = range[2].includes("{X}") ? range[2].replace("{X}", hex) : `${range[2]} ${hex}`;
            results.push({ cp: hexQuery, name, gc: range[3], sc: range[4], bl: range[5] });
          }
          continue;
        }
        if (q && !range[2].toLowerCase().includes(q)) continue;
        for (const e of expandRange(range, CAP - results.length)) results.push(e);
      }

      renderResults(results, true);
      syncUrl();
    }

    // Keep the URL hash in sync with the current search so it can be shared.
    // Uses replaceState (not location.hash=) so it doesn't add history entries
    // or trigger a re-mount on every keystroke.
    function syncUrl() {
      const sp = new URLSearchParams();
      const q = searchBox.value.trim();
      if (q) sp.set("q", q);
      if (catSelect.value) sp.set("cat", catSelect.value);
      if (scriptSelect.value) sp.set("script", scriptSelect.value);
      const qs = sp.toString();
      const hash = "#/char-picker" + (qs ? "?" + qs : "");
      if (location.hash !== hash) history.replaceState(null, "", hash);
    }

    function renderResults(results, hasFilter) {
      grid.innerHTML = "";
      if (!results.length) {
        count.textContent = "No characters match.";
        return;
      }
      count.textContent = hasFilter
        ? `Showing ${num(results.length)}${results.length >= CAP ? "+" : ""} character${results.length === 1 ? "" : "s"}.`
        : `${num(results.length)} handy symbols to get you started. Search, or filter by category/script, to browse all 150,000+ characters.`;
      const frag = document.createDocumentFragment();
      for (const r of results) {
        const cell = h.button({ class: "char-cell", title: r.name }, [
          h.div({ class: "char-glyph", text: String.fromCodePoint(r.cp) }),
          h.div({ class: "char-cp", text: codePointHex(r.cp) }),
        ]);
        cell.addEventListener("click", () => { copy(String.fromCodePoint(r.cp)); showDetail(r); });
        frag.appendChild(cell);
      }
      grid.appendChild(frag);
    }

    function showDetail(r) {
      const ch = String.fromCodePoint(r.cp);
      const bytes = [...new TextEncoder().encode(ch)].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
      detail.innerHTML = "";
      detail.appendChild(
        h.div({ class: "panel", style: { marginBottom: "0" } }, [
          h.div({ class: "detail-row" }, [
            h.div({ class: "detail-glyph", text: ch }),
            h.div({}, [
              h.div({ class: "detail-name", text: r.name }),
              h.div({ class: "faint mono", style: { marginTop: "4px" } }, [
                `${codePointHex(r.cp)} · ${data.categories[data.categoryOrder[r.gc]] || data.categoryOrder[r.gc]} · ${data.scripts[r.sc]} · ${data.blocks[r.bl].replace(/_/g, " ")}`,
              ]),
              h.div({ class: "faint mono", style: { marginTop: "2px" }, text: `UTF-8: ${bytes}   ·   HTML: &#${r.cp};   ·   JS: \\u{${r.cp.toString(16)}}` }),
            ]),
          ]),
        ])
      );
    }

    const onInput = debounce(runSearch, 120);
    searchBox.addEventListener("input", onInput);
    catSelect.addEventListener("change", runSearch);
    scriptSelect.addEventListener("change", runSearch);

    root.append(
      h.div({ class: "panel" }, [
        el("label", { class: "field" }, [h.span({ class: "lbl", text: "Search" }), searchBox]),
        h.div({ class: "row" }, [
          el("label", { class: "field", style: { marginBottom: 0 } }, [h.span({ class: "lbl", text: "Category" }), catSelect]),
          el("label", { class: "field", style: { marginBottom: 0 } }, [h.span({ class: "lbl", text: "Script (language)" }), scriptSelect]),
        ]),
      ]),
      detail,
      count,
      grid,
      el("style", { text: `
        .char-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap:8px; }
        .char-cell { background:var(--bg-elev); border:1px solid var(--border-soft); border-radius:var(--radius-sm); padding:10px 4px 6px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:6px; transition:border-color .12s, transform .05s; }
        .char-cell:hover { border-color:var(--accent); }
        .char-cell:active { transform:scale(0.96); }
        .char-glyph { font-size:1.8rem; line-height:1; height:1.9rem; display:flex; align-items:center; }
        .char-cp { font-family:var(--mono); font-size:0.62rem; color:var(--text-faint); }
        .char-detail:empty { display:none; }
        .char-detail { margin-bottom:14px; }
        .detail-row { display:flex; gap:18px; align-items:center; }
        .detail-glyph { font-size:3.2rem; line-height:1; min-width:64px; text-align:center; }
        .detail-name { font-size:1.05rem; font-weight:600; }
      ` }),
    );

    runSearch();
  },
};
