import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { hashPassword, isPasswordHash, nowIso } from './security.js';
import { DEMO_RECORDS } from '../views/pages.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DB_FILE = path.join(DATA_DIR, 'citrus.db');
const WANT_JSON = String(process.env.STORAGE_MODE || '').toLowerCase() === 'json';
const SESSION_MS = Number(process.env.SESSION_TTL_MS || 24 * 60 * 60 * 1000);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 10 * 60 * 1000);
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 8);

let db = null;
let DatabaseSync = null;
let writeQueue = Promise.resolve();
const memorySessions = new Map();

export const storageInfo = {
  mode: 'initializing',
  dataDir: DATA_DIR,
  recordsFile: RECORDS_FILE,
  usersFile: USERS_FILE,
  dbFile: DB_FILE,
  note: '优先使用 SQLite；如运行环境不支持 node:sqlite，则自动回退 JSONStorage。'
};

function defaultUsers() {
  return [
    { id:'u-stu-001', role:'student', username:'student001', passwordHash:hashPassword('123456'), defaultPassword:true, name:'林知远', class_name:'高二化学探究班', group_name:'第3组', status:'active', created_at:nowIso() },
    { id:'u-stu-002', role:'student', username:'student002', passwordHash:hashPassword('123456'), defaultPassword:true, name:'陈予安', class_name:'高二化学探究班', group_name:'第2组', status:'active', created_at:nowIso() },
    { id:'u-stu-003', role:'student', username:'student003', passwordHash:hashPassword('123456'), defaultPassword:true, name:'许嘉宁', class_name:'高二化学探究班', group_name:'第1组', status:'active', created_at:nowIso() },
    { id:'u-tea-001', role:'teacher', username:'teacher001', passwordHash:hashPassword('123456'), defaultPassword:true, name:'周老师', class_name:'高二化学探究班', status:'active', created_at:nowIso() },
    { id:'u-admin-001', role:'admin', username:'admin', passwordHash:hashPassword('123456'), defaultPassword:true, name:'系统管理员', status:'active', created_at:nowIso() }
  ];
}

async function readJson(file, fallback) {
  try {
    const raw = await readFile(file, 'utf8');
    const val = JSON.parse(raw);
    return val ?? fallback;
  } catch {
    return fallback;
  }
}

function atomicWrite(file, value) {
  writeQueue = writeQueue.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
    await rename(tmp, file);
  });
  return writeQueue;
}

function sanitizeUserForStorage(user) {
  const next = { ...user };
  if (next.password && !next.passwordHash) {
    next.passwordHash = hashPassword(next.password);
    delete next.password;
  }
  if (next.passwordHash && !isPasswordHash(next.passwordHash)) {
    next.passwordHash = hashPassword(String(next.passwordHash));
  }
  delete next.passwordSalt;
  if (!next.id) next.id = `${next.role || 'user'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  if (!next.status) next.status = 'active';
  return next;
}

function j(value) { return JSON.stringify(value ?? {}); }
function parseJson(value, fallback = {}) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }

async function setupSqlite() {
  if (WANT_JSON) throw new Error('STORAGE_MODE=json');
  const sqlite = await import('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      teacher_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      default_password INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      class_name TEXT,
      group_name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      data_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_role_class ON users(role, class_name);
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      class_name TEXT NOT NULL,
      created_by TEXT,
      student_name TEXT,
      nh4cl_concentration REAL,
      yield_percent REAL,
      created_at TEXT NOT NULL,
      data_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_records_class_created ON records(class_name, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_records_class_conc ON records(class_name, nh4cl_concentration);
    CREATE TABLE IF NOT EXISTS sessions (
      sid_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      ip TEXT,
      ua TEXT,
      created_at TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_exp ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS login_attempts (
      attempt_key TEXT PRIMARY KEY,
      ip TEXT,
      username TEXT,
      route TEXT,
      count INTEGER NOT NULL DEFAULT 0,
      first_at_ms INTEGER NOT NULL,
      locked_until_ms INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_role TEXT,
      actor_username TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      class_name TEXT,
      ip TEXT,
      ua TEXT,
      ok INTEGER NOT NULL DEFAULT 1,
      detail_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_class ON audit_logs(class_name, created_at DESC);
    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      path TEXT NOT NULL,
      mime TEXT,
      size INTEGER DEFAULT 0,
      uploader_id TEXT,
      class_name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_questions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      class_name TEXT,
      question TEXT NOT NULL,
      answer TEXT,
      created_at TEXT NOT NULL
    );
  `);
  // v212 defensive migrations for databases created by older packages.
  const userCols = new Set(db.prepare('PRAGMA table_info(users)').all().map(c => c.name));
  if (!userCols.has('data_json')) db.exec('ALTER TABLE users ADD COLUMN data_json TEXT');
  if (!userCols.has('updated_at')) db.exec('ALTER TABLE users ADD COLUMN updated_at TEXT');
  if (!userCols.has('status')) db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  if (!userCols.has('default_password')) db.exec('ALTER TABLE users ADD COLUMN default_password INTEGER NOT NULL DEFAULT 1');
  const recCols = new Set(db.prepare('PRAGMA table_info(records)').all().map(c => c.name));
  if (!recCols.has('data_json')) db.exec("ALTER TABLE records ADD COLUMN data_json TEXT NOT NULL DEFAULT '{}'");
  if (!recCols.has('created_by')) db.exec("ALTER TABLE records ADD COLUMN created_by TEXT");
  if (!recCols.has('student_name')) db.exec("ALTER TABLE records ADD COLUMN student_name TEXT");
  if (!recCols.has('nh4cl_concentration')) db.exec("ALTER TABLE records ADD COLUMN nh4cl_concentration REAL");
  if (!recCols.has('yield_percent')) db.exec("ALTER TABLE records ADD COLUMN yield_percent REAL");
  db.prepare('INSERT OR IGNORE INTO migrations(version, name, applied_at) VALUES(?, ?, ?)').run(1, 'initial_sqlite_schema', nowIso());
  db.prepare('INSERT OR IGNORE INTO migrations(version, name, applied_at) VALUES(?, ?, ?)').run(212, 'v212_admin_user_import_fk_safe', nowIso());
}

function insertUser(user) {
  const u = sanitizeUserForStorage(user);
  db.prepare(`INSERT OR REPLACE INTO users(id,role,username,password_hash,default_password,name,class_name,group_name,status,data_json,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      u.id, u.role, u.username, u.passwordHash, u.defaultPassword ? 1 : 0, u.name || u.username,
      u.class_name || '', u.group_name || '', u.status || 'active', j(u), u.created_at || nowIso(), u.updated_at || null
    );
  if (u.class_name) {
    db.prepare('INSERT OR IGNORE INTO classes(id,name,teacher_id,created_at) VALUES(?,?,?,?)')
      .run(`class-${Buffer.from(u.class_name).toString('hex').slice(0,24)}`, u.class_name, u.role === 'teacher' ? u.id : null, nowIso());
  }
}

function insertRecord(record) {
  const r = { ...record };
  if (!r.id) r.id = `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  r.class_name = r.class_name || '高二化学探究班';
  r.created_at = r.created_at || nowIso();
  db.prepare(`INSERT OR REPLACE INTO records(id,class_name,created_by,student_name,nh4cl_concentration,yield_percent,created_at,data_json)
    VALUES(?,?,?,?,?,?,?,?)`).run(
      r.id, r.class_name, r.created_by || '', r.student_name || '', Number(r.nh4cl_concentration), Number(r.yield_percent), r.created_at, j(r)
    );
}

async function seedSqliteFromJsonIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (!userCount) {
    const raw = await readJson(USERS_FILE, defaultUsers());
    const users = Array.isArray(raw) ? raw.map(sanitizeUserForStorage) : defaultUsers();
    for (const u of users) insertUser(u);
  }
  const recCount = db.prepare('SELECT COUNT(*) AS c FROM records').get().c;
  if (!recCount) {
    const records = await readJson(RECORDS_FILE, DEMO_RECORDS);
    for (const r of (Array.isArray(records) ? records : DEMO_RECORDS)) insertRecord(r);
  }
}

export async function ensureData() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(RECORDS_FILE)) await atomicWrite(RECORDS_FILE, DEMO_RECORDS);
  if (!existsSync(USERS_FILE)) await atomicWrite(USERS_FILE, defaultUsers());
  try {
    await setupSqlite();
    await seedSqliteFromJsonIfEmpty();
    storageInfo.mode = 'sqlite';
    storageInfo.note = '正式模式使用 SQLite，JSON 文件保留为本地兜底与导入来源。';
  } catch (err) {
    db = null;
    storageInfo.mode = 'local-json-adapter';
    storageInfo.note = `SQLite 不可用，已回退 JSONStorage：${err.message}`;
    await readUsers();
  }
}

export async function readRecords(options = {}) {
  if (db) {
    let rows;
    if (options.class_name && !options.includeAll) {
      rows = db.prepare('SELECT data_json FROM records WHERE class_name = ? ORDER BY created_at DESC').all(options.class_name);
    } else {
      rows = db.prepare('SELECT data_json FROM records ORDER BY created_at DESC').all();
    }
    return rows.map(r => parseJson(r.data_json, {}));
  }
  const records = await readJson(RECORDS_FILE, []);
  let out = Array.isArray(records) ? records : [];
  if (options.class_name && !options.includeAll) out = out.filter(r => r.class_name === options.class_name);
  return out;
}

export async function saveRecords(records) {
  if (db) {
    const items = Array.isArray(records) ? records : [];
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("DELETE FROM records").run();
      for (const r of items) insertRecord(r);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    return;
  }
  await atomicWrite(RECORDS_FILE, Array.isArray(records) ? records : []);
}
export async function addRecord(record) {
  if (db) { insertRecord(record); return; }
  const records = await readRecords();
  records.unshift(record);
  await saveRecords(records);
}

export async function updateRecord(recordId, patch = {}) {
  const records = await readRecords({ includeAll: true });
  const idx = records.findIndex(r => String(r.id) === String(recordId));
  if (idx < 0) return null;
  records[idx] = { ...records[idx], ...patch, updated_at: nowIso() };
  await saveRecords(records);
  return records[idx];
}

export async function deleteRecord(recordId) {
  const records = await readRecords({ includeAll: true });
  const next = records.filter(r => String(r.id) !== String(recordId));
  if (next.length === records.length) return false;
  await saveRecords(next);
  return true;
}

export async function readUsers(options = {}) {
  if (db) {
    let rows;
    if (options.class_name && !options.includeAll) rows = db.prepare('SELECT * FROM users WHERE class_name = ? ORDER BY role, username').all(options.class_name);
    else rows = db.prepare('SELECT * FROM users ORDER BY role, username').all();
    return rows.map(row => ({ ...parseJson(row.data_json, {}), id: row.id, role: row.role, username: row.username, passwordHash: row.password_hash, defaultPassword: Boolean(row.default_password), name: row.name, class_name: row.class_name, group_name: row.group_name, status: row.status }));
  }
  const raw = await readJson(USERS_FILE, defaultUsers());
  let users = Array.isArray(raw) ? raw : defaultUsers();
  let changed = false;
  users = users.map(user => { const next = sanitizeUserForStorage(user); if (JSON.stringify(next) !== JSON.stringify(user)) changed = true; return next; });
  if (changed) await saveUsers(users);
  if (options.class_name && !options.includeAll) users = users.filter(u => u.class_name === options.class_name);
  return users;
}

export async function saveUsers(users) {
  const clean = (Array.isArray(users) ? users : []).map(sanitizeUserForStorage);
  if (db) {
    db.exec("BEGIN IMMEDIATE");
    try {
      // v212: never DELETE all users during admin create/import.
      // Active sessions have a foreign key to users; deleting rows can make
      // create/import fail while an administrator is logged in.
      for (const u of clean) insertUser(u);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    return;
  }
  await atomicWrite(USERS_FILE, clean);
}
export async function updateUser(userId, patch) {
  if (db) {
    const row = db.prepare('SELECT * FROM users WHERE id = ? OR username = ?').get(userId, userId);
    if (!row) return null;
    const current = {
      ...parseJson(row.data_json, {}),
      id: row.id,
      role: row.role,
      username: row.username,
      passwordHash: row.password_hash,
      defaultPassword: Boolean(row.default_password),
      name: row.name,
      class_name: row.class_name,
      group_name: row.group_name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    const next = sanitizeUserForStorage({ ...current, ...patch, updated_at: nowIso() });
    db.prepare(`UPDATE users
      SET role = ?, username = ?, password_hash = ?, default_password = ?, name = ?, class_name = ?, group_name = ?, status = ?, data_json = ?, updated_at = ?
      WHERE id = ?`)
      .run(
        next.role, next.username, next.passwordHash, next.defaultPassword ? 1 : 0, next.name || next.username,
        next.class_name || '', next.group_name || '', next.status || 'active', j(next), next.updated_at || nowIso(), row.id
      );
    return next;
  }
  const users = await readUsers({ includeAll: true });
  const idx = users.findIndex(u => u.id === userId || u.username === userId);
  if (idx < 0) return null;
  users[idx] = sanitizeUserForStorage({ ...users[idx], ...patch, updated_at: nowIso() });
  await saveUsers(users);
  return users[idx];
}

export async function createSession({ sidHash, user, ip, ua, ttlMs = SESSION_MS }) {
  const expiresAt = Date.now() + ttlMs;
  if (db) {
    db.prepare('INSERT OR REPLACE INTO sessions(sid_hash,user_id,role,ip,ua,created_at,expires_at,revoked_at) VALUES(?,?,?,?,?,?,?,NULL)')
      .run(sidHash, user.id, user.role, ip || '', ua || '', nowIso(), expiresAt);
  } else {
    memorySessions.set(sidHash, { ...user, sidHash, expires_at: expiresAt, revoked_at: null });
  }
  return { sid_hash: sidHash, user_id: user.id, expires_at: expiresAt };
}

export async function readSession(sidHash) {
  if (!sidHash) return null;
  if (!db) {
    const row = memorySessions.get(sidHash);
    if (!row || row.revoked_at || Date.now() > Number(row.expires_at)) return null;
    return { ...row, sidHash, defaultPassword: Boolean(row.defaultPassword) };
  }
  const row = db.prepare(`SELECT s.sid_hash, s.expires_at, s.revoked_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.sid_hash = ?`).get(sidHash);
  if (!row || row.revoked_at || Date.now() > Number(row.expires_at)) return null;
  return { ...parseJson(row.data_json, {}), sidHash: row.sid_hash, id: row.id, role: row.role, username: row.username, name: row.name, class_name: row.class_name, group_name: row.group_name, status: row.status, defaultPassword: Boolean(row.default_password), expires_at: row.expires_at };
}

export async function revokeSession(sidHash) {
  if (db && sidHash) db.prepare('UPDATE sessions SET revoked_at = ? WHERE sid_hash = ?').run(nowIso(), sidHash);
  if (!db && sidHash) memorySessions.delete(sidHash);
}

export async function updateSessionForUser(userId) {
  // Session rows join users at read time, so no snapshot update is needed.
  return Boolean(userId);
}

export async function checkLoginRateLimit({ key }) {
  const now = Date.now();
  if (db) {
    const item = db.prepare('SELECT * FROM login_attempts WHERE attempt_key = ?').get(key);
    if (item?.locked_until_ms && now < Number(item.locked_until_ms)) return { ok: false, retryAfter: Math.ceil((Number(item.locked_until_ms) - now) / 1000) };
    if (item && now - Number(item.first_at_ms) > LOGIN_WINDOW_MS) {
      db.prepare('DELETE FROM login_attempts WHERE attempt_key = ?').run(key);
    }
  }
  return { ok: true };
}

export async function registerLoginFailure({ key, ip, username, route }) {
  const now = Date.now();
  if (!db) return;
  const item = db.prepare('SELECT * FROM login_attempts WHERE attempt_key = ?').get(key);
  const fresh = !item || now - Number(item.first_at_ms) > LOGIN_WINDOW_MS;
  const count = fresh ? 1 : Number(item.count) + 1;
  const lockedUntil = count >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_WINDOW_MS : 0;
  db.prepare(`INSERT OR REPLACE INTO login_attempts(attempt_key,ip,username,route,count,first_at_ms,locked_until_ms,updated_at) VALUES(?,?,?,?,?,?,?,?)`)
    .run(key, ip || '', username || '', route || '', count, fresh ? now : item.first_at_ms, lockedUntil, nowIso());
}

export async function clearLoginFailures(key) {
  if (db) db.prepare('DELETE FROM login_attempts WHERE attempt_key = ?').run(key);
}

export async function auditLog({ actor, action, targetType, targetId, className, ip, ua, ok = true, detail = {} }) {
  if (!db) return;
  db.prepare(`INSERT INTO audit_logs(id,actor_id,actor_role,actor_username,action,target_type,target_id,class_name,ip,ua,ok,detail_json,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      actor?.id || '', actor?.role || '', actor?.username || '', action, targetType || '', targetId || '', className || actor?.class_name || '', ip || '', ua || '', ok ? 1 : 0, j(detail), nowIso()
    );
}

export async function metrics() {
  const mem = process.memoryUsage();
  const base = { dbMode: storageInfo.mode, dbFile: storageInfo.mode === 'sqlite' ? DB_FILE : null, memoryMB: Math.round(mem.rss / 1024 / 1024), uptime: +process.uptime().toFixed(1) };
  if (!db) return { ...base, users: (await readUsers()).length, records: (await readRecords()).length, sessions: 0, auditLogs: 0 };
  return {
    ...base,
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    records: db.prepare('SELECT COUNT(*) AS c FROM records').get().c,
    sessions: db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE revoked_at IS NULL AND expires_at > ?').get(Date.now()).c,
    auditLogs: db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c,
    loginAttemptRows: db.prepare('SELECT COUNT(*) AS c FROM login_attempts').get().c
  };
}

export function classScopeFor(session, { demo = false } = {}) {
  if (demo) return { includeAll: true, demo: true };
  if (!session) return { class_name: '', includeAll: false };
  if (session.role === 'admin') return { includeAll: true };
  return { class_name: session.class_name || '高二化学探究班', includeAll: false };
}
