/* Product registry: add, edit, remove items with names, categories and prices. */
(function () {
  const { esc, fmt } = SG;
  const state = { search: "", category: "", status: "all" };
  let products = [];
  let tableHost;

  async function render(el) {
    el.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <input class="input search" id="pSearch" type="search" placeholder="Search by name or SKU..." value="${esc(state.search)}">
          <select class="input" id="pCategory"><option value="">All categories</option></select>
          <select class="input" id="pStatus">
            <option value="all">All products</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
            <option value="EXPIRING_SOON">Expiring soon</option>
            <option value="EXPIRED">Has expired stock</option>
          </select>
          <div class="spacer"></div>
          <button class="btn btn-outline" id="pExport">&#11015; Export CSV</button>
          <button class="btn btn-primary" id="pAdd">+ Add product</button>
        </div>
        <div id="pTable">${SG.loadingHtml}</div>
      </div>`;
    tableHost = el.querySelector("#pTable");
    el.querySelector("#pStatus").value = state.status;
    el.querySelector("#pSearch").addEventListener("input", SG.debounce((e) => { state.search = e.target.value; draw(); }, 150));
    el.querySelector("#pCategory").addEventListener("change", (e) => { state.category = e.target.value; draw(); });
    el.querySelector("#pStatus").addEventListener("change", (e) => { state.status = e.target.value; draw(); });
    el.querySelector("#pAdd").addEventListener("click", () => openForm());
    el.querySelector("#pExport").addEventListener("click", exportCsv);
    await load();
    if (location.hash.includes("new")) openForm();
  }

  async function load() {
    products = await SG.get("/api/products");
    const sel = document.getElementById("pCategory");
    if (sel) {
      const cats = [...new Set(products.map((p) => p.category))].sort();
      if (state.category && !cats.includes(state.category)) state.category = "";
      sel.innerHTML = `<option value="">All categories</option>` + cats.map((c) => `<option>${esc(c)}</option>`).join("");
      sel.value = state.category;
    }
    draw();
  }

  function filtered() {
    const q = state.search.toLowerCase();
    return products.filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)) &&
      (!state.category || p.category === state.category) &&
      (state.status === "all" || p.stockStatus === state.status || p.expiryStatus === state.status));
  }

  function draw() {
    if (!tableHost) return;
    const list = filtered();
    if (!products.length) {
      tableHost.innerHTML = SG.emptyHtml("&#128230;", "No products yet. Click <b>+ Add product</b> to create your first one.");
      return;
    }
    if (!list.length) {
      tableHost.innerHTML = SG.emptyHtml("&#128269;", "No products match your filters.");
      return;
    }
    tableHost.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Product</th><th>Category</th><th class="num">Price</th><th class="num">In stock</th>
        <th>Nearest expiry</th><th>Stock</th><th>Expiry</th><th class="actions">Actions</th></tr></thead>
      <tbody>${list.map((p) => `<tr>
        <td><div class="name">${esc(p.name)}</div><div class="sub">${p.sku ? "SKU " + esc(p.sku) + " &middot; " : ""}min ${p.lowStockThreshold} ${esc(p.unit)}</div></td>
        <td>${esc(p.category)}</td>
        <td class="num">${fmt.money(p.price)}<div class="sub">per ${esc(p.unit)}</div></td>
        <td class="num"><b>${fmt.num(p.sellableStock)}</b> ${esc(p.unit)}${p.expiredStock ? `<div class="sub text-red">+${p.expiredStock} expired</div>` : ""}</td>
        <td class="nowrap">${p.nearestExpiry ? fmt.date(p.nearestExpiry) + `<div class="sub">${fmt.days(p.daysToNearestExpiry)}</div>` : "-"}</td>
        <td>${SG.stockBadge(p.stockStatus)}</td>
        <td>${SG.expiryBadge(p.expiryStatus, p.daysToNearestExpiry)}</td>
        <td class="actions">
          <button class="btn btn-success btn-sm" data-stock="${p.id}" title="Add stock batch">+ Stock</button>
          <button class="btn btn-outline btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-ghost btn-sm text-red" data-del="${p.id}" title="Remove">&#128465;</button>
        </td></tr>`).join("")}</tbody></table></div>`;

    tableHost.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openForm(byId(b.dataset.edit))));
    tableHost.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => remove(byId(b.dataset.del))));
    tableHost.querySelectorAll("[data-stock]").forEach((b) => b.addEventListener("click", () => SG.openBatchForm(null, Number(b.dataset.stock))));
  }

  const byId = (id) => products.find((p) => p.id === Number(id));

  function openForm(p) {
    const isNew = !p;
    const cats = [...new Set(products.map((x) => x.category))].sort();
    SG.modal({
      title: isNew ? "Add product" : "Edit product",
      submitText: isNew ? "Add product" : "Save changes",
      body: `
        <div class="field"><label>Product name</label>
          <input class="input" name="name" required maxlength="150" value="${esc(p?.name)}" placeholder="e.g. Amul Milk 500ml"></div>
        <div class="grid-2">
          <div class="field"><label>Category</label>
            <input class="input" name="category" list="catList" required maxlength="80" value="${esc(p?.category)}" placeholder="e.g. Dairy">
            <datalist id="catList">${cats.map((c) => `<option value="${esc(c)}">`).join("")}</datalist></div>
          <div class="field"><label>SKU / Barcode <span class="muted">(optional)</span></label>
            <input class="input" name="sku" maxlength="60" value="${esc(p?.sku)}"></div>
        </div>
        <div class="grid-3">
          <div class="field"><label>Selling price (&#8377;)</label>
            <input class="input" name="price" type="number" min="0" step="0.01" required value="${p ? p.price : ""}"></div>
          <div class="field"><label>Unit</label>
            <input class="input" name="unit" list="unitList" maxlength="20" value="${esc(p?.unit || "pcs")}">
            <datalist id="unitList"><option value="pcs"><option value="kg"><option value="g"><option value="litre"><option value="ml"><option value="pack"><option value="bottle"><option value="box"><option value="dozen"></datalist></div>
          <div class="field"><label>Low stock alert at</label>
            <input class="input" name="lowStockThreshold" type="number" min="0" step="1" required value="${p ? p.lowStockThreshold : 5}"></div>
        </div>
        ${isNew ? `
        <div class="section-label">Opening stock (optional)</div>
        <div class="grid-3">
          <div class="field"><label>Quantity</label><input class="input" name="openingStock" type="number" min="0" step="1"></div>
          <div class="field"><label>Expiry date</label><input class="input" name="openingExpiryDate" type="date"></div>
          <div class="field"><label>Batch no.</label><input class="input" name="openingBatchNumber" maxlength="60" placeholder="auto"></div>
        </div>` : ""}`,
      onSubmit: async (form, v) => {
        if (!v.name || !v.category) throw new Error("Name and category are required");
        if (v.price === null || v.price < 0) throw new Error("Enter a valid price");
        if (v.lowStockThreshold === null) v.lowStockThreshold = 0;
        if (isNew) {
          await SG.post("/api/products", v);
          SG.toast("Product added", "success");
        } else {
          await SG.put("/api/products/" + p.id, v);
          SG.toast("Product updated", "success");
        }
        await load();
      },
    });
  }

  async function remove(p) {
    const ok = await SG.confirm("Remove product",
      `Remove <b>${esc(p.name)}</b> from your product list? Its sales history stays in your reports.`, "Remove");
    if (!ok) return;
    try {
      await SG.del("/api/products/" + p.id);
      SG.toast("Product removed", "success");
      await load();
    } catch (e) {
      SG.toast(e.message, "error");
    }
  }

  function exportCsv() {
    SG.downloadCsv("stockguard-products-" + SG.today() + ".csv",
      ["Product", "Category", "SKU", "Unit", "Price", "In stock", "Expired stock", "Low stock level", "Nearest expiry", "Stock status", "Expiry status", "Stock value"],
      filtered().map((p) => [p.name, p.category, p.sku, p.unit, p.price, p.sellableStock, p.expiredStock, p.lowStockThreshold,
        p.nearestExpiry, p.stockStatus, p.expiryStatus, p.stockValue]));
  }

  SG.pages.products = { title: "Products", render, refresh: load };
})();
