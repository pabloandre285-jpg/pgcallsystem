requireAuthPage();

const user = getUser();
const admin = isAdmin();

// Apenas o Pablo Valentim ou Admin pode ver rendimento geral
if (user.nome !== "Pablo Valentim" && !admin) {
  alert("Acesso restrito ao proprietário.");
  window.location.href = "chamados.html";
}

document.getElementById("user-pill").textContent = user
  ? `${user.nome || user.username}${admin ? " · Admin" : ""}`
  : "";

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

async function carregarRendimento() {
  try {
    const res = await authFetch("/stats/geral");
    if (!res.ok) {
      const err = await res.json();
      alert(err.message || "Erro ao carregar estatísticas.");
      return;
    }

    const data = await res.json();
    
    // Preencher tabelas técnicos
    const tbodyTec = document.getElementById("tbody-tecnicos");
    tbodyTec.innerHTML = "";
    
    let totalFaturamento = 0;
    let totalConcluidos = 0;
    let melhorTec = { nome: "—", lucro: 0 };

    data.tecnicos.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.nome}</td>
        <td>${t.mes}</td>
        <td>${t.total_atendidos}</td>
        <td>R$ ${t.total_lucro.toFixed(2)}</td>
      `;
      tbodyTec.appendChild(tr);

      // Calcular mensal
      const mesAtual = new Date().toISOString().slice(0, 7);
      if (t.mes === mesAtual) {
        totalFaturamento += t.total_lucro;
        totalConcluidos += t.total_atendidos;
        if (t.total_lucro > melhorTec.lucro) {
          melhorTec = { nome: t.nome, lucro: t.total_lucro };
        }
      }
    });

    document.getElementById("total-faturamento").textContent = `R$ ${totalFaturamento.toFixed(2)}`;
    document.getElementById("total-concluidos").textContent = totalConcluidos;
    document.getElementById("melhor-tecnico").textContent = melhorTec.nome;

    // Preencher empresa
    const tbodyEmp = document.getElementById("tbody-empresa");
    tbodyEmp.innerHTML = "";
    data.empresa.forEach(e => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.data}</td>
        <td>R$ ${e.ganho_dia.toFixed(2)}</td>
      `;
      tbodyEmp.appendChild(tr);
    });

  } catch (e) {
    console.error(e);
    alert("Erro de conexão ao carregar rendimento.");
  }
}

carregarRendimento();
