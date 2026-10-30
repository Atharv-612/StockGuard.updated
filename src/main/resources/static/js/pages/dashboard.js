/* Dashboard: KPIs, alert summary, 7-day sales, top products, expiring soon, recent sales. */
(function () {
  const { esc, fmt } = SG;
  let host;

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }

  async function render(el) {
    host = el;
    const d = await SG.get("/api/dashboard");
    const max = Math.max(1, ...d.topProductsThisWeek.map((t) => t.quantity));
    const expiringRows = [...d.alerts.expired, ...d.alerts.expiringSoon].slice(0, 7);

    el.innerHTML = `
      <div>
        <h2 style="font-size:22px">${greeting()}, ${esc(SG.user.ownerName.split(" ")[0])} &#128075;</h2>
        <div class="muted">${esc(d.shopName)} &middot; ${fmt.date(SG.today())}</div>
      </div>

      <div class="stats">
        ${stat("bg-blue", "&#128230;", "Products", fmt.num(d.totalProducts))}
        ${stat("bg-teal", "&#128202;", "Units in stock", fmt.num(d.totalUnits))}
        ${stat("bg-purple", "&#128176;", "Stock value", fmt.money(d.stockValue))}
        ${stat("bg-green", "&#129534;", "Today's sales", fmt.money(d.todayRevenue) + ` <small>${d.todayItems} items</small>`)}
        ${stat("bg-orange", "&#128197;", "This month", fmt.money(d.monthRevenue))}
      </div>

      <div class="alert-cards">
        ${alertCard("bg-red", "&#10060;", d.expiredCount, "Expired", "Remove from shelf")}
        ${alertCard("bg-orange", "&#9203;", d.expiringSoonCount, "Expiring soon", "Within " + d.alerts.expiryAlertDays + " days")}
        ${alertCard("bg-amber", "&#128201;", d.lowStockCount, "Low stock", "Reorder soon")}
        ${alertCard("bg-gray", "&#128683;", d.outOfStockCount, "Out of stock", "Missing sales")}
      </div>

      <div class="row row-3-2">
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-blue">&#128200;</span>Sales - last 7 days</h3>
            <div class="spacer"></div><a href="#/reports" class="btn btn-ghost btn-sm">Reports &rarr;</a></div>
          <div class="chart-box" id="dashChart"></div>
        </div>
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-green">&#11088;</span>Top products this week</h3></div>
          ${d.topProductsThisWeek.length ? `<div class="list">${d.topProductsThisWeek.map((t, i) => `
            <div class="list-item">
              <div class="rank ${["bg-orange", "bg-blue", "bg-purple", "bg-green", "bg-gray"][i] || "bg-gray"}">${i + 1}</div>
              <div class="grow"><div class="t">${esc(t.name)}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${(t.quantity / max) * 100}%"></div></div></div>
              <div class="num"><b>${fmt.num(t.quantity)}</b><div class="s">${fmt.money(t.revenue)}</div></div>
            </div>`).join("")}</div>` : SG.emptyHtml("&#128722;", "No sales this week yet")}
        </div>
      </div>

      <div class="row row-3-2">
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-orange">&#9888;&#65039;</span>Expired &amp; expiring soon</h3>
            <div class="spacer"></div><a href="#/stock" class="btn btn-ghost btn-sm">View stock &rarr;</a></div>
          ${expiringRows.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Product</th><th>Batch</th><th class="num">Qty</th><th>Expiry</th><th>Status</th></tr></thead>
            <tbody>${expiringRows.map((b) => `<tr>
              <td class="name">${esc(b.productName)}</td><td>${esc(b.batchNumber)}</td>
              <td class="num">${b.quantity} ${esc(b.unit)}</td>
              <td class="nowrap">${fmt.date(b.expiryDate)}<div class="sub">${fmt.days(b.daysToExpiry)}</div></td>
              <td>${SG.expiryBadge(b.expiryStatus, b.daysToExpiry)}</td></tr>`).join("")}</tbody></table></div>`
            : SG.emptyHtml("&#127881;", "Nothing expiring soon. Great job!")}
        </div>
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-purple">&#129534;</span>Recent sales</h3>
            <div class="spacer"></div><a href="#/sales" class="btn btn-primary btn-sm">+ New sale</a></div>
          ${d.recentSales.length ? `<div class="list">${d.recentSales.map((s) => `
            <div class="list-item">
              <div class="grow"><div class="t">${esc(s.productName)}</div><div class="s">${fmt.dateTime(s.soldAt)} &middot; ${s.quantity} sold</div></div>
              <b>${fmt.money(s.totalAmount)}</b></div>`).join("")}</div>` : SG.emptyHtml("&#129534;", "No sales recorded yet")}
        </div>
      </div>`;

    el.querySelectorAll("[data-go]").forEach((c) => c.addEventListener("click", () => (location.hash = c.dataset.go)));
    SG.barChart(document.getElementById("dashChart"),
      d.last7Days.map((x) => fmt.shortDate(x.date)), d.last7Days.map((x) => Number(x.revenue)),
      { money: true, id: "dash", label: "Revenue" });
  }

  function stat(cls, icon, label, value) {
    return `<div class="stat"><div class="ic ${cls}">${icon}</div><div><div class="label">${label}</div><div class="value">${value}</div></div></div>`;
  }

  function alertCard(cls, icon, n, label, sub) {
    return `<div class="alert-card ${cls}" data-go="#/alerts" role="button" tabindex="0">
      <span class="ic">${icon}</span><span class="num">${n}</span><span class="lbl">${label}<small>${sub}</small></span></div>`;
  }

  SG.pages.dashboard = { title: "Dashboard", render, refresh: () => render(host) };
})();
