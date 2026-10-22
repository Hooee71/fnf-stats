(function () {
  // Click a column header to sort; click again to reverse. Cells sort by data-sort when present.
  function key(cell, num) {
    var v = cell.hasAttribute("data-sort") ? cell.getAttribute("data-sort") : cell.textContent.trim();
    if (!num) return v.toLowerCase();
    var n = parseFloat(String(v).replace(/[^0-9.+-]/g, ""));
    return isNaN(n) ? null : n;
  }
  document.querySelectorAll("table.sortable").forEach(function (table) {
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
      th.addEventListener("click", sort);
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
})();