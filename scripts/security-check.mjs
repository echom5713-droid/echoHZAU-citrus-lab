import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ensureData, readUsers } from '../src/lib/storage.js';
import { verifyPassword, cookieMap } from '../src/lib/security.js';
import { serveStatic } from '../src/lib/http.js';

await ensureData();
const users = await readUsers();
for (const user of users) {
  if (user.password) throw new Error(`Plaintext password found for ${user.username}`);
  if (!String(user.passwordHash || '').startsWith('scrypt$')) throw new Error(`Missing scrypt passwordHash for ${user.username}`);
}
const student = users.find(u => u.username === 'student001');
if (!student || !verifyPassword('123456', student.passwordHash)) throw new Error('Default student password verification failed');

const malformedCookies = cookieMap({ headers: { cookie: 'safe=ok; broken=%E0%A4%A; citrus_sid=abc123' } });
if (malformedCookies.safe !== 'ok' || malformedCookies.citrus_sid !== 'abc123') {
  throw new Error('Malformed cookie handling failed');
}

const outsideServed = await serveStatic('/static/..%2Fpackage.json', {
  writeHead() { throw new Error('Path traversal unexpectedly wrote headers'); },
  end() { throw new Error('Path traversal unexpectedly wrote body'); }
});
if (outsideServed) throw new Error('Static path traversal was served');

const http = await readFile(new URL('../src/lib/http.js', import.meta.url), 'utf8');
if (!http.includes('path.relative(publicRoot, filePath)')) throw new Error('Static path boundary check is not using path.relative');
if (http.includes('filePath.startsWith(publicRoot)')) throw new Error('Unsafe startsWith static path check found');

const security = await readFile(new URL('../src/lib/security.js', import.meta.url), 'utf8');
if (!security.includes('catch') || !security.includes('decodeURIComponent')) throw new Error('Cookie decode guard not found');

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (pkg.scripts?.start?.includes('NODE_ENV=production')) throw new Error('Non-cross-platform start script found');
if (!existsSync(new URL('./backup-db.mjs', import.meta.url))) throw new Error('Cross-platform backup script missing');
if (!existsSync(new URL('./restore-db.mjs', import.meta.url))) throw new Error('Cross-platform restore script missing');

const server = await readFile(new URL('../server.js', import.meta.url), 'utf8');
if (server.includes('x.password===body.password') || server.includes("password:'123456'")) throw new Error('Unsafe password comparison pattern found');
if (!server.includes("server.on('error'") || !server.includes('EADDRINUSE')) throw new Error('Friendly port error handler missing');

console.log('SECURITY_CHECK_PASS');

process.exit(0);
