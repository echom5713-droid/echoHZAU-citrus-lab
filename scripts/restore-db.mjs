import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const [, , backupFile, targetName] = process.argv;
if (!backupFile) {
  console.error('Usage: npm run restore -- <backup-file> [target-name]');
  process.exit(1);
}
const root = process.cwd();
const target = targetName || path.basename(backupFile).replace(/\.\d{4}-.+\.bak$/, '');
await mkdir(path.join(root, 'data'), { recursive: true });
const dest = path.join(root, 'data', target);
await copyFile(path.resolve(backupFile), dest);
console.log(`restore: ${backupFile} -> ${dest}`);
