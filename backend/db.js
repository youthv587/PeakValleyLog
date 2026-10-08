/**
 * SQLite 数据库 (better-sqlite3 —— 同步 API, 零依赖, 文件存储)
 * 首次启动自动建库建表, 无需外部数据库服务
 */
const path = require('path');
const fs = require('fs');

// 优先用环境变量指定, 否则放在项目根目录
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'peakvalley_log.db');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[DB] better-sqlite3 未安装, 请执行: cd backend && npm install');
  throw e;
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 建表 (SQLite 方言)
db.exec(`
CREATE TABLE IF NOT EXISTS symbols (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  code            TEXT    NOT NULL,
  category        TEXT    NOT NULL DEFAULT 'etf',
  avg_price       REAL    NOT NULL,
  high_theory     REAL    NOT NULL,
  low_theory      REAL    NOT NULL,
  base_return     REAL    NOT NULL DEFAULT 0,
  base_risk       REAL    NOT NULL DEFAULT 0,
  warn_high       REAL    DEFAULT NULL,
  warn_low        REAL    DEFAULT NULL,
  current_price   REAL    DEFAULT NULL,
  note            TEXT    DEFAULT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(category, code)
);
`);

console.log(`[DB] SQLite ready: ${DB_PATH}`);

// 便利方法: 统一参数绑定 (better-sqlite3 用 ? 占位符, 与 mysql2 一致)
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (/^\s*INSERT\s/i.test(sql)) {
    const info = stmt.run(...params);
    return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }];
  }
  if (/^\s*UPDATE\s|^\s*DELETE\s/i.test(sql)) {
    const info = stmt.run(...params);
    return [{ affectedRows: info.changes }];
  }
  const rows = stmt.all(...params);
  return [rows];
}

// mock mysql2 的 pool.query 接口, 保持上层路由代码不变
const pool = { query };

// 提供 getConnection (db.js 启动探测用)
pool.getConnection = async () => ({ release() {} });

module.exports = pool;
