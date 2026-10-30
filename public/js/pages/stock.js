/* Stock & Expiry: batches with batch numbers and expiry dates. */
(function () {
  const { esc, fmt } = SG;
  const FILTERS = [
    ["instock", "In stock"],
    ["expiring", "Expiring soon"],
    ["expired", "Expired"],
    ["all", "All batches"],
    ["disposed", "Disposed"],
  ];
  const state = { filter: "instock", search: "" };
  let batches = [];
  let tableHost;

  async function render(el) {
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    if (params.get("filter")) state.filter = params.get("filter");
    el.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="seg" id="bSeg">${FILTERS.map(([k, l]) => `<button type="button" data-f="${k}" class="${state.filter === k ? "active" : ""}">${l}</button>`).join("")}</div>
          <input class="input search" id="bSearch" type="search" placeholder="Search product or batch..." value="${esc(state.search)}">
          <button class="btn btn-outline" id="bExport">&#11015; Export CSV</button>
          <button class="btn btn-success" id="bAdd">+ Add stock batch</button>
        </div>
        <div id="bTable">${SG.loadingHtml}</div>
      </div>
      <div class="info-box bg-blue"><span class="ic">&#128161;</span>
        <div>Sales automatically take stock from the batch that expires first (FEFO), so older stock sells before it goes bad.
        Expired batches can't be sold &mdash; use <b>Dispose</b> to remove them; they are counted as waste in Reports.</div></div>`;
    tableHost = el.querySelector("#bTable");
    el.querySelectorAll("#bSeg button").forEach((b) => b.addEventListener("click", () => {
      state.filter = b.dataset.f;
      el.querySelectorAll("#bSeg button").forEach((x) => x.classList.toggle("active", x === b));
      load();
    }));
    el.querySelector("#bSearch").addEventListener("input", SG.debounce((e) => { state.search = e.target.value; draw(); }, 150));
    el.querySelector("#bAdd").addEventListener("click", () => SG.openBatchForm());
    el.querySelector("#bExport").addEventListener("click", exportCsv);
    await load();
  }

  async function load() {
    batches = await SG.get("/api/batches?filter=" + state.filter);
    draw();
  }

  function filtered() {
    const q = state.search.toLowerCase();
    return batches.filter((b) => !q || b.productName.toLowerCase().includes(q) || b.batchNumber.toLowerCase().includes(q));
  }

  function draw() {
    const list = filtered();
    if (!list.length) {
      const msg = { expiring: "No batches expiring soon &#127881;", expired: "No expired stock on the shelf &#127881;", disposed: "Nothing disposed yet" }[state.filter]
        || "No stock batches yet. Click <b>+ Add stock batch</b> to record a delivery.";
      tableHost.innerHTML = SG.emptyHtml("&#128197;", state.search ? "No batches match your search." : msg);
      return;
    }
    const disposed = state.filter === "disposed";
    tableHost.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Product</th><th>Batch no.</th><th class="num">Qty left</th><th>Purchased</th><th>Expiry date</th>
        <th>Days left</th><th>Status</th><th class="num">Value</th>${disposed ? "" : '<th class="actions">Actions</th>'}</tr></thead>
      <tbody>${list.map((b) => `<tr>
        <td><div class="name">${esc(b.productName)}</div><div class="sub">${esc(b.category)}</div></td>
        <td>${esc(b.batchNumber)}</td>
        <td class="num"><b>${b.quantity}</b> ${esc(b.unit)}<div class="sub">of ${b.initialQuantity}</div></td>
        <td class="nowrap">${fmt.date(b.purchaseDate)}</td>
        <td class="nowrap">${b.expiryDate ? fmt.date(b.expiryDate) : '<span class="muted">No expiry</span>'}</td>
        <td class="nowrap ${b.expiryStatus === "EXPIRED" ? "text-red fw" : b.expiryStatus === "EXPIRING_SOON" ? "text-orange fw" : ""}">${fmt.days(b.daysToExpiry)}</td>
        <td>${disposed ? '<span class="badge bg-gray">Disposed</span>' : SG.expiryBadge(b.expiryStatus, b.daysToExpiry)}</td>
        <td class="num">${fmt.money(b.value)}</td>
        ${disposed ? "" : `<td class="actions">
          ${b.expiryStatus === "EXPIRED" ? `<button class="btn btn-danger btn-sm" data-dispose="${b.id}">Dispose</button>` : ""}
          <button class="btn btn-outline btn-sm" data-edit="${b.id}">Edit</button>
          <button class="btn btn-ghost btn-sm text-red" data-del="${b.id}" title="Delete">&#128465;</button></td>`}
        </tr>`).join("")}</tbody></table></div>`;

    const byId = (id) => batches.find((b) => b.id === Number(id));
    tableHost.querySelectorAll("[data-edit]").forEach((x) => x.addEventListener("click", () => SG.openBatchForm(byId(x.dataset.edit))));
    tableHost.querySelectorAll("[data-del]").forEach((x) => x.addEventListener("click", () => remove(byId(x.dataset.del))));
    tableHost.querySelectorAll("[data-dispose]").forEach((x) => x.addEventListener("click", () => dispose(byId(x.dataset.dispose))));
  }

  async function dispose(b) {
    const ok = await SG.confirm("Dispose expired stock",
      `Remove <b>${b.quantity} ${esc(b.unit)}</b> of <b>${esc(b.productName)}</b> (batch ${esc(b.batchNumber)}) from stock? It will be recorded as waste worth <b>${fmt.money(b.value)}</b>.`,
      "Dispose");
    if (!ok) return;
    try {
      await SG.post("/api/batches/" + b.id + "/dispose");
      SG.toast("Batch disposed", "success");
      await load();
    } catch (e) { SG.toast(e.message, "error"); }
  }

  async function remove(b) {
    const ok = await SG.confirm("Delete batch",
      `Delete batch <b>${esc(b.batchNumber)}</b> of <b>${esc(b.productName)}</b>? Use this only to fix a wrong entry.`);
    if (!ok) return;
    try {
      await SG.del("/api/batches/" + b.id);
      SG.toast("Batch deleted", "success");
      await load();
    } catch (e) { SG.toast(e.message, "error"); }
  }

  function exportCsv() {
    SG.downloadCsv("stockguard-batches-" + state.filter + "-" + SG.today() + ".csv",
      ["Product", "Category", "Batch", "Quantity left", "Received", "Unit", "Purchase date", "Expiry date", "Days to expiry", "Status", "Value"],
      filtered().map((b) => [b.productName, b.category, b.batchNumber, b.quantity, b.initialQuantity, b.unit, b.purchaseDate,
        b.expiryDate, b.daysToExpiry, b.status === "DISPOSED" ? "DISPOSED" : b.expiryStatus, b.value]));
  }

  /** Shared "add / edit batch" form, also opened from the Products page. */
  SG.openBatchForm = async function (batch, productId) {
    let products;
    try {
      products = await SG.get("/api/products");
    } catch (e) { return SG.toast(e.message, "error"); }
    if (!products.length) {
      SG.toast("Add a product first", "warn");
      location.hash = "#/products?new";
      return;
    }
    const isNew = !batch;
    const selected = batch ? batch.productId : productId;
    const suggested = "B" + SG.today().replace(/-/g, "").slice(2) + "-" + Math.floor(Math.random() * 90 + 10);
    SG.modal({
      title: isNew ? "Add stock batch" : "Edit batch",
      submitText: isNew ? "Add to stock" : "Save changes",
      body: `
        <div class="field"><label>Product</label>
          <select class="input" name="productId" required>
            ${products.map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.name)} (${p.sellableStock} ${esc(p.unit)} in stock)</option>`).join("")}
          </select></div>
        <div class="grid-2">
          <div class="field"><label>Batch number</label>
            <input class="input" name="batchNumber" required maxlength="60" value="${esc(batch ? batch.batchNumber : suggested)}"></div>
          <div class="field"><label>${isNew ? "Quantity received" : "Quantity left"}</label>
            <input class="input" name="quantity" type="number" min="${isNew ? 1 : 0}" step="1" required value="${batch ? batch.quantity : ""}"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Purchase date</label>
            <input class="input" name="purchaseDate" type="date" value="${batch?.purchaseDate || SG.today()}"></div>
          <div class="field"><label>Expiry date</label>
            <input class="input" name="expiryDate" type="date" value="${batch?.expiryDate || ""}">
            <span class="hint">Leave empty for non-perishable items.</span></div>
        </div>`,
      onSubmit: async (form, v) => {
        v.productId = Number(v.productId);
        if (!v.batchNumber) throw new Error("Batch number is required");
        if (v.quantity === null || v.quantity < (isNew ? 1 : 0)) throw new Error("Enter a valid quantity");
        if (isNew && v.expiryDate && v.expiryDate < SG.today()) {
          throw new Error("This expiry date is already in the past");
        }
        if (isNew) {
          await SG.post("/api/batches", v);
          SG.toast("Stock added", "success");
        } else {
          await SG.put("/api/batches/" + batch.id, v);
          SG.toast("Batch updated", "success");
        }
        SG.refreshCurrent();
      },
    });
  };

  SG.pages.stock = { title: "Stock & Expiry", render, refresh: load };
})();
