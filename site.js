(function () {
  // After an auto-refresh, pick up where the viewer was (filter, search, sort, scroll). Saved just
  // before the reload, used once, and only on the same page.
  var RESTORE = "fnf-restore", restored = null;
  try {
    restored = JSON.parse(sessionStorage.getItem(RESTORE) || "null");
    sessionStorage.removeItem(RESTORE);
  } catch (e) { }
  if (restored && restored.path !== location.pathname) restored = null;
  var pageState = function () { return {}; };   // the Matches page fills this in
  var lastSort = null;                          // { table, col, dir } of the last header click

  // Click a column header to sort; click again to reverse. Cells sort by data-sort when present.
  function key(cell, num) {
    var v = cell.hasAttribute("data-sort") ? cell.getAttribute("data-sort") : cell.textContent.trim();
    if (!num) return v.toLowerCase();
    var n = parseFloat(String(v).replace(/[^0-9.+-]/g, ""));
    return isNaN(n) ? null : n;
  }
  var sortables = document.querySelectorAll("table.sortable");
  sortables.forEach(function (table, tableIndex) {
    var heads = table.querySelectorAll("thead th");
    heads.forEach(function (th, col) {
      th.tabIndex = 0;
      function sort() {
        var num = th.getAttribute("data-type") === "num";
        var dir = th.getAttribute("aria-sort") === "descending" ? 1 : -1;
        if (!th.hasAttribute("aria-sort") && !num) dir = 1;
        heads.forEach(function (h) { h.removeAttribute("aria-sort"); });
        th.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");
        var body = table.tBodies[0];
        var rows = Array.prototype.slice.call(body.rows);
        rows.sort(function (a, b) {
          var x = key(a.cells[col], num), y = key(b.cells[col], num);
          if (x === y) return 0;
          if (x === null || x === "") return 1;   // blanks always last
          if (y === null || y === "") return -1;
          return (x < y ? -1 : 1) * dir;
        });
        rows.forEach(function (r) { body.appendChild(r); });
      }
      th.addEventListener("click", function () {
        sort();
        lastSort = { table: tableIndex, col: col, dir: th.getAttribute("aria-sort") };
      });
      th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sort(); } });
    });
  });

  // Matches page: win/loss filter and search.
  var matches = document.getElementById("matches");
  if (matches) {
    var search = document.getElementById("search"), count = document.getElementById("count");
    var mode = "all";
    function apply() {
      var q = search.value.trim().toLowerCase(), shown = 0, wins = 0;
      Array.prototype.forEach.call(matches.tBodies[0].rows, function (r) {
        var ok = (mode === "all" || r.getAttribute("data-result") === mode) &&
                 (!q || r.getAttribute("data-search").indexOf(q) >= 0);
        r.hidden = !ok;
        if (ok) { shown++; if (r.getAttribute("data-result") === "w") wins++; }
      });
      count.textContent = shown + " game(s)" + (shown && mode === "all" ? " · " + wins + "-" + (shown - wins) : "");
    }
    document.querySelectorAll("[data-filter]").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.getAttribute("data-filter");
        document.querySelectorAll("[data-filter]").forEach(function (x) { x.classList.toggle("on", x === b); });
        apply();
      });
    });
    search.addEventListener("input", apply);
    if (restored) {
      if (restored.mode) {
        mode = restored.mode;
        document.querySelectorAll("[data-filter]").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-filter") === mode); });
      }
      if (restored.q) search.value = restored.q;
    }
    pageState = function () { return { mode: mode, q: search.value }; };
    apply();
  }

  // Stats page: switch between the pre-built ranges; the choice is kept in the address (#all, #night…).
  var tabs = document.querySelectorAll("[data-range]");
  if (tabs.length) {
    function show(id) {
      var found = false;
      tabs.forEach(function (t) { var on = t.getAttribute("data-range") === id; t.classList.toggle("on", on); t.setAttribute("aria-selected", on); found = found || on; });
      if (!found) return false;
      document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== id; });
      return true;
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        var id = t.getAttribute("data-range");
        show(id);
        try { history.replaceState(null, "", "#" + id); } catch (e) { }
      });
    });
    if (!show(location.hash.slice(1))) show(tabs[0].getAttribute("data-range"));
  }

  if (restored) {
    // Re-apply the sort by clicking its header (once, or twice to reverse it).
    var s = restored.sort, table = s && sortables[s.table];
    var th = table && table.querySelectorAll("thead th")[s.col];
    if (th) for (var i = 0; i < 2 && th.getAttribute("aria-sort") !== s.dir; i++) th.click();
    if (restored.y) window.scrollTo(0, restored.y);
  }

  // Auto-refresh: every minute (and whenever the tab comes back into view), check version.json.
  // When a newer publish is there, save the viewer's place and reload. Pages opened straight from
  // disk (file://) can't check, so they don't try.
  var meta = document.querySelector('meta[name="fnf-version"]');
  if (meta && /^https?:$/.test(location.protocol) && window.fetch) {
    var current = meta.getAttribute("content"), checking = false, TRIED = "fnf-tried";
    function check() {
      if (checking || document.hidden) return;
      checking = true;
      fetch("version.json?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (v) {
          if (!v || !v.version || v.version === current) return;
          // GitHub can take a moment to serve the new pages everywhere. If a reload for this version
          // still brought back the old page, wait a few minutes before trying again.
          var tried = null;
          try { tried = JSON.parse(sessionStorage.getItem(TRIED) || "null"); } catch (e) { }
          if (tried && tried.v === v.version && Date.now() - tried.at < 3 * 60 * 1000) return;
          try {
            sessionStorage.setItem(TRIED, JSON.stringify({ v: v.version, at: Date.now() }));
            var state = pageState();
            state.path = location.pathname;
            state.y = window.scrollY;
            state.sort = lastSort;
            sessionStorage.setItem(RESTORE, JSON.stringify(state));
          } catch (e) { }
          location.reload();
        })
        .catch(function () { })
        .then(function () { checking = false; });
    }
    setInterval(check, 60 * 1000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) check(); });
  }
})();