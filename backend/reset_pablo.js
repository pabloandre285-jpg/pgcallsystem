const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Garante que o usuário Pablo Valentim tenha as credenciais corretas
  db.run(`
    UPDATE users 
    SET password = '123' 
    WHERE username = '19996322975' OR nome = 'Pablo Valentim'
  `, function(err) {
    if (err) {
      console.error('Erro ao resetar senha do Pablo:', err.message);
    } else {
      console.log(`Senha do Pablo resetada para '123'. ${this.changes} registro(s) alterado(s).`);
    }
    db.close();
  });
});
