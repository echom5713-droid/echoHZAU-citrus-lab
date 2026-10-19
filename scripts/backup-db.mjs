import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'data');
const backupDir = path.join(root, 'backups');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await mkdir(backupDir, { recursive: true });

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function backupSqlite(dbPath) {
  if (!existsSync(dbPath)) return false;
  const dest = path.join(backupDir, `citrus.db.${stamp}.bak`);
  try {
    const sqlite = await import('node:sqlite');
    const db = new sqlite.DatabaseSync(dbPath);
    try {
      // Fold committed WAL pages into a stable state before producing a snapshot.
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      // VACUUM INTO creates a consistent SQLite backup even when WAL mode is enabled.
      db.exec(`VACUUM INTO ${sqlString(dest)};`);
      console.log(`backup sqlite: ${dbPath} -> ${dest} (VACUUM INTO)`);
      return true;
    } finally {
      try { db.close(); } catch {}
    }
  } catch (err) {
    console.warn(`backup sqlite: VACUUM INTO failed, falling back to checkpoint + copy. Reason: ${err?.message || err}`);
    try {
      const sqlite = await import('node:sqlite');
      const db = new sqlite.DatabaseSync(dbPath);
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } finally { try { db.close(); } catch {} }
    } catch {}
    await copyFile(dbPath, dest);
    console.log(`backup sqlite: ${dbPath} -> ${dest} (copy fallback)`);
    return true;
  }
}

let copied = 0;
if (await backupSqlite(path.join(dataDir, 'citrus.db'))) copied += 1;

for (const file of ['records.json', 'users.json']) {
  const src = path.join(dataDir, file);
  if (!existsSync(src)) continue;
  const dest = path.join(backupDir, `${file}.${stamp}.bak`);
  await copyFile(src, dest);
  console.log(`backup json: ${src} -> ${dest}`);
  copied += 1;
}

if (!copied) console.log('backup: no data files found');
