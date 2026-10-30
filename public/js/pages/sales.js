/* Sales / Billing: quick bill (cart) + digital sales register. */
(function () {
  const { esc, fmt } = SG;
  const cart = []; // { productId, name, unit, price, quantity, max }
  const range = { from: SG.today(), to: SG.today() };
  let products = [];
  let el;

  async function render(host) {
    el = host;
    el.innerHTML = `
      <div class="row row-2-1">
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-green">&#129534;</span>New bill</h3></div>
          <form class="pos-add" id="posAdd" autocomplete="off">
            <div class="field"><label>Product</label>
              <input class="input" id="posProduct" list="posList" placeholder="Type to search a product...">
              <datalist id="posList"></datalist></div>
            <div class="field"><label>Qty</label><input class="input" id="posQty" type="number" min="1" step="1" value="1"></div>
            <button class="btn btn-primary" type="submit">Add</button>
          </form>
          <div id="cart" style="margin-top:16px"></div>
        </div>
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-blue">&#128197;</span>Today</h3></div>
          <div id="todayBox">${SG.loadingHtml}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3><span class="chip-ic bg-purple">&#128210;</span>Sales register</h3>
          <div class="spacer"></div>
          <div class="toolbar" style="margin:0">
            <input class="input" type="date" id="sFrom" value="${range.from}">
            <span class="muted">to</span>
            <input class="input" type="date" id="sTo" value="${range.to}">
            <button class="btn btn-outline" id="sExport">&#11015; CSV</button>
          </div>
        </div>
        <div id="history">${SG.loadingHtml}</div>
      </div>`;

    el.querySelector("#posAdd").addEventListener("submit", (e) => { e.preventDefault(); addToCart(); });
    el.querySelector("#sFrom").addEventListener("change", (e) => { range.from = e.target.value; loadHistory(); });
    el.querySelector("#sTo").addEventListener("change", (e) => { range.to = e.target.value; loadHistory(); });
    el.querySelector("#sExport").addEventListener("click", exportCsv);
    await load();
  }

  async function load() {
    products = await SG.get("/api/products");
    const list = document.getElementById("posList");
    if (list) list.innerHTML = products.filter((p) => p.sellableStock > 0)
      .map((p) => `<option value="${esc(p.name)}">${fmt.money(p.price)} &middot; ${p.sellableStock} ${esc(p.unit)} left</option>`).join("");
    // keep cart limits in sync with live stock
    cart.forEach((c) => { const p = products.find((x) => x.id === c.productId); c.max = p ? p.sellableStock : 0; });
    drawCart();
    await loadHistory();
  }

  function addToCart() {
    const input = document.getElementById("posProduct");
    const qty = Number(document.getElementById("posQty").value);
    const name = input.value.trim().toLowerCase();
    const p = products.find((x) => x.name.toLowerCase() === name)
      || products.find((x) => (x.sku || "").toLowerCase() === name)
      || (name && products.filter((x) => x.name.toLowerCase().includes(name)).length === 1
        ? products.find((x) => x.name.toLowerCase().includes(name)) : null);
    if (!p) return SG.toast("Pick a product from the list", "warn");
    if (!qty || qty < 1) return SG.toast("Enter a quantity of at least 1", "warn");
    const line = cart.find((c) => c.productId === p.id);
    const newQty = (line ? line.quantity : 0) + qty;
    if (newQty > p.sellableStock) {
      return SG.toast(`Only ${p.sellableStock} ${p.unit} of ${p.name} in stock`, "warn");
    }
    if (line) line.quantity = newQty;
    else cart.push({ productId: p.id, name: p.name, unit: p.unit, price: Number(p.price), quantity: qty, max: p.sellableStock });
    input.value = "";
    document.getElementById("posQty").value = 1;
    input.focus();
    drawCart();
  }

  function drawCart() {
    const box = document.getElementById("cart");
    if (!box) return;
    if (!cart.length) {
      box.innerHTML = SG.emptyHtml("&#128722;", "Cart is empty. Add products above to create a bill.");
      return;
    }
    const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    box.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Item</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Amount</th><th></th></tr></thead>
      <tbody>${cart.map((c, i) => `<tr>
        <td class="name">${esc(c.name)}${c.quantity > c.max ? `<div class="sub text-red">Only ${c.max} left</div>` : ""}</td>
        <td class="num">${fmt.money(c.price)}</td>
        <td class="num"><input class="input qty-input" type="number" min="1" max="${c.max}" value="${c.quantity}" data-qty="${i}"></td>
        <td class="num fw">${fmt.money(c.price * c.quantity)}</td>
        <td class="actions"><button class="btn btn-ghost btn-sm text-red" data-rm="${i}">&#10005;</button></td></tr>`).join("")}</tbody></table></div>
      <div class="cart-total"><div><div class="muted" style="color:#aebde3">${cart.reduce((s, c) => s + c.quantity, 0)} items</div><div class="amt">${fmt.money(total)}</div></div>
        <div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" id="cartClear">Clear</button>
        <button class="btn btn-success" id="cartPay">&#10003; Complete sale</button></div></div>`;
    box.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { cart.splice(Number(b.dataset.rm), 1); drawCart(); }));
    box.querySelectorAll("[data-qty]").forEach((inp) => inp.addEventListener("change", () => {
      const c = cart[Number(inp.dataset.qty)];
      c.quantity = Math.max(1, Math.floor(Number(inp.value) || 1));
      drawCart();
    }));
    box.querySelector("#cartClear").addEventListener("click", () => { cart.length = 0; drawCart(); });
    box.querySelector("#cartPay").addEventListener("click", checkout);
  }

  async function checkout() {
    const btn = document.getElementById("cartPay");
    btn.disabled = true;
    try {
      const bill = await SG.post("/api/sales", { items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })) });
      cart.length = 0;
      showReceipt(bill);
      await load();
    } catch (e) {
      SG.toast(e.message, "error");
      btn.disabled = false;
    }
  }

  function showReceipt(bill) {
    SG.modal({
      title: "Sale completed ✅",
      cancelText: "Close",
      body: `<p class="mt-0 muted">${esc(bill.billNumber)} &middot; ${fmt.dateTime(bill.soldAt)}</p>
        <table class="table"><tbody>${bill.lines.map((l) => `<tr><td>${esc(l.productName)} &times; ${l.quantity}</td><td class="num">${fmt.money(l.totalAmount)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>Total</td><td class="num">${fmt.money(bill.total)}</td></tr></tfoot></table>`,
    });
  }

  let history = [];
  async function loadHistory() {
    if (range.to < range.from) return SG.toast("'To' date must be after 'From' date", "warn");
    const [list, todayList] = await Promise.all([
      SG.get(`/api/sales?from=${range.from}&to=${range.to}`),
      SG.get(`/api/sales?from=${SG.today()}&to=${SG.today()}`),
    ]);
    history = list;
    drawToday(todayList);
    const box = document.getElementById("history");
    if (!box) return;
    if (!list.length) {
      box.innerHTML = SG.emptyHtml("&#128210;", "No sales in this period.");
      return;
    }
    const total = list.reduce((s, x) => s + Number(x.totalAmount), 0);
    box.innerHTML = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Date &amp; time</th><th>Bill</th><th>Product</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
      <tbody>${list.map((s) => `<tr><td class="nowrap">${fmt.dateTime(s.soldAt)}</td><td class="sub">${esc(s.billNumber)}</td>
        <td class="name">${esc(s.productName)}<div class="sub">${esc(s.category)}</div></td><td class="num">${s.quantity}</td>
        <td class="num">${fmt.money(s.unitPrice)}</td><td class="num fw">${fmt.money(s.totalAmount)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="3">Total (${list.length} lines)</td><td class="num">${list.reduce((s, x) => s + x.quantity, 0)}</td><td></td><td class="num">${fmt.money(total)}</td></tr></tfoot>
      </table></div>`;
  }

  function drawToday(list) {
    const box = document.getElementById("todayBox");
    if (!box) return;
    const revenue = list.reduce((s, x) => s + Number(x.totalAmount), 0);
    const bills = new Set(list.map((x) => x.billNumber)).size;
    const items = list.reduce((s, x) => s + x.quantity, 0);
    box.innerHTML = `<dl class="kv">
        <dt>Revenue</dt><dd class="text-green" style="font-size:20px">${fmt.money(revenue)}</dd>
        <dt>Bills</dt><dd>${bills}</dd>
        <dt>Items sold</dt><dd>${items}</dd>
        <dt>Avg. bill</dt><dd>${fmt.money(bills ? revenue / bills : 0)}</dd></dl>
      <div class="info-box bg-green" style="margin-top:16px"><span class="ic">&#9889;</span>
        <div>Stock updates instantly when you complete a sale, on every device logged in to this shop.</div></div>`;
  }

  function exportCsv() {
    SG.downloadCsv(`stockguard-sales-${range.from}-to-${range.to}.csv`,
      ["Date", "Bill", "Product", "Category", "Quantity", "Unit price", "Amount"],
      history.map((s) => [s.soldAt.replace("T", " ").slice(0, 16), s.billNumber, s.productName, s.category, s.quantity, s.unitPrice, s.totalAmount]));
  }

  SG.pages.sales = { title: "Sales / Billing", render, refresh: load };
})();
