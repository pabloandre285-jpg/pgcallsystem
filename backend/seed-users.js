const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { seedDefaultUsers } = require("./users-seed");

const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      nome TEXT,
      role TEXT DEFAULT 'operador',
      pode_add_usuario INTEGER DEFAULT 0
    )`,
    (err) => err && console.error(err.message)
  );
  db.run("ALTER TABLE users ADD COLUMN nome TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'operador'", () => {});
  db.run("ALTER TABLE users ADD COLUMN pode_add_usuario INTEGER DEFAULT 0", () => {});

  seedDefaultUsers(db, (err) => {
    if (!err) console.log("OK — usuários Pablo + admin");
    db.close();
  });
});
