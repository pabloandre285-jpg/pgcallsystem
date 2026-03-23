const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const { seedDefaultUsers } = require("./users-seed");
const {
  buildWhatsAppUrl,
  msgAberturaChamado,
  msgStatusChamado
} = require("./whatsapp");

const JWT_SECRET = process.env.JWT_SECRET || "pgcall-dev-altere-em-producao";
const PORT = process.env.PORT || 3000;

const TICKET_STATUSES = [
  { value: "pendente_fornecedor", label: "Pendente Fornecedor" },
  { value: "pendente_usuario", label: "Pendente Usuário" },
  { value: "pendente_aprovacao", label: "Pendente Aprovação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" }
];

const STATUS_VALUES = new Set(TICKET_STATUSES.map((s) => s.value));
const STATUS_LABEL = Object.fromEntries(TICKET_STATUSES.map((s) => [s.value, s.label]));

function montarEnderecoCompleto(p) {
  const log = (p.logradouro || "").trim();
  const cid = (p.cidade || "").trim();
  const cep = String(p.cep || "").replace(/\D/g, "");
  if (log && cid && cep) {
    const num = (p.numero_complemento || "").trim() || "s/n";
    const br = (p.bairro || "").trim();
    const uf = (p.uf || "").trim();
    return `${log}, ${num} — ${br}, ${cid}/${uf} — CEP ${cep}`;
  }
  return String(p.endereco_completo || "").trim();
}

console.log("Iniciando PGcallSystem…");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// Servir frontend
app.use(express.static(path.join(__dirname, "../frontend")));

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

function runIgnoreDup(sql, done) {
  db.run(sql, (err) => {
    if (err && !String(err.message).includes("duplicate column")) {
      console.error("[mig]", err.message);
    }
    if (done) done();
  });
}

db.serialize(() => {
  // 1. Criar tabelas base se não existirem
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, nome TEXT, role TEXT DEFAULT 'operador', pode_add_usuario INTEGER DEFAULT 0, cliente_id INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome_completo TEXT NOT NULL, celular TEXT, cpf TEXT UNIQUE, data_nascimento TEXT, endereco_completo TEXT, created_at TEXT DEFAULT (datetime('now')), cep TEXT, logradouro TEXT, bairro TEXT, cidade TEXT, uf TEXT, numero_complemento TEXT, password TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT, descricao TEXT, status TEXT, cliente_id INTEGER, tecnico_id INTEGER, valor_total REAL DEFAULT 0, concluido_em TEXT, created_at TEXT DEFAULT (datetime('now')), prioridade TEXT DEFAULT 'baixa', tempo_tecnico_ms INTEGER DEFAULT 0, timer_inicio TEXT, assinatura_digital TEXT, foto_defeito TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS tecnico_mensagens (id INTEGER PRIMARY KEY AUTOINCREMENT, tecnico_id INTEGER, titulo TEXT, mensagem TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS pecas (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, preco REAL, preco_revenda REAL DEFAULT 0, estoque INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS ticket_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER, user_id INTEGER, content TEXT, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS ticket_pecas (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER, peca_id INTEGER, quantidade INTEGER DEFAULT 1, preco_venda REAL DEFAULT 0)`);

  // 2. Executar migrações de colunas de forma sequencial
  const migrations = [
    "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'operador'",
    "ALTER TABLE users ADD COLUMN pode_add_usuario INTEGER DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN cep TEXT",
    "ALTER TABLE clientes ADD COLUMN logradouro TEXT",
    "ALTER TABLE clientes ADD COLUMN bairro TEXT",
    "ALTER TABLE clientes ADD COLUMN cidade TEXT",
    "ALTER TABLE clientes ADD COLUMN uf TEXT",
    "ALTER TABLE clientes ADD COLUMN numero_complemento TEXT",
    "ALTER TABLE tickets ADD COLUMN cliente_id INTEGER",
    "ALTER TABLE tickets ADD COLUMN tecnico_id INTEGER",
    "ALTER TABLE tickets ADD COLUMN valor_total REAL DEFAULT 0",
    "ALTER TABLE tickets ADD COLUMN concluido_em TEXT",
    "ALTER TABLE tickets ADD COLUMN created_at TEXT DEFAULT (datetime('now'))",
    "ALTER TABLE tickets ADD COLUMN prioridade TEXT DEFAULT 'baixa'",
    "ALTER TABLE tickets ADD COLUMN tempo_tecnico_ms INTEGER DEFAULT 0",
    "ALTER TABLE tickets ADD COLUMN timer_inicio TEXT",
    "ALTER TABLE ticket_pecas ADD COLUMN preco_venda REAL DEFAULT 0",
    "ALTER TABLE pecas ADD COLUMN preco_revenda REAL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN cliente_id INTEGER",
    "ALTER TABLE clientes ADD COLUMN password TEXT",
    "ALTER TABLE tickets ADD COLUMN assinatura_digital TEXT",
    "ALTER TABLE tickets ADD COLUMN foto_defeito TEXT",
    "ALTER TABLE pecas ADD COLUMN estoque INTEGER DEFAULT 0"
  ];

  function runMigrations(list) {
    if (list.length === 0) {
      finishInit();
      return;
    }
    const sql = list.shift();
    db.run(sql, (err) => {
      if (err) {
        if (err.message.includes("duplicate column name")) {
          // console.log(`[mig] Coluna já existe.`);
        } else {
          console.error(`[mig-err] ${sql}: ${err.message}`);
        }
      }
      runMigrations(list);
    });
  }

  function finishInit() {
    // 3. Sementes e atualizações de status
    db.run("UPDATE tickets SET status = 'pendente_aprovacao' WHERE status IN ('aguardando_aprovacao', '', NULL)");
    db.run("UPDATE tickets SET status = 'pendente_fornecedor' WHERE status = 'aguardando_fornecedor'");
    db.run("UPDATE tickets SET status = 'concluido' WHERE status = 'finalizado'");

    seedDefaultUsers(db);
    db.run("INSERT OR IGNORE INTO users (username, password, nome, role) VALUES ('israel', '12345678', 'Israel', 'operador')");
    db.run("INSERT OR IGNORE INTO users (username, password, nome, role) VALUES ('teste', '123', 'Teste', 'operador')");
    console.log("Banco de dados pronto e migrado.");
  }

  // Verificação extra de segurança para a coluna preco_revenda
  db.all("PRAGMA table_info(pecas)", (err, columns) => {
    const hasRevenda = columns && columns.some(c => c.name === 'preco_revenda');
    if (!hasRevenda) {
      console.log("[db-fix] Forçando criação da coluna preco_revenda...");
      db.run("ALTER TABLE pecas ADD COLUMN preco_revenda REAL DEFAULT 0", () => {
        runMigrations(migrations);
      });
    } else {
      runMigrations(migrations);
    }
  });
});

// Helper for JSON errors
function jsonError(res, code, message) {
  console.error(`[err ${code}] ${message}`);
  return res.status(code).json({ message });
}

function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) {
    return jsonError(res, 401, "Faça login novamente.");
  }
  let payload;
  try {
    payload = jwt.verify(h.slice(7), JWT_SECRET);
  } catch {
    return jsonError(res, 401, "Sessão expirada ou inválida.");
  }
  db.get(
    "SELECT id, username, nome, role, pode_add_usuario FROM users WHERE id = ?",
    [payload.sub],
    (err, user) => {
      if (err || !user) return jsonError(res, 401, "Usuário inválido.");
      req.user = user;
      next();
    }
  );
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return jsonError(res, 403, "Apenas administrador pode realizar esta ação.");
  }
  next();
}

function requireAddUser(req, res, next) {
  if (!req.user.pode_add_usuario) {
    return res.status(403).json({ message: "Sem permissão para cadastrar usuários." });
  }
  next();
}

app.get("/health", (req, res) => {
  res.json({ ok: true, app: "pgcallsystem", auth: "jwt" });
});

// Endpoint público — abertura de chamado sem login (página abrir-chamado.html)
app.post("/chamado-publico", (req, res) => {
  const { nome, empresa, titulo, descricao } = req.body || {};
  if (!titulo || !String(titulo).trim()) {
    return res.status(400).json({ message: "Título é obrigatório." });
  }
  const tituloFinal = String(titulo).trim();
  const descFinal   = String(descricao || "").trim();

  db.run(
    "INSERT INTO tickets (titulo, descricao, status, prioridade) VALUES (?, ?, 'pendente_aprovacao', 'baixa')",
    [tituloFinal, descFinal],
    function(err) {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ id: this.lastID, message: "Chamado aberto com sucesso!" });
    }
  );
});

app.get("/meta/ticket-statuses", authenticate, (req, res) => {
  res.json(TICKET_STATUSES);
});

app.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  db.get(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password],
    (err, user) => {
      if (err) return res.status(500).json({ message: err.message });

      if (!user) {
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      let token;
      try {
        token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
      } catch (e) {
        console.error("[login] JWT:", e);
        return res.status(500).json({ message: "Erro ao gerar sessão." });
      }

      return res.status(200).json({
        message: "Login sucesso",
        token,
        user: {
          id: user.id,
          username: user.username,
          nome: user.nome || null,
          role: user.role || "operador",
          pode_add_usuario: !!user.pode_add_usuario,
          cliente_id: user.cliente_id || null
        }
      });
    }
  );
});

// Portal do Cliente: Abertura e Acompanhamento
app.post("/portal/tickets", authenticate, (req, res) => {
  if (req.user.role !== "cliente" && !req.user.cliente_id) {
    return res.status(403).json({ message: "Apenas clientes podem abrir chamados por este portal." });
  }

  const { titulo, descricao, foto_defeito } = req.body;
  if (!titulo) return res.status(400).json({ message: "Título é obrigatório." });

  db.run(
    "INSERT INTO tickets (titulo, descricao, status, cliente_id, prioridade, foto_defeito) VALUES (?, ?, 'pendente_aprovacao', ?, 'baixa', ?)",
    [titulo, descricao, req.user.cliente_id, foto_defeito || null],
    function(err) {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ id: this.lastID, message: "Chamado aberto com sucesso!" });
    }
  );
});

app.get("/portal/tickets", authenticate, (req, res) => {
  if (req.user.role !== "cliente" && !req.user.cliente_id) {
    return res.status(403).json({ message: "Acesso restrito a clientes." });
  }

  db.all(
    "SELECT id, titulo, descricao, status, created_at, valor_total FROM tickets WHERE cliente_id = ? ORDER BY created_at DESC",
    [req.user.cliente_id],
    (err, rows) => {
      if (err) return res.status(500).send(err.message);
      res.json(rows);
    }
  );
});

app.get("/clientes", authenticate, (req, res) => {
  db.all("SELECT * FROM clientes ORDER BY nome_completo COLLATE NOCASE", [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

app.get("/clientes/:id", authenticate, (req, res) => {
  db.get("SELECT * FROM clientes WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).send(err.message);
    if (!row) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(row);
  });
});

app.post("/clientes", authenticate, (req, res) => {
  const b = req.body || {};
  const {
    nome_completo,
    celular,
    cpf,
    data_nascimento,
    endereco_completo,
    cep,
    logradouro,
    bairro,
    cidade,
    uf,
    numero_complemento
  } = b;
  if (!nome_completo || !String(nome_completo).trim()) {
    return res.status(400).json({ message: "Nome completo é obrigatório." });
  }
  const enderecoFinal = montarEnderecoCompleto({
    cep,
    logradouro,
    bairro,
    cidade,
    uf,
    numero_complemento,
    endereco_completo
  });
  if (!enderecoFinal) {
    return res.status(400).json({
      message: "Busque o CEP e confirme o endereço, ou preencha o endereço manual."
    });
  }
  const cpfVal = cpf && String(cpf).trim() ? String(cpf).trim() : null;
  const cepDig = String(cep || "").replace(/\D/g, "") || null;
  db.run(
    `INSERT INTO clientes (nome_completo, celular, cpf, data_nascimento, endereco_completo, cep, logradouro, bairro, cidade, uf, numero_complemento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nome_completo.trim(),
      celular || "",
      cpfVal,
      data_nascimento || "",
      enderecoFinal,
      cepDig,
      (logradouro || "").trim() || null,
      (bairro || "").trim() || null,
      (cidade || "").trim() || null,
      (uf || "").trim().toUpperCase().slice(0, 2) || null,
      (numero_complemento || "").trim() || null
    ],
    function (err) {
      if (err) {
        if (String(err.message).includes("UNIQUE")) {
          return res.status(400).json({ message: "CPF já cadastrado." });
        }
        return res.status(500).send(err.message);
      }
      res.json({ id: this.lastID });
    }
  );
});

app.put("/clientes/:id", authenticate, (req, res) => {
  const b = req.body || {};
  const {
    nome_completo,
    celular,
    cpf,
    data_nascimento,
    endereco_completo,
    cep,
    logradouro,
    bairro,
    cidade,
    uf,
    numero_complemento
  } = b;
  if (!nome_completo || !String(nome_completo).trim()) {
    return res.status(400).json({ message: "Nome completo é obrigatório." });
  }
  const enderecoFinal = montarEnderecoCompleto({
    cep,
    logradouro,
    bairro,
    cidade,
    uf,
    numero_complemento,
    endereco_completo
  });
  if (!enderecoFinal) {
    return res.status(400).json({
      message: "Busque o CEP e confirme o endereço, ou preencha o endereço manual."
    });
  }
  const cpfVal = cpf && String(cpf).trim() ? String(cpf).trim() : null;
  const cepDig = String(cep || "").replace(/\D/g, "") || null;
  db.run(
    `UPDATE clientes SET nome_completo = ?, celular = ?, cpf = ?, data_nascimento = ?, endereco_completo = ?,
        cep = ?, logradouro = ?, bairro = ?, cidade = ?, uf = ?, numero_complemento = ?
     WHERE id = ?`,
    [
      nome_completo.trim(),
      celular || "",
      cpfVal,
      data_nascimento || "",
      enderecoFinal,
      cepDig,
      (logradouro || "").trim() || null,
      (bairro || "").trim() || null,
      (cidade || "").trim() || null,
      (uf || "").trim().toUpperCase().slice(0, 2) || null,
      (numero_complemento || "").trim() || null,
      req.params.id
    ],
    function (err) {
      if (err) {
        if (String(err.message).includes("UNIQUE")) {
          return res.status(400).json({ message: "CPF já cadastrado." });
        }
        return res.status(500).send(err.message);
      }
      if (this.changes === 0) return res.status(404).json({ message: "Cliente não encontrado" });
      res.json({ ok: true });
    }
  );
});

app.delete("/clientes/:id", authenticate, (req, res) => {
  db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).send(err.message);
    if (this.changes === 0) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json({ ok: true });
  });
});

app.get("/users", authenticate, requireAddUser, (req, res) => {
  db.all(
    "SELECT id, username, nome, role, pode_add_usuario FROM users ORDER BY id",
    [],
    (err, rows) => {
      if (err) return res.status(500).send(err.message);
      res.json(rows);
    }
  );
});

app.post("/users", authenticate, requireAddUser, (req, res) => {
  const { username, password, nome, role, pode_add_usuario } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Usuário e senha são obrigatórios." });
  }
  let newRole = "operador";
  if (role === "admin") {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Só o administrador pode criar outro administrador." });
    }
    newRole = "admin";
  }
  const pode =
    pode_add_usuario === true || pode_add_usuario === 1 || pode_add_usuario === "1" ? 1 : 0;
  db.run(
    "INSERT INTO users (username, password, nome, role, pode_add_usuario) VALUES (?, ?, ?, ?, ?)",
    [String(username).trim(), password, (nome || "").trim() || null, newRole, pode],
    function (err) {
      if (err) {
        if (String(err.message).includes("UNIQUE")) {
          return res.status(400).json({ message: "Este login já existe." });
        }
        return res.status(500).send(err.message);
      }
      res.json({ id: this.lastID });
    }
  );
});

app.put("/users/:id", authenticate, requireAddUser, (req, res) => {
  const { username, password, nome, role, pode_add_usuario } = req.body;
  const uid = req.params.id;

  let sql = "UPDATE users SET username = ?, nome = ?, role = ?, pode_add_usuario = ?";
  let params = [username, nome, role, pode_add_usuario ? 1 : 0];

  if (password) {
    sql += ", password = ?";
    params.push(password);
  }

  sql += " WHERE id = ?";
  params.push(uid);

  db.run(sql, params, function (err) {
    if (err) {
      if (String(err.message).includes("UNIQUE")) {
        return res.status(400).json({ message: "Este login já existe." });
      }
      return res.status(500).send(err.message);
    }
    res.json({ ok: true });
  });
});

app.post("/tickets", authenticate, (req, res) => {
  const { titulo, descricao, cliente_id, prioridade } = req.body;
  if (!titulo || !String(titulo).trim()) {
    return res.status(400).json({ message: "Título é obrigatório." });
  }
  const cid = parseInt(cliente_id, 10);
  if (!cid || Number.isNaN(cid)) {
    return res.status(400).json({ message: "Selecione o cliente do chamado." });
  }
  db.get("SELECT id FROM clientes WHERE id = ?", [cid], (err, c) => {
    if (err) return res.status(500).send(err.message);
    if (!c) return res.status(400).json({ message: "Cliente inválido." });
    db.run(
      "INSERT INTO tickets (titulo, descricao, status, cliente_id, prioridade) VALUES (?, ?, ?, ?, ?)",
      [titulo.trim(), descricao || "", "pendente_aprovacao", cid, prioridade || 'baixa'],
      function (err2) {
        if (err2) return res.status(500).send(err2.message);
        const ticketId = this.lastID;
        const tit = titulo.trim();
        const des = descricao || "";
        db.get(
          "SELECT nome_completo, celular FROM clientes WHERE id = ?",
          [cid],
          (e3, cli) => {
            let whatsapp_url = null;
            if (cli && cli.celular) {
              const text = msgAberturaChamado({
                clienteNome: cli.nome_completo,
                numeroChamado: ticketId,
                titulo: tit,
                descricao: des
              });
              whatsapp_url = buildWhatsAppUrl(cli.celular, text);
            }
            res.json({ id: ticketId, numero_chamado: ticketId, whatsapp_url });
          }
        );
      }
    );
  });
});

app.get("/tickets", authenticate, (req, res) => {
  db.all(
    `SELECT t.*, c.nome_completo AS cliente_nome, c.celular AS cliente_celular, c.cpf AS cliente_cpf,
            c.data_nascimento AS cliente_data_nascimento, c.endereco_completo AS cliente_endereco,
            c.cep AS cliente_cep, u.nome AS tecnico_nome
     FROM tickets t
     LEFT JOIN clientes c ON c.id = t.cliente_id
     LEFT JOIN users u ON u.id = t.tecnico_id
     ORDER BY t.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send(err.message);
      res.json(rows);
    }
  );
});

app.post("/tickets/:id/take", authenticate, (req, res) => {
  const tid = req.params.id;
  const uid = req.user.id;
  
  db.run("UPDATE tickets SET tecnico_id = ?, timer_inicio = datetime('now') WHERE id = ?", [uid, tid], function (err) {
    if (err) return jsonError(res, 500, "Erro ao atualizar técnico: " + err.message);
    if (this.changes === 0) return jsonError(res, 404, "Chamado não encontrado.");
    res.json({ ok: true, tecnico_nome: req.user.nome || req.user.username });
  });
});

app.put("/tickets/:id", authenticate, (req, res) => {
  const { status, valor_total, assinatura_digital } = req.body;
  const tid = req.params.id;

  db.get("SELECT tecnico_id, timer_inicio, tempo_tecnico_ms FROM tickets WHERE id = ?", [tid], (err, row) => {
    if (err) return jsonError(res, 500, err.message);
    if (!row) return jsonError(res, 404, "Chamado não encontrado");

    if (req.user.role !== "admin" && row.tecnico_id !== req.user.id) {
      return jsonError(res, 403, "Apenas o administrador ou o técnico do chamado podem alterar o status.");
    }

    let sql = "UPDATE tickets SET status = ?";
    let params = [status];

    // ... lógica do timer ...
    const statusAtivos = ['aprovado', 'em_atendimento'];
    const statusPausa = ['pendente_fornecedor', 'pendente_usuario', 'pendente_aprovacao', 'concluido', 'cancelado'];

    if (statusPausa.includes(status) && row.timer_inicio) {
      const agora = new Date();
      const inicio = new Date(row.timer_inicio);
      const decorrido = agora - inicio;
      const novoAcumulado = (row.tempo_tecnico_ms || 0) + decorrido;
      
      sql += ", tempo_tecnico_ms = ?, timer_inicio = NULL";
      params.push(novoAcumulado);
    } else if (statusAtivos.includes(status) && !row.timer_inicio && row.tecnico_id) {
      sql += ", timer_inicio = datetime('now')";
    }

    if (valor_total !== undefined) {
      sql += ", valor_total = ?";
      params.push(valor_total);
    }

    if (assinatura_digital !== undefined) {
      sql += ", assinatura_digital = ?";
      params.push(assinatura_digital);
    }

    if (status === "concluido") {
      sql += ", concluido_em = datetime('now')";
    } else {
      sql += ", concluido_em = NULL";
    }

    sql += " WHERE id = ?";
    params.push(tid);

    db.run(sql, params, function (err2) {
      if (err2) return res.status(500).send(err2.message);
      
      const label = STATUS_LABEL[status];
      db.get(
        `SELECT t.id, t.titulo, t.descricao, c.nome_completo AS cliente_nome, c.celular AS cliente_celular
         FROM tickets t
         LEFT JOIN clientes c ON c.id = t.cliente_id
         WHERE t.id = ?`,
        [tid],
        (e2, rowInfo) => {
          let whatsapp_url = null;
          if (rowInfo && rowInfo.cliente_celular) {
            const text = msgStatusChamado({
              clienteNome: rowInfo.cliente_nome,
              numeroChamado: rowInfo.id,
              titulo: rowInfo.titulo,
              descricao: rowInfo.descricao,
              statusLabel: label
            });
            whatsapp_url = buildWhatsAppUrl(rowInfo.cliente_celular, text);
          }
          res.json({ ok: true, status, label, whatsapp_url });
        }
      );
    });
  });
});

// Rotas de Mensagens Técnicas
app.get("/tecnico/mensagens", authenticate, (req, res) => {
  db.all("SELECT * FROM tecnico_mensagens WHERE tecnico_id = ?", [req.user.id], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

app.post("/tecnico/mensagens", authenticate, (req, res) => {
  const { titulo, mensagem } = req.body;
  db.run("INSERT INTO tecnico_mensagens (tecnico_id, titulo, mensagem) VALUES (?, ?, ?)",
    [req.user.id, titulo, mensagem], function (err) {
      if (err) return res.status(500).send(err.message);
      res.json({ id: this.lastID });
    });
});

// Estatísticas e Rendimento
app.get("/stats/geral", authenticate, (req, res) => {
  // Apenas o Pablo Valentim ou Admin pode ver rendimento geral
  // Para simplificar, vamos checar o nome ou se é admin
  if (req.user.nome !== "Pablo Valentim" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Acesso restrito ao proprietário." });
  }

  const stats = {};
  
  // Por técnico mensal
  const sqlTecnicos = `
    SELECT u.nome, 
           strftime('%Y-%m', t.concluido_em) as mes,
           count(t.id) as total_atendidos,
           sum(t.valor_total) as total_lucro
    FROM tickets t
    JOIN users u ON u.id = t.tecnico_id
    WHERE t.status = 'concluido'
    GROUP BY u.id, mes
    ORDER BY mes DESC, total_lucro DESC
  `;

  // Total empresa por dia/mes
  const sqlEmpresa = `
    SELECT strftime('%Y-%m-%d', t.concluido_em) as data,
           sum(t.valor_total) as ganho_dia
    FROM tickets t
    WHERE t.status = 'concluido'
    GROUP BY data
    ORDER BY ganho_dia DESC
  `;

  db.all(sqlTecnicos, [], (err, rowsTec) => {
    if (err) return res.status(500).send(err.message);
    stats.tecnicos = rowsTec;
    
    db.all(sqlEmpresa, [], (err2, rowsEmp) => {
      if (err2) return res.status(500).send(err2.message);
      stats.empresa = rowsEmp;
      res.json(stats);
    });
  });
});

// Peças
app.get("/pecas", authenticate, (req, res) => {
  db.all("SELECT * FROM pecas ORDER BY nome", [], (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

app.post("/pecas", authenticate, (req, res) => {
  const { nome, preco, preco_revenda, estoque } = req.body;
  if (!nome) return jsonError(res, 400, "Nome da peça é obrigatório.");
  
  const vCusto = parseFloat(preco) || 0;
  const vRevenda = parseFloat(preco_revenda) || 0;
  const vEstoque = parseInt(estoque, 10) || 0;

  console.log(`[pecas] Salvando nova peça: ${nome}, Custo: ${vCusto}, Revenda: ${vRevenda}, Estoque: ${vEstoque}`);

  db.run("INSERT INTO pecas (nome, preco, preco_revenda, estoque) VALUES (?, ?, ?, ?)", 
    [nome, vCusto, vRevenda, vEstoque], 
    function (err) {
      if (err) return jsonError(res, 500, "Erro ao salvar peça no banco: " + err.message);
      res.json({ id: this.lastID, message: "Peça cadastrada." });
    }
  );
});

app.delete("/pecas/:id", authenticate, (req, res) => {
  db.run("DELETE FROM pecas WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).send(err.message);
    res.json({ ok: true });
  });
});

app.put("/pecas/:id", authenticate, (req, res) => {
  const { preco_revenda, estoque } = req.body;
  const id = req.params.id;

  let sql = "UPDATE pecas SET";
  let params = [];

  if (preco_revenda !== undefined) {
    sql += " preco_revenda = ?,";
    params.push(parseFloat(preco_revenda) || 0);
  }
  if (estoque !== undefined) {
    sql += " estoque = ?,";
    params.push(parseInt(estoque, 10) || 0);
  }

  // Remover vírgula extra
  sql = sql.replace(/,$/, "");
  sql += " WHERE id = ?";
  params.push(id);

  db.run(sql, params, function (err) {
    if (err) return jsonError(res, 500, "Erro ao atualizar peça: " + err.message);
    res.json({ ok: true, message: "Peça atualizada." });
  });
});

// Notas de chamados
app.get("/tickets/:id/notes", authenticate, (req, res) => {
  db.all(
    `SELECT n.*, u.nome as user_name FROM ticket_notes n 
     JOIN users u ON u.id = n.user_id 
     WHERE n.ticket_id = ? ORDER BY n.created_at DESC`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).send(err.message);
      res.json(rows);
    }
  );
});

app.post("/tickets/:id/notes", authenticate, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: "Conteúdo da nota é obrigatório." });
  db.run(
    "INSERT INTO ticket_notes (ticket_id, user_id, content) VALUES (?, ?, ?)",
    [req.params.id, req.user.id, content],
    function (err) {
      if (err) return res.status(500).send(err.message);
      res.json({ id: this.lastID });
    }
  );
});

// Peças de chamados
app.get("/tickets/:id/pecas", authenticate, (req, res) => {
  db.all(
    `SELECT tp.*, p.nome, p.preco as preco_custo, p.preco_revenda as preco_venda_original FROM ticket_pecas tp 
     JOIN pecas p ON p.id = tp.peca_id 
     WHERE tp.ticket_id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) return jsonError(res, 500, err.message);
      res.json(rows);
    }
  );
});

app.post("/tickets/:id/pecas", authenticate, (req, res) => {
  const { peca_id, quantidade, preco_venda } = req.body;
  db.run(
    "INSERT INTO ticket_pecas (ticket_id, peca_id, quantidade, preco_venda) VALUES (?, ?, ?, ?)",
    [req.params.id, peca_id, quantidade || 1, preco_venda || 0],
    function (err) {
      if (err) return jsonError(res, 500, "Erro ao vincular peça ao chamado: " + err.message);
      res.json({ id: this.lastID });
    }
  );
});

// Middleware global de erro
app.use((err, req, res, next) => {
  console.error("[Fatal Error]", err);
  res.status(500).json({ 
    message: "Erro interno no servidor.", 
    details: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Fallback — qualquer rota não encontrada serve o index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => console.log(`PGcallSystem — servidor na porta ${PORT}`));
