import betterSqlite3 from 'better-sqlite3';
import path from 'path';

for (const name of ['apidoct.db', 'freeapi.db']) {
  try {
    const dbPath = path.resolve('./server/data', name);
    const db = betterSqlite3(dbPath);
    const res = db.prepare("UPDATE api_keys SET status = 'healthy' WHERE enabled = 1").run();
    console.log(name, 'keys updated:', res.changes);
  } catch (err) {
    console.error(name, err.message);
  }
}
