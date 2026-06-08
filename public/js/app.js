// App shell: builds the categorized menu, renders the home page, and routes
// between modules using the URL hash (#/<module-id>). Pure client-side.

import { MODULES, CATEGORY_ORDER } from "./registry.js";
import { el, h } from "./lib/dom.js";
import { renderLicense } from "./license.js";

const byId = Object.fromEntries(MODULES.map((m) => [m.id, m]));

const dom = {
  app: document.getElementById("app"),
  view: document.getElementById("view"),
  menu: document.getElementById("menu"),
  search: document.getElementById("menuSearch"),
  brand: document.getElementById("brand"),
  toggle: document.getElementById("menuToggle"),
  scrim: document.getElementById("scrim"),
};

let active = null; // currently mounted module

/* ---------- Menu ---------- */
function groupByCategory(modules) {
  const groups = new Map();
  for (const m of modules) {
    if (!groups.has(m.category)) groups.set(m.category, []);
    groups.get(m.category).push(m);
  }
  // Order categories by CATEGORY_ORDER, then any extras alphabetically.
  const ordered = [...groups.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });
  return ordered.map((cat) => [cat, groups.get(cat)]);
}

function buildMenu(filter = "") {
  dom.menu.innerHTML = "";
  const q = filter.trim().toLowerCase();
  const match = (m) =>
    !q ||
    m.title.toLowerCase().includes(q) ||
    m.category.toLowerCase().includes(q) ||
    (m.description || "").toLowerCase().includes(q) ||
    (m.tags || []).some((t) => t.toLowerCase().includes(q));

  for (const [cat, mods] of groupByCategory(MODULES)) {
    const visible = mods.filter(match);
    if (!visible.length) continue;
    const group = h.div({ class: "menu-group" }, [
      h.div({ class: "menu-group-title", text: cat }),
    ]);
    for (const m of visible) {
      group.appendChild(
        el("a", {
          class: "menu-item",
          href: "#/" + m.id,
          dataset: { id: m.id },
        }, [
          h.span({ class: "mi-icon", text: m.icon || "•" }),
          h.span({ class: "mi-title", text: m.title }),
        ])
      );
    }
    dom.menu.appendChild(group);
  }
  highlightActive();
}

function highlightActive() {
  const current = location.hash.replace(/^#\//, "");
  dom.menu.querySelectorAll(".menu-item").forEach((a) =>
    a.classList.toggle("active", a.dataset.id === current)
  );
}

/* ---------- Home page ---------- */
function renderHome() {
  document.title = "utf8.se, the UTF-8 toolbox";
  const view = h.div({}, [
    h.div({ class: "hero" }, [
      h.h1({ text: "The UTF-8 toolbox" }),
      h.p({ text: "A growing kit of browser-based tools for working with Unicode and UTF-8, plus a few quirky experiments. Everything runs locally; nothing is uploaded." }),
      h.div({ class: "hero-glyphs", text: "𝖀 ⊤ 𝖥 𝟪 · 文字 · ᚛ᚑᚌᚆᚐᚋ᚜ · 𓂀" }),
    ]),
  ]);

  for (const [cat, mods] of groupByCategory(MODULES)) {
    const grid = h.div({ class: "card-grid" });
    for (const m of mods) {
      grid.appendChild(
        el("a", { class: "card", href: "#/" + m.id }, [
          h.div({ class: "card-icon", text: m.icon || "•" }),
          h.h3({ text: m.title }),
          h.p({ text: m.description || "" }),
        ])
      );
    }
    view.appendChild(h.div({ class: "home-category" }, [h.h2({ text: cat }), grid]));
  }

  swapView(view);
}

/* ---------- Routing ---------- */
function swapView(node) {
  if (active && typeof active.unmount === "function") {
    try { active.unmount(); } catch (e) { console.error(e); }
  }
  active = null;
  dom.view.innerHTML = "";
  dom.view.appendChild(node);
  dom.view.scrollIntoView({ block: "start" });
  window.scrollTo(0, 0);
}

async function renderModule(m) {
  document.title = `${m.title} · utf8.se`;
  const root = h.div({}, [
    h.div({ class: "view-head" }, [
      h.h1({}, [h.span({ class: "icon", text: m.icon || "" }), document.createTextNode(" " + m.title)]),
      m.description ? h.p({ text: m.description }) : null,
    ]),
  ]);
  const mountPoint = h.div({ class: "module-root" });
  root.appendChild(mountPoint);
  swapView(root);

  try {
    const result = m.mount(mountPoint);
    active = m;
    if (result && typeof result.then === "function") await result;
  } catch (e) {
    console.error(e);
    mountPoint.appendChild(h.div({ class: "notice err", text: "This tool failed to load: " + e.message }));
  }
}

function route() {
  highlightActive();
  closeMenu();
  const id = location.hash.replace(/^#\//, "");
  if (!id) return renderHome();
  if (id === "license") return swapView(renderLicense());
  const m = byId[id];
  if (!m) {
    swapView(h.div({}, [
      h.div({ class: "view-head" }, [h.h1({ text: "Not found" })]),
      h.p({ class: "dim", text: "No tool matches “" + id + "”." }),
      h.p({}, [el("a", { href: "#/" }, ["← Back home"])]),
    ]));
    return;
  }
  renderModule(m);
}

/* ---------- Mobile menu ---------- */
function closeMenu() { dom.app.classList.remove("menu-open"); }
dom.toggle.addEventListener("click", () => dom.app.classList.toggle("menu-open"));
dom.scrim.addEventListener("click", closeMenu);

/* ---------- Wire-up ---------- */
dom.brand.addEventListener("click", () => { location.hash = "#/"; });
dom.search.addEventListener("input", () => buildMenu(dom.search.value));
window.addEventListener("hashchange", route);

buildMenu();
route();
