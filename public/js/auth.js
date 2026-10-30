/* Login / Register page. */
(function () {
  if (SG.auth.token()) {
    location.replace("app.html");
    return;
  }

  document.getElementById("logo").insertAdjacentHTML("afterbegin", SG.logoSvg);

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const tabs = document.querySelectorAll(".tabs button");

  function showTab(name) {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    loginForm.hidden = name !== "login";
    registerForm.hidden = name !== "register";
  }
  tabs.forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));
  if (location.hash === "#register") showTab("register");

  const params = new URLSearchParams(location.search);
  if (params.get("expired")) SG.toast("Your session ended. Please log in again.", "warn");
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    document.getElementById("demoHint").hidden = false;
  }

  async function submit(form, path) {
    const err = form.querySelector(".form-error");
    const btn = form.querySelector("button[type=submit]");
    err.hidden = true;
    btn.disabled = true;
    try {
      const res = await SG.post(path, SG.formValues(form));
      SG.auth.save(res);
      location.href = "app.html";
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submit(loginForm, "/api/auth/login");
  });
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submit(registerForm, "/api/auth/register");
  });
})();
