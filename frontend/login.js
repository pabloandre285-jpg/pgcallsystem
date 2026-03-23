const API = "http://localhost:3000";

const form = document.getElementById("form-login");
const msg = document.getElementById("login-msg");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

function submitLoginOnEnter(e) {
  if (e.key !== "Enter" || e.repeat) return;
  if (e.target.closest("textarea")) return;
  e.preventDefault();
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
  } else {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
}

usernameInput.addEventListener("keydown", submitLoginOnEnter);
passwordInput.addEventListener("keydown", submitLoginOnEnter);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";
  msg.classList.remove("ok");

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    msg.textContent = "Preencha usuário e senha.";
    return;
  }

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const raw = (await res.text()).replace(/^\uFEFF/, "");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { _raw: raw };
    }

    if (!res.ok) {
      const errText =
        data && typeof data === "object" && data.message
          ? data.message
          : raw || "Não foi possível entrar.";
      msg.textContent = errText;
      return;
    }

    const token = typeof data.token === "string" ? data.token : null;
    const userPayload = data.user && typeof data.user === "object" ? data.user : null;

    if (!token || !userPayload) {
      msg.textContent =
        "Servidor sem JWT. Rode na pasta do projeto: npm install && npm start (porta 3000).";
      return;
    }

    setSession(token, userPayload);
    msg.classList.add("ok");
    msg.textContent = "Entrando…";
    
    // Redirecionamento inteligente baseado no perfil
    if (userPayload.role === 'cliente' || userPayload.cliente_id) {
      window.location.href = "portal.html";
    } else {
      window.location.href = "chamados.html";
    }
  } catch {
    msg.textContent = "Servidor indisponível. Execute: npm start";
  }
});
