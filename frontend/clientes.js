requireAuthPage();

const user = getUser();
document.getElementById("user-pill").textContent = user
  ? `${user.nome || user.username}${isAdmin() ? " · Admin" : ""}`
  : "";
if (canAddUser()) {
  const navUser = document.getElementById("nav-usuarios");
  if (navUser) navUser.hidden = false;
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
document.getElementById("btn-salvar").addEventListener("click", salvarCliente);
document.getElementById("btn-cancelar-edit").addEventListener("click", cancelarEdicao);
document.getElementById("btn-buscar-cep").addEventListener("click", buscarCep);

document.getElementById("cep").addEventListener("input", (e) => {
  let v = e.target.value.replace(/\D/g, "").slice(0, 8);
  if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5);
  e.target.value = v;
});
document.getElementById("cep").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    buscarCep();
  }
});

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

function cepDigits() {
  return document.getElementById("cep").value.replace(/\D/g, "");
}

function setCepStatus(text, kind) {
  const el = document.getElementById("cep-status");
  el.textContent = text || "";
  el.className = "field-hint" + (kind ? ` ${kind}` : "");
}

async function buscarCep() {
  const d = cepDigits();
  if (d.length !== 8) {
    setCepStatus("CEP com 8 dígitos.", "erro");
    return;
  }
  setCepStatus("Buscando…");
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const data = await r.json();
    if (data.erro) {
      setCepStatus("CEP não encontrado.", "erro");
      return;
    }
    document.getElementById("logradouro").value = data.logradouro || "";
    document.getElementById("bairro").value = data.bairro || "";
    document.getElementById("cidade").value = data.localidade || "";
    document.getElementById("uf").value = (data.uf || "").toUpperCase().slice(0, 2);
    document.getElementById("bloco-endereco-viacep").hidden = false;
    document.getElementById("endereco_manual").value = "";
    document.getElementById("details-manual").open = false;
    setCepStatus("OK. Complete número e salve.", "ok");
  } catch {
    setCepStatus("Erro na consulta. Use endereço manual.", "erro");
  }
}

function limparEnderecoViacep() {
  document.getElementById("logradouro").value = "";
  document.getElementById("bairro").value = "";
  document.getElementById("cidade").value = "";
  document.getElementById("uf").value = "";
  document.getElementById("numero_complemento").value = "";
  document.getElementById("bloco-endereco-viacep").hidden = true;
  setCepStatus("");
}

function setFormMode(novo) {
  document.getElementById("form-title").textContent = novo ? "Novo cliente" : "Editar";
  document.getElementById("btn-salvar-text").textContent = novo ? "Salvar" : "Atualizar";
  document.getElementById("btn-cancelar-edit").hidden = novo;
  if (novo) {
    document.getElementById("edit_id").value = "";
    document.getElementById("nome_completo").value = "";
    document.getElementById("celular").value = "";
    document.getElementById("cpf").value = "";
    document.getElementById("data_nascimento").value = "";
    document.getElementById("cep").value = "";
    document.getElementById("endereco_manual").value = "";
    document.getElementById("details-manual").open = false;
    limparEnderecoViacep();
  }
}

function cancelarEdicao() {
  setFormMode(true);
}

function formatCepDisplay(cep) {
  const d = String(cep || "").replace(/\D/g, "").slice(0, 8);
  return d.length <= 5 ? d : d.slice(0, 5) + "-" + d.slice(5);
}

let allClients = [];

async function carregarLista() {
  const res = await authFetch("/clientes");
  allClients = await res.json();
  renderLista(allClients);
}

function renderLista(rows) {
  const tb = document.getElementById("tbody");
  const empty = document.getElementById("empty-clientes");
  tb.innerHTML = "";
  if (!rows.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  rows.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.nome_completo)}</td>
      <td>${escapeHtml(c.celular || "—")}</td>
      <td>${escapeHtml(c.cpf || "—")}</td>
      <td class="td-actions">
        <button type="button" class="btn-table" data-edit="${c.id}">Editar</button>
        <button type="button" class="btn-table btn-table-danger" data-del="${c.id}">Excluir</button>
      </td>
    `;
    tr.querySelector("[data-edit]").addEventListener("click", () => preencherEdicao(c));
    tr.querySelector("[data-del]").addEventListener("click", () => excluirCliente(c.id));
    tb.appendChild(tr);
  });
}

document.getElementById("search-clientes").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase().trim();
  const filtered = allClients.filter(c => 
    (c.nome_completo || "").toLowerCase().includes(term) ||
    (c.celular || "").includes(term) ||
    (c.cpf || "").includes(term)
  );
  renderLista(filtered);
});

function preencherEdicao(c) {
  document.getElementById("edit_id").value = String(c.id);
  document.getElementById("nome_completo").value = c.nome_completo || "";
  document.getElementById("celular").value = c.celular || "";
  document.getElementById("cpf").value = c.cpf || "";
  document.getElementById("data_nascimento").value = (c.data_nascimento || "").slice(0, 10);
  document.getElementById("cep").value = c.cep ? formatCepDisplay(c.cep) : "";
  document.getElementById("numero_complemento").value = c.numero_complemento || "";
  document.getElementById("logradouro").value = c.logradouro || "";
  document.getElementById("bairro").value = c.bairro || "";
  document.getElementById("cidade").value = c.cidade || "";
  document.getElementById("uf").value = c.uf || "";
  const temVia = !!(c.logradouro && c.cidade && String(c.cep || "").replace(/\D/g, "").length === 8);
  if (temVia) {
    document.getElementById("bloco-endereco-viacep").hidden = false;
    document.getElementById("endereco_manual").value = "";
    document.getElementById("details-manual").open = false;
    setCepStatus("Endereço por CEP.", "ok");
  } else {
    limparEnderecoViacep();
    document.getElementById("endereco_manual").value = c.endereco_completo || "";
    document.getElementById("details-manual").open = true;
  }
  document.getElementById("form-title").textContent = "Editar cliente";
  document.getElementById("btn-salvar-text").textContent = "Atualizar";
  document.getElementById("btn-cancelar-edit").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function excluirCliente(id) {
  if (!confirm("Excluir cliente?")) return;
  const res = await authFetch(`/clientes/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const t = await res.json().catch(() => ({}));
    alert(t.message || "Erro.");
    return;
  }
  cancelarEdicao();
  carregarLista();
}

async function salvarCliente() {
  const manual = document.getElementById("endereco_manual").value.trim();
  const payload = {
    nome_completo: document.getElementById("nome_completo").value.trim(),
    celular: document.getElementById("celular").value.trim(),
    cpf: document.getElementById("cpf").value.trim(),
    data_nascimento: document.getElementById("data_nascimento").value,
    cep: cepDigits(),
    logradouro: document.getElementById("logradouro").value.trim(),
    bairro: document.getElementById("bairro").value.trim(),
    cidade: document.getElementById("cidade").value.trim(),
    uf: document.getElementById("uf").value.trim(),
    numero_complemento: document.getElementById("numero_complemento").value.trim(),
    endereco_completo: manual
  };
  if (!payload.nome_completo) {
    alert("Nome obrigatório.");
    return;
  }
  const temVia = payload.logradouro && payload.cidade && payload.cep.length === 8;
  if (!temVia && !manual) {
    alert("Busque CEP ou preencha endereço manual.");
    return;
  }
  const editId = document.getElementById("edit_id").value;
  const res = await authFetch(editId ? `/clientes/${editId}` : "/clientes", {
    method: editId ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const t = await res.json().catch(() => ({}));
    alert(t.message || "Erro ao salvar.");
    return;
  }
  setFormMode(true);
  carregarLista();
}

carregarLista();
