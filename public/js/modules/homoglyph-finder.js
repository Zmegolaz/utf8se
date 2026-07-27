// Homoglyph Finder. Spots characters that look like ASCII but aren't (Cyrillic
// 'а' vs Latin 'a'), reports the scripts involved, warns on mixed-script spoofs,
// and can fold the text down to plain ASCII. Configurable per script/language.
import { el, h, copy, num, codePointHex, debounce } from "../lib/dom.js";
import { loadHomoglyphs } from "../lib/homoglyphs.js";

// "Expected language" presets. The listed letters are treated as legitimate:
// never flagged, never folded, and ignored by the mixed-script check. Most
// accented letters are NOT in the UTS #39 confusables set (Unicode does not
// consider e.g. å confusable with a), so for those this is a reassuring no-op;
// it matters for letters that ARE confusables (e.g. Turkish dotless ı -> i).
// `latinAny: true` allows every Latin-script look-alike (flag non-Latin only).
const LANGUAGES = [
  { id: "", label: "ASCII only (flag everything)" },
  { id: "latin", label: "Any Latin letter", latinAny: true },
  { id: "sv", label: "Swedish", chars: "åäöÅÄÖ" },
  { id: "fi", label: "Finnish", chars: "åäöÅÄÖ" },
  { id: "no", label: "Norwegian / Danish", chars: "æøåÆØÅ" },
  { id: "de", label: "German", chars: "äöüßÄÖÜ" },
  { id: "fr", label: "French", chars: "àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ" },
  { id: "es", label: "Spanish", chars: "áéíóúüñ¿¡ÁÉÍÓÚÜÑ" },
  { id: "pt", label: "Portuguese", chars: "ãõáéíóúâêôàçÃÕÁÉÍÓÚÂÊÔÀÇ" },
  { id: "it", label: "Italian", chars: "àèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ" },
  { id: "pl", label: "Polish", chars: "ąćęłńóśźżĄĆĘŁŃÓŚŹŻ" },
  { id: "cs", label: "Czech", chars: "áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ" },
  { id: "tr", label: "Turkish", chars: "çğıİöşüÇĞÖŞÜ" },
  { id: "is", label: "Icelandic", chars: "áðéíóúýþæöÁÐÉÍÓÚÝÞÆÖ" },
];

// How a flagged character is rewritten when folding to ASCII.
// "semantic": its NFKC identity, e.g. bold/italic/monospace "𝟷" -> "1", what
//   the character actually represents. Falls back to the visual match below
//   for characters with no such identity (e.g. genuine other-script letters).
// "visual": the raw UTS #39 anti-spoofing match, e.g. Cyrillic "а" -> "a", but
//   also monospace digit "𝟷" -> "l" and monospace "𝚖" -> "rn" (the classic
//   rn/m substitution), chosen for visual collision risk, not identity.
const FOLD_MODES = [
  { id: "semantic", label: "Semantic (what it represents)" },
  { id: "visual", label: "Visual / security match (UTS #39)" },
];

export default {
  id: "homoglyph-finder",
  title: "Homoglyph Finder",
  category: "Text Tools",
  icon: "🕵️",
  description: "Detect look-alike characters used to spoof URLs and usernames (Cyrillic 'а' posing as Latin 'a'), then fold them back to ASCII. Pick your language so its own letters (e.g. Swedish å ä ö) are kept as legitimate.",
  tags: ["homoglyph", "confusable", "spoof", "phishing", "security", "ascii", "punycode", "idn", "language", "swedish", "accents", "locale"],

  async mount(root) {
    const loading = h.div({ class: "notice info", text: "Loading the homoglyph database..." });
    root.appendChild(loading);
    let data;
    try {
      data = await loadHomoglyphs();
    } catch (e) {
      loading.className = "notice err";
      loading.textContent = "Could not load the homoglyph database: " + e.message + " (serve over HTTP).";
      return;
    }
    loading.remove();

    const input = el("textarea", { spellcheck: "false", placeholder: "Paste a URL, username or string to check..." });
    input.value = "ехample.com  аdmin  lоgіn";  // Cyrillic е х а о і disguised as Latin

    // Scripts the user wants to treat as homoglyphs (i.e. flag + fold).
    // Everything in the dataset is non-Latin by construction, so default = all on.
    const enabledScripts = new Set(); // filled when scripts are first seen

    // Expected language: its letters are allowed (never flagged/folded).
    let langId = "";
    let allowedSet = new Set();

    // What a flagged character folds to, see FOLD_MODES above.
    let foldMode = "semantic";
    function foldTarget(info) {
      return foldMode === "semantic" && info.semantic ? info.semantic : info.ascii;
    }
    const currentLang = () => LANGUAGES.find((l) => l.id === langId);
    function rebuildAllowed() {
      const lang = currentLang();
      allowedSet = new Set(lang && lang.chars ? [...lang.chars].map((c) => c.codePointAt(0)) : []);
    }
    // A dataset hit is "allowed" when the chosen language declares it legitimate.
    function isAllowed(cp, info) {
      if (!info) return false;
      const lang = currentLang();
      if (lang && lang.latinAny) return info.script === "Latin";
      return allowedSet.has(cp);
    }

    const highlighted = h.div({ class: "hg-output" });
    const scriptChips = h.div({ class: "chip-row", style: { marginBottom: "14px" } });
    const summary = h.div();
    const folded = h.div();

    function analyze() {
      const text = input.value;
      const perScript = new Map();    // script -> count
      const flagged = [];             // { cp, ch, info }
      const scriptsPresent = new Set();
      let hasAsciiLetter = false;
      let allowedCount = 0;           // homoglyphs kept as legitimate by language

      for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (/[A-Za-z]/.test(ch)) hasAsciiLetter = true;
        const info = data.map.get(cp);
        if (!info) continue;
        if (isAllowed(cp, info)) { allowedCount++; continue; } // legitimate for this language
        flagged.push({ cp, ch, info });
        perScript.set(info.script, (perScript.get(info.script) || 0) + 1);
        if (/[a-z]/i.test(info.ascii)) scriptsPresent.add(info.script);
      }

      // First sighting of a script defaults it to enabled.
      for (const s of perScript.keys()) if (!seenScripts.has(s)) { seenScripts.add(s); enabledScripts.add(s); }

      renderScriptChips(perScript);
      renderHighlight(text);
      renderSummary(flagged, perScript, scriptsPresent, hasAsciiLetter, allowedCount);
      renderFolded(text);
    }

    const seenScripts = new Set();

    function renderScriptChips(perScript) {
      scriptChips.innerHTML = "";
      if (perScript.size === 0) return;
      scriptChips.appendChild(h.span({ class: "lbl", style: { width: "100%", color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "2px" }, text: "Treat these scripts as homoglyphs (toggle off to allow as legitimate):" }));
      [...perScript.entries()].sort((a, b) => b[1] - a[1]).forEach(([script, count]) => {
        const on = enabledScripts.has(script);
        const c = h.button({ class: "chip" + (on ? " active" : ""), text: `${script} (${count})` });
        c.addEventListener("click", () => {
          if (enabledScripts.has(script)) enabledScripts.delete(script);
          else enabledScripts.add(script);
          analyze();
        });
        scriptChips.appendChild(c);
      });
    }

    function renderHighlight(text) {
      highlighted.innerHTML = "";
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        const info = data.map.get(cp);
        if (info && isAllowed(cp, info)) {
          highlighted.appendChild(h.span({
            class: "hg-allow",
            title: `${info.name} (${codePointHex(cp)}), kept as legitimate for ${currentLang().label}`,
            text: ch,
          }));
        } else if (info && enabledScripts.has(info.script)) {
          const semanticNote = info.semantic && info.semantic !== info.ascii ? `, represents “${info.semantic}”` : "";
          highlighted.appendChild(h.span({
            class: "hg-mark",
            title: `${info.name} (${codePointHex(cp)}), ${info.script}, looks like “${info.ascii}”${semanticNote}`,
            text: ch,
          }));
        } else {
          highlighted.appendChild(document.createTextNode(ch === "\n" ? "\n" : ch));
        }
      }
    }

    function renderSummary(flagged, perScript, scriptsPresent, hasAsciiLetter, allowedCount) {
      summary.innerHTML = "";
      const active = flagged.filter((f) => enabledScripts.has(f.info.script));

      const allowedNote = allowedCount
        ? h.div({ class: "notice ok", style: { marginBottom: "12px" } }, [
            `${num(allowedCount)} character${allowedCount === 1 ? "" : "s"} kept as legitimate for `,
            h.strong({ text: currentLang().label }),
            ".",
          ])
        : null;

      if (flagged.length === 0) {
        if (allowedNote) summary.appendChild(allowedNote);
        summary.appendChild(h.div({ class: "notice ok", text: allowedCount
          ? "✓ No suspicious homoglyphs; the look-alikes present are all legitimate for the selected language."
          : "✓ No homoglyph characters found; this string is plain ASCII or uses no known look-alikes." }));
        return;
      }
      if (allowedNote) summary.appendChild(allowedNote);

      // Mixed-script spoof signal: ASCII letters + letters from another script.
      const letterScripts = new Set(scriptsPresent);
      if (hasAsciiLetter) letterScripts.add("Latin");
      if (letterScripts.size > 1) {
        summary.appendChild(h.div({ class: "notice err", style: { marginBottom: "12px" } }, [
          h.strong({ text: "⚠ Mixed-script string. " }),
          `Combines ${[...letterScripts].join(" + ")}. This is the classic signature of a spoofed domain or username.`,
        ]));
      }

      const list = h.div({ class: "hg-list" });
      // unique by codepoint
      const uniq = new Map();
      for (const f of active) {
        const r = uniq.get(f.cp) || { ...f, count: 0 };
        r.count++; uniq.set(f.cp, r);
      }
      [...uniq.values()].sort((a, b) => a.cp - b.cp).forEach((f) => {
        list.appendChild(h.div({ class: "hg-row" }, [
          h.span({ class: "hg-glyph", text: f.ch }),
          h.span({ class: "hg-arrow", text: "→" }),
          h.span({ class: "hg-ascii mono", text: foldTarget(f.info) }),
          h.span({ class: "mono faint", text: codePointHex(f.cp) }),
          h.span({ text: f.info.name }),
          h.span({ class: "hg-script", text: f.info.script }),
          h.span({ class: "faint", style: { marginLeft: "auto" }, text: `×${f.count}` }),
        ]));
      });

      summary.append(
        h.div({ class: "stat-grid", style: { marginBottom: "14px" } }, [
          statBox(num(active.length), "Homoglyph characters", active.length > 0),
          statBox(num(uniq.size), "Distinct"),
          statBox(num(perScript.size), "Scripts involved"),
        ]),
        h.div({ class: "panel" }, [list]),
      );
    }

    function statBox(val, lbl, warn) {
      return h.div({ class: "stat" }, [
        h.div({ class: "stat-val", text: val, style: warn ? { color: "var(--accent-warm)" } : {} }),
        h.div({ class: "stat-lbl", text: lbl }),
      ]);
    }

    function renderFolded(text) {
      folded.innerHTML = "";
      let out = "";
      let changed = false;
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        const info = data.map.get(cp);
        if (info && !isAllowed(cp, info) && enabledScripts.has(info.script)) { out += foldTarget(info); changed = true; }
        else out += ch; // plain, or a letter the chosen language keeps as legitimate
      }
      const copyBtn = h.button({ class: "btn", text: "Copy ASCII" });
      copyBtn.addEventListener("click", () => copy(out));
      folded.append(
        h.div({ class: "lbl", style: { color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "8px" }, text: changed ? "Folded to ASCII" : "Folded to ASCII (unchanged, nothing to fold)" }),
        h.div({ class: "output-box mono", text: out || " " }),
        h.div({ style: { marginTop: "10px" } }, [copyBtn]),
      );
    }

    const langSelect = el("select");
    for (const l of LANGUAGES) langSelect.appendChild(el("option", { value: l.id, text: l.label }));
    langSelect.value = langId;
    langSelect.addEventListener("change", () => { langId = langSelect.value; rebuildAllowed(); analyze(); });

    const foldSelect = el("select");
    for (const f of FOLD_MODES) foldSelect.appendChild(el("option", { value: f.id, text: f.label }));
    foldSelect.value = foldMode;
    foldSelect.addEventListener("change", () => { foldMode = foldSelect.value; analyze(); });

    input.addEventListener("input", debounce(analyze, 100));

    root.append(
      h.div({ class: "panel" }, [
        el("label", { class: "field" }, [
          h.span({ class: "lbl", text: "String to check" }),
          input,
        ]),
        h.div({ class: "row" }, [
          el("label", { class: "field", style: { marginBottom: "0" } }, [
            h.span({ class: "lbl", text: "Expected language (its letters are kept as legitimate)" }),
            langSelect,
          ]),
          el("label", { class: "field", style: { marginBottom: "0" } }, [
            h.span({ class: "lbl", text: "Fold to ASCII using" }),
            foldSelect,
          ]),
        ]),
      ]),
      scriptChips,
      h.div({ class: "panel" }, [
        h.div({ class: "lbl", style: { color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "8px" }, text: "Highlighted (hover a marker to see what it imitates)" }),
        highlighted,
      ]),
      summary,
      h.div({ class: "panel" }, [folded]),
      h.p({ class: "copy-hint", text: `Homoglyph data: Unicode UTS #39 confusables ${data.confusablesVersion}. Real-world rendering depends on your fonts.` }),
      el("style", { text: `
        .hg-output { background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:14px; min-height:48px; white-space:pre-wrap; word-break:break-word; font-size:1.25rem; line-height:1.8; }
        .hg-mark { background:rgba(255,184,107,0.18); color:var(--accent-warm); border-bottom:2px solid var(--accent-warm); border-radius:3px 3px 0 0; cursor:help; }
        .hg-allow { background:rgba(74,222,128,0.14); color:var(--ok); border-bottom:2px solid var(--ok); border-radius:3px 3px 0 0; cursor:help; }
        .hg-list { display:flex; flex-direction:column; gap:0; }
        .hg-row { display:flex; align-items:center; gap:12px; font-size:0.9rem; padding:7px 0; border-top:1px solid var(--border-soft); }
        .hg-row:first-child { border-top:none; }
        .hg-glyph { font-size:1.3rem; min-width:1.4em; text-align:center; }
        .hg-arrow { color:var(--text-faint); }
        .hg-ascii { font-size:1.1rem; color:var(--accent-2); min-width:1.4em; text-align:center; }
        .hg-script { font-size:0.75rem; background:var(--bg-elev-2); border:1px solid var(--border); border-radius:999px; padding:1px 9px; color:var(--text-dim); }
      ` }),
    );

    analyze();
  },
};
