requireAuthPage();
if (!canAddUser()) window.location.href = "chamados.html";

const user = getUser();
document.getElementById("user-pill").textContent = user
  ? `${user.nome || user.username}${isAdmin() ? " · Admin" : ""}`
  : "";
if (isAdmin()) document.getElementById("wrap-admin").hidden = false;

if (canAddUser()) {
  const navUserSidebar = document.getElementById("nav-usuarios-sidebar");
  if (navUserSidebar) navUserSidebar.hidden = false;
}

// Menu toggle logic
const menuToggle = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");

if (menuToggle && sidebar && sidebarOverlay) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("active");
    sidebarOverlay.classList.add("active");
  });

  sidebarOverlay.addEventListener("click", () => {
    sidebar.classList.remove("active");
    sidebarOverlay.classList.remove("active");
  });
}

document.getElementById("btn-sair").addEventListener("click", () => logout());
document.getElementById("btn-criar-user").addEventListener("click", criarUsuario);

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

async function carregarUsuarios() {
  const res = await authFetch("/users");
  const rows = await res.json();
  const tb = document.getElementById("tbody-users");
  tb.innerHTML = "";
  rows.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(u.username)}</td>
      <td>${escapeHtml(u.nome || "—")}</td>
      <td>${u.role === "admin" ? "Admin" : "Operador"}</td>
      <td>${u.pode_add_usuario ? "Sim" : "Não"}</td>
      <td>
        <button type="button" class="btn-link link-quiet" data-edit="${u.id}">Editar</button>
      </td>
    `;
    tr.querySelector("[data-edit]").addEventListener("click", () => preencherEdicao(u));
    tb.appendChild(tr);
  });
}

function preencherEdicao(u) {
  document.getElementById("u_username").value = u.username;
  document.getElementById("u_nome").value = u.nome || "";
  document.getElementById("u_admin").checked = u.role === "admin";
  document.getElementById("u_pode_add").checked = !!u.pode_add_usuario;
  document.getElementById("btn-criar-user").textContent = "Atualizar";
  document.getElementById("btn-criar-user").dataset.editId = u.id;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function criarUsuario() {
  const btn = document.getElementById("btn-criar-user");
  const editId = btn.dataset.editId;
  const username = document.getElementById("u_username").value.trim();
  const password = document.getElementById("u_password").value;
  const nome = document.getElementById("u_nome").value.trim();
  const adminCk = document.getElementById("u_admin");
  const podeCk = document.getElementById("u_pode_add");
  if (!username || (!password && !editId)) {
    alert("Login e senha obrigatórios.");
    return;
  }
  const body = {
    username,
    nome,
    role: adminCk && !adminCk.hidden && adminCk.checked ? "admin" : "operador",
    pode_add_usuario: !!(podeCk && podeCk.checked)
  };
  if (password) body.password = password;

  const url = editId ? `/users/${editId}` : "/users";
  const method = editId ? "PUT" : "POST";

  const res = await authFetch(url, { method, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.json().catch(() => ({}));
    alert(t.message || "Erro.");
    return;
  }
  document.getElementById("u_username").value = "";
  document.getElementById("u_password").value = "";
  document.getElementById("u_nome").value = "";
  if (adminCk) adminCk.checked = false;
  podeCk.checked = false;
  btn.textContent = "Criar";
  delete btn.dataset.editId;
  carregarUsuarios();
}

carregarUsuarios();
