const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("INSERT OR IGNORE INTO users (username, password, nome, role) VALUES ('teste', '123', 'Teste', 'operador')", function(err) {
    if (err) {
      console.error('Erro ao adicionar usuário teste:', err.message);
    } else {
      console.log('Usuário teste adicionado com sucesso!');
    }
    db.close();
  });
});
