// Unicode Diff. Compares two strings that look identical but aren't, the bug
// that makes developers question reality. Shows a code-point-level diff,
// normalization equivalence (NFC/NFD/NFKC/NFKD), and labels each difference
// (invisible character? homoglyph? combining mark?). Fully client-side.
import { el, h, num, codePointHex, debounce } from "../lib/dom.js";
import { inspect, placeholderFor, CATEGORY_META } from "../lib/invisibles.js";
import { loadHomoglyphs } from "../lib/homoglyphs.js";

const encoder = new TextEncoder();

// LCS-based diff over code points → ops [['eq'|'del'|'ins', char], ...].
function diffCodePoints(a, b) {
  const A = [...a], B = [...b];
  const n = A.length, m = B.length;
  if (n * m > 1_500_000) return simpleDiff(A, B); // guard against huge inputs
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push(["eq", A[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(["del", A[i++]]); }
    else { ops.push(["ins", B[j++]]); }
  }
  while (i < n) ops.push(["del", A[i++]]);
  while (j < m) ops.push(["ins", B[j++]]);
  return ops;
}

// Fallback for very large inputs: common prefix/suffix, middle as del+ins.
function simpleDiff(A, B) {
  let p = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let s = 0;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  const ops = [];
  for (let i = 0; i < p; i++) ops.push(["eq", A[i]]);
  for (let i = p; i < A.length - s; i++) ops.push(["del", A[i]]);
  for (let j = p; j < B.length - s; j++) ops.push(["ins", B[j]]);
  for (let i = A.length - s; i < A.length; i++) ops.push(["eq", A[i]]);
  return ops;
}

export default {
  id: "unicode-diff",
  title: "Unicode Diff",
  category: "Text Tools",
  icon: "🔬",
  description: "Compare two strings that look identical but aren't. Pinpoints the differing code points and explains them, invisible characters, homoglyphs, normalization.",
  tags: ["diff", "compare", "normalize", "nfc", "homoglyph", "identical", "equal"],

  async mount(root) {
    let homoMap = null;
    loadHomoglyphs().then((d) => { homoMap = d.map; run(); }).catch(() => {});

    const a = el("textarea", { spellcheck: "false", placeholder: "First string" });
    const b = el("textarea", { spellcheck: "false", placeholder: "Second string" });
    a.value = "cafe\u0301";  // é = e + combining acute (U+0065 U+0301)
    b.value = "caf\u00e9";    // é = precomposed (U+00E9)

    const verdict = h.div({ style: { marginBottom: "16px" } });
    const normPanel = h.div();
    const diffView = h.div({ class: "diff-view" });
    const detail = h.div();

    function label(cp) {
      const inv = inspect(cp);
      if (inv) return { text: inv.name, cat: inv.category };
      if (homoMap && homoMap.has(cp)) {
        const hg = homoMap.get(cp);
        return { text: `${hg.name}, homoglyph of “${hg.ascii}” (${hg.script})`, cat: "Homoglyph" };
      }
      // combining mark?
      const ch = String.fromCodePoint(cp);
      if (/\p{M}/u.test(ch)) return { text: "Combining mark", cat: "Combining" };
      return { text: null, cat: null };
    }

    function chip(cp) {
      const inv = inspect(cp);
      const ch = String.fromCodePoint(cp);
      const glyph = inv ? placeholderFor(cp, inv) : (cp === 0x0a ? "⏎" : ch);
      return h.span({ class: "diff-cp", title: codePointHex(cp) + (label(cp).text ? ", " + label(cp).text : "") }, [
        h.span({ class: "diff-glyph", text: glyph }),
        h.span({ class: "diff-hex", text: codePointHex(cp) }),
      ]);
    }

    function run() {
      const sa = a.value, sb = b.value;
      const ops = diffCodePoints(sa, sb);
      const identical = sa === sb;

      // ---- Verdict ----
      verdict.innerHTML = "";
      if (identical) {
        verdict.appendChild(h.div({ class: "notice ok", text: "✓ The two strings are byte-for-byte identical." }));
      } else {
        const sameNFC = sa.normalize("NFC") === sb.normalize("NFC");
        const looksSame = stripInvisible(sa) === stripInvisible(sb);
        verdict.appendChild(h.div({ class: "notice err" }, [
          h.strong({ text: "✗ The strings differ. " }),
          sameNFC ? "They are equal after NFC normalization (likely a composed vs decomposed mismatch)."
            : looksSame ? "They render the same but contain different code points (invisible characters or homoglyphs)."
              : "They differ in visible content.",
        ]));
      }

      // ---- Stats ----
      verdict.appendChild(h.div({ class: "stat-grid", style: { marginTop: "12px" } }, [
        miniStat([...sa].length, [...sb].length, "Code points"),
        miniStat(encoder.encode(sa).length, encoder.encode(sb).length, "UTF-8 bytes"),
        miniStat(graphemes(sa), graphemes(sb), "Graphemes"),
      ]));

      // ---- Normalization matrix ----
      normPanel.innerHTML = "";
      if (!identical) {
        const forms = ["NFC", "NFD", "NFKC", "NFKD"];
        const rows = forms.map((f) => {
          const eq = sa.normalize(f) === sb.normalize(f);
          return h.div({ class: "norm-row" }, [
            h.span({ class: "mono", text: f }),
            h.span({ class: eq ? "norm-eq" : "norm-ne", text: eq ? "equal ✓" : "differ ✗" }),
          ]);
        });
        normPanel.appendChild(h.div({ class: "panel" }, [
          h.div({ class: "lbl", style: { color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "10px" }, text: "Equality under Unicode normalization" }),
          h.div({ class: "norm-grid" }, rows),
        ]));
      }

      // ---- Inline diff ----
      diffView.innerHTML = "";
      for (const [kind, ch] of ops) {
        const cp = ch.codePointAt(0);
        const wrap = h.span({ class: "diff-seg diff-" + kind }, [chip(cp)]);
        diffView.appendChild(wrap);
      }

      // ---- Difference detail ----
      detail.innerHTML = "";
      const diffs = ops.filter(([k]) => k !== "eq");
      if (diffs.length && !identical) {
        const list = h.div({ class: "diff-list" });
        for (const [kind, ch] of diffs) {
          const cp = ch.codePointAt(0);
          const lab = label(cp);
          const meta = CATEGORY_META[lab.cat] || {};
          list.appendChild(h.div({ class: "diff-drow" }, [
            h.span({ class: "diff-side " + kind, text: kind === "del" ? "only in A" : "only in B" }),
            h.span({ class: "diff-glyph2", text: inspect(cp) ? placeholderFor(cp, inspect(cp)) : ch }),
            h.span({ class: "mono", text: codePointHex(cp) }),
            lab.text ? h.span({ style: meta.color ? { color: meta.color } : {}, text: lab.text }) : h.span({ class: "faint", text: "-" }),
          ]));
        }
        detail.appendChild(h.div({ class: "panel" }, [
          h.div({ class: "lbl", style: { color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "8px" }, text: `Differing code points (${diffs.length})` }),
          list,
        ]));
      }
    }

    function miniStat(va, vb, lbl) {
      const same = va === vb;
      return h.div({ class: "stat" }, [
        h.div({ class: "stat-val", style: { fontSize: "1.05rem" } }, [
          h.span({ text: num(va) }),
          h.span({ class: "faint", text: " / " }),
          h.span({ style: same ? {} : { color: "var(--accent-warm)" }, text: num(vb) }),
        ]),
        h.div({ class: "stat-lbl", text: lbl + " (A / B)" }),
      ]);
    }

    input([a, b]);
    function input(els) { els.forEach((e) => e.addEventListener("input", debounce(run, 120))); }

    root.append(
      h.div({ class: "panel" }, [
        h.div({ class: "row", style: { alignItems: "stretch" } }, [
          el("label", { class: "field", style: { marginBottom: 0 } }, [h.span({ class: "lbl", text: "String A" }), a]),
          el("label", { class: "field", style: { marginBottom: 0 } }, [h.span({ class: "lbl", text: "String B" }), b]),
        ]),
      ]),
      verdict,
      normPanel,
      h.div({ class: "panel" }, [
        h.div({ class: "lbl", style: { color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "10px" } }, [
          "Code-point diff, ",
          h.span({ class: "diff-key diff-del", text: "removed" }), " ",
          h.span({ class: "diff-key diff-ins", text: "added" }),
        ]),
        diffView,
      ]),
      detail,
      el("style", { text: `
        .diff-view { display:flex; flex-wrap:wrap; gap:3px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius-sm); padding:12px; min-height:48px; }
        .diff-cp { display:inline-flex; flex-direction:column; align-items:center; padding:3px 5px; border-radius:5px; }
        .diff-glyph { font-size:1.3rem; line-height:1.3; }
        .diff-hex { font-family:var(--mono); font-size:0.6rem; color:var(--text-faint); }
        .diff-seg.diff-eq { opacity:0.75; }
        .diff-seg.diff-del .diff-cp { background:rgba(255,107,107,0.18); outline:1px solid var(--danger); }
        .diff-seg.diff-ins .diff-cp { background:rgba(74,222,128,0.16); outline:1px solid var(--ok); }
        .diff-key { padding:1px 8px; border-radius:4px; font-size:0.8rem; }
        .diff-key.diff-del { background:rgba(255,107,107,0.18); color:#ffc4c4; }
        .diff-key.diff-ins { background:rgba(74,222,128,0.16); color:#b6f3cd; }
        .norm-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; }
        .norm-row { display:flex; justify-content:space-between; background:var(--bg); border:1px solid var(--border-soft); border-radius:var(--radius-sm); padding:9px 12px; }
        .norm-eq { color:var(--ok); font-size:0.85rem; } .norm-ne { color:var(--danger); font-size:0.85rem; }
        .diff-list { display:flex; flex-direction:column; }
        .diff-drow { display:flex; align-items:center; gap:12px; padding:7px 0; border-top:1px solid var(--border-soft); font-size:0.9rem; }
        .diff-drow:first-child { border-top:none; }
        .diff-side { font-size:0.72rem; border-radius:999px; padding:1px 9px; white-space:nowrap; }
        .diff-side.del { background:rgba(255,107,107,0.16); color:#ffc4c4; }
        .diff-side.ins { background:rgba(74,222,128,0.14); color:#b6f3cd; }
        .diff-glyph2 { font-size:1.3rem; min-width:1.4em; text-align:center; }
      ` }),
    );

    run();
  },
};

function stripInvisible(s) {
  return [...s].filter((ch) => !inspect(ch.codePointAt(0))).join("");
}
function graphemes(s) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    let n = 0;
    for (const _ of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)) n++;
    return n;
  }
  return [...s].length;
}
