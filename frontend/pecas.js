requireAuthPage();

const user = getUser();
const admin = isAdmin();

document.getElementById("user-pill").textContent = user
  ? `${user.nome || user.username}${admin ? " · Admin" : ""}`
  : "";

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
document.getElementById("btn-salvar-peca").addEventListener("click", () => salvarPeca());

const precoInput = document.getElementById("preco");
const precoRevendaInput = document.getElementById("preco_revenda");
const sugestaoDiv = document.getElementById("peca-sugestao-venda");

if (precoInput && sugestaoDiv) {
  precoInput.addEventListener("input", () => {
    const custo = parseFloat(precoInput.value) || 0;
    if (custo > 0) {
      const margem = custo < 1000 ? 2.0 : 1.5;
      const sugestao = custo * margem;
      sugestaoDiv.textContent = `Sugestão de Venda (${custo < 1000 ? '100%' : '50%'} de lucro): R$ ${sugestao.toFixed(2)}`;
      if (precoRevendaInput) {
        precoRevendaInput.value = sugestao.toFixed(2);
      }
    } else {
      sugestaoDiv.textContent = "";
      if (precoRevendaInput) precoRevendaInput.value = "";
    }
  });
}

let allPecas = [];

async function carregarPecas() {
  const res = await authFetch("/pecas");
  allPecas = await res.json();
  renderPecas(allPecas);
}

function renderPecas(pecas) {
  const lista = document.getElementById("lista-pecas");
  lista.innerHTML = "";

  if (!pecas.length) {
    lista.innerHTML = '<li class="empty-state">Nenhuma peça cadastrada.</li>';
    return;
  }

  pecas.forEach(p => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${p.nome}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Estoque: <span style="color: ${p.estoque > 0 ? 'var(--neon)' : 'var(--danger)'}; font-weight: 800;">${p.estoque || 0} unid.</span> | 
            Custo: R$ ${p.preco ? p.preco.toFixed(2) : '0.00'} | 
            Revenda: <span class="peca-price" id="revenda-val-${p.id}">R$ ${p.preco_revenda ? p.preco_revenda.toFixed(2) : '0.00'}</span>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-link" style="color: var(--neon);" onclick="alterarEstoque(${p.id}, ${p.estoque || 0})">Estoque</button>
          <button class="btn-link" style="color: var(--neon-soft);" onclick="alterarRevenda(${p.id}, ${p.preco_revenda || 0})">Revenda</button>
          <button class="btn-link link-quiet" onclick="deletarPeca(${p.id})">Excluir</button>
        </div>
      </div>
    `;
    lista.appendChild(li);
  });
}

document.getElementById("search-pecas").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase().trim();
  const filtered = allPecas.filter(p => 
    (p.nome || "").toLowerCase().includes(term)
  );
  renderPecas(filtered);
});

window.alterarEstoque = async function(id, atual) {
  const novo = prompt("Nova quantidade em ESTOQUE:", atual);
  if (novo === null) return;
  const estoque = parseInt(novo) || 0;

  try {
    const res = await authFetch(`/pecas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ estoque })
    });
    if (res.ok) carregarPecas();
  } catch (e) { alert("Erro de conexão."); }
}

window.alterarRevenda = async function(id, atual) {
  const novo = prompt("Informe o novo preço de REVENDA:", atual.toFixed(2));
  if (novo === null) return;
  const preco_revenda = parseFloat(novo) || 0;

  try {
    const res = await authFetch(`/pecas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ preco_revenda })
    });
    if (res.ok) {
      carregarPecas();
    } else {
      const err = await res.json();
      alert("Erro: " + err.message);
    }
  } catch (e) {
    alert("Erro de conexão.");
  }
}

async function salvarPeca() {
  const nome = document.getElementById("nome").value.trim();
  const precoVal = document.getElementById("preco").value;
  const precoRevendaVal = document.getElementById("preco_revenda").value;
  
  const preco = precoVal ? parseFloat(precoVal) : 0;
  const preco_revenda = precoRevendaVal ? parseFloat(precoRevendaVal) : 0;
  const estoque = parseInt(document.getElementById("estoque").value) || 0;

  if (!nome) {
    alert("Informe o nome da peça.");
    return;
  }

  try {
    const res = await authFetch("/pecas", {
      method: "POST",
      body: JSON.stringify({ nome, preco, preco_revenda, estoque })
    });

    if (res.ok) {
      document.getElementById("nome").value = "";
      document.getElementById("preco").value = "";
      document.getElementById("estoque").value = "0";
      if (precoRevendaInput) precoRevendaInput.value = "";
      if (sugestaoDiv) sugestaoDiv.textContent = "";
      carregarPecas();
    } else {
      const err = await res.json().catch(() => ({}));
      const msg = err.details || err.message || "Erro desconhecido";
      alert("Erro ao salvar peça: " + msg);
    }
  } catch (e) {
    console.error(e);
    alert("Erro de conexão ao salvar peça.");
  }
}

window.deletarPeca = async function(id) {
  if (!confirm("Tem certeza que deseja excluir esta peça?")) return;
  try {
    const res = await authFetch(`/pecas/${id}`, { method: "DELETE" });
    if (res.ok) carregarPecas();
    else alert("Erro ao excluir peça.");
  } catch (e) {
    console.error(e);
    alert("Erro de conexão ao excluir peça.");
  }
}

carregarPecas();
