/**
 * Contas padrão:
 * - 19996322975 — Pablo Valentim (operador, pode cadastrar usuários)
 * - admin — Administrador
 */
function seedDefaultUsers(db, callback) {
  const sql = `INSERT INTO users (username, password, nome, role, pode_add_usuario) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET
       password = excluded.password,
       nome = excluded.nome,
       role = excluded.role,
       pode_add_usuario = excluded.pode_add_usuario`;

  db.run(
    sql,
    ["19996322975", "DrP@157pp", "Pablo Valentim", "operador", 1],
    (err) => {
      if (err) console.error("[users-seed] Pablo:", err.message);
      db.run(
        sql,
        ["admin", "&DyxSJySrhA5", "Administrador", "admin", 1],
        (err2) => {
          if (err2) console.error("[users-seed] admin:", err2.message);
          if (callback) callback(err || err2);
        }
      );
    }
  );
}

module.exports = { seedDefaultUsers };
