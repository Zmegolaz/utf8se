// Licenses / attribution page. Not a tool, so it lives outside the module
// registry and is reached via a special #/license route and a sidebar link.
//
// The verbatim Unicode License v3 below is a legal requirement: the Unicode
// Character Database (Blocks.txt, Scripts.txt) and the UTS #39 confusables data
// are distributed under it, and so are the datasets generated from them
// (public/data/characters.json, public/data/homoglyphs.json). The license is
// satisfied by reproducing this notice in the associated documentation, which
// this page is. Keep the text byte-for-byte identical to
// https://www.unicode.org/license.txt.
import { h, el } from "./lib/dom.js";

const UNICODE_LICENSE_V3 = `UNICODE LICENSE V3

COPYRIGHT AND PERMISSION NOTICE

Copyright © 1991-2026 Unicode, Inc.

NOTICE TO USER: Carefully read the following legal agreement. BY
DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR
SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE
TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT
DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.

Permission is hereby granted, free of charge, to any person obtaining a
copy of data files and any associated documentation (the "Data Files") or
software and any associated documentation (the "Software") to deal in the
Data Files or Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, and/or sell
copies of the Data Files or Software, and to permit persons to whom the
Data Files or Software are furnished to do so, provided that either (a)
this copyright and permission notice appear with all copies of the Data
Files or Software, or (b) this copyright and permission notice appear in
associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
THIRD PARTY RIGHTS.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE
BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA
FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall
not be used in advertising or otherwise to promote the sale, use or other
dealings in these Data Files or Software without prior written
authorization of the copyright holder.`;

export function renderLicense() {
  document.title = "Licenses & attribution · utf8.se";

  return h.div({}, [
    h.div({ class: "view-head" }, [
      h.h1({}, [h.span({ class: "icon", text: "📜" }), document.createTextNode(" Licenses & attribution")]),
      h.p({ text: "utf8.se is open source. It also bundles Unicode data, both the original files and datasets generated from them, used under the terms reproduced below." }),
    ]),

    h.div({ class: "panel" }, [
      h.h2({ text: "utf8.se" }),
      h.p({ class: "dim" }, [
        "This site's own code is free software, licensed under the ",
        el("a", { href: "https://www.gnu.org/licenses/gpl-3.0.html", target: "_blank", rel: "noopener" }, ["GNU General Public License v3.0"]),
        ". You are free to use, study, share and modify it under those terms.",
      ]),
      h.p({ class: "dim" }, [
        "Source code: ",
        el("a", { href: "https://github.com/Zmegolaz/utf8se", target: "_blank", rel: "noopener" }, ["github.com/Zmegolaz/utf8se"]),
        ".",
      ]),
    ]),

    h.div({ class: "panel" }, [
      h.h2({ text: "Unicode data" }),
      h.p({ class: "dim" }, [
        "The character names, blocks and scripts, and the confusable / homoglyph mappings come from the ",
        el("a", { href: "https://www.unicode.org/ucd/", target: "_blank", rel: "noopener" }, ["Unicode Character Database"]),
        " (Blocks.txt, Scripts.txt) and ",
        el("a", { href: "https://www.unicode.org/reports/tr39/", target: "_blank", rel: "noopener" }, ["UTS #39"]),
        " (confusables.txt). The generated datasets shipped with this site (",
        h.code({ text: "characters.json" }),
        ", ",
        h.code({ text: "homoglyphs.json" }),
        ") are derived from that data and are covered by the same license.",
      ]),
      h.p({ class: "dim" }, [
        "Full terms: ",
        el("a", { href: "https://www.unicode.org/license.txt", target: "_blank", rel: "noopener" }, ["unicode.org/license.txt"]),
        ".",
      ]),
      h.pre({ class: "license-text", text: UNICODE_LICENSE_V3 }),
    ]),
  ]);
}
