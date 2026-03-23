const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Criar cliente teste "Pablo Empresa" se não existir
  db.run(`INSERT OR IGNORE INTO clientes (nome_completo, celular, cpf) VALUES ('Pablo Empresa', '11999999999', '123.456.789-00')`, function(err) {
    if (err) return console.error(err.message);
    
    // Obter ID do cliente
    db.get("SELECT id FROM clientes WHERE nome_completo = 'Pablo Empresa'", (err, row) => {
      if (err || !row) return console.error("Erro ao achar cliente");
      
      const cid = row.id;
      // Criar usuário cliente associado
      db.run(`
        INSERT OR IGNORE INTO users (username, password, nome, role, cliente_id) 
        VALUES ('cliente', '123', 'Pablo Cliente', 'cliente', ?)
      `, [cid], function(err2) {
        if (err2) console.error(err2.message);
        else console.log("Usuário 'cliente' com senha '123' criado com sucesso para testes do portal!");
        db.close();
      });
    });
  });
});
