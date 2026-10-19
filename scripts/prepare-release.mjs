import { rm, mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'data');

async function removeIfExists(target) {
  if (existsSync(target)) await rm(target, { recursive: true, force: true });
}

console.log('prepare-release: starting security cleanup...');

// 1. Remove database files (will be recreated on first start)
for (const file of ['citrus.db', 'citrus.db-wal', 'citrus.db-shm']) {
  await removeIfExists(path.join(dataDir, file));
}
console.log('  ✓ Removed database files');

// 2. Clear user data files (reset to empty)
for (const file of ['users.json', 'records.json', 'practice_answers.json']) {
  const fp = path.join(dataDir, file);
  if (existsSync(fp)) {
    await writeFile(fp, '[]', 'utf8');
    console.log(`  ✓ Cleared ${file}`);
  }
}

// 3. Handle .env - replace with .env.example
const envPath = path.join(root, '.env');
const envExamplePath = path.join(root, '.env.example');
if (existsSync(envPath)) {
  await rm(envPath);
  console.log('  ✓ Removed .env (contains real API keys)');
}
// Create .env.example if it doesn't exist
const envExampleContent = `# DeepSeek API Configuration
# Get your API key from https://platform.deepseek.com
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_API_BASE=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# Server port (default for this deployment package)
PORT=3001
`;
await writeFile(envExamplePath, envExampleContent, 'utf8');
console.log('  ✓ Created .env.example');

// 4. Remove backups
await removeIfExists(path.join(root, 'backups'));
console.log('  ✓ Removed backups directory');

// 5. Remove any stray sensitive files
for (const file of ['data/sessions.json', 'data/audit.json']) {
  await removeIfExists(path.join(root, file));
}

console.log('\nprepare-release: security cleanup complete.');
console.log('The application will recreate database and default users on first start (via ensureData).');
console.log('Remember: copy .env.example to .env and fill in your DeepSeek API key before starting.');
