/* Reports: sales (daily / monthly), top products, reorder advice, waste, stock. */
(function () {
  const { esc, fmt } = SG;
  const state = { from: SG.addDays(SG.today(), -29), to: SG.today(), year: new Date().getFullYear(), topDays: 7 };
  let data = {};

  async function render(el) {
    const thisYear = new Date().getFullYear();
    el.innerHTML = `
      <div class="card">
        <div class="toolbar" style="margin:0">
          <div class="seg" id="rQuick">
            <button type="button" data-q="7">7 days</button>
            <button type="button" data-q="30">30 days</button>
            <button type="button" data-q="month">This month</button>
            <button type="button" data-q="90">90 days</button>
          </div>
          <div class="spacer"></div>
          <input class="input" type="date" id="rFrom" value="${state.from}"><span class="muted">to</span>
          <input class="input" type="date" id="rTo" value="${state.to}">
        </div>
      </div>
      <div class="stats" id="rKpis"></div>

      <div class="card">
        <div class="card-head"><h3><span class="chip-ic bg-blue">&#128200;</span>Daily sales</h3><div class="spacer"></div>
          <button class="btn btn-outline btn-sm" id="exDaily">&#11015; CSV</button></div>
        <div class="chart-box" id="rDaily"></div>
      </div>

      <div class="row row-2">
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-purple">&#128197;</span>Monthly sales</h3><div class="spacer"></div>
            <select class="input" id="rYear" style="width:auto">${[0, 1, 2].map((i) => `<option ${thisYear - i === state.year ? "selected" : ""}>${thisYear - i}</option>`).join("")}</select></div>
          <div class="chart-box" id="rMonthly"></div>
        </div>
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-green">&#11088;</span>Top products</h3><div class="spacer"></div>
            <select class="input" id="rTopDays" style="width:auto">
              <option value="7">This week</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>
          <div id="rTop"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3><span class="chip-ic bg-orange">&#128722;</span>Reorder suggestions</h3>
          <span class="muted">Based on the last 30 days of sales &mdash; order only what sells.</span><div class="spacer"></div>
          <button class="btn btn-outline btn-sm" id="exReorder">&#11015; CSV</button></div>
        <div id="rReorder"></div>
      </div>

      <div class="row row-2-1">
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-teal">&#128230;</span>Stock report</h3><div class="spacer"></div>
            <button class="btn btn-outline btn-sm" id="exStock">&#11015; CSV</button></div>
          <div id="rStock"></div>
        </div>
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-red">&#128465;</span>Waste &amp; losses</h3></div>
          <div id="rWaste"></div>
        </div>
      </div>`;

    el.querySelector("#rTopDays").value = String(state.topDays);
    el.querySelectorAll("#rQuick button").forEach((b) => b.addEventListener("click", () => {
      const q = b.dataset.q;
      state.to = SG.today();
      state.from = q === "month" ? state.to.slice(0, 8) + "01" : SG.addDays(state.to, -(Number(q) - 1));
      el.querySelector("#rFrom").value = state.from;
      el.querySelector("#rTo").value = state.to;
      loadSales();
    }));
    el.querySelector("#rFrom").addEventListener("change", (e) => { state.from = e.target.value; loadSales(); });
    el.querySelector("#rTo").addEventListener("change", (e) => { state.to = e.target.value; loadSales(); });
    el.querySelector("#rYear").addEventListener("change", (e) => { state.year = Number(e.target.value); loadMonthly(); });
    el.querySelector("#rTopDays").addEventListener("change", (e) => { state.topDays = Number(e.target.value); loadTop(); });
    el.querySelector("#exDaily").addEventListener("click", exportDaily);
    el.querySelector("#exReorder").addEventListener("click", exportReorder);
    el.querySelector("#exStock").addEventListener("click", exportStock);
    await load();
  }

  const load = () => Promise.all([loadSales(), loadMonthly(), loadTop(), loadReorder(), loadStock(), loadWaste()]);

  async function loadSales() {
    if (!state.from || !state.to) return;
    try {
      data.sales = await SG.get(`/api/reports/sales?from=${state.from}&to=${state.to}`);
    } catch (e) { return SG.toast(e.message, "error"); }
    const s = data.sales;
    document.getElementById("rKpis").innerHTML = [
      ["bg-green", "&#128176;", "Revenue", fmt.money(s.totalRevenue)],
      ["bg-blue", "&#128230;", "Items sold", fmt.num(s.totalItems)],
      ["bg-purple", "&#129534;", "Bills", fmt.num(s.totalBills)],
      ["bg-orange", "&#128202;", "Average bill", fmt.money(s.totalBills ? s.totalRevenue / s.totalBills : 0)],
    ].map(([c, i, l, v]) => `<div class="stat"><div class="ic ${c}">${i}</div><div><div class="label">${l}</div><div class="value">${v}</div></div></div>`).join("");
    SG.barChart(document.getElementById("rDaily"), s.daily.map((d) => fmt.shortDate(d.date)),
      s.daily.map((d) => Number(d.revenue)), { money: true, id: "daily", type: s.daily.length > 31 ? "line" : "bar" });
  }

  async function loadMonthly() {
    data.monthly = await SG.get("/api/reports/monthly?year=" + state.year);
    SG.barChart(document.getElementById("rMonthly"), data.monthly.map((m) => SG.MONTHS[m.month - 1]),
      data.monthly.map((m) => Number(m.revenue)), { money: true, id: "monthly" });
  }

  async function loadTop() {
    const list = await SG.get(`/api/reports/top-products?days=${state.topDays}&limit=10`);
    const box = document.getElementById("rTop");
    if (!list.length) { box.innerHTML = SG.emptyHtml("&#128722;", "No sales in this period"); return; }
    const max = Math.max(...list.map((t) => t.quantity));
    box.innerHTML = `<div class="list">${list.map((t, i) => `
      <div class="list-item"><div class="rank ${i < 3 ? ["bg-orange", "bg-blue", "bg-purple"][i] : "bg-gray"}">${i + 1}</div>
        <div class="grow"><div class="t">${esc(t.name)}</div><div class="s">${esc(t.category)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(t.quantity / max) * 100}%"></div></div></div>
        <div class="num" style="text-align:right"><b>${fmt.num(t.quantity)} sold</b><div class="s">${fmt.money(t.revenue)}</div></div></div>`).join("")}</div>`;
  }

  async function loadReorder() {
    data.reorder = await SG.get("/api/reports/reorder");
    const box = document.getElementById("rReorder");
    if (!data.reorder.length) { box.innerHTML = SG.emptyHtml("&#128230;", "Add products to get reorder advice"); return; }
    box.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Product</th><th class="num">In stock</th><th class="num">Sold (30d)</th><th class="num">Avg / day</th>
        <th class="num">Days left</th><th class="num">Order qty</th><th>Advice</th></tr></thead>
      <tbody>${data.reorder.map((r) => `<tr>
        <td class="name">${esc(r.name)}<div class="sub">${esc(r.category)}</div></td>
        <td class="num">${r.currentStock}</td><td class="num">${r.soldLast30Days}</td><td class="num">${r.avgDailySales}</td>
        <td class="num ${r.daysOfStockLeft >= 0 && r.daysOfStockLeft <= 3 ? "text-red fw" : ""}">${r.daysOfStockLeft < 0 ? "-" : r.daysOfStockLeft}</td>
        <td class="num">${r.suggestedOrderQty ? `<span class="badge plain bg-blue">${r.suggestedOrderQty}</span>` : '<span class="muted">0</span>'}</td>
        <td>${esc(r.advice)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  async function loadStock() {
    data.stock = await SG.get("/api/reports/stock");
    const box = document.getElementById("rStock");
    if (!data.stock.length) { box.innerHTML = SG.emptyHtml("&#128230;", "No products yet"); return; }
    const total = data.stock.reduce((s, p) => s + Number(p.stockValue), 0);
    box.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Product</th><th class="num">Stock</th><th>Status</th><th>Nearest expiry</th><th class="num">Value</th></tr></thead>
      <tbody>${data.stock.map((p) => `<tr><td class="name">${esc(p.name)}</td>
        <td class="num">${p.sellableStock} ${esc(p.unit)}</td><td>${SG.stockBadge(p.stockStatus)}</td>
        <td class="nowrap">${p.nearestExpiry ? fmt.date(p.nearestExpiry) : "-"}</td><td class="num">${fmt.money(p.stockValue)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="4">Total stock value</td><td class="num">${fmt.money(total)}</td></tr></tfoot></table></div>`;
  }

  async function loadWaste() {
    const w = await SG.get("/api/reports/waste");
    document.getElementById("rWaste").innerHTML = `
      <div class="alert-card bg-red" style="cursor:default;margin-bottom:12px"><span class="ic">&#10060;</span>
        <span class="lbl">Expired on shelf<small>${w.expiredUnitsOnShelf} units - dispose or return</small></span>
        <span class="num" style="margin-left:auto;font-size:20px">${fmt.money(w.expiredValueOnShelf)}</span></div>
      <div class="alert-card bg-gray" style="cursor:default"><span class="ic">&#128465;</span>
        <span class="lbl">Disposed (all time)<small>${w.disposedUnits} units thrown away</small></span>
        <span class="num" style="margin-left:auto;font-size:20px">${fmt.money(w.disposedValue)}</span></div>
      <p class="muted" style="margin-bottom:0">Tip: watch the <a href="#/stock?filter=expiring">expiring soon</a> list and put those items on discount before they expire.</p>`;
  }

  function exportDaily() {
    if (!data.sales) return;
    SG.downloadCsv(`stockguard-daily-sales-${state.from}-to-${state.to}.csv`, ["Date", "Revenue", "Items", "Bills"],
      data.sales.daily.map((d) => [d.date, d.revenue, d.items, d.bills]));
  }
  function exportReorder() {
    SG.downloadCsv("stockguard-reorder-" + SG.today() + ".csv",
      ["Product", "Category", "In stock", "Sold last 30 days", "Avg per day", "Days of stock left", "Suggested order", "Advice"],
      (data.reorder || []).map((r) => [r.name, r.category, r.currentStock, r.soldLast30Days, r.avgDailySales, r.daysOfStockLeft, r.suggestedOrderQty, r.advice]));
  }
  function exportStock() {
    SG.downloadCsv("stockguard-stock-" + SG.today() + ".csv",
      ["Product", "Category", "Unit", "Price", "In stock", "Expired", "Status", "Nearest expiry", "Value"],
      (data.stock || []).map((p) => [p.name, p.category, p.unit, p.price, p.sellableStock, p.expiredStock, p.stockStatus, p.nearestExpiry, p.stockValue]));
  }

  SG.pages.reports = { title: "Reports", render, refresh: load };
})();
