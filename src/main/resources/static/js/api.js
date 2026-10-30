/* Shared helpers: auth storage, REST calls, formatting, toasts, modals. */
(function () {
  const SG = (window.SG = window.SG || {});
  const TOKEN_KEY = "sg_token";
  const USER_KEY = "sg_user";

  SG.logoSvg = `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <defs><linearGradient id="sgShield" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs>
      <path d="M24 3 6 9.5v12.3C6 33.6 13.7 42.6 24 45c10.3-2.4 18-11.4 18-23.2V9.5L24 3z" fill="url(#sgShield)" stroke="#fff" stroke-width="2.4"/>
      <path d="m15.5 24.5 6 6 11.5-12.5" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  // ---------- Auth storage ----------
  SG.auth = {
    token() {
      try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
    },
    user() {
      try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch (e) { return null; }
    },
    save(res) {
      try {
        if (res.token) localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user || res));
      } catch (e) { /* storage blocked */ }
    },
    clear() {
      try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) { /* ignore */ }
    },
    logout() {
      SG.auth.clear();
      location.href = "index.html";
    },
  };

  // ---------- REST ----------
  SG.api = async function (path, options = {}) {
    const headers = { Accept: "application/json" };
    const token = SG.auth.token();
    if (token) headers.Authorization = "Bearer " + token;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    let res;
    try {
      res = await fetch(path, {
        method: options.method || "GET",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (e) {
      throw new Error("Cannot reach the server. Is StockGuard running?");
    }

    if (res.status === 401 && !path.startsWith("/api/auth/login")) {
      SG.auth.clear();
      location.href = "index.html?expired=1";
      throw new Error("Session expired");
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.message) || "Request failed (" + res.status + ")");
    return data;
  };
  SG.get = (p) => SG.api(p);
  SG.post = (p, body) => SG.api(p, { method: "POST", body: body === undefined ? {} : body });
  SG.put = (p, body) => SG.api(p, { method: "PUT", body });
  SG.del = (p) => SG.api(p, { method: "DELETE" });

  // ---------- Formatting ----------
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  SG.MONTHS = MONTHS;

  SG.esc = function (v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  };

  SG.fmt = {
    money(v) {
      const n = Number(v || 0);
      return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
    },
    num(v) { return Number(v || 0).toLocaleString("en-IN"); },
    date(d) {
      if (!d) return "-";
      const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
      return day + " " + MONTHS[m - 1] + " " + y;
    },
    shortDate(d) {
      if (!d) return "-";
      const [, m, day] = String(d).slice(0, 10).split("-").map(Number);
      return day + " " + MONTHS[m - 1];
    },
    dateTime(dt) {
      if (!dt) return "-";
      const t = new Date(dt);
      return SG.fmt.date(SG.isoDate(t)) + ", " + t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    },
    time(dt) { return new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); },
    days(n) {
      if (n === null || n === undefined) return "-";
      if (n < 0) return Math.abs(n) + "d ago";
      if (n === 0) return "Today";
      if (n === 1) return "Tomorrow";
      return n + " days";
    },
  };

  /** Local date as yyyy-mm-dd (not UTC). */
  SG.isoDate = function (d) {
    const z = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  };
  SG.today = () => SG.isoDate(new Date());
  SG.addDays = (iso, n) => {
    const [y, m, d] = iso.split("-").map(Number);
    return SG.isoDate(new Date(y, m - 1, d + n));
  };

  // ---------- Badges ----------
  SG.stockBadge = function (status) {
    const map = {
      IN_STOCK: ["bg-green", "In stock"],
      LOW_STOCK: ["bg-amber", "Low stock"],
      OUT_OF_STOCK: ["bg-red", "Out of stock"],
    };
    const [cls, label] = map[status] || ["bg-gray", status];
    return `<span class="badge ${cls}">${label}</span>`;
  };
  SG.expiryBadge = function (status, days) {
    const map = {
      OK: ["bg-green", "Fresh"],
      EXPIRING_SOON: ["bg-orange", days === 0 ? "Expires today" : "Expiring soon"],
      EXPIRED: ["bg-red", "Expired"],
      NO_EXPIRY: ["bg-gray", "No expiry"],
    };
    const [cls, label] = map[status] || ["bg-gray", status];
    return `<span class="badge ${cls}">${label}</span>`;
  };

  // ---------- Toasts ----------
  SG.toast = function (message, type = "info") {
    let box = document.querySelector(".toasts");
    if (!box) {
      box = document.createElement("div");
      box.className = "toasts";
      document.body.appendChild(box);
    }
    const icons = { success: "✅", error: "⚠️", warn: "🔔", info: "ℹ️" };
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.innerHTML = `<span>${icons[type] || ""}</span><span>${SG.esc(message)}</span>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), type === "error" ? 6000 : 3500);
  };

  // ---------- Modal ----------
  /**
   * SG.modal({ title, body, submitText, danger, size, onSubmit(form, values) })
   * onSubmit may return a promise; throwing shows the message in the modal.
   */
  SG.modal = function (opts) {
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `
      <form class="modal ${opts.size === "lg" ? "modal-lg" : ""}" novalidate>
        <div class="modal-head"><h3>${SG.esc(opts.title)}</h3>
          <button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Close">✕</button></div>
        <div class="modal-body"><div class="form-error" hidden></div>${opts.body || ""}</div>
        <div class="modal-foot">
          <button type="button" class="btn btn-outline" data-close>${SG.esc(opts.cancelText || "Cancel")}</button>
          ${opts.onSubmit ? `<button type="submit" class="btn ${opts.danger ? "btn-danger" : "btn-primary"}">${SG.esc(opts.submitText || "Save")}</button>` : ""}
        </div>
      </form>`;
    document.body.appendChild(back);
    SG.modalOpen = true;
    const form = back.querySelector("form");
    const errBox = back.querySelector(".form-error");
    const close = () => {
      back.remove();
      SG.modalOpen = !!document.querySelector(".modal-backdrop");
      document.removeEventListener("keydown", onKey);
      if (opts.onClose) opts.onClose();
      if (!SG.modalOpen && SG.afterModalClose) SG.afterModalClose();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
    back.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!opts.onSubmit) return close();
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      errBox.hidden = true;
      try {
        const keep = await opts.onSubmit(form, SG.formValues(form));
        if (keep !== false) close();
      } catch (err) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
    const first = form.querySelector(".modal-body input, .modal-body select");
    if (first) setTimeout(() => first.focus(), 30);
    if (opts.onOpen) opts.onOpen(form);
    return { close, form };
  };

  SG.confirm = function (title, message, confirmText = "Delete") {
    return new Promise((resolve) => {
      let ok = false;
      SG.modal({
        title, danger: true, submitText: confirmText,
        body: `<p class="mt-0">${message}</p>`,
        onSubmit: () => { ok = true; },
        onClose: () => resolve(ok),
      });
    });
  };

  SG.formValues = function (form) {
    const out = {};
    form.querySelectorAll("[name]").forEach((el) => {
      if (el.type === "checkbox") out[el.name] = el.checked;
      else if (el.type === "number") out[el.name] = el.value === "" ? null : Number(el.value);
      else out[el.name] = el.value.trim() === "" ? null : el.value.trim();
    });
    return out;
  };

  // ---------- CSV export ----------
  SG.downloadCsv = function (filename, header, rows) {
    const cell = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  SG.debounce = function (fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  SG.loadingHtml = '<div class="loading"><div class="spinner"></div> Loading...</div>';
  SG.emptyHtml = (icon, text) => `<div class="empty"><div class="big">${icon}</div>${text}</div>`;
})();
