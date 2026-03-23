const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all("SELECT id, username, password, role FROM users", [], (err, rows) => {
    if (err) {
      console.error('Erro ao listar usuários:', err.message);
    } else {
      console.log('Usuários cadastrados:');
      console.table(rows);
    }
    db.close();
  });
});
