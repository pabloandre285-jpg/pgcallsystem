const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

const now = new Date().toISOString();

db.serialize(() => {
  // Move all non-finalized/non-canceled tickets to 'concluido'
  db.run(`
    UPDATE tickets 
    SET status = 'concluido', 
        concluido_em = ?,
        timer_inicio = NULL,
        tempo_tecnico_ms = tempo_tecnico_ms + CASE 
          WHEN timer_inicio IS NOT NULL 
          THEN (? - strftime('%s', timer_inicio) * 1000) 
          ELSE 0 
        END
    WHERE status NOT IN ('concluido', 'cancelado')
  `, [now, Date.now()], function(err) {
    if (err) {
      console.error('Erro ao atualizar chamados:', err.message);
    } else {
      console.log(`${this.changes} chamados foram movidos para concluído.`);
    }
    db.close();
  });
});
