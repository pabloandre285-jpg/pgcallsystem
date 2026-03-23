requireAuthPage();

const user = getUser();
const admin = isAdmin();

document.getElementById("user-pill").textContent = user
  ? `${user.nome || user.username}${admin ? " · Admin" : ""}`
  : "";

if (canAddUser()) {
  const navUser = document.getElementById("nav-usuarios");
  if (navUser) navUser.hidden = false;
  const navUserSidebar = document.getElementById("nav-usuarios-sidebar");
  if (navUserSidebar) navUserSidebar.hidden = false;
}

// Rendimento Geral link (Restrito ao Pablo Valentim)
  const navRendimento = document.getElementById("nav-rendimento");
  if (navRendimento && (user.nome === "Pablo Valentim" || admin)) {
    navRendimento.hidden = false;
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

// Status tabs logic
let currentStatusFilter = "todos";
const statusTabs = document.getElementById("status-tabs");
if (statusTabs) {
  statusTabs.addEventListener("click", (e) => {
    if (e.target.classList.contains("status-tab")) {
      document.querySelectorAll(".status-tab").forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
      currentStatusFilter = e.target.dataset.status;
      carregarChamados();
    }
  });
}

document.getElementById("btn-sair")?.addEventListener("click", () => logout());
document.getElementById("btn-abrir-chamado")?.addEventListener("click", () => criarChamado());
document.getElementById("modal-fechar")?.addEventListener("click", () => fecharModal());
document.getElementById("modal-cliente")?.addEventListener("click", (e) => {
  if (e.target.id === "modal-cliente") fecharModal();
});

// Modal Detalhe Event Listeners — tela cheia
const modalTicket = document.getElementById("modal-ticket-detalhe");
if (modalTicket) {
  document.getElementById("modal-detalhe-fechar").addEventListener("click", () => {
    modalTicket.hidden = true;
    document.body.style.overflow = "";
    if (modalTimerInterval) clearInterval(modalTimerInterval);
  });
}

// Modal Novo Chamado logic
const modalNovo = document.getElementById("modal-novo-chamado");
const btnNovoModal = document.getElementById("btn-novo-chamado-modal");
const btnNovoFechar = document.getElementById("modal-novo-fechar");

if (btnNovoModal && modalNovo && btnNovoFechar) {
  btnNovoModal.addEventListener("click", () => {
    modalNovo.hidden = false;
    document.body.style.overflow = "hidden";
  });
  btnNovoFechar.addEventListener("click", () => {
    modalNovo.hidden = true;
    document.body.style.overflow = "";
  });
  modalNovo.addEventListener("click", (e) => {
    if (e.target.id === "modal-novo-chamado") {
      modalNovo.hidden = true;
      document.body.style.overflow = "";
    }
  });
}

const cannedMessages = {
  fornecedor: "Prezado cliente, após uma análise técnica detalhada, identificamos a necessidade de substituição de componentes específicos. O pedido das peças já foi realizado junto ao nosso fornecedor e estamos aguardando a entrega para dar continuidade ao serviço. Manteremos você informado sobre qualquer atualização no prazo de entrega.",
  usuario: "Olá, o diagnóstico do seu dispositivo foi concluído. Estamos agora aguardando a sua aprovação do orçamento/procedimento enviado para prosseguirmos com o reparo. Caso tenha alguma dúvida, nossa equipe está à disposição para esclarecimentos.",
  concluido: "Temos boas notícias! O serviço solicitado em seu dispositivo foi concluído com sucesso e passou por todos os nossos testes de qualidade. O equipamento já está disponível para retirada em nossa unidade. Agradecemos a preferência!"
};

async function carregarMensagensTecnico() {
  const select = document.getElementById("detalhe-mensagens-prontas");
  if (!select) return;

  // Manter as padrão e adicionar as do técnico
  select.innerHTML = `
    <option value="">Mensagens Rápidas...</option>
    <option value="fornecedor">Aguardando Fornecedor</option>
    <option value="usuario">Aguardando Usuário/Aprovação</option>
    <option value="concluido">Finalização de Serviço</option>
  `;

  try {
    const res = await authFetch("/tecnico/mensagens");
    const msgs = await res.json();
    if (msgs.length > 0) {
      const group = document.createElement("optgroup");
      group.label = "Minhas Mensagens";
      msgs.forEach(m => {
        const opt = document.createElement("option");
        opt.value = "custom_" + m.id;
        opt.textContent = m.titulo;
        opt.dataset.msg = m.mensagem;
        group.appendChild(opt);
      });
      select.appendChild(group);
    }
  } catch (e) { console.error(e); }
}

const msgSelect = document.getElementById("detalhe-mensagens-prontas");
if (msgSelect) {
  msgSelect.addEventListener("change", () => {
    const key = msgSelect.value;
    const notaInput = document.getElementById("detalhe-nota-input");
    if (!notaInput) return;

    if (key.startsWith("custom_")) {
      const opt = msgSelect.options[msgSelect.selectedIndex];
      if (opt) notaInput.value = opt.dataset.msg;
    } else if (key && cannedMessages[key]) {
      notaInput.value = cannedMessages[key];
    }
    // Reset select to placeholder after picking a message
    msgSelect.value = "";
  });
}

const waChk = document.getElementById("wa_auto");
if (waChk) {
  if (localStorage.getItem("pg_wa_auto") === "0") waChk.checked = false;
  waChk.addEventListener("change", () => {
    localStorage.setItem("pg_wa_auto", waChk.checked ? "1" : "0");
  });
}

function waAutoOpen() {
  const el = document.getElementById("wa_auto");
  return el ? el.checked : true;
}

function openWhatsAppIfAny(url) {
  if (!url || !waAutoOpen()) return;
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    window.prompt("Pop-up bloqueado. Copie o link:", url);
  }
}

let ticketStatuses = [];

async function carregarMeta() {
  try {
    const res = await authFetch("/meta/ticket-statuses");
    if (res.ok) {
      ticketStatuses = await res.json();
    }
  } catch (e) {
    console.error("Erro ao carregar meta:", e);
  }
}

function labelStatus(value) {
  const s = ticketStatuses.find((x) => x.value === value);
  return s ? s.label : value || "—";
}

function badgeClassForStatus(value) {
  const closed = value === "finalizado" || value === "cancelado";
  return closed ? "badge badge-fechado" : "badge badge-aberto";
}

async function carregarClientesSelect() {
  try {
    const res = await authFetch("/clientes");
    if (!res.ok) return;
    const list = await res.json();
    const sel = document.getElementById("cliente_id");
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Selecione o cliente</option>';
    list.forEach((c) => {
      const o = document.createElement("option");
      o.value = String(c.id);
      o.textContent = c.nome_completo;
      sel.appendChild(o);
    });
    if (cur && [...sel.options].some((o) => o.value === cur)) sel.value = cur;
  } catch (e) { console.error(e); }
}

async function criarChamado() {
  const titulo = document.getElementById("titulo").value.trim();
  const descricao = document.getElementById("descricao").value.trim();
  const cliente_id = document.getElementById("cliente_id").value;
  const prioridade = document.getElementById("prioridade").value;

  if (!titulo) {
    alert("Informe o título.");
    return;
  }
  if (!cliente_id) {
    alert("Selecione o cliente.");
    return;
  }

  const res = await authFetch("/tickets", {
    method: "POST",
    body: JSON.stringify({ titulo, descricao, cliente_id: parseInt(cliente_id, 10), prioridade })
  });

  if (!res.ok) {
    const t = await res.json().catch(() => ({}));
    alert(t.message || "Erro ao abrir chamado.");
    return;
  }

  const data = await res.json().catch(() => ({}));
  document.getElementById("titulo").value = "";
  document.getElementById("descricao").value = "";
  await carregarChamados();
  if (data.whatsapp_url) openWhatsAppIfAny(data.whatsapp_url);
  else if (waAutoOpen()) alert("Cliente sem celular — sem link WhatsApp.");
  
  const modal = document.getElementById("modal-novo-chamado");
  if (modal) { modal.hidden = true; document.body.style.overflow = ""; }
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

function abrirModalCliente(ticket) {
  const body = document.getElementById("modal-cliente-body");
  if (!ticket.cliente_id) {
    body.innerHTML = "<p>Sem cliente.</p>";
  } else {
    const tel = String(ticket.cliente_celular || "").replace(/\D/g, "");
    body.innerHTML = `
      <p><strong>Nome:</strong> ${escapeHtml(ticket.cliente_nome)}</p>
      <p><strong>Celular:</strong> <a href="tel:${escapeHtml(tel)}">${escapeHtml(ticket.cliente_celular || "—")}</a></p>
      <p><strong>CPF:</strong> ${escapeHtml(ticket.cliente_cpf || "—")}</p>
      <p><strong>Nascimento:</strong> ${escapeHtml(ticket.cliente_data_nascimento || "—")}</p>
      <p><strong>CEP:</strong> ${escapeHtml(ticket.cliente_cep || "—")}</p>
      <p><strong>Endereço:</strong> ${escapeHtml(ticket.cliente_endereco || "—")}</p>
    `;
  }
  document.getElementById("modal-cliente").hidden = false;
}

function fecharModal() {
  document.getElementById("modal-cliente").hidden = true;
}

async function atualizarStatusTicket(id, status, valor_total = 0) {
  const res = await authFetch(`/tickets/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status, valor_total })
  });
  if (!res.ok) {
    const t = await res.json().catch(() => ({}));
    alert(t.message || "Erro ao atualizar status.");
    return;
  }
  const data = await res.json().catch(() => ({}));
  await carregarChamados();
  if (data.whatsapp_url) openWhatsAppIfAny(data.whatsapp_url);
}

function formatTimer(ms) {
  // Garante que o tempo nunca seja negativo
  const safeMs = Math.max(0, ms || 0);
  const minutes = Math.floor((safeMs / (1000 * 60)) % 60);
  const hours = Math.floor((safeMs / (1000 * 60 * 60)) % 24);
  const totalDays = Math.floor(safeMs / (1000 * 60 * 60 * 24));

  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  
  return `Dia ${totalDays}  ${h}:${m}`;
}

function getTimerEmoji(ms) {
  if (!ms) return "😊";
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const oneMonth = 1000 * 60 * 60 * 24 * 30;
  
  if (ms > oneMonth) return "😡";
  if (ms > oneWeek) return "😢";
  return "😊";
}

// Professional Toast System
function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="flex: 1;">${message}</span>
    <button type="button" class="btn-link link-quiet" style="font-size: 1.2rem;">&times;</button>
  `;
  toast.querySelector("button").onclick = () => toast.remove();
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// Override alerts with toasts
window.alert = (msg) => showToast(msg, "info");

async function copyToClipboard(text, msg = "Copiado para a área de transferência!") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(msg);
  } catch (err) {
    console.error("Erro ao copiar:", err);
  }
}

function formatTimerBeauty(ms) {
  const safeMs = Math.max(0, ms || 0);
  const minutes = Math.floor((safeMs / (1000 * 60)) % 60);
  const hours = Math.floor((safeMs / (1000 * 60 * 60)) % 24);
  const totalDays = Math.floor(safeMs / (1000 * 60 * 60 * 24));

  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  
  let html = `
    <div class="timer-pro-digits">
      <span class="timer-day-val">Dia ${totalDays}</span>
      <span class="timer-time-val">${h}:${m}</span>
    </div>
  `;
  return html;
}

async function carregarChamados() {
  const res = await authFetch("/tickets");
  const allTickets = await res.json();
  let chamados = [...allTickets];
  const lista = document.getElementById("lista");
  lista.innerHTML = "";

  // Dashboard Summary Logic
  const ativos = allTickets.filter(t => ['em_atendimento', 'aprovado'].includes(t.status)).length;
  const pendentes = allTickets.filter(t => ['pendente_usuario', 'pendente_aprovacao'].includes(t.status)).length;
  const fornecedor = allTickets.filter(t => t.status === 'pendente_fornecedor').length;
  
  document.getElementById("summary-ativos").textContent = ativos;
  document.getElementById("summary-pendentes").textContent = pendentes;
  document.getElementById("summary-fornecedor").textContent = fornecedor;

  if (admin || user.nome === "Pablo Valentim") {
    const cardFat = document.getElementById("card-faturamento-hoje");
    if (cardFat) {
      cardFat.hidden = false;
      const hoje = new Date().toISOString().slice(0, 10);
      const fatHoje = allTickets
        .filter(t => t.status === 'concluido' && t.concluido_em && t.concluido_em.startsWith(hoje))
        .reduce((acc, curr) => acc + (curr.valor_total || 0), 0);
      document.getElementById("summary-faturamento").textContent = `R$ ${fatHoje.toFixed(2)}`;
    }
  }

  // Search Logic
  const searchInput = document.getElementById("search-tickets");
  const filterBySearch = (list) => {
    const term = searchInput.value.toLowerCase().replace('#', '').trim();
    if (!term) return list;
    return list.filter(t => 
      (t.cliente_nome || "").toLowerCase().includes(term) ||
      (t.titulo || "").toLowerCase().includes(term) ||
      String(t.id).includes(term)
    );
  };

  searchInput.oninput = () => carregarChamados(); // Re-render on search

  // Atualizar nome da aba do técnico
  const tabTecnico = document.getElementById("tab-tecnico-nome");
  if (tabTecnico) {
    const nomeExibicao = user.nome ? user.nome.split(' ')[0].toUpperCase() : user.username.toUpperCase();
    tabTecnico.innerHTML = `${nomeExibicao} <span class="badge-count" id="count-meus-chamados">0</span>`;
  }

  // Filtrar por aba
  const statusFechados = ["concluido", "cancelado"];

  if (currentStatusFilter === "todos") {
    // Todos = todos os chamados em aberto, independente de técnico
    chamados = chamados.filter(c => !statusFechados.includes(c.status));
  } else if (currentStatusFilter === "meus_chamados") {
    // Aba do técnico = só os dele E em aberto
    chamados = chamados.filter(c => c.tecnico_id === user.id && !statusFechados.includes(c.status));
  } else {
    // Abas de status específico = todos com aquele status
    chamados = chamados.filter(c => c.status === currentStatusFilter);
  }

  // Aplicar busca
  chamados = filterBySearch(chamados);

  // Atualizar contadores
  atualizarContadores(allTickets);

  if (!chamados.length) {
    lista.innerHTML = `<li class="empty-state">${currentStatusFilter === "todos" ? "Nenhum chamado." : "Nenhum chamado com este status."}</li>`;
    return;
  }

  chamados.forEach((c) => {
    const st = c.status || "";
    const card = document.createElement("li");
    card.className = "ticket-card";
    
    // Calcula tempo real se o timer estiver rodando
    let tempoTotal = c.tempo_tecnico_ms || 0;
    if (c.timer_inicio) {
      tempoTotal += (new Date() - new Date(c.timer_inicio));
    }

    card.innerHTML = `
      <div class="priority-badge priority-${c.prioridade}">${c.prioridade}</div>
      <div class="ticket-num">#${escapeHtml(String(c.id))}</div>
      <div class="ticket-client">${escapeHtml(c.cliente_nome || "—")}</div>
      <div class="ticket-title">${escapeHtml(c.titulo)}</div>
      <div class="ticket-desc-short">${escapeHtml(c.descricao || "")}</div>
      <div class="ticket-technician" style="margin-top: 0.5rem;">${c.tecnico_nome ? `Técnico: ${escapeHtml(c.tecnico_nome)}` : "Aguardando Agente"}</div>
      <div class="ticket-status">
        <span class="${badgeClassForStatus(st)}">${escapeHtml(labelStatus(st))}</span>
      </div>
      <div class="ticket-timer">
        <span class="timer-emoji">${getTimerEmoji(tempoTotal)}</span>
        <span>Tempo Ativo: ${formatTimer(tempoTotal)}</span>
      </div>
    `;
    card.addEventListener("click", () => abrirModalTicket(c));
    lista.appendChild(card);
  });
}

let modalTimerInterval = null;
let currentPiecesList = [];

// Signature Pad Logic
let isSigning = false;
let sigCanvas, sigCtx;

function initSignaturePad() {
  sigCanvas = document.getElementById('signature-pad');
  if (!sigCanvas) return;
  sigCtx = sigCanvas.getContext('2d');
  
  // Ajustar tamanho real do canvas
  sigCanvas.width = sigCanvas.offsetWidth;
  sigCanvas.height = sigCanvas.offsetHeight;

  sigCtx.strokeStyle = "#000";
  sigCtx.lineWidth = 2;
  sigCtx.lineJoin = "round";
  sigCtx.lineCap = "round";

  const getPos = (e) => {
    const rect = sigCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const start = (e) => {
    isSigning = true;
    const { x, y } = getPos(e);
    sigCtx.beginPath();
    sigCtx.moveTo(x, y);
    if (e.cancelable) e.preventDefault();
  };

  const move = (e) => {
    if (!isSigning) return;
    const { x, y } = getPos(e);
    sigCtx.lineTo(x, y);
    sigCtx.stroke();
    if (e.cancelable) e.preventDefault();
  };

  const stop = () => {
    isSigning = false;
  };

  sigCanvas.onmousedown = start;
  sigCanvas.onmousemove = move;
  window.onmouseup = stop;

  sigCanvas.ontouchstart = start;
  sigCanvas.ontouchmove = move;
  sigCanvas.ontouchend = stop;

  document.getElementById('btn-limpar-assinatura').onclick = () => {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  };
}

async function abrirModalTicket(ticket) {
  const modal = document.getElementById("modal-ticket-detalhe");
  if (!modal) return;

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  // Header
  document.getElementById("detalhe-titulo").textContent = `#${ticket.id}`;
  document.getElementById("detalhe-cliente-header").textContent = ticket.cliente_nome || "Cliente não informado";
  document.getElementById("detalhe-status-label").textContent = labelStatus(ticket.status);

  // Timer no header
  const headerTimer = document.getElementById("detalhe-header-timer");
  if (modalTimerInterval) clearInterval(modalTimerInterval);

  const updateHeaderTimer = () => {
    let tempoTotal = ticket.tempo_tecnico_ms || 0;
    const isRunning = !!ticket.timer_inicio;
    if (isRunning) tempoTotal += (new Date() - new Date(ticket.timer_inicio));
    headerTimer.innerHTML = `
      <div class="timer-pro-dashboard ${isRunning ? "timer-running" : ""}">
        <div class="timer-pro-main">
          <span class="timer-pro-label">${isRunning ? "Em Execução" : "Em Pausa"}</span>
          ${formatTimerBeauty(tempoTotal)}
        </div>
        <div class="timer-pro-status">
          <div class="timer-pro-emoji-wrapper">${getTimerEmoji(tempoTotal)}</div>
        </div>
      </div>`;
  };
  updateHeaderTimer();
  modalTimerInterval = setInterval(updateHeaderTimer, 1000);

  // Card do cliente
  const renderExtra = (label, value) => {
    if (!value || value === "—" || value === "") return "";
    return `<p style="margin:0 0 0.4rem;font-size:0.88rem;"><span style="color:var(--text-muted);font-size:0.7rem;text-transform:uppercase;letter-spacing:.08em;">${label}</span><br><span style="color:#fff;">${escapeHtml(value)}</span></p>`;
  };
  document.getElementById("detalhe-cliente-nome").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.5rem;">
      <span style="font-size:1.15rem;font-weight:800;color:#fff;">${escapeHtml(ticket.cliente_nome || "—")}</span>
      <div id="cliente-detalhes-extras" style="display:none;margin-top:0.25rem;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem 1.5rem;">
        ${renderExtra("Celular", ticket.cliente_celular)}
        ${renderExtra("CPF", ticket.cliente_cpf)}
        ${renderExtra("CEP", ticket.cliente_cep)}
        ${renderExtra("Endereço", ticket.cliente_endereco)}
      </div>
      <button type="button" class="toggle-details-btn" id="btn-toggle-cliente">Exibir detalhes do cliente</button>
    </div>`;
  const btnToggle = document.getElementById("btn-toggle-cliente");
  const extras = document.getElementById("cliente-detalhes-extras");
  if (btnToggle && extras) {
    extras.style.display = "none";
    btnToggle.onclick = () => {
      const hidden = extras.style.display === "none";
      extras.style.display = hidden ? "grid" : "none";
      btnToggle.textContent = hidden ? "Ocultar detalhes" : "Exibir detalhes do cliente";
    };
  }

  // Foto do defeito
  const fotoCont = document.getElementById("detalhe-foto-container");
  const fotoImg = document.getElementById("detalhe-foto-img");
  if (ticket.foto_defeito) {
    fotoCont.style.display = "block";
    fotoImg.src = ticket.foto_defeito;
    fotoImg.onclick = () => window.open(ticket.foto_defeito, "_blank");
  } else {
    fotoCont.style.display = "none";
  }

  // Assinatura
  const sigWrap = document.getElementById("detalhe-assinatura-wrap");
  const sigDisplay = document.getElementById("assinatura-display");
  const sigSalva = document.getElementById("img-assinatura-salva");
  const sigCanvasWrap = document.getElementById("assinatura-canvas-wrap");
  if (ticket.status === "concluido" || ticket.assinatura_digital) {
    sigWrap.style.display = "block";
    if (ticket.assinatura_digital) {
      sigDisplay.style.display = "block";
      sigSalva.src = ticket.assinatura_digital;
      sigCanvasWrap.style.display = "none";
    } else {
      sigDisplay.style.display = "none";
      sigCanvasWrap.style.display = "block";
      setTimeout(initSignaturePad, 100);
    }
  } else {
    sigWrap.style.display = "none";
  }

  // Agente / Técnico
  const agenteBox = document.getElementById("detalhe-agente-box");
  if (ticket.tecnico_id) {
    agenteBox.innerHTML = `<span style="font-size:0.8rem;color:var(--neon);font-weight:700;background:var(--neon-dim);padding:0.3rem 0.75rem;border-radius:20px;border:1px solid var(--neon-soft);">TÉCNICO: ${escapeHtml(ticket.tecnico_nome || "Atribuído")}</span>`;
  } else {
    agenteBox.innerHTML = `<button type="button" class="btn-info" id="btn-ser-agente" style="padding:0.5rem 1.1rem;font-size:0.8rem;">Atender Chamado</button>`;
    document.getElementById("btn-ser-agente").onclick = async () => {
      try {
        const res = await authFetch(`/tickets/${ticket.id}/take`, { method: "POST" });
        const resData = await res.json().catch(() => ({}));
        if (res.ok) {
          ticket.tecnico_id = user.id;
          ticket.tecnico_nome = resData.tecnico_nome;
          ticket.timer_inicio = new Date().toISOString();
          abrirModalTicket(ticket);
          carregarChamados();
        } else {
          alert(resData.message || "Erro ao assumir chamado.");
        }
      } catch { alert("Erro de conexão."); }
    };
  }

  // Reset nota
  const notaInputReset = document.getElementById("detalhe-nota-input");
  notaInputReset.value = "";
  delete notaInputReset.dataset.pendingStatus;
  const btnAddReset = document.getElementById("btn-add-nota-detalhe");
  if (btnAddReset) btnAddReset.querySelector("span:last-child").textContent = "Adicionar Nota";

  // Status edit
  const stWrap = document.getElementById("detalhe-status-edit-wrap");
  const stSel = document.getElementById("detalhe-status-select");
  if (admin || ticket.tecnico_id === user.id) {
    stWrap.hidden = false;
    stSel.innerHTML = ticketStatuses.map(s =>
      `<option value="${s.value}" ${s.value === ticket.status ? "selected" : ""}>${s.label}</option>`
    ).join("");
    const existingExtra = stWrap.querySelector(".extra-field");
    if (existingExtra) existingExtra.remove();
    stSel.onchange = async () => {
      let valor = ticket.valor_total;
      let assinatura = null;
      if (stSel.value === "concluido") {
        if (sigCanvas && sigCanvasWrap.style.display !== "none") assinatura = sigCanvas.toDataURL();
      }
      const res = await authFetch(`/tickets/${ticket.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: stSel.value, valor_total: valor, assinatura_digital: assinatura })
      });
      if (res.ok) {
        ticket.status = stSel.value;
        ticket.valor_total = valor;
        document.getElementById("detalhe-status-label").textContent = labelStatus(ticket.status);
        showToast("Status atualizado!");
        carregarChamados();
      }
    };
  } else {
    stWrap.hidden = true;
  }

  // ── Dropdown de Pendências ──────────────────────────────────────
  const pendingMsgs = {
    pendente_fornecedor: "ATUALIZAÇÃO — AGUARDANDO FORNECEDOR\n\nApós análise técnica detalhada do equipamento, identificamos a necessidade de substituição de componentes específicos. O pedido de aquisição das peças já foi formalizado junto ao nosso fornecedor credenciado e aguardamos a confirmação de entrega para dar continuidade ao reparo.\n\nAssim que as peças chegarem, daremos início imediato ao serviço e manteremos você informado sobre qualquer atualização no prazo.",
    pendente_usuario:   "AGUARDANDO APROVAÇÃO DO CLIENTE\n\nO diagnóstico técnico do seu equipamento foi concluído com sucesso. O orçamento detalhado com os serviços necessários e os respectivos valores já está disponível para sua análise.\n\nPara que possamos dar início ao reparo com a máxima agilidade, solicitamos gentilmente a sua aprovação. Em caso de dúvidas, nossa equipe está à disposição para esclarecimentos.",
    pendente_aprovacao: "AGUARDANDO APROVAÇÃO INTERNA\n\nO chamado foi analisado e encaminhado para aprovação da gestão antes de prosseguirmos com a execução do serviço. Assim que a autorização for concedida, o atendimento será retomado imediatamente.\n\nAgradecemos a compreensão.",
    aprovado:           "SERVIÇO APROVADO — INICIANDO EXECUÇÃO\n\nInformamos que o serviço foi devidamente aprovado e nossa equipe técnica já está dando início aos procedimentos de reparo. Trabalharemos com máxima atenção e qualidade para concluir o atendimento no menor tempo possível.\n\nManteremos você atualizado sobre o andamento.",
    concluido:          "SERVIÇO CONCLUÍDO COM SUCESSO\n\nTemos o prazer de informar que o reparo do seu equipamento foi finalizado. O dispositivo passou por todos os nossos testes de controle de qualidade e está disponível para retirada em nossa unidade.\n\nAgradecemos a confiança em nossos serviços. Qualquer dúvida, estamos à disposição.",
    cancelado:          "CHAMADO ENCERRADO\n\nInformamos que este chamado foi encerrado sem a execução do serviço. Caso necessite de suporte ou queira reabrir o atendimento, entre em contato com nossa equipe.\n\nAgradecemos o contato."
  };

  const btnQuickEl = document.getElementById("btn-quick-msgs");
  const popoverEl = document.getElementById("quick-msgs-popover");

  if (btnQuickEl && popoverEl) {
    popoverEl.hidden = true;
    btnQuickEl.classList.remove("open");

    // Clonar para remover listeners antigos
    const newBtn = btnQuickEl.cloneNode(true);
    btnQuickEl.parentNode.replaceChild(newBtn, btnQuickEl);
    const freshPopover = document.getElementById("quick-msgs-popover");

    newBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = freshPopover.hidden;
      freshPopover.hidden = !isHidden;
      newBtn.classList.toggle("open", isHidden);
    });

    const closeDropdown = () => {
      freshPopover.hidden = true;
      newBtn.classList.remove("open");
    };
    document.addEventListener("click", closeDropdown);
    freshPopover.addEventListener("click", (e) => e.stopPropagation());

    freshPopover.querySelectorAll(".tfs-pending-item").forEach(item => {
      item.onclick = (ev) => {
        ev.stopPropagation();
        const status = item.dataset.status;
        const content = pendingMsgs[status] || "";

        // Só preenche a nota — não salva ainda
        document.getElementById("detalhe-nota-input").value = content;
        // Guarda o status pendente no textarea como data attribute
        document.getElementById("detalhe-nota-input").dataset.pendingStatus = status;
        // Atualiza visual do botão salvar
        const btnAdd = document.getElementById("btn-add-nota-detalhe");
        if (btnAdd) btnAdd.querySelector("span:last-child").textContent = `Salvar e ir para "${labelStatus(status)}"`;
        closeDropdown();
      };
    });
  }

  // Botão Adicionar Nota
  const btnAddNota = document.getElementById("btn-add-nota-detalhe");
  btnAddNota.onclick = async () => {
    const notaInput = document.getElementById("detalhe-nota-input");
    const content = notaInput.value.trim();
    if (!content) return;

    const pendingStatus = notaInput.dataset.pendingStatus || null;

    const res = await authFetch(`/tickets/${ticket.id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    if (!res.ok) { alert("Erro ao salvar nota."); return; }

    // Se veio de uma pendência, muda o status também
    if (pendingStatus) {
      const resStatus = await authFetch(`/tickets/${ticket.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: pendingStatus, valor_total: ticket.valor_total })
      });
      if (resStatus.ok) {
        ticket.status = pendingStatus;
        document.getElementById("detalhe-status-label").textContent = labelStatus(pendingStatus);
        const sel = document.getElementById("detalhe-status-select");
        if (sel) sel.value = pendingStatus;
        showToast(`Nota salva e status alterado para "${labelStatus(pendingStatus)}"`, "success");
        carregarChamados();
      }
    } else {
      showToast("Nota adicionada!", "success");
    }

    notaInput.value = "";
    delete notaInput.dataset.pendingStatus;
    btnAddNota.querySelector("span:last-child").textContent = "Adicionar Nota";
    carregarNotasDetalhe(ticket.id);
  };

  // Botão Adicionar Peça
  const btnAddPeca = document.getElementById("btn-add-peca-detalhe");
  if (btnAddPeca) {
    btnAddPeca.onclick = async () => {
      const pecaId = document.getElementById("detalhe-peca-select").value;
      if (!pecaId) return;
      const pecaSelecionada = currentPiecesList.find(p => String(p.id) === String(pecaId));
      const preco_venda_padrao = pecaSelecionada ? pecaSelecionada.preco_revenda : 0;
      const promptMsg = preco_venda_padrao > 0
        ? "Confirme ou altere o PREÇO DE VENDA para este chamado:"
        : "Esta peça não tem preço definido. Informe o PREÇO DE VENDA:";
      const vendaStr = prompt(promptMsg, preco_venda_padrao > 0 ? preco_venda_padrao.toFixed(2) : "");
      if (vendaStr === null) return;
      const preco_venda = parseFloat(vendaStr) || preco_venda_padrao;
      const res = await authFetch(`/tickets/${ticket.id}/pecas`, {
        method: "POST",
        body: JSON.stringify({ peca_id: parseInt(pecaId, 10), preco_venda })
      });
      if (res.ok) carregarPecasDetalhe(ticket.id);
    };
  }

  // Botão Imprimir O.S.
  const btnImprimirOS = document.getElementById("btn-imprimir-os");
  if (btnImprimirOS) {
    btnImprimirOS.onclick = () => {
      const printWindow = window.open("", "_blank");
      const notasHtml = document.getElementById("detalhe-notas-lista").innerHTML;
      const pecasHtml = document.getElementById("detalhe-pecas-lista").innerHTML;
      const assinaturaImg = ticket.assinatura_digital
        ? `<img src="${ticket.assinatura_digital}" style="max-width:250px;">`
        : '<div style="height:60px;border-bottom:1px solid #000;width:250px;margin:0 auto;"></div>';
      printWindow.document.write(`
        <html><head><title>O.S. #${ticket.id}</title>
        <style>body{font-family:sans-serif;padding:40px;color:#1a1a1a;}h2{margin-bottom:4px;}p{margin:4px 0;font-size:13px;}.section{margin-top:20px;border-top:1px solid #ccc;padding-top:10px;}</style>
        </head><body>
        <h2>ORDEM DE SERVIÇO #${ticket.id}</h2>
        <p><strong>Cliente:</strong> ${escapeHtml(ticket.cliente_nome || "—")}</p>
        <p><strong>Status:</strong> ${escapeHtml(labelStatus(ticket.status))}</p>
        <p><strong>Título:</strong> ${escapeHtml(ticket.titulo || "—")}</p>
        <div class="section"><strong>Notas:</strong>${notasHtml}</div>
        <div class="section"><strong>Peças:</strong>${pecasHtml}</div>
        <div class="section" style="text-align:center;"><strong>Assinatura:</strong><br>${assinaturaImg}</div>
        </body></html>`);
      printWindow.document.close();
      printWindow.print();
    };
  }

  // Carregar dados
  carregarNotasDetalhe(ticket.id);
  carregarPecasDetalhe(ticket.id);
}

async function carregarNotasDetalhe(ticketId) {
  const container = document.getElementById("detalhe-notas-lista");
  container.innerHTML = "Carregando notas...";
  const res = await authFetch(`/tickets/${ticketId}/notes`);
  const notes = await res.json();
  container.innerHTML = notes.length ? "" : "Nenhuma nota.";
  notes.forEach(n => {
    const div = document.createElement("div");
    div.className = "note-bubble";
    div.innerHTML = `
      <div class="note-meta">
        <strong>${escapeHtml(n.user_name)}</strong>
        <span>${new Date(n.created_at).toLocaleString()}</span>
      </div>
      <div>${escapeHtml(n.content)}</div>
    `;
    container.appendChild(div);
  });
}

async function carregarPecasDetalhe(ticketId) {
  const container = document.getElementById("detalhe-pecas-lista");
  const select = document.getElementById("detalhe-peca-select");
  container.innerHTML = "Carregando peças...";

  try {
    // Select piece list
    const resPecas = await authFetch("/pecas");
    const allPecas = await resPecas.json();
    currentPiecesList = allPecas; // Armazenar globalmente para o btnAddPeca usar
    
    select.innerHTML = '<option value="">Adicionar peça...</option>';
    allPecas.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.nome;
      select.appendChild(opt);
    });

    // Ticket piece list
    const res = await authFetch(`/tickets/${ticketId}/pecas`);
    const pecas = await res.json();
    container.innerHTML = pecas.length ? "" : "Nenhuma peça vinculada.";
    pecas.forEach(p => {
      const div = document.createElement("div");
      div.className = "peca-item";
      
      // O preco_venda que está na tabela ticket_pecas é o que foi salvo no momento da inclusão
      const vOriginal = p.preco_venda_original || 0;
      const vSalvo = p.preco_venda || 0;

      div.innerHTML = `
        <div style="display: flex; flex-direction: column;">
          <span style="font-weight: 600;">${escapeHtml(p.nome)} (x${p.quantidade})</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Custo: R$ ${p.preco_custo || 0}</span>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end;">
          <span class="peca-price">Venda: R$ ${escapeHtml(String(vSalvo.toFixed(2)))}</span>
          <span style="font-size: 0.7rem; color: var(--neon-soft);">Lucro: R$ ${(vSalvo - (p.preco_custo || 0)).toFixed(2)}</span>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (e) {
    console.error(e);
    container.innerHTML = "Erro ao carregar peças.";
  }
}

function atualizarContadores(chamados) {
  const statusFechados = ["concluido", "cancelado"];
  const counts = {
    todos: 0,
    meus_chamados: 0,
    pendente_fornecedor: 0,
    pendente_usuario: 0,
    pendente_aprovacao: 0,
    aprovado: 0,
    concluido: 0
  };

  chamados.forEach(c => {
    const fechado = statusFechados.includes(c.status);

    // Todos: qualquer chamado em aberto
    if (!fechado) counts.todos++;

    // Meus chamados: só os do técnico logado em aberto
    if (user && c.tecnico_id === user.id && !fechado) {
      counts.meus_chamados++;
    }

    // Contadores por status (todos os chamados)
    if (counts[c.status] !== undefined) counts[c.status]++;
  });

  document.getElementById("count-todos").textContent = counts.todos;
  if (document.getElementById("count-meus-chamados")) {
    document.getElementById("count-meus-chamados").textContent = counts.meus_chamados;
  }
  document.getElementById("count-fornecedor").textContent = counts.pendente_fornecedor;
  document.getElementById("count-usuario").textContent = counts.pendente_usuario;
  document.getElementById("count-aprovacao").textContent = counts.pendente_aprovacao;
  document.getElementById("count-aprovado").textContent = counts.aprovado;
  document.getElementById("count-concluido").textContent = counts.concluido;
}

(async () => {
  await carregarMeta();
  await carregarClientesSelect();
  await carregarChamados();
  await carregarMensagensTecnico();
})();
