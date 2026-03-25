/**
 * Hash-based routing for app-shell.html: loads dashboard routes into #app-shell-frame.
 * Route ids must match sidebar data-nav-id and data-shell-base hash targets.
 */
const ROUTES = {
  home: "/Frontend/components/Dashboard/dp.html",
  "exam-home": "/Frontend/components/exam-prep/exam-home.html",
  "my-learning": "/Frontend/components/learning-path/index.html",
};

function routeFromHash() {
  const h = (location.hash || "").replace(/^#/, "").trim();
  return ROUTES[h] ? h : "home";
}

function setActiveSidebar(route) {
  document.querySelector("dashboard-sidebar")?.setAttribute("active-item", route);
}

function applyRoute(route) {
  const path = ROUTES[route];
  if (!path) return;
  const frame = document.getElementById("app-shell-frame");
  if (!frame) return;
  const abs = new URL(path, location.origin).href;
  if (frame.src !== abs) {
    frame.src = path;
  }
  setActiveSidebar(route);
}

function onHashChange() {
  applyRoute(routeFromHash());
}

document.addEventListener("DOMContentLoaded", () => {
  onHashChange();
});

window.addEventListener("hashchange", onHashChange);

document.addEventListener(
  "click",
  (e) => {
    const a = e.target.closest("a.nav-item[data-nav-id]");
    if (!a) return;
    const id = a.dataset.navId;
    if (!ROUTES[id]) return;
    e.preventDefault();
    const current = routeFromHash();
    if (current === id) {
      const frame = document.getElementById("app-shell-frame");
      if (frame) frame.src = ROUTES[id];
    } else {
      location.hash = id;
    }
  },
  true
);
