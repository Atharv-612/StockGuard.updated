/* Settings: shop profile, phone number and alert preferences. */
(function () {
  const { esc } = SG;

  async function render(el) {
    const u = await SG.get("/api/auth/me");
    SG.setUser(u);
    el.innerHTML = `
      <div class="row row-2-1">
        <form class="card" id="setForm" novalidate>
          <div class="card-head"><h3><span class="chip-ic bg-blue">&#127978;</span>Shop &amp; alert settings</h3></div>
          <div class="form-error" hidden></div>
          <div class="grid-2">
            <div class="field"><label>Owner name</label><input class="input" name="ownerName" required maxlength="100" value="${esc(u.ownerName)}"></div>
            <div class="field"><label>Shop name</label><input class="input" name="shopName" required maxlength="150" value="${esc(u.shopName)}"></div>
          </div>
          <div class="field"><label>Phone number</label>
            <input class="input" name="phoneNumber" type="tel" value="${esc(u.phoneNumber)}" placeholder="e.g. 919876543210">
            <span class="hint">Shop contact phone number.</span></div>
          <div class="field"><label>Warn me this many days before expiry</label>
            <input class="input" name="expiryAlertDays" type="number" min="1" max="90" value="${u.expiryAlertDays}" style="max-width:160px"></div>
          <label class="switch field"><input type="checkbox" name="alertsEnabled" ${u.alertsEnabled ? "checked" : ""}>
            <span><b>Stock alerts</b><br><span class="muted">Daily expiry/low-stock digest and instant low-stock alerts</span></span></label>
          <button class="btn btn-primary" type="submit">Save settings</button>
        </form>
        <div class="card">
          <div class="card-head"><h3><span class="chip-ic bg-purple">&#128100;</span>Account</h3></div>
          <dl class="kv"><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Shop</dt><dd>${esc(u.shopName)}</dd></dl>
          <div class="info-box bg-green" style="margin:16px 0"><span class="ic">&#128274;</span>
            <div>Your data is private to your account. Passwords are stored encrypted (BCrypt) and every request is checked with a signed token.</div></div>
          <button class="btn btn-outline btn-block" id="logout2">Log out</button>
        </div>
      </div>`;

    el.querySelector("#logout2").addEventListener("click", SG.auth.logout);
    const form = el.querySelector("#setForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = form.querySelector(".form-error");
      const btn = form.querySelector("button[type=submit]");
      err.hidden = true;
      btn.disabled = true;
      try {
        const v = SG.formValues(form);
        SG.setUser(await SG.put("/api/auth/settings", v));
        SG.toast("Settings saved", "success");
        SG.refreshAlertCount();
      } catch (ex) {
        err.textContent = ex.message;
        err.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
  }

  // No refresh on live updates - don't wipe what the user is typing.
  SG.pages.settings = { title: "Settings", render, refresh: () => {} };
})();
