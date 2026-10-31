/* App shell: hash router, header, real-time updates (Server-Sent Events), charts. */
(function () {
  const SG = window.SG;
  SG.pages = {};
  SG.charts = {};

  const $ = (id) => document.getElementById(id);
  let currentPage = null;
  let pendingRefresh = false;

  SG.start = async function () {
    if (!SG.auth.token()) {
      location.replace("index.html");
      return;
    }
    $("logo").insertAdjacentHTML("afterbegin", SG.logoSvg);
    $("logoutBtn").addEventListener("click", SG.auth.logout);
    $("menuBtn").addEventListener("click", () => $("app").classList.toggle("nav-open"));
    $("nav").addEventListener("click", () => $("app").classList.remove("nav-open"));

    const cached = SG.auth.user();
    if (cached) SG.setUser(cached);
    try {
      SG.setUser(await SG.get("/api/auth/me"));
    } catch (e) {
      return; // 401 already redirected
    }

    window.addEventListener("hashchange", () => SG.render());
    SG.render();
    connectLive();
    SG.refreshAlertCount();
    setInterval(SG.refreshAlertCount, 60000);
  };

  SG.setUser = function (user) {
    if (!user) return;
    SG.user = user;
    SG.auth.save(user.token ? user : { user });
    if ($("ownerName")) $("ownerName").textContent = user.ownerName || "";
    if ($("shopName")) $("shopName").textContent = user.shopName || "";
    if ($("sideShop")) $("sideShop").textContent = user.shopName || "";
    if ($("sideOwner")) $("sideOwner").textContent = user.ownerName || "";
    if ($("avatar")) $("avatar").textContent = (user.ownerName || "S").trim().charAt(0).toUpperCase();
  };

  // ---------- Router ----------
  SG.render = async function () {
    const name = (location.hash.replace(/^#\/?/, "") || "dashboard").split("?")[0];
    const page = SG.pages[name] || SG.pages.dashboard;
    const pageName = SG.pages[name] ? name : "dashboard";
    currentPage = page;
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.page === pageName));
    $("pageTitle").textContent = page.title;
    document.title = page.title + " - StockGuard";
    Object.values(SG.charts).forEach((c) => c.destroy && c.destroy());
    SG.charts = {};

    const content = $("content");
    content.innerHTML = SG.loadingHtml;
    try {
      await page.render(content);
    } catch (e) {
      content.innerHTML = `<div class="card">${SG.emptyHtml("⚠️", SG.esc(e.message))}</div>`;
    }
  };

  /** Re-load data on the current page without resetting filters, cart or scroll. */
  SG.refreshCurrent = async function () {
    if (!currentPage) return;
    if (SG.modalOpen) {
      pendingRefresh = true;
      return;
    }
    pendingRefresh = false;
    try {
      if (currentPage.refresh) await currentPage.refresh();
      else await currentPage.render($("content"));
    } catch (e) {
      /* keep the old view if a background refresh fails */
    }
  };
  SG.afterModalClose = function () {
    if (pendingRefresh) SG.refreshCurrent();
  };

  // ---------- Real-time updates ----------
  function setLive(on, text) {
    $("live").classList.toggle("on", on);
    $("live").querySelector(".txt").textContent = text;
  }

  function connectLive() {
    if (!window.EventSource) {
      setLive(false, "Auto-refresh");
      setInterval(SG.refreshCurrent, 30000);
      return;
    }
    const base = (SG.getBaseUrl ? SG.getBaseUrl() : "").replace(/\/+$/, "");
    const es = new EventSource(base + "/api/events?token=" + encodeURIComponent(SG.auth.token()));
    const refresh = SG.debounce(() => {
      SG.refreshCurrent();
      SG.refreshAlertCount();
    }, 400);
    es.addEventListener("connected", () => setLive(true, "Live"));
    es.addEventListener("inventory", refresh);
    es.onerror = () => {
      setLive(false, "Reconnecting");
      if (es.readyState === EventSource.CLOSED) setTimeout(connectLive, 10000);
    };
  }

  SG.refreshAlertCount = async function () {
    try {
      const a = await SG.get("/api/alerts");
      const total = a.expiringSoon.length + a.expired.length + a.lowStock.length + a.outOfStock.length;
      const el = $("alertCount");
      el.textContent = total;
      el.hidden = total === 0;
    } catch (e) { /* ignore */ }
  };

  // ---------- Charts (Chart.js, with a plain-CSS fallback when offline) ----------
  SG.barChart = function (host, labels, values, opts = {}) {
    if (!window.Chart) {
      const max = Math.max(1, ...values);
      host.innerHTML = `<div class="chart-fallback">${values
        .map((v, i) => `<div class="b" style="height:${(v / max) * 100}%" title="${SG.esc(labels[i])}: ${SG.esc(opts.money ? SG.fmt.money(v) : v)}"><span>${SG.esc(labels[i])}</span></div>`)
        .join("")}</div>`;
      return;
    }
    host.innerHTML = "<canvas></canvas>";
    const ctx = host.querySelector("canvas");
    const id = opts.id || Math.random().toString(36).slice(2);
    if (SG.charts[id]) SG.charts[id].destroy();
    SG.charts[id] = new Chart(ctx, {
      type: opts.type || "bar",
      data: {
        labels,
        datasets: [{
          label: opts.label || "",
          data: values,
          backgroundColor: opts.type === "line" ? "rgba(37,99,235,.12)" : "rgba(37,99,235,.85)",
          borderColor: "#2563eb",
          borderWidth: opts.type === "line" ? 2.5 : 0,
          borderRadius: 6,
          fill: opts.type === "line",
          tension: 0.35,
          pointRadius: opts.type === "line" ? 3 : 0,
          maxBarThickness: 42,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => (opts.money ? SG.fmt.money(c.parsed.y) : SG.fmt.num(c.parsed.y)) } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#6b7790", font: { size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: "#eef2f8" },
            ticks: { color: "#6b7790", font: { size: 11 }, callback: (v) => (opts.money ? "₹" + SG.fmt.num(v) : v) },
          },
        },
      },
    });
  };
})();
