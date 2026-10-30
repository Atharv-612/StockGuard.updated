/* Alerts: live expiry / low-stock list, status, digest trigger, history. */
(function () {
  const { esc, fmt } = SG;
  let host;

  function cronText(cron) {
    const p = (cron || "").split(" ");
    if (p.length === 6 && p[3] === "*" && p[4] === "*" && p[5] === "*" && /^\d+$/.test(p[1]) && /^\d+$/.test(p[2])) {
      return "Every day at " + p[2].padStart(2, "0") + ":" + p[1].padStart(2, "0");
    }
    return cron;
  }

  async function render(el) {
    host = el;
    const [a, status, history] = await Promise.all([
      SG.get("/api/alerts"), SG.get("/api/alerts/status"), SG.get("/api/alerts/history"),
    ]);

    const alertState = !status.alertsEnabled
      ? ["bg-gray", "&#128277;", 'Stock alerts are turned off. Turn them on in <a href="#/settings">Settings</a>.']
      : ["bg-green", "&#9989;", 'Stock alerts are active. Expiring and low-stock items are tracked in real time.'];

    el.innerHTML = `
      <div class="row row-2-1">
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic" style="background:#dbeafe">&#128276;</span>Stock notifications</h3></div>
          <div class="info-box ${alertState[0]}"><span class="ic">${alertState[1]}</span><div>${alertState[2]}</div></div>
          <dl class="kv" style="margin:16px 0">
            <dt>Daily digest</dt><dd>${esc(cronText(status.scheduleCron))}</dd>
            <dt>Instant alert</dt><dd>When a sale brings a product down to its low-stock level</dd>
            <dt>Expiry window</dt><dd>${a.expiryAlertDays} days before expiry</dd>
          </dl>
          <button class="btn btn-primary" id="sendNow">&#128276; Trigger alert digest now</button>
        </div>
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-red">&#128276;</span>Needs attention</h3></div>
          <div class="alert-cards" style="grid-template-columns:1fr 1fr">
            ${card("bg-red", a.expired.length, "Expired", "#/stock?filter=expired")}
            ${card("bg-orange", a.expiringSoon.length, "Expiring", "#/stock?filter=expiring")}
            ${card("bg-amber", a.lowStock.length, "Low stock", "#/reports")}
            ${card("bg-gray", a.outOfStock.length, "Out of stock", "#/reports")}
          </div>
        </div>
      </div>

      <div class="row row-2">
        ${batchCard("&#10060; Expired - remove from shelf", "bg-red", a.expired, "No expired stock on the shelf.")}
        ${batchCard("&#9203; Expiring within " + a.expiryAlertDays + " days", "bg-orange", a.expiringSoon, "Nothing expiring soon.")}
      </div>
      <div class="row row-2">
        ${productCard("&#128201; Low stock", a.lowStock, "No low-stock items.")}
        ${productCard("&#128683; Out of stock", a.outOfStock, "Nothing is out of stock.")}
      </div>

      <div class="card">
        <div class="card-head"><h3><span class="chip-ic bg-purple">&#128340;</span>Alert history</h3></div>
        ${history.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>When</th><th>Type</th><th>Status</th><th>Message</th></tr></thead>
          <tbody>${history.map((h) => `<tr>
            <td class="nowrap">${fmt.dateTime(h.createdAt)}</td>
            <td>${{ SCHEDULED: "Daily digest", MANUAL: "Triggered manually", LOW_STOCK: "Low stock (instant)" }[h.trigger] || esc(h.trigger)}</td>
            <td>${statusBadge(h.status)}${h.detail ? `<div class="sub">${esc(h.detail)}</div>` : ""}</td>
            <td><details class="msg"><summary>View message</summary><pre>${esc(h.message)}</pre></details></td></tr>`).join("")}</tbody>
        </table></div>` : SG.emptyHtml("&#128276;", "No alerts recorded yet.")}
      </div>`;

    el.querySelector("#sendNow").addEventListener("click", sendNow);
    el.querySelectorAll("[data-restock]").forEach((b) =>
      b.addEventListener("click", () => SG.openBatchForm(null, Number(b.dataset.restock))));
  }

  function statusBadge(s) {
    const m = { SENT: ["bg-green", "Active"], LOGGED: ["bg-green", "Logged"], FAILED: ["bg-red", "Failed"], NOT_CONFIGURED: ["bg-amber", "Pending"], NO_NUMBER: ["bg-amber", "No contact"] };
    const [c, l] = m[s] || ["bg-gray", s];
    return `<span class="badge ${c}">${l}</span>`;
  }

  function card(cls, n, label, href) {
    return `<a class="alert-card ${cls}" href="${href}"><span class="num">${n}</span><span class="lbl">${label}</span></a>`;
  }

  function batchCard(title, cls, list, empty) {
    return `<div class="card"><div class="card-head"><h3>${title}</h3><div class="spacer"></div><span class="badge plain ${cls}">${list.length}</span></div>
      ${list.length ? `<div class="list">${list.map((b) => `<div class="list-item">
        <div class="grow"><div class="t">${esc(b.productName)}</div><div class="s">Batch ${esc(b.batchNumber)} &middot; ${b.quantity} ${esc(b.unit)} &middot; ${fmt.money(b.value)}</div></div>
        <div style="text-align:right"><div class="fw ${b.expiryStatus === "EXPIRED" ? "text-red" : "text-orange"}">${fmt.days(b.daysToExpiry)}</div><div class="s">${fmt.date(b.expiryDate)}</div></div>
      </div>`).join("")}</div>` : SG.emptyHtml("&#127881;", empty)}</div>`;
  }

  function productCard(title, list, empty) {
    return `<div class="card"><div class="card-head"><h3>${title}</h3><div class="spacer"></div><span class="badge plain bg-amber">${list.length}</span></div>
      ${list.length ? `<div class="list">${list.map((p) => `<div class="list-item">
        <div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.category)} &middot; alert at ${p.lowStockThreshold} ${esc(p.unit)}</div></div>
        <b>${p.sellableStock} ${esc(p.unit)}</b>
        <button class="btn btn-success btn-sm" data-restock="${p.id}">+ Stock</button></div>`).join("")}</div>` : SG.emptyHtml("&#127881;", empty)}</div>`;
  }

  async function sendNow() {
    const btn = document.getElementById("sendNow");
    btn.disabled = true;
    try {
      const r = await SG.post("/api/alerts/send");
      SG.toast("Alert digest generated", "success");
      SG.modal({
        title: "Alert Digest ✅",
        cancelText: "Close",
        body: `<div class="wa-preview">${formatAlertMsg(r.message)}</div>`,
      });
      await render(host);
    } catch (e) {
      SG.toast(e.message, "error");
    } finally {
      const b = document.getElementById("sendNow");
      if (b) b.disabled = false;
    }
  }

  function formatAlertMsg(text) {
    return esc(text).replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
  }

  SG.pages.alerts = { title: "Alerts", render, refresh: () => render(host) };
})();
