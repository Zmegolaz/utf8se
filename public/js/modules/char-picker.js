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
  category: "Developer Tools",
  icon: "🔎",
  description: "Search 150,000+ Unicode characters by name, filter by category, or browse by script. Click to copy.",
  tags: ["search", "find", "character", "emoji", "symbol", "unicode", "name", "script"],

  async mount(root) {
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

    const count = h.div({ class: "faint", style: { fontSize: "0.85rem", margin: "4px 0 12px" } });
    const grid = h.div({ class: "char-grid" });
    const detail = h.div({ class: "char-detail" });

    // ---- Search ----
    function runSearch() {
      const q = searchBox.value.trim().toLowerCase();
      const catCode = catSelect.value;
      const scriptName = scriptSelect.value;
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

      renderResults(results, q || catCode || scriptName);
    }

    function renderResults(results, hasFilter) {
      grid.innerHTML = "";
      if (!results.length) {
        count.textContent = "No characters match.";
        return;
      }
      count.textContent = `Showing ${num(results.length)}${results.length >= CAP ? "+" : ""} character${results.length === 1 ? "" : "s"}${hasFilter ? "" : " (start typing to search)"}.`;
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
